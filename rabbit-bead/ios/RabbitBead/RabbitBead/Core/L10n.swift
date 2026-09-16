import Foundation

/// 本地化查表。
///
/// 约定：**中文原文就是 key**，英文翻译放在 `Resources/en.lproj/Localizable.strings`。
/// 这跟 SwiftUI `Text("…")` 的默认行为一致（它也是拿字面量去 `Localizable.strings` 里查），
/// 所以 View 里的字面量不用动，只有下面两种地方要显式加 `.loc`：
///
/// 1. 传给 `String` 参数、或存进 model 的文案 —— Swift 只对 `LocalizedStringKey` 自动查表，
///    普通 `String` 不会，例如 `BeadButton(title: "保存")`、`message = "保存失败："`。
/// 2. 需要拼参数的文案 —— 用 `"库存保存失败：%@".loc(reason)`，占位符写在 key 里，
///    这样翻译时能调整语序，不会把中文语序焊死。
///
/// 查不到翻译就原样返回中文原文，所以漏翻只会显示中文，不会显示 key。
extension String {
    /// 查表取当前语言的文案。
    var loc: String { NSLocalizedString(self, comment: "") }

    /// 带参查表。key 里写 `%ld`（Int）/ `%@`（String），参数按顺序替换。
    func loc(_ args: CVarArg...) -> String {
        String(format: NSLocalizedString(self, comment: ""), arguments: args)
    }
}
