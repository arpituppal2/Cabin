// SessionEngine.swift
// ObservableObject owning all session state.
// Drives:
//   - CADisplayLink for 120Hz gyro polling + IFE texture pump
//   - CMMotionManager for gyroscope
//   - C bridge calls to UE5
//   - Published state for SwiftUI IFE and onboarding views

import SwiftUI
import Combine
import CoreMotion
import QuartzCore
import Metal

// Mirror of CabinSessionCfg for Swift ergonomics.
struct SessionConfig {
    var totalMinutes:  Float = 90
    var sprintMinutes: Float = 25
    var breakMinutes:  Float = 5
    var taxiMinutes:   Float = 5
    var departureIATA: String = "LAX"
    var arrivalIATA:   String = "LHR"
    var depLon: Float = -118.4085; var depLat: Float = 33.9425
    var arrLon: Float =  -0.4543;  var arrLat: Float = 51.4775
    var seatIndex: Int32 = 0
}

// Live telemetry surfaced to SwiftUI IFE views.
struct LiveTelemetry {
    var timeToDestination: TimeInterval = 0
    var altitudeFeet: Float = 0
    var groundSpeedKnots: Float = 0
    var routeProgress: Float = 0
    var currentLon: Float = 0
    var currentLat: Float = 0
    var sprintRemaining: TimeInterval = 0
    var breakRemaining: TimeInterval = 0
    var currentSprint: Int = 0
    var totalSprints: Int = 0
}

@MainActor
final class SessionEngine: ObservableObject {

    // MARK: - Published State

    @Published var isActive: Bool = false
    @Published var isInBreak: Bool = false
    @Published var telemetry: LiveTelemetry = LiveTelemetry()
    @Published var ifeMode: IFEMode = .flightMap
    @Published var currentPhase: CabinPhase = .boarding

    // MARK: - Private

    private let motionManager = CMMotionManager()
    private var displayLink: CADisplayLink?
    private var config: SessionConfig = SessionConfig()

    // IFE Metal texture (drawn by SwiftUI, sent to UE each frame).
    private var ifeTexture: CabinIFETexture?

    // Gyro update interval.
    private let gyroHz: Double = 60

    // Telemetry poll interval (frames).
    private var telemetryPollCounter: Int = 0
    private let telemetryPollInterval: Int = 6  // every 6 frames at 120Hz ≈ 20Hz

    // MARK: - Public API

    func startSession(config: SessionConfig) {
        self.config = config
        isActive = true

        startGyroscope()
        startDisplayLink()
        sendSessionConfigToBridge(config)
    }

    func endSession() {
        CabinBridge_EndSession()
        isActive = false
        stopGyroscope()
        stopDisplayLink()
    }

    func cycleIFEMode() {
        ifeMode = ifeMode.next()
    }

    func setLowPowerMode(_ enabled: Bool) {
        CabinBridge_SetLowPower(enabled ? 1 : 0)
    }

    // MARK: - Gyroscope

    private func startGyroscope() {
        guard motionManager.isGyroAvailable else { return }
        motionManager.gyroUpdateInterval = 1.0 / gyroHz
        motionManager.startGyroUpdates()
    }

    private func stopGyroscope() {
        motionManager.stopGyroUpdates()
    }

    // MARK: - Display Link

