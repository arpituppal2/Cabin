// OnboardingView.swift
// The gate-to-gate onboarding experience.
// Presented before every session. Allows the user to:
//   1. Select a seat from the 1-2-1 cabin diagram.
//   2. Choose a route (departure + arrival airport).
//   3. Set total session time, sprint duration, break duration.
//   4. Tap "Begin Flight" to launch the cabin.

import SwiftUI

// MARK: - Seat model

struct CabinSeat: Identifiable {
    let id: Int            // 0–7, matches C bridge seatIndex
    let code: String       // "1A", "2B", etc.
    let column: String     // "A", "B", "D", "G", "J", "L"
    let row: Int           // 1 or 2 (stagger)
    let side: SeatSide
    let description: String

    enum SeatSide { case leftWindow, leftAisle, centerLeft, centerRight, rightAisle, rightWindow }
}

let allSeats: [CabinSeat] = [
    CabinSeat(id: 0, code: "1A", column: "A", row: 1, side: .leftWindow,
              description: "True Left Window \u2014 Maximum privacy, flush to the hull."),
    CabinSeat(id: 1, code: "2B", column: "B", row: 2, side: .leftAisle,
              description: "Left Aisle \u2014 Console by window, open to the cabin."),
    CabinSeat(id: 2, code: "1D", column: "D", row: 1, side: .centerLeft,
              description: "Center Left, Aisle Facing \u2014 Console in the centre."),
    CabinSeat(id: 3, code: "2D", column: "D", row: 2, side: .centerLeft,
              description: "\u201cHoneymoon\u201d \u2014 Tucked in the middle, console shields the aisle."),
    CabinSeat(id: 4, code: "2G", column: "G", row: 2, side: .centerRight,
              description: "\u201cHoneymoon\u201d \u2014 Mirror pair of 2D."),
    CabinSeat(id: 5, code: "1G", column: "G", row: 1, side: .centerRight,
              description: "Center Right, Aisle Facing \u2014 Console in the centre."),
    CabinSeat(id: 6, code: "2J", column: "J", row: 2, side: .rightAisle,
              description: "Right Aisle \u2014 Console on window side."),
    CabinSeat(id: 7, code: "1L", column: "L", row: 1, side: .rightWindow,
              description: "True Right Window \u2014 Maximum privacy, flush to the hull."),
]

// MARK: - Route presets

struct RoutePreset: Identifiable, Hashable {
    let id = UUID()
    let dep: String; let arr: String
    let depName: String; let arrName: String
    let depLon: Float; let depLat: Float
    let arrLon: Float; let arrLat: Float
    let durationHours: Float
    var label: String { "\(dep) \u2192 \(arr)" }
}

let routePresets: [RoutePreset] = [
    RoutePreset(dep: "LAX", arr: "LHR", depName: "Los Angeles", arrName: "London Heathrow",
                depLon: -118.4085, depLat: 33.9425, arrLon: -0.4543, arrLat: 51.4775,
                durationHours: 10.5),
    RoutePreset(dep: "JFK", arr: "NRT", depName: "New York JFK", arrName: "Tokyo Narita",
                depLon: -73.7789, depLat: 40.6413, arrLon: 140.3864, arrLat: 35.7647,
                durationHours: 14.0),
    RoutePreset(dep: "SFO", arr: "SIN", depName: "San Francisco", arrName: "Singapore Changi",
                depLon: -122.3789, depLat: 37.6213, arrLon: 103.9915, arrLat: 1.3644,
                durationHours: 17.0),
    RoutePreset(dep: "CDG", arr: "GRU", depName: "Paris CDG", arrName: "S\u00e3o Paulo GRU",
                depLon: 2.5479, depLat: 49.0097, arrLon: -46.4731, arrLat: -23.4356,
                durationHours: 11.5),
    RoutePreset(dep: "DXB", arr: "SYD", depName: "Dubai", arrName: "Sydney",
                depLon: 55.3644, depLat: 25.2532, arrLon: 151.1772, arrLat: -33.9461,
                durationHours: 13.5),
    RoutePreset(dep: "ORD", arr: "FRA", depName: "Chicago O'Hare", arrName: "Frankfurt",
                depLon: -87.9073, depLat: 41.9742, arrLon: 8.5706,  arrLat: 50.0379,
                durationHours: 9.0),
]

