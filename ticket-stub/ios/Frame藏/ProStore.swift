import Foundation
import Observation
import StoreKit

@Observable
@MainActor
final class ProStore {
    static let productID = "com.tincom.framezang.pro.lifetime"

    var isPro = false
    var product: Product?
    var isPurchasing = false
    var errorMessage: String?
    var isLoadingProduct = false
    #if DEBUG
    var isLocalTestMode = false
    #endif

    private var updatesTask: Task<Void, Never>?

    init() {
        isPro = UserDefaults.standard.bool(forKey: "framezang.pro.unlocked")
    }

    func start() async {
        updatesTask?.cancel()
        updatesTask = Task { await listenForTransactions() }
        await loadProduct()
        await refreshEntitlement()
    }

    func loadProduct() async {
        errorMessage = nil
        isLoadingProduct = true
        defer { isLoadingProduct = false }
        do {
            product = try await Product.products(for: [Self.productID]).first
            if product == nil {
                #if DEBUG
                isLocalTestMode = true
                #else
                errorMessage = AppLocalization.text("未找到 Pro 商品，请确认 StoreKit 配置或 App Store Connect 商品 ID。")
                #endif
            }
        } catch {
            product = nil
            #if DEBUG
            isLocalTestMode = true
            #else
            errorMessage = AppLocalization.text("无法加载 Pro 商品：") + error.localizedDescription
            #endif
        }
    }

    func purchase() async {
        #if DEBUG
        if product == nil {
            isPurchasing = true
            defer { isPurchasing = false }
            try? await Task.sleep(for: .milliseconds(250))
            isPro = true
            UserDefaults.standard.set(true, forKey: "framezang.pro.unlocked")
            return
        }
        #endif
        guard let product else {
            errorMessage = AppLocalization.text("商品暂未上架，请稍后再试")
            return
        }
        isPurchasing = true
        defer { isPurchasing = false }
        do {
            switch try await product.purchase() {
            case .success(let result):
                let transaction = try checkVerified(result)
                await transaction.finish()
                isPro = true
                UserDefaults.standard.set(true, forKey: "framezang.pro.unlocked")
            case .userCancelled, .pending:
                break
            @unknown default:
                break
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func restore() async {
        isPurchasing = true
        defer { isPurchasing = false }
        do {
            try await AppStore.sync()
            await refreshEntitlement()
            if !isPro { errorMessage = AppLocalization.text("没有找到可恢复的购买") }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func refreshEntitlement() async {
        for await result in Transaction.currentEntitlements {
            if let transaction = try? checkVerified(result), transaction.productID == Self.productID {
                isPro = true
                UserDefaults.standard.set(true, forKey: "framezang.pro.unlocked")
                return
            }
        }
    }

    private func listenForTransactions() async {
        for await result in Transaction.updates {
            if let transaction = try? checkVerified(result) {
                await transaction.finish()
                await refreshEntitlement()
            }
        }
    }

    private func checkVerified<T>(_ result: VerificationResult<T>) throws -> T {
        switch result {
        case .verified(let value): value
        case .unverified(_, let error): throw error
        }
    }
}
