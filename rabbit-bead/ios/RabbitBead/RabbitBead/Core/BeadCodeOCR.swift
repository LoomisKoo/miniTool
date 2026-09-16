import CoreGraphics
import UIKit
import Vision

/// 扫豆子 / 包装：主路径按画面主色对色卡；辅路径 OCR 包装上的色号文字。
///
/// 色匹配用 Oklab 最近色（与量化同一套）；OCR 只认「字母 + 数字」如 `A1` / `A01`。
/// 数量仍由用户手填。
enum BeadCodeOCR {
    enum Failure: LocalizedError {
        case noMatch

        var errorDescription: String? {
            "没认出颜色或色号，请对准豆子或包装标签再拍一次。".loc
        }
    }

    /// 识别图片中的色号：颜色命中在前，OCR 命中补在后，按色卡去重。
    static func recognizeColors(in cgImage: CGImage, palette: BeadPalette) async throws -> [PaletteColor] {
        async let colorHits = Task.detached(priority: .userInitiated) {
            matchByColor(in: cgImage, palette: palette)
        }.value

        async let ocrHits: [PaletteColor] = {
            let texts = (try? await recognizeTexts(in: cgImage)) ?? []
            guard !texts.isEmpty else { return [] }
            return match(in: texts.joined(separator: "\n"), palette: palette)
        }()

        let (byColor, byCode) = await (colorHits, ocrHits)
        var ordered: [PaletteColor] = []
        var seen = Set<String>()
        for color in byColor + byCode {
            guard seen.insert(color.code).inserted else { continue }
            ordered.append(color)
        }
        guard !ordered.isEmpty else { throw Failure.noMatch }
        return ordered
    }

    // MARK: - 颜色匹配

    /// 取画面中央主色桶，对上色卡；跳过过亮背景与过暗阴影。
    private static func matchByColor(in cgImage: CGImage, palette: BeadPalette) -> [PaletteColor] {
        guard let buffer = PixelBuffer.make(from: cgImage, maxSide: 480),
              !palette.colors.isEmpty else { return [] }

        let x0 = buffer.width / 5
        let x1 = max(x0 + 1, buffer.width - x0)
        let y0 = buffer.height / 5
        let y1 = max(y0 + 1, buffer.height - y0)

        struct Acc {
            var count = 0
            var r = 0
            var g = 0
            var b = 0
        }
        var bins: [Int: Acc] = [:]
        bins.reserveCapacity(256)

        for y in y0..<y1 {
            for x in x0..<x1 {
                let p = buffer.pixel(x: x, y: y)
                guard p.a >= 128 else { continue }
                let rgb = RGB8(p.r, p.g, p.b)
                let luma = rgb.luma
                // 桌面纸白 / 死黑阴影，不是豆子本体。
                if luma > 250 || luma < 16 { continue }

                let key = rgb.coarseKey
                var acc = bins[key] ?? Acc()
                acc.count += 1
                acc.r += Int(p.r)
                acc.g += Int(p.g)
                acc.b += Int(p.b)
                bins[key] = acc
            }
        }

        let total = bins.values.reduce(0) { $0 + $1.count }
        guard total >= 40 else { return [] }

        let minCount = max(16, total / 50)
        let ranked = bins.values.sorted { $0.count > $1.count }

        var ordered: [PaletteColor] = []
        var seen = Set<String>()
        for acc in ranked.prefix(32) {
            guard acc.count >= minCount else { break }
            let avg = RGB8(
                UInt8(acc.r / acc.count),
                UInt8(acc.g / acc.count),
                UInt8(acc.b / acc.count)
            )
            let hit = palette.nearest(to: avg)
            guard seen.insert(hit.code).inserted else { continue }
            ordered.append(hit)
            if ordered.count >= 8 { break }
        }
        return ordered
    }

    // MARK: - Vision OCR

    private static func recognizeTexts(in cgImage: CGImage) async throws -> [String] {
        try await Task.detached(priority: .userInitiated) {
            try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<[String], Error>) in
                let request = VNRecognizeTextRequest { request, error in
                    if let error {
                        continuation.resume(throwing: error)
                        return
                    }
                    let observations = (request.results as? [VNRecognizedTextObservation]) ?? []
                    let lines = observations.compactMap { $0.topCandidates(1).first?.string }
                    continuation.resume(returning: lines)
                }
                request.recognitionLevel = .accurate
                request.usesLanguageCorrection = false
                request.recognitionLanguages = ["en-US", "zh-Hans"]

                let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
                do {
                    try handler.perform([request])
                } catch {
                    continuation.resume(throwing: error)
                }
            }
        }.value
    }

    // MARK: - 色号文字匹配

    /// 色卡索引：精确码 +「字母|数值」归一键（`A1` 与 `A01` 互通）。
    private static func indexes(for palette: BeadPalette) -> (exact: [String: PaletteColor], norm: [String: PaletteColor]) {
        var exact: [String: PaletteColor] = [:]
        var norm: [String: PaletteColor] = [:]
        for color in palette.colors {
            let upper = color.code.uppercased()
            exact[upper] = color
            if let key = normalizedKey(upper) {
                // 同归一键多个码时，保留色卡里先出现的那个。
                if norm[key] == nil { norm[key] = color }
            }
        }
        return (exact, norm)
    }

    static func match(in text: String, palette: BeadPalette) -> [PaletteColor] {
        let (exact, norm) = indexes(for: palette)
        var ordered: [PaletteColor] = []
        var seen = Set<String>()

        let loose = /([A-Za-z])\s*0*(\d{1,3})/

        for match in text.matches(of: loose) {
            let letter = String(match.1).uppercased()
            let digits = String(match.2)
            guard let value = Int(digits) else { continue }

            let candidates = [
                "\(letter)\(digits)",
                "\(letter)\(value)",
                String(format: "%@%02d", letter, value),
                String(format: "%@%03d", letter, value),
            ]

            var hit: PaletteColor?
            for code in candidates {
                if let color = exact[code] {
                    hit = color
                    break
                }
            }
            if hit == nil, let color = norm["\(letter)|\(value)"] {
                hit = color
            }
            guard let color = hit, seen.insert(color.code).inserted else { continue }
            ordered.append(color)
        }
        return ordered
    }

    /// `A01` / `A1` → `A|1`
    private static func normalizedKey(_ code: String) -> String? {
        let upper = code.uppercased()
        guard let letter = upper.first, letter.isLetter else { return nil }
        let digits = upper.dropFirst().filter(\.isNumber)
        guard let value = Int(digits), !digits.isEmpty else { return nil }
        return "\(letter)|\(value)"
    }
}
