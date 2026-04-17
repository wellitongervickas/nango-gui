import { useState } from "react";
import type { ModelNodeData, ModelField } from "../../types/flow";
import { inputBaseClass } from "../../lib/utils";

interface Props {
  data: ModelNodeData;
  onUpdate: (data: Partial<ModelNodeData>) => void;
}

const FIELD_TYPES = [
  "string",
  "number",
  "boolean",
  "Date",
  "string[]",
  "number[]",
  "object",
];

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
      {children}
    </label>
  );
}


export function ModelProperties({ data, onUpdate }: Props) {
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("string");
  const [newOptional, setNewOptional] = useState(false);

  const fields = data.fields ?? [];

  function updateField(index: number, partial: Partial<ModelField>) {
    onUpdate({
      fields: fields.map((f, i) => (i === index ? { ...f, ...partial } : f)),
    });
  }

  function removeField(index: number) {
    onUpdate({ fields: fields.filter((_, i) => i !== index) });
  }

  function moveField(index: number, dir: -1 | 1) {
    const updated = [...fields];
    const target = index + dir;
    if (target < 0 || target >= updated.length) return;
    [updated[index], updated[target]] = [updated[target], updated[index]];
    onUpdate({ fields: updated });
  }

  function addField() {
    if (!newName.trim()) return;
    onUpdate({
      fields: [
        ...fields,
        { name: newName.trim(), type: newType, optional: newOptional },
      ],
    });
    setNewName("");
    setNewOptional(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 pb-3 border-b border-[var(--color-border)]">
        <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-model)]" />
        <span className="text-sm font-semibold text-[var(--color-model)]">
          Model
        </span>
      </div>

      <div className="flex flex-col gap-1">
        <Label>Name</Label>
        <input
          className={inputBaseClass}
          value={data.label || ""}
          onChange={(e) => onUpdate({ label: e.target.value })}
          placeholder="Model name"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label>Fields ({fields.length})</Label>

        {fields.length > 0 && (
          <div className="space-y-1">
            {fields.map((f, i) => (
              <div
                key={i}
                className="flex items-center gap-1.5 p-1.5 bg-[var(--color-bg)] border border-[var(--color-border)] rounded text-xs"
              >
                <div className="flex flex-col">
                  <button
                    onClick={() => moveField(i, -1)}
                    disabled={i === 0}
                    className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] disabled:opacity-25 leading-none cursor-pointer disabled:cursor-default text-[8px]"
                  >
                    ▲
                  </button>
                  <button
                    onClick={() => moveField(i, 1)}
                    disabled={i === fields.length - 1}
                    className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] disabled:opacity-25 leading-none cursor-pointer disabled:cursor-default text-[8px]"
                  >
                    ▼
                  </button>
                </div>
                <input
                  className="flex-1 bg-transparent text-[var(--color-text)] focus:outline-none min-w-0 text-xs"
                  value={f.name}
                  onChange={(e) => updateField(i, { name: e.target.value })}
                />
                <select
                  className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-1 py-0.5 text-[var(--color-text-muted)] text-xs focus:outline-none"
                  value={f.type}
                  onChange={(e) => updateField(i, { type: e.target.value })}
                >
                  {FIELD_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-0.5 text-[var(--color-text-muted)] cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={f.optional}
                    onChange={(e) =>
                      updateField(i, { optional: e.target.checked })
                    }
                    className="w-3 h-3 cursor-pointer"
                  />
                  <span className="text-[10px]">?</span>
                </label>
                <button
                  onClick={() => removeField(i)}
                  className="text-red-400 hover:text-red-300 cursor-pointer shrink-0 leading-none"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-1.5 pt-1 border-t border-[var(--color-border)]">
          <input
            className={`${inputBaseClass} text-xs`}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addField()}
            placeholder="New field name"
          />
          <div className="flex gap-1.5 items-center">
            <select
              className="flex-1 px-2 py-1.5 text-xs bg-[var(--color-bg)] border border-[var(--color-border)] rounded text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)]"
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
            >
              {FIELD_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1 text-xs text-[var(--color-text-muted)] cursor-pointer whitespace-nowrap shrink-0">
              <input
                type="checkbox"
                checked={newOptional}
                onChange={(e) => setNewOptional(e.target.checked)}
                className="w-3 h-3 cursor-pointer"
              />
              Optional
            </label>
          </div>
          <button
            onClick={addField}
            disabled={!newName.trim()}
            className="w-full py-1.5 text-xs bg-[var(--color-model)]/20 border border-[var(--color-model)]/30 text-[var(--color-model)] rounded hover:bg-[var(--color-model)]/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            + Add Field
          </button>
        </div>
      </div>
    </div>
  );
}
