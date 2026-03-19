# Provider Field Evidence Diff

Date: 2026-03-18
Seed Source: /Volumes/Python 1/Lite-Brain/Contents/反编译/反向框架/docs/provider-fingerprints.jsonl
Live Source: /Volumes/Python 1/Lite-Brain/Contents/反编译/反向框架/docs/provider-fingerprints.live.jsonl

| Provider | Path | Capture Source | Capture Count | Required Data | Observed Data | Missing Data | Required Headers | Observed Headers | Missing Headers | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| marscode | /cloudide/api/v3/trae/oauth/ExchangeToken | live | 1 | RefreshToken, ClientSecret, IDEVersion, AppVersion, Platform, Region | AppVersion, ClientSecret, IDEVersion, Platform, RefreshToken, Region, SceneHint | (none) | x-auth-provider, x-request-id, x-trace-id, x-auth-sign | Content-Type, x-auth-provider, x-auth-sign, x-request-id, x-trace-id | (none) | aligned_with_live_capture |
| marscode | /cloudide/api/v3/trae/GetUserInfo | live | 3 | IDEVersion, AppVersion, Platform, Region | AppVersion, IDEVersion, Platform, Region, SceneHint | (none) | x-auth-provider, x-cloudide-token, x-request-id, x-auth-sign | Content-Type, x-auth-provider, x-auth-sign, x-cloudide-token, x-request-id | (none) | aligned_with_live_capture |
| marscode | /cloudide/api/v3/trae/CheckLogin | live | 1 | IDEVersion, AppVersion, Platform, Region | AppVersion, IDEVersion, Platform, Region, SceneHint | (none) | x-auth-provider, x-cloudide-token, x-request-id, x-auth-sign | Content-Type, x-auth-provider, x-auth-sign, x-cloudide-token, x-request-id | (none) | aligned_with_live_capture |
| marscode | /cloudide/api/v3/trae/GenerateTempToken | live | 1 | IDEVersion, AppVersion, Platform, Region, Scene | AppVersion, IDEVersion, Platform, Region, Scene, SceneHint | (none) | x-auth-provider, x-cloudide-token, x-request-id, x-auth-sign | Content-Type, x-auth-provider, x-auth-sign, x-cloudide-token, x-request-id | (none) | aligned_with_live_capture |
| saas | /cloudide/api/v3/trae/oauth/ExchangeToken | live | 1 | RefreshToken, ClientSecret, IDEVersion, AppVersion, Platform, Region | AppVersion, ClientSecret, IDEVersion, Platform, RefreshToken, Region, SceneHint | (none) | x-auth-provider, x-request-id, x-trace-id, x-auth-sign | Content-Type, x-auth-provider, x-auth-sign, x-request-id, x-trace-id | (none) | aligned_with_live_capture |
| saas | /cloudide/api/v3/trae/GetUserInfo | live | 1 | IDEVersion, AppVersion, Platform, Region | AppVersion, IDEVersion, Platform, Region, SceneHint | (none) | x-auth-provider, x-cloudide-token, x-request-id, x-auth-sign | Content-Type, x-auth-provider, x-auth-sign, x-cloudide-token, x-request-id | (none) | aligned_with_live_capture |
| saas | /cloudide/api/v3/trae/CheckLogin | live | 1 | IDEVersion, AppVersion, Platform, Region | AppVersion, IDEVersion, Platform, Region, SceneHint | (none) | x-auth-provider, x-cloudide-token, x-request-id, x-auth-sign | Content-Type, x-auth-provider, x-auth-sign, x-cloudide-token, x-request-id | (none) | aligned_with_live_capture |
| bytedance | /api/v2/GetUserToken | live | 1 | Token, IDEVersion, AppVersion, Platform, Region | AppVersion, IDEVersion, Platform, Region, SceneHint | Token | x-auth-provider, x-auth-sign, X-Cloudide-Token | Content-Type, X-Cloudide-Token, x-auth-provider, x-auth-sign | (none) | live_capture_gap |
| bytedance | /api/v2/GetUserNativeRegion | live | 1 | IDEVersion, AppVersion, Platform, Region, Scene | AppVersion, IDEVersion, Platform, Region, Scene, SceneHint | (none) | x-auth-provider, x-auth-sign, X-Cloudide-Token | Content-Type, X-Cloudide-Token, x-auth-provider, x-auth-sign | (none) | aligned_with_live_capture |

## Notes
- Status priority is live > seed > none.
- `aligned_with_seed_only` means currently aligned but still waiting for live capture evidence.
- Feed live captures by placing JSONL rows into `provider-fingerprints.live.in.jsonl` then run `replay/register-live-fingerprint-captures.mjs`.
