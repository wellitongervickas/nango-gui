import { Canvas } from "./components/canvas/Canvas";
import { Sidebar } from "./components/sidebar/Sidebar";
import { Toolbar } from "./components/common/Toolbar";
import { StatusBar } from "./components/common/StatusBar";
import "./index.css";

function App() {
  return (
    <div className="flex flex-col h-screen w-screen bg-[var(--color-bg)]">
      <Toolbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 relative">
          <Canvas />
        </main>
      </div>
      <StatusBar />
    </div>
  );
}

export default App;
