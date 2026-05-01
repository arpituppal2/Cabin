// OnboardingView.swift
// The gate experience — seat selection + session configuration.
// Full-screen, immersive. No floating modals.
// Steps:
//   1. Seat selection (1-2-1 cabin diagram)
//   2. Route selection (IATA + globe preview)
//   3. Session timing (duration + sprint length)

import SwiftUI

struct OnboardingView: View {
    let onComplete: (CabinSessionConfig) -> Void

    @State private var step:          Int = 0
    @State private var config:        CabinSessionConfig = CabinSessionConfig()
    @State private var stepOpacity:   Double = 1.0

    var body: some View {
        ZStack {
            // Gate ambiance background.
            LinearGradient(
                colors: [
                    Color(red: 0.08, green: 0.09, blue: 0.12),
                    Color(red: 0.12, green: 0.14, blue: 0.18)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            // Subtle noise overlay.
            Canvas { ctx, size in
                for i in 0..<3000 {
                    let x = CGFloat((i * 7919) % Int(size.width))
                    let y = CGFloat((i * 6271) % Int(size.height))
                    ctx.fill(
                        Path(CGRect(x: x, y: y, width: 1, height: 1)),
                        with: .color(.white.opacity(0.018))
                    )
                }
            }
            .ignoresSafeArea()
            .allowsHitTesting(false)

            VStack(spacing: 0) {
                // Airline wordmark
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("CABIN")
                            .font(.system(size: 13, weight: .semibold, design: .monospaced))
                            .tracking(6)
                            .foregroundStyle(.white.opacity(0.9))
                        Text("DEEP WORK IN FLIGHT")
                            .font(.system(size: 10, weight: .regular, design: .monospaced))
                            .tracking(3)
                            .foregroundStyle(.white.opacity(0.3))
                    }
                    Spacer()
                    // Gate display.
                    VStack(alignment: .trailing, spacing: 2) {
                        Text("GATE B22")
                            .font(.system(size: 11, weight: .medium, design: .monospaced))
                            .tracking(2)
                            .foregroundStyle(.white.opacity(0.5))
                        Text("BOARDING NOW")
                            .font(.system(size: 10, weight: .regular, design: .monospaced))
                            .tracking(2)
                            .foregroundStyle(Color(red: 1, green: 0.55, blue: 0.1).opacity(0.85))
                    }
                }
                .padding(.horizontal, 40)
                .padding(.top, 32)

                // Boarding pass divider.
                HStack {
                    Rectangle().fill(.white.opacity(0.06)).frame(height: 1)
                    Text("✂️")
                        .font(.system(size: 14))
                        .rotationEffect(.degrees(-90))
                    Rectangle().fill(.white.opacity(0.06)).frame(height: 1)
                }
                .padding(.horizontal, 40)
                .padding(.vertical, 16)

                // Step content.
                Group {
                    switch step {
                    case 0: SeatSelectionStep(config: $config)
                    case 1: RouteSelectionStep(config: $config)
                    case 2: TimingStep(config: $config)
                    default: EmptyView()
                    }
                }
                .opacity(stepOpacity)
                .animation(.easeInOut(duration: 0.3), value: stepOpacity)

                Spacer()

                // Navigation.
                HStack(spacing: 16) {
                    if step > 0 {
                        Button(action: previousStep) {
                            Text("BACK")
                                .font(.system(size: 12, weight: .medium, design: .monospaced))
                                .tracking(3)
                                .foregroundStyle(.white.opacity(0.4))
                                .padding(.horizontal, 24)
                                .padding(.vertical, 14)
                                .background(.white.opacity(0.05))
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                        }
                    }
                    Spacer()
                    // Step dots.
                    HStack(spacing: 6) {
                        ForEach(0..<3, id: \.self) { i in
                            Circle()
                                .fill(i == step ? Color(red: 1, green: 0.55, blue: 0.1) : .white.opacity(0.2))
                                .frame(width: 6, height: 6)
                                .animation(.easeInOut(duration: 0.2), value: step)
                        }
                    }
                    Spacer()
                    Button(action: nextStep) {
                        Text(step == 2 ? "BOARD" : "CONTINUE")
                            .font(.system(size: 12, weight: .semibold, design: .monospaced))
                            .tracking(3)
                            .foregroundStyle(.black)
                            .padding(.horizontal, 28)
                            .padding(.vertical, 14)
                            .background(Color(red: 1, green: 0.55, blue: 0.1))
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                    }
                }
                .padding(.horizontal, 40)
                .padding(.bottom, 36)
            }
        }
    }

