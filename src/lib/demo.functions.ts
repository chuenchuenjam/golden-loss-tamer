import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Demo dataset for an underwriter-friendly first-run experience.
// Idempotent: checks for a marker client before inserting.

const DEMO_MARKER = "Acme Logistics Inc.";

type ClaimRow = Record<string, string | number | null>;

function makeGLRows(): ClaimRow[] {
  // Coastal Restaurant Group — GL. 8 claims, one slip-and-fall open with development.
  return [
    { claim_number: "GL-2022-0001", policy_number: "GL-CRG-22", date_of_loss: "2022-03-14", date_reported: "2022-03-18", claimant: "Ramirez, Elena", cause_of_loss: "Slip and Fall", description: "Guest slipped on wet floor near entrance", status: "Closed", paid_indemnity: 12500, paid_expense: 3200, reserve_indemnity: 0, reserve_expense: 0, incurred_total: 15700, deductible: 10000, currency: "USD" },
    { claim_number: "GL-2022-0007", policy_number: "GL-CRG-22", date_of_loss: "2022-07-22", date_reported: "2022-07-25", claimant: "Nguyen, Peter", cause_of_loss: "Food Illness", description: "Alleged food poisoning after banquet", status: "Closed", paid_indemnity: 8000, paid_expense: 4500, reserve_indemnity: 0, reserve_expense: 0, incurred_total: 12500, deductible: 10000, currency: "USD" },
    { claim_number: "GL-2023-0003", policy_number: "GL-CRG-23", date_of_loss: "2023-02-04", date_reported: "2023-02-06", claimant: "Osei, Amara", cause_of_loss: "Slip and Fall", description: "Slip in parking lot after rain; fractured wrist", status: "Open", paid_indemnity: 18000, paid_expense: 6200, reserve_indemnity: 55000, reserve_expense: 8000, incurred_total: 87200, deductible: 10000, currency: "USD" },
    { claim_number: "GL-2023-0011", policy_number: "GL-CRG-23", date_of_loss: "2023-05-19", date_reported: "2023-05-22", claimant: "Silva, Marco", cause_of_loss: "Product Liability", description: "Cracked glassware caused laceration", status: "Closed", paid_indemnity: 2200, paid_expense: 800, reserve_indemnity: 0, reserve_expense: 0, incurred_total: 3000, deductible: 10000, currency: "USD" },
    { claim_number: "GL-2023-0018", policy_number: "GL-CRG-23", date_of_loss: "2023-09-01", date_reported: "2023-09-05", claimant: "Wright, Denise", cause_of_loss: "Slip and Fall", description: "Fell on interior stairs", status: "Closed", paid_indemnity: 6400, paid_expense: 1200, reserve_indemnity: 0, reserve_expense: 0, incurred_total: 7600, deductible: 10000, currency: "USD" },
    { claim_number: "GL-2024-0002", policy_number: "GL-CRG-24", date_of_loss: "2024-01-11", date_reported: "2024-01-13", claimant: "Kowalski, Ivan", cause_of_loss: "Property Damage", description: "Valet damage to guest vehicle", status: "Closed", paid_indemnity: 4800, paid_expense: 400, reserve_indemnity: 0, reserve_expense: 0, incurred_total: 5200, deductible: 5000, currency: "USD" },
    { claim_number: "GL-2024-0009", policy_number: "GL-CRG-24", date_of_loss: "2024-06-08", date_reported: null, claimant: "Hall, Priya", cause_of_loss: "Assault & Battery", description: "Altercation between patrons; missing report date", status: "Open", paid_indemnity: 3200, paid_expense: 1100, reserve_indemnity: 20000, reserve_expense: 5000, incurred_total: 29300, deductible: 10000, currency: "USD" },
    { claim_number: "GL-2024-0015", policy_number: "GL-CRG-24", date_of_loss: "2024-10-27", date_reported: "2024-11-02", claimant: "Bennett, Ross", cause_of_loss: "Slip and Fall", description: "Late-reported slip; investigation ongoing", status: "Open", paid_indemnity: 0, paid_expense: 2500, reserve_indemnity: 40000, reserve_expense: 6000, incurred_total: 48500, deductible: 10000, currency: "USD" },
  ];
}

