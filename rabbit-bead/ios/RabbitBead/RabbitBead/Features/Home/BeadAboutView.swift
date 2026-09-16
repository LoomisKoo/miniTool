import Foundation
import SwiftUI

/// 关于页：版本号、第三方数据署名与许可全文、隐私政策与支持入口。
///
/// **第三方许可是随副本一起分发的义务，不是装饰**：内置色卡数据来自
/// `HansBug/pindou-color-data`，该仓库是 **MIT 许可**。MIT 的条款要求
///
/// > The above copyright notice and this permission notice shall be included
/// > in all copies or substantial portions of the Data.
///
/// 也就是**版权声明 + 许可全文**都要跟着 App 走。只在 `BeadPalette.swift`
/// 的代码注释里写一行来源不满足这条：注释不在分发的副本里，也没有许可全文。
/// 所以：不要删「色卡数据」和「许可全文」这两节。
///
/// 注意许可全文**有意不翻译**。MIT 原文用 "Data" 替代了模板里的 "Software"，
/// 照抄即可；译文没有法律效力，翻译反而容易改变含义。只给中文用户加一句说明。
struct BeadAboutView: View {
    /// 外链地址。隐私政策 / 支持页与 App Store Connect 里填的是同一组 URL。
    private enum URLs {
        static let dataset = URL(string: "https://github.com/HansBug/pindou-color-data")!
        static let privacy = URL(string: "https://loomiskoo.github.io/RabbitBead-pages/privacy.html")!
        static let support = URL(string: "https://loomiskoo.github.io/RabbitBead-pages/support.html")!
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: BeadSpace.md) {
                appCard
                dataCard
                licenseCard
                linksCard
            }
            .padding(.horizontal, BeadSpace.md)
            .padding(.top, BeadSpace.sm)
            .padding(.bottom, BeadSpace.lg)
        }
        .background(BeadTheme.parchment)
        .navigationTitle("关于".loc)
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(.visible, for: .navigationBar)
        .toolbarBackground(BeadTheme.parchment.opacity(0.8), for: .navigationBar)
    }

    // MARK: - 应用

    private var appCard: some View {
        BeadCard(padding: BeadSpace.lg) {
            Text(BeadAboutView.appName)
                .beadDisplayMd()
                .foregroundStyle(BeadTheme.ink)
            Text("版本 %@".loc(BeadAboutView.versionText))
                .beadCaption()
                .foregroundStyle(BeadTheme.inkMuted48)
                .padding(.top, BeadSpace.xxs)
        }
    }

    // MARK: - 数据来源

    private var dataCard: some View {
        BeadCard(padding: BeadSpace.md) {
            BeadSectionLabel(text: "色卡数据".loc)
            Text("内置的 MARD / COCO 色卡数据来自开源项目 HansBug/pindou-color-data，依 MIT 许可使用。色卡色号为对应品牌的产品编号，RGB 为屏幕参考值。")
                .beadFinePrint()
                .foregroundStyle(BeadTheme.inkMuted48)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, BeadSpace.xs)
                .padding(.bottom, BeadSpace.xxs)
            linkRow("查看数据源".loc, url: URLs.dataset)
        }
    }

    // MARK: - 许可全文

    /// MIT 要求的 permission notice 原文。**不要改动、不要翻译、不要折叠掉。**
    private static let mitLicenseText = """
    MIT License

    Copyright (c) 2026 HansBug

    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this data and associated documentation files (the "Data"), to deal
    in the Data without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Data, and to permit persons to whom the Data is
    furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in all
    copies or substantial portions of the Data.

    THE DATA IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE DATA OR THE USE OR OTHER DEALINGS IN THE
    DATA.
    """

    private var licenseCard: some View {
        BeadCard(padding: BeadSpace.md) {
            BeadSectionLabel(text: "许可全文".loc)
            Text("以下为原许可文本，英文原文为准。")
                .beadFinePrint()
                .foregroundStyle(BeadTheme.inkMuted48)
                .padding(.top, BeadSpace.xs)
                .padding(.bottom, BeadSpace.xs)
            Text(Self.mitLicenseText)
                .font(.system(size: 11, weight: .regular, design: .monospaced))
                .foregroundStyle(BeadTheme.inkMuted48)
                .lineSpacing(2)
                .textSelection(.enabled)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(BeadSpace.xs)
                .background(
                    BeadTheme.pearl,
                    in: RoundedRectangle(cornerRadius: BeadRadius.sm, style: .continuous)
                )
        }
    }

    // MARK: - 链接

    private var linksCard: some View {
        BeadCard(padding: BeadSpace.md) {
            linkRow("隐私政策".loc, url: URLs.privacy)
            // 卡内通栏，所以不要把 `BeadRowDivider` 默认给列表行的 16pt 缩进带进来。
            BeadRowDivider(inset: 0)
            linkRow("支持与反馈".loc, url: URLs.support)
        }
    }

    /// 整行可点的外链：文字 + `arrow.up.right`。
    /// 外链用右上箭头，跟页内跳转的 `chevron.right` 区分开。
    ///
    /// `title` 取 `String`（不是 `LocalizedStringKey`），跟 `BeadButton(title:)` 同一套约定：
    /// 调用方自己标 `.loc`。
    private func linkRow(_ title: String, url: URL) -> some View {
        Link(destination: url) {
            HStack(spacing: BeadSpace.xs) {
                Text(title)
                    .beadBody()
                    .foregroundStyle(BeadTheme.primary)
                Spacer(minLength: 0)
                Image(systemName: "arrow.up.right")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(BeadTheme.inkMuted48)
            }
            // 44pt 是最小可点高度，别为了紧凑压下去。
            .frame(minHeight: 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    // MARK: - 版本

    /// `object(forInfoDictionaryKey:)` 会先查本地化表，所以中文下这里拿到的是
    /// `zh-Hans.lproj/InfoPlist.strings` 覆盖后的「兔格拼豆」。
    private static var appName: String {
        let name = Bundle.main.object(forInfoDictionaryKey: "CFBundleDisplayName") as? String
        guard let name, !name.isEmpty else { return "RabbitBead" }
        return name
    }

    /// `1.0.0 (1)`。带 build 号，排查问题时能确认到具体构建。
    private static var versionText: String {
        let short = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String
        let build = Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String
        return "\(short ?? "—") (\(build ?? "—"))"
    }
}
