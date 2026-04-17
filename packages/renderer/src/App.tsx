import { useEffect } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { Canvas } from "./components/canvas/Canvas";
import { Sidebar } from "./components/sidebar/Sidebar";
import { Toolbar } from "./components/common/Toolbar";
import { StatusBar } from "./components/common/StatusBar";
import { PropertiesPanel } from "./components/properties/PropertiesPanel";
import { CodePreviewPanel } from "./components/canvas/CodePreviewPanel";
import { DryrunPanel } from "./components/canvas/DryrunPanel";
import { DeployPanel } from "./components/deploy/DeployPanel";
import { AiBuilderPanel } from "./components/ai/AiBuilderPanel";
import { useCodePanelStore } from "./store/codePanelStore";
import { useDryrunPanelStore } from "./store/dryrunPanelStore";
import { useDeployPanelStore } from "./store/deployPanelStore";
import { useAiBuilderPanelStore } from "./store/aiBuilderPanelStore";
import { SetupWizard } from "./components/setup/SetupWizard";
import { PageErrorBoundary } from "./components/PageErrorBoundary";
import { ErrorToasts } from "./components/ErrorToasts";
import { OfflineBanner } from "./components/OfflineBanner";
import { SettingsPage } from "./pages/SettingsPage";
import { ConnectionsPage } from "./pages/ConnectionsPage";
import { IntegrationsPage } from "./pages/IntegrationsPage";
import { SyncsPage } from "./pages/SyncsPage";
import { RecordsPage } from "./pages/RecordsPage";
import { ActionsPage } from "./pages/ActionsPage";
import { DashboardPage } from "./pages/DashboardPage";
import { WebhooksPage } from "./pages/WebhooksPage";
import { DeployHistoryPage } from "./pages/DeployHistoryPage";
import { McpPage } from "./pages/McpPage";
import { applyTheme } from "./store/settingsStore";
import { useEnvironmentStore } from "./store/environmentStore";
import { useHashRoute } from "./lib/router";
import "./index.css";

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
  useEffect(() => {
    window.electronApp
      ?.getSettings()
      .then((res) => {
        if (res.status === "ok") applyTheme(res.data.theme);
      })
      .catch(() => {/* ignore — falls back to system */});
    useEnvironmentStore.getState().initialize();
  }, []);

  if (route === "setup") {
    return <SetupWizard />;
  }

  if (route === "/" || route === "dashboard") {
    return (
      <div className="flex flex-col h-screen w-screen bg-[var(--color-bg)]">
        <OfflineBanner />
        <Toolbar />
        <div className="flex flex-1 overflow-hidden">
          <main className="flex-1 relative overflow-hidden">
            <PageErrorBoundary pageName="Dashboard">
              <DashboardPage />
            </PageErrorBoundary>
          </main>
        </div>
        <StatusBar />
        <ErrorToasts />
      </div>
    );
  }

  if (route === "settings") {
    return (
      <div className="flex flex-col h-screen w-screen bg-[var(--color-bg)]">
        <OfflineBanner />
        <Toolbar />
        <div className="flex flex-1 overflow-hidden">
          <main className="flex-1 relative overflow-hidden">
            <PageErrorBoundary pageName="Settings">
              <SettingsPage />
            </PageErrorBoundary>
          </main>
        </div>
        <StatusBar />
        <ErrorToasts />
      </div>
    );
  }

  if (route === "connections") {
    return (
      <div className="flex flex-col h-screen w-screen bg-[var(--color-bg)]">
        <OfflineBanner />
        <Toolbar />
        <div className="flex flex-1 overflow-hidden">
          <main className="flex-1 relative overflow-hidden">
            <PageErrorBoundary pageName="Connections">
              <ConnectionsPage />
            </PageErrorBoundary>
          </main>
        </div>
        <StatusBar />
        <ErrorToasts />
      </div>
    );
  }

  if (route === "integrations") {
    return (
      <div className="flex flex-col h-screen w-screen bg-[var(--color-bg)]">
        <OfflineBanner />
        <Toolbar />
        <div className="flex flex-1 overflow-hidden">
          <main className="flex-1 relative overflow-hidden">
            <PageErrorBoundary pageName="Integrations">
              <IntegrationsPage />
            </PageErrorBoundary>
          </main>
        </div>
        <StatusBar />
        <ErrorToasts />
      </div>
    );
  }

  if (route === "syncs") {
    return (
      <div className="flex flex-col h-screen w-screen bg-[var(--color-bg)]">
        <OfflineBanner />
        <Toolbar />
        <div className="flex flex-1 overflow-hidden">
          <main className="flex-1 relative overflow-hidden">
            <PageErrorBoundary pageName="Syncs">
              <SyncsPage />
            </PageErrorBoundary>
          </main>
        </div>
        <StatusBar />
        <ErrorToasts />
      </div>
    );
  }

  if (route === "records") {
    return (
      <div className="flex flex-col h-screen w-screen bg-[var(--color-bg)]">
        <OfflineBanner />
        <Toolbar />
        <div className="flex flex-1 overflow-hidden">
          <main className="flex-1 relative overflow-hidden">
            <PageErrorBoundary pageName="Records">
              <RecordsPage />
            </PageErrorBoundary>
          </main>
        </div>
        <StatusBar />
        <ErrorToasts />
      </div>
    );
  }

  if (route === "actions") {
    return (
      <div className="flex flex-col h-screen w-screen bg-[var(--color-bg)]">
        <OfflineBanner />
        <Toolbar />
        <div className="flex flex-1 overflow-hidden">
          <main className="flex-1 relative overflow-hidden">
            <PageErrorBoundary pageName="Actions">
              <ActionsPage />
            </PageErrorBoundary>
          </main>
        </div>
        <StatusBar />
        <ErrorToasts />
      </div>
    );
  }

  if (route === "webhooks") {
    return (
      <div className="flex flex-col h-screen w-screen bg-[var(--color-bg)]">
        <OfflineBanner />
        <Toolbar />
        <div className="flex flex-1 overflow-hidden">
          <main className="flex-1 relative overflow-hidden">
            <PageErrorBoundary pageName="Webhooks">
              <WebhooksPage />
            </PageErrorBoundary>
          </main>
        </div>
        <StatusBar />
        <ErrorToasts />
      </div>
    );
  }

  if (route === "deploys") {
    return (
      <div className="flex flex-col h-screen w-screen bg-[var(--color-bg)]">
        <OfflineBanner />
        <Toolbar />
        <div className="flex flex-1 overflow-hidden">
          <main className="flex-1 relative overflow-hidden">
            <PageErrorBoundary pageName="Deploy History">
              <DeployHistoryPage />
            </PageErrorBoundary>
          </main>
        </div>
        <StatusBar />
        <ErrorToasts />
      </div>
    );
  }

  if (route === "mcp") {
    return (
      <div className="flex flex-col h-screen w-screen bg-[var(--color-bg)]">
        <OfflineBanner />
        <Toolbar />
        <div className="flex flex-1 overflow-hidden">
          <main className="flex-1 relative overflow-hidden">
            <PageErrorBoundary pageName="MCP Servers">
              <McpPage />
            </PageErrorBoundary>
          </main>
        </div>
        <StatusBar />
        <ErrorToasts />
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <div className="flex flex-col h-screen w-screen bg-[var(--color-bg)]">
        <OfflineBanner />
        <Toolbar />
        <div className="flex flex-1 overflow-hidden">
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
      </div>
    </ReactFlowProvider>
  );
}

export default App;
