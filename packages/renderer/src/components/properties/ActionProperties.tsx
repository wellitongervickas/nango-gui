import type { ActionNodeData } from "../../types/flow";
import { FunctionCodeViewer } from "./FunctionCodeViewer";

interface Props {
  data: ActionNodeData;
  onUpdate: (data: Partial<ActionNodeData>) => void;
}

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

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

const inputCls =
  "w-full px-2.5 py-1.5 text-sm bg-[var(--color-bg)] border border-[var(--color-border)] rounded text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)] transition-colors";

export function ActionProperties({ data, onUpdate }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 pb-3 border-b border-[var(--color-border)]">
        <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-action)]" />
        <span className="text-sm font-semibold text-[var(--color-action)]">
          Action
        </span>
      </div>

      <Field label="Name">
        <input
          className={inputCls}
          value={data.label || ""}
          onChange={(e) => onUpdate({ label: e.target.value })}
          placeholder="Action name"
        />
      </Field>

      <Field label="Endpoint">
        <input
          className={inputCls}
          value={data.endpoint || ""}
          onChange={(e) => onUpdate({ endpoint: e.target.value })}
          placeholder="/api/resource"
        />
      </Field>

      <Field label="Method">
        <select
          className={inputCls}
          value={data.method || "POST"}
          onChange={(e) => onUpdate({ method: e.target.value })}
        >
          {METHODS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Input Model">
        <input
          className={inputCls}
          value={data.inputModelRef || ""}
          onChange={(e) => onUpdate({ inputModelRef: e.target.value })}
          placeholder="Input model name"
        />
      </Field>

      <Field label="Output Model">
        <input
          className={inputCls}
          value={data.outputModelRef || ""}
          onChange={(e) => onUpdate({ outputModelRef: e.target.value })}
          placeholder="Output model name"
        />
      </Field>

      <FunctionCodeViewer nodeType="action" data={data} />
    </div>
  );
}
