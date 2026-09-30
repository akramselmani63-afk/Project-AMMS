# AMMS — AGRIDIAM Maintenance Management System

Responsive French/English CMMS prototype for AGRIDIAM's maintenance team. No application dependencies or paid services are required. AGRIDIAM's supplied logo and blue/green identity are retained.

AMMS has two modes. The portable file and default local server remain a single-device demo with role switching. Company server mode adds provisioned email/password accounts, shared records, server-checked workflow permissions and an offline submission queue. The operations dashboard shows active work, pending safety/approval, PM due within seven days, completed-work downtime over 30 days and priority distribution.

## Company server preparation

The app server is included now; its address and environment settings can be supplied after IT confirms the host. It needs Node.js 20+, a persistent private data directory, backups, and an HTTPS reverse proxy for access from other devices. Keep it in its own VM or service environment, separate from MES/SCADA. Build before starting it:

```powershell
$env:AMMS_MODE = 'server'
$env:AMMS_EMAIL_DOMAIN = 'company.example'
$env:AMMS_DATA_DIR = 'D:\AMMS-Data'
$env:AMMS_PUBLIC_URL = 'https://amms.company.example'
$env:HOST = '127.0.0.1'
$env:PORT = '4173'
npm run build
node server.js
```

IT provisions each person's email, name and role. This prints a one-time activation code to give privately to that person; the person enters it when creating a password in AMMS. Provisioning also changes an existing user's role without resetting their password:

```powershell
node scripts/provision-user.js 'person@company.example' 'Person Name' 'Maintenance Engineer'
```

Allowed roles are Employee, Maintenance Engineer, Maintenance Responsible, HSE, Purchasing Department and Viewer. Viewer can read records but cannot submit, approve, change, or remove them. Existing Developer Admin accounts are treated as Viewer until IT updates their role. Passwords are salted and hashed on the server. The server keeps account cookies for eight hours; restarting the service signs users out. Company data and account files stay in `AMMS_DATA_DIR`, outside the public app files. Back up that directory while the service is stopped or from a filesystem snapshot. Do not put it in a web-served folder. The server binds to localhost by default; IT must configure the HTTPS proxy, DNS, firewall and service startup. Set `AMMS_PUBLIC_URL` to the final HTTPS address so cookies use the Secure flag.

Users must sign in while connected. If the connection drops afterward, the app keeps its cached workspace and queues submissions on that device. It sends them in order when the server becomes reachable. A conflicting submission remains queued and needs review; it is not silently discarded. Queued data, including photos, stays in that browser's IndexedDB, so do not clear browser data before it syncs. The portable HTML and older local records are **not** automatically imported into the shared server. Validate the equipment list and plan any import with IT before operational use.

## Run locally

For a one-person offline prototype review, send `AMMS-Prototype.html` alone. The recipient can double-click it in a modern desktop browser; no Node.js or server is needed. Run `npm run portable` to regenerate that file after changing the app. Its records stay in the recipient's browser and are separate from yours. Browser storage for local files varies, so the recipient should export a backup before clearing browser data or moving the file. This portable copy is for workflow testing, not shared operational use.

For a click-to-open Windows app window, run `npm run package:windows` and send `dist/AMMS.exe`. It opens AMMS without browser tabs or an address bar and stores Edge's app data profile in `Documents/AMMS` on that PC. Microsoft Edge must be installed on the recipient's PC; this lightweight launcher uses Edge's app window mode rather than bundling a separate browser runtime.

## Android phone app

AMMS is also installable on Android as a Progressive Web App (PWA): the phone layout has a sliding navigation menu, touch-sized controls, offline app-shell caching, and the AMMS home-screen icon. Host the company server behind HTTPS, open that URL in Android Chrome, then choose **Install app** (or **Add to Home screen**). Opening the local HTML file directly will not install it. The existing APK/Windows portable builds remain local demos until they are pointed at the company server.

Requires Node.js 20 or later. Download the feature branch containing this version, extract the ZIP, and run from its folder:

```sh
node server.js
```

