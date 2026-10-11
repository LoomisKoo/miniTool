import SwiftUI

/// 「我的」：参考兔格拼豆 `BeadMineView` 的分组结构 — 会员 / 存档列表 / 关于入口。
struct MineView: View {
    @Environment(ProStore.self) private var pro
    @Environment(PuzzleSaveStore.self) private var saves
    @State private var showPro = false
    @State private var deleteTarget: PuzzleSaveSummary?

    var body: some View {
        NavigationStack {
            List {
                proSection
                savesSection
            }
            .listStyle(.insetGrouped)
            .listSectionSpacing(14)
            .scrollContentBackground(.hidden)
            .background(PandaTheme.canvas.ignoresSafeArea())
            .navigationTitle("我的")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarBackground(PandaTheme.canvas.opacity(0.92), for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    NavigationLink {
                        AboutView()
                    } label: {
                        Image(systemName: "info")
                            .font(.system(size: 12, weight: .regular))
                    }
                    .accessibilityLabel("关于")
                }
            }
            .onAppear { saves.reload() }
            .sheet(isPresented: $showPro) { ProSheet() }
            .alert("删除存档？", isPresented: deleteBinding) {
                Button("取消", role: .cancel) { deleteTarget = nil }
                Button("删除", role: .destructive) {
                    if let target = deleteTarget { saves.delete(id: target.id) }
                    deleteTarget = nil
                }
            } message: {
                Text(deleteTarget?.title ?? "")
            }
        }
    }

    // MARK: - 会员

    private var proSection: some View {
        Section {
            if pro.isPro {
                Label("已解锁 Pro", systemImage: "checkmark.seal.fill")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(PandaTheme.accent)
                    .listRowBackground(PandaTheme.surface)
            } else {
                Button {
                    showPro = true
                } label: {
                    proCard
                }
                .buttonStyle(.plain)
                .listRowBackground(Color.clear)
                .listRowSeparator(.hidden)
                .listRowInsets(EdgeInsets(top: 4, leading: 4, bottom: 4, trailing: 4))
            }
        } header: {
            sectionLabel("会员")
        }
    }

    private var proCard: some View {
        HStack(alignment: .center, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text("解锁 Pro")
                    .font(.system(size: 18, weight: .bold))
                    .foregroundStyle(PandaTheme.ink)
                Text("更多拼块 · 无水印导出 · 多存档 · 提示不限")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(PandaTheme.muted)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 8)
            if let price = pro.product?.displayPrice {
                Text(price)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(PandaTheme.accent)
            }
            Image(systemName: "chevron.right")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(PandaTheme.accent.opacity(0.45))
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            PandaTheme.accentGradient.opacity(0.22),
            in: RoundedRectangle(cornerRadius: 18, style: .continuous)
        )
        .overlay {
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .strokeBorder(PandaTheme.accent.opacity(0.28), lineWidth: 1)
        }
    }

    // MARK: - 存档

    private var savesSection: some View {
        Section {
            if saves.items.isEmpty {
                Text("还没有保存的拼图。在拼图页点「保存」后会出现在这里。")
                    .font(.system(size: 13))
                    .foregroundStyle(PandaTheme.muted)
                    .listRowBackground(Color.clear)
            } else {
                HStack(alignment: .top, spacing: 12) {
                    waterfallColumn(items: saves.items.enumerated().compactMap { $0.offset.isMultiple(of: 2) ? $0.element : nil })
                    waterfallColumn(items: saves.items.enumerated().compactMap { !$0.offset.isMultiple(of: 2) ? $0.element : nil })
                }
                .listRowBackground(Color.clear)
                .listRowInsets(EdgeInsets(top: 0, leading: 4, bottom: 4, trailing: 4))
            }
        } header: {
            sectionLabel(
                "保存的拼图（\(saves.items.count)\(pro.isPro ? "" : "/\(PuzzleLimits.freeMaxSaves)")）"
            )
        }
    }

    private func waterfallColumn(items: [PuzzleSaveSummary]) -> some View {
        VStack(spacing: 12) {
            ForEach(items) { item in
                Button {
                    saves.requestedSaveID = item.id
                } label: {
                    saveCard(item)
                }
                .buttonStyle(.plain)
                .contextMenu {
                    Button(role: .destructive) {
                        deleteTarget = item
                    } label: {
                        Label("删除", systemImage: "trash")
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .top)
    }

    private func saveCard(_ item: PuzzleSaveSummary) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Group {
                if let image = saves.thumbnail(for: item) {
                    Image(uiImage: image)
                        .resizable()
                        .aspectRatio(image.size, contentMode: .fit)
                } else {
                    Image(systemName: "puzzlepiece.extension")
                        .font(.system(size: 28))
                        .foregroundStyle(PandaTheme.muted)
                        .frame(maxWidth: .infinity, minHeight: 110)
                }
            }
            .frame(maxWidth: .infinity)
            .background(PandaTheme.surface2)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .strokeBorder(PandaTheme.line, lineWidth: 1)
            }

            VStack(alignment: .leading, spacing: 3) {
                Text(item.title)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(PandaTheme.ink)
                    .lineLimit(1)
                Text("\(item.progress) · \(item.updatedAt.formatted(date: .abbreviated, time: .shortened))")
                    .font(.system(size: 11))
                    .foregroundStyle(PandaTheme.muted)
                    .lineLimit(1)
            }
        }
        .padding(8)
        .background(PandaTheme.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .contentShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private func saveRow(_ item: PuzzleSaveSummary) -> some View {
        HStack(spacing: 12) {
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(PandaTheme.surface2)
                .frame(width: 48, height: 48)
                .overlay {
                    Image(systemName: "puzzlepiece.extension")
                        .font(.system(size: 16))
                        .foregroundStyle(PandaTheme.muted)
                }
                .overlay {
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .strokeBorder(PandaTheme.line, lineWidth: 1)
                }

            VStack(alignment: .leading, spacing: 3) {
                Text(item.title)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(PandaTheme.ink)
                    .lineLimit(1)
                Text("\(item.progress) · \(item.updatedAt.formatted(date: .abbreviated, time: .shortened))")
                    .font(.system(size: 12))
                    .foregroundStyle(PandaTheme.muted)
                    .lineLimit(1)
            }
            Spacer(minLength: 0)
        }
        .padding(.vertical, 2)
    }

    private func sectionLabel(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 13, weight: .semibold))
            .foregroundStyle(PandaTheme.muted)
            .frame(maxWidth: .infinity, alignment: .leading)
            .textCase(nil)
    }

    private var deleteBinding: Binding<Bool> {
        Binding(
            get: { deleteTarget != nil },
            set: { if !$0 { deleteTarget = nil } }
        )
    }
}

