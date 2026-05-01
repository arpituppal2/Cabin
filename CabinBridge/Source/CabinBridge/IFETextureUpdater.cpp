// IFETextureUpdater.cpp

#include "IFETextureUpdater.h"
#include "Engine/Texture2D.h"
#include "TextureResource.h"
#include "RenderingThread.h"
#include "RHICommandList.h"
#include "Logging/LogMacros.h"

#if CABIN_BRIDGE_APPLE
#import <Metal/Metal.h>
#endif

DEFINE_LOG_CATEGORY_STATIC(LogIFEUpdater, Log, All);

void UIFETextureUpdater::Initialise(UTexture2D* TargetTexture)
{
    Target = TargetTexture;
    bInitialised = (Target != nullptr);
    UE_LOG(LogIFEUpdater, Log, TEXT("IFETextureUpdater initialised. Target: %s"),
        Target ? *Target->GetName() : TEXT("null"));
}

void UIFETextureUpdater::EnqueueTextureUpdate(int64 MetalHandle, int32 Width, int32 Height)
{
    if (!bInitialised) return;
    PendingHandle  = MetalHandle;
    PendingWidth   = Width;
    PendingHeight  = Height;
    bUpdatePending = true;
}

void UIFETextureUpdater::FlushUpdate()
{
    if (!bUpdatePending || !bInitialised || !Target) return;
    bUpdatePending = false;

    const int64  Handle = PendingHandle;
    const int32  W      = PendingWidth;
    const int32  H      = PendingHeight;
    FTextureResource* Res = Target->GetResource();
    if (!Res) return;

    ENQUEUE_RENDER_COMMAND(IFETextureBlit)(
        [Res, Handle, W, H](FRHICommandListImmediate& RHICmdList)
        {
#if CABIN_BRIDGE_APPLE
            id<MTLTexture> SrcTex = (__bridge id<MTLTexture>)(void*)(uintptr_t)Handle;
            if (!SrcTex) return;

            FRHITexture* RHITex = Res->GetTextureRHI();
            if (!RHITex) return;

            id<MTLTexture> DstTex = (id<MTLTexture>)RHITex->GetNativeResource();
            if (!DstTex) return;

            // Validate dimensions match before blitting.
            if ((NSUInteger)W != SrcTex.width || (NSUInteger)H != SrcTex.height)
            {
                return;
            }

            id<MTLDevice>       Device = DstTex.device;
            id<MTLCommandQueue> Queue  = [Device newCommandQueue];
            id<MTLCommandBuffer> Cmd   = [Queue commandBuffer];
            Cmd.label = @"CabinIFEBlit";

            id<MTLBlitCommandEncoder> Enc = [Cmd blitCommandEncoder];
            [Enc copyFromTexture:SrcTex
                    sourceSlice:0 sourceLevel:0
                   sourceOrigin:MTLOriginMake(0, 0, 0)
                     sourceSize:MTLSizeMake(W, H, 1)
                      toTexture:DstTex
           destinationSlice:0 destinationLevel:0
           destinationOrigin:MTLOriginMake(0, 0, 0)];
            [Enc endEncoding];
            [Cmd commit];
#endif
        }
    );
}
