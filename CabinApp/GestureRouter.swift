// GestureRouter.swift
// Translates SwiftUI drag gestures into UE camera yaw/pitch deltas
// and maps normalised tap coordinates to diegetic UI hotspots.

import SwiftUI
import UIKit

// Diegetic tap targets — all in normalised [0,1] screen space.
struct TapHotspot {
    let id:     String
    let region: CGRect   // normalised
    let action: () -> Void
}

@MainActor
final class GestureRouter: ObservableObject {

    // MARK: - Camera pan sensitivity
    // Degrees of rotation per point of drag.
    private let yawSensitivity:   Float = 0.12
    private let pitchSensitivity: Float = 0.08

    // Clamp pitch so the user can't look straight up/down.
    private let pitchMin: Float = -35
    private let pitchMax: Float =  25

    // Accumulated camera angles (relative to seat forward vector).
    private var yawDeg:   Float = 0
    private var pitchDeg: Float = 0

    // Last drag translation for delta computation.
    private var lastTranslation: CGSize = .zero
    private var isDragging = false

    // MARK: - Tap hotspots (registered by IFEView / OnboardingView)
    private var hotspots: [TapHotspot] = []

    // MARK: - Drag handling

    func handleDrag(translation: CGSize, viewSize: CGSize) {
        guard viewSize.width > 0, viewSize.height > 0 else { return }

        let dx = Float(translation.width  - lastTranslation.width)
        let dy = Float(translation.height - lastTranslation.height)
        lastTranslation = translation

        // Points → degrees.
        let deltaYaw   =  dx * yawSensitivity
        let deltaPitch = -dy * pitchSensitivity

        yawDeg   += deltaYaw
        pitchDeg  = min(pitchMax, max(pitchMin, pitchDeg + deltaPitch))

        // Send to UE as radians/s (approximate — UE integrates over dt).
        let yawRad   = Float(deltaYaw   * .pi / 180)
        let pitchRad = Float(deltaPitch * .pi / 180)
        CabinBridge_SendGyro(yawRad, pitchRad)
    }

    func endDrag() {
        lastTranslation = .zero
        isDragging = false

        // Gentle spring back toward forward gaze if yaw is small.
        if abs(yawDeg) < 15 && abs(pitchDeg) < 10 {
            springBackToCenter()
        }
    }

    private func springBackToCenter() {
        let steps = 20
        let yawStep   = -yawDeg   / Float(steps)
        let pitchStep = -pitchDeg / Float(steps)
        for i in 1...steps {
            let delay = Double(i) * 0.016   // ~60fps cadence
            DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in
                guard let self else { return }
                CabinBridge_SendGyro(
                    yawStep   * .pi / 180,
                    pitchStep * .pi / 180
                )
            }
        }
        yawDeg   = 0
        pitchDeg = 0
    }

    // MARK: - Tap handling

    func registerHotspot(_ hotspot: TapHotspot) {
        hotspots.removeAll { $0.id == hotspot.id }
        hotspots.append(hotspot)
    }

    func handleTap(at normPoint: CGPoint) {
        CabinBridge_SendTap(Float(normPoint.x), Float(normPoint.y))

        // Check SwiftUI-registered hotspots first.
        for spot in hotspots {
            if spot.region.contains(normPoint) {
                spot.action()
                return
            }
        }
    }

    // Called by UITapGestureRecognizer installed on the MTKView.
    func handleUIKitTap(location: CGPoint, viewSize: CGSize) {
        guard viewSize.width > 0, viewSize.height > 0 else { return }
        let norm = CGPoint(
            x: location.x / viewSize.width,
            y: location.y / viewSize.height
        )
        handleTap(at: norm)
    }
}
