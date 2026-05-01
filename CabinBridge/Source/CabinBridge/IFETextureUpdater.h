// IFETextureUpdater.h
// Manages the per-frame CADisplayLink-aligned Metal texture pump.
// Decouples the raw texture handle from the UE render thread flush.
// One instance lives for the lifetime of the UE world.

#pragma once

#include "CoreMinimal.h"
#include "UObject/Object.h"
#include "IFETextureUpdater.generated.h"

UCLASS()
class CABINBRIDGE_API UIFETextureUpdater : public UObject
{
    GENERATED_BODY()

public:
    // Call once at startup with the target UTexture2D that drives M_IFEScreen.
    UFUNCTION(BlueprintCallable, Category = "Cabin|IFE")
    void Initialise(UTexture2D* TargetTexture);

    // Called by CabinBridge_UpdateIFETexture (game thread).
    // Queues a blit for this frame's render tick.
    void EnqueueTextureUpdate(int64 MetalHandle, int32 Width, int32 Height);

    // Called once per render tick by the owning ACabinBridge.
    void FlushUpdate();

    bool IsInitialised() const { return bInitialised; }

private:
    UPROPERTY()
    TObjectPtr<UTexture2D> Target;

    bool    bInitialised        = false;
    bool    bUpdatePending      = false;
    int64   PendingHandle       = 0;
    int32   PendingWidth        = 0;
    int32   PendingHeight       = 0;
};
