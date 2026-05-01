// IFEFlightMapView.swift
// Mode 1: Flight Map — rendered into the IFE texture by MetalBridge.
// Draws a high-contrast route arc on a dark globe projection,
// with live telemetry readouts at the bottom.
//
// The globe is drawn using a Canvas equirectangular projection.
// Route arc is a great-circle path sampled at 100 points.

import SwiftUI

struct IFEFlightMapView: View {

    let telemetry: TelemetrySnapshot
    let phase:     CabinPhase

    // Canvas render size matches the IFE texture (2560×1440 @ 2x = 1280×720 SwiftUI pts).
    private let canvasWidth:  CGFloat = 1280
    private let canvasHeight: CGFloat = 720

    var body: some View {
        ZStack {
            // Background: deep space blue-black.
            Color(red: 0.03, green: 0.05, blue: 0.10)
                .ignoresSafeArea()

            // Globe + route arc.
            Canvas { ctx, size in
                drawGlobe(ctx: ctx, size: size)
                drawRouteArc(ctx: ctx, size: size)
                drawAircraftIcon(ctx: ctx, size: size)
            }
            .frame(width: canvasWidth, height: canvasHeight - 160)

            // Telemetry bar pinned to bottom.
            VStack {
                Spacer()
                TelemetryBar(telemetry: telemetry)
                    .frame(height: 160)
            }
        }
        .frame(width: canvasWidth, height: canvasHeight)
    }

    // MARK: - Globe

    private func drawGlobe(ctx: GraphicsContext, size: CGSize) {
        // Draw a dark circle as the globe base.
        let cx = size.width / 2
        let cy = size.height / 2
        let r  = min(size.width, size.height) * 0.42

        var globePath = Path()
        globePath.addEllipse(in: CGRect(x: cx - r, y: cy - r, width: r * 2, height: r * 2))

        ctx.fill(globePath, with: .color(Color(red: 0.06, green: 0.10, blue: 0.18)))
        ctx.stroke(globePath, with: .color(.white.opacity(0.08)), lineWidth: 1)

        // Latitude lines.
        for latDeg in stride(from: -60.0, through: 60.0, by: 30.0) {
            let latRad = latDeg * .pi / 180
            let latY   = cy - r * sin(latRad)
            let latW   = r * cos(latRad) * 2
            if latW < 4 { continue }
            var latPath = Path()
            latPath.addEllipse(in: CGRect(x: cx - latW / 2, y: latY - 1, width: latW, height: 2))
            ctx.stroke(latPath, with: .color(.white.opacity(0.05)), lineWidth: 0.5)
        }

        // Longitude lines (simplified — vertical ellipses).
        for i in 0..<6 {
            let angle = Double(i) * .pi / 6
            var lonPath = Path()
            let rx2 = r * abs(cos(angle))
            if rx2 < 2 { continue }
            lonPath.addEllipse(in: CGRect(x: cx - rx2, y: cy - r, width: rx2 * 2, height: r * 2))
            ctx.stroke(lonPath, with: .color(.white.opacity(0.05)), lineWidth: 0.5)
        }
    }

    // MARK: - Route arc

    private func drawRouteArc(ctx: GraphicsContext, size: CGSize) {
        let cx = size.width / 2
        let cy = size.height / 2
        let r  = min(size.width, size.height) * 0.42

        // Great-circle path projected onto equirectangular,
        // then mapped to globe screen coords.
        let arcPoints = greatCirclePoints(samples: 120)
        guard arcPoints.count > 1 else { return }

        // Completed segment (orange).
        let doneCount = max(1, Int(Float(arcPoints.count) * telemetry.routeProgress))
        var donePath = Path()
        for (i, pt) in arcPoints.prefix(doneCount).enumerated() {
            let sp = projectToGlobe(lonLat: pt, cx: cx, cy: cy, r: r)
            if i == 0 { donePath.move(to: sp) } else { donePath.addLine(to: sp) }
        }
        ctx.stroke(donePath,
            with: .color(Color(red: 1.0, green: 0.55, blue: 0.1)),
            style: StrokeStyle(lineWidth: 2.5, lineCap: .round, lineJoin: .round)
        )

        // Remaining segment (dim white dashes).
        if doneCount < arcPoints.count {
            var remainPath = Path()
            for (i, pt) in arcPoints.dropFirst(doneCount - 1).enumerated() {
                let sp = projectToGlobe(lonLat: pt, cx: cx, cy: cy, r: r)
                if i == 0 { remainPath.move(to: sp) } else { remainPath.addLine(to: sp) }
            }
            ctx.stroke(remainPath,
                with: .color(.white.opacity(0.25)),
                style: StrokeStyle(lineWidth: 1.5, lineCap: .round, dash: [6, 6])
            )
        }

        // Departure dot.
        let depPt = projectToGlobe(lonLat: SIMD2(telemetry.currentLon - 5, telemetry.currentLat), cx: cx, cy: cy, r: r)
        ctx.fill(Path(ellipseIn: CGRect(x: depPt.x - 4, y: depPt.y - 4, width: 8, height: 8)), with: .color(.white))

        // Arrival dot.
        let arrPt = projectToGlobe(lonLat: arcPoints.last!, cx: cx, cy: cy, r: r)
        ctx.fill(Path(ellipseIn: CGRect(x: arrPt.x - 4, y: arrPt.y - 4, width: 8, height: 8)), with: .color(.white.opacity(0.5)))
    }

