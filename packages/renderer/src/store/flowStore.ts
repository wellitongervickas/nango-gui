import { create } from "zustand";
import {
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
} from "@xyflow/react";
import type { AiGenerationResult } from "@nango-gui/shared";
import { definitionToFlow } from "../lib/graph-converter";

const MAX_HISTORY = 50;

interface HistorySnapshot {
  nodes: Node[];
  edges: Edge[];
}

interface FlowState {
  nodes: Node[];
  edges: Edge[];
  selectedNodeId: string | null;
  past: HistorySnapshot[];
  future: HistorySnapshot[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  selectNode: (id: string | null) => void;
  addNode: (node: Node) => void;
  removeNode: (id: string) => void;
  duplicateNode: (id: string) => void;
  updateNodeData: (id: string, data: Record<string, unknown>) => void;
  updateEdgeData: (id: string, data: Record<string, unknown>) => void;
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  reset: () => void;
  /**
   * Merge an AI-generated definition into the current graph.
   * Takes an undo snapshot first so the merge can be reverted.
   * Preserves existing nodes — only adds new syncs/actions/models.
   */
  mergeAiDefinition: (definition: AiGenerationResult) => void;
}

export const useFlowStore = create<FlowState>((set, get) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,
  past: [],
  future: [],

  onNodesChange: (changes) => {
    set({ nodes: applyNodeChanges(changes, get().nodes) });
  },

  onEdgesChange: (changes) => {
    set({ edges: applyEdgeChanges(changes, get().edges) });
  },

  onConnect: (connection) => {
    get().pushHistory();
    set({ edges: addEdge(connection, get().edges) });
  },

  selectNode: (id) => set({ selectedNodeId: id }),

  addNode: (node) => {
    get().pushHistory();
    set({ nodes: [...get().nodes, node] });
  },

  removeNode: (id) => {
    get().pushHistory();
    const current = get();
    set({
      nodes: current.nodes.filter((n) => n.id !== id),
      edges: current.edges.filter((e) => e.source !== id && e.target !== id),
      selectedNodeId:
        current.selectedNodeId === id ? null : current.selectedNodeId,
    });
  },

  duplicateNode: (id) => {
    const node = get().nodes.find((n) => n.id === id);
    if (!node) return;
    get().pushHistory();
    const newId = `${node.type}-${Date.now()}`;
    const newNode: Node = {
      ...node,
      id: newId,
      position: { x: node.position.x + 40, y: node.position.y + 40 },
      selected: false,
    };
    set({ nodes: [...get().nodes, newNode], selectedNodeId: newId });
  },

  updateNodeData: (id, data) => {
    set({
      nodes: get().nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, ...data } } : n,
      ),
    });
  },

  updateEdgeData: (id, data) => {
    set({
      edges: get().edges.map((e) =>
        e.id === id ? { ...e, data: { ...e.data, ...data } } : e,
      ),
    });
  },

  pushHistory: () => {
    const { nodes, edges, past } = get();
    const snapshot: HistorySnapshot = {
      nodes: JSON.parse(JSON.stringify(nodes)),
      edges: JSON.parse(JSON.stringify(edges)),
    };
    set({
      past: [...past.slice(-(MAX_HISTORY - 1)), snapshot],
      future: [],
    });
  },

  undo: () => {
    const { past, nodes, edges, future } = get();
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    set({
      nodes: previous.nodes,
      edges: previous.edges,
      past: past.slice(0, -1),
      future: [
        {
          nodes: JSON.parse(JSON.stringify(nodes)),
          edges: JSON.parse(JSON.stringify(edges)),
        },
        ...future,
      ],
      selectedNodeId: null,
    });
  },

  redo: () => {
    const { past, nodes, edges, future } = get();
    if (future.length === 0) return;
    const next = future[0];
    set({
      nodes: next.nodes,
      edges: next.edges,
      past: [
        ...past,
        {
          nodes: JSON.parse(JSON.stringify(nodes)),
          edges: JSON.parse(JSON.stringify(edges)),
        },
      ],
      future: future.slice(1),
      selectedNodeId: null,
    });
  },

  reset: () =>
    set({ nodes: [], edges: [], past: [], future: [], selectedNodeId: null }),

  mergeAiDefinition: (definition) => {
    const { nodes, edges } = definitionToFlow(definition);
    if (nodes.length === 0) return;

    // Snapshot for undo before merging
    get().pushHistory();

    const existingNodes = get().nodes;
    const existingEdges = get().edges;

    // Offset new nodes so they don't overlap existing ones
    const maxY = existingNodes.reduce(
      (max, n) => Math.max(max, n.position.y + 200),
      0
    );
    const offsetNodes = nodes.map((n) => ({
      ...n,
      position: { x: n.position.x, y: n.position.y + maxY },
    }));

    set({
      nodes: [...existingNodes, ...offsetNodes],
      edges: [...existingEdges, ...edges],
    });
  },
}));
