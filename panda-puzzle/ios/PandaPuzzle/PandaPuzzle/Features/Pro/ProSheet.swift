import StoreKit
import SwiftUI

struct ProSheet: View {
    @Environment(ProStore.self) private var pro
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    Text("熊猫拼图 Pro")
                        .font(.system(size: 26, weight: .bold))
                        .foregroundStyle(PandaTheme.ink)
                    Text("一次买断，永久解锁。适合常拼照片、要多幅进度的人。")
                        .font(.system(size: 14))
                        .foregroundStyle(PandaTheme.muted)

                    VStack(spacing: 10) {
                        ForEach(ProFeature.allCases) { f in
                            HStack(alignment: .top, spacing: 12) {
                                Image(systemName: "checkmark.circle.fill")
                                    .foregroundStyle(PandaTheme.accentDeep)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(f.title)
                                        .font(.system(size: 15, weight: .semibold))
                                        .foregroundStyle(PandaTheme.ink)
                                    Text(f.blurb)
                                        .font(.system(size: 13))
                                        .foregroundStyle(PandaTheme.muted)
                                }
                                Spacer(minLength: 0)
                            }
                            .padding(12)
                            .background(PandaTheme.canvas.opacity(0.6), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                        }
                    }

                    if let err = pro.lastError {
                        Text(err)
                            .font(.system(size: 13))
                            .foregroundStyle(.red.opacity(0.9))
                    }

                    Button {
                        Task { await pro.purchase() }
                    } label: {
                        HStack {
                            Spacer()
                            if pro.purchasing {
                                ProgressView().tint(.white)
                            } else {
                                Text(pro.product?.displayPrice ?? "购买 Pro")
                                    .font(.system(size: 17, weight: .bold))
                            }
                            Spacer()
                        }
                        .padding(.vertical, 14)
                        .background(PandaTheme.accentGradient, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                        .foregroundStyle(.white)
                    }
                    .disabled(pro.purchasing || pro.product == nil)

                    Button("恢复购买") {
                        Task { await pro.restore() }
                    }
                    .font(.system(size: 15, weight: .semibold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
                    .foregroundStyle(PandaTheme.accent)

#if DEBUG
                    Button("调试：切换 Pro") {
                        pro.debugToggleUnlock()
                    }
                    .font(.system(size: 13))
                    .foregroundStyle(PandaTheme.muted)
#endif
                }
                .padding(20)
            }
            .background(PandaTheme.canvas.ignoresSafeArea())
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("关闭") { dismiss() }
                        .foregroundStyle(PandaTheme.accent)
                }
            }
        }
        .presentationDetents([.large])
    }
}
