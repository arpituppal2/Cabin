// ContentView.swift
// Root SwiftUI view.
// Layers:
//   1. UEMetalView        — full-screen UE5 render target (MTKView-backed)
//   2. GestureRouterView  — transparent overlay capturing drag + tap
//   3. IFEView            — SwiftUI IFE chrome (visible in Split View)
//   4. OnboardingView     — seat selection + session config
//
// Swift 6: All @State and environment access already on MainActor via SwiftUI.
// UIViewRepresentable.makeUIView() is nonisolated by protocol; we avoid
// touching shared mutable state there and use nonisolated NotificationCenter.

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

            // Layer 2: Gesture capture.
            GestureRouterView()
                .ignoresSafeArea()

            // Layer 3: IFE companion view.
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
        // .onReceive delivers on the main actor automatically in SwiftUI,
        // but we make the UIApplication call explicit via MainActor.assumeIsolated
        // so Swift 6 can verify it at compile time.
        .onReceive(sessionEngine.$isActive) { @MainActor active in
            UIApplication.shared.isIdleTimerDisabled = active
        }
    }
}

// MARK: - UE Metal View Bridge

/// Wraps the MTKView that UE5 renders into.
/// makeUIView is nonisolated (UIViewRepresentable protocol requirement).
/// We only read immutable MTLDevice here, so no actor boundary crossing.
struct UEMetalViewRepresentable: UIViewRepresentable {

    func makeUIView(context: Context) -> MTKView {
        let view = MTKView()
        view.device = MTLCreateSystemDefaultDevice()
        view.colorPixelFormat = .bgra8Unorm_srgb
        view.depthStencilPixelFormat = .depth32Float
        view.framebufferOnly = false
        view.preferredFramesPerSecond = 120   // ProMotion.
        view.isPaused = false
        view.enableSetNeedsDisplay = false
        view.backgroundColor = .black
        // Post from nonisolated context — NotificationCenter.default.post
        // is safe to call from any thread; UE's observer is also thread-safe.
        NotificationCenter.default.post(
            name: NSNotification.Name("CabinRegisterMTKView"),
            object: view
        )
        return view
    }

    func updateUIView(_ uiView: MTKView, context: Context) {}
}
