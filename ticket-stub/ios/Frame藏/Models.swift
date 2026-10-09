import Foundation
import Observation
import SwiftUI

enum TicketCategory: String, CaseIterable, Identifiable, Codable {
    case cinema = "电影票"
    case travel = "旅行通票"
    case concert = "演唱会票"
    case wander = "漫游"
    case stamp = "邮票"

    var id: String { rawValue }
    var tab: String {
        switch self {
        case .cinema: "电影"
        case .travel: "旅行"
        case .concert: "演唱会"
        case .wander: "漫游"
        case .stamp: "邮票"
        }
    }
    var icon: String {
        switch self {
        case .cinema: "film"
        case .travel: "airplane"
        case .concert: "music.mic"
        case .wander: "mappin.and.ellipse"
        case .stamp: "seal"
        }
    }
    var artworkName: String {
        switch self {
        case .cinema: "DefaultCinemaArtwork"
        case .travel: "DefaultTravelArtwork"
        case .concert: "DefaultConcertArtwork"
        case .wander: "DefaultCityArtwork"
        case .stamp: "DefaultStampArtwork"
        }
    }
}

struct TemplateField: Codable, Hashable {
    let key: String
    let label: String
    let value: String

    init(_ key: String, _ label: String, _ value: String) {
        self.key = key
        self.label = label
        self.value = value
    }
}

struct TicketTemplate: Identifiable, Codable {
    let id: String
    let name: String
    let detail: String
    let category: TicketCategory
    let size: CGSize
    let fields: [TemplateField]
    let photoSlots: Int
    let isPro: Bool

    var defaults: TicketFields {
        var result = TicketFields(title: "", place: "", date: "", seat: "", mood: "")
        for field in fields {
            switch field.key {
            case "title": result.title = field.value
            case "place": result.place = field.value
            case "date": result.date = field.value
            case "seat": result.seat = field.value
            case "mood": result.mood = field.value
            default: break
            }
        }
        return result
    }
}

struct TicketFields: Equatable, Codable {
    var title = "光影留声"
    var place = "上海影城 · SHO"
    var date = "2026.02.14  19:30"
    var seat = "5排 08座"
    var mood = "黑白的画面，反而更吵"
}

enum ColorToken: String, Codable {
    case ink, cream, ocean, sunset, moss, plum, amber, neon

    var background: Color {
        switch self {
        case .ink: .init(red: 0.10, green: 0.10, blue: 0.11)
        case .cream: .init(red: 0.91, green: 0.86, blue: 0.76)
        case .ocean: .init(red: 0.08, green: 0.20, blue: 0.29)
        case .sunset: .init(red: 0.56, green: 0.22, blue: 0.18)
        case .moss: .init(red: 0.18, green: 0.27, blue: 0.19)
        case .plum: .init(red: 0.30, green: 0.12, blue: 0.27)
        case .amber: .init(red: 0.61, green: 0.36, blue: 0.10)
        case .neon: .init(red: 0.25, green: 0.08, blue: 0.37)
        }
    }

    var foreground: Color {
        switch self {
        case .cream, .amber: .black.opacity(0.82)
        default: .white
        }
    }
}

struct TicketEffect: Identifiable, Hashable, Codable {
    let id: String
    let name: String
    let symbol: String
    let tint: ColorToken
    let tab: String
    let hint: String
}

struct SavedTicket: Identifiable, Codable {
    let id: UUID
    var title: String
    var templateID: String
    var fields: TicketFields
    var photoData: Data?
    var savedAt: Date
    var photoScale: CGFloat?
    var photoOffset: CGSize?
    var effectIDs: [String]?
    var effectSettings: [String: EffectSettings]?
    var background: ColorToken?
    var stageBackgroundData: Data?
    var stageOpacity: Double?

    var template: TicketTemplate? {
        TicketCatalog.templates.first { $0.id == templateID }
    }
}

/// 本地作品库：仅存本机 Application Support，不走 iCloud
@Observable
@MainActor
final class WorkLibrary {
    private(set) var items: [SavedTicket] = []

    private static let legacyKey = "framezang.savedTickets"
    private static var fileURL: URL {
        let dir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir.appendingPathComponent("works.json")
    }

