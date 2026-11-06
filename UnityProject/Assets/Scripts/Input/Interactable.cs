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

        // Handles that are held and dragged with the ray override these instead of Activate.
        public virtual bool Draggable { get { return false; } }
        public virtual void DragBegin(Ray ray, float distance) { }
        public virtual void DragUpdate(Ray ray) { }
        public virtual void DragEnd() { }
    }
}
