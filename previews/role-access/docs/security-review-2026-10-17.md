# agriMAINT local security review — 17 October 2026

## Scope and tools
- Active application: previews/role-access (local work/amms-role-access).
- Test traffic was limited to disposable local servers and temporary accounts/data. No company infrastructure or real records were tested.
- Requested Strix repository cloned into workspace tools/strix. Strix 1.7.0 installed from the checkout in its own Python virtual environment using the supported editable/headless installation.
- CLI version verified. Full Strix scan NOT completed: Docker and LLM settings were absent, and automatic approval review rejected source submission to an unspecified external LLM. No Strix finding report is claimed.
- A normal wheel build required Go for the optional interactive interface; the editable headless installation succeeded.

## Confirmed fixes and checks
1. Request deletion used display-name equality. Two employees with the same name could potentially delete each other's unstarted request if its ID was known. Ownership now uses authenticated account email; name fallback remains only without an account identity. Regression failed before the fix and passes afterward.
2. Existing sessions were not bound to the password hash. Replacing a password hash directly could leave old sessions valid. Sessions now retain the credential fingerprint and reject changes/removal, as well as expiry. Regression failed before the fix and passes afterward.
3. Failed administrator-key requests could lock out a valid key from the same proxy address. Valid constant-time key verification now precedes the failed-attempt lockout. Reproduced with five invalid requests followed by a valid key; failed before and passes after the fix.
4. Queued writes now re-read accounts and re-check the session inside the serialized write, so waiting work does not rely on a stale identity or role snapshot.
5. Static serving now resolves filesystem links and rejects targets outside its web root. Tested against a temporary directory junction pointing to a private test marker.
6. HTML and API responses deny framing and include a restrictive framing/base/object CSP and no-referrer policy. These are defense in depth, not a complete XSS policy.
7. Offline shell precaching now includes src/access.js. Cache version incremented to v7.

## Verification
- 65 automated tests, including new security regressions and an actual isolated HTTP server.
- Web build, portable HTML, main Windows executable and administration executable build successfully.
- npm audit: zero known advisories reported for installed dependency versions on 17 October 2026. This is not proof that the app is vulnerability-free.

## Remaining limits
- Full Strix assessment requires Docker, an approved LLM provider, locally configured API key and explicit permission for that destination to receive source. Never scan .https-test, live server data, user profiles or company systems as part of this app test.
- HTTPS/IIS deployment, Android trust and real-device behavior remain untested in this review.
- Sessions and rate-limit state are in memory and reset when the server restarts. Production backup/recovery, long-duration concurrency and availability testing remain separate gates.
- This is a scoped local review, not a certification or an exhaustive penetration test. No production or company-network security guarantee is made.
