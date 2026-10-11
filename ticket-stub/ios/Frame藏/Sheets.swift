import PhotosUI
import SwiftUI
import UIKit

struct SheetHeader: View {
    let eyebrow: String?
    let title: String
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        HStack(alignment: .bottom) {
            VStack(alignment: .leading, spacing: 3) {
                if let eyebrow {
                    Text(eyebrow.uppercased())
                        .font(.system(size: 10, weight: .bold, design: .monospaced))
                        .tracking(1.3)
                        .foregroundStyle(.secondary)
                }
                Text(title)
                    .font(.system(size: 24, weight: .bold, design: .serif))
            }
            Spacer()
            Button("完成") { dismiss() }
                .font(.system(size: 14, weight: .semibold))
        }
    }
}

struct TemplateSheet: View {
    @Environment(TicketStore.self) private var store
    @Environment(ProStore.self) private var pro
    @Environment(\.dismiss) private var dismiss
    @State private var showPaywall = false

    var body: some View {
        @Bindable var store = store
        NavigationStack {
            VStack(spacing: 0) {
                Picker("分类", selection: $store.category) {
                    ForEach(TicketCategory.allCases) { category in
                        Text(category.displayTab).tag(category)
                    }
                }
                .pickerStyle(.segmented)
                .padding(.horizontal, 20)
                .padding(.top, 12)
                .padding(.bottom, 10)
                .background(FrameTheme.panel)
                .onChange(of: store.category) { _, category in
                    if let first = TicketCatalog.templates.first(where: { $0.category == category }) {
                        store.select(first)
                    }
                }

                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                        ForEach(store.categoryTemplates) { template in
                            Button {
                                if template.isPro && !pro.isPro {
                                    showPaywall = true
                                    return
                                }
                                store.select(template)
                                dismiss()
                            } label: {
                                TemplatePreview(template: template)
                                    .foregroundStyle(.primary)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    }
                    .padding(20)
                }
            }
            .navigationTitle("票根模板")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button {
                        dismiss()
                    } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 12, weight: .bold))
                    }
                    .accessibilityLabel("关闭模板")
                }
            }
        }
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
        .presentationBackground(FrameTheme.panel)
        .sheet(isPresented: $showPaywall) {
            PaywallView()
        }
    }
}

private struct TemplatePreview: View {
    let template: TicketTemplate

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [FrameTheme.surface, FrameTheme.thumbBackdrop],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            GeometryReader { proxy in
                let size = template.size
                let scale = min(proxy.size.width / size.width, proxy.size.height / size.height) * 0.86
                H5TicketView()
                    .environment(\.ticket, TicketContext(template: template, fields: template.localizedDefaults))
                    .frame(width: size.width, height: size.height)
                    .scaleEffect(scale)
                    .shadow(color: .black.opacity(0.35), radius: 6 / max(scale, 0.01), y: 3 / max(scale, 0.01))
                    .frame(width: proxy.size.width, height: proxy.size.height)
                    .allowsHitTesting(false)
            }

            VStack(alignment: .leading, spacing: 1) {
                Text(template.displayName)
                    .font(.system(size: 12, weight: .semibold))
                    .lineLimit(1)
                Text(template.displayDetail)
                    .font(.system(size: 8))
                    .foregroundStyle(.white.opacity(0.72))
                    .lineLimit(1)
            }
            .foregroundStyle(.white)
            .padding(.horizontal, 9)
            .padding(.top, 22)
            .padding(.bottom, 8)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                LinearGradient(
                    colors: [Color(hex: 0x0A0907, alpha: 0), Color(hex: 0x0A0907, alpha: 0.34), Color(hex: 0x0A0907, alpha: 0.74)],
                    startPoint: .top,
                    endPoint: .bottom
                )
            )
            .frame(maxHeight: .infinity, alignment: .bottom)

            if template.isPro {
                Label("Pro", systemImage: "sparkles")
                    .font(.system(size: 9, weight: .bold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 7)
                    .padding(.vertical, 4)
                    .background(.black.opacity(0.38), in: Capsule())
                    .padding(8)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
            }
        }
        .frame(maxWidth: .infinity)
        .frame(height: 126)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(FrameTheme.line, lineWidth: 1)
        }
    }
}

