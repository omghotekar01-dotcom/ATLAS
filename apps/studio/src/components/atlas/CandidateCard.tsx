import type { FunctionCandidate } from "@/api/types";
import { truncateMiddle } from "@/lib/atlas/hex";
import { CopyButton, Mono, Pill } from "./primitives";

export function CandidateCard({
  c,
  selector,
  index,
}: {
  c: FunctionCandidate;
  selector: string;
  index?: number;
}) {
  const p = c.provenance;
  const rows: [string, string, boolean][] = [
    ["Source", c.source, false],
    ["Source ID", c.sourceId, true],
    ["Dataset version", p.datasetVersion, true],
    ["Imported", new Date(p.importedAt).toLocaleString(), false],
    ["Record hash", p.recordHash, true],
    ["Entity key", c.entityKey, true],
  ];
  return (
    <article className="rounded-xl border border-border bg-background/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2">
            {index !== undefined && <Pill>#{index + 1}</Pill>}
            <Mono className="text-primary">{selector}</Mono>
          </div>
          <Mono className="text-[15px] text-foreground">{c.signature}</Mono>
        </div>
        <div className="flex gap-2">
          <CopyButton value={selector} label="Selector" />
          <CopyButton value={c.signature} label="Signature" />
        </div>
      </div>
      <dl className="mt-4 grid gap-x-6 gap-y-2 border-t border-border pt-4 text-xs sm:grid-cols-2">
        {rows.map(([k, v, mono]) => (
          <div key={k} className="flex justify-between gap-3">
            <dt className="text-subtle">{k}</dt>
            <dd
              className={mono ? "font-mono text-muted-foreground" : "text-muted-foreground"}
              title={v}
            >
              {mono ? truncateMiddle(v) : v}
            </dd>
          </div>
        ))}
      </dl>
    </article>
  );
}
