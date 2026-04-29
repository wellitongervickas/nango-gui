import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { SpinnerIcon, XIcon } from "@/components/icons";

// ── Types ─────────────────────────────────────────────────────────────────

interface TagsSectionProps {
  /** Current tags as key-value record (key = tag label). */
  tags: Record<string, string> | null;
  /** All tags across the environment for autocomplete suggestions. */
  allTags: string[];
  /** How many connections share a given tag (for removal confirmation). */
  tagUsageCounts: Record<string, number>;
  onSave: (newTags: Record<string, string>) => Promise<void>;
}

// ── Confirm dialog ────────────────────────────────────────────────────────

interface ConfirmRemoveDialogProps {
  tagName: string;
  usageCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmRemoveDialog({ tagName, usageCount, onConfirm, onCancel }: ConfirmRemoveDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-xl shadow-2xl w-full max-w-sm p-6 mx-4">
        <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-2">
          Remove tag?
        </h2>
        <p className="text-sm text-[var(--color-text-secondary)] mb-5">
          The tag{" "}
          <span className="font-mono bg-[var(--color-bg-overlay)] px-1.5 py-0.5 rounded text-xs text-[var(--color-text-primary)]">
            {tagName}
          </span>{" "}
          is used on{" "}
          <span className="font-semibold text-[var(--color-text-primary)]">{usageCount}</span>{" "}
          connections. Removing it from this connection will not affect the others.
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm rounded-lg border border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-overlay)] transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm rounded-lg bg-[var(--color-error)] text-white hover:opacity-90 transition-opacity cursor-pointer"
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Tag chip ──────────────────────────────────────────────────────────────

interface TagChipProps {
  label: string;
  onRemove: () => void;
  onRename: (newLabel: string) => void;
  isSaving: boolean;
}

function TagChip({ label, onRemove, onRename, isSaving }: TagChipProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(label);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleClickLabel() {
    if (isSaving) return;
    setDraft(label);
    setIsEditing(true);
  }

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      commitRename();
    } else if (e.key === "Escape") {
      setIsEditing(false);
      setDraft(label);
    }
  }

  function commitRename() {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== label) {
      onRename(trimmed);
    }
    setIsEditing(false);
  }

  if (isEditing) {
    return (
      <span className="inline-flex items-center gap-1 text-xs rounded-full border border-[var(--color-brand-500)] bg-[var(--color-brand-500)]/10 px-2 py-0.5">
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={commitRename}
          className="bg-transparent outline-none text-[var(--color-text-primary)] w-24 min-w-0"
          style={{ width: `${Math.max(draft.length, 3) + 2}ch` }}
        />
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-xs rounded-full border border-[var(--color-border)] bg-[var(--color-bg-overlay)] px-2 py-0.5 group">
      <button
        type="button"
        onClick={handleClickLabel}
        disabled={isSaving}
        className="text-[var(--color-text-primary)] hover:text-[var(--color-brand-500)] transition-colors cursor-pointer disabled:cursor-default disabled:opacity-60"
        title="Click to rename"
      >
        {label}
      </button>
      <button
        type="button"
        onClick={onRemove}
        disabled={isSaving}
        className="flex items-center justify-center text-[var(--color-text-secondary)] hover:text-[var(--color-error)] transition-colors cursor-pointer disabled:cursor-default disabled:opacity-60 opacity-0 group-hover:opacity-100"
        aria-label={`Remove tag ${label}`}
        title="Remove tag"
      >
        <XIcon />
      </button>
    </span>
  );
}

// ── Add-tag input ─────────────────────────────────────────────────────────

interface AddTagInputProps {
  existingTags: string[];
  suggestions: string[];
  onAdd: (tag: string) => void;
  disabled: boolean;
}

