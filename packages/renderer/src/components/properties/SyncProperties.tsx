import type { SyncNodeData } from "../../types/flow";
import { inputBaseClass } from "../../lib/utils";
import { FunctionCodeViewer } from "./FunctionCodeViewer";

interface Props {
  data: SyncNodeData;
  onUpdate: (data: Partial<SyncNodeData>) => void;
}

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];
const FREQUENCIES = ["1h", "6h", "12h", "1d", "7d", "30d"];

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
        {label}
      </label>
      {children}
    </div>
  );
}


export function SyncProperties({ data, onUpdate }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 pb-3 border-b border-[var(--color-border)]">
        <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-sync)]" />
        <span className="text-sm font-semibold text-[var(--color-sync)]">
          Sync
        </span>
      </div>

      <Field label="Name">
        <input
          className={inputBaseClass}
          value={data.label || ""}
          onChange={(e) => onUpdate({ label: e.target.value })}
          placeholder="Sync name"
        />
      </Field>

      <Field label="Description">
        <textarea
          className={`${inputBaseClass} resize-none`}
          rows={2}
          value={data.description || ""}
          onChange={(e) => onUpdate({ description: e.target.value })}
          placeholder="What does this sync do?"
        />
      </Field>

      <Field label="Endpoint">
        <input
          className={inputBaseClass}
          value={data.endpoint || ""}
          onChange={(e) => onUpdate({ endpoint: e.target.value })}
          placeholder="/api/resource"
        />
      </Field>

      <Field label="Method">
        <select
          className={inputBaseClass}
          value={data.method || "GET"}
          onChange={(e) => onUpdate({ method: e.target.value })}
        >
          {METHODS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Frequency">
        <select
          className={inputBaseClass}
          value={data.frequency || "1d"}
          onChange={(e) => onUpdate({ frequency: e.target.value })}
        >
          {FREQUENCIES.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Output Model">
        <input
          className={inputBaseClass}
          value={data.modelRef || ""}
          onChange={(e) => onUpdate({ modelRef: e.target.value })}
          placeholder="Model name"
        />
      </Field>

      <FunctionCodeViewer nodeType="sync" data={data} />
    </div>
  );
}
