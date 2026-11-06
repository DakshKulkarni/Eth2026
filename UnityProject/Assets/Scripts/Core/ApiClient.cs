using System;
using System.Collections;
using System.Text;
using Newtonsoft.Json;
using UnityEngine;
using UnityEngine.Networking;

namespace MrTrainer.Core
{
    public class ApiError
    {
        public string kind;
        public string message;
    }

    public class ApiResult<T>
    {
        public T value;
        public ApiError error;
        public bool Ok { get { return error == null; } }
    }

    public class ApiClient
    {
        readonly string baseUrl;

        public ApiClient(string url)
        {
            baseUrl = url;
        }

        public IEnumerator StartSession(Action<ApiResult<SessionStartResponse>> done)
        {
            return Post("/session/start", new { }, done);
        }

        public IEnumerator Observe(string sessionId, ObserveRequest request, Action<ApiResult<Verdict>> done)
        {
            return Post("/session/" + sessionId + "/observe", request, done);
        }

        public IEnumerator Tts(string text, Action<ApiResult<AudioClip>> done)
        {
            string url = baseUrl + "/tts";
            using (var req = new UnityWebRequest(url, "POST"))
            {
                req.uploadHandler = new UploadHandlerRaw(Encoding.UTF8.GetBytes(JsonConvert.SerializeObject(new { text })));
                req.downloadHandler = new DownloadHandlerAudioClip(url, AudioType.WAV);
                req.SetRequestHeader("Content-Type", "application/json");
                req.timeout = Config.TimeoutSeconds;
                yield return req.SendWebRequest();
                if (req.result != UnityWebRequest.Result.Success)
                {
                    done(Fail<AudioClip>(req));
                    yield break;
                }
                var clip = DownloadHandlerAudioClip.GetContent(req);
                done(clip == null ? Error<AudioClip>("invalid", "empty audio") : new ApiResult<AudioClip> { value = clip });
            }
        }

        IEnumerator Post<T>(string path, object body, Action<ApiResult<T>> done)
        {
            using (var req = new UnityWebRequest(baseUrl + path, "POST"))
            {
                req.uploadHandler = new UploadHandlerRaw(Encoding.UTF8.GetBytes(JsonConvert.SerializeObject(body)));
                req.downloadHandler = new DownloadHandlerBuffer();
                req.SetRequestHeader("Content-Type", "application/json");
                req.timeout = Config.TimeoutSeconds;
                yield return req.SendWebRequest();
                if (req.result != UnityWebRequest.Result.Success)
                {
                    done(Fail<T>(req));
                    yield break;
                }
                try
                {
                    var value = JsonConvert.DeserializeObject<T>(req.downloadHandler.text);
                    done(value == null ? Error<T>("invalid", "empty response") : new ApiResult<T> { value = value });
                }
                catch (JsonException)
                {
                    done(Error<T>("invalid", "response was not valid JSON"));
                }
            }
        }

        static ApiResult<T> Fail<T>(UnityWebRequest req)
        {
            string kind = req.result == UnityWebRequest.Result.ProtocolError ? "http" :
                          req.error != null && req.error.ToLowerInvariant().Contains("timeout") ? "timeout" : "network";
            return Error<T>(kind, req.error ?? "request failed");
        }

        static ApiResult<T> Error<T>(string kind, string message)
        {
            return new ApiResult<T> { error = new ApiError { kind = kind, message = message } };
        }
    }
}
