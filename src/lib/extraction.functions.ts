import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { generateText, Output, NoObjectGeneratedError } from "ai";
import { createLovableAiGateway } from "./ai-gateway.server";
import { spreadsheetToText } from "./file-parse.server";

type Field = {
  key: string;
  label: string;
  type?: "string" | "number" | "date" | "boolean";
  required?: boolean;
  hint?: string;
};

function buildRowSchema(fields: Field[]) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const f of fields) {
    let base: z.ZodTypeAny;
    if (f.type === "number") base = z.number().nullable();
    else if (f.type === "boolean") base = z.boolean().nullable();
    else base = z.string().nullable();
    shape[f.key] = base;
  }
  return z.object({ claims: z.array(z.object(shape)) });
}

async function downloadFile(supabase: any, path: string): Promise<{ blob: Blob; bytes: Uint8Array }> {
  const { data, error } = await supabase.storage.from("loss-run-uploads").download(path);
  if (error || !data) throw new Error(`Download failed for ${path}: ${error?.message ?? "no data"}`);
  const buf = await data.arrayBuffer();
  return { blob: data, bytes: new Uint8Array(buf) };
}

function toBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
  // btoa is available in workerd
  return btoa(bin);
}

export const runExtraction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ job_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");

    const { data: job, error: je } = await context.supabase
      .from("extraction_jobs")
      .select("*, templates(fields)")
      .eq("id", data.job_id)
      .single();
    if (je || !job) throw new Error(je?.message ?? "Job not found");

    const fields = ((job.templates as any)?.fields ?? []) as Field[];
    if (fields.length === 0) throw new Error("Template has no fields");

    await context.supabase
      .from("extraction_jobs")
      .update({ status: "extracting", status_message: null })
      .eq("id", data.job_id);

    const gateway = createLovableAiGateway(apiKey);
    const model = gateway("openai/gpt-5.5");
    const schema = buildRowSchema(fields);

    // Clear previous rows/issues
    await context.supabase.from("extraction_rows").delete().eq("job_id", data.job_id);
    await context.supabase.from("data_quality_issues").delete().eq("job_id", data.job_id);

    const fieldsList = fields
      .map((f) => `- ${f.key}${f.required ? " (required)" : ""}: ${f.label}${f.hint ? ` — ${f.hint}` : ""}`)
      .join("\n");

    const sysPrompt = `You extract loss-run claim rows from insurance documents.
Return one entry per claim. Use null for unknown values. Dates as YYYY-MM-DD. Numbers as plain numbers (no currency symbols).
Fields:
${fieldsList}`;

    let insertedRows = 0;
    try {
      for (const src of (job.source_files as any[]) ?? []) {
        const { bytes } = await downloadFile(context.supabase, src.path);
        const type: string = src.type || "";
        const name: string = src.name || src.path;

        const contentParts: any[] = [{ type: "text", text: sysPrompt }];
        contentParts.push({ type: "text", text: `\nDocument name: ${name}` });

        if (type === "application/pdf" || name.toLowerCase().endsWith(".pdf")) {
          const b64 = toBase64(bytes);
          contentParts.push({
            type: "file",
            data: `data:application/pdf;base64,${b64}`,
            mediaType: "application/pdf",
          });
        } else if (
          type.includes("spreadsheet") ||
          type.includes("excel") ||
          name.toLowerCase().match(/\.(xlsx|xls|csv)$/)
        ) {
          const text = spreadsheetToText(bytes.buffer as ArrayBuffer, name);
          contentParts.push({ type: "text", text });
        } else {
          // Fallback: decode as text
          try {
            const text = new TextDecoder().decode(bytes);
            contentParts.push({ type: "text", text: text.slice(0, 200_000) });
          } catch {
            continue;
          }
        }

        try {
          const { output } = await generateText({
            model,
            messages: [{ role: "user", content: contentParts as any }],
            output: Output.object({ schema }),
            providerOptions: { lovable: { reasoningEffort: "none" } },
          });

          const claims = (output as any)?.claims ?? [];
          for (let i = 0; i < claims.length; i++) {
            const row = claims[i];
            const { error: ie } = await context.supabase.from("extraction_rows").insert({
              job_id: data.job_id,
              row_index: insertedRows++,
              source_file: name,
              data: row,
            });
            if (ie) console.error("insert row error", ie);
          }
        } catch (err) {
          if (NoObjectGeneratedError.isInstance(err)) {
            await context.supabase.from("data_quality_issues").insert({
              job_id: data.job_id,
              severity: "error",
              code: "EXTRACTION_PARSE_FAILED",
              message: `Could not parse extraction output for ${name}: ${err.message}`,
            });
          } else {
            throw err;
          }
        }
      }
    } catch (err: any) {
      await context.supabase
        .from("extraction_jobs")
        .update({ status: "error", status_message: err?.message ?? "Extraction failed" })
        .eq("id", data.job_id);
      throw err;
    }

    await context.supabase
      .from("extraction_jobs")
      .update({ status: "reconciling" })
      .eq("id", data.job_id);

    return { ok: true, rows: insertedRows };
  });

