// CabinWindowSystem.h
// Hybrid window compositor: per-seat 4K video plate (UMediaPlayer) composited
// over a procedural SkyAtmosphere + VolumetricCloud background.
// Manages time-of-day directional light rig and turbulence shake curves.
//
// Architecture:
//   Each aircraft window is a UStaticMeshComponent (flat quad) with a dynamic
//   material instance (MI_Window_Master). The material blends:
//     [0] Video plate render target  (UMediaTexture -> RT_WindowPlate)
//     [1] SkyAtmosphere capture      (USceneCaptureComponent2D -> RT_SkyCap)
//   using a lerp driven by MPC_WindowBlend.VideoWeight.
//
// One UCabinWindowSystem actor exists per scene. It receives:
//   - SeatIndex  (0-7) from CabinSessionManager -> adjusts camera FOV + plate selection
//   - FlightPhase               -> drives light rig + atmosphere transitions
//   - SessionProgress (0..1)    -> interpolates time-of-day

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "MediaPlayer.h"
#include "MediaTexture.h"
#include "Engine/TextureRenderTarget2D.h"
#include "Components/SceneCaptureComponent2D.h"
#include "Components/DirectionalLightComponent.h"
#include "Components/SkyAtmosphereComponent.h"
#include "Components/VolumetricCloudComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Materials/MaterialParameterCollection.h"
#include "Materials/MaterialParameterCollectionInstance.h"
#include "Curves/CurveFloat.h"
#include "CabinTypes.h"
#include "CabinWindowSystem.generated.h"

UCLASS(BlueprintType, Blueprintable)
class CABINENGINE_API ACabinWindowSystem : public AActor
{
    GENERATED_BODY()

public:
    ACabinWindowSystem();

    // -------------------------------------------------------------------------
    // Called by CabinSessionManager
    // -------------------------------------------------------------------------

    UFUNCTION(BlueprintCallable, Category = "Cabin|Window")
    void InitialiseForSeat(int32 SeatIndex);

    UFUNCTION(BlueprintCallable, Category = "Cabin|Window")
    void SetFlightPhase(ECabinFlightPhase NewPhase);

    // Progress 0..1 across total session. Drives time-of-day.
    UFUNCTION(BlueprintCallable, Category = "Cabin|Window")
    void SetSessionProgress(float Progress);

    // Called every frame by CabinPawn for camera-shake turbulence.
    UFUNCTION(BlueprintCallable, Category = "Cabin|Window")
    void TickTurbulence(float DeltaTime);

    // Meal service: briefly boost interior warm light.
    UFUNCTION(BlueprintCallable, Category = "Cabin|Window")
    void TriggerMealServiceLighting(float DurationSeconds = 4.0f);

    // -------------------------------------------------------------------------
    // Designer-exposed properties
    // -------------------------------------------------------------------------

    // 8 video plates, one per seat position.
    // Order matches ECabinSeat enum: 1A, 2B, 1D, 2D, 2G, 1G, 2J, 1L.
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Cabin|Window|Video")
    TArray<UMediaPlayer*> SeatVideoPlates;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Cabin|Window|Video")
    TArray<UMediaTexture*> SeatMediaTextures;

    // The render target the active plate writes into.
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Cabin|Window|Video")
    UTextureRenderTarget2D* RT_WindowPlate;

    // Sky capture render target (procedural background).
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Cabin|Window|Sky")
    UTextureRenderTarget2D* RT_SkyCap;

    // MPC holding VideoWeight, SkyWeight, TurbulenceStrength.
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Cabin|Window|Material")
    UMaterialParameterCollection* MPC_WindowBlend;

    // Master directional light (sun/moon).
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Cabin|Window|Lighting")
    UDirectionalLightComponent* SunLight;

    // Fill light for cabin interior bounce.
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Cabin|Window|Lighting")
    UDirectionalLightComponent* FillLight;

    // Atmosphere.
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Cabin|Window|Sky")
    USkyAtmosphereComponent* SkyAtmosphere;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Cabin|Window|Sky")
    UVolumetricCloudComponent* VolumetricClouds;

    // Scene capture that writes RT_SkyCap.
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Cabin|Window|Sky")
    USceneCaptureComponent2D* SkyCapture;

    // Time-of-day curve: maps SessionProgress (0..1) -> sun pitch angle (degrees).
    // Keyframe the curve in the editor to match your chosen departure time.
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Cabin|Window|Lighting")
    UCurveFloat* SunAngleCurve;

    // Sun color temperature curve: SessionProgress -> color temp (K).
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Cabin|Window|Lighting")
    UCurveFloat* SunColorTempCurve;

    // Turbulence intensity curve: maps time within cruise phase (0..1) -> shake amplitude.
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Cabin|Window|Turbulence")
    UCurveFloat* TurbulenceCurve;

    // Cabin interior ambient intensity per phase.
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Cabin|Window|Lighting")
    float BoardingLightIntensity  = 2800.f;  // Bright white boarding
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Cabin|Window|Lighting")
    float TaxiLightIntensity      = 1200.f;  // Dim blue/purple pre-takeoff
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Cabin|Window|Lighting")
    float CruiseLightIntensity    =  600.f;  // Moody cruise
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Cabin|Window|Lighting")
    float DescentLightIntensity   = 2400.f;  // Fade back to bright
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Cabin|Window|Lighting")
    float MealServiceBoostIntensity = 3200.f;

    // Seconds to cross-fade between phase light intensities.
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Cabin|Window|Lighting")
    float LightFadeDuration = 8.0f;

private:
    // -------------------------------------------------------------------------
    // Internal state
    // -------------------------------------------------------------------------

    int32           ActiveSeatIndex     = 7;   // Default: 1L right window
    ECabinFlightPhase CurrentPhase      = ECabinFlightPhase::Boarding;
    float           SessionProgress     = 0.f;

    // Turbulence state
    float           TurbulenceTimer     = 0.f;
    float           TurbulencePhaseOffset = 0.f;
    FVector         LastTurbulenceDelta = FVector::ZeroVector;

    // Light fade state
    float           LightFadeTimer      = 0.f;
    float           LightFadeFrom       = 2800.f;
    float           LightFadeTo         = 2800.f;
    bool            bFadingLight        = false;

    // Meal service boost
    float           MealServiceTimer    = 0.f;
    bool            bMealServiceActive  = false;

    // MPC instance for this world.
    UMaterialParameterCollectionInstance* MPCInstance = nullptr;

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    void SwapVideoPlate(int32 SeatIndex);
    void UpdateSunTransform(float Progress);
    void UpdateCabinAmbientLight(float TargetIntensity, float DeltaTime);
    void BeginLightFade(float ToIntensity);
    float GetPhaseTargetLightIntensity(ECabinFlightPhase Phase) const;

    // Kelvin -> linear FLinearColor (approximate blackbody)
    static FLinearColor KelvinToLinearColor(float Kelvin);

protected:
    virtual void BeginPlay() override;
    virtual void Tick(float DeltaTime) override;
};
