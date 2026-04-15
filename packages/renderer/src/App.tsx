import { useEffect, useSyncExternalStore } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { Canvas } from "./components/canvas/Canvas";
import { Sidebar } from "./components/sidebar/Sidebar";
import { Toolbar } from "./components/common/Toolbar";
import { StatusBar } from "./components/common/StatusBar";
import { PropertiesPanel } from "./components/properties/PropertiesPanel";
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
import { applyTheme } from "./store/settingsStore";
import "./index.css";

function parseHash(): string {
  return window.location.hash.replace(/^#\/?/, "") || "/";
}

function subscribeToHash(callback: () => void): () => void {
  window.addEventListener("hashchange", callback);
  return () => window.removeEventListener("hashchange", callback);
}

function useHashRoute(): string {
  return useSyncExternalStore(subscribeToHash, parseHash);
}

function App() {
  const route = useHashRoute();

  // Apply persisted theme preference as early as possible.
  useEffect(() => {
    window.electronApp
      ?.getSettings()
      .then((res) => {
        if (res.status === "ok") applyTheme(res.data.theme);
      })
      .catch(() => {/* ignore — falls back to system */});
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

  return (
    <ReactFlowProvider>
      <div className="flex flex-col h-screen w-screen bg-[var(--color-bg)]">
        <OfflineBanner />
        <Toolbar />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <main className="flex-1 relative overflow-hidden">
            <PageErrorBoundary pageName="Canvas">
              <Canvas />
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