private struct TicketField: View {
    let label: String
    let placeholder: String
    @Binding var text: String

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(FrameTheme.textSecondary)
            TextField(placeholder, text: $text)
                .textFieldStyle(.plain)
                .font(.system(size: 15))
                .padding(.horizontal, 12)
                .padding(.vertical, 12)
                .background(FrameTheme.surface, in: RoundedRectangle(cornerRadius: 11, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: 11, style: .continuous)
                        .stroke(FrameTheme.line, lineWidth: 1)
                }
        }
    }
}

struct FieldsSheet: View {
    @Environment(TicketStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    private func binding(for key: String) -> Binding<String> {
        Binding(
            get: {
                let raw: String
                switch key {
                case "title": raw = store.fields.title
                case "place": raw = store.fields.place
                case "date": raw = store.fields.date
                case "seat": raw = store.fields.seat
                default: raw = store.fields.mood
                }
                return AppLocalization.fieldText(raw)
            },
            set: { value in
                switch key {
                case "title": store.fields.title = value
                case "place": store.fields.place = value
                case "date": store.fields.date = value
                case "seat": store.fields.seat = value
                default: store.fields.mood = value
                }
            }
        )
    }

    var body: some View {
        @Bindable var store = store
        NavigationStack {
            VStack(spacing: 0) {
                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
                        VStack(spacing: 12) {
                            ForEach(store.template.fields, id: \.key) { field in
                                TicketField(label: field.displayLabel, placeholder: AppLocalization.text(field.value), text: binding(for: field.key))
                            }
                        }
                    .padding(.top, 2)
                }
                .padding(.horizontal, 20)
                .padding(.bottom, 24)
            }
            }
            .scrollIndicators(.hidden)
            .navigationTitle("票面信息")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        dismiss()
                    } label: {
                        Image(systemName: "xmark")
                    }
                    .accessibilityLabel("关闭")
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        .presentationBackground(FrameTheme.panel)
    }
}

struct PhotoAdjustSheet: View {
    @Environment(TicketStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @GestureState private var pinchScale: CGFloat = 1

    var body: some View {
        NavigationStack {
            VStack(spacing: 18) {
                if let data = store.selectedPhotoData, let uiImage = UIImage(data: data) {
                    Image(uiImage: uiImage)
                        .resizable()
                        .scaledToFill()
                        .scaleEffect(store.photoScale * pinchScale)
                        .offset(store.photoOffset)
                        .frame(maxWidth: .infinity)
                        .frame(height: 250)
                        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                        .gesture(
                            MagnificationGesture()
                                .updating($pinchScale) { value, state, _ in state = value }
                                .onEnded { value in
                                    store.photoScale = min(2.6, max(1, store.photoScale * value))
                                }
                        )
                        .simultaneousGesture(
                            DragGesture()
                                .onChanged { value in store.photoOffset = value.translation }
                        )
                }

                HStack {
                    Text("缩放")
                    Slider(value: Binding(
                        get: { store.photoScale },
                        set: { store.photoScale = min(2.6, max(1, $0)) }
                    ), in: 1...2.6)
                    Text(String(format: "%.1f×", store.photoScale))
                        .font(.caption.monospacedDigit())
                        .frame(width: 34)
                }
                Text("拖动平移，双指捏合缩放")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .padding(20)
            .navigationTitle("调整构图")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("完成") { dismiss() }
                }
            }
        }
        .presentationDetents([.medium])
        .presentationDragIndicator(.visible)
        .presentationBackground(FrameTheme.panel)
    }
}

