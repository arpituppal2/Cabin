// CabinEngine.Target.cs
// Shipping target — used when packaging for iOS / Mac App Store.

using UnrealBuildTool;

public class CabinEngineTarget : TargetRules
{
    public CabinEngineTarget(TargetInfo Target) : base(Target)
    {
        Type = TargetType.Game;
        DefaultBuildSettings = BuildSettingsVersion.V4;
        IncludeOrderVersion = EngineIncludeOrderVersion.Unreal5_3;

        // The game module.
        ExtraModuleNames.Add("CabinEngine");

        // ---------------------------------------------------------------------------
        // iOS / Mac packaging flags.
        // ---------------------------------------------------------------------------
        if (Target.Platform == UnrealTargetPlatform.IOS)
        {
            // Generate a full Xcode archive so Xcode can sign and distribute.
            bShouldCompileAsDLL = false;

            // Ensure Metal shader compiler runs during cook.
            // (Set in DefaultEngine.ini bGenerateXCArchive as well.)
        }

        if (Target.Platform == UnrealTargetPlatform.Mac)
        {
            // Mac Catalyst: build for arm64 only (M4 target).
            Architectures = new UnrealArch[] { UnrealArch.Arm64 };
        }

        // ---------------------------------------------------------------------------
        // Optimisation — shipping build.
        // ---------------------------------------------------------------------------
        // Link-time optimisation for smaller binary + faster startup.
        bAllowLTCG = true;

        // Strip debug symbols in shipping.
        bDisableDebugInfo = true;

        // Dead-strip unused code.
        bOmitPCDebugInfoInDevelopment = true;
    }
}
