import { useState } from "react";
import { useProjectStore } from "../../store/projectStore";
import { cn } from "../../lib/utils";
import { WalkthroughTour, useTourAutoShow } from "./WalkthroughTour";

function NavButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3 py-1 text-xs rounded-md transition-colors cursor-pointer",
        active
          ? "bg-[var(--color-bg)] text-[var(--color-text)]"
          : "text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)]/50"
      )}
    >
      {label}
    </button>
  );
}

function GearIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
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
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function HelpIcon() {
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
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <path d="M12 17h.01" />
    </svg>
  );
}

export function Toolbar() {
  const project = useProjectStore((s) => s.project);
  const isDirty = useProjectStore((s) => s.isDirty);
  const currentRoute = window.location.hash.replace(/^#\/?/, "") || "/";
  const shouldAutoShow = useTourAutoShow();
  const [tourOpen, setTourOpen] = useState(shouldAutoShow);

  const isDashboard = currentRoute === "/" || currentRoute === "dashboard";
  const isCanvas = currentRoute === "canvas";

  function navigate(route: string) {
    window.location.hash = route === "/" ? "/" : `/${route}`;
  }

  return (
    <header className="h-12 bg-[var(--color-surface)] border-b border-[var(--color-border)] flex items-center px-4 gap-1 shrink-0">
      <h1 className="text-sm font-semibold text-[var(--color-text)] mr-3">
        Nango Builder
      </h1>

      {/* Nav */}
      <nav className="flex items-center gap-0.5">
        <NavButton
          label="Dashboard"
          active={isDashboard}
          onClick={() => navigate("/")}
        />
        <NavButton
          label="Canvas"
          active={isCanvas}
          onClick={() => navigate("canvas")}
        />
        <NavButton
          label="Connections"
          active={currentRoute === "connections"}
          onClick={() => navigate("connections")}
        />
        <NavButton
          label="Syncs"
          active={currentRoute === "syncs"}
          onClick={() => navigate("syncs")}
        />
        <NavButton
          label="Records"
          active={currentRoute === "records"}
          onClick={() => navigate("records")}
        />
        <NavButton
          label="Actions"
          active={currentRoute === "actions"}
          onClick={() => navigate("actions")}
        />
        <NavButton
          label="Integrations"
          active={currentRoute === "integrations"}
          onClick={() => navigate("integrations")}
        />
        <NavButton
          label="Settings"
          active={currentRoute === "settings"}
          onClick={() => navigate("settings")}
        />
      </nav>

      {project && (
        <span className="ml-3 text-xs text-[var(--color-text-muted)]">
          {project.name}
          {isDirty && " *"}
        </span>
      )}
      <div className="flex-1" />

      {isCanvas && (
        <>
          <button className="px-3 py-1.5 text-xs rounded-md bg-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-text-muted)]/20 transition-colors cursor-pointer">
            Save
          </button>
          <button className="px-3 py-1.5 text-xs rounded-md bg-[var(--color-primary)] text-white hover:opacity-90 transition-opacity cursor-pointer">
            Deploy
          </button>
        </>
      )}

      <button
        onClick={() => setTourOpen((v) => !v)}
        aria-label="Take a tour"
        title="Take a tour"
        className={cn(
          "flex items-center justify-center w-8 h-8 rounded-md transition-colors cursor-pointer",
          tourOpen
            ? "text-[var(--color-primary)] bg-[var(--color-primary)]/10"
            : "text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)]"
        )}
      >
        <HelpIcon />
      </button>

      <button
        onClick={() => navigate("settings")}
        aria-label="Settings"
        className="flex items-center justify-center w-8 h-8 rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)] transition-colors cursor-pointer"
      >
        <GearIcon />
      </button>

      {tourOpen && <WalkthroughTour onClose={() => setTourOpen(false)} />}
    </header>
  );
}
