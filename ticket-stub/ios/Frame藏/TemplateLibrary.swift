import Foundation
import Observation

/// 模板收藏与最近使用：仅存本机，不走 iCloud。
@Observable
@MainActor
final class TemplateLibrary {
    private(set) var favoriteIDs: [String] = []
    private(set) var recentIDs: [String] = []

    private static let favoritesKey = "framezang.templateFavorites"
    private static let recentKey = "framezang.templateRecent"
    private static let recentLimit = 12

    init() {
        favoriteIDs = UserDefaults.standard.stringArray(forKey: Self.favoritesKey) ?? []
        recentIDs = UserDefaults.standard.stringArray(forKey: Self.recentKey) ?? []
    }

    func isFavorite(_ id: String) -> Bool {
        favoriteIDs.contains(id)
    }

    func toggleFavorite(_ id: String) {
        if let index = favoriteIDs.firstIndex(of: id) {
            favoriteIDs.remove(at: index)
        } else {
            favoriteIDs.insert(id, at: 0)
        }
        persistFavorites()
    }

    func recordRecent(_ id: String) {
        recentIDs.removeAll { $0 == id }
        recentIDs.insert(id, at: 0)
        if recentIDs.count > Self.recentLimit {
            recentIDs = Array(recentIDs.prefix(Self.recentLimit))
        }
        persistRecent()
    }

    var favoriteTemplates: [TicketTemplate] {
        resolve(favoriteIDs)
    }

    var recentTemplates: [TicketTemplate] {
        resolve(recentIDs)
    }

    private func resolve(_ ids: [String]) -> [TicketTemplate] {
        ids.compactMap { id in TicketCatalog.templates.first { $0.id == id } }
    }

    private func persistFavorites() {
        UserDefaults.standard.set(favoriteIDs, forKey: Self.favoritesKey)
    }

    private func persistRecent() {
        UserDefaults.standard.set(recentIDs, forKey: Self.recentKey)
    }
}
