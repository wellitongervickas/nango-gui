import { useEffect } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { Canvas } from "./components/canvas/Canvas";
import { Sidebar } from "./components/sidebar/Sidebar";
import { Toolbar } from "./components/common/Toolbar";
import { NavSidebar } from "./components/common/NavSidebar";
import { StatusBar } from "./components/common/StatusBar";
import { PropertiesPanel } from "./components/properties/PropertiesPanel";
import { CodePreviewPanel } from "./components/canvas/CodePreviewPanel";
import { DryrunPanel } from "./components/canvas/DryrunPanel";
import { DeployPanel } from "./components/deploy/DeployPanel";
import { AiBuilderPanel } from "./components/ai/AiBuilderPanel";
import { ConnectSearchModal } from "./components/connections/ConnectSearchModal";
import { useCodePanelStore } from "./store/codePanelStore";
import { useDryrunPanelStore } from "./store/dryrunPanelStore";
import { useDeployPanelStore } from "./store/deployPanelStore";
import { useAiBuilderPanelStore } from "./store/aiBuilderPanelStore";
import { useConnectFlowStore } from "./store/connectFlowStore";
import { SetupWizard } from "./components/setup/SetupWizard";
import { PageErrorBoundary } from "./components/PageErrorBoundary";
import { ErrorToasts } from "./components/ErrorToasts";
import { OfflineBanner } from "./components/OfflineBanner";
import { ProdEnvironmentBanner } from "./components/common/ProdEnvironmentBanner";
import { SettingsPage } from "./pages/SettingsPage";
import { ConnectionsPage } from "./pages/ConnectionsPage";
import { IntegrationsPage } from "./pages/IntegrationsPage";
import { SyncsPage } from "./pages/SyncsPage";
import { RecordsPage } from "./pages/RecordsPage";
import { ActionsPage } from "./pages/ActionsPage";
import { DashboardPage } from "./pages/DashboardPage";
import { WebhooksPage } from "./pages/WebhooksPage";
import { LogsPage } from "./pages/LogsPage";
import { DeployHistoryPage } from "./pages/DeployHistoryPage";
import { McpPage } from "./pages/McpPage";
import { PlaygroundPage } from "./pages/PlaygroundPage";
import { ConnectionDetailPage } from "./pages/ConnectionDetailPage";
import { IntegrationDetailPage } from "./pages/IntegrationDetailPage";
import { useSettingsStore } from "./store/settingsStore";
import { useEnvironmentStore } from "./store/environmentStore";
import { useRbacStore } from "./store/rbacStore";
import { useErrorStore } from "./store/errorStore";
import { useHashRoute } from "./lib/router";
import "./index.css";

/** Shared shell layout with toolbar, sidebar nav, and status bar. */
function AppShell({ children, pageName }: { children: React.ReactNode; pageName: string }) {
  return (
    <div className="flex flex-col h-screen w-screen bg-[var(--color-bg)]">
      <OfflineBanner />
      <ProdEnvironmentBanner />
      <Toolbar />
      <div className="flex flex-1 overflow-hidden">
        <NavSidebar />
        <main className="flex-1 relative overflow-hidden">
          <PageErrorBoundary pageName={pageName}>
            {children}
          </PageErrorBoundary>
        </main>
      </div>
      <StatusBar />
      <ErrorToasts />
      <ConnectSearchModal />
    </div>
  );
}

