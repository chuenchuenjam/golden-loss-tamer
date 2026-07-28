## 1. Dashboard — one searchable jobs table

- Remove the "New extraction" quick-action tile and the separate "Recent jobs" list.
- Replace both with a single **Loss run jobs** table (same columns as the old history page: Job, Carrier, LoB, Template, Files, Status, Created), sorted newest first.
- Add a search box above the table that filters live across carrier name, job name, line of business, template name and status — so an underwriter can type a carrier and instantly see all that carrier's loss runs consolidated in one view.
- Add a status filter chip row (All / Ready / In progress / Errors) wired to the same list.
- Keep the KPI tiles, the "How to use" guide and the admin "Load demo data" button.
- Keep quick actions for Templates only (drop Jobs history and Clients tiles).

## 2. New extraction page

- Remove the **Job name** input. The job name is generated automatically as `{Carrier} — {LoB} — {date}`.
- Replace **Client (optional)** with **Carrier name (required)**: a text input with autocomplete suggestions from carriers already used. Typing a new carrier creates that record on submit; picking an existing one reuses it. Submission is blocked until a carrier is entered.
- Rest of the flow (LoB, template, files, extraction, reconcile, redirect to job detail) is unchanged.

## 3. Left-hand menu

- Remove **Jobs history** and **Clients** entries. Nav becomes: Dashboard, New extraction, Templates (+ Admin section).
- The `/jobs` and `/clients` pages are removed; `/jobs/$id` (job detail) stays, reached from the dashboard table.

## 4. Templates — build from a document instead of a blank form

New flow on the Templates page, replacing the "Create template" blank form:

```text
Upload PDF/XLSX/CSV  ->  AI proposes fields + sample values
      ->  User reviews / renames / retypes / deletes fields
      ->  Confirm  ->  Template saved and set as golden source for its LoB
```

- **Step 1 – Upload**: pick a line of business, give the template a name, drop one sample loss run (PDF / XLSX / CSV). File goes to the existing private template-uploads storage.
- **Step 2 – AI proposal**: a new server function reads the document and returns a proposed field list (key, label, type, required, hint) plus 2–3 example values per field pulled from the document, so the user can sanity-check what each field maps to.
- **Step 3 – Review**: an editable grid showing proposed fields with their sample values. User can edit key/label/type/hint, toggle required, delete fields, and add missing ones.
- **Step 4 – Confirm**: saves the template with the reviewed fields and marks it as the golden source of truth for that line of business (unsetting any previous golden for that LoB). A confirmation note explains this becomes the canonical schema.
- Existing templates list, edit page, star/delete actions remain. Cloning stays available as a secondary option from an existing template's row.

## Technical notes

- New server function `inferTemplateFields` in a `templates.functions.ts` sibling: authenticated, downloads the uploaded sample from storage, reuses the existing spreadsheet-to-text helper for XLSX/CSV and base64 PDF passthrough, and calls the Lovable AI Gateway with a structured-output schema `{ fields: [{key,label,type,required,hint,samples[]}] }`.
- `createTemplate` gains an optional `set_golden` flag (or the UI calls the existing `markGolden` right after create) plus `source_file_path`.
- Job auto-naming and carrier resolution (find-or-create client by name for the current user) happen in a small addition to `createJob`/`clients.functions.ts`; the `clients` table stays as the carrier store, only the UI label changes to "Carrier".
- Dashboard search/filter is client-side over the existing `listJobs` result — no new query endpoint.
- Delete route files for `/jobs/index.tsx` and `/clients.tsx`; keep `listClients` (used for carrier autocomplete).
