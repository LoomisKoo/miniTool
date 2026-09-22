import Foundation
import Observation
import SwiftUI
import UIKit

/* app.js 的 state + 全部交互，逐条对应。
 * H5 里「页面」用压栈模拟，这里交给 NavigationStack 的 path；
 * 浮层（选姓 / 备选名 / 不喜欢的名字）交给 SwiftUI 原生 sheet。 */

enum NamingScreen: Hashable {
    case home, zh, quiz, bazi, result, resultAll, detail, translit, studio, studioSur, studioChar, mine, en
    /* 英文名侧：和「中文名」页对称的几扇门 + 详情 + 选姓 / 选名两页。
     *  - enRec    按性格取名
     *  - enSound  中名西取（填中文名 → 读音贴近的英文名）
     *  - enStudio 自选姓名（姓和名都从英文库里挑） */
    case enRec, enSound, enStudio
    case enDetail, enSur, enGiven
    case compare, report
    /// 小名 / 昵称（从中文名详情进入）。
    case nick
}

enum NamingTab: Hashable { case home, mine }

enum NamingSheetKind: String, Identifiable, Hashable {
    case surname, pool, banNames
    var id: String { rawValue }

    var title: String {
        switch self {
        case .surname: return L10n.t("选姓氏")
        case .pool: return L10n.t("备选名字")
        case .banNames: return L10n.t("不喜欢的名字")
        }
    }
}

struct BaziForm: Codable, Hashable {
    var y = 1998
    var m = 6
    var d = 15
    var hour = -1

    var asSolar: BaziSolar { BaziSolar(y: y, m: m, d: d, hour: hour) }
}

struct FavItem: Codable, Hashable, Identifiable {
    var id: String { full }
    var full: String
    var py: String
    var why: String
    var src: String
    var at: Double
    var note: String
    /* 名（不含姓）。存它是为了**现算**释义：`why` 是收藏那一刻的文案，
     * 换了语言就旧了，有 given 才能按当前语言重算（旧数据没有这个字段，回退用 why）。 */
    var given: String?
    /// 收藏存的是英文名（`kind == "en"`）时，点回去要回英文名详情页，而不是中文名详情。
    var kind: String?
}

struct StudioSlot: Hashable {
    var ch = ""
    var q = ""
}

struct StudioFilters: Hashable {
    var type = "all", pop = "all", letter = "all"
}

struct CharFilters: Hashable {
    var dom = "all", g = "all", freq = "all", letter = "all"
}

/* 自选名旁边列出的「相似的名字」：同一个字，或者气质很近。 */
struct SimilarName: Identifiable {
    var id: String { n }
    let n: String
    let m: String
    /// 和当前自选名共用的字（空数组表示靠气质近进来的）。
    let shared: [String]
    /// 气质相似度（0~1）。
    let vibe: Double
}

struct EnFilters: Hashable {
    var g = "all", era = "all", vibe = "all", theme = "all", lang = "all", keyword = ""
}

struct TranslitResultState {
    var latin = ""
    var family: String?
    var surname: NMSurname
    var main: ChineseNameResult
    var alts: [ChineseNameResult]
    var translitStyle: String
}

@Observable
final class NamingAppModel {

    // MARK: - 状态（对应 state）

    var tab: NamingTab = .home
    /// 全 app 共用一条页面栈（NavigationStack 罩在 TabView 外面，压栈页会盖住 tabbar）。
    var path: [NamingScreen] = []

    var answers: [NMQuestionOption?] = []
    var qi = 0
    var profile: NMProfile?
    var wantGender = "u"
    var surname: NMSurname?
    var current: NameResult?
    var shown = Set<String>()
    var candidates: [NameResult] = []
    var recs: [RecResult] = []
    var recShown = Set<String>()
    var surKeyword = ""
    var detailFrom = "result"
    var fav: [FavItem] = []
    var feedback = FeedbackOptions()

    var studioSurname: NMSurname?
    var studioSlots: [String] = []
    var studioSurKeyword = ""
    var studioCharKeyword = ""
    var studioSurF = StudioFilters()
    var studioCharF = CharFilters()

    var translit = ""
    var translitResult: TranslitResultState?

    var enInput: String {
        get { enZhName }
        set {
            enZhName = newValue
            syncEnSurnameFromChineseName()
        }
    }
    var enFrom = "home"
    /// 详情页正在看的那条（`.enDetail` 的目标）。
    var enPicked: NMEnName?
    /// 详情页从哪扇门进来（决定卡片上的标签文案）。
    var enDetailMode = "en"
    var enF = EnFilters()
    /// 按性格排的英文名（和中文姓名无关）。
    var enRecCache: [EnRank] = []
    /// 照中文姓名读音贴近排的英文名；`enSoundKey` 记住是按哪个名字排的。
    var enSoundCache: [EnRank] = []
    @ObservationIgnored private var enSoundKey = ""

    /// 自选英文名：选中的名。
    var enGivenPick: NMEnName?
    /* 英文姓名用**自由文本**，三种来源都落到同一处：
     *  1. 中文姓名（`enZhName`）→ 解析出姓 → 自动配英文姓（李慕白 → 李 → Lee，欧阳修 → 欧阳 → Ouyang）；
     *  2. 自己填；
     *  3. 从 172 个库里挑。
     * `enSurAuto` 记住英文姓是「自动配的」还是「人定的」：自动配的跟着中文姓名走，
     * 手动改过（或从库里挑过）就不再被覆盖。 */
    /* 中文姓名：**全 App 只有一个入口**（`enInput` 也读写它，见上）。
     * 「按性格推荐」直接用这个名字按读音贴近挑名字，不再另开一个「中文名」输入框
     * —— 两个框名字差不多、用途不同，谁看都糊涂。 */
    var enZhName = ""
    var enSurname = ""
    var enSurAuto = true
    var enSurKeyword = ""
    var enSurLetter = "all"

    var mineExpandProfile = false
    var mineExpandBazi = false
    /// 昵称页打开时的模式。首页「社交昵称」和名字详情「小名」共用一页，进之前先设好。
    var nickMode: NickMode = .child
    var compareSelection: Set<String> = []
    var nickDetail: NickItem?

    var baziForm = BaziForm()
    var baziInfo: BaziInfo?

    // 浮层 / 提示 / 卡片
    var sheet: NamingSheetKind?
    var toastText: String?
    var cardImage: UIImage?
    /// 设置浮层（齿轮在 NavigationStack 根视图的导航栏上，状态就放在这里）。
    var showSettings = false
    var poolGender = "u"
    var poolTag = "all"

    let engine = NameEngine.shared
    private var persistTask: Task<Void, Never>?

    enum StorageKey {
        static let legacyFav = "naming.fav.v1"
        static let all = "naming.state.v3"
    }

    struct Persisted: Codable {
        var fav: [FavItem]
        var profile: NMProfile?
        var baziForm: BaziForm
        var baziInfo: BaziInfo?
    }

