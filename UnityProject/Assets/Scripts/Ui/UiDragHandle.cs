using MrTrainer.Interaction;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace MrTrainer.Ui
{
    // A grip that is held with the ray trigger to move a whole panel. The right thumbstick pushes it
    // away or pulls it closer while it is held.
    public class UiDragHandle : Interactable
    {
        Transform target;
        HeadFollow follow;
        Image bg;
        TextMeshProUGUI label;
        Color idle;
        Color hot;
        float distance;
        Vector3 offset;
        bool held;

        public void Setup(Transform panelRoot, HeadFollow headFollow, Image background, TextMeshProUGUI text, Color idleColor, Color hotColor)
        {
            target = panelRoot;
            follow = headFollow;
            bg = background;
            label = text;
            idle = idleColor;
            hot = hotColor;
            bg.color = idle;
        }

        public override bool Draggable { get { return true; } }
        public override bool Activate() { return true; }

        public override void DragBegin(Ray ray, float dist)
        {
            held = true;
            distance = dist;
            offset = target.position - (ray.origin + ray.direction * distance);
            label.text = "Moving";
        }

        public override void DragUpdate(Ray ray)
        {
            float stick = OVRInput.Get(OVRInput.Axis2D.PrimaryThumbstick, OVRInput.Controller.RTouch).y;
            distance = Mathf.Clamp(distance + stick * Time.unscaledDeltaTime * 1.2f, 0.4f, 3f);
            follow.PinAt(ray.origin + ray.direction * distance + offset);
        }

        public override void DragEnd()
        {
            held = false;
            label.text = "Hold to move";
        }

        void Update()
        {
            Color c = held || Hovered ? hot : idle;
            bg.color = Color.Lerp(bg.color, c, 20f * Time.unscaledDeltaTime);
        }
    }
}
