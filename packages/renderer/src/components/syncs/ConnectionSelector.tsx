import { useEffect, useRef, useState } from "react";
import type { NangoConnectionSummary } from "@nango-gui/shared";
import { ChevronDownIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

export function ConnectionSelector({
  connections,
  selectedId,
  onSelect,
}: {
  connections: NangoConnectionSummary[];
  selectedId: string | null;
  onSelect: (conn: NangoConnectionSummary) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selected = connections.find(
    (c) => `${c.provider_config_key}:${c.connection_id}` === selectedId
  );

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-base)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-overlay)] transition-colors cursor-pointer min-w-[220px]"
      >
        <span className="truncate flex-1 text-left">
          {selected
            ? `${selected.provider_config_key} / ${selected.connection_id}`
            : "Select connection\u2026"}
        </span>
        <ChevronDownIcon />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 w-80 max-h-64 overflow-y-auto bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-lg shadow-xl z-50">
          {connections.length === 0 ? (
            <div className="px-4 py-3 text-sm text-[var(--color-text-secondary)]">
              No connections available
            </div>
          ) : (
            connections.map((conn) => {
              const key = `${conn.provider_config_key}:${conn.connection_id}`;
              return (
                <button
                  key={key}
                  onClick={() => { onSelect(conn); setOpen(false); }}
                  className={cn(
                    "w-full text-left px-4 py-2.5 text-sm hover:bg-[var(--color-bg-overlay)] transition-colors cursor-pointer flex items-center gap-3 border-b border-[var(--color-border)] last:border-0",
                    key === selectedId && "bg-[var(--color-brand-500)]/10"
                  )}
                >
                  <div className="w-7 h-7 rounded-md bg-[var(--color-bg-overlay)] flex items-center justify-center text-[10px] font-semibold text-[var(--color-text-secondary)] uppercase shrink-0">
                    {(conn.provider_config_key[0] ?? "?").toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                      {conn.provider_config_key}
                    </p>
                    <p className="text-xs text-[var(--color-text-secondary)] font-mono truncate">
                      {conn.connection_id}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
