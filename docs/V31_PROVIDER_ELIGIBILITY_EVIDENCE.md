# v3.1 Provider Eligibility Evidence

The live `api.aniraku.tech` response for anime `16498`, episode `1`, SUB was captured on 2026-08-16. It shows three distinct valid source categories: **Ally** and **Pewe** provide proxy-verified HLS media, while **Kiwi** provides verified embedded URLs at `1080p`, `720p`, and `360p`.

Kiwi is therefore not a proxy-native source in the current production response. It remains a valid provider and its three backend-issued embedded quality URLs must remain selectable in the native quality picker. v3.1 implements this without misclassifying Kiwi as native media: direct sources use native transport, proxy-verified sources start through `/api/v1/proxy`, and verified embedded variants use the WebView fallback.

| Provider | Live source verification | Native v3.1 transport | Quality behavior |
|---|---|---|---|
| Ally | `proxy` HLS | Aniraku proxy | Native quality picker retains the available source variant. |
| Pewe | `proxy` HLS | Aniraku proxy | Native quality picker retains the available source variant. |
| Kiwi | `embed` | Embedded player | 1080p, 720p, and 360p URLs are selectable from the embedded quality control. |

The live payloads were captured during release verification; the durable public record retains only the source-category findings above. A physical-device test remains required to confirm first frame and quality switching on the Snapdragon 680.