function AddTagInput({ existingTags, suggestions, onAdd, disabled }: AddTagInputProps) {
  const [value, setValue] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredSuggestions = suggestions.filter(
    (s) => !existingTags.includes(s) && s.toLowerCase().includes(value.toLowerCase().trim())
  );

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      commitAdd(value);
    } else if (e.key === "Escape") {
      setValue("");
      setShowSuggestions(false);
    }
  }

  function commitAdd(tag: string) {
    const trimmed = tag.trim();
    if (trimmed && !existingTags.includes(trimmed)) {
      onAdd(trimmed);
      setValue("");
      setShowSuggestions(false);
    }
  }

  // Close on outside click
  useEffect(() => {
    if (!showSuggestions) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    window.addEventListener("mousedown", handleClick);
    return () => window.removeEventListener("mousedown", handleClick);
  }, [showSuggestions]);

  return (
    <div ref={containerRef} className="relative inline-block">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setShowSuggestions(true);
        }}
        onFocus={() => setShowSuggestions(true)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder="Add tag…"
        className={cn(
          "text-xs px-2.5 py-0.5 rounded-full border border-dashed outline-none transition-colors",
          "border-[var(--color-border)] text-[var(--color-text-secondary)]",
          "focus:border-[var(--color-brand-500)] focus:text-[var(--color-text-primary)]",
          "placeholder:text-[var(--color-text-disabled)]",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          "w-28"
        )}
      />
      {showSuggestions && filteredSuggestions.length > 0 && (
        <div
          className="absolute top-full left-0 mt-1 w-44 bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-lg shadow-xl z-20 py-1 max-h-40 overflow-y-auto"
          onMouseDown={(e) => e.preventDefault()}
        >
          {filteredSuggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => commitAdd(s)}
              className="w-full text-left px-3 py-1.5 text-xs text-[var(--color-text-primary)] hover:bg-[var(--color-bg-overlay)] transition-colors cursor-pointer"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── TagsSection ───────────────────────────────────────────────────────────

export function TagsSection({ tags, allTags, tagUsageCounts, onSave }: TagsSectionProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const tagKeys = Object.keys(tags ?? {}).sort();

  async function applyTags(newTags: Record<string, string>) {
    setIsSaving(true);
    setSaveError(null);
    try {
      await onSave(newTags);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save tags");
    } finally {
      setIsSaving(false);
    }
  }

  function handleAdd(tag: string) {
    const next = { ...(tags ?? {}), [tag]: tag };
    applyTags(next);
  }

  function handleRemoveRequest(tag: string) {
    const usageCount = tagUsageCounts[tag] ?? 0;
    if (usageCount > 5) {
      setConfirmRemove(tag);
    } else {
      handleRemoveConfirmed(tag);
    }
  }

  function handleRemoveConfirmed(tag: string) {
    const next = { ...(tags ?? {}) };
    delete next[tag];
    applyTags(next);
    setConfirmRemove(null);
  }

  function handleRename(oldTag: string, newTag: string) {
    if (newTag === oldTag) return;
    const next = { ...(tags ?? {}) };
    delete next[oldTag];
    next[newTag] = newTag;
    applyTags(next);
  }

  return (
    <>
      <section className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
            Tags
          </h2>
          {isSaving && (
            <span className="flex items-center gap-1 text-xs text-[var(--color-text-secondary)]">
              <SpinnerIcon />
              Saving…
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {tagKeys.map((tag) => (
            <TagChip
              key={tag}
              label={tag}
              onRemove={() => handleRemoveRequest(tag)}
              onRename={(newLabel) => handleRename(tag, newLabel)}
              isSaving={isSaving}
            />
          ))}
          <AddTagInput
            existingTags={tagKeys}
            suggestions={allTags}
            onAdd={handleAdd}
            disabled={isSaving}
          />
        </div>

        {tagKeys.length === 0 && !isSaving && (
          <p className="text-xs text-[var(--color-text-disabled)] mt-1">
            No tags yet. Type a name and press Enter to add one.
          </p>
        )}

        {saveError && (
          <p className="text-xs text-[var(--color-error)] mt-2">{saveError}</p>
        )}
      </section>

      {confirmRemove && (
        <ConfirmRemoveDialog
          tagName={confirmRemove}
          usageCount={tagUsageCounts[confirmRemove] ?? 0}
          onConfirm={() => handleRemoveConfirmed(confirmRemove)}
          onCancel={() => setConfirmRemove(null)}
        />
      )}
    </>
  );
}
