import SwiftUI
import UIKit

/* 昵称页
 *  - 社交：选气质 → 抽一批 / 随机一条（有性格则加权）；不再整库浏览
 *  - 小名：仍按名字派生 + 词库，支持随机 / 换一批
 * 免费：小名叠字最多 2；社交整页属 Pro。 */

private enum NickScroll {
    static let topID = "nick-top"
}

struct NickView: View {
    @Environment(NamingAppModel.self) private var model
    @Environment(ProStore.self) private var pro
    @State private var showTop = false

    // 社交
    @State private var vibes: Set<String> = []
    @State private var script: NickScript = L10n.isEnglish ? .en : .zh
    @State private var batch: [NickItem] = []
    @State private var featured: NickItem?
    @State private var seen: Set<String> = []
    @State private var explanationItem: NickItem?

    // 小名
    @State private var childItems: [NickItem] = []
    @State private var childBatch: [NickItem] = []
    @State private var childFilter = "全部"

    private var mode: NickMode { model.nickMode }
    private var hasProfile: Bool { model.profile?.hasAnswered ?? false }

    private var given: String {
        if mode == .child, !model.studioSlots.isEmpty {
            return model.studioSlots.joined()
        }
        return model.current?.given ?? model.current?.chars.joined() ?? ""
    }

    private var surname: String? {
        if mode == .child {
            return model.studioSurname?.c ?? model.current?.surname.c ?? model.surname?.c
        }
        return nil
    }

