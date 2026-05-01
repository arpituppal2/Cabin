// CabinWindowSystem.cpp

#include "CabinWindowSystem.h"
#include "Engine/World.h"
#include "Kismet/GameplayStatics.h"
#include "MediaPlayer.h"
#include "MediaTexture.h"
#include "Materials/MaterialParameterCollectionInstance.h"
#include "Math/UnrealMathUtility.h"

// ---------------------------------------------------------------------------
ACabinWindowSystem::ACabinWindowSystem()
{
    PrimaryActorTick.bCanEverTick = true;
    PrimaryActorTick.TickGroup    = TG_PostUpdateWork;

    // Create sub-components.
    SkyAtmosphere    = CreateDefaultSubobject<USkyAtmosphereComponent>(TEXT("SkyAtmosphere"));
    VolumetricClouds = CreateDefaultSubobject<UVolumetricCloudComponent>(TEXT("VolumetricClouds"));
    SkyCapture       = CreateDefaultSubobject<USceneCaptureComponent2D>(TEXT("SkyCapture"));
    SunLight         = CreateDefaultSubobject<UDirectionalLightComponent>(TEXT("SunLight"));
    FillLight        = CreateDefaultSubobject<UDirectionalLightComponent>(TEXT("FillLight"));

    RootComponent    = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));

    SunLight ->SetupAttachment(RootComponent);
    FillLight->SetupAttachment(RootComponent);
    SkyAtmosphere->SetupAttachment(RootComponent);
    VolumetricClouds->SetupAttachment(RootComponent);
    SkyCapture->SetupAttachment(RootComponent);

    // SkyCapture setup: faces nadir (downward through window plane).
    SkyCapture->SetRelativeRotation(FRotator(-90.f, 0.f, 0.f));
    SkyCapture->bCaptureEveryFrame      = true;
    SkyCapture->bCaptureOnMovement      = false;
    SkyCapture->CaptureSource           = ESceneCaptureSource::SCS_FinalColorLDR;
    SkyCapture->PrimitiveRenderMode     = ESceneCapturePrimitiveRenderMode::PRM_UseShowOnlyList;
    // Only capture sky + atmosphere, not cabin geometry.
    SkyCapture->ShowOnlyActorComponents.Add(SkyAtmosphere);
    SkyCapture->ShowOnlyActorComponents.Add(VolumetricClouds);

    // Fill light: soft blue underside fill.
    FillLight->SetRelativeRotation(FRotator(60.f, 180.f, 0.f));
    FillLight->Intensity    = 0.3f;
    FillLight->LightColor   = FColor(180, 210, 255);  // Cool blue bounce
    FillLight->bCastShadows = false;
}

// ---------------------------------------------------------------------------
void ACabinWindowSystem::BeginPlay()
{
    Super::BeginPlay();

    // Grab the MPC instance for this world.
    if (MPC_WindowBlend)
    {
        MPCInstance = GetWorld()->GetParameterCollectionInstance(MPC_WindowBlend);
    }

    // Wire sky capture RT.
    if (SkyCapture && RT_SkyCap)
    {
        SkyCapture->TextureTarget = RT_SkyCap;
    }

    // Randomise turbulence phase so consecutive sessions feel different.
    TurbulencePhaseOffset = FMath::FRandRange(0.f, 2.f * PI);

    // Start at boarding state.
    SetFlightPhase(ECabinFlightPhase::Boarding);
    InitialiseForSeat(ActiveSeatIndex);
}

// ---------------------------------------------------------------------------
void ACabinWindowSystem::Tick(float DeltaTime)
{
    Super::Tick(DeltaTime);

    // 1. Turbulence
    if (CurrentPhase == ECabinFlightPhase::Cruise || CurrentPhase == ECabinFlightPhase::Descent)
    {
        TickTurbulence(DeltaTime);
    }

    // 2. Light fade
    if (bFadingLight)
    {
        LightFadeTimer += DeltaTime;
        float Alpha = FMath::Clamp(LightFadeTimer / LightFadeDuration, 0.f, 1.f);
        float Current = FMath::Lerp(LightFadeFrom, LightFadeTo, Alpha);
        if (SunLight) { SunLight->SetIntensity(Current); }
        if (Alpha >= 1.f) { bFadingLight = false; }
    }

    // 3. Meal service boost fade-out
    if (bMealServiceActive)
    {
        MealServiceTimer -= DeltaTime;
        if (MealServiceTimer <= 0.f)
        {
            bMealServiceActive = false;
            BeginLightFade(GetPhaseTargetLightIntensity(CurrentPhase));
        }
    }

    // 4. Push video weight to MPC (video plate dominates; sky peeks through at edges).
    if (MPCInstance)
    {
        float VideoWeight = (CurrentPhase == ECabinFlightPhase::Boarding) ? 0.0f : 0.85f;
        MPCInstance->SetScalarParameterValue(FName("VideoWeight"), VideoWeight);
        MPCInstance->SetScalarParameterValue(FName("SkyWeight"),   1.f - VideoWeight);
    }
}

