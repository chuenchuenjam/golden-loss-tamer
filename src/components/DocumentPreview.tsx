import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { ExternalLink, FileWarning } from "lucide-react";

type Props = {
  file: File | null;
  /** Page identifier from the analyzer: "Page 3" for PDFs, or a sheet name. */
  page: string;
  className?: string;
};

function pageNumber(page: string): number {
  const m = page.match(/(\d+)/);
  return m ? Number(m[1]) : 1;
}

export function DocumentPreview({ file, page, className }: Props) {
  const [url, setUrl] = useState<string>("");
  const [rows, setRows] = useState<string[][] | null>(null);
  const [totalRows, setTotalRows] = useState(0);
  const [error, setError] = useState<string>("");

  const kind = useMemo(() => {
    const n = (file?.name ?? "").toLowerCase();
    if (n.endsWith(".pdf") || file?.type === "application/pdf") return "pdf" as const;
    if (/\.(xlsx|xls|csv)$/.test(n)) return "sheet" as const;
    return "other" as const;
  }, [file]);

  useEffect(() => {
    if (!file || kind !== "pdf") {
      setUrl("");
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file, kind]);

  useEffect(() => {
    let cancelled = false;
    if (!file || kind !== "sheet") {
      setRows(null);
      return;
    }
    (async () => {
      try {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(new Uint8Array(buf), { type: "array" });
        const name = wb.SheetNames.includes(page) ? page : wb.SheetNames[0];
        const all = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[name], { header: 1, defval: "", raw: false });
        if (cancelled) return;
        setTotalRows(all.length);
        setRows(all.slice(0, 50).map((r) => (r as unknown[]).map((c) => String(c ?? ""))));
        setError("");
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Could not read that file");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [file, kind, page]);

  if (!file) return null;

  return (
    <div className={`rounded-md border overflow-hidden flex flex-col ${className ?? ""}`}>
      <div className="flex items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2 text-xs">
        <span className="truncate font-medium">{file.name}</span>
        <span className="shrink-0 text-muted-foreground">Showing: {page || "—"}</span>
      </div>

      {kind === "pdf" && url && (
        <>
          <iframe
            key={`${url}#${page}`}
            title={`Document preview — ${page}`}
            src={`${url}#page=${pageNumber(page)}&view=FitH`}
            className="h-[520px] w-full bg-background"
          />
          <a
            href={`${url}#page=${pageNumber(page)}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 border-t px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <ExternalLink className="h-3 w-3" /> Open in a new tab if the preview does not load
          </a>
        </>
      )}

      {kind === "sheet" && (
        <div className="flex flex-col">
          <div className="max-h-[520px] overflow-auto">
            {error ? (
              <p className="p-3 text-sm text-muted-foreground">{error}</p>
            ) : (
              <table className="w-full border-collapse text-xs">
                <tbody>
                  {rows?.map((r, ri) => (
                    <tr key={ri} className={ri === 0 ? "bg-muted/60 font-medium sticky top-0" : "odd:bg-muted/20"}>
                      {r.map((c, ci) => (
                        <td key={ci} className="whitespace-nowrap border px-2 py-1 align-top">
                          {c}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <p className="border-t px-3 py-2 text-xs text-muted-foreground">
            {totalRows} rows in this sheet{totalRows > 50 ? " — showing the first 50" : ""}
          </p>
        </div>
      )}

      {kind === "other" && (
        <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
          <FileWarning className="h-4 w-4" /> No inline preview available for this file type.
        </div>
      )}
    </div>
  );
}
