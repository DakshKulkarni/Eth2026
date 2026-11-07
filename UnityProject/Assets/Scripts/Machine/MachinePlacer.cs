using UnityEngine;

namespace MrTrainer.Machine
{
    public class MachinePlacer : MonoBehaviour
    {
        // Where the machine stands in front of the user, and which point of it they face.
        public float distance = 2.0f;
        public Vector3 focusLocal = new Vector3(-0.5f, 0f, 0.3f);

        public Transform machineRoot;
        public OVRCameraRig rig;

        public void Recenter()
        {
            Transform head = rig.centerEyeAnchor;
            Vector3 forward = head.forward;
            forward.y = 0f;
            if (forward.sqrMagnitude < 0.01f) forward = Vector3.forward;
            forward.Normalize();

            float floorY = rig.trackingSpace.position.y;
            float eyeHeight = head.position.y - floorY;
            if (eyeHeight < 0.7f || eyeHeight > 2.3f) floorY = head.position.y - 1.6f;

            Vector3 focus = head.position + forward * distance;
            focus.y = floorY;
            Quaternion rotation = Quaternion.LookRotation(-forward);
            machineRoot.rotation = rotation;
            machineRoot.position = focus - rotation * focusLocal;
        }
    }
}
