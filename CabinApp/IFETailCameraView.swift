// IFETailCameraView.swift
// Mode 3: The Tail Camera — simulated live feed from the tail of the aircraft.
// Procedurally animated cloud layers using TimelineView for a continuous,
// smooth cloud-rush effect without video files.
//
// Three parallax cloud layers move at different speeds.
// A subtle vignette and scanline overlay sells the "camera feed" aesthetic.
// Phase-aware: boarding shows ground, cruise shows cloud sea, descent shows terrain.

import SwiftUI

struct IFETailCameraView: View {
    let phase: CabinPhase

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 60.0)) { timeline in
            let t = timeline.date.timeIntervalSinceReferenceDate
            TailCameraCanvas(t: t, phase: phase)
        }
    }
}

struct TailCameraCanvas: View {
    let t:     TimeInterval
    let phase: CabinPhase

    var body: some View {
        Canvas { ctx, size in
            // Background sky gradient based on phase.
            let skyColors = skyGradient(for: phase)
            ctx.fill(
                Path(CGRect(origin: .zero, size: size)),
                with: .linearGradient(
                    Gradient(colors: skyColors),
                    startPoint: .init(x: 0, y: 0),
                    endPoint:   .init(x: 0, y: size.height)
                )
            )

            switch phase {
            case .boarding, .preDeparture:
                drawGround(ctx: ctx, size: size, t: t)
            case .cruise, .breakPhase:
                drawClouds(ctx: ctx, size: size, t: t)
            case .descent, .landing:
                drawDescentView(ctx: ctx, size: size, t: t)
            default:
                drawClouds(ctx: ctx, size: size, t: t)
            }

            // Aircraft tail silhouette (static, bottom-center).
            drawTailSilhouette(ctx: ctx, size: size)

            // Camera vignette.
            drawVignette(ctx: ctx, size: size)

            // Subtle scanlines for "camera" feel.
            drawScanlines(ctx: ctx, size: size)

            // "LIVE" badge.
            ctx.draw(
                Text("● LIVE")
                    .font(.system(size: 13, weight: .bold, design: .monospaced))
                    .foregroundColor(.red),
                at: CGPoint(x: size.width - 50, y: 22)
            )

            // Camera label.
            ctx.draw(
                Text("TAIL CAM")
                    .font(.system(size: 11, weight: .regular, design: .monospaced))
                    .foregroundColor(.white.opacity(0.5)),
                at: CGPoint(x: 50, y: 22)
            )
        }
    }

    // MARK: - Sky gradient

    private func skyGradient(for phase: CabinPhase) -> [Color] {
        switch phase {
        case .boarding, .preDeparture:
            // Pre-dawn gate: deep blue-grey.
            return [Color(red: 0.15, green: 0.18, blue: 0.25), Color(red: 0.30, green: 0.32, blue: 0.38)]
        case .cruise, .breakPhase:
            // Mid-flight: deep blue above, lighter at horizon.
            return [Color(red: 0.05, green: 0.10, blue: 0.28), Color(red: 0.45, green: 0.60, blue: 0.80)]
        case .descent, .landing:
            // Golden hour descent.
            return [Color(red: 0.20, green: 0.25, blue: 0.45), Color(red: 0.90, green: 0.55, blue: 0.20)]
        default:
            return [Color(red: 0.10, green: 0.15, blue: 0.35), Color(red: 0.50, green: 0.65, blue: 0.85)]
        }
    }

    // MARK: - Cloud layers (parallax rush)

    private func drawClouds(ctx: GraphicsContext, size: CGSize, t: TimeInterval) {
        // Three parallax layers — different speeds and opacities.
        let layers: [(speed: Double, yFraction: ClosedRange<Double>, opacity: Double, scale: Double)] = [
            (speed: 60, yFraction: 0.55...0.70, opacity: 0.85, scale: 1.4),  // near
            (speed: 35, yFraction: 0.45...0.58, opacity: 0.55, scale: 1.0),  // mid
            (speed: 18, yFraction: 0.38...0.48, opacity: 0.30, scale: 0.6)   // far
        ]

        for layer in layers {
            let seed = Int(layer.speed * 10)
            for i in 0..<8 {
                let seededRand = seededFloat(seed: seed + i * 37)
                let baseX = seededRand * size.width
                // Move clouds right-to-left (jet flying forward).
                let offset = CGFloat(t * layer.speed).truncatingRemainder(dividingBy: size.width)
                let x = (baseX - offset + size.width * 2).truncatingRemainder(dividingBy: size.width)
                let yFrac = layer.yFraction.lowerBound +
                    seededFloat(seed: seed + i * 13) * (layer.yFraction.upperBound - layer.yFraction.lowerBound)
                let y = size.height * yFrac
                let w = size.width * 0.18 * layer.scale * (0.6 + seededFloat(seed: seed + i * 7) * 0.8)
                let h = w * 0.28

                drawCloudPuff(ctx: ctx, center: CGPoint(x: x, y: y), width: w, height: h,
                              opacity: layer.opacity)
            }
        }
    }

