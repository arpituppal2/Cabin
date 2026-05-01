// GestureRouter.swift
// Translates raw touch events from the transparent overlay into
// meaningful Cabin actions, forwarding them to the C bridge or
// to the SessionEngine as appropriate.
//
// Responsibilities:
//   - Drag-to-look (forwarded to UE via CabinBridge_SendGyro)
//   - Tap-to-interact (forwarded to UE via CabinBridge_SendTap)
//   - Two-finger swipe down -> toggle tray table
//   - Two-finger swipe up   -> stand-up / break walk
//   - Pinch inward          -> activate seat recline HUD
//   - Long press            -> open seat settings overlay

import SwiftUI
import UIKit

// MARK: - Published gesture state

enum CabinGestureEvent {
    case lookDelta(yaw: Float, pitch: Float)
    case tapHotspot(normX: Float, normY: Float)
    case trayTableToggle
    case breakWalkTrigger
    case seatSettingsOpen
    case seatReclineHUD
}

final class GestureRouter: ObservableObject {

    // Subscribers can listen to individual events.
    @Published var lastEvent: CabinGestureEvent? = nil

    // Look sensitivity: full-screen drag ≈ 90°.
    var lookSensitivity: Float = 0.0022

    // Velocity damping for inertial look.
    private var velocity: (yaw: Float, pitch: Float) = (0, 0)
    private let damping: Float = 0.88

    // MARK: - Handlers called by UIKit recognisers

    func handlePan(state: UIGestureRecognizer.State, delta: CGPoint) {
        switch state {
        case .changed:
            let yaw   =  Float(delta.x) * lookSensitivity
            let pitch = -Float(delta.y) * lookSensitivity
            velocity = (yaw: yaw, pitch: pitch)
            CabinBridge_SendGyro(yaw, pitch)
            lastEvent = .lookDelta(yaw: yaw, pitch: pitch)
        case .ended, .cancelled:
            applyInertia()
        default:
            break
        }
    }

    func handleTap(normX: Float, normY: Float) {
        CabinBridge_SendTap(normX, normY)
        lastEvent = .tapHotspot(normX: normX, normY: normY)
    }

    func handleTwoFingerSwipeDown() {
        lastEvent = .trayTableToggle
    }

    func handleTwoFingerSwipeUp() {
        lastEvent = .breakWalkTrigger
    }

    func handleLongPress() {
        lastEvent = .seatSettingsOpen
    }

    func handlePinchIn() {
        lastEvent = .seatReclineHUD
    }

    // MARK: - Inertia

    private func applyInertia() {
        guard abs(velocity.yaw) > 0.0001 || abs(velocity.pitch) > 0.0001 else { return }
        velocity = (yaw: velocity.yaw * damping, pitch: velocity.pitch * damping)
        CabinBridge_SendGyro(velocity.yaw, velocity.pitch)
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.016) { [weak self] in
            self?.applyInertia()
        }
    }
}

// MARK: - UIViewRepresentable host

/// Drop this inside ContentView's ZStack to capture all gestures.
struct GestureRouterView: UIViewRepresentable {

    @EnvironmentObject var router: GestureRouter

    func makeUIView(context: Context) -> UIView {
        let view = UIView()
        view.backgroundColor = .clear
        view.isUserInteractionEnabled = true

        let coord = context.coordinator

        // 1. Pan — look.
        let pan = UIPanGestureRecognizer(target: coord, action: #selector(Coordinator.pan(_:)))
        pan.maximumNumberOfTouches = 1
        view.addGestureRecognizer(pan)

        // 2. Tap — hotspot.
        let tap = UITapGestureRecognizer(target: coord, action: #selector(Coordinator.tap(_:)))
        tap.numberOfTapsRequired = 1
        view.addGestureRecognizer(tap)

        // 3. Two-finger swipe down — tray table.
        let swipeDown = UISwipeGestureRecognizer(target: coord, action: #selector(Coordinator.swipeDown(_:)))
        swipeDown.direction = .down
        swipeDown.numberOfTouchesRequired = 2
        view.addGestureRecognizer(swipeDown)

        // 4. Two-finger swipe up — break walk.
        let swipeUp = UISwipeGestureRecognizer(target: coord, action: #selector(Coordinator.swipeUp(_:)))
        swipeUp.direction = .up
        swipeUp.numberOfTouchesRequired = 2
        view.addGestureRecognizer(swipeUp)

        // 5. Long press — seat settings.
        let longPress = UILongPressGestureRecognizer(target: coord, action: #selector(Coordinator.longPress(_:)))
        longPress.minimumPressDuration = 0.7
        view.addGestureRecognizer(longPress)

        // 6. Pinch — recline HUD.
        let pinch = UIPinchGestureRecognizer(target: coord, action: #selector(Coordinator.pinch(_:)))
        view.addGestureRecognizer(pinch)

        // Allow simultaneous recognition between pan + others.
        coord.gestureView = view
        return view
    }

    func updateUIView(_ uiView: UIView, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(router: router) }

    // MARK: Coordinator

    @MainActor
    class Coordinator: NSObject, UIGestureRecognizerDelegate {

        let router: GestureRouter
        weak var gestureView: UIView?
        private var lastPanLocation: CGPoint = .zero

        init(router: GestureRouter) { self.router = router }

        @objc func pan(_ g: UIPanGestureRecognizer) {
            guard let view = g.view else { return }
            let loc = g.location(in: view)
            if g.state == .began { lastPanLocation = loc; return }
            let delta = CGPoint(x: loc.x - lastPanLocation.x, y: loc.y - lastPanLocation.y)
            lastPanLocation = loc
            router.handlePan(state: g.state, delta: delta)
        }

        @objc func tap(_ g: UITapGestureRecognizer) {
            guard let view = g.view else { return }
            let loc = g.location(in: view)
            let normX = Float(loc.x / view.bounds.width)
            let normY = Float(loc.y / view.bounds.height)
            router.handleTap(normX: normX, normY: normY)
        }

        @objc func swipeDown(_ g: UISwipeGestureRecognizer) {
            if g.state == .recognized { router.handleTwoFingerSwipeDown() }
        }

        @objc func swipeUp(_ g: UISwipeGestureRecognizer) {
            if g.state == .recognized { router.handleTwoFingerSwipeUp() }
        }

        @objc func longPress(_ g: UILongPressGestureRecognizer) {
            if g.state == .began { router.handleLongPress() }
        }

        @objc func pinch(_ g: UIPinchGestureRecognizer) {
            if g.state == .ended && g.scale < 0.75 { router.handlePinchIn() }
        }

        // Allow pan and tap to fire simultaneously.
        nonisolated func gestureRecognizer(
            _ g: UIGestureRecognizer,
            shouldRecognizeSimultaneouslyWith other: UIGestureRecognizer
        ) -> Bool { true }
    }
}
