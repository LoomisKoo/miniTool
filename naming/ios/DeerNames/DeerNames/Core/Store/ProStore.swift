import Foundation
import Observation
import StoreKit

/* StoreKit 2 买断制。商品尚未在 App Store Connect 建好时：
 *  - `product` 为空，付费墙显示「暂不可用」；
 *  - DEBUG / 模拟器下默认开通 Pro，方便联调。 */

@Observable
@MainActor
final class ProStore {
    static let productID = "com.deernames.pro.lifetime"
    private static let cacheKey = "naming.pro.unlocked.v1"
    private static let debugKey = "naming.pro.debugUnlock.v1"

    var isPro = false
    var product: Product?
    var purchasing = false
    var lastError: String?
    var showPaywall = false
    /// 付费墙被哪个功能唤起（埋点 / 文案用）。
    var paywallFeature: ProFeature?

    private var listenTask: Task<Void, Never>?

    /// Debug 构建或模拟器：默认当已购处理（设置里仍可 DEBUG 关掉）。
    static var autoUnlockInDev: Bool {
        #if DEBUG
        true
        #elseif targetEnvironment(simulator)
        true
        #else
        false
        #endif
    }

    init() {
        if Self.autoUnlockInDev {
            /* 首次进开发环境默认开；用户在设置里关掉后尊重 debugKey = false。 */
            if UserDefaults.standard.object(forKey: Self.debugKey) == nil {
                UserDefaults.standard.set(true, forKey: Self.debugKey)
            }
        }
        isPro = resolvedPro()
    }

    func start() async {
        listenTask?.cancel()
        listenTask = Task { await listenForTransactions() }
        await loadProduct()
        await refreshEntitlement()
    }

    func allowed(_ feature: ProFeature) -> Bool { isPro }

    func require(_ feature: ProFeature) -> Bool {
        if isPro { return true }
        paywallFeature = feature
        showPaywall = true
        return false
    }

    func loadProduct() async {
        do {
            let list = try await Product.products(for: [Self.productID])
            product = list.first
            lastError = nil
        } catch {
            lastError = error.localizedDescription
        }
    }

    func purchase() async {
        guard let product else {
            lastError = L10n.t("商品暂未上架，请稍后再试")
            return
        }
        purchasing = true
        defer { purchasing = false }
        do {
            let result = try await product.purchase()
            switch result {
            case .success(let verification):
                let tx = try checkVerified(verification)
                await tx.finish()
                await refreshEntitlement()
                showPaywall = false
            case .userCancelled, .pending:
                break
            @unknown default:
                break
            }
        } catch {
            lastError = error.localizedDescription
        }
    }

    func restore() async {
        purchasing = true
        defer { purchasing = false }
        do {
            try await AppStore.sync()
            await refreshEntitlement()
            if !isPro {
                lastError = L10n.t("没有找到可恢复的购买")
            } else {
                lastError = nil
                showPaywall = false
            }
        } catch {
            lastError = error.localizedDescription
        }
    }

    func refreshEntitlement() async {
        var storeUnlocked = false
        for await result in Transaction.currentEntitlements {
            if let tx = try? checkVerified(result), tx.productID == Self.productID {
                storeUnlocked = true
                break
            }
        }
        if storeUnlocked {
            UserDefaults.standard.set(true, forKey: Self.cacheKey)
        }
        isPro = resolvedPro(storeUnlocked: storeUnlocked)
    }

    /// App 启动后调用：开发 / 模拟器环境强制开通（设置里 DEBUG 关掉只影响当前会话，下次启动仍开）。
    func ensureDevUnlock() {
        guard Self.autoUnlockInDev else { return }
        UserDefaults.standard.set(true, forKey: Self.debugKey)
        isPro = true
    }

#if DEBUG
    func debugToggleUnlock() {
        let next = !UserDefaults.standard.bool(forKey: Self.debugKey)
        UserDefaults.standard.set(next, forKey: Self.debugKey)
        isPro = resolvedPro()
    }
#endif

    // MARK: - private

    private func resolvedPro(storeUnlocked: Bool = UserDefaults.standard.bool(forKey: cacheKey)) -> Bool {
        if storeUnlocked { return true }
        if UserDefaults.standard.bool(forKey: Self.cacheKey) { return true }
        if Self.autoUnlockInDev, UserDefaults.standard.bool(forKey: Self.debugKey) {
            return true
        }
        return false
    }

    private func listenForTransactions() async {
        for await result in Transaction.updates {
            if let tx = try? checkVerified(result) {
                await tx.finish()
                await refreshEntitlement()
            }
        }
    }

    private func checkVerified<T>(_ result: VerificationResult<T>) throws -> T {
        switch result {
        case .unverified(_, let error): throw error
        case .verified(let safe): return safe
        }
    }
}
