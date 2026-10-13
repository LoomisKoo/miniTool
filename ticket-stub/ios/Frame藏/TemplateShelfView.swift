import SwiftUI

/// 货架筛选：全部 / 收藏 / 各分类
private enum ShelfFilter: Hashable {
    case all
    case favorites
    case category(TicketCategory)

    var title: String {
        switch self {
        case .all: AppLocalization.text("全部")
        case .favorites: AppLocalization.text("收藏")
        case .category(let category): category.displayTab
        }
    }

    var icon: String {
        switch self {
        case .all: "square.grid.2x2"
        case .favorites: "star.fill"
        case .category(let category): category.icon
        }
    }
}

struct TemplateShelfView: View {
    @Environment(TicketStore.self) private var store
    @Environment(ProStore.self) private var pro
    @Environment(TemplateLibrary.self) private var templates
    @Environment(TemplateThumbCache.self) private var thumbs
    @Environment(RootRouter.self) private var router
    @State private var filter: ShelfFilter = .category(.cinema)
    @State private var showPaywall = false
    @State private var selectedID: String?
    @State private var pendingTemplate: TicketTemplate?

    private var filters: [ShelfFilter] {
        [.all, .favorites] + TicketCategory.allCases.map { .category($0) }
    }

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 20) {
                content
            }
            .padding(.horizontal, 16)
            .padding(.top, 12)
            .padding(.bottom, 28)
        }
        .background(FrameTheme.bg.ignoresSafeArea())
        .foregroundStyle(FrameTheme.text)
        .toolbar(.hidden, for: .navigationBar)
        .safeAreaInset(edge: .top, spacing: 0) {
            filterBar
                .padding(.horizontal, 16)
                .padding(.top, 6)
                .padding(.bottom, 10)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background {
                    Rectangle()
                        .fill(.ultraThinMaterial)
                        .overlay(alignment: .bottom) {
                            FrameTheme.line.frame(height: 0.5)
                        }
                        .ignoresSafeArea(edges: .top)
                }
        }
        .sheet(isPresented: $showPaywall) {
            PaywallView()
        }
        .alert(
            AppLocalization.text("更换模板？"),
            isPresented: Binding(
                get: { pendingTemplate != nil },
                set: { if !$0 { pendingTemplate = nil } }
            )
        ) {
            Button(AppLocalization.text("取消"), role: .cancel) { pendingTemplate = nil }
            Button(AppLocalization.text("更换")) {
                if let template = pendingTemplate {
                    apply(template)
                }
                pendingTemplate = nil
            }
        } message: {
            Text(AppLocalization.text("将切换版式。标题、特效、背景和照片会尽量保留。"))
        }
        .onAppear {
            selectedID = store.template.id
            warmCurrentFilter()
        }
        .onChange(of: filter) { _, _ in
            warmCurrentFilter()
        }
    }

    private var filterBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(filters, id: \.self) { item in
                    let selected = item == filter
                    Button {
                        filter = item
                    } label: {
                        HStack(spacing: 5) {
                            Image(systemName: item.icon)
                                .font(.system(size: 11, weight: .semibold))
                            Text(item.title)
                                .font(.system(size: 13, weight: .semibold))
                        }
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .foregroundStyle(selected ? FrameTheme.onAccent : FrameTheme.textSecondary)
                        .background {
                            if selected {
                                Capsule().fill(FrameTheme.accentGradient)
                            } else {
                                Capsule().fill(FrameTheme.surface.opacity(0.72))
                            }
                        }
                        .overlay {
                            Capsule().strokeBorder(selected ? Color.clear : FrameTheme.line, lineWidth: 1)
                        }
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.vertical, 2)
        }
    }

    @ViewBuilder
    private var content: some View {
        switch filter {
        case .all:
            if !templates.recentTemplates.isEmpty {
                shelfSection(title: AppLocalization.text("最近使用"), icon: "clock", templates: templates.recentTemplates)
            }
            ForEach(TicketCategory.allCases) { category in
                let list = TicketCatalog.templates.filter { $0.category == category }
                if !list.isEmpty {
                    shelfSection(title: category.displayName, icon: category.icon, templates: list)
                }
            }
        case .favorites:
            let list = templates.favoriteTemplates
            if list.isEmpty {
                emptyFavorites
            } else {
                templateGrid(list)
            }
        case .category(let category):
            templateGrid(TicketCatalog.templates.filter { $0.category == category })
        }
    }

    private var emptyFavorites: some View {
        ContentUnavailableView(
            AppLocalization.text("还没有收藏模板"),
            systemImage: "star",
            description: Text(AppLocalization.text("点模板右上角的星标，方便下次快速找到"))
        )
        .padding(.top, 40)
        .frame(maxWidth: .infinity)
    }

    private func shelfSection(title: String, icon: String, templates: [TicketTemplate]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(FrameTheme.accent)
                Text(title)
                    .font(.system(size: 16, weight: .bold))
            }
            templateGrid(templates)
        }
    }

    private func templateGrid(_ list: [TicketTemplate]) -> some View {
        LazyVGrid(columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)], spacing: 12) {
            ForEach(list) { template in
                TemplateThumbCard(
                    template: template,
                    isSelected: selectedID == template.id,
                    isFavorite: templates.isFavorite(template.id),
                    onFavorite: { templates.toggleFavorite(template.id) },
                    onSelect: { select(template) }
                )
            }
        }
    }

    private func select(_ template: TicketTemplate) {
        if template.isPro && !pro.isPro {
            showPaywall = true
            return
        }
        // 同一模板：直接进入制作，不二次确认
        if template.id == store.template.id {
            templates.recordRecent(template.id)
            router.tab = .create
            return
        }
        pendingTemplate = template
    }

    private func apply(_ template: TicketTemplate) {
        selectedID = template.id
        store.select(template)
        templates.recordRecent(template.id)
        router.tab = .create
    }

    private func warmCurrentFilter() {
        let list: [TicketTemplate]
        switch filter {
        case .all:
            list = templates.recentTemplates + TicketCatalog.templates.filter { $0.category == .cinema }
        case .favorites:
            list = templates.favoriteTemplates
        case .category(let category):
            list = TicketCatalog.templates.filter { $0.category == category }
        }
        thumbs.prioritize(list)
    }
}

