
Build the loss-run extraction platform directly in this TanStack Start project. No code copied from Insight Navigator.

## Setup
- Enable Lovable Cloud (Supabase-backed: auth, Postgres, Storage).
- Ensure `LOVABLE_API_KEY` for AI Gateway.
- Email + password auth. Register a root `onAuthStateChange` listener. Managed `_authenticated` layout gates protected routes.

## Data model (Postgres + RLS on every table)
- `profiles` (user_id PK → auth.users, display_name, email).
- `app_role` enum: `admin | member`. `user_roles(user_id, role)` + `has_role(uid, role)` security-definer.
- `clients (id, name, created_by, created_at)` — insured/client scoping.
- `lines_of_business (id, name, slug)` seeded generically (GL, Property, WC, Auto, Cyber, Marine, Professional, Umbrella; user can add more).
- `templates (id, name, lob_id, fields JSONB, is_golden, owner_user_id, source_file_path, created_at)`. Unique-partial index enforces one `is_golden` per `lob_id`. `fields` = `[{key, label, type, required, hint, group}]`.
- `user_template_access (user_id, template_id)` — grants members access to templates.
- `extraction_jobs (id, user_id, client_id, template_id, status, source_files JSONB, created_at, completed_at)`.
- `extraction_rows (id, job_id, row_index, data JSONB, included_in_export bool default true)` — one row per claim.
- `data_quality_issues (id, job_id, row_id nullable, severity, code, message, field)`.
- Storage buckets: `loss-run-uploads` (private), `template-uploads` (private), `exports` (private, signed URLs).

RLS pattern: owner can read/write their own rows; admins bypass via `has_role`; members see templates only via `user_template_access` join.

## Routes
Public: `/`, `/auth`.
Authenticated (`_authenticated/`):
- `/dashboard` — recent jobs, quick upload.
- `/clients` — CRUD clients.
- `/templates` — list templates the user can access, filter by LoB. Actions: view, clone, edit, upload new, mark golden.
- `/templates/$id` — field editor (add/edit/remove fields, mark golden).
- `/upload` — pick client → pick LoB → pick template (from accessible ones) → upload files (PDF/XLSX/CSV/DOCX/EML) → run extraction.
- `/jobs` — historical records: filter by client / LoB / template / date. Shows filename, extracted field count, timestamp, status.
- `/jobs/$id` — review extracted rows, inline DQ badges, edit values, tick rows/fields to include, "Download Excel".
- Admin-only `_authenticated/_admin/`:
  - `/admin/users` — list users, assign `admin`/`member`.
  - `/admin/access` — matrix: users × templates (by LoB) with toggles.

## Server functions
- `createClient`, `listClients`.
- `createTemplate`, `updateTemplate`, `markGolden`, `parseTemplateUpload` (AI extracts field schema from an uploaded template file).
- `grantTemplateAccess`, `revokeTemplateAccess`, `setUserRole`.
- `createExtractionJob` → uploads to Storage, inserts job.
- `runExtraction(jobId)` — fetches template schema, sends each file to Lovable AI (`openai/gpt-5.5`) with a strict JSON schema built from `template.fields`; inserts `extraction_rows`.
- `reconcileJob(jobId)` — cross-file/period reconciliation on same claim numbers; writes `data_quality_issues` for: missing required fields, incurred/paid regression across periods, duplicate claim numbers, invalid dates, currency/format anomalies, status regressions, negative reserves.
- `exportJobToExcel(jobId, selection)` — builds `.xlsx` with `exceljs`: sheets = Summary, Claims (chosen fields/rows), Data Quality; uploads to `exports` bucket; returns signed URL.

## AI extraction details
- Structured output built from the template's `fields` (Zod schema on server).
- Multimodal input: PDFs sent as `file` content blocks; XLSX/CSV parsed with `xlsx` → JSON text; DOCX with `mammoth`; EML with `mailparser` (attachments extracted, recurse).
- Reasoning off, temperature 0 style; return `{claims: [...], meta: {...}}`.

## UI
- Tailwind + shadcn components already present. Semantic tokens only; no hardcoded colors. Sober insurance-industry palette.
- Job review: TanStack Table with row-level DQ chips (red/amber), tooltip explaining the issue, inline edit, column/row selection for export.

## Verification before finishing
- Sign up admin + member, seed LoBs + one starter template per LoB, upload a sample PDF, run extraction, reconcile, mark golden, export Excel, view history, admin grants/revokes access.
- Head metadata unique per route; index no longer the placeholder.

## Deferred / not in scope
- Non-email auth providers (unless you say so later).
- Payment/billing.
- Multi-tenant workspaces beyond `clients` scoping.