export const reconcileJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ job_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: job } = await context.supabase
      .from("extraction_jobs")
      .select("*, templates(fields)")
      .eq("id", data.job_id)
      .single();
    if (!job) throw new Error("Job not found");
    const fields = ((job.templates as any)?.fields ?? []) as Field[];
    const requiredKeys = fields.filter((f) => f.required).map((f) => f.key);

    const { data: rows } = await context.supabase
      .from("extraction_rows")
      .select("*")
      .eq("job_id", data.job_id)
      .order("row_index");

    // Clear existing issues (fresh reconciliation)
    await context.supabase.from("data_quality_issues").delete().eq("job_id", data.job_id);

    const issues: Array<{
      job_id: string;
      row_id?: string | null;
      severity: "info" | "warning" | "error";
      code: string;
      field?: string | null;
      message: string;
    }> = [];

    const byClaim = new Map<string, any[]>();
    for (const r of rows ?? []) {
      const d: any = r.data ?? {};
      // Required fields present
      for (const k of requiredKeys) {
        if (d[k] === null || d[k] === undefined || d[k] === "") {
          issues.push({
            job_id: data.job_id,
            row_id: r.id,
            severity: "error",
            code: "MISSING_REQUIRED",
            field: k,
            message: `Missing required field "${k}"`,
          });
        }
      }
      // Negative reserves
      for (const numField of ["reserve_indemnity", "reserve_expense", "paid_indemnity", "paid_expense"]) {
        const v = d[numField];
        if (typeof v === "number" && v < 0) {
          issues.push({
            job_id: data.job_id,
            row_id: r.id,
            severity: "warning",
            code: "NEGATIVE_AMOUNT",
            field: numField,
            message: `Negative value for ${numField}: ${v}`,
          });
        }
      }
      // Date validity
      for (const dateField of ["date_of_loss", "date_reported"]) {
        const v = d[dateField];
        if (v && isNaN(Date.parse(v))) {
          issues.push({
            job_id: data.job_id,
            row_id: r.id,
            severity: "warning",
            code: "INVALID_DATE",
            field: dateField,
            message: `Invalid date for ${dateField}: ${v}`,
          });
        }
      }
      const cn = String(d.claim_number ?? "").trim();
      if (cn) {
        const arr = byClaim.get(cn) ?? [];
        arr.push(r);
        byClaim.set(cn, arr);
      }
    }

    // Cross-row reconciliation
    for (const [cn, group] of byClaim.entries()) {
      if (group.length > 1) {
        // Sort by date_reported or created order
        const sorted = [...group].sort((a, b) => {
          const da = Date.parse(a.data?.date_reported ?? "") || 0;
          const db = Date.parse(b.data?.date_reported ?? "") || 0;
          return da - db;
        });
        for (let i = 1; i < sorted.length; i++) {
          const prev = sorted[i - 1].data ?? {};
          const cur = sorted[i].data ?? {};
          for (const f of ["paid_indemnity", "paid_expense", "incurred_total"]) {
            if (typeof prev[f] === "number" && typeof cur[f] === "number" && cur[f] < prev[f]) {
              issues.push({
                job_id: data.job_id,
                row_id: sorted[i].id,
                severity: "warning",
                code: "AMOUNT_REGRESSION",
                field: f,
                message: `Claim ${cn}: ${f} decreased from ${prev[f]} to ${cur[f]} across periods`,
              });
            }
          }
          if (
            typeof prev.status === "string" &&
            typeof cur.status === "string" &&
            /closed/i.test(prev.status) &&
            /open/i.test(cur.status)
          ) {
            issues.push({
              job_id: data.job_id,
              row_id: sorted[i].id,
              severity: "info",
              code: "STATUS_REGRESSION",
              field: "status",
              message: `Claim ${cn} reopened (was Closed, now Open)`,
            });
          }
        }
        if (group.length > 5) {
          issues.push({
            job_id: data.job_id,
            severity: "info",
            code: "DUPLICATE_CLAIM_HIGH",
            message: `Claim number ${cn} appears ${group.length} times`,
          });
        }
      }
    }

    if (issues.length > 0) {
      await context.supabase.from("data_quality_issues").insert(issues);
    }

    await context.supabase
      .from("extraction_jobs")
      .update({ status: "ready", completed_at: new Date().toISOString() })
      .eq("id", data.job_id);

    return { ok: true, issues: issues.length };
  });
