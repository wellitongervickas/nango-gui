import { useState, useRef, useEffect, useCallback } from "react";
import { useSettingsStore } from "../../store/settingsStore";
import {
  ENVIRONMENTS,
  getEnvironmentEntry,
  syncEnvironmentUrlParam,
  type EnvironmentEntry,
} from "../../store/environmentStore";
import { cn } from "../../lib/utils";
import { navigate } from "../../lib/router";
import type { NangoEnvironment } from "@nango-gui/shared";

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      className="animate-spin"
      aria-hidden="true"
    >
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

function EnvironmentDot({ color, className }: { color: string; className?: string }) {
  return (
    <span
      className={cn("inline-block rounded-full shrink-0", className)}
      style={{ backgroundColor: color, width: 8, height: 8 }}
      aria-hidden="true"
    />
  );
}

function ProdConfirmation({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  return (
    <div className="p-3 border-t border-[var(--color-border)]">
      <p className="text-xs font-medium text-[var(--color-text)] mb-1">
        Switch to Production?
      </p>
      <p className="text-xs text-[var(--color-text-muted)] mb-3">
        You are about to operate in the live production environment.
      </p>
      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          className="px-3 py-1 text-xs rounded-md border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-bg-raised)] transition-colors cursor-pointer"
        >
          Cancel
        </button>
        <button
          ref={confirmRef}
          onClick={onConfirm}
          className="px-3 py-1 text-xs rounded-md bg-[var(--color-env-production)] text-white hover:opacity-90 transition-colors cursor-pointer"
        >
          Switch to Prod
        </button>
      </div>
    </div>
  );
}

export function EnvironmentSwitcher() {
  const environment = useSettingsStore((s) => s.environment);
  const updateEnvironment = useSettingsStore((s) => s.updateEnvironment);

  const [open, setOpen] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [confirmingProd, setConfirmingProd] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const currentEntry = getEnvironmentEntry(environment);
  const isSingleEnv = ENVIRONMENTS.length <= 1;

  // Keep URL param in sync with current environment
  useEffect(() => {
    syncEnvironmentUrlParam(environment);
  }, [environment]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setConfirmingProd(false);
        setFocusedIndex(-1);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const doSwitch = useCallback(
    async (env: NangoEnvironment) => {
      setIsSwitching(true);
      try {
        await updateEnvironment(env);
      } catch {
        // settingsStore handles rollback internally
      } finally {
        setIsSwitching(false);
      }
    },
    [updateEnvironment]
  );

  const handleSelect = useCallback(
    (env: NangoEnvironment) => {
      if (env === environment) {
        setOpen(false);
        setFocusedIndex(-1);
        return;
      }
      if (env === "production") {
        setConfirmingProd(true);
        return;
      }
      doSwitch(env);
      setOpen(false);
      setFocusedIndex(-1);
    },
    [environment, doSwitch]
  );

  const handleConfirmProd = useCallback(() => {
    setConfirmingProd(false);
    doSwitch("production");
    setOpen(false);
    setFocusedIndex(-1);
  }, [doSwitch]);

  const handleCancelProd = useCallback(() => {
    setConfirmingProd(false);
  }, []);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!open) {
        if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setOpen(true);
          setFocusedIndex(0);
        }
        return;
      }

      switch (e.key) {
        case "Escape":
          e.preventDefault();
          setOpen(false);
          setConfirmingProd(false);
          setFocusedIndex(-1);
          buttonRef.current?.focus();
          break;
        case "ArrowDown":
          e.preventDefault();
          setFocusedIndex((prev) => Math.min(prev + 1, ENVIRONMENTS.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setFocusedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case "Enter":
        case " ":
          e.preventDefault();
          if (focusedIndex >= 0 && focusedIndex < ENVIRONMENTS.length) {
            handleSelect(ENVIRONMENTS[focusedIndex].name);
          }
          break;
        case "Home":
          e.preventDefault();
          setFocusedIndex(0);
          break;
        case "End":
          e.preventDefault();
          setFocusedIndex(ENVIRONMENTS.length - 1);
          break;
      }
    },
    [open, focusedIndex, handleSelect]
  );

  // Scroll focused item into view
  useEffect(() => {
    if (focusedIndex < 0 || !listRef.current) return;
    const items = listRef.current.querySelectorAll("[role='option']");
    items[focusedIndex]?.scrollIntoView({ block: "nearest" });
  }, [focusedIndex]);

  return (
    <div ref={containerRef} className="relative" onKeyDown={handleKeyDown}>
      {/* Badge button */}
      <button
        ref={buttonRef}
        onClick={() => {
          if (isSingleEnv) return;
          setOpen((v) => !v);
          if (!open) setFocusedIndex(-1);
        }}
        disabled={isSingleEnv}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Current environment: ${currentEntry.label}`}
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md transition-colors",
          isSingleEnv
            ? "cursor-default text-[var(--color-text-muted)]"
            : "cursor-pointer hover:bg-[var(--color-bg-raised)] text-[var(--color-text)]",
          open && "bg-[var(--color-bg-raised)]"
        )}
      >
        {isSwitching ? (
          <SpinnerIcon />
        ) : (
          <EnvironmentDot color={currentEntry.color} />
        )}

        {/* Full label >=1024px */}
        <span className="hidden lg:inline">
          {isSwitching ? "Switching..." : currentEntry.label}
        </span>
        {/* Abbreviated 768-1023px */}
        <span className="hidden md:inline lg:hidden">
          {isSwitching ? "..." : currentEntry.shortLabel}
        </span>
        {/* Icon-only <768px — dot is shown, no text */}

        {!isSingleEnv && <ChevronDownIcon className={cn("transition-transform", open && "rotate-180")} />}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-1 w-56 bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-lg shadow-xl z-50 overflow-hidden">
          {/* Header (shown on mobile to display full label) */}
          <div className="px-3 py-2 border-b border-[var(--color-border)] md:hidden">
            <span className="text-xs font-medium text-[var(--color-text-muted)]">
              Switch Environment
            </span>
          </div>

          <ul
            ref={listRef}
            role="listbox"
            aria-label="Environments"
            aria-activedescendant={focusedIndex >= 0 ? `env-option-${ENVIRONMENTS[focusedIndex].name}` : undefined}
            className="py-1"
          >
            {ENVIRONMENTS.map((env, idx) => (
              <EnvironmentOption
                key={env.name}
                entry={env}
                isActive={env.name === environment}
                isFocused={idx === focusedIndex}
                onSelect={() => handleSelect(env.name)}
                onHover={() => setFocusedIndex(idx)}
              />
            ))}
          </ul>

          {/* Prod confirmation */}
          {confirmingProd && (
            <ProdConfirmation
              onConfirm={handleConfirmProd}
              onCancel={handleCancelProd}
            />
          )}

          {/* Manage environments link */}
          <div className="border-t border-[var(--color-border)]">
            <button
              onClick={() => {
                setOpen(false);
                setFocusedIndex(-1);
                navigate("settings");
              }}
              className="w-full px-3 py-2 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-raised)] transition-colors cursor-pointer text-left flex items-center gap-1.5"
            >
              <GearSmallIcon />
              Manage environments
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function GearSmallIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EnvironmentOption({
  entry,
  isActive,
  isFocused,
  onSelect,
  onHover,
}: {
  entry: EnvironmentEntry;
  isActive: boolean;
  isFocused: boolean;
  onSelect: () => void;
  onHover: () => void;
}) {
  return (
    <li
      id={`env-option-${entry.name}`}
      role="option"
      aria-selected={isActive}
      onClick={onSelect}
      onMouseEnter={onHover}
      className={cn(
        "flex items-center gap-2 px-3 py-2 text-xs cursor-pointer transition-colors",
        isFocused && "bg-[var(--color-bg-raised)]",
        isActive
          ? "text-[var(--color-text)] font-medium"
          : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
      )}
    >
      <EnvironmentDot color={entry.color} />
      <span className="flex-1">{entry.label}</span>
      {isActive && (
        <span className="text-[var(--color-env-production)]">
          <CheckIcon />
        </span>
      )}
    </li>
  );
}
