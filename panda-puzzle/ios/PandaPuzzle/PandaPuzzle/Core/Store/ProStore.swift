import Foundation
import Observation
import StoreKit

@Observable
@MainActor
final class ProStore {
    static let productID = "com.loomiskoo.pandapuzzle.pro.lifetime"
    nonisolated private static let cacheKey = "pandapuzzle.pro.unlocked.v1"
    nonisolated private static let debugKey = "pandapuzzle.pro.debugUnlock.v2"

    var isPro = false
    var product: Product?
    var purchasing = false
    var lastError: String?
    var showPaywall = false
    var paywallFeature: ProFeature?

    private var listenTask: Task<Void, Never>?

    init() {
#if DEBUG
        // 开发模式默认 Pro；用户可在设置里再关掉（debugKey 显式写入后不再覆盖）
        if UserDefaults.standard.object(forKey: Self.debugKey) == nil {
            UserDefaults.standard.set(true, forKey: Self.debugKey)
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
            lastError = "商品暂未上架，请稍后再试"
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
                lastError = "没有找到可恢复的购买"
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

    func nativeConfigJSON() -> String {
        let payload: [String: Any] = [
            "isPro": isPro,
            "maxSaves": PuzzleLimits.maxSaves(isPro: isPro),
            "maxPieces": PuzzleLimits.maxPieces(isPro: isPro),
            "freeMaxSaves": PuzzleLimits.freeMaxSaves,
            "proMaxSaves": PuzzleLimits.proMaxSaves,
        ]
        guard let data = try? JSONSerialization.data(withJSONObject: payload),
              let str = String(data: data, encoding: .utf8) else {
            return "{}"
        }
        return str
    }

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
