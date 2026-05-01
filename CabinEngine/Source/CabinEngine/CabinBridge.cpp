// CabinBridge.cpp

#include "CabinBridge.h"
#include "CabinPlayerController.h"
#include "CabinSessionManager.h"
#include "CabinPawn.h"
#include "Engine/Texture2D.h"
#include "TextureResource.h"
#include "RenderingThread.h"
#include "RHI.h"
#include "RHICommandList.h"
#include "Kismet/GameplayStatics.h"
#include "HAL/IConsoleManager.h"
#include "Logging/LogMacros.h"

#if CABIN_PLATFORM_APPLE
#import <Metal/Metal.h>
#import <QuartzCore/QuartzCore.h>
#endif

DEFINE_LOG_CATEGORY_STATIC(LogCabinBridge, Log, All);

ACabinBridge::ACabinBridge()
{
    PrimaryActorTick.bCanEverTick = true;
}

void ACabinBridge::BeginPlay()
{
    Super::BeginPlay();
    CacheWorldRefs();
    UE_LOG(LogCabinBridge, Log, TEXT("CabinBridge online."));
}

void ACabinBridge::EndPlay(const EEndPlayReason::Type Reason)
{
    Super::EndPlay(Reason);
    IFETexture = nullptr;
}

void ACabinBridge::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);

    if (bPendingTextureUpdate)
    {
        FlushPendingTextureUpdate();
        bPendingTextureUpdate = false;
    }
}

void ACabinBridge::CacheWorldRefs()
{
    if (APlayerController* PC = UGameplayStatics::GetPlayerController(this, 0))
    {
        CachedController = Cast<ACabinPlayerController>(PC);
    }
    if (UWorld* W = GetWorld())
    {
        CachedSessionManager = W->GetSubsystem<UCabinSessionManager>();
    }
}

// ---------------------------------------------------------------------------
// Input injection
// ---------------------------------------------------------------------------

void ACabinBridge::ReceiveGyroInput(float DeltaYawRad, float DeltaPitchRad)
{
    if (!CachedController) return;
    // Convert from radians to degrees for the controller.
    CachedController->InjectGyroInput(
        FMath::RadiansToDegrees(DeltaYawRad),
        FMath::RadiansToDegrees(DeltaPitchRad));
}

void ACabinBridge::ReceiveTap(float NormX, float NormY)
{
    if (!CachedController) return;
    CachedController->InjectTapAtNormalisedPosition(NormX, NormY);
}

// ---------------------------------------------------------------------------
// IFE Texture update
// ---------------------------------------------------------------------------

void ACabinBridge::UpdateIFETexture(int64 MetalTextureHandle, int32 Width, int32 Height)
{
    if (Width <= 0 || Height <= 0 || MetalTextureHandle == 0) return;

    EnsureIFETexture(Width, Height);
    PendingTextureHandle = MetalTextureHandle;
    bPendingTextureUpdate = true;
}

void ACabinBridge::EnsureIFETexture(int32 Width, int32 Height)
{
    if (IFETexture && IFEWidth == Width && IFEHeight == Height) return;

    IFEWidth  = Width;
    IFEHeight = Height;

    IFETexture = UTexture2D::CreateTransient(Width, Height, PF_B8G8R8A8, TEXT("IFETexture"));
    if (IFETexture)
    {
        IFETexture->NeverStream = true;
        IFETexture->SRGB = 1;
        IFETexture->Filter = TF_Bilinear;
        IFETexture->UpdateResource();
        UE_LOG(LogCabinBridge, Log, TEXT("IFETexture created: %dx%d"), Width, Height);
    }
}

void ACabinBridge::FlushPendingTextureUpdate()
{
#if CABIN_PLATFORM_APPLE
    if (!IFETexture || !IFETexture->GetResource()) return;

    // The Metal texture handle was passed as int64 from Swift.
    // Cast back to id<MTLTexture>.
    id<MTLTexture> SrcTex = (__bridge id<MTLTexture>)(void*)PendingTextureHandle;
    if (!SrcTex) return;

    FTextureResource* TexResource = IFETexture->GetResource();

    ENQUEUE_RENDER_COMMAND(CabinIFETextureUpdate)(
        [TexResource, SrcTex](FRHICommandListImmediate& RHICmdList)
        {
            // Get the underlying Metal texture from UE's RHI.
            FRHITexture* RHITex = TexResource->GetTextureRHI();
            if (!RHITex) return;

            // On Apple platforms the RHI texture IS a Metal texture.
            // We blit from the Swift-owned IOSurface-backed MTLTexture
            // into the UE-owned MTLTexture via a MetalKit blit encoder.
            id<MTLTexture> DstTex = (id<MTLTexture>)RHITex->GetNativeResource();
            if (!DstTex) return;

            id<MTLDevice>        Device  = DstTex.device;
            id<MTLCommandQueue>  Queue   = [Device newCommandQueue];
            id<MTLCommandBuffer> CmdBuf  = [Queue commandBuffer];
            id<MTLBlitCommandEncoder> Blit = [CmdBuf blitCommandEncoder];

            [Blit copyFromTexture:SrcTex
                     sourceSlice:0 sourceLevel:0
                    sourceOrigin:MTLOriginMake(0, 0, 0)
                      sourceSize:MTLSizeMake(SrcTex.width, SrcTex.height, 1)
                       toTexture:DstTex
            destinationSlice:0 destinationLevel:0
            destinationOrigin:MTLOriginMake(0, 0, 0)];

            [Blit endEncoding];
            [CmdBuf commit];
        }
    );
#else
    // Non-Apple stub — no-op.
    UE_LOG(LogCabinBridge, Warning, TEXT("UpdateIFETexture called on non-Apple platform. No-op."));
#endif
}

