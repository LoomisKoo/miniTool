import SwiftUI

/* 中文名（主入口）—— 一个页面三扇门：
 *   按性格取名  /  西名中起（填你现有的外文名）  /  自选姓名。
 *
 * 三扇门后面是同一份性格数据（`profile` / `baziInfo`），所以画像就摆在这一页顶上，
 * 换了语言、重测过，回来看一眼就知道现在按什么在排。 */

struct ZhNameView: View {
    @Environment(NamingAppModel.self) private var model

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                ProfileSummaryCard()

                EntryRow(icon: L10n.isEnglish ? "P" : "性",
                         title: L10n.t("按性格取名"),
                         subtitle: L10n.t("先定姓氏，再按气质推荐名字")) {
                    model.openResultFromEntry()
                }
                EntryRow(icon: L10n.isEnglish ? "F" : "外",
                         title: L10n.t("西名中起"),
                         subtitle: L10n.t("填上你现有的外文名，配一个中国式名字")) {
                    model.openTranslit()
                }
                EntryRow(icon: L10n.isEnglish ? "C" : "选",
                         title: L10n.t("自选姓名"),
                         subtitle: L10n.t("自己挑姓和字，实时看读感与释义")) {
                    model.go(.studio)
                }
            }
            .padding(20)
        }
        .namingPageBackground()
        .navigationTitle(L10n.t("中文名"))
        .navigationBarTitleDisplayMode(.inline)
    }

}