struct EffectsSheet: View {
    @Environment(TicketStore.self) private var store
    @Environment(ProStore.self) private var pro
    @Environment(\.dismiss) private var dismiss
    @State private var selectedTab = 0
    @State private var selectedEffect: TicketEffect?
    @State private var showPaywall = false
    private let tabs = ["纹理", "图案", "印章", "文字", "光效", "纸感"]

    private func tap(_ effect: TicketEffect) {
        if !store.effects.contains(effect) {
            store.toggle(effect)
            selectedEffect = effect
        } else if selectedEffect != effect {
            selectedEffect = effect
        } else {
            store.toggle(effect)
            selectedEffect = nil
        }
    }

    private func focus(_ effect: TicketEffect, proxy: ScrollViewProxy) {
        withAnimation(.snappy) {
            selectedTab = tabs.firstIndex(of: effect.tab) ?? selectedTab
            selectedEffect = effect
        }
        DispatchQueue.main.async {
            withAnimation(.snappy) { proxy.scrollTo(effect.id, anchor: .center) }
        }
    }

    var body: some View {
        NavigationStack {
            ScrollViewReader { scrollProxy in
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    VStack(spacing: 0) {
                        TicketCardView()
                            .environment(store)
                            .frame(width: 150, height: 190)
                            .scaleEffect(0.78)
                            .frame(maxWidth: .infinity)
                            .padding(.top, 14)
                            .padding(.bottom, 12)
                        Text("点素材添加并调节；再点一次选中的素材移除；点「已用」标签可切回调整")
                            .font(.system(size: 11))
                            .foregroundStyle(.secondary)
                            .padding(.bottom, 12)
                    }
                    .background(FrameTheme.surface, in: RoundedRectangle(cornerRadius: 20, style: .continuous))

                    Picker("特效分类", selection: $selectedTab) {
                        ForEach(Array(tabs.enumerated()), id: \.offset) { index, tab in
                            Text(AppLocalization.text(tab)).tag(index)
                        }
                    }
                    .pickerStyle(.segmented)
                    if tabs[selectedTab] == "纸感" {
                        Text("纸感会改变票根的材质呈现：平面、哑光、亮面或 3D 纸张。")
                            .font(.system(size: 11))
                            .foregroundStyle(.secondary)
                    }

                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                        ForEach(TicketCatalog.effects.filter { $0.tab == tabs[selectedTab] }) { effect in
                            let isFocused = selectedEffect == effect && store.effects.contains(effect)
                            Button {
                                if effect.isPro && !pro.isPro {
                                    showPaywall = true
                                } else {
                                    tap(effect)
                                }
                            } label: {
                                VStack(spacing: 9) {
                                    EffectThumb(effect: effect)
                                        .frame(height: 74)
                                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                                        .overlay {
                                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                                .strokeBorder(isFocused ? effectAccent : FrameTheme.line, lineWidth: isFocused ? 2.5 : 1)
                                        }
                                        .overlay(alignment: .topTrailing) {
                                            if effect.isPro && !pro.isPro {
                                                Image(systemName: "lock.fill")
                                                    .font(.system(size: 10, weight: .bold))
                                                    .foregroundStyle(.white)
                                                    .frame(width: 20, height: 20)
                                                    .background(.black.opacity(0.6), in: Circle())
                                                    .padding(6)
                                            } else if store.effects.contains(effect) {
                                                Image(systemName: "checkmark")
                                                    .font(.system(size: 10, weight: .bold))
                                                    .foregroundStyle(.black)
                                                    .frame(width: 20, height: 20)
                                                    .background(.white, in: Circle())
                                                    .padding(6)
                                            }
                                        }
                                    Text(effect.displayName)
                                        .font(.system(size: 11, weight: isFocused ? .semibold : .medium))
                                        .foregroundStyle(isFocused ? effectAccent : .primary)
                                        .lineLimit(1)
                                }
                                .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                            .foregroundStyle(.primary)
                            .id(effect.id)
                        }
                    }

                    if let effect = selectedEffect, store.effects.contains(effect), effect.tab == tabs[selectedTab] {
                        EffectControls(effect: effect)
                            .overlay {
                                RoundedRectangle(cornerRadius: 16, style: .continuous)
                                    .strokeBorder(effectAccent.opacity(0.55), lineWidth: 1)
                            }
                    }

                    HStack {
                        Text("已用")
                            .font(.system(size: 12, weight: .semibold))
                        Spacer()
                        Button("清空") {
                            store.effects.removeAll()
                            selectedEffect = nil
                        }
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(.secondary)
                    }
                    if store.effects.isEmpty {
                        Text("点素材预览，或点已用项调整")
                            .font(.system(size: 12))
                            .foregroundStyle(.secondary)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    } else {
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 8) {
                                ForEach(store.effects) { effect in
                                    let isFocused = selectedEffect == effect
                                    Button {
                                        focus(effect, proxy: scrollProxy)
                                    } label: {
                                        Label(effect.displayName, systemImage: effect.symbol)
                                            .font(.system(size: 11, weight: isFocused ? .semibold : .medium))
                                            .foregroundStyle(isFocused ? effectAccent : .primary)
                                            .padding(.horizontal, 10)
                                            .padding(.vertical, 8)
                                            .background(isFocused ? FrameTheme.accentDim : FrameTheme.surfaceInset, in: Capsule())
                                            .overlay(Capsule().strokeBorder(isFocused ? effectAccent : .clear, lineWidth: 1.5))
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                        }
                    }
                }
                .padding(20)
            }
            }
            .navigationTitle("票根特效")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        dismiss()
                    } label: {
                        Image(systemName: "xmark")
                    }
                }
            }
        }
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
        .presentationBackground(FrameTheme.panel)
        .sheet(isPresented: $showPaywall) {
            PaywallView()
        }
    }
}

