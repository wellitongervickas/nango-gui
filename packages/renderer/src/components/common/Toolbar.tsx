import { useState, useEffect, useCallback } from "react";
import { useProjectStore } from "../../store/projectStore";
import { useFlowStore } from "../../store/flowStore";
import { useCodePanelStore } from "../../store/codePanelStore";
import { useDryrunPanelStore } from "../../store/dryrunPanelStore";
import { useDeployPanelStore } from "../../store/deployPanelStore";
import { cn } from "../../lib/utils";
import { useHashRoute, navigate } from "../../lib/router";
import { WalkthroughTour, useTourAutoShow } from "./WalkthroughTour";
import { EnvironmentSwitcher } from "./EnvironmentSwitcher";
import { RateLimitBadge } from "../rate-limit/RateLimitBadge";
import { GearIcon, FolderOpenIcon, HelpIcon } from "@/components/icons";

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


// ── Project file format ──────────────────────────────────────────────────

const PROJECT_FILE_VERSION = 1;

interface ProjectFileData {
  version: number;
  project: {
    name: string;
    provider: string;
    authType: string;
    environment: string;
    errorHandling: { retryOn: string[]; maxRetries: number };
  };
  flow: {
    nodes: unknown[];
    edges: unknown[];
  };
}

export function Toolbar() {
  const project = useProjectStore((s) => s.project);
  const isDirty = useProjectStore((s) => s.isDirty);
  const setProject = useProjectStore((s) => s.setProject);
  const updateProject = useProjectStore((s) => s.updateProject);
  const markClean = useProjectStore((s) => s.markClean);
  const codePanelOpen = useCodePanelStore((s) => s.isOpen);
  const toggleCodePanel = useCodePanelStore((s) => s.toggle);
  const dryrunPanelOpen = useDryrunPanelStore((s) => s.isOpen);
  const toggleDryrunPanel = useDryrunPanelStore((s) => s.toggle);
  const deployPanelOpen = useDeployPanelStore((s) => s.isOpen);
  const toggleDeployPanel = useDeployPanelStore((s) => s.toggle);
  const currentRoute = useHashRoute();
  const shouldAutoShow = useTourAutoShow();
  const [tourOpen, setTourOpen] = useState(shouldAutoShow);

  const isDashboard = currentRoute === "/" || currentRoute === "dashboard";
  const isCanvas = currentRoute === "canvas";

  const saveProject = useCallback(
    async (saveAs?: boolean) => {
      let filePath = project.filePath;

      if (!filePath || saveAs) {
        const res = await window.project.showSaveDialog();
        if (res.status !== "ok" || !res.data.filePath) return;
        filePath = res.data.filePath;
      }

      const { nodes, edges } = useFlowStore.getState();
      const fileData: ProjectFileData = {
        version: PROJECT_FILE_VERSION,
        project: {
          name: project.name,
          provider: project.provider,
          authType: project.authType,
          environment: project.environment,
          errorHandling: project.errorHandling,
        },
        flow: { nodes, edges },
      };

      const writeRes = await window.project.writeFile({
        filePath,
        data: JSON.stringify(fileData, null, 2),
      });

      if (writeRes.status === "ok") {
        updateProject({ filePath, lastSaved: new Date().toISOString() });
        markClean();
      }
    },
    [project, updateProject, markClean]
  );

  const openProject = useCallback(async () => {
    const dialogRes = await window.project.showOpenDialog();
    if (dialogRes.status !== "ok" || !dialogRes.data.filePath) return;
    const filePath = dialogRes.data.filePath;

    const readRes = await window.project.readFile({ filePath });
    if (readRes.status !== "ok") return;

    const fileData = JSON.parse(readRes.data.data) as ProjectFileData;

    setProject({
      name: fileData.project.name,
      provider: fileData.project.provider,
      authType: fileData.project.authType as "oauth2" | "api_key" | "basic" | "none",
      environment: fileData.project.environment as "development" | "staging" | "production",
      errorHandling: fileData.project.errorHandling as {
        retryOn: ("4xx" | "5xx" | "timeout" | "network")[];
        maxRetries: number;
      },
      filePath,
      lastSaved: null,
    });

    const flowStore = useFlowStore.getState();
    flowStore.reset();
    const nodes = (fileData.flow.nodes ?? []) as Parameters<typeof flowStore.addNode>[0][];
    const edges = fileData.flow.edges ?? [];
    useFlowStore.setState({ nodes, edges: edges as typeof flowStore.edges });

    navigate("canvas");
  }, [setProject]);

  // Ctrl+S / Cmd+S keyboard shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        saveProject();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "o") {
        e.preventDefault();
        openProject();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [saveProject, openProject]);

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
          label="Webhooks"
          active={currentRoute === "webhooks"}
          onClick={() => navigate("webhooks")}
        />
        <NavButton
          label="Deploys"
          active={currentRoute === "deploys"}
          onClick={() => navigate("deploys")}
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

      <button
        onClick={openProject}
        aria-label="Open project"
        title="Open project (Ctrl+O)"
        className="flex items-center justify-center w-8 h-8 rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)] transition-colors cursor-pointer"
      >
        <FolderOpenIcon />
      </button>

      {isCanvas && (
        <>
          <button
            onClick={() => saveProject()}
            className={cn(
              "px-3 py-1.5 text-xs rounded-md transition-colors cursor-pointer",
              isDirty
                ? "bg-[var(--color-primary)] text-white hover:opacity-90"
                : "bg-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-text-muted)]/20"
            )}
          >
            Save{isDirty ? " *" : ""}
          </button>
          <button
            onClick={toggleDeployPanel}
            className={cn(
              "px-3 py-1.5 text-xs rounded-md transition-colors cursor-pointer",
              deployPanelOpen
                ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-medium"
                : "bg-[var(--color-primary)] text-white hover:opacity-90"
            )}
          >
            Deploy
          </button>
          <button
            onClick={toggleCodePanel}
            className={cn(
              "px-3 py-1.5 text-xs rounded-md transition-colors cursor-pointer",
              codePanelOpen
                ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-medium"
                : "bg-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-text-muted)]/20"
            )}
          >
            Code
          </button>
          <button
            onClick={toggleDryrunPanel}
            className={cn(
              "px-3 py-1.5 text-xs rounded-md transition-colors cursor-pointer",
              dryrunPanelOpen
                ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-medium"
                : "bg-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-text-muted)]/20"
            )}
          >
            Dryrun
          </button>
        </>
      )}

      <EnvironmentSwitcher />

      <RateLimitBadge />

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