    private func nextStep() {
        if step < 2 {
            withAnimation { stepOpacity = 0 }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
                step += 1
                withAnimation { stepOpacity = 1 }
            }
        } else {
            onComplete(config)
        }
    }

    private func previousStep() {
        withAnimation { stepOpacity = 0 }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
            step -= 1
            withAnimation { stepOpacity = 1 }
        }
    }
}

// MARK: - Step 1: Seat Selection

struct SeatSelectionStep: View {
    @Binding var config: CabinSessionConfig

    // 8 seats: 1A, 2B, 1D, 2D, 2G, 1G, 2J, 1L
    private let seats = [
        SeatInfo(index: 0, row: "1", col: "A", side: .left,   type: .window, label: "TRUE WINDOW",  sub: "Maximum privacy"),
        SeatInfo(index: 1, row: "2", col: "B", side: .left,   type: .aisle,  label: "LEFT AISLE",   sub: "More open feel"),
        SeatInfo(index: 2, row: "1", col: "D", side: .center, type: .aisle,  label: "CTR LEFT • AISLE", sub: "Console in center"),
        SeatInfo(index: 3, row: "2", col: "D", side: .center, type: .honey,  label: "HONEYMOON",    sub: "Tucked in middle"),
        SeatInfo(index: 4, row: "2", col: "G", side: .center, type: .honey,  label: "HONEYMOON",    sub: "Other half"),
        SeatInfo(index: 5, row: "1", col: "G", side: .center, type: .aisle,  label: "CTR RIGHT • AISLE", sub: "Console in center"),
        SeatInfo(index: 6, row: "2", col: "J", side: .right,  type: .aisle,  label: "RIGHT AISLE",  sub: "Console on window"),
        SeatInfo(index: 7, row: "1", col: "L", side: .right,  type: .window, label: "TRUE WINDOW",  sub: "Maximum privacy")
    ]

    var body: some View {
        VStack(spacing: 28) {
            Text("SELECT YOUR SEAT")
                .font(.system(size: 11, weight: .medium, design: .monospaced))
                .tracking(5)
                .foregroundStyle(.white.opacity(0.4))

            // Cabin diagram.
            CabinDiagram(seats: seats, selectedIndex: config.seatIndex) { idx in
                config.seatIndex = idx
            }
            .frame(height: 300)

            // Selected seat description.
            if let selected = seats.first(where: { $0.index == config.seatIndex }) {
                VStack(spacing: 6) {
                    Text("\(selected.row)\(selected.col) — \(selected.label)")
                        .font(.system(size: 15, weight: .medium, design: .monospaced))
                        .foregroundStyle(.white)
                    Text(selected.sub)
                        .font(.system(size: 12, weight: .regular, design: .monospaced))
                        .foregroundStyle(.white.opacity(0.4))
                }
                .transition(.opacity)
            }
        }
        .padding(.horizontal, 40)
    }
}

struct SeatInfo {
    enum Side   { case left, center, right }
    enum SeatType { case window, aisle, honey }
    let index: Int
    let row:   String
    let col:   String
    let side:  Side
    let type:  SeatType
    let label: String
    let sub:   String
}

struct CabinDiagram: View {
    let seats:         [SeatInfo]
    let selectedIndex: Int
    let onSelect:      (Int) -> Void

    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width
            let h = geo.size.height
            let seatW: CGFloat = 72
            let seatH: CGFloat = 88

