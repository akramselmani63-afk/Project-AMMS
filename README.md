# AMMS — AGRIDIAM Maintenance Management System

First working prototype of an industrial GMAO/CMMS. It is a responsive, dependency-free web application with a coherent equipment and maintenance data model. All initial records are **illustrative demo data**, not verified AGRIDIAM asset or operational records.

## Run

Requires Node.js 20 or later.

```sh
npm run dev
```

Open `http://localhost:4173`. If npm is unavailable, use `node server.js`.

```sh
npm test
npm run build
node server.js dist
```

## Included workflows

- Overview with request, work order, preventive and stock attention queues
- Hierarchical equipment register (area → line/system → machine/component)
- Intervention requests with S1–S4 severity and P1–P4 priority, triage and work order conversion
- Corrective and preventive work orders with planned, in progress and completed states
- Recurring preventive plans with completion and next due date calculation
- Shift reports with downtime and work order links
- Spare parts register with reorder thresholds and stock adjustment
- Document metadata and optional external links
- Search within each view and role based action previews

Data is saved in browser `localStorage` and can be reset from Roles & access. The role switcher is for demonstration only and is **not security enforcement**. Before production use, add authenticated accounts, server side authorization, shared storage, attachments, audit history, validation of AGRIDIAM equipment records and a backup policy.

## Data model

`equipment` forms a parent linked hierarchy. `requests`, `workOrders`, `preventive`, `reports` and `documents` reference equipment IDs; work orders can reference requests, while reports can reference work orders. `parts` stores quantities and reorder points. The data and workflow helpers live in `src/data.js`.
