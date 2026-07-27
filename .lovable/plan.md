## Goal
Seed the app with realistic demo data so a new sign-in immediately shows a populated workspace, and add lightweight underwriter-facing guidance so the flow is self-explanatory.

## Part 1 — Demo seed data

Seed against the first admin user (bootstrapped via `handle_new_user`). A one-shot server function `seedDemoData` (admin-only, idempotent by name) inserts:

**Clients (4)**
- Acme Logistics Inc.
- Northwind Manufacturing
- Coastal Restaurant Group
- Meridian Tech Holdings

**Templates (per LoB, with realistic fields)** — created as system templates so every user sees them; one marked `is_golden` per LoB:
- General Liability (golden): claim_number, date_of_loss, date_reported, claimant, description, status, incurred, paid, reserve, recovery, cause_of_loss, location
- Workers Comp (golden): claim_number, date_of_loss, employee, body_part, injury_type, status, indemnity_paid, medical_paid, expense_paid, reserve, incurred, jurisdiction
- Property (golden): claim_number, date_of_loss, location, peril, description, status, building_paid, contents_paid, bi_paid, reserve, incurred, deductible
- Auto (golden): claim_number, date_of_loss, driver, vehicle, at_fault, coverage, bi_paid, pd_paid, reserve, incurred, status
- Cyber, Marine, Professional, Umbrella: minimal 6–8 field templates (non-golden)

**Extraction jobs (3, status = "ready")** with realistic claim rows in `extraction_rows`:
1. Acme Logistics — Auto — 2022–2024 loss run — 12 claims across policy years, mix of open/closed, one with reserve increase over periods.
2. Northwind Manufacturing — Workers Comp — 3-year loss run — 15 claims, includes 1 large loss ($250k incurred) and 2 lost-time.
3. Coastal Restaurant Group — General Liability — 8 claims, 1 slip-and-fall open with development.

**Data quality issues** attached to jobs 1 & 2 to showcase the reconciliation panel:
- "Incurred decreased across valuation dates" (warning) on 1 claim
- "Missing date_reported" (warning) on 1 claim
- "Duplicate claim number across files" (error) on 1 claim
- "Reserve is negative" (error) on 1 claim

Trigger: a "Load demo data" button on the Dashboard (admin only), plus auto-run once if the workspace has 0 clients & 0 jobs on first admin login.

## Part 2 — Underwriter usability layer

Small, presentation-only additions so an underwriter (not a developer) can read the screen:

- **Dashboard**: add a 3-step "How this works" strip — 1) Pick client & template, 2) Upload loss runs, 3) Review issues & export. Plus KPI tiles: Total incurred, Open claims, Largest loss, Claims with DQ flags (computed from recent jobs).
- **Upload page**: inline hint under each step explaining *why* (e.g., "The template defines which fields the AI will pull — pick the golden source for consistency across submissions").
- **Job review (`/jobs/$id`)**: 
  - Summary bar: Count, Total incurred, Total paid, Total reserve, Open vs Closed, Frequency (claims/yr), Severity (avg incurred).
  - DQ legend explaining severity colors and what each code means.
  - Tooltip on each field header describing underwriter use (e.g., "Incurred = paid + reserve; use for burn analysis").
- **Templates page**: short callout explaining "Golden source = the field set used when reconciling loss runs from multiple carriers/periods for the same insured."
- **Empty states**: replace bare "No jobs yet" with a one-liner + a "Load demo data" CTA (admin).

No changes to extraction/reconciliation logic — just seeding, copy, and a summary component.

## Technical details

- New migration: inserts LoB-scoped system templates (idempotent via `ON CONFLICT` on name+lob_id — add unique index) and demo claim rows tied to a placeholder `created_by = NULL`… **Correction**: `clients.created_by` is NOT NULL, so seeding must happen post-signup via server function, not migration.
- `src/lib/demo.functions.ts`: `seedDemoData` (admin middleware) — checks for existing "Acme Logistics Inc." to stay idempotent, inserts clients under `context.userId`, inserts jobs, rows, DQ issues. Templates inserted as `is_system = true, owner_user_id = null` so all users see them.
- `src/components/DemoDataButton.tsx`: dashboard button calling the fn.
- `src/components/JobSummary.tsx`: computes KPIs from `extraction_rows.data` (client-side reduce over incurred/paid/reserve/status).
- Dashboard, upload, templates, jobs pages: copy + component additions only.

## Out of scope
- Real PDF fixtures / re-running AI extraction on demo files (rows are pre-populated directly).
- Changing extraction, reconciliation, or export logic.
- Role/permission changes.
