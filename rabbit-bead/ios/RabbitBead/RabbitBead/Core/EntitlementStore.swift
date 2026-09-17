import Foundation
import Observation
import StoreKit

/// Pro 买断权益。权威来源是 `Transaction.currentEntitlements`，本地布尔只做冷启动加速。
@MainActor
@Observable
final class EntitlementStore {
    static let shared = EntitlementStore()

    static let productID = "com.loomiskoo.rabbitbead.pro"

    private(set) var isPro = false
    private(set) var product: Product?
    private(set) var isBusy = false
    /// 购买 / 恢复失败时的提示。
    var message: String?
    /// 由门控点触发，编辑页 /「我的」弹出付费墙。
    var showPaywall = false

    private var updates: Task<Void, Never>?
    private let cacheKey = "rabbitbead.isPro.v1"

    private init() {
        isPro = UserDefaults.standard.bool(forKey: cacheKey)
    }

    func start() {
        guard updates == nil else { return }
        updates = Task { [weak self] in
            for await result in Transaction.updates {
                await self?.handle(result)
            }
        }
        Task { await refresh() }
    }

    /// 拉商品 + 扫一遍当前权益。
    func refresh() async {
        await refreshEntitlements()
        await loadProduct()
    }

    func requestPaywall() {
        // 使用 DispatchQueue 确保在下一个运行循环中更新状态，避免与当前视图更新冲突
        DispatchQueue.main.async { [weak self] in
            self?.showPaywall = true
        }
    }

    /// 已是 Pro 返回 true；否则弹出付费墙并返回 false。
    @discardableResult
    func requirePro() -> Bool {
        if isPro { return true }
        // 使用 DispatchQueue 确保在下一个运行循环中更新状态，避免与当前视图更新冲突
        DispatchQueue.main.async { [weak self] in
            self?.showPaywall = true
        }
        return false
    }

    func purchase() async {
        guard !isBusy else { return }
        isBusy = true
        defer { isBusy = false }

        do {
            if product == nil { await loadProduct() }
            guard let product else {
                message = "暂时读不到商品信息，稍后再试。".loc
                return
            }
            let result = try await product.purchase()
            switch result {
            case .success(let verification):
                await handle(verification)
                if isPro { showPaywall = false }
            case .userCancelled, .pending:
                break
            @unknown default:
                break
            }
        } catch {
            message = error.localizedDescription
        }
    }

    func restore() async {
        guard !isBusy else { return }
        isBusy = true
        defer { isBusy = false }

        do {
            try await AppStore.sync()
            await refreshEntitlements()
            if isPro {
                showPaywall = false
                message = "已恢复 Pro".loc
            } else {
                message = "没有找到可恢复的购买记录".loc
            }
        } catch {
            message = error.localizedDescription
        }
    }

    // MARK: - 内部

    private func loadProduct() async {
        do {
            let products = try await Product.products(for: [Self.productID])
            product = products.first
        } catch {
            // 保留旧 product；付费墙仍可用展示价兜底
        }
    }

    private func refreshEntitlements() async {
        var unlocked = false
        for await result in Transaction.currentEntitlements {
            if let transaction = try? check(result),
               transaction.productID == Self.productID {
                unlocked = true
                break
            }
        }
        setPro(unlocked)
    }

    private func handle(_ result: VerificationResult<Transaction>) async {
        guard let transaction = try? check(result) else { return }
        if transaction.productID == Self.productID {
            setPro(true)
        }
        await transaction.finish()
    }

    private func check(_ result: VerificationResult<Transaction>) throws -> Transaction {
        switch result {
        case .unverified(_, let error):
            throw error
        case .verified(let transaction):
            return transaction
        }
    }

    private func setPro(_ value: Bool) {
        isPro = value
        UserDefaults.standard.set(value, forKey: cacheKey)
    }
}