// ---------------------------------------------------------------------------
void ACabinWindowSystem::InitialiseForSeat(int32 SeatIndex)
{
    ActiveSeatIndex = FMath::Clamp(SeatIndex, 0, 7);
    SwapVideoPlate(ActiveSeatIndex);

    // Adjust SkyCapture roll based on window side.
    // Left-side seats tilt camera left; right-side tilt right.
    // This gives the parallax impression of different window angles.
    const float SideAngles[8] = { -22.f, -14.f, -8.f, -4.f, 4.f, 8.f, 14.f, 22.f };
    if (SkyCapture)
    {
        FRotator R = SkyCapture->GetRelativeRotation();
        R.Roll = SideAngles[ActiveSeatIndex];
        SkyCapture->SetRelativeRotation(R);
    }
}

// ---------------------------------------------------------------------------
void ACabinWindowSystem::SetFlightPhase(ECabinFlightPhase NewPhase)
{
    CurrentPhase = NewPhase;
    BeginLightFade(GetPhaseTargetLightIntensity(NewPhase));

    // Cabin light colour temperature shift.
    if (SunLight)
    {
        FLinearColor TargetColor;
        switch (NewPhase)
        {
            case ECabinFlightPhase::Boarding:
                TargetColor = FLinearColor(1.f, 0.97f, 0.92f);   // Warm white
                break;
            case ECabinFlightPhase::Taxi:
                TargetColor = FLinearColor(0.55f, 0.62f, 1.f);   // Blue/purple pre-takeoff
                break;
            case ECabinFlightPhase::Takeoff:
                TargetColor = FLinearColor(0.6f, 0.65f, 1.f);
                break;
            case ECabinFlightPhase::Cruise:
                TargetColor = FLinearColor(0.82f, 0.88f, 1.f);   // Cool cruise
                break;
            case ECabinFlightPhase::Break:
                TargetColor = FLinearColor(0.85f, 0.9f, 1.f);
                break;
            case ECabinFlightPhase::Descent:
                TargetColor = FLinearColor(1.f, 0.95f, 0.88f);   // Warm landing
                break;
        }
        SunLight->SetLightFColor(TargetColor.ToFColor(true));
    }

    // VolumetricCloud density varies by phase.
    if (VolumetricClouds)
    {
        float CloudDensity = 0.f;
        switch (NewPhase)
        {
            case ECabinFlightPhase::Boarding: CloudDensity = 0.0f; break;
            case ECabinFlightPhase::Taxi:     CloudDensity = 0.1f; break;
            case ECabinFlightPhase::Takeoff:  CloudDensity = 0.6f; break;
            case ECabinFlightPhase::Cruise:   CloudDensity = 0.9f; break;  // Sea of clouds
            case ECabinFlightPhase::Break:    CloudDensity = 0.9f; break;
            case ECabinFlightPhase::Descent:  CloudDensity = 0.5f; break;
        }
        VolumetricClouds->SetLayerBottomAltitude(6.5f);       // km — above tarmac, below cruise
        // Density scalar driven via material parameter; Blueprint wires this.
        if (MPCInstance)
        {
            MPCInstance->SetScalarParameterValue(FName("CloudDensity"), CloudDensity);
        }
    }
}

// ---------------------------------------------------------------------------
void ACabinWindowSystem::SetSessionProgress(float Progress)
{
    SessionProgress = FMath::Clamp(Progress, 0.f, 1.f);
    UpdateSunTransform(SessionProgress);
}

// ---------------------------------------------------------------------------
void ACabinWindowSystem::TickTurbulence(float DeltaTime)
{
    if (!TurbulenceCurve) { return; }

    TurbulenceTimer += DeltaTime;

    // Evaluate curve for current cruise progress (reuse SessionProgress).
    float Amplitude = TurbulenceCurve->GetFloatValue(SessionProgress);

    // Two-frequency Perlin-ish shake using sin combos.
    float T = TurbulenceTimer;
    float Yaw   = Amplitude * (FMath::Sin(T * 0.37f + TurbulencePhaseOffset) * 0.6f
                             + FMath::Sin(T * 1.13f) * 0.4f);
    float Pitch = Amplitude * (FMath::Sin(T * 0.53f + TurbulencePhaseOffset + 1.2f) * 0.5f
                             + FMath::Sin(T * 0.91f) * 0.5f);
    float Roll  = Amplitude * FMath::Sin(T * 0.27f) * 0.3f;

    // Push to MPC so the camera Blueprint can read and apply it.
    if (MPCInstance)
    {
        MPCInstance->SetScalarParameterValue(FName("TurbulenceYaw"),   Yaw);
        MPCInstance->SetScalarParameterValue(FName("TurbulencePitch"), Pitch);
        MPCInstance->SetScalarParameterValue(FName("TurbulenceRoll"),  Roll);
    }
}