function makeAutoRows(): ClaimRow[] {
  // Acme Logistics — Commercial Auto. 12 claims across 2022-2024. Includes duplicate claim number and one with negative reserve.
  return [
    { claim_number: "AU-22-1001", policy_number: "CA-ACME-22", date_of_loss: "2022-02-18", date_reported: "2022-02-19", claimant: "Driver: T. Alvarez", cause_of_loss: "Rear-end collision", description: "At-fault; light property damage to third party", status: "Closed", paid_indemnity: 6200, paid_expense: 900, reserve_indemnity: 0, reserve_expense: 0, incurred_total: 7100, deductible: 2500, currency: "USD" },
    { claim_number: "AU-22-1044", policy_number: "CA-ACME-22", date_of_loss: "2022-05-03", date_reported: "2022-05-04", claimant: "Driver: J. Park", cause_of_loss: "Backing accident", description: "Loading dock collision", status: "Closed", paid_indemnity: 3800, paid_expense: 400, reserve_indemnity: 0, reserve_expense: 0, incurred_total: 4200, deductible: 2500, currency: "USD" },
    { claim_number: "AU-22-1078", policy_number: "CA-ACME-22", date_of_loss: "2022-08-11", date_reported: "2022-08-15", claimant: "Driver: M. Chen", cause_of_loss: "Intersection", description: "Failure to yield; BI to third party", status: "Closed", paid_indemnity: 42000, paid_expense: 8500, reserve_indemnity: 0, reserve_expense: 0, incurred_total: 50500, deductible: 2500, currency: "USD" },
    { claim_number: "AU-23-2015", policy_number: "CA-ACME-23", date_of_loss: "2023-01-22", date_reported: "2023-01-23", claimant: "Driver: R. Okafor", cause_of_loss: "Sideswipe", description: "Highway lane change", status: "Closed", paid_indemnity: 7800, paid_expense: 1200, reserve_indemnity: 0, reserve_expense: 0, incurred_total: 9000, deductible: 2500, currency: "USD" },
    { claim_number: "AU-23-2044", policy_number: "CA-ACME-23", date_of_loss: "2023-04-09", date_reported: "2023-04-12", claimant: "Driver: L. Ivanov", cause_of_loss: "Jackknife", description: "Wet road; single-vehicle", status: "Open", paid_indemnity: 22000, paid_expense: 4500, reserve_indemnity: 35000, reserve_expense: 5000, incurred_total: 66500, deductible: 2500, currency: "USD" },
    { claim_number: "AU-23-2071", policy_number: "CA-ACME-23", date_of_loss: "2023-06-14", date_reported: "2023-06-15", claimant: "Driver: T. Alvarez", cause_of_loss: "Rear-end collision", description: "Third-party BI; reserve development over periods", status: "Open", paid_indemnity: 18500, paid_expense: 3200, reserve_indemnity: 95000, reserve_expense: 12000, incurred_total: 128700, deductible: 2500, currency: "USD" },
    { claim_number: "AU-23-2098", policy_number: "CA-ACME-23", date_of_loss: "2023-09-30", date_reported: "2023-10-02", claimant: "Driver: S. Patel", cause_of_loss: "Parking lot", description: "Minor property damage", status: "Closed", paid_indemnity: 1400, paid_expense: 200, reserve_indemnity: 0, reserve_expense: 0, incurred_total: 1600, deductible: 2500, currency: "USD" },
    { claim_number: "AU-24-3011", policy_number: "CA-ACME-24", date_of_loss: "2024-02-05", date_reported: "2024-02-07", claimant: "Driver: R. Okafor", cause_of_loss: "Animal strike", description: "Deer strike; vehicle damage", status: "Closed", paid_indemnity: 9200, paid_expense: 500, reserve_indemnity: 0, reserve_expense: 0, incurred_total: 9700, deductible: 2500, currency: "USD" },
    { claim_number: "AU-24-3029", policy_number: "CA-ACME-24", date_of_loss: "2024-05-18", date_reported: "2024-05-19", claimant: "Driver: J. Park", cause_of_loss: "Weather-related", description: "Hail damage while parked", status: "Closed", paid_indemnity: 5600, paid_expense: 300, reserve_indemnity: 0, reserve_expense: 0, incurred_total: 5900, deductible: 2500, currency: "USD" },
    { claim_number: "AU-24-3055", policy_number: "CA-ACME-24", date_of_loss: "2024-07-24", date_reported: "2024-07-25", claimant: "Driver: M. Chen", cause_of_loss: "Intersection", description: "Third-party PD only", status: "Open", paid_indemnity: 3200, paid_expense: 800, reserve_indemnity: -1500, reserve_expense: 500, incurred_total: 3000, deductible: 2500, currency: "USD" },
    { claim_number: "AU-24-3055", policy_number: "CA-ACME-24", date_of_loss: "2024-07-24", date_reported: "2024-07-26", claimant: "Driver: M. Chen", cause_of_loss: "Intersection", description: "Duplicate entry from second carrier report", status: "Open", paid_indemnity: 3200, paid_expense: 800, reserve_indemnity: 0, reserve_expense: 500, incurred_total: 4500, deductible: 2500, currency: "USD" },
    { claim_number: "AU-24-3082", policy_number: "CA-ACME-24", date_of_loss: "2024-11-02", date_reported: "2024-11-03", claimant: "Driver: L. Ivanov", cause_of_loss: "Rear-end collision", description: "Third-party BI, still developing", status: "Open", paid_indemnity: 6000, paid_expense: 1500, reserve_indemnity: 45000, reserve_expense: 7000, incurred_total: 59500, deductible: 2500, currency: "USD" },
  ];
}

