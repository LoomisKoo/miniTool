import SwiftUI

/* 英文名详情 —— 按性格推荐 / 相近名字点进来的一页。
 *
 * 早先这一步是在列表里插一张卡片，会把下面整列顶下去（列表抖动的来源）；
 * 单独一页就没有位移问题，返回键也符合「点进去看详情」的预期。 */

struct EnDetailView: View {
    @Environment(NamingAppModel.self) private var model

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                if let it = model.enPicked {
                    let saved = model.isSavedEn(model.enFullName(it.n))
                    EnNameCard(it: it) {
                        HStack(spacing: 10) {
                            FavoritePill(title: saved ? L10n.t("已收藏") : L10n.t("收藏"),
                                         active: !saved) {
                                withAnimation(NamingMotion.pick) {
                                    model.toggleEnFav(it, src: model.enDetailMode)
                                }
                            }
                            Spacer(minLength: 0)
                        }
                        .padding(.top, 14)
                    }
                    EnNamesakeCard(celebs: model.enCelebs(it))
                } else {
                    NamingCard {
                        Text(L10n.t("没选中名字。"))
                            .font(.system(size: 14))
                            .foregroundStyle(NamingTheme.muted)
                    }
                }
            }
            .padding(20)
        }
        .namingPageBackground()
        .navigationTitle(model.enPicked.map { model.enFullName($0.n) } ?? L10n.t("英文名"))
        .navigationBarTitleDisplayMode(.inline)
        .namingDock(visible: model.enPicked != nil) {
            if let it = model.enPicked {
                DockPrimaryButton(title: L10n.t("生成卡片")) { model.openCardEn(it) }
            }
        }
    }
}