    private func startDisplayLink() {
        let link = CADisplayLink(target: self, selector: #selector(onDisplayLink(_:)))
        link.preferredFrameRateRange = CAFrameRateRange(minimum: 60, maximum: 120, preferred: 120)
        link.add(to: .main, forMode: .common)
        displayLink = link
    }

    private func stopDisplayLink() {
        displayLink?.invalidate()
        displayLink = nil
    }

    @objc private func onDisplayLink(_ link: CADisplayLink) {
        // 1. Forward gyro data to UE.
        if let gyroData = motionManager.gyroData {
            let dt = Float(link.targetTimestamp - link.timestamp)
            let yaw   = Float(gyroData.rotationRate.z) * dt
            let pitch = Float(gyroData.rotationRate.x) * dt
            CabinBridge_SendGyro(yaw, pitch)
        }

        // 2. Push IFE texture to UE.
        if let tex = ifeTexture {
            CabinBridge_UpdateIFETexture(
                Int64(bitPattern: UInt64(UInt(bitPattern: tex.metalTexturePointer))),
                Int32(tex.width),
                Int32(tex.height)
            )
        }

        // 3. Poll telemetry from UE at reduced rate.
        telemetryPollCounter += 1
        if telemetryPollCounter >= telemetryPollInterval {
            telemetryPollCounter = 0
            pollTelemetry()
        }
    }

    // MARK: - Telemetry Poll

    private func pollTelemetry() {
        var snap = CabinTelemetrySnapshot()
        CabinBridge_GetTelemetry(&snap)

        telemetry = LiveTelemetry(
            timeToDestination: TimeInterval(snap.timeToDestinationSeconds),
            altitudeFeet:      snap.altitudeFeet,
            groundSpeedKnots:  snap.groundSpeedKnots,
            routeProgress:     snap.routeProgress,
            currentLon:        snap.currentLon,
            currentLat:        snap.currentLat,
            sprintRemaining:   TimeInterval(snap.sprintRemainingSeconds),
            breakRemaining:    TimeInterval(snap.breakRemainingSeconds),
            currentSprint:     Int(snap.currentSprint),
            totalSprints:      Int(snap.totalSprints)
        )

        isInBreak = snap.breakRemainingSeconds > 0
        currentPhase = CabinPhase(rawValue: Int(snap.currentPhase)) ?? .boarding
    }

    // MARK: - Bridge Config

    private func sendSessionConfigToBridge(_ cfg: SessionConfig) {
        var c = CabinSessionCfg()
        c.totalMinutes  = cfg.totalMinutes
        c.sprintMinutes = cfg.sprintMinutes
        c.breakMinutes  = cfg.breakMinutes
        c.taxiMinutes   = cfg.taxiMinutes
        c.depLon = cfg.depLon; c.depLat = cfg.depLat
        c.arrLon = cfg.arrLon; c.arrLat = cfg.arrLat
        c.seatIndex = cfg.seatIndex

        // Copy IATA strings into fixed char arrays.
        withUnsafeMutableBytes(of: &c.departureIATA) { buf in
            cfg.departureIATA.utf8.enumerated().forEach { i, byte in
                if i < buf.count - 1 { buf[i] = byte }
            }
        }
        withUnsafeMutableBytes(of: &c.arrivalIATA) { buf in
            cfg.arrivalIATA.utf8.enumerated().forEach { i, byte in
                if i < buf.count - 1 { buf[i] = byte }
            }
        }

        withUnsafePointer(to: c) { CabinBridge_StartSession($0) }
    }
}

// MARK: - Supporting Enums

enum IFEMode: Int, CaseIterable {
    case flightMap = 0
    case bigClock  = 1
    case tailCam   = 2

    func next() -> IFEMode {
        let all = IFEMode.allCases
        let idx = (rawValue + 1) % all.count
        return all[idx]
    }

    var label: String {
        switch self {
        case .flightMap: return "Flight Map"
        case .bigClock:  return "Focus Clock"
        case .tailCam:   return "Tail Camera"
        }
    }
}

enum CabinPhase: Int {
    case boarding = 0, preDeparture, taxi, takeoff, cruise, cabinBreak, descent, landing, gateArrival
}

// MARK: - IFE Texture Container

/// Holds a Metal texture + a pointer to its underlying MTLTexture
/// that can be passed to UE via the C bridge.
final class CabinIFETexture {
    let texture: MTLTexture
    let width: Int
    let height: Int
    /// Opaque pointer to the id<MTLTexture> for bridging.
    var metalTexturePointer: UnsafeMutableRawPointer {
        // Bridge the Swift MTLTexture protocol object to an opaque pointer.
        // Unretained because UE only holds this pointer for one frame.
        return Unmanaged.passUnretained(texture as AnyObject).toOpaque()
    }

    init?(device: MTLDevice, width: Int, height: Int) {
        let desc = MTLTextureDescriptor.texture2DDescriptor(
            pixelFormat: .bgra8Unorm_sRGB,
            width: width,
            height: height,
            mipmapped: false
        )
        desc.usage = [.shaderRead, .shaderWrite, .renderTarget]
        desc.storageMode = .shared   // CPU + GPU accessible for IOSurface path.
        guard let tex = device.makeTexture(descriptor: desc) else { return nil }
        self.texture = tex
        self.width   = width
        self.height  = height
    }
}