// MARK: - OnboardingView

struct OnboardingView: View {

    let onComplete: (SessionConfig) -> Void

    @State private var selectedSeatID: Int = 7  // Default: 1L right window
    @State private var selectedRoute: RoutePreset = routePresets[0]
    @State private var sessionMinutes: Double = 90
    @State private var sprintMinutes: Double = 25
    @State private var breakMinutes: Double = 5
    @State private var taxiMinutes: Double = 5
    @State private var step: OnboardingStep = .seatSelection

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            ScrollView(showsIndicators: false) {
                VStack(spacing: 48) {
                    header

                    switch step {
                    case .seatSelection:
                        seatSelectionSection
                            .transition(.asymmetric(
                                insertion: .move(edge: .trailing).combined(with: .opacity),
                                removal:   .move(edge: .leading).combined(with: .opacity)
                            ))
                    case .routeConfig:
                        routeSection
                            .transition(.asymmetric(
                                insertion: .move(edge: .trailing).combined(with: .opacity),
                                removal:   .move(edge: .leading).combined(with: .opacity)
                            ))
                    case .sessionConfig:
                        sessionConfigSection
                            .transition(.asymmetric(
                                insertion: .move(edge: .trailing).combined(with: .opacity),
                                removal:   .move(edge: .leading).combined(with: .opacity)
                            ))
                    }

                    stepButtons
                        .padding(.bottom, 60)
                }
                .padding(.horizontal, 36)
                .padding(.top, 56)
            }
        }
        .preferredColorScheme(.dark)
    }

    // MARK: - Header

    private var header: some View {
        VStack(spacing: 12) {
            Text("CABIN")
                .font(.system(size: 38, weight: .thin, design: .rounded))
                .tracking(12)
                .foregroundStyle(.white)
            Text(step.subtitle.uppercased())
                .font(.system(size: 13, weight: .semibold, design: .rounded))
                .tracking(3.6)
                .foregroundStyle(.white.opacity(0.46))
                .animation(.easeInOut, value: step)
        }
    }

    // MARK: - Step 1: Seat Selection

    private var seatSelectionSection: some View {
        VStack(spacing: 32) {
            CabinDiagramView(selectedSeatID: $selectedSeatID)
                .frame(height: 220)

            if let seat = allSeats.first(where: { $0.id == selectedSeatID }) {
                VStack(spacing: 8) {
                    Text("SEAT \(seat.code)")
                        .font(.system(size: 22, weight: .semibold, design: .rounded))
                        .tracking(3)
                        .foregroundStyle(.white)
                    Text(seat.description)
                        .font(.system(size: 15, weight: .regular, design: .rounded))
                        .foregroundStyle(.white.opacity(0.58))
                        .multilineTextAlignment(.center)
                }
                .animation(.easeInOut(duration: 0.22), value: selectedSeatID)
            }
        }
    }

    // MARK: - Step 2: Route

    private var routeSection: some View {
        VStack(spacing: 20) {
            ForEach(routePresets) { preset in
                RouteCard(preset: preset, isSelected: selectedRoute.id == preset.id) {
                    withAnimation(.easeInOut(duration: 0.18)) { selectedRoute = preset }
                }
            }
        }
    }

    // MARK: - Step 3: Session Config

    private var sessionConfigSection: some View {
        VStack(spacing: 28) {
            sliderRow(
                label: "Session Length",
                value: $sessionMinutes,
                range: 30...360,
                unit: "min",
                step: 5
            )
            sliderRow(
                label: "Focus Sprint",
                value: $sprintMinutes,
                range: 10...60,
                unit: "min",
                step: 5
            )
            sliderRow(
                label: "Break Duration",
                value: $breakMinutes,
                range: 3...20,
                unit: "min",
                step: 1
            )
            sliderRow(
                label: "Boarding / Email Taxi",
                value: $taxiMinutes,
                range: 2...20,
                unit: "min",
                step: 1
            )
        }
    }

    private func sliderRow(label: String, value: Binding<Double>, range: ClosedRange<Double>, unit: String, step: Double) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text(label.uppercased())
                    .font(.system(size: 12, weight: .semibold, design: .rounded))
                    .tracking(2.4)
                    .foregroundStyle(.white.opacity(0.5))
                Spacer()
                Text("\(Int(value.wrappedValue)) \(unit)")
                    .font(.system(size: 20, weight: .medium, design: .rounded))
                    .monospacedDigit()
                    .foregroundStyle(.white)
            }
            Slider(value: value, in: range, step: step)
                .tint(.white.opacity(0.85))
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 18)
        .background(Color.white.opacity(0.04), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .stroke(Color.white.opacity(0.08), lineWidth: 1)
        )
    }

    // MARK: - Navigation Buttons

    private var stepButtons: some View {
        HStack(spacing: 16) {
            if step != .seatSelection {
                Button {
                    withAnimation(.easeInOut(duration: 0.32)) { step = step.previous }
                } label: {
                    Text("BACK")
                        .font(.system(size: 15, weight: .semibold, design: .rounded))
                        .tracking(2.4)
                        .foregroundStyle(.white.opacity(0.7))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 18)
                        .background(Color.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                }
            }

            Button {
                if step == .sessionConfig {
                    onComplete(buildConfig())
                } else {
                    withAnimation(.easeInOut(duration: 0.32)) { step = step.next }
                }
            } label: {
                Text(step == .sessionConfig ? "BEGIN FLIGHT" : "CONTINUE")
                    .font(.system(size: 15, weight: .semibold, design: .rounded))
                    .tracking(2.4)
                    .foregroundStyle(.black)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 18)
                    .background(Color.white, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            }
        }
    }

    // MARK: - Config builder

    private func buildConfig() -> SessionConfig {
        var cfg = SessionConfig()
        cfg.totalMinutes   = Float(sessionMinutes)
        cfg.sprintMinutes  = Float(sprintMinutes)
        cfg.breakMinutes   = Float(breakMinutes)
        cfg.taxiMinutes    = Float(taxiMinutes)
        cfg.departureIATA  = selectedRoute.dep
        cfg.arrivalIATA    = selectedRoute.arr
        cfg.depLon         = selectedRoute.depLon
        cfg.depLat         = selectedRoute.depLat
        cfg.arrLon         = selectedRoute.arrLon
        cfg.arrLat         = selectedRoute.arrLat
        cfg.seatIndex      = Int32(selectedSeatID)
        return cfg
    }
}

