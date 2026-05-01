// SwiftBridgeInterface.h
// Plain C ABI exported from the CabinBridge plugin.
// Swift calls these functions via @_silgen_name or a bridging header.
//
// ALL functions are safe to call from the Swift main thread.
// They post work to the UE game thread internally where required.
//
// Usage in Swift:
//
//   @_silgen_name("CabinBridge_SendGyro")
//   func CabinBridge_SendGyro(_ yawRad: Float, _ pitchRad: Float)
//
//   @_silgen_name("CabinBridge_SendTap")
//   func CabinBridge_SendTap(_ normX: Float, _ normY: Float)
//
//   @_silgen_name("CabinBridge_UpdateIFETexture")
//   func CabinBridge_UpdateIFETexture(_ handle: Int64, _ w: Int32, _ h: Int32)
//
//   @_silgen_name("CabinBridge_StartSession")
//   func CabinBridge_StartSession(_ cfg: UnsafePointer<CabinSessionCfg>)
//
//   @_silgen_name("CabinBridge_EndSession")
//   func CabinBridge_EndSession()
//
//   @_silgen_name("CabinBridge_SetLowPower")
//   func CabinBridge_SetLowPower(_ enabled: Bool)

#pragma once

#ifdef __cplusplus
extern "C" {
#endif

// -----------------------------------------------------------------------
// Session configuration packet sent from Swift during onboarding.
// Must be ABI-compatible with Swift's CabinSessionCfg struct.
// -----------------------------------------------------------------------
typedef struct CabinSessionCfg
{
    float  totalMinutes;
    float  sprintMinutes;
    float  breakMinutes;
    float  taxiMinutes;
    char   departureIATA[4];  // null-terminated, e.g. "LAX"
    char   arrivalIATA[4];    // null-terminated, e.g. "LHR"
    float  depLon;
    float  depLat;
    float  arrLon;
    float  arrLat;
    int    seatIndex;         // 0=1A, 1=2B, 2=1D, 3=2D, 4=2G, 5=1G, 6=2J, 7=1L
} CabinSessionCfg;

// -----------------------------------------------------------------------
// Telemetry snapshot polled by Swift for IFE display.
// -----------------------------------------------------------------------
typedef struct CabinTelemetrySnapshot
{
    float timeToDestinationSeconds;
    float altitudeFeet;
    float groundSpeedKnots;
    float routeProgress;         // [0, 1]
    float currentLon;
    float currentLat;
    float sprintRemainingSeconds;
    float breakRemainingSeconds;
    int   currentSprint;
    int   totalSprints;
    int   currentPhase;          // maps to ECabinPhase int value
} CabinTelemetrySnapshot;

// -----------------------------------------------------------------------
// Input
// -----------------------------------------------------------------------

// Gyroscope delta in radians/second. Call once per CADisplayLink frame.
void CabinBridge_SendGyro(float deltaYawRad, float deltaPitchRad);

// Normalised tap position [0,1]. Call on UITapGestureRecognizer.
void CabinBridge_SendTap(float normX, float normY);

// -----------------------------------------------------------------------
// IFE Texture
// -----------------------------------------------------------------------

// Pass the Metal texture handle and dimensions each CADisplayLink frame.
// handle is (int64_t)(uintptr_t)(id<MTLTexture>).
void CabinBridge_UpdateIFETexture(int64_t handle, int32_t width, int32_t height);

// -----------------------------------------------------------------------
// Session lifecycle
// -----------------------------------------------------------------------

void CabinBridge_StartSession(const CabinSessionCfg* cfg);
void CabinBridge_EndSession(void);

// -----------------------------------------------------------------------
// Render mode
// -----------------------------------------------------------------------

// Pass 1 to enable low-power mode (disables Lumen + Nanite).
void CabinBridge_SetLowPower(int enabled);

// -----------------------------------------------------------------------
// Telemetry poll (Swift reads this each IFE frame to update UI)
// -----------------------------------------------------------------------

void CabinBridge_GetTelemetry(CabinTelemetrySnapshot* outSnapshot);

#ifdef __cplusplus
}
#endif
