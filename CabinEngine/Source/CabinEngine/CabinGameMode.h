// CabinGameMode.h
// Sets default pawn and controller classes for the Cabin experience.
// Also owns the phase-state machine at the game layer.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
#include "CabinGameMode.generated.h"

UENUM(BlueprintType)
enum class ECabinPhase : uint8
{
    Boarding        UMETA(DisplayName = "Boarding"),
    PreDeparture    UMETA(DisplayName = "Pre-Departure"),
    Taxi            UMETA(DisplayName = "Taxi"),
    Takeoff         UMETA(DisplayName = "Takeoff"),
    Cruise          UMETA(DisplayName = "Cruise"),
    Break           UMETA(DisplayName = "Break"),
    Descent         UMETA(DisplayName = "Descent"),
    Landing         UMETA(DisplayName = "Landing"),
    GateArrival     UMETA(DisplayName = "Gate Arrival")
};

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnPhaseChanged, ECabinPhase, NewPhase);

UCLASS()
class CABINENGINE_API ACabinGameMode : public AGameModeBase
{
    GENERATED_BODY()

public:
    ACabinGameMode();

    // Broadcast whenever the flight phase transitions.
    UPROPERTY(BlueprintAssignable, Category = "Cabin|Phase")
    FOnPhaseChanged OnPhaseChanged;

    // Request a phase transition. Validates sequencing before committing.
    UFUNCTION(BlueprintCallable, Category = "Cabin|Phase")
    void TransitionToPhase(ECabinPhase TargetPhase);

    UFUNCTION(BlueprintPure, Category = "Cabin|Phase")
    ECabinPhase GetCurrentPhase() const { return CurrentPhase; }

    // Called by SessionManager when the user finalises session config.
    UFUNCTION(BlueprintCallable, Category = "Cabin|Session")
    void BeginSession(float TotalSessionSeconds, float SprintSeconds, float BreakSeconds);

    // Called by SessionManager at each sprint boundary.
    UFUNCTION(BlueprintCallable, Category = "Cabin|Session")
    void NotifySprintComplete();

    // Called by SessionManager when all sprints are done.
    UFUNCTION(BlueprintCallable, Category = "Cabin|Session")
    void NotifySessionComplete();

protected:
    virtual void BeginPlay() override;
    virtual void Tick(float DeltaSeconds) override;

private:
    ECabinPhase CurrentPhase = ECabinPhase::Boarding;

    float TotalSessionDuration  = 0.f;   // seconds
    float SprintDuration        = 0.f;
    float BreakDuration         = 0.f;
    float PhaseElapsed          = 0.f;

    // Phase durations (seconds). Fixed cinematic phases.
    static constexpr float kBoardingDuration    = 180.f;  // 3 min
    static constexpr float kPreDepartureDuration= 60.f;   // 1 min
    static constexpr float kTaxiDuration        = 90.f;   // 1.5 min
    static constexpr float kTakeoffDuration     = 60.f;   // 1 min
    static constexpr float kDescentDuration     = 240.f;  // 4 min
    static constexpr float kLandingDuration     = 90.f;   // 1.5 min
    static constexpr float kGateArrivalDuration = 60.f;   // 1 min

    bool bSessionActive = false;

    void AdvancePhaseTimer(float DeltaSeconds);
    bool IsValidTransition(ECabinPhase From, ECabinPhase To) const;
    void CommitPhaseTransition(ECabinPhase NewPhase);
    float DurationForPhase(ECabinPhase Phase) const;
};
