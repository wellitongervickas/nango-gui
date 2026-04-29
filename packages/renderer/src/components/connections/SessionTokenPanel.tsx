import { useEffect, useMemo, useState } from "react";
import { CopyIcon, ExternalLinkIcon } from "@/components/icons";

interface SessionTokenPanelProps {
  token: string;
  connectLink: string;
  /** ISO timestamp at which the token expires. */
  expiresAt: string;
  /** Optional CTA rendered after the token rows (e.g. "Open Connect UI"). */
  action?: React.ReactNode;
}

/** "expires in 30m" / "expired 5m ago" */
function formatRelativeExpiry(expiresAt: string, now: number): string {
  const target = new Date(expiresAt).getTime();
  if (Number.isNaN(target)) return "unknown expiry";
  const diffMs = target - now;
  const past = diffMs < 0;
  const abs = Math.abs(diffMs);
  const mins = Math.round(abs / 60_000);
  if (mins < 1) return past ? "expired just now" : "expires in <1m";
  if (mins < 60) return past ? `expired ${mins}m ago` : `expires in ${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return past ? `expired ${hours}h ago` : `expires in ${hours}h`;
  const days = Math.round(hours / 24);
  return past ? `expired ${days}d ago` : `expires in ${days}d`;
}

function formatAbsoluteExpiry(expiresAt: string): string {
  const d = new Date(expiresAt);
  if (Number.isNaN(d.getTime())) return expiresAt;
  return d.toLocaleString();
}

/**
 * Displays the result of POST /connect/sessions: the short-lived token and
 * the hosted Connect link, each with copy-to-clipboard, plus relative +
 * absolute expiry timestamps.
 */
export function SessionTokenPanel({
  token,
  connectLink,
  expiresAt,
  action,
}: SessionTokenPanelProps) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const relative = useMemo(() => formatRelativeExpiry(expiresAt, now), [expiresAt, now]);
  const absolute = useMemo(() => formatAbsoluteExpiry(expiresAt), [expiresAt]);
  const expired = useMemo(() => new Date(expiresAt).getTime() < now, [expiresAt, now]);

  return (
    <div className="space-y-3">
      <CopyableField label="Session token" value={token} mono mask />
      {connectLink ? (
        <CopyableField
          label="Connect link"
          value={connectLink}
          href={connectLink}
        />
      ) : null}

      <div className="flex items-center justify-between text-xs text-[var(--color-text-secondary)]">
        <span
          className={
            expired
              ? "text-[var(--color-error)] font-medium"
              : "text-[var(--color-text-secondary)]"
          }
        >
          {relative}
        </span>
        <time dateTime={expiresAt} title={expiresAt}>
          {absolute}
        </time>
      </div>

      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}

function CopyableField({
  label,
  value,
  mono,
  mask,
  href,
}: {
  label: string;
  value: string;
  mono?: boolean;
  /** When true, hide the value behind a "Show" toggle (for tokens). */
  mask?: boolean;
  /** When set, render an "Open" external-link button alongside copy. */
  href?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState(!mask);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access denied — fall back to selecting the text.
    }
  }

  const display = revealed ? value : value.replace(/./g, "•");

  return (
    <div>
      <label className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
        {label}
      </label>
      <div className="mt-1 flex gap-2 items-stretch">
        <div
          className={`flex-1 min-w-0 px-2.5 py-1.5 text-sm bg-[var(--color-bg-base)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] truncate ${mono ? "font-mono" : ""}`}
          title={value}
        >
          {display || <span className="opacity-50">—</span>}
        </div>
        {mask ? (
          <button
            type="button"
            onClick={() => setRevealed((r) => !r)}
            className="px-2 text-xs rounded-md border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-base)] transition-colors cursor-pointer"
          >
            {revealed ? "Hide" : "Show"}
          </button>
        ) : null}
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="px-2 flex items-center rounded-md border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-base)] transition-colors"
            aria-label={`Open ${label}`}
          >
            <ExternalLinkIcon />
          </a>
        ) : null}
        <button
          type="button"
          onClick={handleCopy}
          aria-label={`Copy ${label}`}
          className="px-2 flex items-center gap-1 rounded-md border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-base)] transition-colors cursor-pointer"
        >
          <CopyIcon />
          <span className="text-xs">{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
    </div>
  );
}
