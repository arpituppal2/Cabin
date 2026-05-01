// CabinSessionManager.cpp

#include "CabinSessionManager.h"
#include "Engine/World.h"
#include "TimerManager.h"
#include "Kismet/GameplayStatics.h"
#include "Logging/LogMacros.h"
#include "Math/UnrealMathUtility.h"

DEFINE_LOG_CATEGORY_STATIC(LogCabinSession, Log, All);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
static constexpr float kKnotsToKmH       = 1.852f;
static constexpr float kTakeoffSpeedKts  = 160.f;   // rotation speed
static constexpr float kCruiseSpeedKts   = 490.f;   // typical 787 cruise
static constexpr float kDescentSpeedKts  = 280.f;

// Altitude profile knots (progress, altitudeFt)
// Climb over first 12%, cruise at 37000ft, descend over last 10%.
static constexpr float kClimbFraction    = 0.12f;
static constexpr float kDescentFraction  = 0.10f;
static constexpr float kCruiseAltFt      = 37000.f;

// ---------------------------------------------------------------------------

void UCabinSessionManager::OnWorldBeginPlay(UWorld& InWorld)
{
    Super::OnWorldBeginPlay(InWorld);
    CabinGM = Cast<ACabinGameMode>(InWorld.GetAuthGameMode());
}

void UCabinSessionManager::ConfigureAndStart(const FCabinSessionConfig& Config)
{
    ActiveConfig = Config;

    // Compute great-circle distance for the chosen route.
    ActiveConfig.Route.DistanceKm = GreatCircleDistanceKm(
        Config.Route.DepartureLonLat, Config.Route.ArrivalLonLat);

    // Compute total number of full sprints.
    const float SessionSeconds = Config.TotalSessionMinutes * 60.f;
    const float SprintSeconds  = Config.SprintMinutes * 60.f;
    const float BreakSeconds   = Config.BreakMinutes  * 60.f;

    TotalSprints     = FMath::Max(1, FMath::FloorToInt(SessionSeconds / (SprintSeconds + BreakSeconds)));
    CompletedSprints = 0;
    SessionElapsed   = 0.f;
    CurrentAltitudeFt = 0.f;
    CurrentSpeedKnots = 0.f;
    bSessionActive   = true;
    bInBreak         = false;

    UE_LOG(LogCabinSession, Log, TEXT("Session configured: %.0f min, %d sprints of %.0f/%.0f min, route %s→%s (%.0f km)"),
        Config.TotalSessionMinutes,
        TotalSprints,
        Config.SprintMinutes,
        Config.BreakMinutes,
        *Config.Route.DepartureIATA,
        *Config.Route.ArrivalIATA,
        ActiveConfig.Route.DistanceKm);

    // Notify GameMode to start phase progression.
    if (CabinGM)
    {
        CabinGM->BeginSession(SessionSeconds, SprintSeconds, BreakSeconds);
    }

    BeginSprint();

    // Register world tick delegate.
    if (UWorld* World = GetWorld())
    {
        FWorldDelegates::OnWorldPostActorTick.AddUObject(
            this, &UCabinSessionManager::Tick);
    }
}

void UCabinSessionManager::Tick(float DeltaSeconds)
{
    if (!bSessionActive) return;

    SessionElapsed += DeltaSeconds;
    TelemetryAccum += DeltaSeconds;

    if (bInBreak)
    {
        BreakElapsed += DeltaSeconds;
        const float BreakTotal = ActiveConfig.BreakMinutes * 60.f;
        if (BreakElapsed >= BreakTotal)
        {
            SkipBreak();
        }
    }
    else
    {
        SprintElapsed += DeltaSeconds;
        const float SprintTotal = ActiveConfig.SprintMinutes * 60.f;
        if (SprintElapsed >= SprintTotal)
        {
            CompletedSprints++;
            const float SessionTotal = ActiveConfig.TotalSessionMinutes * 60.f;
            if (CompletedSprints >= TotalSprints || SessionElapsed >= SessionTotal)
            {
                HandleSessionEnd();
                return;
            }
            if (CabinGM) CabinGM->NotifySprintComplete();
            BeginBreak();
        }
    }

    // Telemetry update every second.
    if (TelemetryAccum >= 1.f)
    {
        TelemetryAccum -= 1.f;
        UpdateTelemetry();
    }
}

void UCabinSessionManager::SkipBreak()
{
    if (!bInBreak) return;
    bInBreak = false;
    BreakElapsed = 0.f;
    if (CabinGM) CabinGM->TransitionToPhase(ECabinPhase::Cruise);
    BeginSprint();
}

void UCabinSessionManager::EndSessionNow()
{
    HandleSessionEnd();
}

void UCabinSessionManager::BeginSprint()
{
    SprintElapsed = 0.f;
    bInBreak = false;
    UE_LOG(LogCabinSession, Log, TEXT("Sprint %d / %d started."), CompletedSprints + 1, TotalSprints);
    OnSprintStarted.Broadcast();
}

void UCabinSessionManager::BeginBreak()
{
    BreakElapsed = 0.f;
    bInBreak = true;
    UE_LOG(LogCabinSession, Log, TEXT("Break started after sprint %d."), CompletedSprints);
    OnBreakStarted.Broadcast();
}

void UCabinSessionManager::HandleSessionEnd()
{
    bSessionActive = false;
    UE_LOG(LogCabinSession, Log, TEXT("Session complete. Total elapsed: %.0fs"), SessionElapsed);
    if (CabinGM) CabinGM->NotifySessionComplete();
    OnSessionEnded.Broadcast();
}

