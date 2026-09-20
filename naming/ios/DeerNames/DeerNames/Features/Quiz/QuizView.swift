import SwiftUI

/* 性格测试 —— 对应 app.js 的 renderQuiz + dockFor('quiz')。 */

struct QuizView: View {
    @Environment(NamingAppModel.self) private var model

    private var questions: [NMQuestion] { NameEngine.shared.data.questions }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                if model.qi < questions.count {
                    let q = questions[model.qi]

                    HStack {
                        HStack(spacing: 5) {
                            ForEach(Array(questions.indices), id: \.self) { i in
                                Capsule()
                                    .fill(i < model.qi ? NamingTheme.primary
                                          : (i == model.qi ? NamingTheme.primaryDeep : NamingTheme.hairline))
                                    .frame(width: i == model.qi ? 16 : 7, height: 7)
                            }
                        }
                        Spacer()
                        Text("\(model.qi + 1) / \(questions.count)")
                            .font(.system(size: 13))
                            .foregroundStyle(NamingTheme.muted)
                    }

                    /* 题干与选项是题库内容（数据），英文界面下查 engine-en.json，缺条目回退中文。 */
                    Text(L10n.d("quiz", q.id, "text", q.text))
                        .font(.system(size: 21, weight: .semibold))
                        .foregroundStyle(NamingTheme.ink)
                        .fixedSize(horizontal: false, vertical: true)

                    VStack(spacing: 10) {
                        ForEach(Array(q.options.enumerated()), id: \.offset) { index, opt in
                            Button {
                                model.answer(index)
                            } label: {
                                HStack(alignment: .top, spacing: 12) {
                                    Text(String(UnicodeScalar(UInt8(65 + index))))
                                        .font(.system(size: 14, weight: .semibold))
                                        .foregroundStyle(NamingTheme.primaryDeep)
                                        .frame(width: 26, height: 26)
                                        .background(NamingTheme.primary.opacity(0.12), in: Circle())
                                    Text(L10n.dOption(q.id, index, opt.text))
                                        .font(.system(size: 15.5))
                                        .foregroundStyle(NamingTheme.ink)
                                        .multilineTextAlignment(.leading)
                                        .fixedSize(horizontal: false, vertical: true)
                                    Spacer(minLength: 0)
                                }
                                .padding(14)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .background(NamingTheme.canvas, in: RoundedRectangle(cornerRadius: NamingRadius.medium, style: .continuous))
                                .overlay {
                                    RoundedRectangle(cornerRadius: NamingRadius.medium, style: .continuous)
                                        .strokeBorder(NamingTheme.hairline, lineWidth: 1)
                                }
                            }
                            .buttonStyle(.plain)
                        }
                    }

                    if model.qi > 0 {
                        GhostButton(title: L10n.t("上一题")) { model.backQuestion() }
                    }
                }
            }
            .padding(20)
        }
        .namingPageBackground()
        .navigationTitle(L10n.t("性格测试"))
        .navigationBarTitleDisplayMode(.inline)
        .safeAreaInset(edge: .bottom) {
            HStack(spacing: 10) {
                Text(L10n.t("取名偏向"))
                    .font(.system(size: 13))
                    .foregroundStyle(NamingTheme.muted)
                ForEach([("u", L10n.t("不限")), ("f", L10n.t("女生")), ("m", L10n.t("男生"))], id: \.0) { g in
                    ChipButton(text: g.1, active: model.wantGender == g.0) {
                        model.wantGender = g.0
                    }
                }
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 10)
            .background(.regularMaterial)
        }
    }
}
