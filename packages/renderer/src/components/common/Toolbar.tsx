import { useState, useEffect, useCallback } from "react";
import { useProjectStore } from "../../store/projectStore";
import { useFlowStore } from "../../store/flowStore";
import { useCodePanelStore } from "../../store/codePanelStore";
import { useDryrunPanelStore } from "../../store/dryrunPanelStore";
import { useDeployPanelStore } from "../../store/deployPanelStore";
import { useAiBuilderPanelStore } from "../../store/aiBuilderPanelStore";
import { cn } from "../../lib/utils";
import { useHashRoute, navigate } from "../../lib/router";
import { useNavigationStore } from "../../store/navigationStore";
import { WalkthroughTour, useTourAutoShow } from "./WalkthroughTour";
import { EnvironmentSwitcher } from "./EnvironmentSwitcher";
import { RateLimitBadge } from "../rate-limit/RateLimitBadge";
import { PermissionGate } from "./PermissionGate";
import { FolderOpenIcon, HelpIcon, ChevronIcon } from "@/components/icons";


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
  const aiBuilderOpen = useAiBuilderPanelStore((s) => s.isOpen);
  const toggleAiBuilder = useAiBuilderPanelStore((s) => s.toggle);
  const currentRoute = useHashRoute();
  const canGoBack = useNavigationStore((s) => s.canGoBack);
  const canGoForward = useNavigationStore((s) => s.canGoForward);
  const goBack = useNavigationStore((s) => s.goBack);
  const goForward = useNavigationStore((s) => s.goForward);
  const shouldAutoShow = useTourAutoShow();
  const [tourOpen, setTourOpen] = useState(shouldAutoShow);

  const isCanvas = currentRoute === "canvas";

  const saveProject = useCallback(
    async (saveAs?: boolean) => {
      let filePath = project.filePath;

      if (!window.project) return;
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
    if (!window.project) return;
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

  // Keyboard shortcuts
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
      // Alt+Left / Alt+Right for back/forward navigation
      if (e.altKey && e.key === "ArrowLeft") {
        e.preventDefault();
        goBack();
      }
      if (e.altKey && e.key === "ArrowRight") {
        e.preventDefault();
        goForward();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [saveProject, openProject, goBack, goForward]);

  return (
    <header className="h-12 bg-[var(--color-surface)] border-b border-[var(--color-border)] flex items-center px-4 gap-1 shrink-0">
      <h1 className="text-sm font-semibold text-[var(--color-text)] mr-3">
        Nango Builder
      </h1>

      {project && (
        <span className="text-xs text-[var(--color-text-muted)]">
          {project.name}
          {isDirty && " *"}
        </span>
      )}

      {/* Back / Forward navigation */}
      <div className="flex items-center gap-0.5 ml-2">
        <button
          onClick={goBack}
          disabled={!canGoBack}
          aria-label="Go back"
          title="Go back (Alt+Left)"
          className="flex items-center justify-center w-7 h-7 rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)] transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-default disabled:hover:bg-transparent disabled:hover:text-[var(--color-text-muted)]"
        >
          <ChevronIcon direction="left" />
        </button>
        <button
          onClick={goForward}
          disabled={!canGoForward}
          aria-label="Go forward"
          title="Go forward (Alt+Right)"
          className="flex items-center justify-center w-7 h-7 rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)] transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-default disabled:hover:bg-transparent disabled:hover:text-[var(--color-text-muted)]"
        >
          <ChevronIcon direction="right" />
        </button>
      </div>

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
            onClick={toggleAiBuilder}
            className={cn(
              "px-3 py-1.5 text-xs rounded-md transition-colors cursor-pointer flex items-center gap-1",
              aiBuilderOpen
                ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-medium"
                : "bg-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-text-muted)]/20"
            )}
            title="AI Integration Builder"
          >
            ✦ AI
          </button>
          <PermissionGate permission="deploy_production">
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
          </PermissionGate>
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

      {tourOpen && <WalkthroughTour onClose={() => setTourOpen(false)} />}
    </header>
  );
}
