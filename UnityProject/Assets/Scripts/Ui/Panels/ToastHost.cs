using System.Collections;
using MrTrainer.Machine;
using TMPro;
using UnityEngine;

namespace MrTrainer.Ui
{
    public class ToastHost : MonoBehaviour
    {
        UiFactory ui;
        Transform head;
        MachineController machine;
        Transform hud;

        public void Init(UiFactory factory, Transform headTransform, MachineController controller, Transform hudParent)
        {
            ui = factory;
            head = headTransform;
            machine = controller;
            hud = hudParent;
            machine.Blocked += OnBlocked;
        }

        public void SetMachine(MachineController controller)
        {
            if (machine != null) machine.Blocked -= OnBlocked;
            machine = controller;
            machine.Blocked += OnBlocked;
        }

        void OnDestroy()
        {
            if (machine != null) machine.Blocked -= OnBlocked;
        }

        void OnBlocked(string controlId, string message)
        {
            var control = machine.GetControl(controlId);
            if (control == null) return;
            var rs = control.GetComponentsInChildren<Renderer>();
            if (rs.Length == 0) return;
            Bounds b = rs[0].bounds;
            for (int i = 1; i < rs.Length; i++) b.Encapsulate(rs[i].bounds);
            var go = Spawn(transform, message, ui.T.danger, 2.5f);
            // Held up and pulled towards the trainee so the machine itself never hides the message.
            Vector3 spot = new Vector3(b.center.x, b.max.y + 0.14f, b.center.z);
            go.transform.position = Vector3.MoveTowards(spot, head.position, 0.4f);
            go.AddComponent<Billboard>().head = head;
        }

        public void Hud(string message, Color color)
        {
            var go = Spawn(hud, message, color, 3f);
            go.transform.localPosition = new Vector3(0f, 0.47f, 0f);
            go.transform.localRotation = Quaternion.identity;
        }

        GameObject Spawn(Transform parent, string message, Color color, float life)
        {
            float w = Mathf.Max(280f, message.Length * 22f + 80f);
            var canvas = ui.WorldCanvas("_toast", parent, new Vector2(w, 84f));
            var panel = ui.Panel(canvas.transform, "Panel", new Vector2(w, 84f), Vector2.zero);
            ui.Text(panel, message, ui.T.caption, color, true, TextAlignmentOptions.Center,
                new Vector2(w - 20f, 76f), Vector2.zero);
            var group = canvas.GetComponent<CanvasGroup>();
            PanelFx.In(this, group, panel);
            StartCoroutine(Life(canvas.gameObject, group, panel, life));
            return canvas.gameObject;
        }

        IEnumerator Life(GameObject go, CanvasGroup group, RectTransform panel, float life)
        {
            yield return new WaitForSeconds(life);
            if (go == null) yield break;
            PanelFx.Out(this, group, panel, () => { if (go != null) Destroy(go); });
        }
    }
}
