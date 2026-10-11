import Foundation

enum PuzzleLimits {
    static let freeMaxSaves = 2
    static let proMaxSaves = 12
    static let freeMaxPieces = 72
    static let proMaxPieces = 1600

    static func maxSaves(isPro: Bool) -> Int {
        isPro ? proMaxSaves : freeMaxSaves
    }

    static func maxPieces(isPro: Bool) -> Int {
        isPro ? proMaxPieces : freeMaxPieces
    }
}