    init() {
        if let data = try? Data(contentsOf: Self.fileURL),
           let saved = try? JSONDecoder().decode([SavedTicket].self, from: data) {
            items = saved
        } else if let data = UserDefaults.standard.data(forKey: Self.legacyKey),
                  let saved = try? JSONDecoder().decode([SavedTicket].self, from: data) {
            items = saved
            persist()
            UserDefaults.standard.removeObject(forKey: Self.legacyKey)
        }
    }

    func item(_ id: UUID?) -> SavedTicket? {
        guard let id else { return nil }
        return items.first { $0.id == id }
    }

    func upsert(_ item: SavedTicket) {
        items.removeAll { $0.id == item.id }
        items.insert(item, at: 0)
        persist()
    }

    func rename(_ id: UUID, to name: String) {
        guard let index = items.firstIndex(where: { $0.id == id }) else { return }
        items[index].title = name
        persist()
    }

    func delete(_ id: UUID) {
        items.removeAll { $0.id == id }
        persist()
    }

    private func persist() {
        if let data = try? JSONEncoder().encode(items) {
            try? data.write(to: Self.fileURL, options: .atomic)
        }
    }
}

struct EffectSettings: Codable, Hashable {
    var opacity: Double = 0.55
    var density: Double = 0.55
    var positionX: Double = 70
    var positionY: Double = 22
    var color: ColorToken = .amber
}

enum TicketCatalog {
    static let effects = [
        TicketEffect(id: "tex-paper", name: "纸纹", symbol: "doc.text.image", tint: .cream, tab: "纹理", hint: "做旧"),
        TicketEffect(id: "tex-grain", name: "胶片颗粒", symbol: "circle.dotted", tint: .amber, tab: "纹理", hint: "做旧"),
        TicketEffect(id: "tex-halftone", name: "网点", symbol: "circle.grid.3x3", tint: .ocean, tab: "纹理", hint: "报刊"),
        TicketEffect(id: "tex-linen", name: "亚麻", symbol: "square.grid.3x3", tint: .moss, tab: "纹理", hint: "布纹"),
        TicketEffect(id: "tex-diag", name: "斜纹", symbol: "line.3.crossed.swirl.circle", tint: .ink, tab: "纹理", hint: "票券"),
        TicketEffect(id: "tex-noise", name: "噪点", symbol: "aqi.medium", tint: .plum, tab: "纹理", hint: "做旧"),
        TicketEffect(id: "pat-corners", name: "角花", symbol: "viewfinder", tint: .amber, tab: "图案", hint: "装饰"),
        TicketEffect(id: "pat-dash", name: "虚线边", symbol: "rectangle.dashed", tint: .cream, tab: "图案", hint: "票券"),
        TicketEffect(id: "pat-stars", name: "星点", symbol: "sparkles", tint: .sunset, tab: "图案", hint: "点缀"),
        TicketEffect(id: "pat-grid", name: "地图格", symbol: "grid", tint: .ocean, tab: "图案", hint: "旅行"),
        TicketEffect(id: "pat-waves", name: "水纹", symbol: "water.waves", tint: .moss, tab: "图案", hint: "轻柔"),
        TicketEffect(id: "stp-postmark", name: "邮戳", symbol: "seal", tint: .sunset, tab: "印章", hint: "做旧"),
        TicketEffect(id: "stp-approved", name: "钢印 APPROVED", symbol: "checkmark.seal", tint: .sunset, tab: "印章", hint: "纪念"),
        TicketEffect(id: "stp-checked", name: "已验票", symbol: "checkmark.circle", tint: .sunset, tab: "印章", hint: "纪念"),
        TicketEffect(id: "stp-paid", name: "PAID", symbol: "seal.fill", tint: .ocean, tab: "印章", hint: "票务"),
        TicketEffect(id: "stp-custom", name: "自定义章", symbol: "seal", tint: .amber, tab: "印章", hint: "可改字"),
        TicketEffect(id: "stp-wax", name: "火漆", symbol: "circle.fill", tint: .sunset, tab: "印章", hint: "装饰"),
        TicketEffect(id: "txt-custom", name: "自定义字", symbol: "character.textbox", tint: .cream, tab: "文字", hint: "可改字"),
        TicketEffect(id: "txt-time", name: "时间戳", symbol: "clock", tint: .ocean, tab: "文字", hint: "纪念"),
        TicketEffect(id: "txt-mark", name: "水印字", symbol: "textformat", tint: .moss, tab: "文字", hint: "可改字"),
        TicketEffect(id: "txt-diag", name: "斜向水印", symbol: "textformat.abc", tint: .plum, tab: "文字", hint: "满铺感"),
        TicketEffect(id: "lit-glitter", name: "闪粉", symbol: "wand.and.stars", tint: .amber, tab: "光效", hint: "炫"),
        TicketEffect(id: "lit-rose", name: "玫瑰金粉", symbol: "sparkles", tint: .sunset, tab: "光效", hint: "炫"),
        TicketEffect(id: "lit-vignette", name: "暗角", symbol: "circle.lefthalf.filled", tint: .ink, tab: "光效", hint: "做旧"),
        TicketEffect(id: "lit-leak", name: "漏光", symbol: "sun.max", tint: .amber, tab: "光效", hint: "胶片"),
        TicketEffect(id: "lit-neon", name: "霓虹雾", symbol: "lightbulb", tint: .neon, tab: "光效", hint: "炫"),
        TicketEffect(id: "lit-beam", name: "放映光", symbol: "光线", tint: .ocean, tab: "光效", hint: "电影"),
        TicketEffect(id: "mat-flat", name: "平面纸", symbol: "rectangle", tint: .cream, tab: "纸感", hint: "干净"),
        TicketEffect(id: "mat-matte", name: "哑光纸", symbol: "rectangle.fill", tint: .moss, tab: "纸感", hint: "纸张"),
        TicketEffect(id: "mat-gloss", name: "亮面纸", symbol: "rectangle.fill", tint: .ocean, tab: "纸感", hint: "光泽"),
        TicketEffect(id: "mat-paper3d", name: "纸感 3D", symbol: "rotate.3d", tint: .amber, tab: "纸感", hint: "立体"),
    ]
}

