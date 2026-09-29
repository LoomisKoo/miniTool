import Foundation

/* 英文名侧 —— 移植自 engine.js 的 rankEnNames / enFromChinese。 */

struct EnRank {
    let name: NMEnName
    var score: Double
    let tSim: Double
    let sSim: Double
    let eraFit: Double
    var phon: Double?
}

extension NameEngine {

    static let eraScore: [String: Int] = ["ancient": 0, "vintage": 1, "mid": 2, "modern": 3, "now": 4]

    func rankEnNames(_ profile: NMProfile, wantGender: String?, wantEra: String = "now") -> [EnRank] {
        let wantEraN = Self.eraScore[wantEra] ?? 4
        var out: [EnRank] = []
        for it in data.namesEn {
            if let wg = wantGender, wg != "u", it.g != "u", it.g != wg { continue }
            let tSim = (cos(it.tr, profile.trait, data.traitKeys) + 1) / 2
            let sSim = (cos(it.st, profile.style, data.styleKeys) + 1) / 2
            let dist = abs((Self.eraScore[it.era] ?? 2) - wantEraN)
            let eraFit = 1 - Double(dist) / 4
            out.append(EnRank(name: it, score: 0.42 * tSim + 0.30 * sSim + 0.28 * eraFit,
                              tSim: tSim, sSim: sSim, eraFit: eraFit, phon: nil))
        }
        out.sort { $0.score > $1.score }
        return out
    }

    func enFromChinese(_ profile: NMProfile, pinyinSyls: [String], wantGender: String?, wantEra: String = "now") -> [EnRank] {
        var list = rankEnNames(profile, wantGender: wantGender, wantEra: wantEra)
        if pinyinSyls.isEmpty { return list }
        let first = pinyinSyls[0]
        for i in list.indices {
            let ps = phonSim(first, list[i].name.snd)
            list[i].phon = ps
            list[i].score = list[i].score * 0.82 + 0.18 * ps
        }
        list.sort { $0.score > $1.score }
        return list
    }
}
