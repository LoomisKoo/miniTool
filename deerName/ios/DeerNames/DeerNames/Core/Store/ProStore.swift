import Foundation
import Observation
import StoreKit

/* StoreKit 2 买断制。商品尚未在 App Store Connect 建好时：
 *  - `product` 为空，付费墙显示「暂不可用」；
 *  - DEBUG 下可在设置里手动开关 Pro（`debugToggleUnlock`），默认未开通。 */

@Observable
@MainActor
final class ProStore {
    static let productID = "com.loomiskoo.deernames.pro.lifetime"
    nonisolated private static let cacheKey = "naming.pro.unlocked.v1"
    nonisolated private static let debugKey = "naming.pro.debugUnlock.v1"
    nonisolated private static let devDefaultOffKey = "naming.pro.devDefaultOff.v1"

    var isPro = false
    var product: Product?
    var purchasing = false
    var lastError: String?
    var showPaywall = false
    /// 付费墙被哪个功能唤起（埋点 / 文案用）。
    var paywallFeature: ProFeature?

    private var listenTask: Task<Void, Never>?

    init() {
#if DEBUG
        /* 曾默认开 Pro 时会把 debugKey 写成 true；改策略后清一次，避免一直当已购。 */
        if !UserDefaults.standard.bool(forKey: Self.devDefaultOffKey) {
            UserDefaults.standard.set(false, forKey: Self.debugKey)
            UserDefaults.standard.set(true, forKey: Self.devDefaultOffKey)
        }
#endif
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

#if DEBUG
    func debugToggleUnlock() {
        let next = !UserDefaults.standard.bool(forKey: Self.debugKey)
        UserDefaults.standard.set(next, forKey: Self.debugKey)
        isPro = resolvedPro()
    }
#endif

    // MARK: - private

    private func resolvedPro(storeUnlocked: Bool? = nil) -> Bool {
        if storeUnlocked == true { return true }
        if UserDefaults.standard.bool(forKey: Self.cacheKey) { return true }
#if DEBUG
        if UserDefaults.standard.bool(forKey: Self.debugKey) { return true }
#endif
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