Open http://localhost:4173 and keep the server running. Opening index.html directly is not supported. The same host and port must be used to see the same browser records; localhost and 127.0.0.1 have separate storage.

```sh
node --test
node scripts/build.js
node server.js dist
```

The npm dev/test/build aliases remain available. Only run one server on port 4173 at a time.

## Workflows

- Shared equipment register: zones, machines and equipment details are combined in one expandable hierarchy. Every equipment selector uses the same IDs.
- Intervention: employee reports problem, impact and photos → maintenance assessment (P1 immediate–P4 routine) → independent Responsible and HSE approvals in either order → assigned work. The assignment is created automatically after both approvals. The Maintenance Responsible can also assign an intervention directly. Both paths appear in one Interventions list and detail. Reviews can return or reject; comments are optional. Both approvals are required before work starts.
- Removal: the requester, Maintenance Engineer or Maintenance Responsible can remove an intervention before work starts. Its unstarted assignment is removed with it. Removal is blocked when linked parts, work already started, or a saved shift report refers to the intervention. A confirmation dialog warns that removal is permanent. The current demo role switch is not real authentication.
- Execution: Engineer, Maintenance Responsible, or both; optional external contractor. For a direct order, the Maintenance Responsible issues and assigns it → the Engineer visits the zone and records risks → the Engineer submits it to HSE → HSE approval → work starts. Completion records optional diagnosis/cause/actions/final condition and downtime, then closes the digital record. Maintenance Responsible and HSE closure signatures are completed on the one-page printed sheet.
- The intervention printout follows the supplied AGRIDIAM example: branded title and intervention number, equipment/priority/date/downtime/participants table, reported problem, diagnosis, work performed, final condition, and three paper signature areas.
- Spare-parts purchasing: reference, specifications, quantity, due date, equivalent permission and photos → Responsible approval → Purchasing Department quotation/order → deliveries → maintenance technical acceptance → confirmation of use/handover. Partial deliveries and damaged/wrong parts remain outstanding for replacement. Linked work cannot start/resume/complete while requested parts await acceptance. Maintenance Responsible purchase requests go straight to the Purchasing Department without a duplicate approval step. There is no storekeeper or inventory workflow.
- Preventive plans generate interventions through the same approvals. One active intervention per plan; next due date advances after final closure.
- Reports have separate Intervention reports and Shift reports views. Each intervention card combines its request, assignment and result, grouped by latest activity date. Reports filter by date and equipment; interventions filter by equipment, priority, source and status; parts filter by equipment, priority and status. The search bar also searches record text. Written shift reports have date, shift, an optional equipment or zone scope, optional observations and handover notes, with compact links to matching interventions on that date. A zone includes equipment beneath it; leaving the scope blank includes all equipment. Technical fields remain visible on older reports that already contain them. A written report is approved by the Responsible.
- Stored event times use UTC and display in the viewer's local time. The completion form defaults to the current time when submitted and allows an edited finish time. Downtime is calculated in whole minutes from the recorded work start and finish; older active orders without a start timestamp ask for it on completion. Historical completed values are retained.
- Print preview combines intervention authorization and work completion, including history, equipment and blank handwritten signature fields. Purchasing requests and reports are also printable. Use the browser print dialog to save PDF.
- Photos: up to four JPG/PNG/WebP files per intervention or parts request, maximum 8 MB input each. Photos can be added/removed before submission and are resized to at most 1200 pixels, converted to JPEG, and saved with the record. Image previews can be downloaded.
- FR/EN translates interface labels, not free-text reports. Automatic content translation is not connected.

## Roles

| Role | Actions |
| --- | --- |
| Employee | Submit faults and photos; read records; remove their own unstarted interventions |
| Maintenance Engineer | Assessment, planning/execution, PM, equipment, parts requests, technical receipt and reports; remove unstarted interventions |
| Maintenance Responsible | Assign interventions directly; intervention/purchase/report approval; execute alone or jointly; remove unstarted interventions; sign completed work on paper |
| HSE | Pre-work safety authorization and post-work safety closure |
| Purchasing Department | Supplier/quotation/order and delivery recording (French: Service achats) |
| Viewer | Read-only access for IT or management |

