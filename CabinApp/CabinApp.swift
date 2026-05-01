// CabinApp.swift
// @main entry point for the Cabin iPadOS / macOS Catalyst app.
// Bootstraps the UE5 runtime embedded inside an MTKView,
// then hands control to ContentView (SwiftUI).

import SwiftUI
import MetalKit
import CoreMotion

@main
struct CabinApp: App {

    // Single shared session engine — drives all state across the view tree.
    @StateObject private var session = SessionEngine()

    // Audio controller lives at the app level so it survives view transitions.
    @StateObject private var audio = AudioController()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(session)
                .environmentObject(audio)
                // Lock to landscape on iPad.
                .onAppear {
                    AppOrientationHelper.lockLandscape()
                }
        }
        // Support iPadOS Split View / Stage Manager.
        .defaultSize(width: 1024, height: 768)
    }
}

// MARK: - Orientation helper

enum AppOrientationHelper {
    static func lockLandscape() {
#if os(iOS)
        if let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene {
            scene.requestGeometryUpdate(
                .iOS(interfaceOrientations: .landscape)
            ) { _ in }
        }
#endif
    }
}
