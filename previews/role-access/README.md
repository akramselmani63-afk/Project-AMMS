# agriMAINT — AGRIDIAM Maintenance Monitoring System

Run `npm ci`, `npm test`, `npm run build`, then `npm run dev`.

Generate the single-file app with `npm run portable` (`agriMAINT.html`). Build Windows with `npm run package:windows` (`dist/agriMAINT.exe`).

Existing AMMS_ACCESS_* configuration, browser database identifiers and storage directories are retained for compatibility with saved records. The legacy portable filename is also regenerated to preserve file-origin access. Server connections and account permissions are unchanged.
