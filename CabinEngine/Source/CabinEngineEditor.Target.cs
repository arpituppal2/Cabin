// CabinEngineEditor.Target.cs
// Editor target — Mac only for development and content cooking.

using UnrealBuildTool;
using System.Collections.Generic;

public class CabinEngineEditorTarget : TargetRules
{
    public CabinEngineEditorTarget(TargetInfo Target) : base(Target)
    {
        Type = TargetType.Editor;
        DefaultBuildSettings = BuildSettingsVersion.V4;
        IncludeOrderVersion = EngineIncludeOrderVersion.Unreal5_3;
        ExtraModuleNames.Add("CabinEngine");
    }
}