// MARK: - 关于

struct AboutView: View {
    @Environment(ProStore.self) private var pro
    @State private var showPrivacy = false
    @State private var restoreHint: String?

    var body: some View {
        List {
            Section {
                VStack(alignment: .leading, spacing: 4) {
                    Text("熊猫拼图")
                        .font(.system(size: 18, weight: .bold))
                        .foregroundStyle(PandaTheme.ink)
                    Text("版本 \(versionText)")
                        .font(.system(size: 13))
                        .foregroundStyle(PandaTheme.muted)
                }
                .padding(.vertical, 4)
                .listRowBackground(PandaTheme.surface)
            }

            Section {
                Button {
                    showPrivacy = true
                } label: {
                    supportRow(title: "隐私政策", systemImage: "chevron.right")
                }
                .buttonStyle(.plain)
                .listRowBackground(PandaTheme.surface)

                Button {
                    Task {
                        await pro.restore()
                        restoreHint = pro.isPro ? "已恢复购买" : "没有可恢复的购买"
                    }
                } label: {
                    supportRow(title: "恢复购买", systemImage: "chevron.right")
                }
                .buttonStyle(.plain)
                .listRowBackground(PandaTheme.surface)
            } header: {
                Text("支持")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(PandaTheme.muted)
                    .textCase(nil)
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .background(PandaTheme.canvas.ignoresSafeArea())
        .navigationTitle("关于")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showPrivacy) { PrivacyPolicyView() }
        .alert("恢复购买", isPresented: Binding(
            get: { restoreHint != nil },
            set: { if !$0 { restoreHint = nil } }
        )) {
            Button("好", role: .cancel) { restoreHint = nil }
        } message: {
            Text(restoreHint ?? "")
        }
    }

    private func supportRow(title: String, systemImage: String) -> some View {
        HStack(spacing: 8) {
            Text(title)
                .font(.system(size: 16, weight: .regular))
                .foregroundStyle(PandaTheme.ink)
            Spacer(minLength: 0)
            Image(systemName: systemImage)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(PandaTheme.muted)
        }
        .frame(minHeight: 44)
        .contentShape(Rectangle())
    }

    private var versionText: String {
        let short = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0"
        let build = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "—"
        return "\(short) (\(build))"
    }
}

struct PrivacyPolicyView: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                Text(privacyText)
                    .font(.system(size: 15))
                    .foregroundStyle(PandaTheme.ink)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(20)
            }
            .background(PandaTheme.canvas.ignoresSafeArea())
            .navigationTitle("隐私政策")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("完成") { dismiss() }
                }
            }
        }
    }

    private var privacyText: String {
        """
        熊猫拼图（以下简称「本应用」）重视您的隐私。

        1. 我们收集什么
        · 您主动选择的相册照片，仅用于本机切分拼图。
        · 购买 Pro 时由 Apple 处理交易信息，我们不自行收集支付卡号。

        2. 数据如何存储
        · 拼图进度与照片相关数据默认保存在本机，不会上传到我们的服务器。
        · 我们不提供账号体系，因此也不做跨设备云同步（除非日后另行说明并取得同意）。

        3. 权限说明
        · 相册读取：仅在您点「选图」时访问所选照片。
        · 相册写入：仅在您点「保存」时将成品图写入相册。

        4. 第三方
        · 应用内购买由 Apple App Store / StoreKit 提供。
        · 我们不会向广告或数据分析第三方出售您的个人信息。

        5. 联系我们
        如有隐私相关问题，请通过 App Store 应用页的开发者联系方式与我们沟通。

        本政策可能随功能更新而修订，修订后会在应用内或商店说明中提示。
        """
    }
}
