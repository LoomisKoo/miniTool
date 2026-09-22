import SwiftUI

/// 候选名字对比：免费可比较 2 个，Pro 可比较最多 6 个并分享完整报告。
struct NameCompareView: View {
    @Environment(NamingAppModel.self) private var model
    @Environment(ProStore.self) private var pro
    @State private var selected: Set<String> = []

    private var names: [NameResult] {
        model.fav
            .filter { $0.kind != "en" && $0.kind != "nick" }
            .map { model.favToName($0) }
    }

    private var picked: [NameResult] {
        names.filter { selected.contains($0.full) }
    }

    private var limit: Int { pro.isPro ? 6 : 2 }

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                NamingCard {
                    Text(L10n.t("名字 PK"))
                        .font(.system(size: 18, weight: .bold))
                        .foregroundStyle(NamingTheme.ink)
                    Text(L10n.f("选择 2～%ld 个候选，快速比较读感、含义和适配度。", limit))
                        .font(.system(size: 13.5))
                        .foregroundStyle(NamingTheme.muted)
                        .padding(.top, 5)
                }

                if names.isEmpty {
                    NamingCard {
                        Text(L10n.t("先收藏几个中文名"))
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(NamingTheme.ink)
                        Text(L10n.t("在名字详情页点击收藏，再回来做对比。"))
                            .font(.system(size: 13))
                            .foregroundStyle(NamingTheme.muted)
                            .padding(.top, 5)
                    }
                } else {
                    selectionList
                    if picked.count >= 2 {
                        comparison
                    }
                }
            }
            .padding(20)
        }
        .namingPageBackground()
        .navigationTitle(L10n.t("名字对比"))
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            selected = model.compareSelection.isEmpty
                ? Set(names.prefix(2).map(\.full))
                : model.compareSelection
            model.compareSelection = selected
        }
    }

    private var selectionList: some View {
        NamingCard(padding: 8) {
            VStack(spacing: 0) {
                ForEach(names, id: \.full) { name in
                    let isSelected = selected.contains(name.full)
                    Button {
                        toggle(name)
                    } label: {
                        HStack(spacing: 10) {
                            Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                                .foregroundStyle(isSelected ? NamingTheme.primary : NamingTheme.muted)
                            VStack(alignment: .leading, spacing: 3) {
                                Text(name.full)
                                    .font(.system(size: 16, weight: .semibold))
                                    .foregroundStyle(NamingTheme.ink)
                                Text(Pinyin.titleCase(Pinyin.name(name.surname, name.chars)))
                                    .font(.system(size: 12))
                                    .foregroundStyle(NamingTheme.muted)
                            }
                            Spacer()
                        }
                        .padding(.horizontal, 10)
                        .padding(.vertical, 11)
                    }
                    .buttonStyle(NamingPressButtonStyle())

                    if name.full != names.last?.full {
                        Divider().overlay(NamingTheme.hairline)
                    }
                }
            }
        }
    }

    private var comparison: some View {
        VStack(spacing: 12) {
            NamingCard {
                CardTitleRow(title: L10n.t("对比结果")) {
                    Text(L10n.f("%ld 个名字", picked.count))
                        .font(.system(size: 12))
                        .foregroundStyle(NamingTheme.muted)
                }

                ForEach(picked, id: \.full) { name in
                    comparisonRow(name)
                    if name.full != picked.last?.full {
                        Divider().overlay(NamingTheme.hairline).padding(.vertical, 8)
                    }
                }
            }

            Button {
                guard pro.require(.nameReport) else { return }
                model.go(.report)
            } label: {
                Label(L10n.t("生成完整对比报告"), systemImage: "doc.text.magnifyingglass")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .frame(height: 46)
                    .background(NamingTheme.gradient,
                                in: RoundedRectangle(cornerRadius: NamingRadius.medium, style: .continuous))
            }
            .buttonStyle(NamingPressButtonStyle())
        }
    }

    private func comparisonRow(_ name: NameResult) -> some View {
        let read = NameEngine.shared.readability(name.surname, name.chars)
        let sound = name.euphony ?? NameEngine.shared.euphony(name.surname, name.chars)
        return VStack(alignment: .leading, spacing: 7) {
            HStack {
                Text(name.full)
                    .font(.system(size: 20, weight: .bold))
                    .foregroundStyle(NamingTheme.ink)
                Spacer()
                Text(NameEngine.shared.euphonyLabel(sound))
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(read.ok ? NamingTheme.mint : NamingTheme.primaryDeep)
            }
            Text(model.whyFor(name))
                .font(.system(size: 13))
                .foregroundStyle(NamingTheme.ink.opacity(0.82))
                .fixedSize(horizontal: false, vertical: true)
            Text(read.ok
                 ? L10n.t("读感顺口，暂未发现明显问题")
                 : read.issues.joined(separator: L10n.t("、")))
                .font(.system(size: 12))
                .foregroundStyle(read.ok ? NamingTheme.muted : NamingTheme.primaryDeep)
        }
    }

    private func toggle(_ name: NameResult) {
        if selected.contains(name.full) {
            selected.remove(name.full)
        } else if selected.count < limit {
            selected.insert(name.full)
        } else if !pro.isPro {
            _ = pro.require(.nameReport)
        }
        model.compareSelection = selected
    }
}