private let effectAccent = FrameTheme.accent

/// 特效格子预览：在固定画布上渲染真实特效后缩放填满格子
private struct EffectThumb: View {
    let effect: TicketEffect
    private let canvas = CGSize(width: 210, height: 150)

    var body: some View {
        GeometryReader { proxy in
            // 缩略图必须完整容纳画布；使用 max 会让上下内容溢出并被卡片裁掉
            let scale = min(proxy.size.width / canvas.width, proxy.size.height / canvas.height) * 0.82
            ZStack {
                LinearGradient(
                    colors: [effect.tint.background.opacity(0.85), FrameTheme.thumbBackdrop],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                .frame(maxWidth: .infinity, maxHeight: .infinity)

                ZStack {
                    EffectVisualOverlay(
                        effectID: effect.id,
                        settings: EffectSettings(opacity: 0.95, positionX: 50, positionY: 50, color: effect.tint),
                        isPreview: true
                    )
                    if effect.tab == "纸感" {
                        Image(systemName: effect.symbol)
                            .font(.system(size: 34, weight: .light))
                            .foregroundStyle(effect.tint.foreground)
                    }
                }
                .frame(width: canvas.width, height: canvas.height)
                .scaleEffect(scale)
            }
            .frame(width: proxy.size.width, height: proxy.size.height)
        }
        .allowsHitTesting(false)
    }
}

private struct EffectControls: View {
    @Environment(TicketStore.self) private var store
    let effect: TicketEffect
    private let palette: [ColorToken] = [.ink, .cream, .sunset, .amber, .ocean, .moss, .plum, .neon]

    private var settings: EffectSettings {
        store.settings(for: effect)
    }

