import SwiftUI

/* 全部推荐 —— 结果页「查看全部」进来的整份候选列表。
 * 结果页一次只给 6 条（换一批），这里把当前姓氏下的候选整份排出来看。 */

struct AllRecsView: View {
    @Environment(NamingAppModel.self) private var model
    @State private var rows: [RecResult] = []
    @State private var showTop = false

    private let topID = "all-recs-top"

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                VStack(spacing: 14) {
                    Color.clear.frame(height: 0).id(topID)

                    if model.surname == nil {
                        NamingCard {
                            Text(L10n.t("先选一个姓"))
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundStyle(NamingTheme.ink)
                                .padding(.bottom, 6)
                            Text(L10n.t("推荐的名字都挂在自己的姓下面，选好姓再回来看全部。"))
                                .font(.system(size: 13.5))
                                .foregroundStyle(NamingTheme.muted)
                        }
                    } else {
                        NamingCard {
                            CardTitleRow(title: L10n.t("取名偏向")) {
                                Text(L10n.f("%ld 个", rows.count))
                                    .font(.system(size: 12))
                                    .foregroundStyle(NamingTheme.muted)
                            }
                            HStack(spacing: 8) {
                                ForEach([("u", L10n.t("不限")), ("f", L10n.t("偏女")), ("m", L10n.t("偏男"))], id: \.0) { g in
                                    ChipButton(text: g.1, active: model.wantGender == g.0) {
                                        model.wantGender = g.0
                                        reload()
                                    }
                                }
                                Spacer(minLength: 0)
                            }
                        }

                        if rows.isEmpty {
                            NamingCard {
                                Text(L10n.t("没找到合适的名字"))
                                    .font(.system(size: 15, weight: .semibold))
                                    .foregroundStyle(NamingTheme.ink)
                                    .padding(.bottom, 6)
                                Text(L10n.t("当前偏好可能把候选都筛掉了，回上一页清一下偏好再试。"))
                                    .font(.system(size: 13))
                                    .foregroundStyle(NamingTheme.muted)
                            }
                        } else {
                            LazyVStack(spacing: 10) {
                                ForEach(Array(rows.enumerated()), id: \.element.full) { index, rec in
                                    row(rec, index: index)
                                }
                            }
                        }
                    }
                }
                .padding(20)
                .namingScrollProbe()
            }
            .namingPageBackground()
            .namingScrollTopDetector(threshold: 300) { showTop = $0 }
            .overlay(alignment: .bottomTrailing) {
                if showTop {
                    ScrollTopButton {
                        withAnimation(NamingMotion.appear) {
                            proxy.scrollTo(topID, anchor: .top)
                        }
                    }
                    .padding(.trailing, 18)
                    .padding(.bottom, 16)
                    .transition(.opacity)
                }
            }
            .animation(NamingMotion.fade, value: showTop)
        }
        .navigationTitle(L10n.t("全部推荐"))
        .navigationBarTitleDisplayMode(.inline)
        .onAppear { reload() }
    }

    private func reload() {
        rows = model.allRecs()
    }

    private func row(_ rec: RecResult, index: Int) -> some View {
        Button {
            model.openRec(rec)
        } label: {
            HStack(spacing: 12) {
                Text("\(index + 1)")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(NamingTheme.primaryDeep)
                    .frame(width: 24, height: 24)
                    .background(NamingTheme.primary.opacity(0.12), in: Circle())
                VStack(alignment: .leading, spacing: 4) {
                    HStack(alignment: .firstTextBaseline, spacing: 8) {
                        Text(rec.full)
                            .font(.system(size: 18, weight: .semibold))
                            .foregroundStyle(NamingTheme.ink)
                        Text(Pinyin.titleCase(Pinyin.name(rec.surname, rec.chars)))
                            .font(.system(size: 12))
                            .foregroundStyle(NamingTheme.muted)
                    }
                    Text(NameEngine.shared.euphonyLabel(rec.euphony) + " · " + model.tagOf(rec.name))
                        .font(.system(size: 12))
                        .foregroundStyle(NamingTheme.muted)
                }
                Spacer(minLength: 0)
                if model.isSaved(rec.full) {
                    Image(systemName: "bookmark.fill")
                        .font(.system(size: 12))
                        .foregroundStyle(NamingTheme.primaryDeep)
                }
                Image(systemName: "chevron.right")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(NamingTheme.muted)
            }
            .padding(14)
            .background(NamingTheme.canvas, in: RoundedRectangle(cornerRadius: NamingRadius.medium, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: NamingRadius.medium, style: .continuous)
                    .strokeBorder(model.isSaved(rec.full) ? NamingTheme.primary.opacity(0.6) : NamingTheme.hairline, lineWidth: 1)
            }
        }
        .buttonStyle(NamingPressButtonStyle())
    }
}