function App() {
  const route = useHashRoute();
  const codePanelOpen = useCodePanelStore((s) => s.isOpen);
  const closeCodePanel = useCodePanelStore((s) => s.close);
  const dryrunPanelOpen = useDryrunPanelStore((s) => s.isOpen);
  const closeDryrunPanel = useDryrunPanelStore((s) => s.close);
  const deployPanelOpen = useDeployPanelStore((s) => s.isOpen);
  const closeDeployPanel = useDeployPanelStore((s) => s.close);
  const aiBuilderOpen = useAiBuilderPanelStore((s) => s.isOpen);
  const closeAiBuilder = useAiBuilderPanelStore((s) => s.close);

  // Apply persisted theme preference and initialize environment as early as possible.
  // Also bootstrap settings (which carries hasRbac/tier/isProduction) and the RBAC
  // user so the role badge and permission gates have the data they need.
  useEffect(() => {
    void useSettingsStore.getState().fetchSettings();
    void useRbacStore.getState().fetchCurrentUser();
    useEnvironmentStore.getState().initialize();
  }, []);

  // Per F6 spec, re-fetch the RBAC user when the environment changes so the
  // role badge/gates reflect the active environment's tier and is_production.
  useEffect(() => {
    const unsub = useSettingsStore.subscribe((state, prev) => {
      if (state.environment !== prev.environment) {
        void useRbacStore.getState().fetchCurrentUser();
      }
    });
    return unsub;
  }, []);

  // Per F6 spec, a 403 mid-session means the user's role may have changed —
  // refetch settings + the current user so the badge and gates update without
  // requiring a manual page refresh. Triggered by AUTH_INVALID error toasts.
  useEffect(() => {
    let lastSeenId: string | null = null;
    const unsub = useErrorStore.subscribe((state) => {
      const latest = state.notifications[state.notifications.length - 1];
      if (!latest || latest.id === lastSeenId) return;
      lastSeenId = latest.id;
      if (latest.errorCode === "AUTH_INVALID") {
        void useSettingsStore.getState().fetchSettings();
        void useRbacStore.getState().fetchCurrentUser();
      }
    });
    return unsub;
  }, []);

  // Auto-open AI Builder panel when navigating via ai-builder route
  useEffect(() => {
    if (route === "ai-builder") {
      useAiBuilderPanelStore.getState().open();
    }
  }, [route]);

  // Global Ctrl/Cmd+K shortcut to open the Connect search modal
  useEffect(() => {
    function handleGlobalKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        useConnectFlowStore.getState().openSearch();
      }
    }
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  if (route === "setup") {
    return <SetupWizard />;
  }

  if (route === "/" || route === "dashboard") {
    return <AppShell pageName="Dashboard"><DashboardPage /></AppShell>;
  }

  if (route === "settings") {
    return <AppShell pageName="Settings"><SettingsPage /></AppShell>;
  }

  if (route === "connections") {
    return <AppShell pageName="Connections"><ConnectionsPage /></AppShell>;
  }

  if (route.startsWith("connections/detail/")) {
    const segments = route.split("/");
    const providerConfigKey = decodeURIComponent(segments[2] ?? "");
    const connectionId = decodeURIComponent(segments[3] ?? "");
    return (
      <AppShell pageName="Connection Detail">
        <ConnectionDetailPage providerConfigKey={providerConfigKey} connectionId={connectionId} />
      </AppShell>
    );
  }

  if (route === "integrations") {
    return <AppShell pageName="Integrations"><IntegrationsPage /></AppShell>;
  }

  if (route.startsWith("integrations/detail/")) {
    const providerKey = decodeURIComponent(route.split("/")[2] ?? "");
    return (
      <AppShell pageName="Integration Detail">
        <IntegrationDetailPage providerKey={providerKey} />
      </AppShell>
    );
  }

  if (route === "syncs") {
    return <AppShell pageName="Syncs"><SyncsPage /></AppShell>;
  }

  if (route === "records") {
    return <AppShell pageName="Records"><RecordsPage /></AppShell>;
  }

  if (route === "actions") {
    return <AppShell pageName="Actions"><ActionsPage /></AppShell>;
  }

  if (route === "playground") {
    return <AppShell pageName="Playground"><PlaygroundPage /></AppShell>;
  }

  if (route === "logs") {
    return <AppShell pageName="Logs"><LogsPage /></AppShell>;
  }

  if (route === "webhooks") {
    return <AppShell pageName="Webhooks"><WebhooksPage /></AppShell>;
  }

  if (route === "deploys") {
    return <AppShell pageName="Deploy History"><DeployHistoryPage /></AppShell>;
  }

  if (route === "mcp") {
    return <AppShell pageName="MCP Servers"><McpPage /></AppShell>;
  }

  // Canvas (default route) — uses ReactFlowProvider + extra panels
  return (
    <ReactFlowProvider>
      <div className="flex flex-col h-screen w-screen bg-[var(--color-bg)]">
        <OfflineBanner />
        <ProdEnvironmentBanner />
        <Toolbar />
        <div className="flex flex-1 overflow-hidden">
          <NavSidebar />
          <Sidebar />
          <main className="flex-1 relative overflow-hidden">
            <PageErrorBoundary pageName="Canvas">
              <div className="flex flex-col h-full">
                <div className="flex flex-1 min-h-0">
                  <div className={codePanelOpen || aiBuilderOpen ? "flex-1 min-w-0" : "w-full"}>
                    <Canvas />
                  </div>
                  {codePanelOpen && (
                    <div className="w-[420px] shrink-0">
                      <CodePreviewPanel onClose={closeCodePanel} />
                    </div>
                  )}
                  {aiBuilderOpen && (
                    <div className="w-[400px] shrink-0">
                      <AiBuilderPanel onClose={closeAiBuilder} />
                    </div>
                  )}
                </div>
                {dryrunPanelOpen && (
                  <DryrunPanel onClose={closeDryrunPanel} />
                )}
                {deployPanelOpen && (
                  <DeployPanel onClose={closeDeployPanel} />
                )}
              </div>
            </PageErrorBoundary>
          </main>
          <PropertiesPanel />
        </div>
        <StatusBar />
        <ErrorToasts />
        <ConnectSearchModal />
      </div>
    </ReactFlowProvider>
  );
}

export default App;
