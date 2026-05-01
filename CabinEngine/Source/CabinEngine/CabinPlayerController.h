// CabinPlayerController.h
// Owns all input handling and translates touch/gyro/mouse into camera look.
// Routes tap events to scene interaction hotspots.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/PlayerController.h"
#include "InputActionValue.h"
#include "CabinGameMode.h"
#include "CabinPlayerController.generated.h"

class UInputMappingContext;
class UInputAction;
class ACabinPawn;

// Identifies which diegetic hotspot the player has tapped.
UENUM(BlueprintType)
enum class ECabinHotspot : uint8
{
    None            UMETA(DisplayName = "None"),
    IFEScreen       UMETA(DisplayName = "IFE Screen"),
    TrayTable       UMETA(DisplayName = "Tray Table"),
    SeatUpright     UMETA(DisplayName = "Seat: Upright"),
    SeatLounge      UMETA(DisplayName = "Seat: Lounge"),
    SeatBed         UMETA(DisplayName = "Seat: Bed"),
    SeatLumbar      UMETA(DisplayName = "Seat: Lumbar"),
    StorageCubby    UMETA(DisplayName = "Storage Cubby"),
    Window          UMETA(DisplayName = "Window")
};

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnHotspotTapped, ECabinHotspot, Hotspot);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnLookDelta, float, DeltaYaw, float, DeltaPitch);

UCLASS()
class CABINENGINE_API ACabinPlayerController : public APlayerController
{
    GENERATED_BODY()

public:
    ACabinPlayerController();

    // Fired when a physical hotspot is tapped.
    UPROPERTY(BlueprintAssignable, Category = "Cabin|Input")
    FOnHotspotTapped OnHotspotTapped;

    // Fired every frame when drag or gyro produces a look delta.
    UPROPERTY(BlueprintAssignable, Category = "Cabin|Input")
    FOnLookDelta OnLookDelta;

    // Inject gyro data from SwiftUI bridge (called per-frame via CabinBridge).
    UFUNCTION(BlueprintCallable, Category = "Cabin|Input")
    void InjectGyroInput(float DeltaYaw, float DeltaPitch);

    // Inject a touch tap at normalised screen coords [0,1].
    UFUNCTION(BlueprintCallable, Category = "Cabin|Input")
    void InjectTapAtNormalisedPosition(float NormX, float NormY);

    // Camera yaw/pitch limits (degrees).
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Cabin|Camera")
    float MaxYaw   = 80.f;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Cabin|Camera")
    float MinPitch = -15.f;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Cabin|Camera")
    float MaxPitch = 45.f;

    // Sensitivity multipliers.
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Cabin|Camera")
    float DragSensitivity = 0.15f;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Cabin|Camera")
    float GyroSensitivity = 1.2f;

protected:
    virtual void BeginPlay() override;
    virtual void SetupInputComponent() override;
    virtual void PlayerTick(float DeltaTime) override;

private:
    // Enhanced Input assets (assigned in BP subclass or loaded by path).
    UPROPERTY()
    TObjectPtr<UInputMappingContext> CabinIMC;

    UPROPERTY()
    TObjectPtr<UInputAction> IA_Look;

    UPROPERTY()
    TObjectPtr<UInputAction> IA_Tap;

    // Accumulated camera orientation.
    float CurrentYaw   = 0.f;
    float CurrentPitch = 0.f;

    // Internal drag state.
    bool  bIsDragging  = false;
    FVector2D LastTouchPos = FVector2D::ZeroVector;

    void HandleLookInput(const FInputActionValue& Value);
    void HandleTapInput(const FInputActionValue& Value);
    void ClampAndApplyLook(float DeltaYaw, float DeltaPitch);
    ECabinHotspot HitTestHotspot(float NormX, float NormY) const;
};
