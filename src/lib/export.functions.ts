import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import ExcelJS from "exceljs";

export const exportJobToExcel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        job_id: z.string().uuid(),
        selected_fields: z.array(z.string()).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: job, error: je } = await context.supabase
      .from("extraction_jobs")
      .select("*, templates(name, fields), clients(name), lines_of_business(name)")
      .eq("id", data.job_id)
      .single();
    if (je || !job) throw new Error(je?.message ?? "Job not found");

    const { data: rows } = await context.supabase
      .from("extraction_rows")
      .select("*")
      .eq("job_id", data.job_id)
      .order("row_index");
    const { data: issues } = await context.supabase
      .from("data_quality_issues")
      .select("*")
      .eq("job_id", data.job_id);

    const tplFields = ((job.templates as any)?.fields ?? []) as Array<{
      key: string;
      label: string;
    }>;
    const selected = data.selected_fields && data.selected_fields.length > 0
      ? tplFields.filter((f) => data.selected_fields!.includes(f.key))
      : tplFields;

    const wb = new ExcelJS.Workbook();
    wb.creator = "Loss Run Extractor";
    wb.created = new Date();

    // Summary sheet
    const sum = wb.addWorksheet("Summary");
    sum.addRows([
      ["Job Name", job.name],
      ["Client", (job.clients as any)?.name ?? ""],
      ["Line of Business", (job.lines_of_business as any)?.name ?? ""],
      ["Template", (job.templates as any)?.name ?? ""],
      ["Status", job.status],
      ["Created", job.created_at],
      ["Completed", job.completed_at ?? ""],
      ["Total Rows", (rows ?? []).length],
      ["Included in Export", (rows ?? []).filter((r: any) => r.included_in_export).length],
      ["Data Quality Issues", (issues ?? []).length],
    ]);
    sum.getColumn(1).width = 28;
    sum.getColumn(2).width = 60;
    sum.getColumn(1).font = { bold: true };

    // Claims sheet
    const claims = wb.addWorksheet("Claims");
    claims.columns = [
      { header: "Source File", key: "__src", width: 24 },
      ...selected.map((f) => ({ header: f.label, key: f.key, width: 22 })),
    ];
    claims.getRow(1).font = { bold: true };
    claims.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFEEF2F7" },
    };
    for (const r of rows ?? []) {
      if (!r.included_in_export) continue;
      const d: any = r.data ?? {};
      const row: Record<string, unknown> = { __src: r.source_file ?? "" };
      for (const f of selected) row[f.key] = d[f.key] ?? null;
      claims.addRow(row);
    }

    // Data Quality sheet
    const dq = wb.addWorksheet("Data Quality");
    dq.columns = [
      { header: "Severity", key: "severity", width: 12 },
      { header: "Code", key: "code", width: 26 },
      { header: "Field", key: "field", width: 22 },
      { header: "Message", key: "message", width: 80 },
    ];
    dq.getRow(1).font = { bold: true };
    for (const i of issues ?? []) dq.addRow(i);

    const buffer = (await wb.xlsx.writeBuffer()) as ArrayBuffer;
    const path = `${context.userId}/${data.job_id}-${Date.now()}.xlsx`;
    const { error: ue } = await context.supabase.storage
      .from("exports")
      .upload(path, buffer, {
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        upsert: true,
      });
    if (ue) throw new Error(ue.message);

    const { data: signed, error: se } = await context.supabase.storage
      .from("exports")
      .createSignedUrl(path, 60 * 10);
    if (se || !signed) throw new Error(se?.message ?? "Signed URL failed");
    return { url: signed.signedUrl, path };
  });