            ZStack {
                // Fuselage outline.
                Capsule()
                    .stroke(.white.opacity(0.08), lineWidth: 1.5)
                    .padding(.horizontal, 20)

                // Aisle lines.
                Rectangle()
                    .fill(.white.opacity(0.04))
                    .frame(width: 2, height: h * 0.7)
                    .position(x: w * 0.30, y: h * 0.5)
                Rectangle()
                    .fill(.white.opacity(0.04))
                    .frame(width: 2, height: h * 0.7)
                    .position(x: w * 0.70, y: h * 0.5)

                // 1-2-1 layout positions.
                // Left window (1A): x=0.12
                seatView(for: seats[0], at: CGPoint(x: w*0.12, y: h*0.38), seatW: seatW, seatH: seatH)
                // Left aisle (2B): x=0.24
                seatView(for: seats[1], at: CGPoint(x: w*0.24, y: h*0.62), seatW: seatW, seatH: seatH)
                // Center left aisle (1D): x=0.40
                seatView(for: seats[2], at: CGPoint(x: w*0.40, y: h*0.38), seatW: seatW, seatH: seatH)
                // Center left honeymoon (2D): x=0.40
                seatView(for: seats[3], at: CGPoint(x: w*0.40, y: h*0.62), seatW: seatW, seatH: seatH)
                // Center right honeymoon (2G): x=0.60
                seatView(for: seats[4], at: CGPoint(x: w*0.60, y: h*0.62), seatW: seatW, seatH: seatH)
                // Center right aisle (1G): x=0.60
                seatView(for: seats[5], at: CGPoint(x: w*0.60, y: h*0.38), seatW: seatW, seatH: seatH)
                // Right aisle (2J): x=0.76
                seatView(for: seats[6], at: CGPoint(x: w*0.76, y: h*0.62), seatW: seatW, seatH: seatH)
                // Right window (1L): x=0.88
                seatView(for: seats[7], at: CGPoint(x: w*0.88, y: h*0.38), seatW: seatW, seatH: seatH)
            }
        }
    }

    @ViewBuilder
    private func seatView(for seat: SeatInfo, at pos: CGPoint, seatW: CGFloat, seatH: CGFloat) -> some View {
        let isSelected = seat.index == selectedIndex
        Button(action: { onSelect(seat.index) }) {
            VStack(spacing: 4) {
                RoundedRectangle(cornerRadius: 6)
                    .fill(isSelected
                        ? Color(red: 1, green: 0.55, blue: 0.1)
                        : Color.white.opacity(0.08))
                    .overlay(
                        RoundedRectangle(cornerRadius: 6)
                            .stroke(isSelected ? .clear : .white.opacity(0.15), lineWidth: 1)
                    )
                    .frame(width: seatW - 8, height: seatH - 24)
                Text("\(seat.row)\(seat.col)")
                    .font(.system(size: 10, weight: .medium, design: .monospaced))
                    .foregroundStyle(isSelected ? Color(red: 1, green: 0.55, blue: 0.1) : .white.opacity(0.4))
            }
        }
        .frame(width: seatW, height: seatH)
        .position(pos)
        .animation(.easeInOut(duration: 0.15), value: isSelected)
    }
}

// MARK: - Step 2: Route Selection

struct RouteSelectionStep: View {
    @Binding var config: CabinSessionConfig

    private let presets: [(dep: String, arr: String, name: String)] = [
        ("LAX", "LHR", "Los Angeles → London"),
        ("JFK", "CDG", "New York → Paris"),
        ("SFO", "NRT", "San Francisco → Tokyo"),
        ("ORD", "FRA", "Chicago → Frankfurt"),
        ("LAX", "SYD", "Los Angeles → Sydney"),
        ("MIA", "GRU", "Miami → São Paulo")
    ]