Planning is a maintenance responsibility, not a separate user role. All narrative notes/comments are optional; identifiers, selections and quantities still receive validation. The operational-check/witness field has been removed. All roles can read records. In local demo mode the role switcher is only a preview; in company server mode IT assigns the role and the server checks it for every change. Names and role events in the history are not digital signatures.

Interventions show a facepile of assigned maintenance roles. Selecting an avatar or the top-bar profile control opens role details. The current user's avatar uses their first and last name initials; unnamed role placeholders use role abbreviations. New requests, parts requests and reports retain the creator's name and role. Older records without a stored creator role show the name alone.

The earlier dashboard arrangement is restored: four counters, priority work, upcoming preventive schedule, new requests and purchasing attention. Status tabs with counts are available for interventions, purchasing and reports. Only Priority is shown in forms, details and printouts; historical severity values are retained in old records without being used.

## Persistence and migration

In demo mode, records and resized photos are stored together in a browser IndexedDB transaction. Failed saves leave the current in-memory records unchanged. A revision check prevents a stale browser tab from overwriting newer changes; reload when prompted. In company server mode, shared records are saved to the private server data directory, with offline submissions cached in browser IndexedDB. Export backup downloads visible records and embedded photos as JSON; restoration currently requires developer assistance.

The previous `amms-demo-v1` localStorage record is read once and retained unchanged as a migration backup. Custom equipment and records, legacy stock records, and document metadata are preserved. Old open work orders return to recorded approval review because the previous prototype did not capture HSE authorization. Previous status is retained in `legacyStatus`. Legacy completed work stays historical. Standalone Documents and inventory screens are removed; equipment shows its existing document metadata.

Schema v6 migrates existing pending reviews to the independent-approval model, renames Service Achats to Purchasing Department, moves unapproved direct work orders to the Engineer site-risk step, and closes records that were waiting for digital HSE or Responsible closure. It applies to both existing IndexedDB workspaces and imported legacy localStorage data.

## Data provenance

The equipment catalogue is a curated subset of `3-Liste des machines` in `Rapport de Permanence AGRIDIAM 2025.xlsb` and `Rapport de Permanence AGRIDIAM 2026-1.xlsb`. Each sourced entry carries a worksheet cell reference. Production and Conditionnement follow report department headings. Operating state and criticality are unverified; seeded incidents, work, schedules and reports are illustrative. Original workbooks, personnel and incident histories are not published in this repository.
New equipment appears beside its sibling machines in the hierarchy and in all equipment selectors, including intervention requests, work orders, preventive plans, parts requests and shift reports.

## Code map and checks

- `src/data.js`: original sample data, source migration and hierarchy helpers
- `src/workflow.js`: current schema migration, permissions, transition guards, purchasing and audit events
- `src/commands.js`: common workflow command dispatch and stable IDs for offline replay
- `src/storage.js`: atomic browser persistence and concurrent-tab detection
- `src/photos.js`: input checks and image resizing
- `src/app.js`: bilingual forms, lists, record details and print previews
- `api.js`: company account and shared record API

Automated tests cover role gates, Engineer site-risk submission, HSE review, both solo executors, Maintenance Responsible validation of joint work, partial/rejected/replacement deliveries, work waiting for parts, common equipment IDs, preventive closure, report snapshots, migration and photo limits. Browser checks cover attachment save/reload, intervention approval/execution, purchasing acceptance, central equipment selectors, print preview, and responsive layout.

## Prototype boundary

Company server mode includes shared file-backed records, real accounts and server-side workflow checks, but has no email verification, protected immutable audit log, remote notifications, automatic content translation or digital signatures. Finalized records are read-only through this UI. Before operational deployment, IT must set up HTTPS, access rules, service monitoring and backups, then test recovery and AGRIDIAM must validate the procedures and source data. The server's JSON storage is intended for the initial 20–25 user pilot; move to a transactional database if concurrent write volume or reporting needs grow.
