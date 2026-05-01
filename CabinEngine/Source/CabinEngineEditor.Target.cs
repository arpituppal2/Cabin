// CabinEngineEditor.Target.cs
// Editor target — used when opening the project in the Unreal Editor on Mac.

using UnrealBuildTool;

public class CabinEngineEditorTarget : TargetRules
{
    public CabinEngineEditorTarget(TargetInfo Target) : base(Target)
    {
        Type = TargetType.Editor;
        DefaultBuildSettings = BuildSettingsVersion.V4;
        IncludeOrderVersion = EngineIncludeOrderVersion.Unreal5_3;

        ExtraModuleNames.Add("CabinEngine");

        // Enable live coding for rapid Blueprint/C++ iteration in the editor.
        bUseUnityBuild = true;
        bAdaptiveUnityBuild = true;
    }
}
