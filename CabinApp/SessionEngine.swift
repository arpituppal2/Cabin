// SessionEngine.swift
// The central ObservableObject that owns all session state.
// Drives the Pomodoro timer, polls gyroscope via CMMotionManager,
// pumps the CADisplayLink, and calls into the C ABI bridge.

import SwiftUI
import Combine
import CoreMotion
import QuartzCore

// Maps to ECabinPhase in UE.
enum CabinPhase: Int, CaseIterable {
    case boarding       = 0
    case preDeparture   = 1
    case taxi           = 2
    case takeoff        = 3
    case cruise         = 4
    case breakPhase     = 5
    case descent        = 6
    case landing        = 7
    case gateArrival    = 8
}

// IFE display mode.
enum IFEMode: Int, CaseIterable {
    case flightMap  = 0
    case bigClock   = 1
    case tailCamera = 2
}

// Session configuration produced by the onboarding flow.
struct CabinSessionConfig {
    var totalMinutes:   Float = 90
    var sprintMinutes:  Float = 25
    var breakMinutes:   Float = 5
    var taxiMinutes:    Float = 5
    var departureIATA:  String = "LAX"
    var arrivalIATA:    String = "LHR"
    var depLon:         Float = -118.4085
    var depLat:         Float =   33.9425
    var arrLon:         Float =   -0.4543
    var arrLat:         Float =   51.4775
    var seatIndex:      Int   = 0
}

@MainActor
final class SessionEngine: ObservableObject {

    // MARK: – Published state
    @Published var currentPhase:    CabinPhase = .boarding
    @Published var ifeMode:         IFEMode    = .flightMap
    @Published var telemetry:       TelemetrySnapshot = TelemetrySnapshot()
    @Published var isSessionActive: Bool = false
    @Published var isSplitViewMode: Bool = false

    // MARK: – Sub-controllers
    let gestureRouter = GestureRouter()
    let metalBridge   = MetalBridge()

    // MARK: – Private
    private var config:         CabinSessionConfig = CabinSessionConfig()
    private var displayLink:    CADisplayLink?
    private var motionManager:  CMMotionManager = CMMotionManager()
    private var lastGyroTime:   TimeInterval = 0
    private var cancellables:   Set<AnyCancellable> = []

    // MARK: – Init
    init() {
        setupGyroscope()
        setupDisplayLink()
        observeSplitView()
    }

    // MARK: – Session control

    func configure(_ cfg: CabinSessionConfig) {
        config = cfg
    }

    func startFlight() {
        guard !isSessionActive else { return }
        isSessionActive = true

        // Build the C struct and hand off to UE via bridge.
        var cCfg = CabinSessionCfg()
        cCfg.totalMinutes  = config.totalMinutes
        cCfg.sprintMinutes = config.sprintMinutes
        cCfg.breakMinutes  = config.breakMinutes
        cCfg.taxiMinutes   = config.taxiMinutes
        cCfg.depLon        = config.depLon
        cCfg.depLat        = config.depLat
        cCfg.arrLon        = config.arrLon
        cCfg.arrLat        = config.arrLat
        cCfg.seatIndex     = Int32(config.seatIndex)

        // Copy IATA strings into fixed char arrays.
        withUnsafeMutableBytes(of: &cCfg.departureIATA) { buf in
            let src = config.departureIATA.utf8
            buf.copyBytes(from: src.prefix(3))
        }
        withUnsafeMutableBytes(of: &cCfg.arrivalIATA) { buf in
            let src = config.arrivalIATA.utf8
            buf.copyBytes(from: src.prefix(3))
        }

        withUnsafePointer(to: cCfg) { ptr in
            CabinBridge_StartSession(ptr)
        }
    }

    func endFlight() {
        CabinBridge_EndSession()
        isSessionActive = false
        currentPhase = .gateArrival
    }

    func cycleIFEMode() {
        let next = IFEMode(rawValue: (ifeMode.rawValue + 1) % IFEMode.allCases.count) ?? .flightMap
        ifeMode = next
    }

    // MARK: – Display link (main render + telemetry pump loop)

