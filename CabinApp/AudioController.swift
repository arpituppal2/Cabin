// AudioController.swift
// Spatial cabin sound controller.
// Uses AVAudioEngine with multiple AVAudioPlayerNodes:
//   - engine hum loop
//   - air vent hiss loop
//   - boarding ambience loop
//   - one-shot chimes / tray table / meal clinks / PA

import Foundation
import SwiftUI
import AVFoundation

@MainActor
final class AudioController: ObservableObject {

    private let engine = AVAudioEngine()

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
        playLoop(named: "cabin_hum", on: engineHumNode, volume: 0.18)
    }

    func beginTaxiAudio() {
        ensureEngineRunning()
        playLoop(named: "engine_spool", on: engineHumNode, volume: 0.38)
        playLoop(named: "vent_hiss", on: ventNode, volume: 0.12)
        playOneShot(named: "seatbelt_ding")
    }

    func beginCruiseAudio() {
        ensureEngineRunning()
        playLoop(named: "engine_cruise", on: engineHumNode, volume: 0.30)
        playLoop(named: "vent_hiss", on: ventNode, volume: 0.14)
    }

    func beginDescentAudio() {
        ensureEngineRunning()
        playOneShot(named: "pa_prepare_arrival")
        playOneShot(named: "gear_thud")
    }

    // MARK: - UI SFX

    func playIFETap() {
        playOneShot(named: "ife_tap")
    }

    func playTrayClunk() {
        playOneShot(named: "tray_clunk")
    }

    func playMealService() {
        playOneShot(named: "meal_clink")
    }

    // MARK: - Internal helpers

    private func ensureEngineRunning() {
        guard !engine.isRunning else { return }
        do {
            try engine.start()
        } catch {
            print("[AudioController] Restart AVAudioEngine failed: \(error)")
        }
    }

    private func playLoop(named name: String, on node: AVAudioPlayerNode, volume: Float) {
        guard let file = loadAudioFile(named: name) else { return }
        if node.isPlaying { node.stop() }
        node.volume = volume
        node.scheduleFile(file, at: nil, completionHandler: nil)
        node.play()

        // Re-schedule in a simple loop. In production, use completion chaining.
        DispatchQueue.main.asyncAfter(deadline: .now() + file.duration * 0.95) { [weak self, weak node] in
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
