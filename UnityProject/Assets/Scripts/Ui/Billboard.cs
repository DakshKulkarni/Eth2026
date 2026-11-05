using UnityEngine;

namespace MrTrainer.Ui
{
    public class Billboard : MonoBehaviour
    {
        public Transform head;

        void LateUpdate()
        {
            if (head == null) return;
            Vector3 away = transform.position - head.position;
            away.y = 0f;
            if (away.sqrMagnitude > 0.0001f) transform.rotation = Quaternion.LookRotation(away);
        }
    }
}
