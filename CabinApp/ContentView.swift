// ContentView.swift
// Root SwiftUI view.
// Displays the UE5 MTKView full-screen, overlaid with:
//   • Onboarding sheet (seat selection + session config) before first flight
//   • IFEView (SwiftUI layer rendered INTO the UE IFE texture via MetalBridge)
//   • Minimal system chrome (no floating HUDs — everything is diegetic)

import SwiftUI
import MetalKit

struct ContentView: View {

    @EnvironmentObject var session: SessionEngine
    @EnvironmentObject var audio:   AudioController

    @State private var showOnboarding = true

    var body: some View {
        ZStack {
            // Layer 1: Unreal Engine viewport (full screen)
            UnrealViewRepresentable()
                .ignoresSafeArea()

            // Layer 2: IFE texture canvas — rendered by MetalBridge INTO UE
            // Nothing visible here in the view hierarchy; MetalBridge owns the texture.
            // This placeholder lets GestureRouter intercept taps before UE.
            Color.clear
                .contentShape(Rectangle())
                .gesture(
                    DragGesture(minimumDistance: 2)
                        .onChanged { value in
                            session.gestureRouter.handleDrag(
                                translation: value.translation,
                                viewSize: UIScreen.main.bounds.size
                            )
                        }
                        .onEnded { _ in
                            session.gestureRouter.endDrag()
                        }
                )
                .simultaneousGesture(
                    TapGesture()
                        .onEnded {
                            // Tap location resolved inside GestureRouter via UIKit.
                        }
                )

            // Layer 3: Onboarding overlay (pre-session only)
            if showOnboarding {
                OnboardingView(onComplete: { config in
                    session.configure(config)
                    withAnimation(.easeInOut(duration: 0.6)) {
                        showOnboarding = false
                    }
                    audio.transitionToPhase(.boarding)
                })
                .transition(.opacity)
            }

            // Layer 4: Split View companion panel (IFE timer strip)
            // Visible only when app is in Split View — width < full screen.
            if session.isSplitViewMode {
                IFESplitStripView()
                    .frame(maxWidth: 320)
                    .frame(maxHeight: .infinity)
                    .background(.ultraThinMaterial)
                    .transition(.move(edge: .trailing))
            }
        }
        .ignoresSafeArea()
        .statusBarHidden(true)
        .persistentSystemOverlays(.hidden)
        .onChange(of: session.currentPhase) { newPhase in
            audio.transitionToPhase(newPhase)
        }
    }
}

// MARK: - Unreal Engine MTKView wrapper

struct UnrealViewRepresentable: UIViewRepresentable {

    func makeUIView(context: Context) -> MTKView {
        let view = MTKView()
        view.device = MTLCreateSystemDefaultDevice()
        view.colorPixelFormat = .bgra8Unorm_srgb
        view.depthStencilPixelFormat = .depth32Float
        view.framebufferOnly = false       // Allow blit reads from UE.
        view.preferredFramesPerSecond = 60 // UE target; ProMotion handles 120Hz UI.
        view.isPaused = false
        view.enableSetNeedsDisplay = false // Continuous render loop.
        view.autoResizeDrawable = true
        // UE hooks its own Metal render delegate here during engine init.
        // CabinEngine.framework bootstrap is triggered in SceneDelegate / AppDelegate.
        return view
    }

    func updateUIView(_ uiView: MTKView, context: Context) {}
}