/// 缩略卡：优先显示缓存票根图；未就绪时用轻量占位，绝不在列表里挂活的 H5TicketView
struct TemplateThumbCard: View {
    let template: TicketTemplate
    var isSelected = false
    var isFavorite = false
    var showFavorite = true
    var height: CGFloat = 148
    var onFavorite: (() -> Void)?
    var onSelect: () -> Void

    @Environment(TemplateThumbCache.self) private var thumbs

    private var preview: UIImage? {
        let _ = thumbs.revision
        return thumbs.image(for: template.id)
    }

    var body: some View {
        ZStack {
            FrameTheme.thumbBackdrop

            if let preview {
                Image(uiImage: preview)
                    .resizable()
                    .scaledToFit()
                    .padding(10)
                    .shadow(color: .black.opacity(0.35), radius: 6, y: 3)
                    .transition(.opacity)
            } else {
                placeholder
            }

            VStack(alignment: .leading, spacing: 2) {
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
                    colors: [Color(hex: 0x0A0907, alpha: 0), Color(hex: 0x0A0907, alpha: 0.4), Color(hex: 0x0A0907, alpha: 0.82)],
                    startPoint: .top,
                    endPoint: .bottom
                )
            )
            .frame(maxHeight: .infinity, alignment: .bottom)
            .allowsHitTesting(false)

            HStack {
                if template.isPro {
                    Label("Pro", systemImage: "sparkles")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 7)
                        .padding(.vertical, 4)
                        .background(.black.opacity(0.45), in: Capsule())
                        .allowsHitTesting(false)
                }
                Spacer(minLength: 0)
                if showFavorite {
                    Button {
                        onFavorite?()
                    } label: {
                        Image(systemName: isFavorite ? "star.fill" : "star")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(isFavorite ? FrameTheme.accent : .white.opacity(0.9))
                            .frame(width: 28, height: 28)
                            .background(.black.opacity(0.45), in: Circle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(AppLocalization.text(isFavorite ? "取消收藏" : "收藏模板"))
                }
            }
            .padding(8)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        }
        .frame(maxWidth: .infinity)
        .frame(height: height)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(isSelected ? FrameTheme.accentLine : FrameTheme.line, lineWidth: isSelected ? 1.5 : 1)
        }
        .contentShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .onTapGesture(perform: onSelect)
        .accessibilityAddTraits(.isButton)
        .accessibilityLabel(template.displayName)
        .onAppear { thumbs.request(template) }
    }

    private var placeholder: some View {
        VStack(spacing: 8) {
            Image(systemName: template.category.icon)
                .font(.system(size: 22, weight: .medium))
                .foregroundStyle(FrameTheme.muted)
            Text(template.displayName)
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(FrameTheme.textSecondary)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(
            LinearGradient(
                colors: [FrameTheme.surface, FrameTheme.thumbBackdrop],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        )
    }
}