    private func update(_ change: (inout EffectSettings) -> Void) {
        var next = settings
        change(&next)
        store.effectSettings[effect.id] = next
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Text(effect.displayName).font(.system(size: 14, weight: .semibold))
                Spacer()
                Text(effect.displayHint).font(.caption).foregroundStyle(.secondary)
            }
            VStack(alignment: .leading, spacing: 8) {
                Text("作用范围")
                    .font(.system(size: 12, weight: .semibold))
                HStack(spacing: 7) {
                    ForEach(EffectScope.allCases) { scope in
                        Button {
                            update { $0.target = scope }
                        } label: {
                            Text(AppLocalization.text(scope.rawValue))
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundStyle(settings.resolvedTarget == scope ? FrameTheme.onAccent : FrameTheme.textSecondary)
                                .padding(.horizontal, 10)
                                .padding(.vertical, 7)
                                .background(
                                    settings.resolvedTarget == scope ? FrameTheme.accent : FrameTheme.surfaceInset,
                                    in: Capsule()
                                )
                        }
                        .buttonStyle(.plain)
                    }
                }
                Text(AppLocalization.text(settings.resolvedTarget.hint))
                    .font(.system(size: 11))
                    .foregroundStyle(FrameTheme.muted)
            }
            if effect.id == "txt-custom" || effect.id == "stp-custom" {
                TextField(
                    AppLocalization.text(effect.id == "txt-custom" ? "输入文字" : "输入印章文字"),
                    text: Binding(
                        get: { settings.customText ?? (effect.id == "txt-custom" ? "记忆" : "MEMENTO") },
                        set: { value in update { $0.customText = value } }
                    )
                )
                .textFieldStyle(.roundedBorder)
            }
            HStack {
                Text("浓淡")
                Slider(value: Binding(
                    get: { settings.opacity },
                    set: { value in update { $0.opacity = value } }
                ), in: 0...1)
                Text("\(Int(settings.opacity * 100))%")
                    .font(.caption.monospacedDigit())
                    .frame(width: 38)
            }
            if effect.tab == "纹理" || effect.tab == "图案" || effect.tab == "光效" {
                HStack {
                    Text(effect.id == "lit-vignette" ? "范围" : "密度")
                    Slider(value: Binding(
                        get: { settings.density },
                        set: { value in update { $0.density = value } }
                    ), in: 0.1...1)
                }
            }
            if effect.tab == "印章" || effect.tab == "文字" {
                HStack {
                    Text("位置")
                    Slider(value: Binding(
                        get: { settings.positionX },
                        set: { value in update { $0.positionX = value } }
                    ), in: 10...90)
                }
            }
            HStack(spacing: 8) {
                Text("颜色")
                ForEach(palette, id: \.rawValue) { color in
                    Button {
                        update { $0.color = color }
                    } label: {
                        Circle()
                            .fill(color.background)
                            .frame(width: 22, height: 22)
                            .overlay(Circle().stroke(settings.color == color ? FrameTheme.accent : .clear, lineWidth: 2))
                    }
                }
            }
        }
        .font(.system(size: 12, weight: .medium))
        .padding(14)
        .background(FrameTheme.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .tint(FrameTheme.accent)
    }
}

