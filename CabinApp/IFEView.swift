// IFEView.swift
// Diegetic in-flight entertainment dashboard rendered by SwiftUI.
// This view is both visible in Split View and rasterised into a Metal texture
// for projection onto the Unreal Engine cabin monitor.

import SwiftUI

struct IFEView: View {

    @EnvironmentObject var sessionEngine: SessionEngine
    @EnvironmentObject var audioController: AudioController

    var body: some View {
        GeometryReader { geo in
            ZStack {
                Color.black

                switch sessionEngine.ifeMode {
                case .flightMap:
                    FlightMapMode(size: geo.size)
                case .bigClock:
                    BigClockMode(size: geo.size)
                case .tailCam:
                    TailCameraMode(size: geo.size)
                }

                // Invisible tap target over the whole IFE.
                Color.clear
                    .contentShape(Rectangle())
                    .onTapGesture {
                        withAnimation(.easeInOut(duration: 0.25)) {
                            sessionEngine.cycleIFEMode()
                        }
                        audioController.playIFETap()
                    }
            }
            .overlay(alignment: .topTrailing) {
                Capsule(style: .continuous)
                    .fill(.ultraThinMaterial.opacity(0.12))
                    .overlay(
                        Text(sessionEngine.ifeMode.label.uppercased())
                            .font(.system(size: 12, weight: .semibold, design: .rounded))
                            .foregroundStyle(.white.opacity(0.82))
                            .tracking(1.8)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 8)
                    )
                    .padding(20)
            }
            .drawingGroup(opaque: true, colorMode: .linear)
            .onAppear {
                sessionEngine.ensureIFETexture(size: geo.size)
            }
            .onChange(of: geo.size) { newSize in
                sessionEngine.ensureIFETexture(size: newSize)
            }
        }
    }
}

// MARK: - Mode 1: Flight Map

private struct FlightMapMode: View {
    let size: CGSize
    @EnvironmentObject var sessionEngine: SessionEngine

    var body: some View {
        let t = sessionEngine.telemetry
        ZStack {
            LinearGradient(
                colors: [Color(red: 0.02, green: 0.03, blue: 0.05), .black],
                startPoint: .top,
                endPoint: .bottom
            )

            Canvas { context, canvasSize in
                let rect = CGRect(origin: .zero, size: canvasSize)
                let center = CGPoint(x: rect.midX, y: rect.midY * 0.82)
                let globeRadius = min(rect.width * 0.28, rect.height * 0.33)

                var globe = Path()
                globe.addEllipse(in: CGRect(
                    x: center.x - globeRadius,
                    y: center.y - globeRadius,
                    width: globeRadius * 2,
                    height: globeRadius * 2
                ))

                context.fill(globe, with: .radialGradient(
                    Gradient(colors: [Color(red: 0.06, green: 0.12, blue: 0.18), Color.black]),
                    center: center,
                    startRadius: 0,
                    endRadius: globeRadius * 1.1
                ))
                context.stroke(globe, with: .color(.white.opacity(0.18)), lineWidth: 2)

                // Latitude rings.
                for i in -2...2 {
                    let ringScale = 1.0 - abs(Double(i)) * 0.16
                    let ringHeight = globeRadius * CGFloat(ringScale) * 0.42
                    let ringRect = CGRect(
                        x: center.x - globeRadius,
                        y: center.y - ringHeight,
                        width: globeRadius * 2,
                        height: ringHeight * 2
                    )
                    var ring = Path(ellipseIn: ringRect)
                    context.stroke(ring, with: .color(.white.opacity(0.08)), lineWidth: 1)
                }

                // Longitude arcs.
                for i in -3...3 {
                    let arcScale = 1.0 - abs(Double(i)) * 0.12
                    let arcWidth = globeRadius * CGFloat(arcScale) * 0.48
                    let arcRect = CGRect(
                        x: center.x - arcWidth,
                        y: center.y - globeRadius,
                        width: arcWidth * 2,
                        height: globeRadius * 2
                    )
                    var arc = Path(ellipseIn: arcRect)
                    context.stroke(arc, with: .color(.white.opacity(0.06)), lineWidth: 1)
                }

                // Very simple projected route based on progress only.
                let start = CGPoint(x: center.x - globeRadius * 0.62, y: center.y + globeRadius * 0.12)
                let end   = CGPoint(x: center.x + globeRadius * 0.56, y: center.y - globeRadius * 0.18)
                let ctrl  = CGPoint(x: center.x, y: center.y - globeRadius * 0.72)
                var route = Path()
                route.move(to: start)
                route.addQuadCurve(to: end, control: ctrl)
                context.stroke(route, with: .color(Color.cyan.opacity(0.8)), style: StrokeStyle(lineWidth: 4, lineCap: .round))

                // Plane dot along route.
                let p = max(0, min(1, CGFloat(t.routeProgress)))
                let plane = quadBezierPoint(start: start, control: ctrl, end: end, t: p)
                let planeRect = CGRect(x: plane.x - 6, y: plane.y - 6, width: 12, height: 12)
                context.fill(Path(ellipseIn: planeRect), with: .color(.white))
                context.addFilter(.shadow(color: .white.opacity(0.45), radius: 8, x: 0, y: 0))
                context.fill(Path(ellipseIn: planeRect.insetBy(dx: -10, dy: -10)), with: .color(Color.cyan.opacity(0.16)))
            }

            VStack(spacing: 0) {
                Spacer(minLength: size.height * 0.08)

                Text("CABIN FLIGHT MAP")
                    .font(.system(size: 22, weight: .semibold, design: .rounded))
                    .foregroundStyle(.white.opacity(0.92))
                    .tracking(3.2)

                Spacer()

                telemetryStrip(
                    timeToDestination: t.timeToDestination,
                    altitudeFeet: t.altitudeFeet,
                    groundSpeedKnots: t.groundSpeedKnots
                )
                .padding(.horizontal, 36)
                .padding(.bottom, 32)
            }
        }
    }

