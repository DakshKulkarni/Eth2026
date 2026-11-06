using UnityEngine;

namespace MrTrainer.Ui
{
    public class HeadFollow : MonoBehaviour
    {
        public Transform head;
        public float distance = 1.0f;
        public float drop = 0.28f;
        public float deadZone = 24f;

        float yaw;
        float yawVelocity;
        bool following;
        bool initialized;
        bool pinned;
        Vector3 velocity;

        public bool Pinned { get { return pinned; } }

        // Leaves the panel where the user put it until Unpin is called.
        public void PinAt(Vector3 position)
        {
            pinned = true;
            transform.position = position;
        }

        public void Unpin()
        {
            pinned = false;
            initialized = false;
        }

        public void Snap()
        {
            initialized = false;
        }

        void LateUpdate()
        {
            if (head == null) return;
            if (pinned)
            {
                Face();
                return;
            }

            float headYaw = head.eulerAngles.y;
            if (!initialized)
            {
                yaw = headYaw;
                initialized = true;
                transform.position = Target();
            }
            float diff = Mathf.Abs(Mathf.DeltaAngle(yaw, headYaw));
            if (diff > deadZone) following = true;
            else if (diff < 3f) following = false;
            if (following) yaw = Mathf.SmoothDampAngle(yaw, headYaw, ref yawVelocity, 0.35f);

            transform.position = Vector3.SmoothDamp(transform.position, Target(), ref velocity, 0.2f);
            Face();
        }

        void Face()
        {
            Vector3 away = transform.position - head.position;
            away.y = 0f;
            if (away.sqrMagnitude > 0.0001f) transform.rotation = Quaternion.LookRotation(away);
        }

        Vector3 Target()
        {
            Vector3 forward = Quaternion.Euler(0f, yaw, 0f) * Vector3.forward;
            return head.position + forward * distance + Vector3.down * drop;
        }
    }
}
