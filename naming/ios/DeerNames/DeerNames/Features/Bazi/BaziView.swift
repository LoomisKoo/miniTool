import SwiftUI

/* 生辰起名 —— 对应 app.js 的 renderBazi + finishBazi。
 * 页面上不摆滚轮，年/月/日和时辰都是可点的字段，点开才弹原生 picker。 */

struct BaziView: View {
    @Environment(NamingAppModel.self) private var model
    @State private var picker: BaziPickerKind?
    @State private var draft = BaziForm()

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                NamingCard {
                    CardTitleRow(L10n.t("公历生日"))
                    HintText(text: L10n.t("本地排盘，年柱以立春为界。时辰不清楚可留空。"))
                        .padding(.bottom, 12)

                    fieldButton(value: birthdayText,
                                action: { openPicker(.date) })

                    Text(L10n.t("时辰"))
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(NamingTheme.ink)
                        .padding(.top, 14)

                    Button {
                        openPicker(.hour)
                    } label: {
                        HStack {
                            Text(hourTitle)
                                .font(.system(size: 17, weight: .semibold))
                                .foregroundStyle(NamingTheme.ink)
                            Spacer(minLength: 0)
                            Text(hourSubtitle)
                                .font(.system(size: 13))
                                .foregroundStyle(NamingTheme.muted)
                            Image(systemName: "chevron.up.chevron.down")
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundStyle(NamingTheme.muted)
                        }
                        .padding(.horizontal, 14)
                        .padding(.vertical, 14)
                        .background(NamingTheme.background, in: RoundedRectangle(cornerRadius: NamingRadius.small, style: .continuous))
                        .overlay {
                            RoundedRectangle(cornerRadius: NamingRadius.small, style: .continuous)
                                .strokeBorder(NamingTheme.hairline, lineWidth: 1)
                        }
                    }
                    .buttonStyle(.plain)
                    .padding(.top, 8)

                    Text(L10n.t("取名偏向"))
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(NamingTheme.ink)
                        .padding(.top, 14)
                    HStack(spacing: 10) {
                        ForEach([("u", L10n.t("不限")), ("f", L10n.t("女生")), ("m", L10n.t("男生"))], id: \.0) { g in
                            ChipButton(text: g.1, active: model.wantGender == g.0) {
                                model.wantGender = g.0
                            }
                        }
                        Spacer(minLength: 0)
                    }
                    .padding(.top, 8)
                }