// ---------------------------------------------------------------------------
// Session control
// ---------------------------------------------------------------------------

void ACabinBridge::StartSessionFromSwift(
    float TotalMinutes, float SprintMinutes, float BreakMinutes, float TaxiMinutes,
    const FString& DepartureIATA, const FString& ArrivalIATA,
    float DepLon, float DepLat, float ArrLon, float ArrLat,
    int32 SeatIndex)
{
    if (!CachedSessionManager)
    {
        CacheWorldRefs();
        if (!CachedSessionManager) return;
    }

    FCabinSessionConfig Config;
    Config.TotalSessionMinutes  = TotalMinutes;
    Config.SprintMinutes        = SprintMinutes;
    Config.BreakMinutes         = BreakMinutes;
    Config.TaxiMinutes          = TaxiMinutes;
    Config.Route.DepartureIATA  = DepartureIATA;
    Config.Route.ArrivalIATA    = ArrivalIATA;
    Config.Route.DepartureLonLat = FVector2D(DepLon, DepLat);
    Config.Route.ArrivalLonLat   = FVector2D(ArrLon, ArrLat);

    CachedSessionManager->ConfigureAndStart(Config);

    // Apply seat selection to the pawn.
    if (ACabinPawn* Pawn = Cast<ACabinPawn>(UGameplayStatics::GetPlayerPawn(this, 0)))
    {
        ECabinSeat Seat = static_cast<ECabinSeat>(FMath::Clamp(SeatIndex, 0, 7));
        Pawn->SetSeat(Seat);
    }

    UE_LOG(LogCabinBridge, Log, TEXT("Session started from Swift: %s→%s, seat %d"),
        *DepartureIATA, *ArrivalIATA, SeatIndex);
}

void ACabinBridge::EndSessionFromSwift()
{
    if (CachedSessionManager)
    {
        CachedSessionManager->EndSessionNow();
    }
}

// ---------------------------------------------------------------------------
// Render mode
// ---------------------------------------------------------------------------

void ACabinBridge::SetRenderMode(ECabinRenderMode Mode)
{
    if (CurrentRenderMode == Mode) return;
    CurrentRenderMode = Mode;

    switch (Mode)
    {
        case ECabinRenderMode::HighFidelity: ApplyHighFidelityMode(); break;
        case ECabinRenderMode::LowPower:     ApplyLowPowerMode();     break;
    }
}

void ACabinBridge::ApplyHighFidelityMode()
{
    static IConsoleVariable* LumenGI  = IConsoleManager::Get().FindConsoleVariable(TEXT("r.Lumen.GlobalIllumination.Enable"));
    static IConsoleVariable* LumenRef = IConsoleManager::Get().FindConsoleVariable(TEXT("r.Lumen.Reflections.Enable"));
    static IConsoleVariable* Nanite   = IConsoleManager::Get().FindConsoleVariable(TEXT("r.Nanite"));
    if (LumenGI)  LumenGI->Set(1);
    if (LumenRef) LumenRef->Set(1);
    if (Nanite)   Nanite->Set(1);
    UE_LOG(LogCabinBridge, Log, TEXT("Render mode: High Fidelity (Lumen + Nanite ON)"));
}

void ACabinBridge::ApplyLowPowerMode()
{
    static IConsoleVariable* LumenGI  = IConsoleManager::Get().FindConsoleVariable(TEXT("r.Lumen.GlobalIllumination.Enable"));
    static IConsoleVariable* LumenRef = IConsoleManager::Get().FindConsoleVariable(TEXT("r.Lumen.Reflections.Enable"));
    static IConsoleVariable* Nanite   = IConsoleManager::Get().FindConsoleVariable(TEXT("r.Nanite"));
    if (LumenGI)  LumenGI->Set(0);
    if (LumenRef) LumenRef->Set(0);
    if (Nanite)   Nanite->Set(0);
    UE_LOG(LogCabinBridge, Log, TEXT("Render mode: Low Power (Lumen + Nanite OFF, baked lighting)"));
}
