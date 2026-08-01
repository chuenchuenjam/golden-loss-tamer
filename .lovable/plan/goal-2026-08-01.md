## Goal

Rebrand "Template" to "Agent" across everything users see, so the extraction setups read like configurable AI agents rather than static forms.

## Wording changes

- Sidebar: "Templates" -> "Agents"
- Templates page: title "Agents", intro copy reframed as "Build an agent from a real loss run in three steps"
- Create card: "Create template" -> "Create agent", "Template name" -> "Agent name", list heading "All templates" -> "All agents"
- Wizard: step 3 confirm button "Confirm & save agent"; toasts ("Agent saved", "Copied as a custom agent")
- Edit page: "Template" -> "Agent", "System — read only" stays, "Copy & edit as custom" kept, save/copy toasts updated
- New extraction page: template picker labelled "Agent", helper text updated
- Dashboard: any "Template" column/label -> "Agent"; landing page copy ("Golden source templates" -> "Golden source agents")
- Excel export header row label "Template" -> "Agent"

Labels System / Custom / Carrier stay as they are.

## Not changing

Database tables, columns (`templates`, `template_id`), server function names, storage bucket names, and route paths (`/templates`) stay the same — renaming those would require a migration and add risk with no user-visible benefit. Only display text changes.

## Technical notes

Edits confined to: `src/routes/_authenticated/route.tsx`, `src/routes/_authenticated/templates/index.tsx`, `src/routes/_authenticated/templates/$id.tsx`, `src/routes/_authenticated/upload.tsx`, `src/routes/_authenticated/dashboard.tsx`, `src/routes/index.tsx`, and the sheet label in `src/lib/export.functions.ts`. Route `head()` titles/descriptions updated to match the new naming.
