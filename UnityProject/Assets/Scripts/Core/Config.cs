namespace MrTrainer.Core
{
    public static class Config
    {
        public const string BackendUrl = "https://eth2026.dakshkulkarni.in";
        public const int TimeoutSeconds = 40;
        public const string MachineLabel = "cnc-01";

        // The headset sends a small picture of what the worker sees, so the dashboard can show it live.
        public const bool LiveEnabled = true;
        public const float LiveInterval = 0.066f; // about 15 frames per second
        public const string LiveKey = ""; // set the same value as LIVE_KEY on the backend if you use one
    }
}
