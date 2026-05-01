// IFESplitStripView.swift
// Compact IFE strip for Split View / Stage Manager mode.
// Shows only the essential timer and phase status —
// the full cabin environment still runs on the left pane.
// Width: 280-320pt. Height: fills the window.

import SwiftUI

struct IFESplitStripView: View {
    @EnvironmentObject var session: SessionEngine

    var body: some View {
        VStack(spacing: 0) {
            // Header.
            VStack(spacing: 4) {
                Text("CABIN")
                    .font(.system(size: 10, weight: .semibold, design: .monospaced))
                    .tracking(5)
                    .foregroundStyle(.white.opacity(0.5))
                Text(phaseLabel(session.currentPhase))
                    .font(.system(size: 11, weight: .regular, design: .monospaced))
                    .tracking(3)
                    .foregroundStyle(Color(red: 1, green: 0.55, blue: 0.1))
            }
            .padding(.top, 24)
            .padding(.bottom, 16)

            Divider().background(Color.white.opacity(0.08))

            // Sprint clock — the main focus element.
            VStack(spacing: 8) {
                Text(session.telemetry.sprintRemainingFormatted)
                    .font(.system(size: 52, weight: .ultraLight, design: .monospaced))
                    .foregroundStyle(.white)
                    .contentTransition(.numericText(countsDown: true))
                    .monospacedDigit()

                Text("SPRINT \(session.telemetry.currentSprint) / \(session.telemetry.totalSprints)")
                    .font(.system(size: 10, weight: .regular, design: .monospaced))
                    .tracking(2)
                    .foregroundStyle(.white.opacity(0.3))
            }
            .padding(.vertical, 28)

            // Progress bar.
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Rectangle().fill(Color.white.opacity(0.08))
                    Rectangle()
                        .fill(Color(red: 1, green: 0.55, blue: 0.1))
                        .frame(width: geo.size.width * sprintProgress)
                        .animation(.linear(duration: 1), value: sprintProgress)
                }
            }
            .frame(height: 2)
            .padding(.horizontal, 24)

            Divider().background(Color.white.opacity(0.08)).padding(.top, 20)

            // Telemetry mini-cells.
            VStack(spacing: 0) {
                MiniTelemetryCell(label: "TO DEST",
                                  value: session.telemetry.timeToDestinationFormatted)
                Divider().background(Color.white.opacity(0.05))
                MiniTelemetryCell(label: "ALTITUDE",
                                  value: session.telemetry.altitudeFormatted)
                Divider().background(Color.white.opacity(0.05))
                MiniTelemetryCell(label: "SPEED",
                                  value: session.telemetry.speedFormatted)
            }

            Spacer()

            // IFE mode toggle.
            Button(action: { session.cycleIFEMode() }) {
                HStack(spacing: 8) {
                    Image(systemName: ifeModeIcon(session.ifeMode))
                        .font(.system(size: 13))
                    Text(ifeModeName(session.ifeMode))
                        .font(.system(size: 10, weight: .medium, design: .monospaced))
                        .tracking(2)
                }
                .foregroundStyle(.white.opacity(0.5))
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
                .background(.white.opacity(0.04))
                .clipShape(RoundedRectangle(cornerRadius: 8))
            }
            .padding(.bottom, 32)
        }
        .frame(maxWidth: .infinity)
        .background(Color(red: 0.07, green: 0.08, blue: 0.10))
    }

    // MARK: - Helpers

    private var sprintProgress: Double {
        let total: Float = 25 * 60
        guard total > 0 else { return 0 }
        return Double(1 - session.telemetry.sprintRemainingSeconds / total)
    }

    private func phaseLabel(_ phase: CabinPhase) -> String {
        switch phase {
        case .boarding:     return "AT GATE"
        case .preDeparture: return "PRE-DEPARTURE"
        case .taxi:         return "TAXIING"
        case .takeoff:      return "TAKEOFF"
        case .cruise:       return "EN ROUTE"
        case .breakPhase:   return "BREAK"
        case .descent:      return "DESCENDING"
        case .landing:      return "LANDING"
        case .gateArrival:  return "ARRIVED"
        }
    }

    private func ifeModeIcon(_ mode: IFEMode) -> String {
        switch mode {
        case .flightMap:  return "globe"
        case .bigClock:   return "timer"
        case .tailCamera: return "video"
        }
    }

    private func ifeModeName(_ mode: IFEMode) -> String {
        switch mode {
        case .flightMap:  return "FLIGHT MAP"
        case .bigClock:   return "BIG CLOCK"
        case .tailCamera: return "TAIL CAM"
        }
    }
}

struct MiniTelemetryCell: View {
    let label: String
    let value: String

    var body: some View {
        HStack {
            Text(label)
                .font(.system(size: 9, weight: .regular, design: .monospaced))
                .tracking(2)
                .foregroundStyle(.white.opacity(0.3))
            Spacer()
            Text(value)
                .font(.system(size: 13, weight: .light, design: .monospaced))
                .foregroundStyle(.white.opacity(0.7))
                .contentTransition(.numericText())
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 12)
    }
}