    private func setupDisplayLink() {
        displayLink = CADisplayLink(target: self, selector: #selector(onDisplayLink(_:)))
        displayLink?.preferredFrameRateRange = CAFrameRateRange(minimum: 30, maximum: 60, preferred: 60)
        displayLink?.add(to: .main, forMode: .common)
    }

    @objc private func onDisplayLink(_ link: CADisplayLink) {
        // 1. Push IFE SwiftUI render into Metal texture → UE.
        metalBridge.flushIFETexture(ifeMode: ifeMode, telemetry: telemetry, phase: currentPhase)

        // 2. Poll telemetry from UE.
        var snap = CabinTelemetrySnapshot()
        CabinBridge_GetTelemetry(&snap)
        telemetry = TelemetrySnapshot(from: snap)

        // 3. Sync phase from telemetry.
        if let phase = CabinPhase(rawValue: Int(snap.currentPhase)) {
            if phase != currentPhase {
                currentPhase = phase
            }
        }
    }

    // MARK: – Gyroscope

    private func setupGyroscope() {
        guard motionManager.isDeviceMotionAvailable else { return }
        motionManager.deviceMotionUpdateInterval = 1.0 / 60.0
        motionManager.startDeviceMotionUpdates(to: .main) { [weak self] motion, error in
            guard let self, let motion, error == nil else { return }
            let rotRate = motion.rotationRate
            // Only send if above noise floor.
            let threshold = 0.008
            let yaw   = abs(rotRate.z) > threshold ? Float(rotRate.z)  : 0
            let pitch = abs(rotRate.x) > threshold ? Float(-rotRate.x) : 0
            if yaw != 0 || pitch != 0 {
                CabinBridge_SendGyro(yaw, pitch)
            }
        }
    }

    // MARK: – Split View detection

    private func observeSplitView() {
        NotificationCenter.default
            .publisher(for: UIApplication.didBecomeActiveNotification)
            .merge(with: NotificationCenter.default
                .publisher(for: UIScene.willConnectNotification))
            .sink { [weak self] _ in self?.checkSplitView() }
            .store(in: &cancellables)
    }

    private func checkSplitView() {
#if os(iOS)
        let screenWidth = UIScreen.main.bounds.width
        let windowWidth = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .first?.windows.first?.bounds.width ?? screenWidth
        isSplitViewMode = windowWidth < screenWidth * 0.85
#endif
    }

    // MARK: – Low power

    func setLowPower(_ enabled: Bool) {
        CabinBridge_SetLowPower(enabled ? 1 : 0)
    }
}

// MARK: - TelemetrySnapshot (Swift mirror of CabinTelemetrySnapshot)

struct TelemetrySnapshot {
    var timeToDestinationSeconds:  Float = 0
    var altitudeFeet:              Float = 0
    var groundSpeedKnots:          Float = 0
    var routeProgress:             Float = 0
    var currentLon:                Float = 0
    var currentLat:                Float = 0
    var sprintRemainingSeconds:    Float = 0
    var breakRemainingSeconds:     Float = 0
    var currentSprint:             Int   = 0
    var totalSprints:              Int   = 0

    init() {}

    init(from c: CabinTelemetrySnapshot) {
        timeToDestinationSeconds = c.timeToDestinationSeconds
        altitudeFeet             = c.altitudeFeet
        groundSpeedKnots         = c.groundSpeedKnots
        routeProgress            = c.routeProgress
        currentLon               = c.currentLon
        currentLat               = c.currentLat
        sprintRemainingSeconds   = c.sprintRemainingSeconds
        breakRemainingSeconds    = c.breakRemainingSeconds
        currentSprint            = Int(c.currentSprint)
        totalSprints             = Int(c.totalSprints)
    }

    // Formatted time string "HH:MM:SS"
    var timeToDestinationFormatted: String {
        let s = Int(timeToDestinationSeconds)
        return String(format: "%02d:%02d:%02d", s / 3600, (s % 3600) / 60, s % 60)
    }

    var sprintRemainingFormatted: String {
        let s = Int(sprintRemainingSeconds)
        return String(format: "%02d:%02d", s / 60, s % 60)
    }

    var altitudeFormatted: String {
        return String(format: "%.0f ft", altitudeFeet)
    }

    var speedFormatted: String {
        return String(format: "%.0f kts", groundSpeedKnots)
    }
}
