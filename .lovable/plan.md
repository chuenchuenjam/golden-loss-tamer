## Goal

In Step 2 of the template wizard ("Choose page"), show the uploaded document next to the page list, and jump the preview to whichever page the user selects — so they can visually confirm the data location before extracting.

## Layout

```text
+---------------------------+------------------------------+
| Pages / sheets            |  Document preview             |
| [x] Page 3  (AI pick)     |  renders the SELECTED page    |
| [ ] Page 4                |  PDF -> scrolls to that page  |
| [ ] Page 5                |  Excel -> that sheet as table |
| reason: "..."             |                               |
| [Extract this page]       |                               |
+---------------------------+------------------------------+
```

Two-column grid on desktop (list ~1/3, preview ~2/3); stacked on mobile with the preview under the list.

## Behaviour

- The file the user picked in Step 1 is already in the browser, so the preview is built from a local object URL — no extra download, no cost.
- PDF: embed in an iframe using the browser's built-in viewer and the `#page=N` fragment. Clicking a different page re-points the viewer to that page. Add a small "Open in new tab" link as a fallback for browsers that block the inline viewer.
- Excel/CSV: parse the workbook client-side and render the selected sheet as a scrollable HTML table (first ~50 rows), with a row/column count caption so the user can see the claim table structure.
- Other/unsupported types: show a plain notice instead of a broken frame.
- The AI's recommended page is highlighted as "AI suggestion" and is what the preview opens on.
- Step 3 also gets a compact reminder line ("Extracted from: <page>") so the reviewed values stay tied to their source location.

## Technical notes

- Changes are confined to `src/routes/_authenticated/templates/index.tsx` plus a new small `src/components/DocumentPreview.tsx`.
- `xlsx` is already installed and is browser-safe, so the sheet preview uses it directly in the component; no server function or storage signed-URL work is needed.
- Page identifiers coming back from the analyzer (e.g. `Page 3`, or a sheet name) are mapped to either a PDF page number or a sheet key inside the preview component.
- No schema, backend, or extraction-logic changes.