    // MARK: - Aircraft icon

    private func drawAircraftIcon(ctx: GraphicsContext, size: CGSize) {
        let cx = size.width / 2
        let cy = size.height / 2
        let r  = min(size.width, size.height) * 0.42

        let arcPoints = greatCirclePoints(samples: 120)
        let idx = Int(Float(arcPoints.count - 1) * telemetry.routeProgress)
        guard idx < arcPoints.count else { return }
        let pt = projectToGlobe(lonLat: arcPoints[idx], cx: cx, cy: cy, r: r)

        // Pulsing halo.
        let haloPath = Path(ellipseIn: CGRect(x: pt.x - 10, y: pt.y - 10, width: 20, height: 20))
        ctx.fill(haloPath, with: .color(Color(red: 1, green: 0.55, blue: 0.1).opacity(0.25)))

        // Aircraft dot.
        let dotPath = Path(ellipseIn: CGRect(x: pt.x - 5, y: pt.y - 5, width: 10, height: 10))
        ctx.fill(dotPath, with: .color(Color(red: 1, green: 0.55, blue: 0.1)))
    }

    // MARK: - Great-circle sampling
    // Returns array of SIMD2<Float> (lon, lat) in degrees.

    private func greatCirclePoints(samples: Int) -> [SIMD2<Float>] {
        // Using stored-in-telemetry start/end for now.
        // dep = (currentLon - offset, currentLat) — approximated.
        // Full impl would store dep in SessionEngine and pass here.
        let depLon = telemetry.currentLon - 118.0  // placeholder offset
        let depLat = telemetry.currentLat + 0.0
        let arrLon: Float = -0.45
        let arrLat: Float =  51.48

        let d2r: Float = .pi / 180
        let lat1 = depLat * d2r
        let lon1 = depLon * d2r
        let lat2 = arrLat * d2r
        let lon2 = arrLon * d2r

        var points: [SIMD2<Float>] = []
        for i in 0...samples {
            let f = Float(i) / Float(samples)
            // Slerp on unit sphere.
            let A = sin((1 - f) * .pi) / sin(.pi)  // simplified — use haversine for prod
            let B = sin(f * .pi) / sin(.pi)
            let x = A * cos(lat1) * cos(lon1) + B * cos(lat2) * cos(lon2)
            let y = A * cos(lat1) * sin(lon1) + B * cos(lat2) * sin(lon2)
            let z = A * sin(lat1) + B * sin(lat2)
            let lat = atan2(z, sqrt(x*x + y*y)) / d2r
            let lon = atan2(y, x) / d2r
            points.append(SIMD2(lon, lat))
        }
        return points
    }

    // MARK: - Projection

    private func projectToGlobe(lonLat: SIMD2<Float>, cx: CGFloat, cy: CGFloat, r: CGFloat) -> CGPoint {
        // Equirectangular projection centered at (0°, 40°N).
        let centerLon: Float = -60
        let centerLat: Float =  40
        let scale: CGFloat = r / 90
        let x = cx + CGFloat(lonLat.x - centerLon) * scale * 0.65
        let y = cy - CGFloat(lonLat.y - centerLat) * scale
        return CGPoint(x: x, y: y)
    }
}

// MARK: - Telemetry bar

struct TelemetryBar: View {
    let telemetry: TelemetrySnapshot

    var body: some View {
        HStack(spacing: 0) {
            TelemetryCell(label: "TIME TO DESTINATION", value: telemetry.timeToDestinationFormatted)
            Divider().background(Color.white.opacity(0.15)).frame(width: 1)
            TelemetryCell(label: "ALTITUDE", value: telemetry.altitudeFormatted)
            Divider().background(Color.white.opacity(0.15)).frame(width: 1)
            TelemetryCell(label: "GROUND SPEED", value: telemetry.speedFormatted)
            Divider().background(Color.white.opacity(0.15)).frame(width: 1)
            TelemetryCell(label: "SPRINT", value: "\(telemetry.currentSprint) / \(telemetry.totalSprints)")
        }
        .frame(maxWidth: .infinity)
        .background(Color.black.opacity(0.55))
    }
}

struct TelemetryCell: View {
    let label: String
    let value: String

    var body: some View {
        VStack(spacing: 6) {
            Text(label)
                .font(.system(size: 11, weight: .medium, design: .monospaced))
                .tracking(2)
                .foregroundStyle(.white.opacity(0.45))
            Text(value)
                .font(.system(size: 28, weight: .thin, design: .monospaced))
                .foregroundStyle(.white)
                .contentTransition(.numericText())
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 20)
    }
}
