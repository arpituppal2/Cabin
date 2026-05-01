// CabinSessionManager.h
// The Pomodoro + session clock brain.
// Tracks total session time, sprint/break cycling, and flight telemetry.
// Emits data consumed by the IFE Flight Map, Big Clock, and Tail Camera modes.
// Acts as a subsystem — one per world, accessible from any actor.

#pragma once

#include "CoreMinimal.h"
#include "Subsystems/WorldSubsystem.h"
#include "CabinGameMode.h"
#include "CabinSessionManager.generated.h"

// Route definition set by the user during onboarding.
USTRUCT(BlueprintType)
struct FCabinRoute
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadWrite, Category = "Route")
    FString DepartureIATA;   // e.g. "LAX"

    UPROPERTY(BlueprintReadWrite, Category = "Route")
    FString ArrivalIATA;     // e.g. "LHR"

    UPROPERTY(BlueprintReadWrite, Category = "Route")
    FVector2D DepartureLonLat;  // (Longitude, Latitude)

    UPROPERTY(BlueprintReadWrite, Category = "Route")
    FVector2D ArrivalLonLat;

    // Great-circle distance in km (computed on configure).
    UPROPERTY(BlueprintReadOnly, Category = "Route")
    float DistanceKm = 0.f;
};

// Live telemetry broadcast to the IFE every second.
USTRUCT(BlueprintType)
struct FCabinTelemetry
{
    GENERATED_BODY()

    // Time remaining in total session (seconds).
    UPROPERTY(BlueprintReadOnly) float TimeToDestinationSeconds = 0.f;

    // Simulated altitude in feet.
    UPROPERTY(BlueprintReadOnly) float AltitudeFeet = 0.f;

    // Simulated ground speed in knots.
    UPROPERTY(BlueprintReadOnly) float GroundSpeedKnots = 0.f;

    // Aircraft position along route [0,1].
    UPROPERTY(BlueprintReadOnly) float RouteProgress = 0.f;

    // Current simulated lon/lat of aircraft.
    UPROPERTY(BlueprintReadOnly) FVector2D CurrentLonLat;

    // Remaining sprint time (seconds).
    UPROPERTY(BlueprintReadOnly) float SprintRemainingSeconds = 0.f;

    // Remaining break time (seconds). 0 when in sprint.
    UPROPERTY(BlueprintReadOnly) float BreakRemainingSeconds = 0.f;

    // Current sprint index (1-based).
    UPROPERTY(BlueprintReadOnly) int32 CurrentSprint = 0;

    // Total sprint count for this session.
    UPROPERTY(BlueprintReadOnly) int32 TotalSprints = 0;
};

// Session configuration.
USTRUCT(BlueprintType)
struct FCabinSessionConfig
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadWrite) float TotalSessionMinutes  = 90.f;
    UPROPERTY(BlueprintReadWrite) float SprintMinutes        = 25.f;
    UPROPERTY(BlueprintReadWrite) float BreakMinutes         = 5.f;
    UPROPERTY(BlueprintReadWrite) float TaxiMinutes          = 5.f;
    UPROPERTY(BlueprintReadWrite) FCabinRoute Route;
};

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnTelemetryUpdated, const FCabinTelemetry&, Telemetry);
DECLARE_DYNAMIC_MULTICAST_DELEGATE(FOnSprintStarted);
DECLARE_DYNAMIC_MULTICAST_DELEGATE(FOnBreakStarted);
DECLARE_DYNAMIC_MULTICAST_DELEGATE(FOnSessionEnded);

UCLASS()
class CABINENGINE_API UCabinSessionManager : public UWorldSubsystem
{
    GENERATED_BODY()

public:
    // Configure and start a session. Call from SwiftUI onboarding handoff.
    UFUNCTION(BlueprintCallable, Category = "Cabin|Session")
    void ConfigureAndStart(const FCabinSessionConfig& Config);

    // Skip to next sprint (used if user manually ends break early).
    UFUNCTION(BlueprintCallable, Category = "Cabin|Session")
    void SkipBreak();

    // End session immediately.
    UFUNCTION(BlueprintCallable, Category = "Cabin|Session")
    void EndSessionNow();

    // Latest telemetry snapshot. Safe to poll from Blueprint tick.
    UFUNCTION(BlueprintPure, Category = "Cabin|Session")
    FCabinTelemetry GetCurrentTelemetry() const { return CachedTelemetry; }

    UFUNCTION(BlueprintPure, Category = "Cabin|Session")
    bool IsSessionActive() const { return bSessionActive; }

    UFUNCTION(BlueprintPure, Category = "Cabin|Session")
    bool IsInBreak() const { return bInBreak; }

    // Delegates
    UPROPERTY(BlueprintAssignable) FOnTelemetryUpdated OnTelemetryUpdated;
    UPROPERTY(BlueprintAssignable) FOnSprintStarted    OnSprintStarted;
    UPROPERTY(BlueprintAssignable) FOnBreakStarted     OnBreakStarted;
    UPROPERTY(BlueprintAssignable) FOnSessionEnded     OnSessionEnded;

protected:
    virtual void OnWorldBeginPlay(UWorld& InWorld) override;
    virtual bool ShouldCreateSubsystem(UObject* Outer) const override { return true; }

private:
    FCabinSessionConfig ActiveConfig;
    FCabinTelemetry     CachedTelemetry;

    bool  bSessionActive    = false;
    bool  bInBreak          = false;
    float SessionElapsed    = 0.f;   // seconds since cruise start
    float SprintElapsed     = 0.f;
    float BreakElapsed      = 0.f;
    float TelemetryAccum    = 0.f;   // accumulates toward 1s tick
    int32 CompletedSprints  = 0;
    int32 TotalSprints      = 0;

    // Telemetry simulation state
    float CruiseAltitudeFt   = 37000.f;  // target cruise altitude
    float CurrentAltitudeFt  = 0.f;
    float CurrentSpeedKnots  = 0.f;

    FTimerHandle TelemetryTimerHandle;

    void Tick(float DeltaSeconds);
    void UpdateTelemetry();
    void BeginSprint();
    void BeginBreak();
    void HandleSessionEnd();

    // Great-circle interpolation along route at progress t in [0,1].
    FVector2D InterpolateRoute(float T) const;

    // Compute great-circle distance between two lon/lat points (km).
    static float GreatCircleDistanceKm(FVector2D A, FVector2D B);

    // Altitude profile: returns simulated altitude in feet given session progress [0,1].
    float SimulatedAltitude(float Progress) const;

    // Speed profile: returns simulated ground speed in knots given phase + progress.
    float SimulatedSpeed(float Progress) const;

    // Cached GameMode ref.
    UPROPERTY()
    TObjectPtr<ACabinGameMode> CabinGM;
};
