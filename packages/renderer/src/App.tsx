import { useEffect } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { Canvas } from "./components/canvas/Canvas";
import { Sidebar } from "./components/sidebar/Sidebar";
import { Toolbar } from "./components/common/Toolbar";
import { StatusBar } from "./components/common/StatusBar";
import { PropertiesPanel } from "./components/properties/PropertiesPanel";
import { SetupWizard } from "./components/setup/SetupWizard";
import { SettingsPage } from "./pages/SettingsPage";
import { ConnectionsPage } from "./pages/ConnectionsPage";
import { IntegrationsPage } from "./pages/IntegrationsPage";
import { SyncsPage } from "./pages/SyncsPage";
import { RecordsPage } from "./pages/RecordsPage";
import { applyTheme } from "./store/settingsStore";
import "./index.css";

function useHashRoute(): string {
  return window.location.hash.replace(/^#\/?/, "") || "/";
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

  if (route === "settings") {
    return (
      <div className="flex flex-col h-screen w-screen bg-[var(--color-bg)]">
        <Toolbar />
        <div className="flex flex-1 overflow-hidden">
          <main className="flex-1 relative overflow-hidden">
            <SettingsPage />
          </main>
        </div>
        <StatusBar />
      </div>
    );
  }

  if (route === "connections") {
    return (
      <div className="flex flex-col h-screen w-screen bg-[var(--color-bg)]">
        <Toolbar />
        <div className="flex flex-1 overflow-hidden">
          <main className="flex-1 relative overflow-hidden">
            <ConnectionsPage />
          </main>
        </div>
        <StatusBar />
      </div>
    );
  }

  if (route === "integrations") {
    return (
      <div className="flex flex-col h-screen w-screen bg-[var(--color-bg)]">
        <Toolbar />
        <div className="flex flex-1 overflow-hidden">
          <main className="flex-1 relative overflow-hidden">
            <IntegrationsPage />
          </main>
        </div>
        <StatusBar />
      </div>
    );
  }

  if (route === "syncs") {
    return (
      <div className="flex flex-col h-screen w-screen bg-[var(--color-bg)]">
        <Toolbar />
        <div className="flex flex-1 overflow-hidden">
          <main className="flex-1 relative overflow-hidden">
            <SyncsPage />
          </main>
        </div>
        <StatusBar />
      </div>
    );
  }

  if (route === "records") {
    return (
      <div className="flex flex-col h-screen w-screen bg-[var(--color-bg)]">
        <Toolbar />
        <div className="flex flex-1 overflow-hidden">
          <main className="flex-1 relative overflow-hidden">
            <RecordsPage />
          </main>
        </div>
        <StatusBar />
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <div className="flex flex-col h-screen w-screen bg-[var(--color-bg)]">
        <Toolbar />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <main className="flex-1 relative overflow-hidden">
            <Canvas />
          </main>
          <PropertiesPanel />
        </div>
        <StatusBar />
      </div>
    </ReactFlowProvider>
  );
}

export default App;
