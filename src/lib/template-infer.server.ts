import { generateText, Output } from "ai";
import type { z } from "zod";
import { createLovableAiGateway } from "./ai-gateway.server";
import { sheetNames, sheetToText, pdfPageCount } from "./file-parse.server";

export type DocKind = "pdf" | "sheet" | "text";

export function docKind(name: string, type: string): DocKind {
  const lower = name.toLowerCase();
  if (type === "application/pdf" || lower.endsWith(".pdf")) return "pdf";
  if (lower.match(/\.(xlsx|xls|csv)$/) || type.includes("spreadsheet") || type.includes("excel")) return "sheet";
  return "text";
}

export function pdfPart(bytes: Uint8Array) {
  let bin = "";
  const chunk = 32768;
  for (let i = 0; i < bytes.byteLength; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return { type: "file", data: `data:application/pdf;base64,${btoa(bin)}`, mediaType: "application/pdf" };
}

export function listPages(bytes: Uint8Array, kind: DocKind): string[] {
  if (kind === "sheet") return sheetNames(bytes.buffer as ArrayBuffer);
  if (kind === "pdf") return Array.from({ length: Math.max(1, pdfPageCount(bytes)) }, (_, i) => `Page ${i + 1}`);
  return ["Document"];
}

export function aiError(e: any): Error {
  const status = e?.statusCode ?? e?.status;
  const body = String(e?.responseBody ?? e?.message ?? "");
  if (status === 402 || status === 403 || body.includes("credit")) {
    return new Error(
      "AI credits are exhausted for this workspace, so document analysis is unavailable. Add credits in Settings → Plans & credits, then try again.",
    );
  }
  if (status === 429) return new Error("AI service is rate limited right now. Please retry in a moment.");
  return new Error(`Document analysis failed: ${body.slice(0, 300)}`);
}

export async function runStructured<T extends z.ZodTypeAny>(apiKey: string, parts: unknown[], schema: T) {
  const gateway = createLovableAiGateway(apiKey);
  try {
    const { output } = await generateText({
      model: gateway("openai/gpt-5.5"),
      messages: [{ role: "user", content: parts as any }],
      output: Output.object({ schema }),
      providerOptions: { lovable: { reasoningEffort: "none" } },
    });
    return output as z.infer<T>;
  } catch (e: any) {
    throw aiError(e);
  }
}

export { sheetToText };
