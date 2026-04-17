import { useState } from "react";
import type { TransformNodeData, FieldMapping } from "../../types/flow";
import { inputBaseClass } from "../../lib/utils";

interface Props {
  data: TransformNodeData;
  onUpdate: (data: Partial<TransformNodeData>) => void;
}

const TRANSFORM_TYPES: FieldMapping["transform"][] = [
  "direct",
  "rename",
  "cast",
  "template",
];

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
      {children}
    </label>
  );
}


export function TransformProperties({ data, onUpdate }: Props) {
  const [newSource, setNewSource] = useState("");
  const [newTarget, setNewTarget] = useState("");
  const [newTransform, setNewTransform] =
    useState<FieldMapping["transform"]>("direct");

  const mappings = data.mappings ?? [];

  function updateMapping(index: number, partial: Partial<FieldMapping>) {
    onUpdate({
      mappings: mappings.map((m, i) =>
        i === index ? { ...m, ...partial } : m,
      ),
    });
  }

  function removeMapping(index: number) {
    onUpdate({ mappings: mappings.filter((_, i) => i !== index) });
  }

  function addMapping() {
    if (!newSource.trim() || !newTarget.trim()) return;
    onUpdate({
      mappings: [
        ...mappings,
        {
          sourceField: newSource.trim(),
          targetField: newTarget.trim(),
          transform: newTransform,
        },
      ],
    });
    setNewSource("");
    setNewTarget("");
    setNewTransform("direct");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 pb-3 border-b border-[var(--color-border)]">
        <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-transform)]" />
        <span className="text-sm font-semibold text-[var(--color-transform)]">
          Transform
        </span>
      </div>

      <div className="flex flex-col gap-1">
        <Label>Name</Label>
        <input
          className={inputBaseClass}
          value={data.label || ""}
          onChange={(e) => onUpdate({ label: e.target.value })}
          placeholder="Transform name"
        />
      </div>

      <div className="flex flex-col gap-1">
        <Label>Description</Label>
        <textarea
          className={`${inputBaseClass} resize-none`}
          rows={2}
          value={data.description || ""}
          onChange={(e) => onUpdate({ description: e.target.value })}
          placeholder="What does this transform do?"
        />
      </div>

      <div className="flex gap-2">
        <div className="flex flex-col gap-1 flex-1">
          <Label>Input Model</Label>
          <input
            className={inputBaseClass}
            value={data.inputModelRef || ""}
            onChange={(e) => onUpdate({ inputModelRef: e.target.value })}
            placeholder="Source model"
          />
        </div>
        <div className="flex flex-col gap-1 flex-1">
          <Label>Output Model</Label>
          <input
            className={inputBaseClass}
            value={data.outputModelRef || ""}
            onChange={(e) => onUpdate({ outputModelRef: e.target.value })}
            placeholder="Target model"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Field Mappings ({mappings.length})</Label>

        {mappings.length > 0 && (
          <div className="space-y-1">
            {mappings.map((m, i) => (
              <div
                key={i}
                className="flex items-center gap-1.5 p-1.5 bg-[var(--color-bg)] border border-[var(--color-border)] rounded text-xs"
              >
                <input
                  className="flex-1 bg-transparent text-[var(--color-text)] focus:outline-none min-w-0 text-xs"
                  value={m.sourceField}
                  onChange={(e) =>
                    updateMapping(i, { sourceField: e.target.value })
                  }
                  placeholder="source"
                />
                <select
                  className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-1 py-0.5 text-[var(--color-text-muted)] text-xs focus:outline-none shrink-0"
                  value={m.transform}
                  onChange={(e) =>
                    updateMapping(i, {
                      transform: e.target.value as FieldMapping["transform"],
                    })
                  }
                >
                  {TRANSFORM_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <input
                  className="flex-1 bg-transparent text-[var(--color-text)] focus:outline-none min-w-0 text-xs"
                  value={m.targetField}
                  onChange={(e) =>
                    updateMapping(i, { targetField: e.target.value })
                  }
                  placeholder="target"
                />
                <button
                  onClick={() => removeMapping(i)}
                  className="text-red-400 hover:text-red-300 cursor-pointer shrink-0 leading-none"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-1.5 pt-1 border-t border-[var(--color-border)]">
          <div className="flex gap-1.5">
            <input
              className={`${inputBaseClass} text-xs flex-1`}
              value={newSource}
              onChange={(e) => setNewSource(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addMapping()}
              placeholder="Source field"
            />
            <input
              className={`${inputBaseClass} text-xs flex-1`}
              value={newTarget}
              onChange={(e) => setNewTarget(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addMapping()}
              placeholder="Target field"
            />
          </div>
          <select
            className="w-full px-2 py-1.5 text-xs bg-[var(--color-bg)] border border-[var(--color-border)] rounded text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)]"
            value={newTransform}
            onChange={(e) =>
              setNewTransform(e.target.value as FieldMapping["transform"])
            }
          >
            {TRANSFORM_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <button
            onClick={addMapping}
            disabled={!newSource.trim() || !newTarget.trim()}
            className="w-full py-1.5 text-xs bg-[var(--color-transform)]/20 border border-[var(--color-transform)]/30 text-[var(--color-transform)] rounded hover:bg-[var(--color-transform)]/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            + Add Mapping
          </button>
        </div>
      </div>
    </div>
  );
}
