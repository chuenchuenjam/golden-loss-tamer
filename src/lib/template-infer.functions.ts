import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { generateText, Output } from "ai";
import { createLovableAiGateway } from "./ai-gateway.server";
import { spreadsheetToText } from "./file-parse.server";

const ProposedFields = z.object({
  fields: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      type: z.enum(["string", "number", "date", "boolean"]),
      required: z.boolean(),
      hint: z.string(),
      samples: z.array(z.string()),
    }),
  ),
});

export type ProposedField = z.infer<typeof ProposedFields>["fields"][number];

export const inferTemplateFields = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ path: z.string().min(1), name: z.string().min(1), type: z.string().default("") }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");

    const { data: blob, error } = await context.supabase.storage.from("template-uploads").download(data.path);
    if (error || !blob) throw new Error(`Download failed: ${error?.message ?? "no data"}`);
    const bytes = new Uint8Array(await blob.arrayBuffer());

    const lower = data.name.toLowerCase();
    const parts: any[] = [
      {
        type: "text",
        text: `You are designing an extraction template for insurance loss run documents.
Inspect this sample document and propose the set of claim-level fields that should be extracted from documents of this kind.
Rules:
- One entry per column/data point that appears per claim (claim number, dates, status, cause, paid/reserve/incurred amounts, claimant, location, etc.).
- key: snake_case machine name. label: human label as it appears in the document.
- type: string | number | date | boolean. Amounts are number, dates are date.
- required: true only for fields essential to loss run analysis (claim number, date of loss, incurred/paid amounts).
- hint: a short instruction telling an extraction model where to find the value.
- samples: up to 3 example values copied verbatim from the document (empty array if none found).
Do not invent fields that are not evidenced by the document.

Document name: ${data.name}`,
      },
    ];

    if (data.type === "application/pdf" || lower.endsWith(".pdf")) {
      let bin = "";
      for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
      parts.push({
        type: "file",
        data: `data:application/pdf;base64,${btoa(bin)}`,
        mediaType: "application/pdf",
      });
    } else if (lower.match(/\.(xlsx|xls|csv)$/) || data.type.includes("spreadsheet") || data.type.includes("excel")) {
      parts.push({ type: "text", text: spreadsheetToText(bytes.buffer as ArrayBuffer, data.name) });
    } else {
      parts.push({ type: "text", text: new TextDecoder().decode(bytes).slice(0, 200_000) });
    }

    const gateway = createLovableAiGateway(apiKey);
    let output: unknown;
    try {
      ({ output } = await generateText({
        model: gateway("openai/gpt-5.5"),
        messages: [{ role: "user", content: parts as any }],
        output: Output.object({ schema: ProposedFields }),
        providerOptions: { lovable: { reasoningEffort: "none" } },
      }));
    } catch (e: any) {
      const status = e?.statusCode ?? e?.status;
      const body = String(e?.responseBody ?? e?.message ?? "");
      if (status === 402 || status === 403 || body.includes("credit")) {
        throw new Error(
          "AI credits are exhausted for this workspace, so document analysis is unavailable. Add credits in Settings → Plans & credits, then try again.",
        );
      }
      if (status === 429) {
        throw new Error("AI service is rate limited right now. Please retry in a moment.");
      }
      throw new Error(`Document analysis failed: ${body.slice(0, 300)}`);
    }

    const fields = ((output as any)?.fields ?? []) as ProposedField[];
    if (fields.length === 0) throw new Error("No fields could be detected in that document.");
    return { fields };
  });