struct StageSheet: View {
    @Environment(TicketStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var backgroundItem: PhotosPickerItem?

    private let colors: [ColorToken] = [.ink, .cream, .ocean, .sunset, .moss, .plum, .amber, .neon]

    private var backgroundImage: UIImage? {
        guard let data = store.stageBackgroundData else { return nil }
        return UIImage(data: data)
    }

    /// 与编辑页画板一致：票根尺寸四周各留 10% 长边的边距。
    private var boardAspectRatio: CGFloat {
        let ticket = store.template.size
        let pad = max(ticket.width, ticket.height) * 0.1
        return (ticket.width + pad * 2) / (ticket.height + pad * 2)
    }

    var body: some View {
        @Bindable var store = store
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Text("选择一块适合票根的底色，或使用自己的照片。")
                        .font(.system(size: 13))
                        .foregroundStyle(FrameTheme.muted)

                    HStack(spacing: 10) {
                        Text("底色")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(FrameTheme.textSecondary)
                        Spacer()
                        Circle()
                            .fill(store.background.background)
                            .frame(width: 18, height: 18)
                            .overlay(Circle().strokeBorder(FrameTheme.lineStrong, lineWidth: 1))
                        Picker("底色", selection: $store.background) {
                            ForEach(colors, id: \.rawValue) { color in
                                Text(color.displayName).tag(color)
                            }
                        }
                        .pickerStyle(.menu)
                        .labelsHidden()
                        .tint(FrameTheme.accent)
                    }
                    .padding(16)
                    .background(FrameTheme.surface, in: RoundedRectangle(cornerRadius: 20, style: .continuous))

                    VStack(spacing: 14) {
                        let hasBackgroundImage = store.stageBackgroundData != nil
                        let previewImage = backgroundImage
                        let previewOpacity = store.stageOpacity
                        let previewRatio = boardAspectRatio

                        HStack {
                            Label("背景图片", systemImage: "photo.on.rectangle.angled")
                                .font(.system(size: 13, weight: .semibold))
                            Spacer()
                        }

                        PhotosPicker(selection: $backgroundItem, matching: .images) {
                            Color.clear
                                .aspectRatio(previewRatio, contentMode: .fit)
                                .frame(maxWidth: .infinity)
                                .background(FrameTheme.bg)
                                .overlay {
                                    if let image = previewImage {
                                        Image(uiImage: image)
                                            .resizable()
                                            .scaledToFill()
                                            .opacity(previewOpacity)
                                    } else {
                                        VStack(spacing: 8) {
                                            Image(systemName: "plus")
                                                .font(.system(size: 26, weight: .medium))
                                            Text("选择图片")
                                                .font(.system(size: 12, weight: .medium))
                                        }
                                        .foregroundStyle(FrameTheme.accent)
                                    }
                                }
                                .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                            .overlay {
                                RoundedRectangle(cornerRadius: 18, style: .continuous)
                                    .strokeBorder(
                                        hasBackgroundImage ? FrameTheme.line : FrameTheme.accentLine,
                                        style: StrokeStyle(
                                            lineWidth: 1,
                                            dash: hasBackgroundImage ? [] : [6, 5]
                                        )
                                    )
                            }
                        }
                        .buttonStyle(.plain)
                        .overlay(alignment: .topTrailing) {
                            if hasBackgroundImage {
                                Button {
                                    store.stageBackgroundData = nil
                                    backgroundItem = nil
                                } label: {
                                    Image(systemName: "xmark")
                                        .font(.system(size: 13, weight: .semibold))
                                        .foregroundStyle(.white)
                                        .frame(width: 32, height: 32)
                                        .circleGlass()
                                }
                                .buttonStyle(.plain)
                                .padding(10)
                                .accessibilityLabel("移除背景图")
                            }
                        }

                        VStack(alignment: .leading, spacing: 8) {
                            HStack {
                                Text("透明度")
                                    .font(.system(size: 12, weight: .medium))
                                    .foregroundStyle(FrameTheme.textSecondary)
                                Spacer()
                                Text("\(Int(previewOpacity * 100))%")
                                    .font(.system(size: 12, weight: .semibold).monospacedDigit())
                                    .foregroundStyle(FrameTheme.accent)
                            }
                            Slider(value: $store.stageOpacity, in: 0.2...1)
                                .disabled(!hasBackgroundImage)
                                .opacity(hasBackgroundImage ? 1 : 0.4)
                        }
                    }
                    .padding(16)
                    .background(FrameTheme.surface, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
                }
                .padding(20)
            }
            .scrollIndicators(.hidden)
            .background(FrameTheme.bg)
            .tint(FrameTheme.accent)
            .navigationTitle("画板背景")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) { Button("完成") { dismiss() } }
            }
        }
        .onChange(of: backgroundItem) { _, item in
            guard let item else { return }
            Task {
                if let data = try? await item.loadTransferable(type: Data.self) {
                    await MainActor.run { store.stageBackgroundData = data }
                }
            }
        }
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
        .presentationBackground(FrameTheme.panel)
    }
}

private extension View {
    @ViewBuilder
    func circleGlass() -> some View {
        if #available(iOS 26.0, *) {
            self.glassEffect(.regular.interactive(), in: Circle())
        } else {
            self.background(.ultraThinMaterial, in: Circle())
        }
    }
}