    var body: some View {
        VStack(spacing: 28) {
            Text("SELECT YOUR ROUTE")
                .font(.system(size: 11, weight: .medium, design: .monospaced))
                .tracking(5)
                .foregroundStyle(.white.opacity(0.4))

            // Route presets grid.
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                ForEach(presets, id: \.name) { preset in
                    let isSelected = config.departureIATA == preset.dep && config.arrivalIATA == preset.arr
                    Button(action: {
                        config.departureIATA = preset.dep
                        config.arrivalIATA   = preset.arr
                        applyIATACoordinates(dep: preset.dep, arr: preset.arr)
                    }) {
                        VStack(alignment: .leading, spacing: 6) {
                            HStack(spacing: 8) {
                                Text(preset.dep)
                                    .font(.system(size: 15, weight: .semibold, design: .monospaced))
                                    .foregroundStyle(isSelected ? Color(red: 1, green: 0.55, blue: 0.1) : .white)
                                Text("→")
                                    .foregroundStyle(.white.opacity(0.3))
                                Text(preset.arr)
                                    .font(.system(size: 15, weight: .semibold, design: .monospaced))
                                    .foregroundStyle(isSelected ? Color(red: 1, green: 0.55, blue: 0.1) : .white)
                            }
                            Text(preset.name)
                                .font(.system(size: 10, weight: .regular, design: .monospaced))
                                .foregroundStyle(.white.opacity(0.35))
                                .lineLimit(1)
                        }
                        .padding(.horizontal, 14)
                        .padding(.vertical, 12)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(isSelected ? Color(red: 1, green: 0.55, blue: 0.1).opacity(0.12) : Color.white.opacity(0.05))
                        .overlay(
                            RoundedRectangle(cornerRadius: 8)
                                .stroke(isSelected ? Color(red: 1, green: 0.55, blue: 0.1).opacity(0.5) : Color.white.opacity(0.08), lineWidth: 1)
                        )
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                    }
                    .animation(.easeInOut(duration: 0.15), value: isSelected)
                }
            }
        }
        .padding(.horizontal, 40)
    }

    private func applyIATACoordinates(dep: String, arr: String) {
        // Hardcoded airport coords for the 6 presets.
        let coords: [String: (Float, Float)] = [
            "LAX": (-118.4085,  33.9425),
            "LHR": (  -0.4543,  51.4775),
            "JFK": ( -73.7789,  40.6413),
            "CDG": (   2.5479,  49.0097),
            "SFO": (-122.3789,  37.6213),
            "NRT": ( 140.3864,  35.7647),
            "ORD": ( -87.9048,  41.9742),
            "FRA": (   8.5622,  50.0379),
            "SYD": ( 151.1772, -33.9399),
            "MIA": ( -80.2870,  25.7959),
            "GRU": ( -46.4731, -23.4356)
        ]
        if let d = coords[dep] { config.depLon = d.0; config.depLat = d.1 }
        if let a = coords[arr] { config.arrLon = a.0; config.arrLat = a.1 }
    }
}

// MARK: - Step 3: Timing

struct TimingStep: View {
    @Binding var config: CabinSessionConfig

    private let sessionOptions: [Float] = [45, 60, 90, 120, 150, 180]
    private let sprintOptions:  [Float] = [15, 20, 25, 30, 45, 50]
    private let breakOptions:   [Float] = [5, 7, 10, 15]

    var body: some View {
        VStack(spacing: 32) {
            Text("PLAN YOUR FLIGHT")
                .font(.system(size: 11, weight: .medium, design: .monospaced))
                .tracking(5)
                .foregroundStyle(.white.opacity(0.4))

            VStack(spacing: 20) {
                TimingRow(label: "TOTAL SESSION",  unit: "min",
                          options: sessionOptions, selected: $config.totalMinutes)
                TimingRow(label: "SPRINT LENGTH",  unit: "min",
                          options: sprintOptions,  selected: $config.sprintMinutes)
                TimingRow(label: "BREAK LENGTH",   unit: "min",
                          options: breakOptions,   selected: $config.breakMinutes)
                TimingRow(label: "TAXI / EMAIL",   unit: "min",
                          options: [3, 5, 7, 10],  selected: $config.taxiMinutes)
            }

            // Flight summary.
            let sprints = Int(config.totalMinutes / (config.sprintMinutes + config.breakMinutes))
            Text("\(sprints) SPRINTS — APPROX. \(Int(config.totalMinutes)) MIN FLIGHT")
                .font(.system(size: 11, weight: .regular, design: .monospaced))
                .tracking(2)
                .foregroundStyle(Color(red: 1, green: 0.55, blue: 0.1).opacity(0.8))
        }
        .padding(.horizontal, 40)
    }
}

struct TimingRow: View {
    let label:   String
    let unit:    String
    let options: [Float]
    @Binding var selected: Float

    var body: some View {
        HStack(spacing: 16) {
            Text(label)
                .font(.system(size: 10, weight: .medium, design: .monospaced))
                .tracking(2)
                .foregroundStyle(.white.opacity(0.4))
                .frame(width: 140, alignment: .trailing)

            HStack(spacing: 6) {
                ForEach(options, id: \.self) { opt in
                    let isSelected = selected == opt
                    Button(action: { selected = opt }) {
                        Text("\(Int(opt))")
                            .font(.system(size: 13, weight: isSelected ? .semibold : .regular, design: .monospaced))
                            .foregroundStyle(isSelected ? .black : .white.opacity(0.6))
                            .frame(width: 44, height: 34)
                            .background(isSelected ? Color(red: 1, green: 0.55, blue: 0.1) : Color.white.opacity(0.06))
                            .clipShape(RoundedRectangle(cornerRadius: 6))
                    }
                    .animation(.easeInOut(duration: 0.12), value: isSelected)
                }
            }
        }
    }
}
