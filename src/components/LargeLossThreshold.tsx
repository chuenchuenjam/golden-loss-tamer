import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LARGE_LOSS_THRESHOLDS } from "@/lib/large-loss";

const fmt = (n: number) => (n === 0 ? "Show all" : n >= 1_000_000 ? `$${n / 1_000_000}M` : `$${n / 1000}K`);

export function LargeLossThreshold({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="font-medium">Large Losses &gt;</span>
      <Select value={String(value)} onValueChange={(v) => onChange(Number(v))}>
        <SelectTrigger className="w-32 h-8 bg-highlight text-highlight-foreground" aria-label="Large loss threshold"><SelectValue /></SelectTrigger>
        <SelectContent>
          {LARGE_LOSS_THRESHOLDS.map((t) => <SelectItem key={t} value={String(t)}>{fmt(t)}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
