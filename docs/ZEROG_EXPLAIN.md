# ATLAS Explain — optional real 0G Private Computer inference

**Implementation:** the API first obtains deterministic, canonical Arkiv calldata decoding. Only after a user's explicit request does the server send that bounded structured evidence to `https://router-api.0g.ai/v1/chat/completions`, using the requested private trust mode. A successful response contains the actual text and upstream request ID if supplied.

## Server-only configuration

- `ATLAS_0G_ALLOW_PUBLIC_EXPLAIN=true`: explicitly enables the public route. Set provider-side spend controls first.
- `ATLAS_0G_API_KEY`: required API key from the operator's 0G Private Computer account; **never** add this to `VITE_` or Git.
- `ATLAS_0G_MODEL`: exact model name that your account may invoke. No fabricated default.

Call `POST /v1/explain` with `{ "calldata": "0x..." }`. The endpoint refuses unknown selectors that cannot be canonically decoded. The same request is accessible from `AtlasClient.explainCalldata(...)`, CLI `atlas explain <calldata> --json`, and an opt-in Studio Decoder action.

The model receives a fixed system instruction to treat all source metadata and ABI names as untrusted data. No wallet private key, account token or privileged state is submitted by ATLAS. The response is visibly **AI interpretation**, not an audited security statement. Errors from absent credits, invalid token, timeout and rate limits never result in fake content.

**Not yet live verified:** This file contains no real inference receipt. Sponsor eligibility requires a configured key, an actually supported model/private route, a successful request, recorded upstream ID/attestation evidence if available, and a demonstration where inference meaningfully improves the workflow. A secondary explanation button alone may be weak for the 0G prize.

Reference: https://pc.0g.ai and https://0g.ai/blog/0g-private-computer.
