# Provider Route Alignment Matrix

Date: 2026-03-18
Scope: ${ROOT}

| Provider | Path | Required Data Keys | Required Header Keys | Payload Builder | Rule Type | Evidence Level | Status | Evidence Note |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| marscode | /cloudide/api/v3/trae/oauth/ExchangeToken | RefreshToken, ClientSecret, IDEVersion, AppVersion, Platform, Region | x-auth-provider, x-request-id, x-trace-id, x-auth-sign | buildExchangeTokenPayload | hard | inferred-high-fidelity | aligned-inferred | decompiled flow + replay parity; awaiting real capture evidence |
| marscode | /cloudide/api/v3/trae/GetUserInfo | IDEVersion, AppVersion, Platform, Region | x-auth-provider, x-cloudide-token, x-request-id, x-auth-sign | buildUserInfoPayload | hard | inferred-high-fidelity | aligned-inferred | decompiled flow + replay parity; waiting for provider live capture diff |
| marscode | /cloudide/api/v3/trae/CheckLogin | IDEVersion, AppVersion, Platform, Region | x-auth-provider, x-cloudide-token, x-request-id, x-auth-sign | buildCheckLoginPayload | hard | inferred-high-fidelity | aligned-inferred | decompiled flow + replay parity; live path still bootstrap-only |
| marscode | /cloudide/api/v3/trae/GenerateTempToken | IDEVersion, AppVersion, Platform, Region, Scene | x-auth-provider, x-cloudide-token, x-request-id, x-auth-sign | buildGenerateTempTokenPayload | hard | inferred-high-fidelity | aligned-inferred | decompiled flow + replay parity; response shape is scaffolded until live proof |
| saas | /cloudide/api/v3/trae/oauth/ExchangeToken | RefreshToken, ClientSecret, IDEVersion, AppVersion, Platform, Region | x-auth-provider, x-request-id, x-trace-id, x-auth-sign | buildExchangeTokenPayload | hard | inferred-high-fidelity | aligned-inferred | decompiled flow + replay parity; waiting for SaaS real capture |
| saas | /cloudide/api/v3/trae/GetUserInfo | IDEVersion, AppVersion, Platform, Region | x-auth-provider, x-cloudide-token, x-request-id, x-auth-sign | buildUserInfoPayload | hard | inferred-high-fidelity | aligned-inferred | decompiled flow + replay parity; tenant fields remain inferred |
| saas | /cloudide/api/v3/trae/CheckLogin | IDEVersion, AppVersion, Platform, Region | x-auth-provider, x-cloudide-token, x-request-id, x-auth-sign | buildCheckLoginPayload | hard | inferred-high-fidelity | aligned-inferred | decompiled flow + replay parity; route semantics to confirm by live capture |
| bytedance | /api/v2/GetUserToken | Token, IDEVersion, AppVersion, Platform, Region | x-auth-provider, x-auth-sign, X-Cloudide-Token | buildBytedanceTokenPayload | hard | inferred-high-fidelity | aligned-inferred | decompiled flow + replay parity; anti-abuse signature details still inferred |
| bytedance | /api/v2/GetUserNativeRegion | IDEVersion, AppVersion, Platform, Region, Scene | x-auth-provider, x-auth-sign, X-Cloudide-Token | buildBytedanceRegionPayload | hard | inferred-high-fidelity | aligned-inferred | decompiled flow + replay parity; region path needs live verification |

## Notes
- `Rule Type=hard` means request keys are enforced by runtime alignment checker.
- `Evidence Level=inferred-high-fidelity` means route behavior currently reconstructed from decompiled pseudo-code + replay, not fully proven by real capture.
- Fingerprint capture lives in `src/auth/providers/network/request-fingerprint-recorder.ts`.
- Optional JSONL export can be enabled with env `TRAE_AUTH_FINGERPRINT_FILE`.