void UCabinSessionManager::UpdateTelemetry()
{
    const float SessionTotal = ActiveConfig.TotalSessionMinutes * 60.f;
    const float Progress     = FMath::Clamp(SessionElapsed / FMath::Max(SessionTotal, 1.f), 0.f, 1.f);

    // Smooth altitude simulation.
    const float TargetAlt = SimulatedAltitude(Progress);
    CurrentAltitudeFt = FMath::FInterpTo(CurrentAltitudeFt, TargetAlt, 1.f, 0.05f);

    // Speed simulation.
    const float TargetSpeed = SimulatedSpeed(Progress);
    CurrentSpeedKnots = FMath::FInterpTo(CurrentSpeedKnots, TargetSpeed, 1.f, 0.1f);

    const float SprintTotal = ActiveConfig.SprintMinutes * 60.f;
    const float BreakTotal  = ActiveConfig.BreakMinutes  * 60.f;

    FCabinTelemetry T;
    T.TimeToDestinationSeconds = FMath::Max(0.f, SessionTotal - SessionElapsed);
    T.AltitudeFeet             = FMath::RoundToFloat(CurrentAltitudeFt / 100.f) * 100.f; // round to nearest 100ft
    T.GroundSpeedKnots         = FMath::RoundToFloat(CurrentSpeedKnots);
    T.RouteProgress            = Progress;
    T.CurrentLonLat            = InterpolateRoute(Progress);
    T.SprintRemainingSeconds   = bInBreak ? 0.f : FMath::Max(0.f, SprintTotal - SprintElapsed);
    T.BreakRemainingSeconds    = bInBreak ? FMath::Max(0.f, BreakTotal - BreakElapsed) : 0.f;
    T.CurrentSprint            = CompletedSprints + 1;
    T.TotalSprints             = TotalSprints;

    CachedTelemetry = T;
    OnTelemetryUpdated.Broadcast(T);
}

FVector2D UCabinSessionManager::InterpolateRoute(float T) const
{
    // Great-circle slerp between departure and arrival.
    // Using simple linear lon/lat lerp as an approximation for short-to-medium routes.
    // For polar routes a full spherical interpolation should replace this.
    const FVector2D& A = ActiveConfig.Route.DepartureLonLat;
    const FVector2D& B = ActiveConfig.Route.ArrivalLonLat;

    // Add slight arc (northward bump for westbound transpacific simulation).
    // Midpoint displaced toward pole by up to 8 degrees.
    const float MidBulge = FMath::Sin(T * PI) * 8.f;
    const float Lat = FMath::Lerp(A.Y, B.Y, T) + MidBulge;
    const float Lon = FMath::Lerp(A.X, B.X, T);
    return FVector2D(Lon, Lat);
}

float UCabinSessionManager::GreatCircleDistanceKm(FVector2D A, FVector2D B)
{
    // Haversine formula. Inputs in degrees.
    const float R = 6371.f; // Earth radius km
    const float Lat1 = FMath::DegreesToRadians(A.Y);
    const float Lat2 = FMath::DegreesToRadians(B.Y);
    const float dLat = FMath::DegreesToRadians(B.Y - A.Y);
    const float dLon = FMath::DegreesToRadians(B.X - A.X);

    const float a = FMath::Sin(dLat * 0.5f) * FMath::Sin(dLat * 0.5f)
                  + FMath::Cos(Lat1) * FMath::Cos(Lat2)
                  * FMath::Sin(dLon * 0.5f) * FMath::Sin(dLon * 0.5f);
    const float c = 2.f * FMath::Atan2(FMath::Sqrt(a), FMath::Sqrt(1.f - a));
    return R * c;
}

float UCabinSessionManager::SimulatedAltitude(float Progress) const
{
    // Climb: 0 → kCruiseAltFt over first kClimbFraction of session.
    // Cruise: kCruiseAltFt for the middle.
    // Descent: kCruiseAltFt → 0 over final kDescentFraction.
    if (Progress < kClimbFraction)
    {
        const float t = Progress / kClimbFraction;
        // Ease-in-out cubic for realistic climb profile.
        const float Eased = t * t * (3.f - 2.f * t);
        return Eased * kCruiseAltFt;
    }
    else if (Progress > (1.f - kDescentFraction))
    {
        const float t = (Progress - (1.f - kDescentFraction)) / kDescentFraction;
        const float Eased = t * t * (3.f - 2.f * t);
        return (1.f - Eased) * kCruiseAltFt;
    }
    else
    {
        // Slight meander ±200ft at cruise for realism.
        const float Wobble = FMath::Sin(Progress * 37.f) * 200.f;
        return kCruiseAltFt + Wobble;
    }
}

float UCabinSessionManager::SimulatedSpeed(float Progress) const
{
    if (Progress < kClimbFraction)
    {
        // Accelerate from 0 to cruise speed during climb.
        const float t = Progress / kClimbFraction;
        return FMath::Lerp(kTakeoffSpeedKts, kCruiseSpeedKts, t);
    }
    else if (Progress > (1.f - kDescentFraction))
    {
        // Decelerate from cruise to approach speed.
        const float t = (Progress - (1.f - kDescentFraction)) / kDescentFraction;
        return FMath::Lerp(kCruiseSpeedKts, kDescentSpeedKts, t);
    }
    else
    {
        // Cruise with small variation.
        const float Wobble = FMath::Sin(Progress * 53.f) * 8.f;
        return kCruiseSpeedKts + Wobble;
    }
}
