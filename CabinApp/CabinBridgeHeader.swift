// CabinBridgeHeader.swift
// Swift-side C ABI declarations.
// Each @_silgen_name maps a Swift function name to the
// C symbol exported by SwiftBridgeImpl.cpp in CabinBridge.framework.
//
// Swift structs must be ABI-compatible with the C structs
// declared in SwiftBridgeInterface.h.

import Foundation

// MARK: - C-compatible structs

/// Must match CabinSessionCfg in SwiftBridgeInterface.h exactly.
@frozen
public struct CabinSessionCfg {
    public var totalMinutes:  Float
    public var sprintMinutes: Float
    public var breakMinutes:  Float
    public var taxiMinutes:   Float
    public var departureIATA: (CChar, CChar, CChar, CChar)  // 4-byte null-terminated
    public var arrivalIATA:   (CChar, CChar, CChar, CChar)
    public var depLon:        Float
    public var depLat:        Float
    public var arrLon:        Float
    public var arrLat:        Float
    public var seatIndex:     Int32

    public init() {
        totalMinutes  = 90
        sprintMinutes = 25
        breakMinutes  = 5
        taxiMinutes   = 5
        departureIATA = (0, 0, 0, 0)
        arrivalIATA   = (0, 0, 0, 0)
        depLon        = 0
        depLat        = 0
        arrLon        = 0
        arrLat        = 0
        seatIndex     = 0
    }
}

/// Must match CabinTelemetrySnapshot in SwiftBridgeInterface.h exactly.
@frozen
public struct CabinTelemetrySnapshot {
    public var timeToDestinationSeconds:  Float
    public var altitudeFeet:              Float
    public var groundSpeedKnots:          Float
    public var routeProgress:             Float
    public var currentLon:                Float
    public var currentLat:                Float
    public var sprintRemainingSeconds:    Float
    public var breakRemainingSeconds:     Float
    public var currentSprint:             Int32
    public var totalSprints:              Int32
    public var currentPhase:              Int32

    public init() {
        timeToDestinationSeconds = 0
        altitudeFeet             = 0
        groundSpeedKnots         = 0
        routeProgress            = 0
        currentLon               = 0
        currentLat               = 0
        sprintRemainingSeconds   = 0
        breakRemainingSeconds    = 0
        currentSprint            = 0
        totalSprints             = 0
        currentPhase             = 0
    }
}

// MARK: - C ABI function declarations

@_silgen_name("CabinBridge_SendGyro")
public func CabinBridge_SendGyro(
    _ deltaYawRad: Float,
    _ deltaPitchRad: Float
)

@_silgen_name("CabinBridge_SendTap")
public func CabinBridge_SendTap(
    _ normX: Float,
    _ normY: Float
)

@_silgen_name("CabinBridge_UpdateIFETexture")
public func CabinBridge_UpdateIFETexture(
    _ handle: Int64,
    _ width:  Int32,
    _ height: Int32
)

@_silgen_name("CabinBridge_StartSession")
public func CabinBridge_StartSession(
    _ cfg: UnsafePointer<CabinSessionCfg>
)

@_silgen_name("CabinBridge_EndSession")
public func CabinBridge_EndSession()

@_silgen_name("CabinBridge_SetLowPower")
public func CabinBridge_SetLowPower(_ enabled: Int32)

@_silgen_name("CabinBridge_GetTelemetry")
public func CabinBridge_GetTelemetry(
    _ snapshot: UnsafeMutablePointer<CabinTelemetrySnapshot>
)