// ---------------------------------------------------------------------------
void ACabinWindowSystem::TriggerMealServiceLighting(float DurationSeconds)
{
    bMealServiceActive = true;
    MealServiceTimer   = DurationSeconds;
    BeginLightFade(MealServiceBoostIntensity);
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

void ACabinWindowSystem::SwapVideoPlate(int32 SeatIndex)
{
    if (!SeatVideoPlates.IsValidIndex(SeatIndex)) { return; }
    if (!SeatMediaTextures.IsValidIndex(SeatIndex)) { return; }

    UMediaPlayer*  Player  = SeatVideoPlates[SeatIndex];
    UMediaTexture* Texture = SeatMediaTextures[SeatIndex];
    if (!Player || !Texture) { return; }

    // Stop all other players.
    for (int32 i = 0; i < SeatVideoPlates.Num(); ++i)
    {
        if (i != SeatIndex && SeatVideoPlates[i])
        {
            SeatVideoPlates[i]->Close();
        }
    }

    // Open and loop the active plate.
    // Source URL is set per-player asset in the editor (e.g. file:///.../<seat>_plate.mp4).
    if (!Player->IsPlaying())
    {
        Player->PlayOnOpen = true;
        Player->SetLooping(true);
        Player->OpenSource(Texture->GetMediaPlayer()->GetUrl().IsEmpty()
            ? nullptr : Texture->GetMediaPlayer());
        // If the media source is already assigned to the asset, just Play().
        Player->Play();
    }

    // Update RT_WindowPlate to sample from this texture.
    // The material reads RT_WindowPlate; we blit Texture -> RT via SkyCapture blit
    // or a simple material redirect. In Blueprint, wire:
    //   MI_Window_Master -> VideoTexture param -> SeatMediaTextures[ActiveSeatIndex]
    if (MPCInstance)
    {
        // We store the active seat index so the master material BP can
        // switch the Texture Object parameter each time this is called.
        MPCInstance->SetScalarParameterValue(FName("ActiveSeatIndex"),
            static_cast<float>(SeatIndex));
    }
}

void ACabinWindowSystem::UpdateSunTransform(float Progress)
{
    if (!SunLight) { return; }

    // Sun pitch: curve maps 0..1 -> angle in degrees.
    float Pitch = SunAngleCurve
        ? SunAngleCurve->GetFloatValue(Progress)
        : FMath::Lerp(-10.f, 50.f, Progress);   // Fallback: dawn -> noon arc

    SunLight->SetRelativeRotation(FRotator(Pitch, 45.f, 0.f));

    // Color temperature.
    if (SunColorTempCurve)
    {
        float Kelvin = SunColorTempCurve->GetFloatValue(Progress);
        FLinearColor Color = KelvinToLinearColor(Kelvin);
        SunLight->SetLightFColor(Color.ToFColor(true));
    }
}

void ACabinWindowSystem::BeginLightFade(float ToIntensity)
{
    if (SunLight)
    {
        LightFadeFrom  = SunLight->Intensity;
    }
    LightFadeTo    = ToIntensity;
    LightFadeTimer = 0.f;
    bFadingLight   = true;
}

float ACabinWindowSystem::GetPhaseTargetLightIntensity(ECabinFlightPhase Phase) const
{
    switch (Phase)
    {
        case ECabinFlightPhase::Boarding: return BoardingLightIntensity;
        case ECabinFlightPhase::Taxi:     return TaxiLightIntensity;
        case ECabinFlightPhase::Takeoff:  return TaxiLightIntensity;
        case ECabinFlightPhase::Cruise:   return CruiseLightIntensity;
        case ECabinFlightPhase::Break:    return CruiseLightIntensity;
        case ECabinFlightPhase::Descent:  return DescentLightIntensity;
        default:                          return CruiseLightIntensity;
    }
}

// Approximate blackbody radiation curve -> linear RGB.
// Valid range: 1000K (candle) to 12000K (blue sky).
FLinearColor ACabinWindowSystem::KelvinToLinearColor(float K)
{
    // Tanner Helland's algorithm (1000-12000K range).
    K = FMath::Clamp(K, 1000.f, 12000.f) / 100.f;

    float R, G, B;

    // Red
    R = (K <= 66.f) ? 255.f
                    : FMath::Clamp(329.698727446f * FMath::Pow(K - 60.f, -0.1332047592f), 0.f, 255.f);

    // Green
    G = (K <= 66.f)
        ? FMath::Clamp(99.4708025861f * FMath::Loge(K) - 161.1195681661f, 0.f, 255.f)
        : FMath::Clamp(288.1221695283f * FMath::Pow(K - 60.f, -0.0755148492f), 0.f, 255.f);

    // Blue
    B = (K >= 66.f)  ? 255.f
      : (K <= 19.f)  ? 0.f
      : FMath::Clamp(138.5177312231f * FMath::Loge(K - 10.f) - 305.0447927307f, 0.f, 255.f);

    return FLinearColor(R / 255.f, G / 255.f, B / 255.f);
}