    init() {
        load()
    }

    // MARK: - 便捷

    var screen: NamingScreen { path.last ?? (tab == .mine ? .mine : .home) }
    var maxStudioChars = 4

    func zeroGenderLabel(_ g: String) -> String {
        g == "f" ? L10n.t("偏女") : g == "m" ? L10n.t("偏男") : L10n.t("中性")
    }

    func go(_ target: NamingScreen, replace: Bool = false) {
        guard target != screen else { return }
        if replace {
            // 目标已在栈里（例如「结果页 → 重新测 → 出结果」）：把中间页丢掉，只留目标
            if let idx = path.lastIndex(of: target) {
                path.removeSubrange((idx + 1)...)
                return
            }
            if !path.isEmpty {
                path[path.count - 1] = target
                return
            }
            path.append(target)
            return
        }
        path.append(target)
    }

    func pop() { if !path.isEmpty { path.removeLast() } }

    /* 退回某一页。目标不在栈里（例如选姓页是从「中名西取」进去的，栈里没有
     * `.enStudio`）就退回上一层 —— 早先这种情况什么都不做，按钮看着像坏了。 */
    func popTo(_ target: NamingScreen) {
        guard let idx = path.lastIndex(of: target) else {
            pop()
            return
        }
        path.removeSubrange((idx + 1)...)
    }

    func popToRoot() { path = [] }