// MARK: - Cabin Diagram Canvas

struct CabinDiagramView: View {
    @Binding var selectedSeatID: Int

    var body: some View {
        GeometryReader { geo in
            Canvas { context, size in
                drawCabin(context: context, size: size)
            } symbols: {
                // Invisible symbols block; seat labels drawn directly in Canvas.
            }
            .gesture(DragGesture(minimumDistance: 0)
                .onEnded { value in
                    let tapped = seatID(at: value.location, in: geo.size)
                    if let id = tapped {
                        withAnimation(.easeInOut(duration: 0.18)) { selectedSeatID = id }
                    }
                }
            )
        }
    }

    // 1-2-1 layout: draw fuselage, aisle lines, then each seat block.
    private func drawCabin(context: GraphicsContext, size: CGSize) {
        let seatW: CGFloat = size.width / 14
        let seatH: CGFloat = size.height * 0.56
        let topY:  CGFloat = (size.height - seatH) / 2

        // Fuselage outline.
        let fuselage = RoundedRectangle(cornerRadius: 26, style: .continuous)
        context.stroke(
            fuselage.path(in: CGRect(x: 4, y: topY - 10, width: size.width - 8, height: seatH + 20)),
            with: .color(.white.opacity(0.18)), lineWidth: 2
        )

        // Aisle columns (fractional x positions in the 14-unit grid).
        let cols: [(seat: CabinSeat, xUnit: CGFloat)] = [
            (allSeats[0], 1),   // 1A
            (allSeats[1], 3),   // 2B  (stagger right)
            (allSeats[2], 5.5), // 1D
            (allSeats[3], 7),   // 2D  (stagger right)
            (allSeats[4], 7.5), // 2G
            (allSeats[5], 9),   // 1G
            (allSeats[6], 11),  // 2J  (stagger right)
            (allSeats[7], 13),  // 1L
        ]

        for (seat, xUnit) in cols {
            let x = xUnit / 14 * size.width - seatW / 2
            let staggerY: CGFloat = seat.row == 2 ? topY + seatH * 0.15 : topY
            let h = seat.row == 2 ? seatH * 0.70 : seatH
            let rect = CGRect(x: x, y: staggerY, width: seatW - 4, height: h)
            let isSelected = seat.id == selectedSeatID

            let fill = isSelected ? Color.white : Color.white.opacity(0.10)
            let stroke = isSelected ? Color.white : Color.white.opacity(0.28)

            context.fill(
                RoundedRectangle(cornerRadius: 8, style: .continuous).path(in: rect),
                with: .color(fill)
            )
            context.stroke(
                RoundedRectangle(cornerRadius: 8, style: .continuous).path(in: rect),
                with: .color(stroke), lineWidth: 1.5
            )

            // Seat code label.
            context.draw(
                Text(seat.code)
                    .font(.system(size: 11, weight: .semibold, design: .rounded))
                    .foregroundStyle(isSelected ? Color.black : Color.white.opacity(0.7)),
                at: CGPoint(x: rect.midX, y: rect.midY)
            )
        }
    }

