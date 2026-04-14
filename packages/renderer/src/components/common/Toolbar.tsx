import { useProjectStore } from "../../store/projectStore";

export function Toolbar() {
  const project = useProjectStore((s) => s.project);
  const isDirty = useProjectStore((s) => s.isDirty);

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
      <button className="px-3 py-1.5 text-xs rounded-md bg-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-text-muted)]/20 transition-colors cursor-pointer">
        Save
      </button>
      <button className="px-3 py-1.5 text-xs rounded-md bg-[var(--color-primary)] text-white hover:opacity-90 transition-opacity cursor-pointer">
        Deploy
      </button>
    </header>
  );
}
