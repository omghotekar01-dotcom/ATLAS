import type { ReactNode } from "react";
import { Hourglass } from "lucide-react";
import { Panel, Pill } from "./primitives";

export function NotAvailable({
  title,
  children,
  requirements,
}: {
  title: string;
  children: ReactNode;
  requirements: string[];
}) {
  return (
    <Panel className="border-dashed">
      <div className="flex items-start gap-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-elevated text-warning">
          <Hourglass className="size-5" />
        </span>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold">{title}</h2>
            <Pill tone="warning">Not available yet</Pill>
          </div>
          <div className="mt-2 text-sm text-muted-foreground">{children}</div>
          <ul className="mt-4 space-y-1.5 text-sm">
            {requirements.map((r) => (
              <li key={r} className="flex gap-2 text-muted-foreground">
                <span className="mt-2 size-1 rounded-full bg-subtle" />
                {r}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Panel>
  );
}