    private func telemetryStrip(timeToDestination: TimeInterval, altitudeFeet: Float, groundSpeedKnots: Float) -> some View {
        HStack(spacing: 18) {
            TelemetryCard(title: "TIME TO DESTINATION", value: formatHMS(timeToDestination))
            TelemetryCard(title: "ALTITUDE", value: "\(Int(altitudeFeet.rounded())) ft")
            TelemetryCard(title: "GROUND SPEED", value: "\(Int(groundSpeedKnots.rounded())) kt")
        }
    }

    private func quadBezierPoint(start: CGPoint, control: CGPoint, end: CGPoint, t: CGFloat) -> CGPoint {
        let mt = 1 - t
        let x = mt * mt * start.x + 2 * mt * t * control.x + t * t * end.x
        let y = mt * mt * start.y + 2 * mt * t * control.y + t * t * end.y
        return CGPoint(x: x, y: y)
    }
}

// MARK: - Mode 2: Big Clock

private struct BigClockMode: View {
    let size: CGSize
    @EnvironmentObject var sessionEngine: SessionEngine

    var body: some View {
        let remaining = sessionEngine.isInBreak
            ? sessionEngine.telemetry.breakRemaining
            : sessionEngine.telemetry.sprintRemaining

        VStack(spacing: 26) {
            Spacer()

            Text(sessionEngine.isInBreak ? "BREAK" : "FOCUS")
                .font(.system(size: 20, weight: .medium, design: .rounded))
                .tracking(5)
                .foregroundStyle(.white.opacity(0.58))

            TimelineView(.animation(minimumInterval: 1.0, paused: false)) { _ in
                Text(formatClock(remaining))
                    .font(.system(size: min(size.width * 0.16, 128), weight: .thin, design: .rounded))
                    .foregroundStyle(.white)
                    .monospacedDigit()
                    .tracking(2)
                    .contentTransition(.numericText())
            }

            Text("SPRINT \(max(sessionEngine.telemetry.currentSprint, 1)) OF \(max(sessionEngine.telemetry.totalSprints, 1))")
                .font(.system(size: 16, weight: .semibold, design: .rounded))
                .tracking(3.2)
                .foregroundStyle(.white.opacity(0.42))

            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.black)
    }
}

