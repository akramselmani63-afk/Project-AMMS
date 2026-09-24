# AMMS — AGRIDIAM Maintenance Management System

Responsive French/English CMMS prototype for AGRIDIAM's maintenance team. No application dependencies or paid services are required. AGRIDIAM's supplied logo and blue/green identity are retained.

## Run locally

For a one-person offline prototype review, send `AMMS-Prototype.html` alone. The recipient can double-click it in a modern desktop browser; no Node.js or server is needed. Run `npm run portable` to regenerate that file after changing the app. Its records stay in the recipient's browser and are separate from yours. Browser storage for local files varies, so the recipient should export a backup before clearing browser data or moving the file. This portable copy is for workflow testing, not shared operational use.

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
- Intervention: employee reports problem, impact and photos → maintenance assessment (P1 immediate–P4 routine) → independent Responsible and HSE approvals in either order → work order. Reviews can return or reject; comments are optional. Both approvals are required before work starts. Returning or rejecting resets the approval flags while retaining history.
- Execution: Engineer, Maintenance Responsible, or both; optional external contractor. For a direct order, the Maintenance Responsible issues and assigns it → the Engineer visits the zone and records risks → the Engineer submits it to HSE → HSE approval → work starts. Completion records optional diagnosis/cause/actions/final condition and downtime, then closes the digital record. Maintenance Responsible and HSE closure signatures are completed on the one-page printed sheet.
- The intervention printout follows the supplied AGRIDIAM example: branded title and OT number, equipment/priority/date/downtime/participants table, reported problem, diagnosis, work performed, final condition, and three paper signature areas.
- Spare-parts purchasing: reference, specifications, quantity, due date, equivalent permission and photos → Responsible approval → Purchasing Department quotation/order → deliveries → maintenance technical acceptance → confirmation of use/handover. Partial deliveries and damaged/wrong parts remain outstanding for replacement. Linked work cannot start/resume/complete while requested parts await acceptance. Maintenance Responsible purchase requests go straight to the Purchasing Department without a duplicate approval step. There is no storekeeper or inventory workflow.
- Preventive plans generate interventions through the same approvals. One active intervention per plan; next due date advances after final closure.
- Reports have separate Intervention reports and Shift reports views. Each intervention card combines one request with its work order and is grouped by latest activity date; a date filter narrows the list. Written shift reports have date, shift, an optional equipment or zone scope, optional observations and handover notes, with compact links to matching interventions on that date. A zone includes equipment beneath it; leaving the scope blank includes all equipment. Technical fields remain visible on older reports that already contain them. A written report is approved by the Responsible.
- Stored event times use UTC and display in the viewer's local time. The completion form defaults to the current time when submitted and allows an edited finish time. Downtime is calculated in whole minutes from the recorded work start and finish; older active orders without a start timestamp ask for it on completion. Historical completed values are retained.
- Print preview combines intervention authorization and work completion, including history, equipment and blank handwritten signature fields. Purchasing requests and reports are also printable. Use the browser print dialog to save PDF.
- Photos: up to four JPG/PNG/WebP files per intervention or parts request, maximum 8 MB input each. Photos can be added/removed before submission and are resized to at most 1200 pixels, converted to JPEG, and saved with the record. Image previews can be downloaded.
- FR/EN translates interface labels, not free-text reports. Automatic content translation is not connected.

## Roles

| Role | Actions |
| --- | --- |
| Employee | Submit faults and photos; read records |
| Maintenance Engineer | Assessment, planning/execution, PM, equipment, parts requests, technical receipt and reports |
| Maintenance Responsible | Issue work orders directly; intervention/purchase/report approval; execute alone or jointly; sign completed work on paper |
| HSE | Pre-work safety authorization and post-work safety closure |
| Purchasing Department | Supplier/quotation/order and delivery recording (French: Service achats) |
| Developer Admin | Development/diagnostics; no operational approval powers |

Planning is a maintenance responsibility, not a separate user role. All narrative notes/comments are optional; identifiers, selections and quantities still receive validation. The operational-check/witness field has been removed. All demo roles can read records. The role switcher simulates permissions; it is **not authentication or a secure access boundary**. Names and role events in the history are not digital signatures.

The earlier dashboard arrangement is restored: four counters, priority work, upcoming preventive schedule, new requests and purchasing attention. Status tabs with counts are restored for requests, work orders, purchasing and reports. Only Priority is shown in forms, details and printouts; historical severity values are retained in old records without being used.

## Persistence and migration

Records and resized photos are stored together in a browser IndexedDB transaction. Failed saves leave the current in-memory records unchanged. A revision check prevents a stale browser tab from overwriting newer changes; reload when prompted. Export backup downloads all current records and embedded photos as JSON; restoration currently requires developer assistance.

The previous `amms-demo-v1` localStorage record is read once and retained unchanged as a migration backup. Custom equipment and records, legacy stock records, and document metadata are preserved. Old open work orders return to recorded approval review because the previous prototype did not capture HSE authorization. Previous status is retained in `legacyStatus`. Legacy completed work stays historical. Standalone Documents and inventory screens are removed; equipment shows its existing document metadata.

Schema v6 migrates existing pending reviews to the independent-approval model, renames Service Achats to Purchasing Department, moves unapproved direct work orders to the Engineer site-risk step, and closes records that were waiting for digital HSE or Responsible closure. It applies to both existing IndexedDB workspaces and imported legacy localStorage data.

## Data provenance

The equipment catalogue is a curated subset of `3-Liste des machines` in `Rapport de Permanence AGRIDIAM 2025.xlsb` and `Rapport de Permanence AGRIDIAM 2026-1.xlsb`. Each sourced entry carries a worksheet cell reference. Production and Conditionnement follow report department headings. Operating state and criticality are unverified; seeded incidents, work, schedules and reports are illustrative. Original workbooks, personnel and incident histories are not published in this repository.

## Code map and checks

- `src/data.js`: original sample data, source migration and hierarchy helpers
- `src/workflow.js`: current schema migration, permissions, transition guards, purchasing and audit events
- `src/storage.js`: atomic browser persistence and concurrent-tab detection
- `src/photos.js`: input checks and image resizing
- `src/app.js`: bilingual forms, lists, record details and print previews

Automated tests cover role gates, Engineer site-risk submission, HSE review, both solo executors, Maintenance Responsible validation of joint work, partial/rejected/replacement deliveries, work waiting for parts, common equipment IDs, preventive closure, report snapshots, migration and photo limits. Browser checks cover attachment save/reload, intervention approval/execution, purchasing acceptance, central equipment selectors, print preview, and responsive layout.

## Prototype boundary

No shared server database, real accounts, protected audit log, remote notifications, automatic content translation or digital signatures are configured. Finalized records are read-only through this UI. This version is for workflow review on one browser; operational deployment still requires server-side authorization, shared storage/backups and AGRIDIAM validation of procedures and source data.

