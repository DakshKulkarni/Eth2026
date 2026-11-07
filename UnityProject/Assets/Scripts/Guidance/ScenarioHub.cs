using System.Collections.Generic;
using MrTrainer.Core;

namespace MrTrainer.Guidance
{
    // Owns the training simulations and which one is on show. Only the active one is enabled in the scene.
    public class ScenarioHub
    {
        readonly List<Scenario> all = new List<Scenario>();

        public Scenario Active { get; private set; }
        public IList<Scenario> All { get { return all; } }

        public ScenarioHub(Scenario first)
        {
            all.Add(first);
            Active = first;
        }

        public void Add(Scenario scenario)
        {
            if (scenario == null) return;
            all.Add(scenario);
            scenario.root.SetActive(false);
        }

        public Scenario Activate(string id)
        {
            Scenario target = all.Find(s => s.id == id) ?? Active;
            foreach (var s in all) s.root.SetActive(s == target);
            Active = target;
            target.placer.Recenter();
            return target;
        }
    }
}
