import { useState, useCallback } from "react";

// ── Tour steps ────────────────────────────────────────────────────────────

interface TourStep {
  title: string;
  description: string;
  route: string | null;
  cta: string | null;
}

const STEPS: TourStep[] = [
  {
    title: "Welcome to Nango Builder",
    description:
      "A visual desktop interface to build, monitor, and manage your Nango integrations. This quick tour walks you through the key features.",
    route: null,
    cta: null,
  },
  {
    title: "Dashboard",
    description:
      "Your integration health at a glance — active connections, sync status distribution, top connections, and recent errors. Auto-refreshes every 60 seconds.",
    route: "dashboard",
    cta: "Go to Dashboard",
  },
  {
    title: "Connections",
    description:
      "Browse all OAuth connections linked to your Nango account. Each connection represents an end-user's authorized access to a third-party service.",
    route: "connections",
    cta: "View Connections",
  },
  {
    title: "Syncs",
    description:
      "Monitor and control your background data syncs. Pause, resume, or trigger syncs on demand. Filter by status to find issues quickly.",
    route: "syncs",
    cta: "View Syncs",
  },
  {
    title: "Canvas",
    description:
      "Build integration flows visually using the drag-and-drop canvas. Connect services and define data pipelines without leaving your desktop.",
    route: "canvas",
    cta: "Open Canvas",
  },
];

const STORAGE_KEY = "nango-tour-dismissed";

// ── Icons ─────────────────────────────────────────────────────────────────

function CloseIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function ArrowLeftIcon() {
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
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </svg>
  );
}

function ArrowRightIcon() {
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
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
    </svg>
  );
}

// ── Step dots ─────────────────────────────────────────────────────────────

function StepDots({
  total,
  current,
}: {
  total: number;
  current: number;
}) {
  return (
    <div className="flex items-center gap-1.5" aria-hidden="true">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={
            i === current
              ? "w-4 h-1.5 rounded-full bg-[var(--color-primary)] transition-all"
              : i < current
              ? "w-1.5 h-1.5 rounded-full bg-[var(--color-primary)]/50 transition-all"
              : "w-1.5 h-1.5 rounded-full bg-[var(--color-border)] transition-all"
          }
        />
      ))}
    </div>
  );
}

// ── Tour card ─────────────────────────────────────────────────────────────

interface WalkthroughTourProps {
  /** Call this to close the tour from outside (e.g. Toolbar unmounts it) */
  onClose: () => void;
}

export function WalkthroughTour({ onClose }: WalkthroughTourProps) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const isFirst = step === 0;
  const isLast = step === STEPS.length - 1;

  const dismiss = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, "1");
    onClose();
  }, [onClose]);

  function handleCta() {
    if (current.route) {
      window.location.hash = `/${current.route}`;
    }
  }

  function handleNext() {
    if (isLast) {
      dismiss();
    } else {
      setStep((s) => s + 1);
    }
  }

  function handlePrev() {
    setStep((s) => Math.max(0, s - 1));
  }

  return (
    <>
      {/* Backdrop — lets pointer events pass through so user can still interact */}
      <div
        className="fixed inset-0 bg-black/20 z-40 pointer-events-none"
        aria-hidden="true"
      />

      {/* Tour card */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Tour step ${step + 1} of ${STEPS.length}: ${current.title}`}
        className="fixed bottom-12 right-6 z-50 w-80 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] shadow-xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-2 text-[var(--color-primary)]">
            <SparkleIcon />
            <span className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
              Quick Tour
            </span>
          </div>
          <button
            onClick={dismiss}
            aria-label="Close tour"
            className="flex items-center justify-center w-6 h-6 rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-overlay)] transition-colors cursor-pointer"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Content */}
        <div className="px-4 py-4 space-y-3">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] leading-snug">
            {current.title}
          </h3>
          <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
            {current.description}
          </p>
          {current.cta && (
            <button
              onClick={handleCta}
              className="text-xs text-[var(--color-primary)] hover:underline cursor-pointer"
            >
              {current.cta} →
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 pb-4 pt-1">
          <StepDots total={STEPS.length} current={step} />
          <div className="flex items-center gap-2">
            {!isFirst && (
              <button
                onClick={handlePrev}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-md border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-overlay)] transition-colors cursor-pointer"
              >
                <ArrowLeftIcon />
                Prev
              </button>
            )}
            <button
              onClick={handleNext}
              className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-md bg-[var(--color-primary)] text-white hover:opacity-90 transition-opacity cursor-pointer"
            >
              {isLast ? "Done" : (
                <>
                  Next
                  <ArrowRightIcon />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Hook — call in App to auto-show on first launch ───────────────────────

export function useTourAutoShow(): boolean {
  return localStorage.getItem(STORAGE_KEY) !== "1";
}
