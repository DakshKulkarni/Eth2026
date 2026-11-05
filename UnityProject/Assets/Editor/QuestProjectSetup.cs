using UnityEditor;
using UnityEditor.Build;
using UnityEngine;

namespace MrTrainer.Editor
{
    public static class QuestProjectSetup
    {
        [MenuItem("Tools/MR Trainer/Apply Quest Player Settings")]
        public static void Apply()
        {
            var android = NamedBuildTarget.Android;
            PlayerSettings.SetScriptingBackend(android, ScriptingImplementation.IL2CPP);
            PlayerSettings.Android.targetArchitectures = AndroidArchitecture.ARM64;
            PlayerSettings.SetManagedStrippingLevel(android, ManagedStrippingLevel.Low);
            PlayerSettings.insecureHttpOption = InsecureHttpOption.AlwaysAllowed;
            AssetDatabase.SaveAssets();
            Debug.Log("MR Trainer: IL2CPP, ARM64, stripping Low, HTTP allowed. Switching platform to Android.");
            EditorUserBuildSettings.SwitchActiveBuildTarget(BuildTargetGroup.Android, BuildTarget.Android);
        }
    }
}