function makeWCRows(): ClaimRow[] {
  // Northwind Manufacturing — WC. 15 claims incl. 1 large loss, 2 lost-time. One row missing date_reported.
  return [
    { claim_number: "WC-22-5001", policy_number: "WC-NW-22", date_of_loss: "2022-01-19", date_reported: "2022-01-20", claimant: "Foster, K.", cause_of_loss: "Strain - Lifting", description: "Lower back strain; medical only", status: "Closed", paid_indemnity: 0, paid_expense: 1800, reserve_indemnity: 0, reserve_expense: 0, incurred_total: 1800, deductible: 0, currency: "USD" },
    { claim_number: "WC-22-5019", policy_number: "WC-NW-22", date_of_loss: "2022-03-08", date_reported: "2022-03-09", claimant: "Adeyemi, O.", cause_of_loss: "Struck by object", description: "Hand laceration; sutures", status: "Closed", paid_indemnity: 0, paid_expense: 2400, reserve_indemnity: 0, reserve_expense: 0, incurred_total: 2400, deductible: 0, currency: "USD" },
    { claim_number: "WC-22-5042", policy_number: "WC-NW-22", date_of_loss: "2022-06-11", date_reported: "2022-06-12", claimant: "Delgado, R.", cause_of_loss: "Fall from height", description: "Lost-time; fractured ankle", status: "Closed", paid_indemnity: 34000, paid_expense: 9500, reserve_indemnity: 0, reserve_expense: 0, incurred_total: 43500, deductible: 0, currency: "USD" },
    { claim_number: "WC-22-5077", policy_number: "WC-NW-22", date_of_loss: "2022-09-24", date_reported: "2022-09-26", claimant: "Nakamura, H.", cause_of_loss: "Repetitive motion", description: "Carpal tunnel; conservative treatment", status: "Closed", paid_indemnity: 4200, paid_expense: 3100, reserve_indemnity: 0, reserve_expense: 0, incurred_total: 7300, deductible: 0, currency: "USD" },
    { claim_number: "WC-23-6008", policy_number: "WC-NW-23", date_of_loss: "2023-01-17", date_reported: "2023-01-18", claimant: "Barrett, S.", cause_of_loss: "Slip on ice", description: "Bruised knee; medical only", status: "Closed", paid_indemnity: 0, paid_expense: 900, reserve_indemnity: 0, reserve_expense: 0, incurred_total: 900, deductible: 0, currency: "USD" },
    { claim_number: "WC-23-6023", policy_number: "WC-NW-23", date_of_loss: "2023-02-28", date_reported: "2023-03-02", claimant: "Ivanov, D.", cause_of_loss: "Caught in machinery", description: "Severe hand injury; ongoing TTD", status: "Open", paid_indemnity: 118000, paid_expense: 42000, reserve_indemnity: 70000, reserve_expense: 25000, incurred_total: 255000, deductible: 0, currency: "USD" },
    { claim_number: "WC-23-6045", policy_number: "WC-NW-23", date_of_loss: "2023-05-05", date_reported: null, claimant: "Ortiz, P.", cause_of_loss: "Strain - Lifting", description: "Reported late by supervisor; missing report date", status: "Closed", paid_indemnity: 3200, paid_expense: 1400, reserve_indemnity: 0, reserve_expense: 0, incurred_total: 4600, deductible: 0, currency: "USD" },
    { claim_number: "WC-23-6067", policy_number: "WC-NW-23", date_of_loss: "2023-07-19", date_reported: "2023-07-20", claimant: "Kim, Y.", cause_of_loss: "Chemical exposure", description: "Skin irritation; short medical", status: "Closed", paid_indemnity: 0, paid_expense: 1600, reserve_indemnity: 0, reserve_expense: 0, incurred_total: 1600, deductible: 0, currency: "USD" },
    { claim_number: "WC-23-6081", policy_number: "WC-NW-23", date_of_loss: "2023-10-04", date_reported: "2023-10-06", claimant: "Robinson, T.", cause_of_loss: "Fall - same level", description: "Trip on cord; concussion", status: "Open", paid_indemnity: 8400, paid_expense: 5600, reserve_indemnity: 22000, reserve_expense: 6000, incurred_total: 42000, deductible: 0, currency: "USD" },
    { claim_number: "WC-24-7003", policy_number: "WC-NW-24", date_of_loss: "2024-01-08", date_reported: "2024-01-09", claimant: "Hansen, L.", cause_of_loss: "Struck by object", description: "Falling box; shoulder", status: "Closed", paid_indemnity: 2800, paid_expense: 900, reserve_indemnity: 0, reserve_expense: 0, incurred_total: 3700, deductible: 0, currency: "USD" },
    { claim_number: "WC-24-7018", policy_number: "WC-NW-24", date_of_loss: "2024-03-15", date_reported: "2024-03-15", claimant: "Souza, B.", cause_of_loss: "Lifting", description: "Lost-time; herniated disc", status: "Open", paid_indemnity: 45000, paid_expense: 18000, reserve_indemnity: 60000, reserve_expense: 12000, incurred_total: 135000, deductible: 0, currency: "USD" },
    { claim_number: "WC-24-7031", policy_number: "WC-NW-24", date_of_loss: "2024-05-27", date_reported: "2024-05-28", claimant: "Petrov, N.", cause_of_loss: "Burn - chemical", description: "First-degree; treated on-site", status: "Closed", paid_indemnity: 0, paid_expense: 700, reserve_indemnity: 0, reserve_expense: 0, incurred_total: 700, deductible: 0, currency: "USD" },
    { claim_number: "WC-24-7052", policy_number: "WC-NW-24", date_of_loss: "2024-08-11", date_reported: "2024-08-12", claimant: "Adeyemi, O.", cause_of_loss: "Cut - hand tool", description: "Sutures and PT", status: "Closed", paid_indemnity: 1200, paid_expense: 2200, reserve_indemnity: 0, reserve_expense: 0, incurred_total: 3400, deductible: 0, currency: "USD" },
    { claim_number: "WC-24-7069", policy_number: "WC-NW-24", date_of_loss: "2024-10-02", date_reported: "2024-10-03", claimant: "Yamada, M.", cause_of_loss: "Repetitive motion", description: "Wrist tendonitis", status: "Open", paid_indemnity: 1800, paid_expense: 2400, reserve_indemnity: 9000, reserve_expense: 2500, incurred_total: 15700, deductible: 0, currency: "USD" },
    { claim_number: "WC-24-7088", policy_number: "WC-NW-24", date_of_loss: "2024-11-19", date_reported: "2024-11-20", claimant: "Rossi, F.", cause_of_loss: "Slip on liquid", description: "Bruising; medical only", status: "Closed", paid_indemnity: 0, paid_expense: 1100, reserve_indemnity: 0, reserve_expense: 0, incurred_total: 1100, deductible: 0, currency: "USD" },
  ];
}

