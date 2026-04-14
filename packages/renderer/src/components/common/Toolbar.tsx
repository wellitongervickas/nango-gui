import { useProjectStore } from "../../store/projectStore";

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

export function Toolbar() {
  const project = useProjectStore((s) => s.project);
  const isDirty = useProjectStore((s) => s.isDirty);
  const currentRoute = window.location.hash.replace(/^#\/?/, "") || "/";

  function handleSettingsClick() {
    if (currentRoute === "settings") {
      window.location.hash = "/";
    } else {
      window.location.hash = "/settings";
    }
  }

  return (
    <header className="h-12 bg-[var(--color-surface)] border-b border-[var(--color-border)] flex items-center px-4 gap-4 shrink-0">
      <h1 className="text-sm font-semibold text-[var(--color-text)]">
        Nango Builder
      </h1>
      {project && (
        <span className="text-xs text-[var(--color-text-muted)]">
          {project.name}
          {isDirty && " *"}
        </span>
      )}
      <div className="flex-1" />
      {currentRoute !== "settings" && (
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
        onClick={handleSettingsClick}
        aria-label="Settings"
        className="flex items-center justify-center w-8 h-8 rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)] transition-colors cursor-pointer"
      >
        <GearIcon />
      </button>
    </header>
  );
}
