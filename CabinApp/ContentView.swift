// ContentView.swift
// Root SwiftUI view.
// Layers:
//   1. UEMetalView        — full-screen UE5 render target (MTKView-backed)
//   2. GestureRouter      — transparent overlay capturing drag + tap
//   3. IFEView            — SwiftUI IFE chrome (only visible in Split View or onboarding)
//   4. OnboardingView     — seat selection + session config (fades out at session start)

import SwiftUI
import MetalKit

struct ContentView: View {

    @EnvironmentObject var sessionEngine: SessionEngine
    @EnvironmentObject var audioController: AudioController

    @State private var showOnboarding = true

    var body: some View {
        ZStack {
            // Layer 1: UE5 render surface.
            UEMetalViewRepresentable()
                .ignoresSafeArea()

            // Layer 2: Transparent gesture capture.
            GestureOverlay()
                .ignoresSafeArea()

            // Layer 3: IFE companion view (Split View / PiP use).
            if !showOnboarding {
                IFEView()
                    .ignoresSafeArea()
                    .transition(.opacity)
            }

            // Layer 4: Onboarding.
            if showOnboarding {
                OnboardingView(onComplete: { config in
                    withAnimation(.easeInOut(duration: 1.2)) {
                        showOnboarding = false
                    }
                    sessionEngine.startSession(config: config)
                    audioController.beginBoardingAudio()
                })
                .ignoresSafeArea()
                .transition(.opacity)
            }
        }
        .preferredColorScheme(.dark)
        // Prevent display sleep during active session.
        .onReceive(sessionEngine.$isActive) { active in
            UIApplication.shared.isIdleTimerDisabled = active
        }
    }
}

// MARK: - UE Metal View Bridge

/// Wraps the MTKView that UE5 renders into.
/// On first appearance, UE's iOS launch hooks have already set up the
/// render pipeline — we just hand it a view to draw into.
struct UEMetalViewRepresentable: UIViewRepresentable {

    func makeUIView(context: Context) -> MTKView {
        let view = MTKView()
        view.device = MTLCreateSystemDefaultDevice()
        view.colorPixelFormat = .bgra8Unorm_srgb
        view.depthStencilPixelFormat = .depth32Float
        view.framebufferOnly = false          // Allow Metal blit reads.
        view.preferredFramesPerSecond = 120   // ProMotion.
        view.isPaused = false
        view.enableSetNeedsDisplay = false
        view.backgroundColor = .black
        // Register this view with UE's iOS AppDelegate so it becomes the
        // primary render target. UE's IOSView machinery picks this up.
        NotificationCenter.default.post(
            name: NSNotification.Name("CabinRegisterMTKView"),
            object: view
        )
        return view
    }

    func updateUIView(_ uiView: MTKView, context: Context) {}
}

// MARK: - Gesture Overlay

/// Captures drag (look) and tap (hotspot) gestures, forwarding to the C bridge.
struct GestureOverlay: UIViewRepresentable {

    func makeUIView(context: Context) -> UIView {
        let view = UIView()
        view.backgroundColor = .clear
        view.isUserInteractionEnabled = true

        // Drag to look.
        let pan = UIPanGestureRecognizer(
            target: context.coordinator,
            action: #selector(Coordinator.handlePan(_:))
        )
        pan.maximumNumberOfTouches = 1
        view.addGestureRecognizer(pan)

        // Tap for hotspots.
        let tap = UITapGestureRecognizer(
            target: context.coordinator,
            action: #selector(Coordinator.handleTap(_:))
        )
        view.addGestureRecognizer(tap)

        return view
    }

    func updateUIView(_ uiView: UIView, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator() }

    class Coordinator: NSObject {

        private var lastLocation: CGPoint = .zero

        @objc func handlePan(_ gesture: UIPanGestureRecognizer) {
            guard let view = gesture.view else { return }
            let loc = gesture.location(in: view)

            switch gesture.state {
            case .began:
                lastLocation = loc
            case .changed:
                let dx = Float(loc.x - lastLocation.x)
                let dy = Float(loc.y - lastLocation.y)
                lastLocation = loc
                // Convert pixels to a small radian-equivalent delta.
                // Sensitivity tuned so a full-screen swipe ≈ 90° look.
                let yawDelta   =  dx * 0.002
                let pitchDelta = -dy * 0.002
                CabinBridge_SendGyro(yawDelta, pitchDelta)
            default:
                break
            }
        }

        @objc func handleTap(_ gesture: UITapGestureRecognizer) {
            guard let view = gesture.view else { return }
            let loc = gesture.location(in: view)
            let normX = Float(loc.x / view.bounds.width)
            let normY = Float(loc.y / view.bounds.height)
            CabinBridge_SendTap(normX, normY)
        }
    }
}
