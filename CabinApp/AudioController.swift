// AudioController.swift
// Manages the Cabin audio environment using AVAudioEngine.
// Each CabinPhase has a corresponding audio bed (loop) with a
// convolution reverb insert — simulating the acoustic signature
// of a wide-body cabin.
//
// Audio beds (referenced by filename, to be added to Xcode bundle):
//   cabin_ground_power.caf  — boarding / pre-departure hum
//   cabin_taxi.caf          — engine idle + tarmac roll
//   cabin_takeoff.caf       — engine spool-up (one-shot, then crossfade to cruise)
//   cabin_cruise.caf        — steady white-noise jet hum (loop)
//   cabin_galley.caf        — break phase: muffled chatter + cart clinks
//   cabin_descent.caf       — engine reduction + PA prompts
//   cabin_landing.caf       — gear thud + reverse thrust + rollout
//
// Convolution IR:
//   ir_wide_body_cabin.wav  — measured cabin impulse response

import AVFoundation
import Combine

@MainActor
final class AudioController: ObservableObject {

    // MARK: - Engine
    private let engine          = AVAudioEngine()
    private let reverb          = AVAudioUnitReverb()
    private var players:        [String: AVAudioPlayerNode] = [:]
    private var currentBed:     String = ""
    private let mixer           = AVAudioMixerNode()
    private var crossfadeCancellable: AnyCancellable?

    // MARK: - Phase → audio bed mapping
    private let phaseBedMap: [CabinPhase: String] = [
        .boarding:     "cabin_ground_power",
        .preDeparture: "cabin_ground_power",
        .taxi:         "cabin_taxi",
        .takeoff:      "cabin_takeoff",
        .cruise:       "cabin_cruise",
        .breakPhase:   "cabin_galley",
        .descent:      "cabin_descent",
        .landing:      "cabin_landing",
        .gateArrival:  "cabin_ground_power"
    ]

    // MARK: - Init
    init() {
        configureAudioSession()
        buildGraph()
        start()
    }

    // MARK: - Audio session

    private func configureAudioSession() {
#if os(iOS)
        let session = AVAudioSession.sharedInstance()
        try? session.setCategory(.playback, mode: .default, options: [.mixWithOthers])
        try? session.setActive(true)
#endif
    }

    // MARK: - Graph construction

    private func buildGraph() {
        // Attach mixer and reverb.
        engine.attach(mixer)
        engine.attach(reverb)

        // Configure reverb — large room to simulate fuselage.
        reverb.loadFactoryPreset(.largeChamber)
        reverb.wetDryMix = 18  // 18% wet — subtle cabin bloom.

        // Chain: mixer → reverb → mainMixerNode → output
        engine.connect(mixer, to: reverb, format: nil)
        engine.connect(reverb, to: engine.mainMixerNode, format: nil)

        // Pre-create a player for each audio bed.
        let beds = [
            "cabin_ground_power", "cabin_taxi", "cabin_takeoff",
            "cabin_cruise", "cabin_galley", "cabin_descent", "cabin_landing"
        ]
        for bed in beds {
            let player = AVAudioPlayerNode()
            engine.attach(player)
            engine.connect(player, to: mixer, format: nil)
            players[bed] = player
        }
    }

    private func start() {
        try? engine.start()
    }

    // MARK: - Phase transitions

    func transitionToPhase(_ phase: CabinPhase) {
        guard let newBed = phaseBedMap[phase], newBed != currentBed else { return }
        crossfade(from: currentBed, to: newBed, duration: 2.0)
        currentBed = newBed
    }

    // MARK: - Crossfade

    private func crossfade(from oldBed: String, to newBed: String, duration: TimeInterval) {
        guard let newPlayer = players[newBed] else { return }
        let oldPlayer = players[oldBed]

        // Schedule new bed.
        if let url = Bundle.main.url(forResource: newBed, withExtension: "caf") {
            if let file = try? AVAudioFile(forReading: url) {
                // Loop all beds except one-shots (takeoff, landing).
                let loops = (newBed != "cabin_takeoff" && newBed != "cabin_landing")
                newPlayer.scheduleFile(file, at: nil, completionHandler: loops ? { [weak self, weak newPlayer] in
                    guard let self, let newPlayer else { return }
                    Task { @MainActor in self.loopPlayer(newPlayer, file: file) }
                } : nil)
                newPlayer.play()
                newPlayer.volume = 0
            }
        }

        // Animate volumes over `duration` seconds at 60fps cadence.
        let steps = Int(duration * 60)
        for i in 0...steps {
            let t = Double(i) / Double(steps)
            let delay = t * duration
            DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in
                guard let self else { return }
                newPlayer.volume = Float(t)
                oldPlayer?.volume = Float(1 - t)
            }
        }

        // Stop old player after fade.
        DispatchQueue.main.asyncAfter(deadline: .now() + duration + 0.1) {
            oldPlayer?.stop()
        }
    }

    private func loopPlayer(_ player: AVAudioPlayerNode, file: AVAudioFile) {
        try? file.framePosition = 0
        player.scheduleFile(file, at: nil, completionHandler: { [weak self, weak player] in
            guard let self, let player else { return }
            Task { @MainActor in self.loopPlayer(player, file: file) }
        })
        if !player.isPlaying { player.play() }
    }

    // MARK: - One-shot SFX

    func playSFX(named name: String, volume: Float = 1.0) {
        guard
            let url = Bundle.main.url(forResource: name, withExtension: "caf"),
            let file = try? AVAudioFile(forReading: url)
        else { return }

        let sfxPlayer = AVAudioPlayerNode()
        engine.attach(sfxPlayer)
        engine.connect(sfxPlayer, to: mixer, format: nil)
        sfxPlayer.volume = volume
        sfxPlayer.scheduleFile(file, at: nil) { [weak self, weak sfxPlayer] in
            guard let self, let sfxPlayer else { return }
            Task { @MainActor in
                sfxPlayer.stop()
                self.engine.detach(sfxPlayer)
            }
        }
        sfxPlayer.play()
    }
}
