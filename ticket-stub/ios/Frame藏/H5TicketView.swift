import SwiftUI

/// 按模板 id 分发到对应的原生票根；尺寸为 H5 原始尺寸（template.size）
struct H5TicketView: View {
    @Environment(\.ticket) private var t

    var body: some View {
        content
            .frame(width: t.template.size.width, height: t.template.size.height)
            .environment(\.colorScheme, .light)
    }

    @ViewBuilder
    private var content: some View {
        let id = t.template.id
        switch id {
        case "cinema-tear": TkCinemaTear()
        case "cinema-polaroid": TkCinemaPolaroid()
        case "cinema-ovation": TkCinemaOvation()
        case "cinema-filmstrip": TkCinemaFilmstrip()
        case "cinema-poster": TkCinemaPoster()
        case "cinema-cinescope": TkCinemaCinescope()
        case "cinema-double": TkCinemaDouble()
        case "cinema-stubpair": TkCinemaStubpair()
        case "cinema-redclassic": TkCinemaRedclassic()
        case "cinema-archive": TkCinemaArchive()
        case "card-reel": TkCardReel()
        case "cinema-twoup": TkCinemaTwoup()
        case "cinema-threestub": TkCinemaThreestub()
        case "cinema-sheet": TkCinemaSheet()
        case "card-filmwide": TkWideCard()
        case "card-ornate": TkCardOrnate()
        case "travel-board": TkTravelBoard()
        case "travel-postcard": TkTravelPostcard()
        case "travel-tag": TkTravelTag()
        case "travel-rail": TkTravelRail()
        case "travel-passport": TkTravelPassport()
        case "travel-aerial": TkTravelAerial()
        case "travel-luggage": TkTravelLuggage()
        case "travel-voucher": TkTravelVoucher()
        case "travel-boardvintage": TkTravelBoardVintage()
        case "travel-badge": TkTravelBadge()
        case "travel-country": TkTravelCountry()
        case "travel-triptych": TkTravelTriptych()
        case "travel-medallion": TkTravelMedallion()
        case "travel-arch": TkTravelArch()
        case "travel-mountain": TkTravelMountain()
        case "travel-patch": TkTravelPatch()
        case "travel-keycard": TkTravelKeycard()
        case "travel-bifold": TkTravelBifold()
        case "travel-sleeve": TkTravelSleeve()
        case "travel-magcard": TkTravelMagcard()
        case "card-flower":
            TkCard(bg: 0xFDEEF2, ink: 0x43272F, accent: 0xC4778C, line: Color(hex: 0x96465F, alpha: 0.26), icon: "flower-2", rose: true)
        case "card-camera":
            TkCard(bg: 0xDCEEF8, ink: 0x1F3F55, accent: 0x5A8AA8, line: Color(hex: 0x326E9B, alpha: 0.28), labels: ["NAME", "LOCATION", "DATE", "TAKEN BY"], icon: "camera")
        case "card-safari":
            TkCard(ratio: 4 / 5, bg: 0xEAEADD, ink: 0x37402C, accent: 0x6D7A4A, line: Color(hex: 0x505F32, alpha: 0.28), radius: 12, labels: ["SAFARI", "LOCATION", "DATE", "NO."], icon: "trees")
        case "card-scallop": TkCardScallop()
        case "stamp-classic": TkStampClassic()
        case "stamp-sheet": TkStampSheet()
        case "stamp-postmark": TkStampPostmark()
        case "stamp-firstday": TkStampFirstday()
        case "stamp-wax": TkStampWax()
        case "stamp-pair": TkStampPair()
        case "stamp-four": TkStampFour()
        case "stamp-miniature": TkStampMiniature()
        case "stamp-panorama": TkStampPanorama()
        case "stamp-portrait": TkStampPortrait()
        case "stamp-airmail": TkStampAirmail()
        case "stamp-vintage": TkStampVintage()
        case "stamp-night": TkStampNight()
        case "stamp-tri": TkStampTri()
        case "stamp-round": TkStampRound()
        case "stamp-hex": TkStampHex()
        case "stamp-tab": TkStampTab()
        case "city-press": TkCityPress()
        case "city-capsule": TkCityCapsule()
        case "city-map": TkCityMap()
        case "city-bookmark": TkCityBookmark()
        case "city-square": TkCitySquare()
        case "city-street": TkCityStreet()
        case "city-zine": TkCityZine()
        case "city-transit": TkCityTransit()
        case "city-exhibit": TkCityExhibit()
        case "city-notice": TkCityNotice()
        case "city-collage": TkCityCollage()
        case "city-gatecard": TkCityGatecard()
        case "card-museum": TkCardMuseum()
        case "card-gilt": TkCardGilt()
        case "card-round": TkCardRound()
        case "card-hexcolor": TkCardHexcolor()
        case "concert-neon": TkConcertNeon()
        case "concert-fest": TkConcertFest()
        case "concert-lanyard": TkConcertLanyard()
        case "concert-paper": TkConcertPaper()
        case "concert-backstage": TkConcertBackstage()
        case "concert-stage": TkConcertStage()
        case "concert-vinyl": TkConcertVinyl()
        case "concert-raffle":
            TkDarkStub(
                tag: "LOTTERY / ADMIT ONE", tagColor: 0xC9A6FF, rowColor: 0xB9D4FF, colors: [0x2A1A4A, 0x130C26],
                stripe: (10, 20, 0.04), border: 0xB48CFF, perfX: 214, stubWidth: 106, titleSize: 1.46, stubNo: "NO.008421"
            )
        case "concert-stub":
            TkDarkStub(
                tag: "ADMIT ONE", tagColor: 0x9AA6FF, rowColor: 0xB6D0FF, colors: [0x23214A, 0x12102A],
                stripe: (9, 18, 0.05), border: 0x96A0FF, perfX: 202, stubWidth: 118, titleSize: 1.42, stubNo: nil
            )
        case "concert-wristband": TkConcertWristband()
        case "concert-scallop": TkConcertScallop()
        case "concert-badge": TkConcertBadge()
        case "concert-note": TkConcertNote()
        case "concert-roundtrip": TkConcertRoundtrip()
        case "card-blacklabel": TkLabelCard(band: 0x1C1C1F, ink: 0xECE6DA, icon: "torii-gate")
        case "card-redlabel": TkLabelCard(band: 0xB8412F, ink: 0xFDF3E6, icon: "flower-2", rose: true)
        case "card-splash":
            TkWideCard(
                ratio: 3 / 2, bg: 0xD7ECF7, ink: 0x1F4560, accent: 0x5F8FAE, bodyTint: .white.opacity(0.5),
                cells: [("LOCATION:", \.place), ("DATE:", \.date), ("WATER TEMP:", \.seat), ("SPOT:", \.title)],
                icon: "sailboat", radius: 14, notches: true
            )
        default:
            if let pal = H5Family.posters[id] {
                TkPoster(pal: pal)
            } else if let trip = H5Family.trips[id] {
                TkTrip(spec: trip)
            } else if let shape = H5Family.shapes[id] {
                TkShape(shape: shape)
            } else if let stamp = H5Family.stamps[id] {
                TkStamp(spec: stamp)
            } else if let vintage = H5Family.vintage[id] {
                TkVintage(spec: vintage)
            } else if let snap = H5Family.snaps[id] {
                TkSnap(spec: snap)
            } else {
                TkPending()
            }
        }
    }
}

/// 尚未移植的模板：保持尺寸与基本信息
struct TkPending: View {
    @Environment(\.ticket) private var t

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            H5Photo()
                .frame(maxWidth: .infinity)
                .frame(height: t.template.size.height * 0.55)
                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            Text(t.title).font(.h5Serif(rem(1.4))).fontWeight(.bold).lineLimit(1)
            Text(t.place).font(.h5Sans(rem(0.8))).foregroundStyle(Color(hex: 0x6A6258)).lineLimit(1)
            HStack {
                Text(t.date)
                Spacer()
                Text(t.seat)
            }
            .font(.h5Mono(rem(0.7)))
            .lineLimit(1)
            Spacer(minLength: 0)
        }
        .foregroundStyle(Color.h5Ink)
        .padding(14)
        .frame(width: t.template.size.width, height: t.template.size.height)
        .background(Color.h5Paper)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }
}

extension TicketContext {
    @MainActor
    init(store: TicketStore) {
        self.init(
            template: store.template,
            fields: store.fields,
            photos: [store.selectedPhotoData.flatMap(UIImage.init(data:))],
            photoScale: store.photoScale,
            photoOffset: store.photoOffset
        )
    }
}
