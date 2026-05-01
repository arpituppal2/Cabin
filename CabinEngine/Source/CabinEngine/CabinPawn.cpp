// CabinPawn.cpp

#include "CabinPawn.h"
#include "Camera/CameraComponent.h"
#include "GameFramework/SpringArmComponent.h"
#include "LevelSequencePlayer.h"
#include "LevelSequence.h"
#include "ALevelSequenceActor.h"
#include "MovieSceneSequencePlaybackSettings.h"
#include "Kismet/GameplayStatics.h"
#include "Math/UnrealMathUtility.h"
#include "Logging/LogMacros.h"

DEFINE_LOG_CATEGORY_STATIC(LogCabinPawn, Log, All);

// Seat offsets (cm from cabin forward origin, Y = left/right, Z = up).
// Tune these in-editor to match the modelled suite positions.
static const TMap<ECabinSeat, FVector> kSeatOffsets =
{
    { ECabinSeat::Seat1A,  FVector(  0.f, -220.f, 0.f) },  // True Left Window
    { ECabinSeat::Seat2B,  FVector(  0.f, -120.f, 0.f) },  // Left Aisle
    { ECabinSeat::Seat1D,  FVector(  0.f,  -40.f, 0.f) },  // Center Left Aisle Facing
    { ECabinSeat::Seat2D,  FVector(  0.f,   20.f, 0.f) },  // Center Left Center Facing
    { ECabinSeat::Seat2G,  FVector(  0.f,   80.f, 0.f) },  // Center Right Center Facing
    { ECabinSeat::Seat1G,  FVector(  0.f,  140.f, 0.f) },  // Center Right Aisle Facing
    { ECabinSeat::Seat2J,  FVector(  0.f,  200.f, 0.f) },  // Right Aisle
    { ECabinSeat::Seat1L,  FVector(  0.f,  260.f, 0.f) },  // True Right Window
};

ACabinPawn::ACabinPawn()
{
    PrimaryActorTick.bCanEverTick = true;

    PawnRoot = CreateDefaultSubobject<USceneComponent>(TEXT("PawnRoot"));
    SetRootComponent(PawnRoot);

    // Spring arm gives us easy camera lag and turbulence offset.
    CameraArm = CreateDefaultSubobject<USpringArmComponent>(TEXT("CameraArm"));
    CameraArm->SetupAttachment(PawnRoot);
    CameraArm->TargetArmLength = 0.f;          // zero arm — we control offset manually
    CameraArm->bUsePawnControlRotation = false;
    CameraArm->bEnableCameraLag = true;
    CameraArm->CameraLagSpeed = 8.f;            // smooth inertia on look
    CameraArm->bInheritPitch = true;
    CameraArm->bInheritYaw = true;
    CameraArm->bInheritRoll = false;

    FirstPersonCamera = CreateDefaultSubobject<UCameraComponent>(TEXT("FirstPersonCamera"));
    FirstPersonCamera->SetupAttachment(CameraArm, USpringArmComponent::SocketName);
    FirstPersonCamera->SetRelativeLocation(FVector(0.f, 0.f, 0.f));
    FirstPersonCamera->FieldOfView = 75.f;
    FirstPersonCamera->bUsePawnControlRotation = false;
}

void ACabinPawn::BeginPlay()
{
    Super::BeginPlay();

    // Subscribe to phase changes from GameMode.
    if (ACabinGameMode* GM = Cast<ACabinGameMode>(GetWorld()->GetAuthGameMode()))
    {
        GM->OnPhaseChanged.AddDynamic(this, &ACabinPawn::OnPhaseChanged);
    }

    // Set initial seat transform.
    SetSeat(CurrentSeat);

    UE_LOG(LogCabinPawn, Log, TEXT("CabinPawn ready. Seat: %d"), (int32)CurrentSeat);
}

