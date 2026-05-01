// IFEBigClockView.swift
// Mode 2: The Big Clock — pure focus.
// Massive Pomodoro sprint countdown in white-on-black.
// The only element on screen is time.
//
// Swift 6: replaced DispatchQueue.main.asyncAfter in the breathe animation
// with a Task { @MainActor } + Task.sleep so the continuation is isolated.

import SwiftUI

struct IFEBigClockView: View {
    let telemetry: TelemetrySnapshot

    @State private var isBreathing = false
    @State private var breatheTask: Task<Void, Never>? = nil

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            VStack(spacing: 24) {
                // Sprint label
                Text("SPRINT \(telemetry.currentSprint) OF \(telemetry.totalSprints)")
                    .font(.system(size: 16, weight: .regular, design: .monospaced))
                    .tracking(6)
                    .foregroundStyle(.white.opacity(0.3))

                // The massive clock
                Text(telemetry.sprintRemainingFormatted)
                    .font(.system(size: 220, weight: .ultraLight, design: .monospaced))
                    .foregroundStyle(.white)
                    .scaleEffect(isBreathing ? 1.004 : 1.0)
                    .contentTransition(.numericText(countsDown: true))
                    .animation(
                        .easeInOut(duration: 0.12),
                        value: telemetry.sprintRemainingSeconds
                    )

                // Progress bar
                SprintProgressBar(telemetry: telemetry)
                    .frame(width: 480, height: 2)
            }
        }
        .onChange(of: Int(telemetry.sprintRemainingSeconds)) { _, _ in
            // Cancel any in-flight breathe so we don't stack tasks.
            breatheTask?.cancel()
            breatheTask = Task { @MainActor in
                withAnimation(.easeOut(duration: 0.08)) { isBreathing = true }
                try? await Task.sleep(for: .milliseconds(80))
                guard !Task.isCancelled else { return }
                withAnimation(.easeIn(duration: 0.12)) { isBreathing = false }
                breatheTask = nil
            }
        }
    }
}

struct SprintProgressBar: View {
    let telemetry: TelemetrySnapshot

    private var progress: Double {
        guard telemetry.sprintRemainingSeconds > 0 else { return 0 }
        let total: Float = 25 * 60
        return Double(1 - (telemetry.sprintRemainingSeconds / total))
    }

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Rectangle()
                    .fill(.white.opacity(0.10))
                Rectangle()
                    .fill(.white.opacity(0.75))
                    .frame(width: geo.size.width * progress)
                    .animation(.linear(duration: 1), value: progress)
            }
        }
    }
}