@Observable
@MainActor
final class TicketStore {
    var category: TicketCategory = .cinema
    var template = TicketCatalog.templates[0]
    var fields = TicketCatalog.templates[0].defaults
    var effects: [TicketEffect] = []
    var background: ColorToken = .ink
    var selectedPhotoData: Data?
    var photoScale: CGFloat = 1
    var photoOffset: CGSize = .zero
    var stageBackgroundData: Data?
    var stageOpacity: Double = 1
    var effectSettings: [String: EffectSettings] = [:]
    /// 正在编辑的本地作品；nil 表示尚未保存过的新票根
    var editingID: UUID?

    init() {}

    init(work: SavedTicket) {
        load(work)
    }

    var categoryTemplates: [TicketTemplate] {
        TicketCatalog.templates.filter { $0.category == category }
    }

    func select(_ template: TicketTemplate) {
        self.template = template
        fields = template.defaults
        category = template.category
    }

    func toggle(_ effect: TicketEffect) {
        if let index = effects.firstIndex(of: effect) {
            effects.remove(at: index)
        } else {
            effects.append(effect)
            effectSettings[effect.id] = EffectSettings(color: effect.tint)
        }
    }

    func settings(for effect: TicketEffect) -> EffectSettings {
        effectSettings[effect.id] ?? EffectSettings(color: effect.tint)
    }

    func startNew() {
        select(template)
        selectedPhotoData = nil
        photoScale = 1
        photoOffset = .zero
        effects = []
        effectSettings = [:]
        editingID = nil
    }

    func snapshot(id: UUID, name: String) -> SavedTicket {
        SavedTicket(
            id: id, title: name, templateID: template.id, fields: fields, photoData: selectedPhotoData, savedAt: .now,
            photoScale: photoScale, photoOffset: photoOffset, effectIDs: effects.map(\.id), effectSettings: effectSettings,
            background: background, stageBackgroundData: stageBackgroundData, stageOpacity: stageOpacity
        )
    }

    func load(_ item: SavedTicket) {
        guard let saved = item.template else { return }
        template = saved
        category = saved.category
        fields = item.fields
        selectedPhotoData = item.photoData
        photoScale = item.photoScale ?? 1
        photoOffset = item.photoOffset ?? .zero
        let ids = item.effectIDs ?? []
        effects = ids.compactMap { id in TicketCatalog.effects.first { $0.id == id } }
        effectSettings = item.effectSettings ?? [:]
        background = item.background ?? .ink
        stageBackgroundData = item.stageBackgroundData
        stageOpacity = item.stageOpacity ?? 1
        editingID = item.id
    }
}