    private var childVisible: [NickItem] {
        let base = pro.isPro ? childBatch : NickEngine.freeSlice(childItems)
        if !pro.isPro || childFilter == "全部" { return base }
        return base.filter { $0.category == childFilter || $0.tags.contains(childFilter) }
    }

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                VStack(spacing: 12) {
                    Color.clear.frame(height: 0).id(NickScroll.topID)
                    if mode == .social {
                        socialBody
                    } else {
                        childBody
                    }
                    if !pro.isPro {
                        ProLockRow(feature: .nicknameFull)
                    }
                }
                .padding(20)
                .namingScrollProbe()
            }
            .namingPageBackground()
            .namingScrollTopDetector(threshold: 280) { showTop = $0 }
            .overlay(alignment: .bottomTrailing) {
                if showTop {
                    ScrollTopButton {
                        withAnimation(NamingMotion.appear) {
                            proxy.scrollTo(NickScroll.topID, anchor: .top)
                        }
                    }
                    .padding(.trailing, 18)
                    .padding(.bottom, 16)
                    .transition(.opacity)
                }
            }
            .animation(NamingMotion.fade, value: showTop)
            .navigationTitle(mode.title)
            .navigationBarTitleDisplayMode(.inline)
            .onAppear { bootstrap() }
            .onChange(of: mode) { _, _ in bootstrap() }
            .sheet(item: $explanationItem) { item in
                NickExplanationSheet(item: item)
                    .environment(model)
                    .environment(pro)
            }
        }
    }

    // MARK: - Social

    @ViewBuilder
    private var socialBody: some View {
        NamingCard {
            Text(L10n.t("抽一波社交昵称"))
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(NamingTheme.ink)
            Text(hasProfile
                 ? L10n.t("先选中文、英文或中英混合，再点气质。有性格画像时会加权。")
                 : L10n.t("先选中文、英文或中英混合，再点换一批。"))
                .font(.system(size: 13))
                .foregroundStyle(NamingTheme.muted)
                .padding(.top, 6)
        }

        scriptBar
        vibeBar

        shuffleButton { guardSocial { drawBatch(resetSeen: false) } }

        if batch.isEmpty {
            NamingCard {
                Text(pro.isPro
                     ? L10n.t("点「换一批」再抽一组。")
                     : L10n.t("社交昵称属于 Pro，解锁后按气质抽一批。"))
                    .font(.system(size: 13.5))
                    .foregroundStyle(NamingTheme.muted)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
            }
        } else {
            NamingCard(padding: 8) {
                LazyVStack(spacing: 0) {
                    ForEach(batch) { item in
                        nickRow(item, showCategory: true)
                        Divider().overlay(NamingTheme.hairline)
                    }
                }
            }
        }
    }

    private var scriptBar: some View {
        HStack(spacing: 8) {
            ForEach(NickScript.allCases, id: \.self) { key in
                let on = script == key
                Button {
                    guardSocial {
                        script = key
                        vibes = []
                        drawBatch(resetSeen: true)
                    }
                } label: {
                    Text(key.title)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(on ? .white : NamingTheme.ink)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 8)
                        .background(on ? AnyShapeStyle(NamingTheme.gradient) : AnyShapeStyle(NamingTheme.pearl),
                                    in: Capsule())
                }
                .buttonStyle(NamingPressButtonStyle())
            }
        }
    }

    private var vibeBar: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(L10n.t("气质"))
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(NamingTheme.muted)
                Spacer()
                if !vibes.isEmpty {
                    Button(L10n.t("清空")) {
                        vibes.removeAll()
                        guardSocial { drawBatch(resetSeen: true) }
                    }
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(NamingTheme.primaryDeep)
                }
            }
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(NickEngine.socialVibes(matching: script), id: \.self) { key in
                        let on = vibes.contains(key)
                        Button {
                            guardSocial {
                                if vibes.contains(key) { vibes.remove(key) } else { vibes.insert(key) }
                                drawBatch(resetSeen: true)
                            }
                        } label: {
                            Text(L10n.t(key))
                                .font(.system(size: 13, weight: .medium))
                                .foregroundStyle(on ? .white : NamingTheme.ink)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 7)
                                .background(on ? AnyShapeStyle(NamingTheme.gradient) : AnyShapeStyle(NamingTheme.pearl),
                                            in: Capsule())
                        }
                        .buttonStyle(NamingPressButtonStyle())
                        .sensoryFeedback(.selection, trigger: on)
                    }
                }
            }
        }
    }

    // MARK: - Child

    @ViewBuilder
    private var childBody: some View {
        NamingCard {
            let full = [surname, given].compactMap { $0 }.filter { !$0.isEmpty }.joined()
            Text(full.isEmpty
                 ? L10n.t("给自选的名字配小名")
                 : L10n.f("给「%@」配小名", full))
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(NamingTheme.ink)
            Text(pro.isPro
                 ? L10n.t("按名字派生，并结合性格排序；可随机或换一批。")
                 : L10n.t("免费可看叠字小名；升级后解锁分类词库与随机。"))
                .font(.system(size: 13))
                .foregroundStyle(NamingTheme.muted)
                .padding(.top, 6)
        }

        if pro.isPro {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(NickEngine.categories(for: .child), id: \.self) { key in
                        let on = childFilter == key
                        Button {
                            childFilter = key
                            redrawChildBatch()
                        } label: {
                            Text(L10n.t(key))
                                .font(.system(size: 13, weight: .medium))
                                .foregroundStyle(on ? .white : NamingTheme.ink)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 7)
                                .background(on ? AnyShapeStyle(NamingTheme.gradient) : AnyShapeStyle(NamingTheme.pearl),
                                            in: Capsule())
                        }
                        .buttonStyle(NamingPressButtonStyle())
                    }
                }
            }

            actionBar(
                randomTitle: L10n.t("随机推荐"),
                batchTitle: L10n.t("换一批"),
                onRandom: {
                    let pool = filteredChildPool()
                    if let one = NickEngine.drawChild(from: pool, excluding: [], count: 1).first {
                        featured = one
                        seen.insert(one.text)
                    }
                },
                onBatch: { redrawChildBatch() }
            )
        }

        if let featured, mode == .child {
            featuredCard(featured)
        }

        if childVisible.isEmpty {
            NamingCard {
                Text(given.isEmpty
                     ? L10n.t("先在自选姓名里挑好字，再来配小名。")
                     : L10n.t("这个名字暂时派不出合适的小名，换个名再试。"))
                    .font(.system(size: 13.5))
                    .foregroundStyle(NamingTheme.muted)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
            }
        } else {
            NamingCard(padding: 8) {
                LazyVStack(spacing: 0) {
                    ForEach(childVisible) { item in
                        nickRow(item, showCategory: childFilter == "全部" || !pro.isPro)
                        Divider().overlay(NamingTheme.hairline)
                    }
                }
            }
        }
    }

    // MARK: - Shared UI

    private func shuffleButton(action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Image(systemName: "shuffle")
                    .font(.system(size: 14, weight: .semibold))
                Text(L10n.t("换一批"))
                    .font(.system(size: 15, weight: .semibold))
            }
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .frame(height: 44)
            .background(NamingTheme.gradient, in: RoundedRectangle(cornerRadius: NamingRadius.medium, style: .continuous))
        }
        .buttonStyle(NamingPressButtonStyle())
        .sensoryFeedback(.impact(flexibility: .soft, intensity: 0.5), trigger: batch.count)
    }

    private func actionBar(randomTitle: String, batchTitle: String,
                           onRandom: @escaping () -> Void,
                           onBatch: @escaping () -> Void) -> some View {
        HStack(spacing: 10) {
            Button(action: onRandom) {
                HStack(spacing: 6) {
                    Image(systemName: "dice.fill")
                        .font(.system(size: 14, weight: .semibold))
                    Text(randomTitle)
                        .font(.system(size: 15, weight: .semibold))
                }
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .frame(height: 44)
                .background(NamingTheme.gradient, in: RoundedRectangle(cornerRadius: NamingRadius.medium, style: .continuous))
            }
            .buttonStyle(NamingPressButtonStyle())

            Button(action: onBatch) {
                HStack(spacing: 6) {
                    Image(systemName: "shuffle")
                        .font(.system(size: 13, weight: .semibold))
                    Text(batchTitle)
                        .font(.system(size: 15, weight: .semibold))
                }
                .foregroundStyle(NamingTheme.primaryDeep)
                .frame(maxWidth: .infinity)
                .frame(height: 44)
                .background(NamingTheme.primary.opacity(0.12),
                            in: RoundedRectangle(cornerRadius: NamingRadius.medium, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: NamingRadius.medium, style: .continuous)
                        .strokeBorder(NamingTheme.primary.opacity(0.25), lineWidth: 1)
                }
            }
            .buttonStyle(NamingPressButtonStyle())
        }
        .sensoryFeedback(.impact(flexibility: .soft, intensity: 0.5), trigger: batch.count)
    }

    private func featuredCard(_ item: NickItem) -> some View {
        let saved = model.isSavedNick(item.text)
        return NamingCard {
            HStack(alignment: .top, spacing: 12) {
                Button {
                    guard pro.require(.nickInterpretation) else { return }
                    explanationItem = item
                } label: {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(L10n.t("随机推荐"))
                            .font(.system(size: 12, weight: .medium))
                            .foregroundStyle(NamingTheme.primaryDeep)
                        Text(item.text)
                            .font(.system(size: 26, weight: .bold))
                            .foregroundStyle(NamingTheme.ink)
                            .lineLimit(3)
                        Text(NickEngine.localizedNote(for: item))
                            .font(.system(size: 12.5))
                            .foregroundStyle(NamingTheme.ink.opacity(0.78))
                            .fixedSize(horizontal: false, vertical: true)
                        Text(L10n.t(item.category) + (hasProfile && mode == .social ? " · " + L10n.t("贴合性格") : ""))
                            .font(.system(size: 12))
                            .foregroundStyle(NamingTheme.muted)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .buttonStyle(.plain)
                Spacer(minLength: 0)
                Button {
                    withAnimation(NamingMotion.pick) { model.toggleNickFav(item) }
                } label: {
                    Image(systemName: saved ? "heart.fill" : "heart")
                        .font(.system(size: 18))
                        .foregroundStyle(NamingTheme.primary)
                        .frame(width: 40, height: 40)
                        .contentShape(Rectangle())
                }
                .buttonStyle(NamingPressButtonStyle())
            }
        }
    }

    private func nickRow(_ item: NickItem, showCategory: Bool) -> some View {
        let saved = model.isSavedNick(item.text)
        let meta: String = {
            if mode == .child, item.type != "词库" { return L10n.t(item.type) }
            if showCategory { return L10n.t(item.category) }
            return ""
        }()
        return HStack(spacing: 10) {
            Button {
                guard pro.require(.nickInterpretation) else { return }
                explanationItem = item
            } label: {
                VStack(alignment: .leading, spacing: 2) {
                    Text(item.text)
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(NamingTheme.ink)
                        .lineLimit(2)
                    if !meta.isEmpty {
                        Text(meta)
                            .font(.system(size: 12))
                            .foregroundStyle(NamingTheme.muted)
                    }
                    if mode == .social {
                        Text(NickEngine.localizedNote(for: item))
                            .font(.system(size: 11.5))
                            .foregroundStyle(NamingTheme.muted)
                            .lineLimit(2)
                    }
                }
            }
            .buttonStyle(.plain)
            .frame(maxWidth: .infinity, alignment: .leading)

            Button {
                withAnimation(NamingMotion.pick) { model.toggleNickFav(item) }
            } label: {
                Image(systemName: saved ? "heart.fill" : "heart")
                    .font(.system(size: 15))
                    .foregroundStyle(NamingTheme.primary)
                    .frame(width: 32, height: 32)
                    .contentShape(Rectangle())
            }
            .buttonStyle(NamingPressButtonStyle())
            .sensoryFeedback(.impact(flexibility: .soft, intensity: 0.55), trigger: saved)

            if mode == .social {
                Button {
                    UIPasteboard.general.string = item.text
                    model.toast(L10n.t("已复制昵称"))
                } label: {
                    Image(systemName: "doc.on.doc")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(NamingTheme.primaryDeep)
                        .frame(width: 32, height: 32)
                        .contentShape(Rectangle())
                }
                .buttonStyle(NamingPressButtonStyle())
                .accessibilityLabel(L10n.t("复制昵称"))
            }
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 10)
    }

    // MARK: - Logic

    private func bootstrap() {
        featured = nil
        seen = []
        if mode == .social {
            vibes = []
            batch = []
            if pro.isPro {
                drawBatch(resetSeen: true)
            }
        } else {
            childFilter = "全部"
            childItems = NickEngine.derive(given: given, surname: surname, profile: model.profile)
            if pro.isPro {
                redrawChildBatch()
                if let one = NickEngine.drawChild(from: filteredChildPool(), count: 1).first {
                    featured = one
                }
            } else {
                childBatch = NickEngine.freeSlice(childItems)
            }
        }
    }

    private func guardSocial(_ work: () -> Void) {
        guard pro.isPro else {
            _ = pro.require(.nicknameFull)
            return
        }
        work()
    }

    private func drawBatch(resetSeen: Bool) {
        if resetSeen { seen = [] }
        let n = NickEngine.socialBatchSize
        let items = NickEngine.drawSocial(script: script, vibes: vibes, profile: model.profile,
                                          excluding: seen, count: n)
        batch = items
        for it in items { seen.insert(it.text) }
        // 池子快见底时清空，下次能继续抽
        if items.count < n { seen = Set(items.map(\.text)) }
    }

    private func filteredChildPool() -> [NickItem] {
        if childFilter == "全部" { return childItems }
        return childItems.filter { $0.category == childFilter || $0.tags.contains(childFilter) }
    }

    private func redrawChildBatch() {
        let pool = filteredChildPool()
        childBatch = NickEngine.drawChild(from: pool, excluding: seen, count: NickEngine.socialBatchSize)
        for it in childBatch { seen.insert(it.text) }
    }
}
