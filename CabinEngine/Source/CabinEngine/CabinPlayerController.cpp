// CabinPlayerController.cpp

#include "CabinPlayerController.h"
#include "CabinPawn.h"
#include "EnhancedInputComponent.h"
#include "EnhancedInputSubsystems.h"
#include "InputAction.h"
#include "InputMappingContext.h"
#include "Engine/LocalPlayer.h"
#include "Logging/LogMacros.h"
#include "UObject/ConstructorHelpers.h"

DEFINE_LOG_CATEGORY_STATIC(LogCabinController, Log, All);

ACabinPlayerController::ACabinPlayerController()
{
    PrimaryActorTick.bCanEverTick = true;
    bShowMouseCursor = false;
}

void ACabinPlayerController::BeginPlay()
{
    Super::BeginPlay();

    if (UEnhancedInputLocalPlayerSubsystem* Subsystem =
        ULocalPlayer::GetSubsystem<UEnhancedInputLocalPlayerSubsystem>(GetLocalPlayer()))
    {
        if (CabinIMC)
        {
            Subsystem->AddMappingContext(CabinIMC, 0);
        }
    }

    UE_LOG(LogCabinController, Log, TEXT("CabinPlayerController ready."));
}

void ACabinPlayerController::SetupInputComponent()
{
    Super::SetupInputComponent();

    if (UEnhancedInputComponent* EIC = Cast<UEnhancedInputComponent>(InputComponent))
    {
        if (IA_Look)
        {
            EIC->BindAction(IA_Look, ETriggerEvent::Triggered, this,
                &ACabinPlayerController::HandleLookInput);
        }
        if (IA_Tap)
        {
            EIC->BindAction(IA_Tap, ETriggerEvent::Started, this,
                &ACabinPlayerController::HandleTapInput);
        }
    }
}

void ACabinPlayerController::PlayerTick(float DeltaTime)
{
    Super::PlayerTick(DeltaTime);
    // Gyro injection happens via InjectGyroInput() called from the bridge each frame.
}

void ACabinPlayerController::HandleLookInput(const FInputActionValue& Value)
{
    const FVector2D LookAxis = Value.Get<FVector2D>();
    ClampAndApplyLook(LookAxis.X * DragSensitivity, -LookAxis.Y * DragSensitivity);
}

void ACabinPlayerController::HandleTapInput(const FInputActionValue& Value)
{
    // Get screen-space tap location from Enhanced Input touch data.
    float MouseX, MouseY;
    GetMousePosition(MouseX, MouseY);

    int32 ViewportX, ViewportY;
    GetViewportSize(ViewportX, ViewportY);

    if (ViewportX > 0 && ViewportY > 0)
    {
        const float NormX = MouseX / (float)ViewportX;
        const float NormY = MouseY / (float)ViewportY;
        InjectTapAtNormalisedPosition(NormX, NormY);
    }
}

void ACabinPlayerController::InjectGyroInput(float DeltaYaw, float DeltaPitch)
{
    ClampAndApplyLook(DeltaYaw * GyroSensitivity, DeltaPitch * GyroSensitivity);
}

void ACabinPlayerController::InjectTapAtNormalisedPosition(float NormX, float NormY)
{
    const ECabinHotspot Hit = HitTestHotspot(NormX, NormY);
    if (Hit != ECabinHotspot::None)
    {
        UE_LOG(LogCabinController, Log, TEXT("Hotspot tapped: %d"), (int32)Hit);
        OnHotspotTapped.Broadcast(Hit);
    }
}

void ACabinPlayerController::ClampAndApplyLook(float DeltaYaw, float DeltaPitch)
{
    CurrentYaw   = FMath::Clamp(CurrentYaw   + DeltaYaw,   -MaxYaw,   MaxYaw);
    CurrentPitch = FMath::Clamp(CurrentPitch + DeltaPitch,  MinPitch,  MaxPitch);

    if (ACabinPawn* Pawn = Cast<ACabinPawn>(GetPawn()))
    {
        Pawn->ApplyCameraLook(CurrentYaw, CurrentPitch);
    }

    OnLookDelta.Broadcast(DeltaYaw, DeltaPitch);
}

ECabinHotspot ACabinPlayerController::HitTestHotspot(float NormX, float NormY) const
{
    // Screen-space hotspot regions defined relative to the default forward-facing
    // seated camera framing. These are approximate and intended to be tuned in BP.
    //
    // Layout (portrait-adjacent landscape, typical framing):
    //   IFE screen:    x [0.25, 0.75], y [0.10, 0.65]
    //   Tray table:    x [0.20, 0.80], y [0.65, 0.80]
    //   Seat controls: x [0.80, 1.00], y [0.30, 0.70]  (right console default)
    //   Storage cubby: x [0.80, 1.00], y [0.10, 0.30]
    //   Window:        x [0.00, 0.20], y [0.10, 0.70]  (left window seats)
    //
    // A proper ray-cast against scene primitives is recommended once meshes
    // are placed in the level. This region-map is the fallback for early testing.

    if (NormX >= 0.25f && NormX <= 0.75f && NormY >= 0.10f && NormY <= 0.65f)
        return ECabinHotspot::IFEScreen;

    if (NormX >= 0.20f && NormX <= 0.80f && NormY >= 0.65f && NormY <= 0.80f)
        return ECabinHotspot::TrayTable;

    if (NormX >= 0.80f && NormY >= 0.30f && NormY <= 0.45f)
        return ECabinHotspot::SeatUpright;

    if (NormX >= 0.80f && NormY >= 0.45f && NormY <= 0.55f)
        return ECabinHotspot::SeatLounge;

    if (NormX >= 0.80f && NormY >= 0.55f && NormY <= 0.65f)
        return ECabinHotspot::SeatBed;

    if (NormX >= 0.80f && NormY >= 0.65f && NormY <= 0.70f)
        return ECabinHotspot::SeatLumbar;

    if (NormX >= 0.80f && NormY >= 0.10f && NormY <= 0.30f)
        return ECabinHotspot::StorageCubby;

    if (NormX <= 0.20f && NormY >= 0.10f && NormY <= 0.70f)
        return ECabinHotspot::Window;

    return ECabinHotspot::None;
}
