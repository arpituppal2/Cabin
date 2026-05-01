// CabinBridge.h
// UE-side bridge object.
// Receives the shared IOSurface/Metal texture handle from SwiftUI and
// routes gyro/touch events into CabinPlayerController.
//
// This actor is placed in CabinMap and configured in BP_CabinBridge.
// SwiftUI calls the exported C functions declared in SwiftBridgeInterface.h;
// those functions resolve to this actor via the world subsystem.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "CabinBridge.generated.h"

class ACabinPlayerController;
class UCabinSessionManager;

// Low-power rendering mode — disables Lumen, switches to baked lighting.
UENUM(BlueprintType)
enum class ECabinRenderMode : uint8
{
    HighFidelity    UMETA(DisplayName = "High Fidelity (Lumen + Nanite)"),
    LowPower        UMETA(DisplayName = "Low Power (Baked Lighting)")
};

UCLASS()
class CABINENGINE_API ACabinBridge : public AActor
{
    GENERATED_BODY()

public:
    ACabinBridge();

    // --- Called from Swift (via exported C shim) each frame ---

    // Inject gyroscope delta (radians/s, converted to degrees inside).
    UFUNCTION(BlueprintCallable, Category = "Cabin|Bridge")
    void ReceiveGyroInput(float DeltaYawRad, float DeltaPitchRad);

    // Inject normalised tap coordinates [0,1].
    UFUNCTION(BlueprintCallable, Category = "Cabin|Bridge")
    void ReceiveTap(float NormX, float NormY);

    // Update the IFE Metal texture pointer each frame.
    // TextureHandle is a platform-specific GPU resource handle (MTLTexture on Apple).
    // Passing as int64 to remain ABI-safe across the C bridge boundary.
    UFUNCTION(BlueprintCallable, Category = "Cabin|Bridge")
    void UpdateIFETexture(int64 MetalTextureHandle, int32 Width, int32 Height);

    // --- Session control (called from Swift onboarding) ---

    UFUNCTION(BlueprintCallable, Category = "Cabin|Bridge")
    void StartSessionFromSwift(
        float TotalMinutes,
        float SprintMinutes,
        float BreakMinutes,
        float TaxiMinutes,
        const FString& DepartureIATA,
        const FString& ArrivalIATA,
        float DepLon, float DepLat,
        float ArrLon, float ArrLat,
        int32 SeatIndex   // maps to ECabinSeat
    );

    UFUNCTION(BlueprintCallable, Category = "Cabin|Bridge")
    void EndSessionFromSwift();

    // --- Render mode ---

    UFUNCTION(BlueprintCallable, Category = "Cabin|Bridge")
    void SetRenderMode(ECabinRenderMode Mode);

    UFUNCTION(BlueprintPure, Category = "Cabin|Bridge")
    ECabinRenderMode GetRenderMode() const { return CurrentRenderMode; }

    // The IFE UTexture2D updated each frame. Assign to M_IFEScreen in BP.
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Cabin|Bridge")
    TObjectPtr<UTexture2D> IFETexture;

protected:
    virtual void BeginPlay() override;
    virtual void EndPlay(const EEndPlayReason::Type Reason) override;
    virtual void Tick(float DeltaSeconds) override;

private:
    UPROPERTY()
    TObjectPtr<ACabinPlayerController> CachedController;

    UPROPERTY()
    TObjectPtr<UCabinSessionManager> CachedSessionManager;

    ECabinRenderMode CurrentRenderMode = ECabinRenderMode::HighFidelity;

    // Last known Metal texture dimensions.
    int32 IFEWidth  = 0;
    int32 IFEHeight = 0;

    // Pending texture update from this frame.
    int64  PendingTextureHandle = 0;
    bool   bPendingTextureUpdate = false;

    // CVars toggled by SetRenderMode.
    void ApplyHighFidelityMode();
    void ApplyLowPowerMode();

    // Creates or resizes IFETexture to match incoming dimensions.
    void EnsureIFETexture(int32 Width, int32 Height);

    // Uploads the Metal texture data into IFETexture on the render thread.
    void FlushPendingTextureUpdate();

    // Resolves controller/session manager refs from world.
    void CacheWorldRefs();
};
