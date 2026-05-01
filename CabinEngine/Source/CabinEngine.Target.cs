// CabinEngine.Target.cs
// Runtime target — iOS and Mac shipping builds.

using UnrealBuildTool;
using System.Collections.Generic;

public class CabinEngineTarget : TargetRules
{
    public CabinEngineTarget(TargetInfo Target) : base(Target)
    {
        Type = TargetType.Game;
        DefaultBuildSettings = BuildSettingsVersion.V4;
        IncludeOrderVersion = EngineIncludeOrderVersion.Unreal5_3;
        ExtraModuleNames.Add("CabinEngine");

        // Allow Metal performance shaders on Apple Silicon
        bOverrideBuildEnvironment = true;
        GlobalDefinitions.Add("CABIN_APPLE_SILICON=1");
    }
}