// MARK: - Mode 3: Tail Camera

private struct TailCameraMode: View {
    let size: CGSize
    @EnvironmentObject var sessionEngine: SessionEngine

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [Color(red: 0.08, green: 0.12, blue: 0.2), Color(red: 0.02, green: 0.03, blue: 0.05)],
                startPoint: .top,
                endPoint: .bottom
            )

            Canvas { context, canvasSize in
                let horizonY = canvasSize.height * 0.58

                // Sky glow.
                let skyRect = CGRect(x: 0, y: 0, width: canvasSize.width, height: horizonY)
                context.fill(Path(skyRect), with: .linearGradient(
                    Gradient(colors: [Color(red: 0.22, green: 0.34, blue: 0.56), Color(red: 0.04, green: 0.08, blue: 0.16)]),
                    startPoint: .zero,
                    endPoint: CGPoint(x: 0, y: horizonY)
                ))

                // Clouds.
                for idx in 0..<9 {
                    let frac = CGFloat(idx) / 8.0
                    let y = horizonY + sin(frac * .pi * 2 + CGFloat(sessionEngine.telemetry.routeProgress) * 8) * 14
                    let x = frac * canvasSize.width
                    let w = canvasSize.width * 0.22
                    let h = canvasSize.height * 0.08
                    let cloudRect = CGRect(x: x - w * 0.5, y: y, width: w, height: h)
                    context.fill(Path(ellipseIn: cloudRect), with: .color(.white.opacity(0.16)))
                }

                // Simple tail silhouette.
                var tail = Path()
                tail.move(to: CGPoint(x: canvasSize.width * 0.50, y: canvasSize.height * 0.86))
                tail.addLine(to: CGPoint(x: canvasSize.width * 0.55, y: canvasSize.height * 0.56))
                tail.addLine(to: CGPoint(x: canvasSize.width * 0.58, y: canvasSize.height * 0.56))
                tail.addLine(to: CGPoint(x: canvasSize.width * 0.53, y: canvasSize.height * 0.90))
                tail.closeSubpath()
                context.fill(tail, with: .color(.black.opacity(0.85)))
            }

            VStack {
                HStack {
                    Text("TAIL CAMERA")
                        .font(.system(size: 18, weight: .semibold, design: .rounded))
                        .tracking(3)
                        .foregroundStyle(.white.opacity(0.86))
                    Spacer()
                    HStack(spacing: 6) {
                        Circle().fill(Color.red).frame(width: 9, height: 9)
                        Text("LIVE")
                            .font(.system(size: 14, weight: .semibold, design: .rounded))
                            .tracking(2)
                    }
                    .foregroundStyle(.white.opacity(0.9))
                }
                .padding(26)

                Spacer()
            }
        }
    }
}

// MARK: - Reusable Telemetry Cell

private struct TelemetryCard: View {
    let title: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title)
                .font(.system(size: 12, weight: .semibold, design: .rounded))
                .tracking(2.4)
                .foregroundStyle(.white.opacity(0.5))
            Text(value)
                .font(.system(size: 28, weight: .medium, design: .rounded))
                .foregroundStyle(.white.opacity(0.94))
                .monospacedDigit()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 18)
        .padding(.vertical, 16)
        .background(Color.white.opacity(0.045), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .stroke(Color.white.opacity(0.08), lineWidth: 1)
        )
    }
}

// MARK: - Formatting Helpers

private func formatClock(_ interval: TimeInterval) -> String {
    let total = max(Int(interval.rounded(.down)), 0)
    let mins = total / 60
    let secs = total % 60
    return String(format: "%02d:%02d", mins, secs)
}

private func formatHMS(_ interval: TimeInterval) -> String {
    let total = max(Int(interval.rounded(.down)), 0)
    let h = total / 3600
    let m = (total % 3600) / 60
    let s = total % 60
    return String(format: "%02d:%02d:%02d", h, m, s)
}