export const seedDemoData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // Admin only
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden: admin only");

    // Idempotency check
    const { data: existing } = await supabase
      .from("clients")
      .select("id")
      .eq("name", DEMO_MARKER)
      .maybeSingle();
    if (existing) return { ok: true, skipped: true as const };

    // Lookup LoBs + system templates
    const { data: lobs, error: lobErr } = await supabase.from("lines_of_business").select("id, slug");
    if (lobErr) throw new Error(lobErr.message);
    const lobBySlug = new Map((lobs ?? []).map((l: any) => [l.slug, l.id as string]));

    const { data: tpls, error: tplErr } = await supabase
      .from("templates")
      .select("id, lob_id, is_system, is_golden");
    if (tplErr) throw new Error(tplErr.message);
    const goldenByLob = new Map<string, string>();
    for (const t of tpls ?? []) {
      if (t.is_system && t.is_golden) goldenByLob.set(t.lob_id as string, t.id as string);
    }

    const autoLob = lobBySlug.get("auto")!;
    const wcLob = lobBySlug.get("workers-comp")!;
    const glLob = lobBySlug.get("general-liability")!;
    const autoTpl = goldenByLob.get(autoLob);
    const wcTpl = goldenByLob.get(wcLob);
    const glTpl = goldenByLob.get(glLob);
    if (!autoTpl || !wcTpl || !glTpl) throw new Error("Missing golden templates for demo LoBs");

    // Clients
    const clientNames = [
      DEMO_MARKER,
      "Northwind Manufacturing",
      "Coastal Restaurant Group",
      "Meridian Tech Holdings",
    ];
    const { data: insertedClients, error: cErr } = await supabase
      .from("clients")
      .insert(clientNames.map((name) => ({ name, created_by: userId })))
      .select();
    if (cErr) throw new Error(cErr.message);
    const clientId = (name: string) => insertedClients!.find((c: any) => c.name === name)!.id as string;

    // Jobs
    const jobsPayload = [
      {
        user_id: userId,
        name: "Acme Logistics — Auto Loss Run 2022–2024",
        client_id: clientId(DEMO_MARKER),
        template_id: autoTpl,
        lob_id: autoLob,
        source_files: [
          { name: "acme_auto_2022.pdf", path: "demo/acme_auto_2022.pdf", size: 184320, type: "application/pdf" },
          { name: "acme_auto_2023.pdf", path: "demo/acme_auto_2023.pdf", size: 192840, type: "application/pdf" },
          { name: "acme_auto_2024.pdf", path: "demo/acme_auto_2024.pdf", size: 201456, type: "application/pdf" },
        ],
        status: "ready",
        status_message: "Extracted 12 claims. Reconciliation flagged 2 issues.",
        completed_at: new Date().toISOString(),
      },
      {
        user_id: userId,
        name: "Northwind Manufacturing — Workers Comp 3-yr",
        client_id: clientId("Northwind Manufacturing"),
        template_id: wcTpl,
        lob_id: wcLob,
        source_files: [
          { name: "northwind_wc_loss_run.xlsx", path: "demo/northwind_wc_loss_run.xlsx", size: 78412, type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
        ],
        status: "ready",
        status_message: "Extracted 15 claims. Reconciliation flagged 1 issue.",
        completed_at: new Date().toISOString(),
      },
      {
        user_id: userId,
        name: "Coastal Restaurant Group — GL Loss Run",
        client_id: clientId("Coastal Restaurant Group"),
        template_id: glTpl,
        lob_id: glLob,
        source_files: [
          { name: "coastal_gl_2022_2024.pdf", path: "demo/coastal_gl_2022_2024.pdf", size: 246800, type: "application/pdf" },
        ],
        status: "ready",
        status_message: "Extracted 8 claims. Reconciliation flagged 1 issue.",
        completed_at: new Date().toISOString(),
      },
    ];
    const { data: insertedJobs, error: jErr } = await supabase
      .from("extraction_jobs")
      .insert(jobsPayload)
      .select();
    if (jErr) throw new Error(jErr.message);
    const [autoJob, wcJob, glJob] = insertedJobs!;

    // Rows
    const autoRows = makeAutoRows();
    const wcRows = makeWCRows();
    const glRows = makeGLRows();

    const rowInserts = [
      ...autoRows.map((data, i) => ({
        job_id: autoJob.id, row_index: i,
        source_file: `acme_auto_${2022 + Math.min(2, Math.floor(i / 4))}.pdf`,
        data, included_in_export: true,
      })),
      ...wcRows.map((data, i) => ({
        job_id: wcJob.id, row_index: i,
        source_file: "northwind_wc_loss_run.xlsx",
        data, included_in_export: true,
      })),
      ...glRows.map((data, i) => ({
        job_id: glJob.id, row_index: i,
        source_file: "coastal_gl_2022_2024.pdf",
        data, included_in_export: true,
      })),
    ];
    const { data: insertedRows, error: rErr } = await supabase
      .from("extraction_rows")
      .insert(rowInserts)
      .select();
    if (rErr) throw new Error(rErr.message);

    const findRow = (jobId: string, claim: string) =>
      insertedRows!.find(
        (r: any) => r.job_id === jobId && (r.data as any).claim_number === claim,
      );

    // Data quality issues
    const dupAuto = insertedRows!.filter(
      (r: any) => r.job_id === autoJob.id && (r.data as any).claim_number === "AU-24-3055",
    );
    const negReserveAuto = findRow(autoJob.id, "AU-24-3055"); // first occurrence has -1500 reserve_indemnity
    const devAuto = findRow(autoJob.id, "AU-23-2071");
    const lateGL = findRow(glJob.id, "GL-2024-0009");
    const lateWC = findRow(wcJob.id, "WC-23-6045");

    const issueRows: any[] = [];
    for (const r of dupAuto) {
      issueRows.push({
        job_id: autoJob.id, row_id: r.id, severity: "error",
        code: "DUPLICATE_CLAIM_NUMBER", field: "claim_number",
        message: "Claim number AU-24-3055 appears more than once across source files.",
      });
    }
    if (negReserveAuto) {
      issueRows.push({
        job_id: autoJob.id, row_id: negReserveAuto.id, severity: "error",
        code: "NEGATIVE_RESERVE", field: "reserve_indemnity",
        message: "Reserve indemnity is negative (-1,500). Reserves should be zero or positive.",
      });
    }
    if (devAuto) {
      issueRows.push({
        job_id: autoJob.id, row_id: devAuto.id, severity: "warning",
        code: "INCURRED_DEVELOPMENT", field: "incurred_total",
        message: "Incurred developed materially across valuation dates (>30% increase). Review reserve adequacy.",
      });
    }
    if (lateGL) {
      issueRows.push({
        job_id: glJob.id, row_id: lateGL.id, severity: "warning",
        code: "MISSING_DATE_REPORTED", field: "date_reported",
        message: "Missing date_reported — cannot compute lag-to-report.",
      });
    }
    if (lateWC) {
      issueRows.push({
        job_id: wcJob.id, row_id: lateWC.id, severity: "warning",
        code: "MISSING_DATE_REPORTED", field: "date_reported",
        message: "Missing date_reported — cannot compute lag-to-report.",
      });
    }

    if (issueRows.length) {
      const { error: iErr } = await supabase.from("data_quality_issues").insert(issueRows);
      if (iErr) throw new Error(iErr.message);
    }

    return {
      ok: true,
      skipped: false as const,
      clients: insertedClients!.length,
      jobs: insertedJobs!.length,
      rows: insertedRows!.length,
      issues: issueRows.length,
    };
  });

export const clearDemoData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden: admin only");

    const demoClientNames = [
      DEMO_MARKER,
      "Northwind Manufacturing",
      "Coastal Restaurant Group",
      "Meridian Tech Holdings",
    ];
    // Delete clients (jobs cascade via FK? if not, delete jobs first by name pattern)
    const { data: demoJobs } = await supabase
      .from("extraction_jobs")
      .select("id, name")
      .in("name", [
        "Acme Logistics — Auto Loss Run 2022–2024",
        "Northwind Manufacturing — Workers Comp 3-yr",
        "Coastal Restaurant Group — GL Loss Run",
      ]);
    for (const j of demoJobs ?? []) {
      await supabase.from("data_quality_issues").delete().eq("job_id", j.id);
      await supabase.from("extraction_rows").delete().eq("job_id", j.id);
      await supabase.from("extraction_jobs").delete().eq("id", j.id);
    }
    await supabase.from("clients").delete().in("name", demoClientNames);
    return { ok: true };
  });
