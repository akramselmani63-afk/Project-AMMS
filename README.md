# AMMS — AGRIDIAM Maintenance Management System

Responsive French/English CMMS prototype for AGRIDIAM's maintenance team. No application dependencies or paid services are required. AGRIDIAM's supplied logo and blue/green identity are retained.

## Run locally

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

- Shared equipment register: every equipment selector uses the same IDs and full zone/machine hierarchy.
- Intervention: employee reports problem, impact and photos → maintenance assessment (S1 low–S4 critical; P1 immediate–P4 routine) → Responsible approval → HSE precautions/approval → work order. Reviews can return or reject with a reason.
- Execution: Engineer, Responsible, or both; optional external contractor. Start, wait for parts, resume, record diagnosis/cause/actions/downtime/final condition/operational check → HSE closure → maintenance validation. Solo work is validated by the other maintenance role. Joint work requires a documented exception to independent review.
- Spare-parts purchasing: reference, specifications, quantity, due date, equivalent permission and photos → Responsible approval → Service Achats quotation/order → deliveries → maintenance technical acceptance → confirmation of use/handover. Partial deliveries and damaged/wrong parts remain outstanding for replacement. Linked work cannot start/resume/complete while requested parts await acceptance. There is no storekeeper or inventory workflow.
- Preventive plans generate interventions through the same approvals. One active intervention per plan; next due date advances after final closure.
- Rapport de permanence snapshots work started/completed on the selected day, with observations and handover notes. The author specifies shift allocation in notes; a report is approved by the Responsible.
- Print preview combines intervention authorization and work completion, including history, equipment and blank handwritten signature fields. Purchasing requests and reports are also printable. Use the browser print dialog to save PDF.
- Photos: up to four JPG/PNG/WebP files per intervention or parts request, maximum 8 MB input each. Photos can be added/removed before submission and are resized to at most 1200 pixels, converted to JPEG, and saved with the record. Image previews can be downloaded.
- FR/EN translates interface labels, not free-text reports. Automatic content translation is not connected.

## Roles

| Role | Actions |
| --- | --- |
| Employee | Submit faults and photos; read records |
| Maintenance Engineer | Assessment, planning/execution, PM, equipment, parts requests, technical receipt, reports; validate Responsible's solo work |
| Maintenance Responsible | Same maintenance actions, plus intervention/purchase approval and report approval; can execute alone or jointly |
| HSE | Pre-work safety authorization and post-work safety closure |
| Service Achats | Supplier/quotation/order and delivery recording |
| Developer Admin | Development/diagnostics; no operational approval powers |

Planning is a maintenance responsibility, not a separate user role. All demo roles can read records. The role switcher simulates permissions; it is **not authentication or a secure access boundary**. Names and role events in the history are not digital signatures.

## Persistence and migration

Records and resized photos are stored together in a browser IndexedDB transaction. Failed saves leave the current in-memory records unchanged. A revision check prevents a stale browser tab from overwriting newer changes; reload when prompted. Export backup downloads all current records and embedded photos as JSON; restoration currently requires developer assistance.

The previous `amms-demo-v1` localStorage record is read once and retained unchanged as a migration backup. Custom equipment and records, legacy stock records, and document metadata are preserved. Old open work orders return to recorded approval review because the previous prototype did not capture HSE authorization. Previous status is retained in `legacyStatus`. Legacy completed work stays historical. Standalone Documents and inventory screens are removed; equipment shows its existing document metadata.

## Data provenance

The equipment catalogue is a curated subset of `3-Liste des machines` in `Rapport de Permanence AGRIDIAM 2025.xlsb` and `Rapport de Permanence AGRIDIAM 2026-1.xlsb`. Each sourced entry carries a worksheet cell reference. Production and Conditionnement follow report department headings. Operating state and criticality are unverified; seeded incidents, work, schedules and reports are illustrative. Original workbooks, personnel and incident histories are not published in this repository.

## Code map and checks

- `src/data.js`: original sample data, source migration and hierarchy helpers
- `src/workflow.js`: current schema migration, permissions, transition guards, purchasing and audit events
- `src/storage.js`: atomic browser persistence and concurrent-tab detection
- `src/photos.js`: input checks and image resizing
- `src/app.js`: bilingual forms, lists, record details and print previews

Automated tests cover role gates, HSE review, both solo executors, joint-work exceptions, partial/rejected/replacement deliveries, work waiting for parts, common equipment IDs, preventive closure, report snapshots, migration and photo limits. Browser checks cover attachment save/reload, intervention approval/execution, purchasing acceptance, central equipment selectors, print preview, and responsive layout.

## Prototype boundary

No shared server database, real accounts, protected audit log, remote notifications, automatic content translation or digital signatures are configured. Finalized records are read-only through this UI. This version is for workflow review on one browser; operational deployment still requires server-side authorization, shared storage/backups and AGRIDIAM validation of procedures and source data.
