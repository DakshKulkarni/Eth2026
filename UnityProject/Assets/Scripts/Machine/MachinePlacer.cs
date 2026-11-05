using UnityEngine;

namespace MrTrainer.Machine
{
    public class MachinePlacer : MonoBehaviour
    {
        public Transform machineRoot;
        public OVRCameraRig rig;
        public float distance = 1.7f;

        public void Recenter()
        {
            Transform head = rig.centerEyeAnchor;
            Vector3 forward = head.forward;
            forward.y = 0f;
            if (forward.sqrMagnitude < 0.01f) forward = Vector3.forward;
            forward.Normalize();

            Vector3 position = head.position + forward * distance;
            position.y = rig.trackingSpace.position.y;
            machineRoot.position = position;
            machineRoot.rotation = Quaternion.LookRotation(-forward);
        }
    }
}