    private func drawCloudPuff(ctx: GraphicsContext, center: CGPoint, width: CGFloat, height: CGFloat, opacity: Double) {
        // Cloud = 5 overlapping white ellipses.
        for j in 0..<5 {
            let jf = CGFloat(j)
            let ex = center.x + (jf - 2) * width * 0.22
            let ey = center.y - seededFloat(seed: Int(center.x) + j * 17) * height * 0.4
            let ew = width * (0.4 + seededFloat(seed: Int(center.y) + j * 23) * 0.4)
            let eh = height * (0.6 + seededFloat(seed: j * 31) * 0.3)
            let path = Path(ellipseIn: CGRect(x: ex - ew/2, y: ey - eh/2, width: ew, height: eh))
            ctx.fill(path, with: .color(.white.opacity(opacity * 0.9)))
        }
    }

    // MARK: - Ground (boarding)

    private func drawGround(ctx: GraphicsContext, size: CGSize, t: TimeInterval) {
        // Static tarmac.
        let groundRect = CGRect(x: 0, y: size.height * 0.6, width: size.width, height: size.height * 0.4)
        ctx.fill(Path(groundRect), with: .color(Color(red: 0.25, green: 0.27, blue: 0.25)))
        // Runway markings.
        for i in 0..<12 {
            let x = CGFloat(i) * size.width / 12 + CGFloat(t * 15).truncatingRemainder(dividingBy: size.width / 12)
            let markRect = CGRect(x: x, y: size.height * 0.72, width: size.width / 30, height: 8)
            ctx.fill(Path(markRect), with: .color(.white.opacity(0.6)))
        }
    }

    // MARK: - Descent terrain

    private func drawDescentView(ctx: GraphicsContext, size: CGSize, t: TimeInterval) {
        // Stylised terrain grid (approaching city).
        let groundRect = CGRect(x: 0, y: size.height * 0.55, width: size.width, height: size.height * 0.45)
        ctx.fill(Path(groundRect), with: .color(Color(red: 0.20, green: 0.24, blue: 0.20)))
        // Grid lines.
        let spacing: CGFloat = 60
        let shift = CGFloat(t * 40).truncatingRemainder(dividingBy: spacing)
        for i in 0..<30 {
            let x = CGFloat(i) * spacing - shift
            var p = Path()
            p.move(to: CGPoint(x: x, y: size.height * 0.55))
            p.addLine(to: CGPoint(x: x + 40, y: size.height))
            ctx.stroke(p, with: .color(.white.opacity(0.08)), lineWidth: 1)
        }
        // Thin clouds.
        drawClouds(ctx: ctx, size: size, t: t)
    }

    // MARK: - Tail silhouette

    private func drawTailSilhouette(ctx: GraphicsContext, size: CGSize) {
        // Simple swept-wing tail shape at bottom-center.
        let cx = size.width / 2
        let by = size.height
        var path = Path()
        path.move(to:    CGPoint(x: cx - 40,  y: by - 30))
        path.addLine(to: CGPoint(x: cx - 180, y: by))
        path.addLine(to: CGPoint(x: cx + 180, y: by))
        path.addLine(to: CGPoint(x: cx + 40,  y: by - 30))
        path.addLine(to: CGPoint(x: cx,        y: by - 120))
        path.closeSubpath()
        ctx.fill(path, with: .color(.black.opacity(0.85)))
    }

    // MARK: - Vignette

    private func drawVignette(ctx: GraphicsContext, size: CGSize) {
        var path = Path(CGRect(origin: .zero, size: size))
        ctx.fill(path, with: .radialGradient(
            Gradient(colors: [.clear, .black.opacity(0.45)]),
            center: .init(x: size.width / 2, y: size.height / 2),
            startRadius: size.width * 0.3,
            endRadius:   size.width * 0.75
        ))
    }

    // MARK: - Scanlines

    private func drawScanlines(ctx: GraphicsContext, size: CGSize) {
        var i: CGFloat = 0
        while i < size.height {
            var line = Path()
            line.move(to: CGPoint(x: 0, y: i))
            line.addLine(to: CGPoint(x: size.width, y: i))
            ctx.stroke(line, with: .color(.black.opacity(0.06)), lineWidth: 1)
            i += 3
        }
    }

    // MARK: - Seeded pseudo-random

    private func seededFloat(seed: Int) -> CGFloat {
        // Simple LCG — deterministic so cloud positions don’t jitter between frames.
        let v = (seed &* 1664525 &+ 1013904223) & 0x7FFFFFFF
        return CGFloat(v % 10000) / 10000.0
    }
}
