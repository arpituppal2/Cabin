// CabinPawn.h
// The seated first-person body. Owns the camera rig.
// Receives look input from CabinPlayerController.
// Drives turbulence shake, takeoff tilt, and break-walk via Sequencer.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Pawn.h"
#include "CabinGameMode.h"
#include "CabinPawn.generated.h"

class UCameraComponent;
class USpringArmComponent;
class USceneComponent;
class ULevelSequencePlayer;
class ULevelSequence;

// Seat position enum used to configure camera offset and window visibility.
UENUM(BlueprintType)
enum class ECabinSeat : uint8
{
    Seat1A  UMETA(DisplayName = "1A - True Left Window"),
    Seat2B  UMETA(DisplayName = "2B - Left Aisle"),
    Seat1D  UMETA(DisplayName = "1D - Center Left Aisle Facing"),
    Seat2D  UMETA(DisplayName = "2D - Center Left Center Facing"),
    Seat2G  UMETA(DisplayName = "2G - Center Right Center Facing"),
    Seat1G  UMETA(DisplayName = "1G - Center Right Aisle Facing"),
    Seat2J  UMETA(DisplayName = "2J - Right Aisle"),
    Seat1L  UMETA(DisplayName = "1L - True Right Window")
};

UCLASS()
class CABINENGINE_API ACabinPawn : public APawn
{
    GENERATED_BODY()

public:
    ACabinPawn();

    // Called by CabinPlayerController every frame with clamped yaw/pitch.
    UFUNCTION(BlueprintCallable, Category = "Cabin|Camera")
    void ApplyCameraLook(float Yaw, float Pitch);

    // Change seat. Triggers a fade-to-black and repositions the pawn origin.
    UFUNCTION(BlueprintCallable, Category = "Cabin|Seat")
    void SetSeat(ECabinSeat NewSeat);

    UFUNCTION(BlueprintPure, Category = "Cabin|Seat")
    ECabinSeat GetCurrentSeat() const { return CurrentSeat; }

    // Phase-driven animation entry points (called by GameMode delegate).
    UFUNCTION(BlueprintCallable, Category = "Cabin|Phase")
    void OnPhaseChanged(ECabinPhase NewPhase);

    // Turbulence intensity [0,1]. Set by SessionManager based on route data.
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Cabin|Turbulence")
    float TurbulenceIntensity = 0.0f;

    // Master turbulence scale (max displacement in cm).
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Cabin|Turbulence")
    float TurbulenceMaxDisplacement = 1.8f;

    // Takeoff camera tilt (degrees forward, positive = nose up).
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Cabin|Animation")
    float TakeoffTiltDegrees = 12.f;

    // Descent camera tilt (degrees downward).
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Cabin|Animation")
    float DescentTiltDegrees = -5.f;

    // Idle breathing drift amplitude (cm). Applied during Cruise only.
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Cabin|Camera")
    float BreathingAmplitude = 0.18f;

    // Sequencer assets — assigned in BP_CabinPawn.
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Cabin|Sequences")
    TObjectPtr<ULevelSequence> SEQ_Takeoff;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Cabin|Sequences")
    TObjectPtr<ULevelSequence> SEQ_Descent;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Cabin|Sequences")
    TObjectPtr<ULevelSequence> SEQ_BreakWalk;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Cabin|Sequences")
    TObjectPtr<ULevelSequence> SEQ_Landing;

protected:
    virtual void BeginPlay() override;
    virtual void Tick(float DeltaSeconds) override;
    virtual void SetupPlayerInputComponent(UInputComponent* PlayerInputComponent) override;

private:
    // Components
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Cabin|Components", meta=(AllowPrivateAccess="true"))
    TObjectPtr<USceneComponent> PawnRoot;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Cabin|Components", meta=(AllowPrivateAccess="true"))
    TObjectPtr<USpringArmComponent> CameraArm;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Cabin|Components", meta=(AllowPrivateAccess="true"))
    TObjectPtr<UCameraComponent> FirstPersonCamera;

    // State
    ECabinSeat CurrentSeat = ECabinSeat::Seat1A;
    ECabinPhase CurrentPhase = ECabinPhase::Boarding;

    float LookYaw   = 0.f;
    float LookPitch = 0.f;
    float WorldTime = 0.f;  // accumulated for Perlin sampling

    // Phase tilt target and current (smoothly interpolated)
    float TargetPhasePitch = 0.f;
    float SmoothedPhasePitch = 0.f;

    // Sequencer player
    UPROPERTY()
    TObjectPtr<ULevelSequencePlayer> SequencePlayer;

    // Per-seat world transform offsets from cabin origin.
    FTransform GetSeatTransform(ECabinSeat Seat) const;

    // Turbulence: returns a small displacement vector this frame.
    FVector SampleTurbulence(float Time) const;

    // Breathing: subtle vertical sine during cruise.
    float SampleBreathing(float Time) const;

    // Play a level sequence on this pawn.
    void PlaySequence(ULevelSequence* Sequence);
};
