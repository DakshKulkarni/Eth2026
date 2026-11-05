using UnityEngine;

namespace MrTrainer.Interaction
{
    public abstract class Interactable : MonoBehaviour
    {
        public bool Hovered { get; private set; }

        public void SetHover(bool on)
        {
            if (Hovered == on) return;
            Hovered = on;
            if (on) OnHover(); else OnUnhover();
        }

        protected virtual void OnHover() { }
        protected virtual void OnUnhover() { }

        public abstract bool Activate();
    }
}
