import SwiftUI
import UIKit

/// 模板缩略图：主列表只展示位图；串行 ImageRenderer + 磁盘缓存，避免滑动时现渲票根。
@Observable
@MainActor
final class TemplateThumbCache {
    /// 变更时驱动卡片刷新
    private(set) var revision: UInt = 0

    private let memory = NSCache<NSString, UIImage>()
    private var queue: [String] = []
    private var queued = Set<String>()
    private var pumping = false
    private let pointWidth: CGFloat = 168

    private static var diskDir: URL {
        let dir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("template-thumbs", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }

    init() {
        memory.countLimit = 120
    }

    func image(for templateID: String) -> UIImage? {
        if let hit = memory.object(forKey: templateID as NSString) { return hit }
        if let disk = loadDisk(templateID) {
            memory.setObject(disk, forKey: templateID as NSString)
            return disk
        }
        return nil
    }

    func request(_ template: TicketTemplate) {
        let id = template.id
        if image(for: id) != nil { return }
        guard !queued.contains(id) else { return }
        queued.insert(id)
        queue.append(id)
        pump()
    }

    /// 当前筛选优先渲染
    func prioritize(_ templates: [TicketTemplate]) {
        for template in templates.reversed() {
            let id = template.id
            if image(for: id) != nil { continue }
            if let index = queue.firstIndex(of: id) {
                queue.remove(at: index)
                queue.insert(id, at: 0)
            } else if !queued.contains(id) {
                queued.insert(id)
                queue.insert(id, at: 0)
            }
        }
        pump()
    }

    private func pump() {
        guard !pumping else { return }
        pumping = true
        Task { @MainActor in
            while let id = queue.first {
                queue.removeFirst()
                defer { queued.remove(id) }
                if image(for: id) != nil { continue }
                guard let template = TicketCatalog.templates.first(where: { $0.id == id }) else { continue }

                await Task.yield()
                if let rendered = render(template) {
                    memory.setObject(rendered, forKey: id as NSString)
                    saveDisk(rendered, id: id)
                    revision &+= 1
                }
                // 给滑动手势留空档，避免连续 ImageRenderer 卡主线程
                try? await Task.sleep(nanoseconds: 45_000_000)
            }
            pumping = false
        }
    }

    private func render(_ template: TicketTemplate) -> UIImage? {
        let size = template.size
        let renderer = ImageRenderer(content:
            H5TicketView()
                .frame(width: size.width, height: size.height)
                .environment(\.ticket, TicketContext(template: template, fields: template.localizedDefaults))
        )
        let scale = UIScreen.main.scale * min(1, pointWidth / max(size.width, size.height))
        renderer.scale = max(1, scale)
        return renderer.uiImage
    }

    private func diskURL(_ id: String) -> URL {
        Self.diskDir.appendingPathComponent("\(id).png")
    }

    private func loadDisk(_ id: String) -> UIImage? {
        let url = diskURL(id)
        guard let data = try? Data(contentsOf: url) else { return nil }
        return UIImage(data: data)
    }

    private func saveDisk(_ image: UIImage, id: String) {
        guard let data = image.pngData() else { return }
        try? data.write(to: diskURL(id), options: .atomic)
    }
}
