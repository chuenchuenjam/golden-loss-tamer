## Goal

Rebuild the Templates section as a 3-step wizard, drop the field "type" concept and the Golden label, and make System templates read-only but copyable.

## Step 1 — Upload & name

Single card: template name, line of business, file upload (PDF/XLSX/CSV). Continue triggers upload to storage and a new AI call.

## Step 2 — Page selection

- A new server function analyses the document, returns the total page/sheet count and the one page the AI thinks best represents the claim-level data, with a one-line reason.
- UI shows the AI's recommended page, a page picker (dropdown or list of page numbers/sheet names) so the user can pick a different page, and a text preview of the chosen page so they can judge.
- For PDFs the "page" is a page number; for spreadsheets it's a sheet name. Both handled by the same picker.

## Step 3 — Extraction review

- A server function extracts from the selected page only and returns, per detected field: `key` (machine name), `label` (the keyword/header as printed in the document) and `value` (the true value found on that page), plus a hint.
- Review table columns: Key, Label, Extracted value (editable override), Required, Hint, delete. No Type column anywhere.
- User edits/overrides any wrong values, adds fields, then Confirm saves the template.

## Template list & editing changes

- Remove the Golden badge, the star "mark golden" action, and golden-related copy from the templates page. `set_golden` is no longer sent on create; existing DB column stays but is unused by the UI.
- `label` stays: System / Custom / Carrier. New wizard templates save as `Custom`.
- System templates: no edit (pencil), no delete, no label change. Instead a "Copy" action that clones fields into a new template named "<name> (copy)" with label `Custom`, then opens the editor on the copy.
- Edit page (`/templates/$id`): remove the Type column; if the template is System, render read-only with a Copy button instead of editable inputs.

## Technical notes

- `src/lib/template-infer.functions.ts`: replace the single inference call with two server functions — `analyzeDocumentPages` (returns page list + recommended page + preview text) and `inferFieldsFromPage` (returns key/label/value/hint/required for the chosen page). Both keep the existing 402/429 error handling.
- Page slicing: for spreadsheets, per-sheet text via the existing `spreadsheetToText` helper split by sheet; for PDFs, pass the whole file to the model with an instruction to read only the requested page (no server-side PDF splitting needed).
- `src/lib/templates.functions.ts`: drop `type` from `FieldSchema` (fields become key/label/required/hint/value), add a `copyTemplate` server function, stop defaulting to golden.
- Existing stored templates that carry `type` are ignored gracefully; no migration required.