    func toast(_ msg: String) {
        toastText = msg
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: 1_800_000_000)
            if toastText == msg { toastText = nil }
        }
    }

    func schedulePersist() {
        persistTask?.cancel()
        let snapshot = Persisted(fav: fav, profile: profile, baziForm: baziForm, baziInfo: baziInfo)
        persistTask = Task { @MainActor in
            try? await Task.sleep(nanoseconds: 300_000_000)
            if let data = try? JSONEncoder().encode(snapshot) {
                UserDefaults.standard.set(data, forKey: StorageKey.all)
            }
        }
    }

    private func load() {
        if let data = UserDefaults.standard.data(forKey: StorageKey.all),
           let p = try? JSONDecoder().decode(Persisted.self, from: data) {
            fav = p.fav
            profile = p.profile
            baziForm = p.baziForm
            baziInfo = p.baziInfo
            return
        }
        // 向上兼容旧的收藏格式
        if let data = UserDefaults.standard.data(forKey: StorageKey.legacyFav),
           let list = try? JSONDecoder().decode([FavItem].self, from: data) {
            fav = list
        }
    }

    // MARK: - 首页入口

    /* 首页只有两个入口：中文名 / 英文名。取名方式收在各自的入口页里 ——
     * 按性格 / 按已有的名字 / 自定义，三条路共用同一份性格数据。 */

    func openZh() { go(.zh) }

    /// 西名中起：外文名 → 中国式名字。页面本身不会自动跑，带上现有输入即可。
    func openTranslit() { go(.translit) }

    func openResultFromEntry() {
        if let p = profile, p.hasAnswered {
            if surname != nil {
                if recs.isEmpty { refreshRecs() }
            } else {
                recs = []
            }
            go(.result)
        } else {
            go(.quiz)
        }
    }

    func openQuiz() {
        answers = []
        qi = 0
        go(.quiz)
    }

    func openBazi() {
        if let info = baziInfo, let s = info.solar {
            baziForm = BaziForm(y: s.y, m: s.m, d: s.d, hour: s.hour)
        }
        go(.bazi)
    }

    func openEn() {
        enFrom = screen == .detail ? "detail" : (screen == .result ? "result" : "home")
        if screen == .detail, let c = current { enInput = c.full }
        /* 中文名流程里选过姓就预填英文姓（李 → Lee）：两个场景共用一套输入，
         * 外国人没选过中文姓就是空的，自己填或从库里挑。 */
        ensureEnSurname()
        go(.en)
    }

    /* 三扇门（和中文名页对称）。按性格 / 中名西取两页的列表交给页面自己（.task）去算，
     * 别在压栈前阻塞动画。 */

    /// 按性格取名 —— 只看性格，和中文姓名无关。
    func openEnRec() {
        ensureEnSurname()
        go(.enRec)
    }

    /// 中名西取 —— 填中文姓名，配读音贴近的英文名。
    func openEnSound() {
        ensureEnSurname()
        go(.enSound)
    }

    /// 自选姓名 —— 自己挑姓和名。
    func openEnStudio() {
        ensureEnSurname()
        go(.enStudio)
    }

    // MARK: - 测试

    func answer(_ index: Int) {
        guard qi < engine.data.questions.count else { return }
        let q = engine.data.questions[qi]
        guard index < q.options.count else { return }
        if answers.count <= qi { answers.append(contentsOf: Array(repeating: nil, count: qi + 1 - answers.count)) }
        answers[qi] = q.options[index]
        qi += 1
        if qi >= engine.data.questions.count { finishQuiz() }
    }

    func backQuestion() {
        qi = max(0, qi - 1)
    }

    func finishQuiz() {
        var p = engine.profileFromAnswers(answers)
        if let info = baziInfo { p = BaziEngine.attachBazi(p, info) }
        profile = p
        shown = []
        current = nil
        candidates = []
        recShown = []
        refreshRecs()
        schedulePersist()
        go(.result, replace: true)
    }

    // MARK: - 生辰

    func currentBazi() -> BaziInfo? {
        profile?.bazi ?? baziInfo
    }

    func finishBazi() {
        let info = BaziEngine.fromSolar(baziForm.y, baziForm.m, baziForm.d, baziForm.hour)
        guard info.ok else {
            toast(info.error ?? L10n.t("生日无效"))
            return
        }
        baziInfo = info
        if var p = profile, p.hasAnswered {
            p = BaziEngine.attachBazi(p, info)
            profile = p
        } else {
            profile = BaziEngine.profileFromBazi(info)
        }
        shown = []
        current = nil
        candidates = []
        recShown = []
        refreshRecs()
        schedulePersist()
        go(.result, replace: true)
    }

    // MARK: - 推荐

    func rebuildCandidates() {
        guard let p = profile, let s = surname else {
            candidates = []
            return
        }
        candidates = engine.namesForSurname(p, s, wantGender: wantGender, feedback: feedback)
    }

    @discardableResult
    func applyFeedbackToDetail(forceSwap: Bool = false) -> Bool {
        rebuildCandidates()
        shown = []
        guard let cur = current else { return true }
        var ok = true
        if feedback.banFull.contains(cur.full) { ok = false }
        for ch in cur.chars where feedback.banChars.contains(ch) { ok = false }
        for ch in feedback.keepChars where !cur.chars.contains(ch) { ok = false }
        if ok && !forceSwap {
            shown.insert(cur.full)
            return true
        }
        let next = engine.sampleTop(candidates, 0.7, 1, shown, score: { $0.score }, key: { $0.full })
        if let one = next.first {
            current = one
            shown.insert(one.full)
            return true
        }
        if let first = candidates.first {
            current = first
            shown.insert(first.full)
            return true
        }
        return false
    }

    func buildRecsForSurname(_ surname: NMSurname, count: Int, exclude: Set<String>, temperature: Double = 0.28) -> [RecResult] {
        guard let p = profile else { return [] }
        let list = engine.namesForSurname(p, surname, wantGender: wantGender, feedback: feedback)
        var pool: [RecResult] = []
        var used = Set<String>()
        for x in list {
            let full = surname.c + x.given
            if exclude.contains(x.given) || exclude.contains(full) { continue }
            if used.contains(x.given) { continue }
            used.insert(x.given)
            pool.append(RecResult(surname: surname, name: x, given: x.given, chars: x.chars, full: full,
                                  fit: 1, euphony: x.euphony ?? engine.euphony(surname, x.chars),
                                  score: x.mix ?? x.score))
        }
        let picked = engine.sampleTop(pool, temperature, count, [], score: { $0.score }, key: { $0.given })
        return picked.isEmpty ? Array(pool.prefix(count)) : picked
    }

    func refreshRecs() {
        guard profile != nil else { return }
        guard let s = surname else {
            recs = []
            return
        }
        recs = buildRecsForSurname(s, count: 6, exclude: recShown)
        if recs.isEmpty {
            recShown = []
            recs = buildRecsForSurname(s, count: 6, exclude: [])
        }
    }

    func changeBatch() {
        guard profile != nil else { return }
        guard surname != nil else {
            toast(L10n.t("请先选姓氏"))
            return
        }
        for r in recs { recShown.insert(r.given) }
        if recShown.count > 40 { recShown = [] }
        refreshRecs()
    }

    /// 「查看全部推荐」：把当前姓氏下的候选整份列出来（结果页只展示 6 条一批）。
    func allRecs() -> [RecResult] {
        guard let p = profile, let s = surname else { return [] }
        let list = engine.namesForSurname(p, s, wantGender: wantGender, feedback: feedback)
        return list.prefix(120).map { x in
            RecResult(surname: s, name: x, given: x.given, chars: x.chars, full: s.c + x.given,
                      fit: 1, euphony: x.euphony ?? engine.euphony(s, x.chars),
                      score: x.mix ?? x.score)
        }
    }

    // MARK: - 结果页 / 详情

    func openRec(_ rec: RecResult) {
        surname = rec.surname
        var name = rec.name
        name.euphony = rec.euphony
        current = name
        detailFrom = "result"
        shown = [rec.full]
        candidates = []
        go(.detail)
    }

    func tagOf(_ x: NameResult) -> String {
        guard x.source == "curated" else { return L10n.t("生成") }
        if let g = engine.data.given.first(where: { $0.n == x.given }) {
            return g.tag == "literary" ? L10n.t("清雅") : L10n.t("常见")
        }
        return L10n.t("常见")
    }

    func charLabel(_ ch: String) -> String {
        let n = engine.charNote(ch)
        return n.phon ? L10n.f("%@（%@）", ch, n.py) : L10n.f("%@ %@", ch, n.text)
    }

    func whyFor(_ c: NameResult) -> String {
        /* 说明文字一律**现算**，不用生成时存下来的 note —— 那份 note 会锁死在生成时的
         * 语言（先中文排的名字，切到英文后还是中文）。 */
        // 1) 精选名：查精选名释义表（数据正文走英文覆盖表）。
        if let m = engine.givenMeaning(c.given), !m.isEmpty { return m }
        // 2) 音译名有专门的说明（发音贴不贴），由 TranslitView 现算，这里原样用。
        if c.source == "translit", !c.note.isEmpty { return c.note }
        // 3) 其余（自选、按字义拼的）用字义现拼。
        var parts: [String] = []
        for ch in c.chars where engine.getChar(ch) != nil {
            parts.append(L10n.f("%@：%@", ch, engine.charNote(ch).text))
        }
        if !parts.isEmpty { return parts.joined(separator: L10n.t("；")) }
        return c.note
    }

    func isSaved(_ full: String) -> Bool { fav.contains { $0.full == full } }

    func toggleSave() {
        guard let cur = current else { return }
        if let idx = fav.firstIndex(where: { $0.full == cur.full }) {
            fav.remove(at: idx)
            schedulePersist()
            toast(L10n.t("已取消收藏"))
            return
        }
        fav.insert(FavItem(full: cur.full,
                           py: Pinyin.name(cur.surname, cur.chars),
                           why: whyFor(cur),
                           src: detailFrom == "mine" ? "detail" : detailFrom,
                           at: Date().timeIntervalSince1970, note: "",
                           given: cur.given), at: 0)
        schedulePersist()
        toast(L10n.t("已收藏"))
    }

    func again() {
        guard let cur = current else { return }
        feedback.banFull.insert(cur.full)
        rebuildCandidates()
        var one = engine.sampleTop(candidates, 0.7, 1, shown, score: { $0.score }, key: { $0.full })
        if one.isEmpty {
            shown = []
            one = engine.sampleTop(candidates, 0.7, 1, shown, score: { $0.score }, key: { $0.full })
        }
        guard let next = one.first else {
            toast(feedback.keepChars.isEmpty
                  ? L10n.t("这个姓的候选都用完了，换个姓吧")
                  : L10n.t("带这些保留字的候选不够了，试试取消部分保留或换姓"))
            return
        }
        current = next
        shown.insert(next.full)
    }

    // MARK: - 收藏还原

    func surnameOfFull(_ full: String) -> NMSurname {
        var best: NMSurname?
        for s in engine.allSurnames() where full.hasPrefix(s.c) {
            if best == nil || s.c.count > best!.c.count { best = s }
        }
        if let best { return best }
        return NMSurname(c: String(full.prefix(1)), py: "", tone: 0, m: "", en: "", pop: 3,
                         pys: nil, tones: nil, ro: "")
    }

    func favToName(_ f: FavItem) -> NameResult {
        let sur = surnameOfFull(f.full)
        let chars = Array(f.full.dropFirst(sur.c.count)).map(String.init)
        let vec = engine.givenVec(chars) ?? NameVector(trait: engine.zero(engine.data.traitKeys),
                                                       style: engine.zero(engine.data.styleKeys), chars: chars)
        return NameResult(given: chars.joined(), chars: chars, surname: sur, full: f.full,
                          score: 0, tSim: 0, sSim: 0, novelty: 0, source: "fav",
                          note: favWhy(f), vec: vec, tier: 0, euphony: nil, mix: nil)
    }

    /// 收藏里的释义现算：有 given 就按当前语言重建，旧数据回退到存下来的那句。
    func favWhy(_ f: FavItem) -> String {
        guard let g = f.given, !g.isEmpty else { return f.why }
        if let m = engine.givenMeaning(g), !m.isEmpty { return m }
        let chars = Array(g).map(String.init).filter { engine.getChar($0) != nil }
        guard !chars.isEmpty else { return f.why }
        return chars.map { L10n.f("%@：%@", $0, engine.charNote($0).text) }
            .joined(separator: L10n.t("；"))
    }

    func openFav(_ f: FavItem) {
        /* 英文名收藏：回英文名详情页。
         * `full` 里带着当时那个姓（Emma Wilson），但详情标题是按当前姓拼的，
         * 用户后来改过姓就会不一致 —— 可接受，改姓本来就是全局设置。 */
        if f.kind == "en" {
            guard let it = engine.data.namesEn.first(where: { $0.n == (f.given ?? "") }) else {
                toast(L10n.t("库里已经没有这个名字了"))
                return
            }
            enPicked = it
            enDetailMode = "en"
            go(.enDetail)
            return
        }
        if f.kind == "nick" {
            nickDetail = NickEngine.socialItems(in: "全部").first { $0.text == f.full }
                ?? NickItem(text: f.full, type: "社交昵称", category: "社交昵称",
                            tags: ["成人"], score: 0.5, note: f.why,
                            zhNote: f.why)
            return
        }
        let name = favToName(f)
        current = name
        surname = name.surname
        detailFrom = "mine"
        go(.detail)
    }

    // MARK: - 英文名收藏

    /// 这个名字的英文名有没有收藏过（`full` 是「名 + 姓」的完整写法）。
    func isSavedEn(_ full: String) -> Bool {
        fav.contains { $0.kind == "en" && $0.full == full }
    }

    /// 收藏 / 取消收藏一个英文名。`src` 记从哪扇门存的，收藏列表里当来源标签。
    func toggleEnFav(_ it: NMEnName, src: String = "en") {
        let full = enFullName(it.n)
        if let idx = fav.firstIndex(where: { $0.kind == "en" && $0.full == full }) {
            fav.remove(at: idx)
            schedulePersist()
            toast(L10n.t("已取消收藏"))
            return
        }
        /* `py` 留空（英文名没有拼音，主标直接用 `full`）；`given` 存英文名本身，
         * 既是详情页的查找键，也让收藏列表点得回去；`note` 存中文音译当副标。 */
        fav.insert(FavItem(full: full, py: "", why: enWhy(it), src: src,
                           at: Date().timeIntervalSince1970,
                           note: enFullZh(it.zh), given: it.n, kind: "en"), at: 0)
        schedulePersist()
        toast(L10n.t("已收藏"))
    }

    /// 英文名的释义（含义为主，没有含义退回语源）—— 存进收藏，免得换语言后没东西显示。
    func enWhy(_ it: NMEnName) -> String {
        let m = L10n.d("namesEn", it.n, "m", it.m)
        return m.isEmpty ? L10n.d("namesEn", it.n, "org", it.org) : m
    }

    func favSrcLabel(_ src: String) -> String {
        let table: [String: String] = ["quiz": "性格推荐", "bazi": "生辰", "result": "推荐", "detail": "详情",
                                       "studio": "自选", "translit": "西名中起", "en": "英文名",
                                       "enSound": "中名西取", "enStudio": "自选英文名",
                                       "nick": "小名昵称", "nickChild": "小名", "nickSocial": "社交昵称",
                                       "unknown": ""]
        return L10n.t(table[src] ?? "")
    }

    // MARK: - 小名 / 昵称

    func openNick() {
        nickMode = .child
        go(.nick)
    }

    /// 自选姓名里配小名。
    func openNickFromStudio() {
        guard !studioSlots.isEmpty else {
            toast(L10n.t("先挑好字，再来配小名"))
            return
        }
        nickMode = .child
        go(.nick)
    }

    /// 首页一级入口：仅社交昵称。
    func openSocialNick() {
        nickMode = .social
        go(.nick)
    }

    func isSavedNick(_ text: String) -> Bool {
        fav.contains { $0.kind == "nick" && $0.full == text }
    }

    func toggleNickFav(_ item: NickItem) {
        if let idx = fav.firstIndex(where: { $0.kind == "nick" && $0.full == item.text }) {
            fav.remove(at: idx)
            schedulePersist()
            toast(L10n.t("已取消收藏"))
            return
        }
        let from: String
        if nickMode == .child, !studioSlots.isEmpty {
            from = (studioSurname?.c ?? "") + studioSlots.joined()
        } else if nickMode == .social {
            from = ""
        } else {
            from = current?.full ?? ""
        }
        let source = nickMode == .child ? "nickChild" : "nickSocial"
        fav.insert(FavItem(full: item.text, py: "", why: item.note, src: source,
                           at: Date().timeIntervalSince1970, note: from,
                           given: item.text, kind: "nick"), at: 0)
        schedulePersist()
        toast(L10n.t("已收藏"))
    }

    // MARK: - 选姓氏

    func pickSurname(_ s: NMSurname) {
        let base = screen
        surname = s
        shown = []
        candidates = []
        recShown = []
        poolTag = "all"
        sheet = nil

        if base == .result {
            refreshRecs()
            return
        }
        if base == .detail {
            guard let p = profile else {
                toast(L10n.t("先做一遍测试，才能按新姓重排名字"))
                return
            }
            let next = engine.namesForSurname(p, s, wantGender: wantGender, feedback: feedback)
            candidates = next
            let one = engine.sampleTop(next, 0.7, 1, shown, score: { $0.score }, key: { $0.full })
            if let first = one.first {
                current = first
                shown.insert(first.full)
            } else if let first = next.first {
                current = first
            }
        }
    }

    /// 备选名浮层的行（纯读，不改状态）。
    func poolNameRows() -> [NameResult] {
        let shownList = candidates.filter { x in
            if poolTag == "all" { return true }
            if x.source != "curated" { return false }
            guard let g = engine.data.given.first(where: { $0.n == x.given }) else { return true }
            return g.tag == poolTag
        }
        return Array(shownList.prefix(60))
    }

    /// 按浮层里的性别偏好重算候选。
    func rebuildPool() {
        guard let p = profile, let s = surname else {
            candidates = []
            return
        }
        candidates = engine.namesForSurname(p, s, wantGender: poolGender, feedback: feedback)
    }

    func pickPoolName(_ given: String) {
        guard let found = candidates.first(where: { $0.given == given }) else { return }
        let wasDetail = screen == .detail
        current = found
        if !wasDetail { detailFrom = "result" }
        shown.insert(found.full)
        sheet = nil
        if !wasDetail { go(.detail) }
    }

    // MARK: - 外文名 → 中文名

    func runTranslit() {
        let raw = translit.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !raw.isEmpty else {
            toast(L10n.t("先输入一个外文名"))
            return
        }
        let parts = raw.split(separator: " ").map(String.init).filter { !$0.isEmpty }
        var family: String?
        var given = parts.first ?? raw
        if parts.count >= 2 {
            family = parts.last
            given = parts.dropLast().joined(separator: " ")
        }
        if profile == nil {
            /* 没有性格数据时用中性的默认向量 */
            profile = engine.profileFromAnswers([
                NMQuestionOption(text: "", w: ["warm": 0.3, "out": 0, "rat": 0.2, "sta": 0.3], nov: 0.4)
            ])
        }
        guard let p = profile else { return }
        let list = engine.chineseName(given, p, family: family, wantGender: wantGender, count: 10)
        guard !list.isEmpty else {
            toast(L10n.t("这个名字没配出合适的组合，换个拼写试试"))
            return
        }
        let tl = engine.translitChars(given, p, surname: NMSurname(c: "卫", py: "wei", tone: 4, m: "", en: "", pop: 3, pys: nil, tones: nil, ro: ""))
        var tlStyle = ""
        if let first = tl.first {
            if let family {
                let latin = engine.data.latinSurnames[family]?.first ?? ""
                tlStyle = latin.isEmpty ? first.given : "\(latin) · \(first.given)"
            } else {
                tlStyle = first.given
            }
        }
        translit = raw
        translitResult = TranslitResultState(latin: given, family: family, surname: list[0].surname,
                                             main: list[0], alts: Array(list.dropFirst().prefix(8)),
                                             translitStyle: tlStyle)
    }

    func translitAgain() {
        guard var r = translitResult else { return }
        var rest = r.alts
        if rest.isEmpty {
            guard let p = profile else { return }
            let again = engine.chineseName(r.latin, p, family: r.family, wantGender: wantGender, count: 10)
            rest = again.filter { $0.full != r.main.full }
            if rest.isEmpty {
                toast(L10n.t("没别的组合了"))
                return
            }
        }
        r.main = rest[0]
        r.surname = rest[0].surname
        r.alts = Array(rest.dropFirst().prefix(8))
        translitResult = r
    }

    func translitPick(_ index: Int) {
        guard var r = translitResult, index < r.alts.count else { return }
        let old = r.main
        let a = r.alts[index]
        r.main = a
        r.surname = a.surname
        var next = r.alts
        next.remove(at: index)
        r.alts = Array(([old] + next).prefix(8))
        translitResult = r
    }

    func translitSave() {
        guard let m = translitResult?.main else { return }
        if isSaved(m.full) {
            toast(L10n.t("已经收藏过了"))
            return
        }
        let chars = m.chars
        let vec = engine.givenVec(chars) ?? NameVector(trait: engine.zero(engine.data.traitKeys),
                                                       style: engine.zero(engine.data.styleKeys), chars: chars)
        let name = NameResult(given: m.given, chars: chars, surname: m.surname, full: m.full,
                              score: m.score, tSim: 0, sSim: 0, novelty: 0, source: m.source,
                              note: m.note, vec: vec, tier: m.tier, euphony: m.euphony, mix: nil)
        fav.insert(FavItem(full: m.full, py: Pinyin.name(m.surname, chars), why: whyFor(name),
                           src: "translit", at: Date().timeIntervalSince1970, note: "",
                           given: m.given), at: 0)
        schedulePersist()
        toast(L10n.t("已收藏"))
    }

    func surnameWhy(_ r: TranslitResultState) -> String {
        let src = r.family != nil ? L10n.f("「%@」的音头", r.family!) : L10n.f("「%@」的开头音", r.latin)
        let tail = engine.isCompound(r.surname) ? L10n.t("复姓，两个字") : L10n.t("单姓，好写好认")
        return L10n.f("照%@取，读起来有点原名的影子；%@", src, tail)
    }

    // MARK: - 工作台

    var studioEffectiveSurname: NMSurname { studioSurname ?? engine.defaultSurname() }

    func studioSurs() -> [NMSurname] {
        let f = studioSurF
        let list = engine.allSurnames().filter { s in
            if f.type == "single" && engine.isCompound(s) { return false }
            if f.type == "compound" && !engine.isCompound(s) { return false }
            let pop = s.pop
            if f.pop == "common" && pop < 4 { return false }
            if f.pop == "rare" && pop >= 4 { return false }
            if f.letter != "all" && initialOf(s.py) != f.letter { return false }
            return true
        }
        return engine.searchSurnames(list, studioSurKeyword)
    }

    func studioChars() -> [NMChar] {
        let f = studioCharF
        let kw = studioCharKeyword.trimmingCharacters(in: .whitespaces).lowercased()
        return engine.data.chars.filter { c in
            if f.dom != "all" && c.dom != f.dom { return false }
            if f.g != "all" && c.g != f.g { return false }
            let freq = c.freq
            if f.freq == "common" && freq < 3 { return false }
            if f.freq == "rare" && freq >= 3 { return false }
            if f.letter != "all" && initialOf(c.py) != f.letter { return false }
            if kw.isEmpty { return true }
            return c.c.contains(kw) || c.py.contains(kw)
        }
    }

    func initialOf(_ py: String) -> String {
        py.lowercased().first.map(String.init) ?? ""
    }

    func lettersOf(_ list: [String]) -> [String] {
        var seen = Set<String>()
        var out: [String] = []
        for py in list {
            let l = initialOf(py)
            if !l.isEmpty && seen.insert(l).inserted { out.append(l) }
        }
        return out.sorted()
    }

    func toggleStudioChar(_ c: String) {
        if let at = studioSlots.firstIndex(of: c) {
            studioSlots.remove(at: at)
        } else if studioSlots.count >= maxStudioChars {
            toast(L10n.f("最多 %ld 个字", maxStudioChars))
        } else {
            studioSlots.append(c)
        }
    }

    func studioPreview() -> (full: String, py: String, read: Readability, tips: [String])? {
        guard let surname = studioSurname, !studioSlots.isEmpty else { return nil }
        let rel = engine.readability(surname, studioSlots)
        var tips: [String] = []
        if studioSlots.count == 1 { tips.append(L10n.t("单字名：干净利落，但重名概率高。")) }
        if studioSlots.count >= 3 { tips.append(L10n.t("三个字以上的名不常见，属于非主流取名，自己确认喜欢就好。")) }
        if studioSlots.count >= maxStudioChars { tips.append(L10n.f("已经到 %ld 个字了，再多就不像名字了。", maxStudioChars)) }
        return (surname.c + studioSlots.joined(), Pinyin.name(surname, studioSlots), rel, tips)
    }

    /// 一个字在名字里的信息：读音、释义、五行意象（数据正文走英文覆盖表）。
    func studioCharInfo(_ ch: String) -> (py: String, note: String, wx: String?) {
        let n = engine.charNote(ch)
        /* 有些意象域没有对应五行（domainWx 给空串），当作没有，别在末尾留个「·」。 */
        let wx = engine.getChar(ch).flatMap { engine.domainWx($0.dom) } ?? ""
        return (n.py, n.text, wx.isEmpty ? nil : L10n.t(wx))
    }

    /* 和当前自选名相似的名字，从精选名库里挑：
     *  1) 先要**共用了字**的（最直观的「像」），共用的字越多越靠前，字数不限；
     *  2) 不够一屏时用**同字数、气质最接近**的补上，标「气质相近」。
     * 结果按字形和语言一起缓存：切语言要重算（释义是查表来的），反复重绘不用重算。 */
    func studioSimilar(limit: Int = 6) -> [SimilarName] {
        guard studioSurname != nil, !studioSlots.isEmpty,
              let cur = engine.givenVec(studioSlots) else { return [] }
        let key = L10n.code + "|" + studioSlots.joined()
        let all: [SimilarName]
        if let cached = similarCache, cached.key == key {
            all = cached.list
        } else {
            all = computeSimilar(cur)
            similarCache = (key, all)
        }
        return Array(all.prefix(limit))
    }

    private func computeSimilar(_ cur: NameVector) -> [SimilarName] {
        let current = studioSlots.joined()
        var sharedList: [SimilarName] = []
        var vibeList: [SimilarName] = []
        for g in engine.data.given {
            let chars = Array(g.n).map(String.init)
            if g.n == current { continue }
            let shared = chars.filter { studioSlots.contains($0) }
            var vibe = 0.0
            if chars.count == studioSlots.count, let v = engine.givenVec(chars) {
                let t = engine.cos(cur.trait, v.trait, engine.data.traitKeys)
                let s = engine.cos(cur.style, v.style, engine.data.styleKeys)
                vibe = (t + s) / 2
            }
            let item = SimilarName(n: g.n, m: engine.givenMeaning(g.n) ?? g.m, shared: shared, vibe: vibe)
            /* 气质不到 0.7 就不算「相近」，宁缺毋滥。 */
            if !shared.isEmpty { sharedList.append(item) } else if vibe >= 0.7 { vibeList.append(item) }
        }
        sharedList.sort { a, b in
            if a.shared.count != b.shared.count { return a.shared.count > b.shared.count }
            return a.vibe > b.vibe
        }
        vibeList.sort { $0.vibe > $1.vibe }
        /* 共字的先上；凑不满 8 条再用气质相近的补（补进来的仍然排后面）。 */
        return sharedList + Array(vibeList.prefix(max(0, 8 - sharedList.count)))
    }

    /// 点相似的名字 = 把它的字换进自选栏（留在本页，还能继续改）。
    func studioUse(_ s: SimilarName) {
        let chars = Array(s.n).map(String.init)
        guard chars.count <= maxStudioChars else { return }
        studioSlots = chars
    }

    /* 只是给视图算好的一份缓存，不是界面状态：不参与观察，避免在 body 里写它触发重绘。 */
    @ObservationIgnored private var similarCache: (key: String, list: [SimilarName])?

    func studioSave() {
        guard let surname = studioSurname else {
            toast(L10n.t("先选姓氏"))
            return
        }
        guard !studioSlots.isEmpty else {
            toast(L10n.t("先选一个字"))
            return
        }
        let full = surname.c + studioSlots.joined()
        if let idx = fav.firstIndex(where: { $0.full == full }) {
            fav.remove(at: idx)
            schedulePersist()
            toast(L10n.t("已取消收藏"))
            return
        }
        let why = studioSlots.map { ch -> String in
            L10n.f("%@：%@", ch, L10n.d("chars", ch, engine.getChar(ch)?.m ?? ""))
        }.joined(separator: L10n.t("；"))
        fav.insert(FavItem(full: full, py: Pinyin.name(surname, studioSlots), why: why,
                           src: "studio", at: Date().timeIntervalSince1970, note: "",
                           given: studioSlots.joined()), at: 0)
        schedulePersist()
        toast(studioSlots.count >= 3 ? L10n.t("已收藏（三字以上的名不常见）") : L10n.t("已收藏"))
    }

    // MARK: - 英文名

    /* 按性格取名：只看性格，中文姓名填了也不影响 —— 那是「中名西取」的门。 */
    func genEnRecs() {
        let p = ensureProfile()
        enRecCache = engine.enFromChinese(p, pinyinSyls: [], wantGender: wantGender, wantEra: "now")
    }

    /* 中名西取：拿中文姓名的读音去贴近英文名（李慕白 → Mu → …）。
     * 名字没变就不重算：这函数会扫 1400+ 条库。 */
    func genEnSounds() {
        let p = ensureProfile()
        enSoundCache = engine.enFromChinese(p, pinyinSyls: pinyinOfZh(enZhName),
                                            wantGender: wantGender, wantEra: "now")
        enSoundKey = enZhName.trimmingCharacters(in: .whitespaces)
    }

    func ensureEnSounds() {
        let k = enZhName.trimmingCharacters(in: .whitespaces)
        if enSoundCache.isEmpty || enSoundKey != k { genEnSounds() }
    }

    func ensureProfile() -> NMProfile {
        if let profile { return profile }
        let p = engine.profileFromAnswers([])
        profile = p
        return p
    }

    func pinyinOfZh(_ raw: String) -> [String] {
        let s = raw.replacingOccurrences(of: "\\s+", with: "", options: .regularExpression)
        if s.isEmpty { return [] }
        let sur = surnameOfFull(s)
        var given = s.hasPrefix(sur.c) ? String(s.dropFirst(sur.c.count)) : s
        if given.isEmpty { given = s }
        var out: [String] = []
        for ch in given {
            if let it = engine.getChar(String(ch)), !it.py.isEmpty { out.append(it.py) }
        }
        return out
    }

    func enLangOf(_ it: NMEnName) -> String {
        let raw = String(it.org.split(separator: "·").first ?? "").trimmingCharacters(in: .whitespaces)
        if raw.isEmpty { return "" }
        if raw.hasPrefix("古英语") || raw == "英语" || raw == "英" { return "古英" }
        if raw.hasPrefix("古法") || raw == "法" { return "法语" }
        if raw.hasPrefix("古北欧") || raw.hasPrefix("古诺斯") { return "北欧" }
        if raw.hasPrefix("盖尔") { return "爱尔兰" }
        if raw.contains("/") { return String(raw.split(separator: "/")[0]).trimmingCharacters(in: .whitespaces) }
        return raw
    }

    func enMatchVibe(_ it: NMEnName, _ vibe: String) -> Bool {
        if vibe.isEmpty || vibe == "all" { return true }
        let key = String(vibe.dropLast())
        let pos = vibe.hasSuffix("+")
        let v = it.tr[key] ?? it.st[key] ?? 0
        return pos ? v >= 0.35 : v <= -0.35
    }

    func browseEnNames() -> [NMEnName] {
        let f = enF
        let kw = f.keyword.trimmingCharacters(in: .whitespaces).lowercased()
        return engine.data.namesEn.filter { it in
            if f.g != "all" && it.g != "u" && it.g != f.g { return false }
            if f.era != "all" && it.era != f.era { return false }
            if !enMatchVibe(it, f.vibe) { return false }
            if f.theme != "all" {
                if !(it.org + it.m).contains(f.theme) { return false }
            }
            if f.lang != "all" && enLangOf(it) != f.lang { return false }
            if !kw.isEmpty {
                let aliases = engine.data.enCelebSearch[it.n.lowercased()] ?? []
                let hay = ([it.n, it.zh, it.org, it.m] + it.nick + aliases).joined(separator: " ").lowercased()
                if !hay.contains(kw) { return false }
            }
            return true
        }
    }

    func enCelebs(_ it: NMEnName) -> [[String]] {
        engine.data.enCelebs[it.n.lowercased()] ?? []
    }

    /* 选姓页要的两条信息：这个姓的来历 / 同名的人。
     * 中文姓走 `celebsForName`（按字匹配，命中「同字『李』」这类）；英文姓直接查
     * `enCelebs`（按英文名索引，Lee / Chan / Wang 这些华裔姓氏命中较多）。 */

    /// 某个中文姓的同姓名人（最多 3 个）。
    func surnameCelebs(_ s: NMSurname, limit: Int = 3) -> [CelebrityHit] {
        engine.celebsForName("", s.c.map(String.init), limit: limit)
    }

    /// 某个英文姓的相关名人。
    func enSurnameCelebs(_ n: String) -> [[String]] {
        engine.data.enCelebs[n.trimmingCharacters(in: .whitespaces).lowercased()] ?? []
    }

    /* 英文名侧的两条路：
     *  - 点开一条看详细（按性格推荐 / 自选预览的「查看详情」）→ 推 `.enDetail`；
     *  - 自选里挑姓 / 挑名 → 选中后弹回自选页。
     * 两条路都不在列表里插卡片 —— 插卡片会把下面整列顶下去（列表抖动的来源）。 */

    func openEnDetail(_ it: NMEnName, mode: String = "en") {
        enPicked = it
        enDetailMode = mode
        go(.enDetail)
    }

    func pickEnGivenName(_ it: NMEnName) {
        enGivenPick = it
        popTo(.enStudio)
    }

    // MARK: - 英文姓

    /* 中文姓 → 英文拼写：**只认数据里标好的对应关系**（`NMSurname.en` 里 李 → Lee、陈 → Chen，
     * 复姓没有 en 时走 `ro`：欧阳 → Ouyang，再不行反查 172 个库）。
     * 认不出就返回 nil —— 罕见姓的音译本来就没有唯一答案，宁可不填、让用户自己写。 */
    func enSurnameMapping(_ s: NMSurname) -> String? {
        if !s.en.isEmpty { return s.en }
        if !s.ro.isEmpty { return s.ro }
        if let hit = engine.data.latinSurnames.first(where: { $0.value.first == s.c })?.key { return hit }
        return nil
    }

    /* 同一个姓通常有好几种写法，来源是三套体系：
     *  - 通用（数据里那一列，混了威妥玛/台湾与拼音，如 张 → Chang）
     *  - 拼音（从 `py` 现算，如 张 → Zhang）
     *  - 港式（粤语，数据表，如 张 → Cheung）
     * 没有唯一正确的那个 —— 大陆证件用拼音、香港用粤语、台湾/海外常用威妥玛，
     * 所以界面上三档都摆出来让用户挑（见 EnSurnameField 的写法行）。 */

    /// 姓的拼音写法（吕 → Lyu，其余按 `py` 首字母大写；复姓用 `pys` 拼起来）。
    func enSurnamePinyin(_ s: NMSurname) -> String {
        if let pys = s.pys, !pys.isEmpty {
            let joined = pys.joined()
            return joined.prefix(1).uppercased() + joined.dropFirst()
        }
        let base = s.py == "lv" ? "lyu" : s.py
        guard let f = base.first else { return "" }
        return f.uppercased() + base.dropFirst()
    }

    /// 一个中文姓的候选写法（标签 + 拼写），按「通用 / 拼音 / 港式」排，去重后返回。
    func enSurnameVariants(_ s: NMSurname) -> [(String, String)] {
        var out: [(String, String)] = []
        var seen = Set<String>()
        func add(_ label: String, _ v: String) {
            let t = v.trimmingCharacters(in: .whitespaces)
            guard !t.isEmpty, seen.insert(t.lowercased()).inserted else { return }
            out.append((label, t))
        }
        if let g = enSurnameMapping(s) { add(L10n.t("通用"), g) }
        add(L10n.t("拼音"), enSurnamePinyin(s))
        add(L10n.t("港式"), s.yue ?? "")
        return out
    }

    /// 当前该给谁选写法：优先看用户填的中文姓名，其次看当前英文姓反查回哪个中文姓。
    func enSurnameVariantBase() -> NMSurname? {
        let raw = enZhName.trimmingCharacters(in: .whitespaces)
        if !raw.isEmpty {
            let s = surnameOfFull(raw)
            if !s.c.isEmpty { return s }
        }
        let cur = enSurname.trimmingCharacters(in: .whitespaces).lowercased()
        guard !cur.isEmpty else { return nil }
        return engine.allSurnames().first {
            [$0.en, $0.yue ?? "", enSurnamePinyin($0)].contains { $0.lowercased() == cur }
        }
    }

    /// 进「英文名」时预填：中文名流程里选过姓才有得填。
    func ensureEnSurname() {
        guard enSurname.isEmpty, enSurAuto, let s = surname else { return }
        enSurname = enSurnameMapping(s) ?? ""
    }

    /// 中文姓名 → 英文姓（复姓按最长前缀认）。自动配过一次就一直跟着中文姓名走，
    /// 直到用户手动改过英文姓（或在库里挑过）—— 那时 `enSurAuto` 已经关掉。
    func syncEnSurnameFromChineseName() {
        guard enSurAuto || enSurname.isEmpty else { return }
        let raw = enZhName.trimmingCharacters(in: .whitespaces)
        guard !raw.isEmpty else {
            if enSurAuto { enSurname = "" }
            return
        }
        enSurname = enSurnameMapping(surnameOfFull(raw)) ?? ""
        enSurAuto = true
    }

    /// 用户手动定了英文姓（手输 / 从库里挑）：之后中文姓名不再覆盖它。
    func setEnSurnameManually(_ n: String) {
        enSurname = n
        enSurAuto = false
    }

    /// 这个英文姓的中文音译（库里查得到才有，手输的冷门姓就留空）。
    func enSurnameZh(_ n: String) -> String {
        let key = n.trimmingCharacters(in: .whitespaces)
        guard !key.isEmpty else { return "" }
        if let v = engine.data.latinSurnames[key] { return v.first ?? "" }
        if let hit = engine.data.latinSurnames.first(where: { $0.key.lowercased() == key.lowercased() }) {
            return hit.value.first ?? ""
        }
        return ""
    }

    /// 打完的英文姓名：`Emma Wilson`（没填姓就只有名）。
    func enFullName(_ given: String) -> String {
        let s = enSurname.trimmingCharacters(in: .whitespaces)
        return s.isEmpty ? given : given + " " + s
    }

    /// 中文音译：`艾玛 威尔逊`。
    func enFullZh(_ givenZh: String) -> String {
        [givenZh, enSurnameZh(enSurname)].filter { !$0.isEmpty }.joined(separator: " ")
    }

    /// 边打边给的姓候选（库里前缀匹配，最多 5 个，完全相同的就不列了）。
    func enSurnameSuggestions() -> [String] {
        let kw = enSurname.trimmingCharacters(in: .whitespaces).lowercased()
        guard kw.count >= 1 else { return [] }
        return engine.data.latinSurnames.keys
            .filter { $0.lowercased().hasPrefix(kw) && $0.lowercased() != kw }
            .sorted().prefix(5).map { $0 }
    }

    @MainActor
    func openCardEnStudio() {
        guard let g = enGivenPick else { return }
        cardImage = NamingCardRenderer.render(cardDataEn(g, mode: "enStudio"))
    }

    /// 选姓页的候选（关键词 + 首字母筛选）。
    func enSurnameList() -> [NMSurnameEn] {
        engine.enSurnameSearch(enSurKeyword, letter: enSurLetter)
    }


    /* 下面几张表是筛选条上的标签：值（all / 分类 key）保持原样，显示文案走 L10n，
     * 所以写成计算属性，换语言时重新取值。 */
    static var enEra: [(String, String)] {
        [("all", L10n.t("全部年代")), ("now", L10n.t("当下")), ("modern", L10n.t("90后")),
         ("mid", L10n.t("主流")), ("vintage", L10n.t("老派")), ("ancient", L10n.t("古典"))]
    }
    static var enVibe: [(String, String)] {
        [("all", L10n.t("全部气质")), ("warm+", L10n.t("温暖")), ("warm-", L10n.t("清冷")), ("out+", L10n.t("外向")),
         ("out-", L10n.t("内敛")), ("rat+", L10n.t("理性")), ("rat-", L10n.t("感性")), ("sta+", L10n.t("稳重")),
         ("sta-", L10n.t("跳脱")), ("cla+", L10n.t("古典感")), ("sim+", L10n.t("简洁")), ("exp+", L10n.t("直白"))]
    }
    static var enTheme: [(String, String)] {
        [("all", L10n.t("全部寓意")), ("光", L10n.t("光")), ("爱", L10n.t("爱")), ("美", L10n.t("美")), ("力", L10n.t("力量")),
         ("王", L10n.t("王者")), ("花", L10n.t("花草")), ("星", L10n.t("星辰")), ("鸟", L10n.t("飞鸟")), ("守护", L10n.t("守护")),
         ("高贵", L10n.t("高贵")), ("胜利", L10n.t("胜利")), ("战士", L10n.t("战士")), ("礼物", L10n.t("礼物")),
         ("温柔", L10n.t("温柔")), ("和平", L10n.t("和平")), ("自由", L10n.t("自由")), ("智慧", L10n.t("智慧")),
         ("幸运", L10n.t("幸运")), ("生命", L10n.t("生命"))]
    }
    static var enLang: [(String, String)] {
        [("all", L10n.t("全部语源")), ("拉丁", L10n.t("拉丁")), ("希腊", L10n.t("希腊")), ("希伯来", L10n.t("希伯来")),
         ("日耳曼", L10n.t("日耳曼")), ("古英", L10n.t("古英")), ("爱尔兰", L10n.t("爱尔兰")), ("威尔士", L10n.t("威尔士")),
         ("苏格兰", L10n.t("苏格兰")), ("法语", L10n.t("法语")), ("北欧", L10n.t("北欧")), ("意大利", L10n.t("意大利")),
         ("西班牙", L10n.t("西班牙")), ("斯拉夫", L10n.t("斯拉夫")), ("凯尔特", L10n.t("凯尔特")), ("波斯", L10n.t("波斯"))]
    }
    static var enEraLabel: [String: String] {
        ["ancient": L10n.t("古典"), "vintage": L10n.t("老派"), "mid": L10n.t("主流"),
         "modern": L10n.t("90后"), "now": L10n.t("当下")]
    }

    // MARK: - 卡片数据

    /// 是否去掉水印：由外部注入的 Pro 状态决定（model 不直接持有 ProStore，避免循环依赖）。
    var cardNoWatermark = false

    func cardDataZh(_ c: NameResult) -> NamingCardData {
        let p = profile
        let bazi = currentBazi()
        let answered = p?.hasAnswered ?? false
        let desc = answered ? engine.describe(p!) : ((bazi?.ok ?? false) ? (bazi?.summary ?? "") : "")
        return NamingCardData(surname: c.surname, chars: c.chars, given: c.given, full: c.full,
                              desc: desc,
                              radar: answered ? engine.radar(p!, c.vec) : nil,
                              bazi: (bazi?.ok ?? false) ? bazi : nil,
                              baziNote: (bazi?.ok ?? false) ? BaziEngine.explainName(c.chars, bazi!) : "",
                              answered: answered, enName: nil, mode: "zh",
                              watermark: !cardNoWatermark)
    }

    /* 英文名的卡片数据：两种模式只差一个标签，
     * 名字都是「名 + 姓」（姓填了才带），还会带上中文姓名做对照。 */
    func cardDataEn(_ it: NMEnName, mode: String = "en") -> NamingCardData {
        let p = ensureProfile()
        let sur = enSurname.trimmingCharacters(in: .whitespaces)
        /* 卡片上的中文名：如果这个英文名是**照着中文名取的**（中名西取 / 按性格配），
         * 就直接回填用户填的那个中文名（李慕白），而不是把英文名音译回去
         * （那会读成另一个名字，等于凭空多出一个中文名）。
         * 自选英文名不算 —— 那是自己挑的，跟中文输入框没关系。 */
        let zhRaw = enZhName.trimmingCharacters(in: .whitespaces)
        let useZh = (mode != "enStudio" && !zhRaw.isEmpty) ? zhRaw : nil
        let zhPy: String? = useZh.map { full in
            let s = surnameOfFull(full)
            let chars = Array(full.dropFirst(s.c.count)).map(String.init)
            return Pinyin.titleCase(Pinyin.name(s, chars))
        }
        return NamingCardData(surname: engine.defaultSurname(), chars: [], given: it.n,
                              full: enFullName(it.n),
                              desc: engine.describe(p), radar: engine.radar(p, NameVector(trait: it.tr, style: it.st, chars: [])),
                              bazi: nil, baziNote: "", answered: true, enName: it, mode: mode,
                              enSurname: sur.isEmpty ? nil : NMSurnameEn(n: sur, zh: enSurnameZh(sur), head: ""),
                              zhSource: useZh, zhSourcePy: zhPy,
                              watermark: !cardNoWatermark)
    }

    @MainActor
    func openCardZh(_ c: NameResult) {
        cardImage = NamingCardRenderer.render(cardDataZh(c))
    }

    @MainActor
    func openCardEn(_ it: NMEnName) {
        cardImage = NamingCardRenderer.render(cardDataEn(it, mode: enDetailMode))
    }
}
