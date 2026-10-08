# AMMS Access Preview — separate version

This folder is an independent role-access preview. The existing `project-amms` folder and Desktop `AMMS-Prototype.html` are unchanged.

- Open `AMMS-Access-Preview.html` for local role testing. It starts with no operational records.
- Local browser storage uses `amms-access-preview-*`; it does not import the original workspace.
- Run `npm run dev` for the separate local web preview on port 4273.
- The separate test server launcher uses port 4274 and Documents/AMMS-Access-Test.
- Server configuration uses AMMS_ACCESS_MODE, AMMS_ACCESS_EMAIL_DOMAIN, AMMS_ACCESS_DATA_DIR, AMMS_ACCESS_ADMIN_TOKEN and AMMS_ACCESS_PUBLIC_URL. Default server storage is Documents/AMMS-Access-Server.
- Local role selection is for testing. Real server accounts enforce the data projection and existing action permissions.

Employees see only their own intervention requests and history. Production Responsible sees own and employee requests, plus assigned safety reviews and their outcomes. Production Responsible replaces HSE approval for equipment within Production and Conditionnement; HSE reviews other zones. Maintenance Responsible approval is still required. Existing unfinished approvals from the wrong safety role return to safety review; closed history is preserved. Purchasing sees purchasing and stock. Maintenance and Viewer retain broad read visibility; editing remains governed by the existing role rights.

Verified: 47 tests, static build and portable generation pass.
