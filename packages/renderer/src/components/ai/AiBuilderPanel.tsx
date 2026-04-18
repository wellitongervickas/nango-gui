import { useEffect, useRef, useState, useCallback } from "react";
import type { NangoProvider, AiProviderType, AiBuilderToolCallEvent } from "@nango-gui/shared";
import { useAiStore } from "@/store/aiStore";
import { useFlowStore } from "@/store/flowStore";
import { definitionToFlow } from "@/lib/graph-converter";
import { cn } from "@/lib/utils";
import { AiDiffView } from "./AiDiffView";

// ── Icons ────────────────────────────────────────────────────────────────────

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 6 6 18" /><path d="m6 6 12 12" />
    </svg>
  );
}

function SparklesIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </svg>
  );
}

function DiffIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v14" /><path d="m5 10 7-7 7 7" /><path d="M5 21h14" />
    </svg>
  );
}

// ── Provider selector ────────────────────────────────────────────────────────

interface ProviderSelectorProps {
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}

function ProviderSelector({ value, onChange, disabled }: ProviderSelectorProps) {
  const [providers, setProviders] = useState<NangoProvider[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState(value);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Load providers once on mount
  useEffect(() => {
    if (!window.nango?.listProviders) return;
    setLoading(true);
    window.nango
      .listProviders()
      .then((res) => {
        if (res.status === "ok") setProviders(res.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Sync controlled value → local query when value changes externally
  useEffect(() => {
    setQuery(value);
  }, [value]);

  const filtered =
    query.length > 0
      ? providers.filter(
          (p) =>
            p.name.toLowerCase().includes(query.toLowerCase()) ||
            p.display_name.toLowerCase().includes(query.toLowerCase())
        ).slice(0, 8)
      : providers.slice(0, 8);

  const commitValue = useCallback((val: string) => {
    onChange(val);
    setQuery(val);
    setShowSuggestions(false);
  }, [onChange]);

  // Close dropdown on outside click
  useEffect(() => {
    function handlePointerDown(e: PointerEvent) {
      if (
        inputRef.current?.contains(e.target as Node) ||
        listRef.current?.contains(e.target as Node)
      ) return;
      setShowSuggestions(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        placeholder={loading ? "Loading providers…" : "Provider (e.g. github, slack)"}
        value={query}
        disabled={disabled || loading}
        onChange={(e) => {
          setQuery(e.target.value);
          onChange(e.target.value);
          setShowSuggestions(true);
        }}
        onFocus={() => setShowSuggestions(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setShowSuggestions(false);
          if (e.key === "Enter" && filtered.length > 0) {
            commitValue(filtered[0].name);
          }
        }}
        className={cn(
          "w-full px-3 py-2 text-sm rounded-md",
          "bg-[var(--color-bg-overlay)] border border-[var(--color-border)]",
          "text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)]",
          "focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]",
          "disabled:opacity-50 disabled:cursor-not-allowed"
        )}
        aria-label="Provider"
        aria-autocomplete="list"
        aria-expanded={showSuggestions && filtered.length > 0}
      />
      {showSuggestions && filtered.length > 0 && (
        <ul
          ref={listRef}
          role="listbox"
          className="absolute z-50 w-full mt-1 max-h-48 overflow-y-auto rounded-md border border-[var(--color-border)] bg-[var(--color-bg-surface)] shadow-lg"
        >
          {filtered.map((p) => (
            <li
              key={p.name}
              role="option"
              aria-selected={p.name === value}
              onPointerDown={() => commitValue(p.name)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 text-sm cursor-pointer select-none",
                "hover:bg-[var(--color-bg-overlay)]",
                p.name === value && "bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
              )}
            >
              {p.logo_url && (
                <img
                  src={p.logo_url}
                  alt=""
                  className="w-4 h-4 rounded-sm shrink-0 object-contain"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              )}
              <span className="truncate font-medium">{p.display_name}</span>
              <span className="ml-auto text-[10px] text-[var(--color-text-secondary)] shrink-0">
                {p.name}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── AI Provider selector (v2) ────────────────────────────────────────────

const AI_PROVIDER_OPTIONS: { value: AiProviderType; label: string; model: string }[] = [
  { value: "openai", label: "OpenAI", model: "GPT-4o" },
  { value: "anthropic", label: "Anthropic", model: "Claude Sonnet" },
];

interface AiProviderSelectorProps {
  value: AiProviderType;
  onChange: (v: AiProviderType) => void;
  disabled: boolean;
}

function AiProviderSelector({ value, onChange, disabled }: AiProviderSelectorProps) {
  return (
    <div className="flex gap-2">
      {AI_PROVIDER_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          disabled={disabled}
          className={cn(
            "flex-1 rounded-md border px-3 py-2 text-xs font-medium transition-colors",
            value === opt.value
              ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
              : "border-[var(--color-border)] bg-[var(--color-bg-overlay)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary)]/50 hover:text-[var(--color-text-primary)]",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          <span className="block">{opt.label}</span>
          <span className="block text-[9px] opacity-60 mt-0.5">{opt.model}</span>
        </button>
      ))}
    </div>
  );
}

// ── Tool call activity feed (v2) ─────────────────────────────────────────

function ToolCallActivity({ toolCalls }: { toolCalls: AiBuilderToolCallEvent[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [toolCalls]);

  if (toolCalls.length === 0) return null;

  return (
    <div className="px-3 py-2 border-t border-[var(--color-border)]">
      <p className="text-[10px] font-medium text-[var(--color-text-secondary)] uppercase tracking-wider mb-1.5">
        Tool Calls ({toolCalls.length})
      </p>
      <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
        {toolCalls.map((tc, i) => {
          const resultObj = tc.result as Record<string, unknown> | null;
          const nodeName = tc.args.config
            ? ((tc.args.config as Record<string, unknown>).name as string)
            : (tc.args.name as string | undefined);
          return (
            <div
              key={i}
              className="flex items-center gap-2 text-[10px] rounded px-2 py-1 bg-[var(--color-bg-overlay)]"
            >
              <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-[var(--color-primary)]" />
              <span className="font-medium text-[var(--color-text-primary)]">{tc.tool}</span>
              {nodeName && (
                <span className="text-[var(--color-text-secondary)] truncate">
                  {nodeName}
                </span>
              )}
              {resultObj?.error != null && (
                <span className="text-[var(--color-error)] ml-auto shrink-0">failed</span>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

// ── Builder message output (v2) ──────────────────────────────────────────

function BuilderMessageOutput() {
  const builderMessage = useAiStore((s) => s.builderMessage);
  const isGenerating = useAiStore((s) => s.isGenerating);

  if (!builderMessage && !isGenerating) return null;

  return (
    <div className="px-3 py-2 border-t border-[var(--color-border)]">
      <div className="rounded-md bg-[var(--color-bg-overlay)] p-2.5 max-h-32 overflow-y-auto">
        <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed whitespace-pre-wrap">
          {builderMessage || "Building integration…"}
          {isGenerating && !builderMessage && <span className="animate-pulse">▋</span>}
        </p>
      </div>
    </div>
  );
}

// ── Conversation history ─────────────────────────────────────────────────────

function ConversationHistory() {
  const history = useAiStore((s) => s.conversationHistory);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history]);

  if (history.length === 0) return null;

  return (
    <div className="space-y-2 px-3 py-2 border-t border-[var(--color-border)]">
      <p className="text-[10px] font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">
        Conversation ({history.length} turns)
      </p>
      <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
        {history.map((turn, i) => (
          <div
            key={i}
            className={cn(
              "text-xs rounded-md px-2.5 py-1.5",
              turn.role === "user"
                ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
                : "bg-[var(--color-bg-overlay)] text-[var(--color-text-secondary)]"
            )}
          >
            <span className="font-medium uppercase text-[9px] tracking-wider opacity-60 block mb-0.5">
              {turn.role === "user" ? "You" : "AI"}
            </span>
            <p className="line-clamp-2">{turn.content}</p>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

// ── Generated output summary ─────────────────────────────────────────────────

function GeneratedSummary() {
  const definition = useAiStore((s) => s.generatedDefinition);
  if (!definition) return null;

  const yamlLines = definition.yaml.trim().split("\n").length;
  const tsLines = definition.typescript.trim().split("\n").length;

  return (
    <div className="px-3 py-2 border-t border-[var(--color-border)] space-y-1.5">
      <p className="text-[10px] font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">
        Generated
      </p>
      <p className="text-sm text-[var(--color-text-primary)] leading-snug">
        {definition.description}
      </p>
      <div className="flex items-center gap-3 text-[10px] text-[var(--color-text-secondary)]">
        <span>{yamlLines} YAML lines</span>
        <span>{tsLines} TS lines</span>
      </div>
    </div>
  );
}

// ── Streaming output ─────────────────────────────────────────────────────────

function StreamingOutput() {
  const partial = useAiStore((s) => s.partialOutput);
  const isGenerating = useAiStore((s) => s.isGenerating);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [partial]);

  if (!isGenerating && !partial) return null;

  return (
    <div className="px-3 py-2 border-t border-[var(--color-border)]">
      <div className="rounded-md bg-[var(--color-bg-overlay)] p-2.5 max-h-32 overflow-y-auto">
        <pre className="text-[10px] text-[var(--color-text-secondary)] whitespace-pre-wrap font-mono leading-relaxed">
          {partial || "Generating…"}
          {isGenerating && <span className="animate-pulse">▋</span>}
        </pre>
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

// ── Panel ────────────────────────────────────────────────────────────────────

interface AiBuilderPanelProps {
  onClose: () => void;
}

export function AiBuilderPanel({ onClose }: AiBuilderPanelProps) {
  const provider = useAiStore((s) => s.provider);
  const setProvider = useAiStore((s) => s.setProvider);
  const prompt = useAiStore((s) => s.prompt);
  const setPrompt = useAiStore((s) => s.setPrompt);
  const isGenerating = useAiStore((s) => s.isGenerating);
  const generatedDefinition = useAiStore((s) => s.generatedDefinition);
  const previousDefinition = useAiStore((s) => s.previousDefinition);
  const panelError = useAiStore((s) => s.panelError);
  const clearPanelError = useAiStore((s) => s.clearPanelError);
  const isHistoryFull = useAiStore((s) => s.isHistoryFull);
  const generate = useAiStore((s) => s.generate);
  const refine = useAiStore((s) => s.refine);
  const resetConversation = useAiStore((s) => s.resetConversation);
  const applyStreamToken = useAiStore((s) => s.applyStreamToken);

  // v2 state
  const aiProvider = useAiStore((s) => s.aiProvider);
  const setAiProvider = useAiStore((s) => s.setAiProvider);
  const runBuilder = useAiStore((s) => s.runBuilder);
  const builderToolCalls = useAiStore((s) => s.builderToolCalls);
  const builderResult = useAiStore((s) => s.builderResult);
  const applyBuilderToolCall = useAiStore((s) => s.applyBuilderToolCall);
  const applyBuilderMessage = useAiStore((s) => s.applyBuilderMessage);

  const pushHistory = useFlowStore((s) => s.pushHistory);
  const existingNodes = useFlowStore((s) => s.nodes);
  const addNode = useFlowStore((s) => s.addNode);

  const [showDiff, setShowDiff] = useState(false);
  const [useV2, setUseV2] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isRefinement = generatedDefinition !== null;

  // Register AI stream token listener (v1)
  useEffect(() => {
    if (!window.nango?.onAiStreamToken) return;
    window.nango.onAiStreamToken(applyStreamToken);
    return () => {
      window.nango?.removeAllAiStreamListeners?.();
    };
  }, [applyStreamToken]);

  // Register AI builder v2 event listeners
  useEffect(() => {
    if (!window.aiBuilder?.onToolCall) return;
    window.aiBuilder.onToolCall(applyBuilderToolCall);
    window.aiBuilder.onMessage((event) => applyBuilderMessage(event.text, event.done));
    return () => {
      window.aiBuilder?.removeAllListeners?.();
    };
  }, [applyBuilderToolCall, applyBuilderMessage]);

  // Auto-focus textarea when panel opens
  useEffect(() => {
    const timer = setTimeout(() => textareaRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, []);

  // Submit on Cmd/Ctrl+Enter
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleSubmit();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [useV2, isRefinement, isGenerating, provider, prompt]
  );

  function handleSubmit() {
    if (!prompt.trim() || isGenerating) return;
    clearPanelError();

    if (useV2) {
      runBuilder();
    } else {
      if (!provider.trim()) return;
      if (isRefinement) {
        refine();
      } else {
        generate();
      }
    }
  }

  /** v2: Apply builder tool call results to the canvas. */
  function handleAcceptV2() {
    if (!builderResult || builderResult.toolCalls.length === 0) return;

    pushHistory();
    const nodeIdMap = new Map<string, string>();

    for (const tc of builderResult.toolCalls) {
      if (tc.tool === "addNode") {
        const result = tc.result as Record<string, unknown>;
        if (result.error) continue;
        const nodeId = String(result.nodeId);
        const nodeType = String(tc.args.type ?? "action");
        const config = (tc.args.config ?? {}) as Record<string, unknown>;
        const nodeName = String(config.name ?? nodeId);

        nodeIdMap.set(nodeId, nodeId);
        addNode({
          id: nodeId,
          type: nodeType,
          position: { x: 100 + Math.random() * 200, y: 100 + nodeIdMap.size * 150 },
          data: { label: nodeName, ...config },
        });
      }
    }

    for (const tc of builderResult.toolCalls) {
      if (tc.tool === "addEdge") {
        const from = String(tc.args.from ?? "");
        const to = String(tc.args.to ?? "");
        if (nodeIdMap.has(from) && nodeIdMap.has(to)) {
          useFlowStore.getState().onConnect({
            source: from,
            target: to,
            sourceHandle: null,
            targetHandle: null,
          });
        }
      }
    }
  }

  /** v1: Merge generated definition into the flow canvas, preserving existing nodes. */
  function handleAcceptV1() {
    if (!generatedDefinition) return;
    const { nodes: newNodes, edges: newEdges } = definitionToFlow(generatedDefinition);

    const existingLabels = new Set(
      existingNodes.map((n) => (n.data as Record<string, unknown>).label as string).filter(Boolean)
    );

    pushHistory();
    for (const node of newNodes) {
      const label = (node.data as Record<string, unknown>).label as string;
      if (!existingLabels.has(label)) {
        addNode(node);
      }
    }
    const allNodeIds = new Set([...existingNodes.map((n) => n.id), ...newNodes.map((n) => n.id)]);
    for (const edge of newEdges) {
      if (allNodeIds.has(edge.source) && allNodeIds.has(edge.target)) {
        useFlowStore.getState().onConnect({
          source: edge.source,
          target: edge.target,
          sourceHandle: edge.sourceHandle ?? null,
          targetHandle: edge.targetHandle ?? null,
        });
      }
    }
  }

  const canSubmitV2 = prompt.trim().length > 0 && !isGenerating;
  const canSubmitV1 = provider.trim().length > 0 && prompt.trim().length > 0 && !isGenerating;
  const canSubmit = useV2 ? canSubmitV2 : canSubmitV1;
  const hasV2Result = builderResult !== null && builderResult.toolCalls.length > 0;

  return (
    <div className="flex flex-col h-full border-l border-[var(--color-border)] bg-[var(--color-bg-surface)]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 h-9 border-b border-[var(--color-border)] shrink-0">
        <div className="flex items-center gap-1.5">
          <SparklesIcon />
          <span className="text-xs font-medium text-[var(--color-text-primary)]">
            AI Builder
          </span>
          {isGenerating && (
            <span className="text-[10px] text-[var(--color-text-secondary)] animate-pulse ml-1">
              generating…
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => { setUseV2((v) => !v); resetConversation(); }}
            title={useV2 ? "Switch to v1 (Nango AI)" : "Switch to v2 (Direct AI)"}
            className={cn(
              "flex items-center justify-center h-6 px-1.5 rounded text-[9px] font-medium transition-colors cursor-pointer",
              useV2
                ? "text-[var(--color-primary)] bg-[var(--color-primary)]/10"
                : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-overlay)]"
            )}
          >
            {useV2 ? "v2" : "v1"}
          </button>
          {previousDefinition && (
            <button
              onClick={() => setShowDiff((v) => !v)}
              title={showDiff ? "Hide diff" : "Show diff"}
              className={cn(
                "flex items-center justify-center w-6 h-6 rounded transition-colors cursor-pointer",
                showDiff
                  ? "text-[var(--color-primary)] bg-[var(--color-primary)]/10"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-overlay)]"
              )}
            >
              <DiffIcon />
            </button>
          )}
          {generatedDefinition && (
            <button
              onClick={resetConversation}
              title="Start fresh"
              className="flex items-center justify-center w-6 h-6 rounded text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-overlay)] transition-colors cursor-pointer"
            >
              <RefreshIcon />
            </button>
          )}
          <button
            onClick={onClose}
            aria-label="Close AI Builder"
            className="flex items-center justify-center w-6 h-6 rounded text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-overlay)] transition-colors cursor-pointer"
          >
            <CloseIcon />
          </button>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">
        {/* v2 AI Provider selector */}
        {useV2 && (
          <div className="px-3 py-3 border-b border-[var(--color-border)]">
            <label className="block text-[10px] font-medium text-[var(--color-text-secondary)] uppercase tracking-wider mb-1.5">
              AI Provider
            </label>
            <AiProviderSelector
              value={aiProvider}
              onChange={setAiProvider}
              disabled={isGenerating}
            />
          </div>
        )}

        {/* v1 Nango Provider selector (only in v1 mode) */}
        {!useV2 && (
          <div className="px-3 py-3 border-b border-[var(--color-border)]">
            <label className="block text-[10px] font-medium text-[var(--color-text-secondary)] uppercase tracking-wider mb-1.5">
              Provider
            </label>
            <ProviderSelector
              value={provider}
              onChange={setProvider}
              disabled={isGenerating || (isRefinement && !isHistoryFull)}
            />
          </div>
        )}

        {/* Conversation history */}
        <ConversationHistory />

        {/* v2 tool call activity */}
        {useV2 && <ToolCallActivity toolCalls={builderToolCalls} />}

        {/* v2 builder message output */}
        {useV2 && <BuilderMessageOutput />}

        {/* v1 Generated summary */}
        {!useV2 && <GeneratedSummary />}

        {/* v1 Streaming output */}
        {!useV2 && <StreamingOutput />}

        {/* Diff view (inline, appears below the summary when toggled) */}
        {showDiff && previousDefinition && generatedDefinition && (
          <div className="h-64 shrink-0">
            <AiDiffView
              previous={previousDefinition}
              current={generatedDefinition}
              onClose={() => setShowDiff(false)}
            />
          </div>
        )}

        {/* Max turns notice */}
        {isHistoryFull && (
          <div className="mx-3 my-2 flex items-start gap-2 rounded-md bg-[var(--color-warning)]/10 px-3 py-2.5">
            <span className="text-[var(--color-warning)] shrink-0 mt-0.5">⚠</span>
            <div className="text-xs text-[var(--color-warning)] leading-snug">
              Max conversation turns reached.{" "}
              <button
                onClick={resetConversation}
                className="underline underline-offset-2 cursor-pointer font-medium"
              >
                Start fresh
              </button>{" "}
              to continue.
            </div>
          </div>
        )}

        {/* Inline error */}
        {panelError && (
          <div className="mx-3 my-2 flex items-start gap-2 rounded-md bg-[var(--color-error)]/10 px-3 py-2.5">
            <span className="text-[var(--color-error)] shrink-0 mt-0.5">✕</span>
            <div className="flex-1">
              <p className="text-xs text-[var(--color-error)] leading-snug">{panelError}</p>
            </div>
            <button
              onClick={clearPanelError}
              aria-label="Dismiss error"
              className="text-[var(--color-error)] opacity-60 hover:opacity-100 cursor-pointer shrink-0"
            >
              <CloseIcon />
            </button>
          </div>
        )}

        {/* Prompt area */}
        <div className="px-3 py-3 border-t border-[var(--color-border)]">
          <label className="block text-[10px] font-medium text-[var(--color-text-secondary)] uppercase tracking-wider mb-1.5">
            {useV2 ? "Describe integration" : (isRefinement ? "Refine prompt" : "Describe integration")}
          </label>
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isGenerating || isHistoryFull}
            rows={4}
            placeholder={
              useV2
                ? "e.g. Sync all GitHub issues with id, title, state, labels (⌘Enter to build)"
                : isRefinement
                  ? "Describe what to change… (⌘Enter to send)"
                  : "e.g. Sync all GitHub issues to a model with id, title, state, and labels. (⌘Enter to generate)"
            }
            className={cn(
              "w-full px-3 py-2 text-sm rounded-md resize-none",
              "bg-[var(--color-bg-overlay)] border border-[var(--color-border)]",
              "text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)]",
              "focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          />
        </div>
      </div>

      {/* Footer actions */}
      <div className="shrink-0 px-3 py-3 border-t border-[var(--color-border)] flex items-center gap-2">
        {useV2 ? (
          <>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-medium rounded-md transition-colors cursor-pointer",
                canSubmit
                  ? "bg-[var(--color-primary)] text-white hover:opacity-90"
                  : "opacity-40 cursor-not-allowed bg-[var(--color-primary)] text-white"
              )}
            >
              <SparklesIcon />
              {isGenerating ? "Building…" : (hasV2Result ? "Rebuild" : "Build")}
            </button>
            {hasV2Result && (
              <button
                onClick={handleAcceptV2}
                disabled={isGenerating}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-medium rounded-md transition-colors cursor-pointer",
                  !isGenerating
                    ? "bg-[var(--color-primary)] text-white hover:opacity-90"
                    : "opacity-40 cursor-not-allowed bg-[var(--color-primary)] text-white"
                )}
              >
                <CheckIcon />
                Apply to Canvas
              </button>
            )}
          </>
        ) : (
          <>
            {generatedDefinition && !isHistoryFull && (
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-medium rounded-md transition-colors cursor-pointer",
                  canSubmit
                    ? "bg-[var(--color-bg-overlay)] text-[var(--color-text-primary)] hover:bg-[var(--color-border)] border border-[var(--color-border)]"
                    : "opacity-40 cursor-not-allowed bg-[var(--color-bg-overlay)] border border-[var(--color-border)]"
                )}
              >
                <RefreshIcon />
                Refine
              </button>
            )}

            {!generatedDefinition && (
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-medium rounded-md transition-colors cursor-pointer",
                  canSubmit
                    ? "bg-[var(--color-primary)] text-white hover:opacity-90"
                    : "opacity-40 cursor-not-allowed bg-[var(--color-primary)] text-white"
                )}
              >
                <SparklesIcon />
                {isGenerating ? "Generating…" : "Generate"}
              </button>
            )}

            {generatedDefinition && (
              <button
                onClick={handleAcceptV1}
                disabled={isGenerating}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-medium rounded-md transition-colors cursor-pointer",
                  !isGenerating
                    ? "bg-[var(--color-primary)] text-white hover:opacity-90"
                    : "opacity-40 cursor-not-allowed bg-[var(--color-primary)] text-white"
                )}
              >
                <CheckIcon />
                Accept
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
