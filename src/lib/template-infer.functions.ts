import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { docKind, listPages, pdfPart, runStructured, sheetToText } from "./template-infer.server";

const PageChoice = z.object({
  recommendedPage: z.string(),
  reason: z.string(),
});

const ExtractedFields = z.object({
  fields: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      value: z.string(),
      required: z.boolean(),
      hint: z.string(),
    }),
  ),
});

export type ExtractedField = z.infer<typeof ExtractedFields>["fields"][number];

async function load(context: any, path: string) {
  const { data: blob, error } = await context.supabase.storage.from("template-uploads").download(path);
  if (error || !blob) throw new Error(`Download failed: ${error?.message ?? "no data"}`);
  return new Uint8Array(await blob.arrayBuffer());
}

/** Step 2: list the pages/sheets and let AI recommend the most representative one. */
export const analyzeDocumentPages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ path: z.string().min(1), name: z.string().min(1), type: z.string().default("") }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");
    const bytes = await load(context, data.path);
    const kind = docKind(data.name, data.type);
    const pages = listPages(bytes, kind);

    if (pages.length === 1) {
      return { pages, recommendedPage: pages[0], reason: "This document has a single page of data." };
    }

    const parts: unknown[] = [
      {
        type: "text",
        text: `You are preparing an extraction template for an insurance loss run.
Pick the ONE page that best shows the claim-level detail table (claim numbers, dates, amounts, status) — the page whose columns cover the fields an underwriter needs.
Available pages: ${pages.join(", ")}
Return recommendedPage exactly as one of those strings, and a one-sentence reason.`,
      },
    ];
    if (kind === "pdf") parts.push(pdfPart(bytes));
    else if (kind === "sheet")
      parts.push({
        type: "text",
        text: pages.map((p) => sheetToText(bytes.buffer as ArrayBuffer, p, 15)).join("\n\n"),
      });

    const out = await runStructured(apiKey, parts, PageChoice);
    const rec = pages.includes(out.recommendedPage) ? out.recommendedPage : pages[0];
    return { pages, recommendedPage: rec, reason: out.reason };
  });

/** Step 3: extract keyword / label / true value from the selected page. */
export const inferFieldsFromPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        path: z.string().min(1),
        name: z.string().min(1),
        type: z.string().default(""),
        page: z.string().min(1),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");
    const bytes = await load(context, data.path);
    const kind = docKind(data.name, data.type);

    const parts: unknown[] = [
      {
        type: "text",
        text: `You are designing an extraction template for insurance loss run documents.
Read ONLY "${data.page}" of the attached document and list every claim-level field it contains.
For each field return:
- key: snake_case machine name
- label: the keyword/header exactly as printed in the document
- value: the true value found on that page for the first claim/record (verbatim; empty string if none)
- required: true only for fields essential to loss run analysis (claim number, date of loss, paid/incurred amounts)
- hint: a short instruction telling an extraction model where to find the value
Do not invent fields that are not evidenced on that page.

Document name: ${data.name}`,
      },
    ];
    if (kind === "pdf") parts.push(pdfPart(bytes));
    else if (kind === "sheet")
      parts.push({ type: "text", text: sheetToText(bytes.buffer as ArrayBuffer, data.page, 60) });
    else parts.push({ type: "text", text: new TextDecoder().decode(bytes).slice(0, 200_000) });

    const out = await runStructured(apiKey, parts, ExtractedFields);
    if (!out.fields?.length) throw new Error("No fields could be detected on that page.");
    return { fields: out.fields };
  });
