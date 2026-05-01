// AudioController.swift
// Spatial cabin sound controller.
// Uses AVAudioEngine with multiple AVAudioPlayerNodes:
//   - engine hum loop
//   - air vent hiss loop
//   - boarding ambience loop
//   - one-shot chimes / tray table / meal clinks / PA
//
// Swift 6: entire class is @MainActor-isolated.
// AVAudioEngine and AVAudioPlayerNode are called on the main actor;
// this is safe because we never do heavy DSP here — we only schedule
// buffers. Actual audio rendering happens on AVAudioEngine's internal
// real-time thread, which is separate and unaffected by actor isolation.

import Foundation
import SwiftUI
import AVFoundation

@MainActor
final class AudioController: ObservableObject {

    private let engine        = AVAudioEngine()
    private let engineHumNode = AVAudioPlayerNode()
    private let ventNode      = AVAudioPlayerNode()
    private let ambienceNode  = AVAudioPlayerNode()
    private let sfxNode       = AVAudioPlayerNode()

    private var hasStartedEngine = false

    init() {
        configureGraph()
    }

    private func configureGraph() {
        [engineHumNode, ventNode, ambienceNode, sfxNode].forEach { engine.attach($0) }

        let mainMixer = engine.mainMixerNode
        engine.connect(engineHumNode, to: mainMixer, format: nil)
        engine.connect(ventNode,      to: mainMixer, format: nil)
        engine.connect(ambienceNode,  to: mainMixer, format: nil)
        engine.connect(sfxNode,       to: mainMixer, format: nil)

        mainMixer.outputVolume = 0.92

        do {
            try engine.start()
            hasStartedEngine = true
        } catch {
            print("[AudioController] Failed to start AVAudioEngine: \(error)")
        }
    }

    // MARK: - Scene state transitions

    func beginBoardingAudio() {
        ensureEngineRunning()
        playLoop(named: "boarding_ambience", on: ambienceNode, volume: 0.22)
        playLoop(named: "cabin_hum",         on: engineHumNode, volume: 0.18)
    }

    func beginTaxiAudio() {
        ensureEngineRunning()
        playLoop(named: "engine_spool", on: engineHumNode, volume: 0.38)
        playLoop(named: "vent_hiss",    on: ventNode,      volume: 0.12)
        playOneShot(named: "seatbelt_ding")
    }

    func beginCruiseAudio() {
        ensureEngineRunning()
        playLoop(named: "engine_cruise", on: engineHumNode, volume: 0.30)
        playLoop(named: "vent_hiss",     on: ventNode,      volume: 0.14)
    }

    func beginDescentAudio() {
        ensureEngineRunning()
        playOneShot(named: "pa_prepare_arrival")
        playOneShot(named: "gear_thud")
    }

    // MARK: - UI SFX

    func playIFETap()     { playOneShot(named: "ife_tap") }
    func playTrayClunk()  { playOneShot(named: "tray_clunk") }
    func playMealService() { playOneShot(named: "meal_clink") }

    // MARK: - Internal helpers

    private func ensureEngineRunning() {
        guard !engine.isRunning else { return }
        do {
            try engine.start()
        } catch {
            print("[AudioController] Restart AVAudioEngine failed: \(error)")
        }
    }

    /// Schedule a looping audio file using a Task-based delay instead of
    /// DispatchQueue.main, keeping the call-stack inside the @MainActor domain.
    private func playLoop(named name: String, on node: AVAudioPlayerNode, volume: Float) {
        guard let file = loadAudioFile(named: name) else { return }
        if node.isPlaying { node.stop() }
        node.volume = volume
        node.scheduleFile(file, at: nil, completionHandler: nil)
        node.play()

        let loopDelay = file.duration * 0.95

        Task { @MainActor [weak self, weak node] in
            // Sleep off the main thread while still keeping the continuation
            // on the main actor when it resumes.
            try? await Task.sleep(for: .seconds(loopDelay))
            guard let self, let node, node.isPlaying else { return }
            self.playLoop(named: name, on: node, volume: volume)
        }
    }

    private func playOneShot(named name: String, volume: Float = 0.85) {
        guard let file = loadAudioFile(named: name) else { return }
        sfxNode.volume = volume
        sfxNode.scheduleFile(file, at: nil)
        if !sfxNode.isPlaying { sfxNode.play() }
    }

    private func loadAudioFile(named name: String) -> AVAudioFile? {
        let exts = ["wav", "aif", "aiff", "mp3", "m4a"]
        for ext in exts {
            if let url = Bundle.main.url(forResource: name, withExtension: ext) {
                return try? AVAudioFile(forReading: url)
            }
        }
        return nil
    }
}