void ACabinPawn::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);

    WorldTime += DeltaSeconds;

    // --- Phase pitch tilt (takeoff / descent) ---
    SmoothedPhasePitch = FMath::FInterpTo(SmoothedPhasePitch, TargetPhasePitch, DeltaSeconds, 1.5f);

    // --- Turbulence ---
    const FVector TurbDisp = (CurrentPhase == ECabinPhase::Cruise || CurrentPhase == ECabinPhase::Break)
        ? SampleTurbulence(WorldTime)
        : FVector::ZeroVector;

    // --- Breathing ---
    const float BreathZ = (CurrentPhase == ECabinPhase::Cruise)
        ? SampleBreathing(WorldTime)
        : 0.f;

    // Compose final arm offset.
    const FVector ArmOffset = FVector(TurbDisp.X, TurbDisp.Y, TurbDisp.Z + BreathZ);
    CameraArm->SetRelativeLocation(ArmOffset);

    // Apply look rotation + phase tilt to arm.
    const FRotator LookRot(LookPitch + SmoothedPhasePitch, LookYaw, 0.f);
    CameraArm->SetWorldRotation(GetActorRotation() + LookRot);
}

void ACabinPawn::SetupPlayerInputComponent(UInputComponent* PlayerInputComponent)
{
    Super::SetupPlayerInputComponent(PlayerInputComponent);
    // Input handled entirely by CabinPlayerController via Enhanced Input.
}

void ACabinPawn::ApplyCameraLook(float Yaw, float Pitch)
{
    LookYaw   = Yaw;
    LookPitch = Pitch;
}

void ACabinPawn::SetSeat(ECabinSeat NewSeat)
{
    CurrentSeat = NewSeat;
    const FTransform SeatXForm = GetSeatTransform(NewSeat);
    SetActorTransform(SeatXForm);
    UE_LOG(LogCabinPawn, Log, TEXT("Seat set to %d"), (int32)NewSeat);
}

void ACabinPawn::OnPhaseChanged(ECabinPhase NewPhase)
{
    CurrentPhase = NewPhase;

    switch (NewPhase)
    {
        case ECabinPhase::Takeoff:
            TargetPhasePitch = TakeoffTiltDegrees;
            PlaySequence(SEQ_Takeoff);
            break;

        case ECabinPhase::Cruise:
            TargetPhasePitch = 0.f;
            break;

        case ECabinPhase::Break:
            PlaySequence(SEQ_BreakWalk);
            break;

        case ECabinPhase::Descent:
            TargetPhasePitch = DescentTiltDegrees;
            PlaySequence(SEQ_Descent);
            break;

        case ECabinPhase::Landing:
            TargetPhasePitch = 0.f;
            PlaySequence(SEQ_Landing);
            break;

        default:
            TargetPhasePitch = 0.f;
            break;
    }
}

FTransform ACabinPawn::GetSeatTransform(ECabinSeat Seat) const
{
    const FVector* OffsetPtr = kSeatOffsets.Find(Seat);
    const FVector Offset = OffsetPtr ? *OffsetPtr : FVector::ZeroVector;
    // Eye height above cabin floor: ~130cm seated.
    return FTransform(FRotator::ZeroRotator, FVector(Offset.X, Offset.Y, 130.f));
}

FVector ACabinPawn::SampleTurbulence(float Time) const
{
    if (TurbulenceIntensity <= KINDA_SMALL_NUMBER) return FVector::ZeroVector;

    // Three independent Perlin samples for X / Y / Z displacement.
    // Using FMath::PerlinNoise1D with different frequency and phase offsets.
    const float Scale = TurbulenceMaxDisplacement * TurbulenceIntensity;
    const float X = FMath::PerlinNoise1D(Time * 0.43f + 0.0f) * Scale * 0.4f;
    const float Y = FMath::PerlinNoise1D(Time * 0.37f + 5.3f) * Scale * 0.3f;
    const float Z = FMath::PerlinNoise1D(Time * 0.61f + 2.7f) * Scale;
    return FVector(X, Y, Z);
}

float ACabinPawn::SampleBreathing(float Time) const
{
    // Slow sine at ~0.2 Hz (one breath cycle every ~5 seconds).
    return FMath::Sin(Time * 0.2f * PI * 2.f) * BreathingAmplitude;
}

void ACabinPawn::PlaySequence(ULevelSequence* Sequence)
{
    if (!Sequence || !GetWorld()) return;

    FMovieSceneSequencePlaybackSettings Settings;
    Settings.bAutoPlay = true;
    Settings.bPauseAtEnd = true;

    ALevelSequenceActor* SeqActor = nullptr;
    SequencePlayer = ULevelSequencePlayer::CreateLevelSequencePlayer(
        GetWorld(), Sequence, Settings, SeqActor);

    if (SequencePlayer)
    {
        SequencePlayer->Play();
        UE_LOG(LogCabinPawn, Log, TEXT("Playing sequence: %s"), *Sequence->GetName());
    }
}
