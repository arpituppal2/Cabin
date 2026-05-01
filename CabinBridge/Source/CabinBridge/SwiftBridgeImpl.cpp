// SwiftBridgeImpl.cpp
// Implements the C ABI declared in SwiftBridgeInterface.h.
// Functions are called from Swift via @_silgen_name.
// All UE API calls are dispatched to the game thread.

#include "SwiftBridgeInterface.h"
#include "Engine/Engine.h"
#include "Engine/World.h"
#include "Kismet/GameplayStatics.h"
#include "Async/Async.h"
#include "Logging/LogMacros.h"

// Forward declaration — resolved at link time from CabinEngine module.
class ACabinBridge;
static ACabinBridge* GetBridgeActor();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

static ACabinBridge* GetBridgeActor()
{
    if (!GEngine) return nullptr;
    UWorld* World = nullptr;
    for (const FWorldContext& Ctx : GEngine->GetWorldContexts())
    {
        if (Ctx.WorldType == EWorldType::Game || Ctx.WorldType == EWorldType::PIE)
        {
            World = Ctx.World();
            break;
        }
    }
    if (!World) return nullptr;

    TArray<AActor*> Found;
    UGameplayStatics::GetAllActorsOfClass(World, ACabinBridge::StaticClass(), Found);
    return Found.Num() > 0 ? Cast<ACabinBridge>(Found[0]) : nullptr;
}

// Dispatch a lambda to the UE game thread from any calling thread.
#define CABIN_GAME_THREAD(lambda) \
    AsyncTask(ENamedThreads::GameThread, [=](){ lambda(); });

// ---------------------------------------------------------------------------
// C ABI implementations
// ---------------------------------------------------------------------------

extern "C"
{

void CabinBridge_SendGyro(float deltaYawRad, float deltaPitchRad)
{
    CABIN_GAME_THREAD(([deltaYawRad, deltaPitchRad]
    {
        if (ACabinBridge* B = GetBridgeActor())
            B->ReceiveGyroInput(deltaYawRad, deltaPitchRad);
    }));
}

void CabinBridge_SendTap(float normX, float normY)
{
    CABIN_GAME_THREAD(([normX, normY]
    {
        if (ACabinBridge* B = GetBridgeActor())
            B->ReceiveTap(normX, normY);
    }));
}

void CabinBridge_UpdateIFETexture(int64_t handle, int32_t width, int32_t height)
{
    // Texture handle is captured by value — safe to pass across thread boundary.
    CABIN_GAME_THREAD(([handle, width, height]
    {
        if (ACabinBridge* B = GetBridgeActor())
            B->UpdateIFETexture((int64)handle, (int32)width, (int32)height);
    }));
}

void CabinBridge_StartSession(const CabinSessionCfg* cfg)
{
    if (!cfg) return;
    // Copy struct to avoid Swift stack going away before game thread runs.
    CabinSessionCfg copy = *cfg;
    CABIN_GAME_THREAD(([copy]
    {
        if (ACabinBridge* B = GetBridgeActor())
        {
            B->StartSessionFromSwift(
                copy.totalMinutes,
                copy.sprintMinutes,
                copy.breakMinutes,
                copy.taxiMinutes,
                UTF8_TO_TCHAR(copy.departureIATA),
                UTF8_TO_TCHAR(copy.arrivalIATA),
                copy.depLon, copy.depLat,
                copy.arrLon, copy.arrLat,
                copy.seatIndex
            );
        }
    }));
}

void CabinBridge_EndSession(void)
{
    CABIN_GAME_THREAD(([]{ if (ACabinBridge* B = GetBridgeActor()) B->EndSessionFromSwift(); }));
}

void CabinBridge_SetLowPower(int enabled)
{
    CABIN_GAME_THREAD(([enabled]
    {
        if (ACabinBridge* B = GetBridgeActor())
        {
            B->SetRenderMode(enabled
                ? ECabinRenderMode::LowPower
                : ECabinRenderMode::HighFidelity);
        }
    }));
}

void CabinBridge_GetTelemetry(CabinTelemetrySnapshot* outSnapshot)
{
    if (!outSnapshot) return;
    // This is polled from the Swift main thread — read last cached value.
    // No game-thread dispatch needed since CachedTelemetry is written
    // atomically on the game thread and read here (acceptable read-only race
    // for display purposes; no synchronisation primitive required).
    if (!GEngine) return;
    UWorld* World = nullptr;
    for (const FWorldContext& Ctx : GEngine->GetWorldContexts())
    {
        if (Ctx.WorldType == EWorldType::Game || Ctx.WorldType == EWorldType::PIE)
        { World = Ctx.World(); break; }
    }
    if (!World) return;

    UCabinSessionManager* SM = World->GetSubsystem<UCabinSessionManager>();
    if (!SM) return;

    const FCabinTelemetry T = SM->GetCurrentTelemetry();
    outSnapshot->timeToDestinationSeconds  = T.TimeToDestinationSeconds;
    outSnapshot->altitudeFeet              = T.AltitudeFeet;
    outSnapshot->groundSpeedKnots          = T.GroundSpeedKnots;
    outSnapshot->routeProgress             = T.RouteProgress;
    outSnapshot->currentLon                = T.CurrentLonLat.X;
    outSnapshot->currentLat                = T.CurrentLonLat.Y;
    outSnapshot->sprintRemainingSeconds    = T.SprintRemainingSeconds;
    outSnapshot->breakRemainingSeconds     = T.BreakRemainingSeconds;
    outSnapshot->currentSprint             = T.CurrentSprint;
    outSnapshot->totalSprints              = T.TotalSprints;
}

} // extern "C"