                let info = BaziEngine.fromSolar(model.baziForm.y, model.baziForm.m, model.baziForm.d, model.baziForm.hour)
                if info.ok {
                    NamingCard {
                        CardTitleRow(L10n.t("预览"))
                        Text(info.pillarStr)
                            .font(.system(size: 22, weight: .semibold))
                            .foregroundStyle(NamingTheme.primaryDeep)
                            .padding(.bottom, 8)
                        Text(info.summary)
                            .font(.system(size: 14))
                            .foregroundStyle(NamingTheme.ink)
                            .fixedSize(horizontal: false, vertical: true)
                        Text(BaziEngine.lunarText(info.lunar))
                            .font(.system(size: 12))
                            .foregroundStyle(NamingTheme.muted)
                            .padding(.top, 6)
                    }
                }
            }
            .padding(20)
        }
        .namingPageBackground()
        .navigationTitle(L10n.t("生辰起名"))
        .navigationBarTitleDisplayMode(.inline)
        .safeAreaInset(edge: .bottom) {
            DockPrimaryButton(title: L10n.t("按生辰取名")) { model.finishBazi() }
                .padding(.horizontal, 20)
                .padding(.vertical, 10)
                .background(.regularMaterial)
        }
        .sheet(item: $picker) { kind in
            BaziPickerSheet(kind: kind, draft: $draft) { commit() }
        }
    }

    // MARK: - 字段

    private func fieldButton(value: String, unit: String? = nil, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Text(value)
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(NamingTheme.ink)
                if let unit {
                    Text(unit)
                        .font(.system(size: 13))
                        .foregroundStyle(NamingTheme.muted)
                }
                Spacer(minLength: 0)
                Image(systemName: "chevron.up.chevron.down")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(NamingTheme.muted)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 14)
            .background(NamingTheme.background, in: RoundedRectangle(cornerRadius: NamingRadius.small, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: NamingRadius.small, style: .continuous)
                    .strokeBorder(NamingTheme.hairline, lineWidth: 1)
            }
        }
        .buttonStyle(.plain)
        .padding(.top, 8)
    }

    private var hourTitle: String {
        model.baziForm.hour < 0 ? L10n.t("时辰未知")
            : String(BaziEngine.hourLabel(model.baziForm.hour).split(separator: "·").first ?? "")
                .trimmingCharacters(in: .whitespaces)
    }

    private var hourSubtitle: String {
        model.baziForm.hour < 0 ? L10n.t("不清楚可跳过")
            : String(BaziEngine.hourLabel(model.baziForm.hour).split(separator: "·").last ?? "")
                .trimmingCharacters(in: .whitespaces)
    }

    private var birthdayText: String {
        L10n.f("%@ 年 %@ 月 %@ 日",
               "\(model.baziForm.y)", "\(model.baziForm.m)", "\(min(model.baziForm.d, daysInFormMonth))")
    }

    private var daysInFormMonth: Int {
        Self.daysInMonth(model.baziForm.y, model.baziForm.m)
    }

    private func openPicker(_ kind: BaziPickerKind) {
        draft = model.baziForm
        picker = kind
    }

    private func commit() {
        model.baziForm = draft
        let maxD = Self.daysInMonth(draft.y, draft.m)
        if model.baziForm.d > maxD { model.baziForm.d = maxD }
        picker = nil
        model.schedulePersist()
    }

    static let hourValues = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22]

    /* 日期选择器要 Date，八字算的是年月日，所以统一用当天正午构造，
     * 避免夏令时把午夜挪到前一天。 */
    static let gregorian: Calendar = {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = .current
        return c
    }()

    static func dateValue(_ y: Int, _ m: Int, _ d: Int) -> Date {
        var comps = DateComponents()
        comps.year = y
        comps.month = m
        comps.day = min(max(d, 1), daysInMonth(y, m))
        comps.hour = 12
        return gregorian.date(from: comps) ?? Date()
    }

    static let dateRange: ClosedRange<Date> = dateValue(1900, 1, 1)...dateValue(2100, 12, 31)

    static func daysInMonth(_ y: Int, _ m: Int) -> Int {
        var components = DateComponents()
        components.year = y
        components.month = m
        let calendar = Calendar(identifier: .gregorian)
        guard let date = calendar.date(from: components),
              let range = calendar.range(of: .day, in: .month, for: date) else { return 30 }
        return range.count
    }
}

enum BaziPickerKind: String, Identifiable {
    case date, hour
    var id: String { rawValue }
}

/* 点开才出现的原生 picker：日期是三列滚轮，时辰是一列。 */
struct BaziPickerSheet: View {
    let kind: BaziPickerKind
    @Binding var draft: BaziForm
    var onDone: () -> Void

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                if kind == .date {
                    // 年月日合成一个系统日期选择器，不再拆成三列
                    DatePicker("", selection: dateBinding, in: BaziView.dateRange,
                               displayedComponents: .date)
                        .datePickerStyle(.wheel)
                        .labelsHidden()
                        .frame(maxWidth: .infinity)
                        .frame(height: 216)
                        .clipped()
                } else {
                    /* 十二时辰的名称是传统文化内容（数据），保持中文。 */
                    wheel(selection: hourBinding, width: 280) {
                        Text(L10n.t("时辰未知")).tag(-1)
                        ForEach(Array(BaziView.hourValues.enumerated()), id: \.offset) { i, h in
                            Text(NameEngine.shared.data.baziHours[i]).tag(h)
                        }
                    }
                    .frame(height: 216)
                    .clipped()
                }
                Spacer(minLength: 0)
            }
            .padding(.top, 8)
            .navigationTitle(kind == .date ? L10n.t("选择生日") : L10n.t("选择时辰"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(L10n.t("取消")) { onCancel() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(L10n.t("完成")) { onDone() }
                }
            }
        }
        .presentationDetents([.height(320)])
    }

    @Environment(\.dismiss) private var dismiss

    private func onCancel() { dismiss() }

    private var dateBinding: Binding<Date> {
        Binding(get: {
            BaziView.dateValue(draft.y, draft.m, draft.d)
        }, set: { newDate in
            let c = BaziView.gregorian.dateComponents([.year, .month, .day], from: newDate)
            if let y = c.year { draft.y = y }
            if let m = c.month { draft.m = m }
            if let d = c.day { draft.d = d }
        })
    }

    private var hourBinding: Binding<Int> {
        Binding(get: { draft.hour }, set: { draft.hour = $0 })
    }

    private func wheel<Content: View>(selection: Binding<Int>, width: CGFloat,
                                      @ViewBuilder content: () -> Content) -> some View {
        Picker("", selection: selection, content: content)
            .pickerStyle(.wheel)
            .labelsHidden()
            .frame(width: width)
    }
}
