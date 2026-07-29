## 1. Add members from the Team page

- Team page gets an "Add member" form: email + temporary password (min 8 chars) + optional display name.
- New admin-only server function creates the account (email pre-confirmed) and assigns the `member` role, then the team table refreshes.
- Duplicate email returns a clear message ("That user already exists").
- Admin shares the temp password with the person; they sign in on the normal sign-in page. Sign-ups stay disabled.

## 2. Dashboard quick link

- Add a "New extraction" primary button in the dashboard header linking to `/upload` (kept alongside the existing searchable jobs table).

## 3. Remove Template access

- Delete the `/admin/access` page and its sidebar entry; Admin section keeps only Team.
- Remove the related access-grant server functions. The underlying access table stays in the database (unused) so nothing else breaks.

## 4. Template labels: System / Custom / Carrier

- Add a `label` column to templates: `System`, `Custom`, `Carrier` (default `Custom`).
- The 8 built-in generic templates stay `System`; templates created by uploading a document default to `Carrier`.
- Template list shows the label as a chip next to Golden; an admin can change a template's label from a small dropdown on each row (System templates keep their delete protection).

## Technical notes

- Migration: `ALTER TABLE public.templates ADD COLUMN label text NOT NULL DEFAULT 'Custom'` with a check constraint on the three values, backfilled to `System` where `is_system` is true.
- New `addTeamMember` server fn in `src/lib/admin.functions.ts` using the admin client inside the handler after an admin role check (`createUser` with `email_confirm: true`, then insert into `user_roles`).
- `createTemplate` gains an optional `label` input, defaulting to `Carrier` for document-driven creation.
- Files touched: `src/lib/admin.functions.ts`, `src/lib/templates.functions.ts`, `src/routes/_authenticated/admin/team.tsx`, `src/routes/_authenticated/route.tsx`, `src/routes/_authenticated/dashboard.tsx`, `src/routes/_authenticated/templates/index.tsx`; delete `src/routes/_authenticated/admin/access.tsx`.
