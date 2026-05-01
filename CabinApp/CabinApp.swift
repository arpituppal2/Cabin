// CabinApp.swift
// @main entry point for the Cabin iPadOS / macOS app.
// Hosts the UE5 Metal view and the SwiftUI IFE overlay.

import SwiftUI
import AVFoundation

@main
struct CabinApp: App {

    @StateObject private var sessionEngine = SessionEngine()
    @StateObject private var audioController = AudioController()

    init() {
        configureAudioSession()
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(sessionEngine)
                .environmentObject(audioController)
                // Hide the standard title bar chrome — Cabin is full-bleed.
                .persistentSystemOverlays(.hidden)
                .statusBarHidden(true)
        }
        .windowResizability(.contentSize)
    }

    private func configureAudioSession() {
        do {
            let session = AVAudioSession.sharedInstance()
            // .playback keeps audio alive when screen locks and in Split View.
            try session.setCategory(.playback, mode: .default, options: [.mixWithOthers])
            try session.setActive(true)
        } catch {
            print("[CabinApp] AVAudioSession setup failed: \(error)")
        }
    }
}
