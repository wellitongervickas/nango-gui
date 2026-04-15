import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  useReactFlow,
  type Edge,
  type Connection,
  type NodeTypes,
  type Node,
} from "@xyflow/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useFlowStore } from "../../store/flowStore";
import { SyncNode } from "./nodes/SyncNode";
import { ActionNode } from "./nodes/ActionNode";
import { ModelNode } from "./nodes/ModelNode";
import { TriggerNode } from "./nodes/TriggerNode";
import { WebhookNode } from "./nodes/WebhookNode";
import { TransformNode } from "./nodes/TransformNode";
import type { NangoNodeType } from "../../types/flow";

const nodeTypes: NodeTypes = {
  sync: SyncNode,
  action: ActionNode,
  model: ModelNode,
  trigger: TriggerNode,
  webhook: WebhookNode,
  transform: TransformNode,
};

interface ContextMenu {
  x: number;
  y: number;
  nodeId: string;
}

export function Canvas() {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNode,
    removeNode,
    duplicateNode,
    selectNode,
    selectedNodeId,
    undo,
    redo,
    pushHistory,
  } = useFlowStore();

  const { screenToFlowPosition } = useReactFlow();
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Keyboard shortcuts: Ctrl+Z undo, Ctrl+Y / Ctrl+Shift+Z redo, Delete selected
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (mod && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        redo();
      } else if (
        (e.key === "Delete" || e.key === "Backspace") &&
        selectedNodeId
      ) {
        const active = document.activeElement;
        const isEditing =
          active instanceof HTMLInputElement ||
          active instanceof HTMLTextAreaElement ||
          active instanceof HTMLSelectElement;
        if (!isEditing) removeNode(selectedNodeId);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo, selectedNodeId, removeNode]);

  // Close context menu on outside click
  useEffect(() => {
    function onPointerDown() {
      setContextMenu(null);
    }
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const isValidConnection = useCallback(
    (connection: Edge | Connection): boolean => {
      if (connection.source === connection.target) return false;
      const src = nodes.find((n) => n.id === connection.source);
      const tgt = nodes.find((n) => n.id === connection.target);
      if (!src || !tgt) return false;
      // Prevent same-type connections (sync→sync, model→model, etc.)
      return src.type !== tgt.type;
    },
    [nodes],
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const type = e.dataTransfer.getData(
        "application/reactflow",
      ) as NangoNodeType;
      if (!type) return;
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const id = `${type}-${Date.now()}`;
      addNode({
        id,
        type,
        position,
        data: { label: `New ${type.charAt(0).toUpperCase() + type.slice(1)}` },
      });
    },
    [screenToFlowPosition, addNode],
  );

  const onNodeContextMenu = useCallback((e: React.MouseEvent, node: Node) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, nodeId: node.id });
  }, []);

  const onPaneClick = useCallback(() => {
    setContextMenu(null);
    selectNode(null);
  }, [selectNode]);

  const onNodeClick = useCallback(
    (_e: React.MouseEvent, node: Node) => {
      selectNode(node.id);
      setContextMenu(null);
    },
    [selectNode],
  );

  const onNodeDragStart = useCallback(() => {
    pushHistory();
  }, [pushHistory]);

  return (
    <div ref={wrapperRef} className="w-full h-full relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        isValidConnection={isValidConnection}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onNodeContextMenu={onNodeContextMenu}
        onPaneClick={onPaneClick}
        onNodeClick={onNodeClick}
        onNodeDragStart={onNodeDragStart}
        fitView
        snapToGrid
        snapGrid={[16, 16]}
        defaultEdgeOptions={{ type: "smoothstep", animated: true }}
        minZoom={0.25}
        maxZoom={2}
        style={{ background: "var(--color-bg-base)" }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
        <Controls />
        <MiniMap nodeStrokeWidth={3} className="!bg-[var(--color-surface)]" />
      </ReactFlow>

      {contextMenu && (
        <div
          style={{
            position: "fixed",
            top: contextMenu.y,
            left: contextMenu.x,
            zIndex: 50,
          }}
          className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md shadow-xl py-1 min-w-[140px]"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            className="w-full text-left px-3 py-1.5 text-sm text-[var(--color-text)] hover:bg-[var(--color-bg)] transition-colors cursor-pointer"
            onClick={() => {
              duplicateNode(contextMenu.nodeId);
              setContextMenu(null);
            }}
          >
            Duplicate
          </button>
          <hr className="border-[var(--color-border)] my-1" />
          <button
            className="w-full text-left px-3 py-1.5 text-sm text-red-400 hover:bg-[var(--color-bg)] transition-colors cursor-pointer"
            onClick={() => {
              removeNode(contextMenu.nodeId);
              setContextMenu(null);
            }}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
