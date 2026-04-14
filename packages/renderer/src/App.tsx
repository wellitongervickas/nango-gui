import { ReactFlowProvider } from "@xyflow/react";
import { Canvas } from "./components/canvas/Canvas";
import { Sidebar } from "./components/sidebar/Sidebar";
import { Toolbar } from "./components/common/Toolbar";
import { StatusBar } from "./components/common/StatusBar";
import { PropertiesPanel } from "./components/properties/PropertiesPanel";
import { SetupWizard } from "./components/setup/SetupWizard";
import "./index.css";

function useHashRoute(): string {
  return window.location.hash.replace(/^#\/?/, "") || "/";
}

function App() {
  const route = useHashRoute();

  if (route === "setup") {
    return <SetupWizard />;
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