    private func seatID(at point: CGPoint, in size: CGSize) -> Int? {
        let seatW: CGFloat = size.width / 14
        let seatH: CGFloat = size.height * 0.56
        let topY:  CGFloat = (size.height - seatH) / 2

        let cols: [(id: Int, xUnit: CGFloat)] = [
            (0, 1), (1, 3), (2, 5.5), (3, 7),
            (4, 7.5), (5, 9), (6, 11), (7, 13),
        ]
        for (id, xUnit) in cols {
            let seat = allSeats[id]
            let x = xUnit / 14 * size.width - seatW / 2
            let staggerY: CGFloat = seat.row == 2 ? topY + seatH * 0.15 : topY
            let h = seat.row == 2 ? seatH * 0.70 : seatH
            let rect = CGRect(x: x, y: staggerY, width: seatW - 4, height: h).insetBy(dx: -8, dy: -8)
            if rect.contains(point) { return id }
        }
        return nil
    }
}

// MARK: - Route Card

struct RouteCard: View {
    let preset: RoutePreset
    let isSelected: Bool
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack {
                VStack(alignment: .leading, spacing: 6) {
                    Text(preset.label)
                        .font(.system(size: 20, weight: .semibold, design: .rounded))
                        .foregroundStyle(isSelected ? .black : .white)
                    Text("\(preset.depName) \u2192 \(preset.arrName)")
                        .font(.system(size: 13, weight: .regular, design: .rounded))
                        .foregroundStyle(isSelected ? Color.black.opacity(0.58) : Color.white.opacity(0.48))
                }
                Spacer()
                Text(String(format: "%.1f hr", preset.durationHours))
                    .font(.system(size: 18, weight: .medium, design: .rounded))
                    .monospacedDigit()
                    .foregroundStyle(isSelected ? .black : .white.opacity(0.7))
            }
            .padding(.horizontal, 22)
            .padding(.vertical, 18)
            .background(
                isSelected ? Color.white : Color.white.opacity(0.05),
                in: RoundedRectangle(cornerRadius: 18, style: .continuous)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .stroke(isSelected ? Color.clear : Color.white.opacity(0.1), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Onboarding Step

enum OnboardingStep {
    case seatSelection, routeConfig, sessionConfig

    var subtitle: String {
        switch self {
        case .seatSelection: return "Choose your seat"
        case .routeConfig:   return "Select your route"
        case .sessionConfig: return "Configure your flight"
        }
    }
    var next: OnboardingStep {
        switch self {
        case .seatSelection: return .routeConfig
        case .routeConfig:   return .sessionConfig
        case .sessionConfig: return .sessionConfig
        }
    }
    var previous: OnboardingStep {
        switch self {
        case .seatSelection: return .seatSelection
        case .routeConfig:   return .seatSelection
        case .sessionConfig: return .routeConfig
        }
    }
}
