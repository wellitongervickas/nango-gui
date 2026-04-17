import type { TriggerNodeData } from "../../types/flow";
import { inputBaseClass } from "../../lib/utils";

interface Props {
  data: TriggerNodeData;
  onUpdate: (data: Partial<TriggerNodeData>) => void;
}

const FREQUENCIES = ["1m", "5m", "15m", "30m", "1h", "6h", "12h", "1d", "7d"];

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


export function TriggerProperties({ data, onUpdate }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 pb-3 border-b border-[var(--color-border)]">
        <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-trigger)]" />
        <span className="text-sm font-semibold text-[var(--color-trigger)]">
          Trigger
        </span>
      </div>

      <Field label="Name">
        <input
          className={inputBaseClass}
          value={data.label || ""}
          onChange={(e) => onUpdate({ label: e.target.value })}
          placeholder="Trigger name"
        />
      </Field>

      <Field label="Description">
        <textarea
          className={`${inputBaseClass} resize-none`}
          rows={2}
          value={data.description || ""}
          onChange={(e) => onUpdate({ description: e.target.value })}
          placeholder="What does this trigger do?"
        />
      </Field>

      <Field label="Frequency">
        <select
          className={inputBaseClass}
          value={data.frequency || "1h"}
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
    </div>
  );
}
