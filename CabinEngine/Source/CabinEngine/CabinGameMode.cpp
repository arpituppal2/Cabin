// CabinGameMode.cpp

#include "CabinGameMode.h"
#include "CabinPawn.h"
#include "CabinPlayerController.h"
#include "UObject/ConstructorHelpers.h"
#include "Logging/LogMacros.h"

DEFINE_LOG_CATEGORY_STATIC(LogCabinGameMode, Log, All);

ACabinGameMode::ACabinGameMode()
{
    // Set our custom classes as defaults.
    DefaultPawnClass       = ACabinPawn::StaticClass();
    PlayerControllerClass  = ACabinPlayerController::StaticClass();

    PrimaryActorTick.bCanEverTick = true;
}

void ACabinGameMode::BeginPlay()
{
    Super::BeginPlay();
    UE_LOG(LogCabinGameMode, Log, TEXT("CabinGameMode started. Phase: Boarding."));
    CommitPhaseTransition(ECabinPhase::Boarding);
}

void ACabinGameMode::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);
    if (CurrentPhase != ECabinPhase::Cruise && CurrentPhase != ECabinPhase::Break)
    {
        AdvancePhaseTimer(DeltaSeconds);
    }
}

void ACabinGameMode::BeginSession(float TotalSessionSeconds, float SprintSeconds, float BreakSeconds)
{
    TotalSessionDuration = TotalSessionSeconds;
    SprintDuration       = SprintSeconds;
    BreakDuration        = BreakSeconds;
    bSessionActive       = true;

    UE_LOG(LogCabinGameMode, Log, TEXT("Session started: %.0fs total, %.0fs sprint, %.0fs break."),
        TotalSessionSeconds, SprintSeconds, BreakSeconds);

    TransitionToPhase(ECabinPhase::PreDeparture);
}

void ACabinGameMode::NotifySprintComplete()
{
    if (CurrentPhase == ECabinPhase::Cruise)
    {
        TransitionToPhase(ECabinPhase::Break);
    }
}

void ACabinGameMode::NotifySessionComplete()
{
    if (CurrentPhase == ECabinPhase::Cruise || CurrentPhase == ECabinPhase::Break)
    {
        TransitionToPhase(ECabinPhase::Descent);
    }
}

void ACabinGameMode::TransitionToPhase(ECabinPhase TargetPhase)
{
    if (!IsValidTransition(CurrentPhase, TargetPhase))
    {
        UE_LOG(LogCabinGameMode, Warning, TEXT("Invalid phase transition: %d -> %d"),
            (int32)CurrentPhase, (int32)TargetPhase);
        return;
    }
    CommitPhaseTransition(TargetPhase);
}

bool ACabinGameMode::IsValidTransition(ECabinPhase From, ECabinPhase To) const
{
    // Enforce linear gate-to-gate order; allow Cruise <-> Break cycling.
    switch (From)
    {
        case ECabinPhase::Boarding:     return To == ECabinPhase::PreDeparture;
        case ECabinPhase::PreDeparture: return To == ECabinPhase::Taxi;
        case ECabinPhase::Taxi:         return To == ECabinPhase::Takeoff;
        case ECabinPhase::Takeoff:      return To == ECabinPhase::Cruise;
        case ECabinPhase::Cruise:       return To == ECabinPhase::Break     || To == ECabinPhase::Descent;
        case ECabinPhase::Break:        return To == ECabinPhase::Cruise    || To == ECabinPhase::Descent;
        case ECabinPhase::Descent:      return To == ECabinPhase::Landing;
        case ECabinPhase::Landing:      return To == ECabinPhase::GateArrival;
        case ECabinPhase::GateArrival:  return false; // terminal
        default:                        return false;
    }
}

void ACabinGameMode::CommitPhaseTransition(ECabinPhase NewPhase)
{
    CurrentPhase  = NewPhase;
    PhaseElapsed  = 0.f;
    UE_LOG(LogCabinGameMode, Log, TEXT("Phase -> %d"), (int32)NewPhase);
    OnPhaseChanged.Broadcast(NewPhase);
}

void ACabinGameMode::AdvancePhaseTimer(float DeltaSeconds)
{
    if (!bSessionActive) return;

    PhaseElapsed += DeltaSeconds;
    const float Duration = DurationForPhase(CurrentPhase);
    if (Duration > 0.f && PhaseElapsed >= Duration)
    {
        // Auto-advance fixed cinematic phases.
        switch (CurrentPhase)
        {
            case ECabinPhase::Boarding:     TransitionToPhase(ECabinPhase::PreDeparture); break;
            case ECabinPhase::PreDeparture: TransitionToPhase(ECabinPhase::Taxi);         break;
            case ECabinPhase::Taxi:         TransitionToPhase(ECabinPhase::Takeoff);      break;
            case ECabinPhase::Takeoff:      TransitionToPhase(ECabinPhase::Cruise);       break;
            case ECabinPhase::Descent:      TransitionToPhase(ECabinPhase::Landing);      break;
            case ECabinPhase::Landing:      TransitionToPhase(ECabinPhase::GateArrival);  break;
            default: break;
        }
    }
}

float ACabinGameMode::DurationForPhase(ECabinPhase Phase) const
{
    switch (Phase)
    {
        case ECabinPhase::Boarding:     return kBoardingDuration;
        case ECabinPhase::PreDeparture: return kPreDepartureDuration;
        case ECabinPhase::Taxi:         return kTaxiDuration;
        case ECabinPhase::Takeoff:      return kTakeoffDuration;
        case ECabinPhase::Descent:      return kDescentDuration;
        case ECabinPhase::Landing:      return kLandingDuration;
        case ECabinPhase::GateArrival:  return kGateArrivalDuration;
        default:                        return 0.f; // Cruise and Break are session-driven.
    }
}
