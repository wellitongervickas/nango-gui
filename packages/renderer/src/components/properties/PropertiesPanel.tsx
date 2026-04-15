import { useFlowStore } from "../../store/flowStore";
import { SyncProperties } from "./SyncProperties";
import { ActionProperties } from "./ActionProperties";
import { ModelProperties } from "./ModelProperties";
import { TriggerProperties } from "./TriggerProperties";
import { WebhookProperties } from "./WebhookProperties";
import { TransformProperties } from "./TransformProperties";
import type {
  SyncNodeData,
  ActionNodeData,
  ModelNodeData,
  TriggerNodeData,
  WebhookNodeData,
  TransformNodeData,
} from "../../types/flow";

export function PropertiesPanel() {
  const selectedNodeId = useFlowStore((s) => s.selectedNodeId);
  const nodes = useFlowStore((s) => s.nodes);
  const updateNodeData = useFlowStore((s) => s.updateNodeData);

  if (!selectedNodeId) {
    return (
      <aside className="w-[360px] shrink-0 bg-[var(--color-surface)] border-l border-[var(--color-border)] flex flex-col p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
          Properties
        </h2>
        <p className="text-xs text-[var(--color-text-muted)] mt-3">
          Select a node to view and edit its properties.
        </p>
      </aside>
    );
  }

  const node = nodes.find((n) => n.id === selectedNodeId);
  if (!node) return null;

  function handleUpdate(data: Record<string, unknown>) {
    updateNodeData(selectedNodeId!, data);
  }

  return (
    <aside className="w-[360px] shrink-0 bg-[var(--color-surface)] border-l border-[var(--color-border)] flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--color-border)] shrink-0">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
          Properties
        </h2>
        <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5 font-mono truncate">
          {node.id}
        </p>
      </div>
      <div className="p-4 flex-1 overflow-y-auto">
        {node.type === "sync" && (
          <SyncProperties
            data={node.data as unknown as SyncNodeData}
            onUpdate={handleUpdate}
          />
        )}
        {node.type === "action" && (
          <ActionProperties
            data={node.data as unknown as ActionNodeData}
            onUpdate={handleUpdate}
          />
        )}
        {node.type === "model" && (
          <ModelProperties
            data={node.data as unknown as ModelNodeData}
            onUpdate={handleUpdate}
          />
        )}
        {node.type === "trigger" && (
          <TriggerProperties
            data={node.data as unknown as TriggerNodeData}
            onUpdate={handleUpdate}
          />
        )}
        {node.type === "webhook" && (
          <WebhookProperties
            data={node.data as unknown as WebhookNodeData}
            onUpdate={handleUpdate}
          />
        )}
        {node.type === "transform" && (
          <TransformProperties
            data={node.data as unknown as TransformNodeData}
            onUpdate={handleUpdate}
          />
        )}
      </div>
    </aside>
  );
}
