import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
} from "@xyflow/react";
import { useFlowStore } from "../../store/flowStore";
import { SyncNode } from "./nodes/SyncNode";
import { ActionNode } from "./nodes/ActionNode";
import { ModelNode } from "./nodes/ModelNode";

const nodeTypes = {
  sync: SyncNode,
  action: ActionNode,
  model: ModelNode,
};

export function Canvas() {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect } =
    useFlowStore();

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      nodeTypes={nodeTypes}
      fitView
      className="bg-[var(--color-bg)]"
    >
      <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
      <Controls />
      <MiniMap
        nodeStrokeWidth={3}
        className="!bg-[var(--color-surface)]"
      />
    </ReactFlow>
  );
}
