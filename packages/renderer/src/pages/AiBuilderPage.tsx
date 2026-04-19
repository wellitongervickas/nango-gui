import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import Editor from "@monaco-editor/react";
import type { NangoProvider, AiProviderType } from "@nango-gui/shared";
import { useAiStore } from "@/store/aiStore";
import { useFlowStore } from "@/store/flowStore";
import { useProjectStore } from "@/store/projectStore";
import { graphToTypeScript, type GeneratedFile } from "@/codegen/typescript-generator";
import { cn } from "@/lib/utils";

// ── Icons ──────────────────────────────────────────────────────────────────

function SparklesIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
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

function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <polygon points="6 3 20 12 6 21 6 3" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="6" y="6" width="12" height="12" rx="1" />
    </svg>
  );
}

function KeyIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z" />
      <circle cx="16.5" cy="7.5" r=".5" fill="currentColor" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  );
}

function DeployIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v12" /><path d="m8 11 4 4 4-4" /><path d="M8 5H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-4" />
    </svg>
  );
}

// ── AI Provider Selector ────────────────────────────────────────────────────

const AI_PROVIDERS: { value: AiProviderType; label: string }[] = [
  { value: "anthropic", label: "Anthropic Claude" },
  { value: "openai", label: "OpenAI GPT-4o" },
];

// ── API Key Manager ─────────────────────────────────────────────────────────

function ApiKeyManager({ provider, disabled }: { provider: AiProviderType; disabled: boolean }) {
  const [maskedKey, setMaskedKey] = useState<string | null>(null);
  const [keyExists, setKeyExists] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newKey, setNewKey] = useState("");
  const [saving, setSaving] = useState(false);

  const loadKeyStatus = useCallback(async () => {
    if (!window.aiBuilder?.loadProviderKey) return;
    setLoading(true);
    try {
      const res = await window.aiBuilder.loadProviderKey({ provider });
      if (res.status === "ok") {
        setKeyExists(res.data.exists);
        setMaskedKey(res.data.maskedKey);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [provider]);

  useEffect(() => { loadKeyStatus(); }, [loadKeyStatus]);

  async function handleSave() {
    if (!newKey.trim() || !window.aiBuilder?.saveProviderKey) return;
    setSaving(true);
    try {
      const res = await window.aiBuilder.saveProviderKey({ provider, apiKey: newKey.trim() });
      if (res.status === "ok") { setNewKey(""); await loadKeyStatus(); }
    } finally { setSaving(false); }
  }

  async function handleClear() {
    if (!window.aiBuilder?.clearProviderKey) return;
    try {
      const res = await window.aiBuilder.clearProviderKey({ provider });
      if (res.status === "ok") { setKeyExists(false); setMaskedKey(null); }
    } catch { /* ignore */ }
  }

  if (loading) {
    return <span className="text-[10px] text-[var(--color-text-secondary)] animate-pulse">Checking key…</span>;
  }

  if (keyExists) {
    return (
      <div className="flex items-center gap-2">
        <KeyIcon />
        <span className="text-xs text-[var(--color-text-secondary)] truncate">{maskedKey}</span>
        <button onClick={handleClear} disabled={disabled} title="Remove API key"
          className="w-5 h-5 flex items-center justify-center rounded text-[var(--color-text-secondary)] hover:text-[var(--color-error)] hover:bg-[var(--color-error)]/10 transition-colors cursor-pointer disabled:opacity-50">
          <TrashIcon />
        </button>
      </div>
    );
  }

  return (
    <div className="flex gap-1.5">
      <input type="password" value={newKey} onChange={(e) => setNewKey(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
        disabled={disabled || saving}
        placeholder={provider === "openai" ? "sk-..." : "sk-ant-..."}
        className="flex-1 px-2.5 py-1.5 text-xs rounded-md bg-[var(--color-bg-overlay)] border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-500)] disabled:opacity-50"
        aria-label="API key"
      />
      <button onClick={handleSave} disabled={disabled || saving || !newKey.trim()}
        className={cn("px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer",
          newKey.trim() && !saving ? "bg-[var(--color-brand-500)] text-white hover:opacity-90" : "opacity-40 cursor-not-allowed bg-[var(--color-brand-500)] text-white"
        )}>
        {saving ? "…" : "Save"}
      </button>
    </div>
  );
}

// ── Provider Selector ────────────────────────────────────────────────────────

function ProviderSelector({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled: boolean }) {
  const [providers, setProviders] = useState<NangoProvider[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState(value);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!window.nango?.listProviders) return;
    setLoading(true);
    window.nango.listProviders()
      .then((res) => { if (res.status === "ok") setProviders(res.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { setQuery(value); }, [value]);

  const filtered = query.length > 0
    ? providers.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()) || p.display_name.toLowerCase().includes(query.toLowerCase())).slice(0, 8)
    : providers.slice(0, 8);

  const commitValue = useCallback((val: string) => { onChange(val); setQuery(val); setShowSuggestions(false); }, [onChange]);

  useEffect(() => {
    function handlePointerDown(e: PointerEvent) {
      if (inputRef.current?.contains(e.target as Node) || listRef.current?.contains(e.target as Node)) return;
      setShowSuggestions(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  return (
    <div className="relative">
      <input ref={inputRef} type="text" placeholder={loading ? "Loading…" : "Provider (e.g. github)"}
        value={query} disabled={disabled || loading}
        onChange={(e) => { setQuery(e.target.value); onChange(e.target.value); setShowSuggestions(true); }}
        onFocus={() => setShowSuggestions(true)}
        onKeyDown={(e) => { if (e.key === "Escape") setShowSuggestions(false); if (e.key === "Enter" && filtered.length > 0) commitValue(filtered[0].name); }}
        className="w-full px-3 py-2 text-sm rounded-md bg-[var(--color-bg-overlay)] border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-500)] disabled:opacity-50"
        aria-label="Provider" aria-autocomplete="list"
      />
      {showSuggestions && filtered.length > 0 && (
        <ul ref={listRef} role="listbox"
          className="absolute z-50 w-full mt-1 max-h-48 overflow-y-auto rounded-md border border-[var(--color-border)] bg-[var(--color-bg-surface)] shadow-lg">
          {filtered.map((p) => (
            <li key={p.name} role="option" aria-selected={p.name === value}
              onPointerDown={() => commitValue(p.name)}
              className={cn("flex items-center gap-2 px-3 py-2 text-sm cursor-pointer select-none hover:bg-[var(--color-bg-overlay)]",
                p.name === value && "bg-[var(--color-brand-500)]/10 text-[var(--color-brand-500)]"
              )}>
              {p.logo_url && <img src={p.logo_url} alt="" className="w-4 h-4 rounded-sm shrink-0 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />}
              <span className="truncate font-medium">{p.display_name}</span>
              <span className="ml-auto text-[10px] text-[var(--color-text-secondary)] shrink-0">{p.name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Dry-run panel (inline) ──────────────────────────────────────────────────

interface LogLine { stream: "stdout" | "stderr"; text: string; ts: number; }

function InlineDryrun() {
  const [status, setStatus] = useState<"idle" | "running" | "success" | "error">("idle");
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [runId, setRunId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [logs]);

  useEffect(() => {
    if (!window.cli?.onOutput || !window.cli?.onExit) return;
    window.cli.onOutput((event) => {
      setLogs((prev) => [...prev, { stream: event.stream ?? "stdout", text: event.line, ts: Date.now() }]);
    });
    window.cli.onExit((event) => {
      setStatus(event.code === 0 ? "success" : "error");
    });
    return () => { window.cli?.removeAllOutputListeners?.(); window.cli?.removeAllExitListeners?.(); };
  }, []);

  async function handleRun() {
    if (!window.cli?.run) return;
    setStatus("running");
    setLogs([]);
    const res = await window.cli.run({ command: "dryrun", args: [] });
    if (res.status === "ok") {
      setRunId(res.data.runId);
    } else {
      setStatus("error");
      setLogs([{ stream: "stderr", text: res.error, ts: Date.now() }]);
    }
  }

  async function handleStop() {
    if (!runId || !window.cli?.abort) return;
    await window.cli.abort({ runId });
    setStatus("idle");
  }

  return (
    <div className="border-t border-[var(--color-border)]">
      <div className="flex items-center justify-between px-4 py-2 bg-[var(--color-bg-overlay)]/40">
        <span className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">Dry Run</span>
        <div className="flex items-center gap-2">
          {status === "running" ? (
            <button onClick={handleStop} className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md bg-[var(--color-error)]/10 text-[var(--color-error)] hover:bg-[var(--color-error)]/20 transition-colors cursor-pointer">
              <StopIcon /> Stop
            </button>
          ) : (
            <button onClick={handleRun} className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md bg-[var(--color-brand-500)] text-white hover:opacity-90 transition-colors cursor-pointer">
              <PlayIcon /> Run Test
            </button>
          )}
          {status === "success" && <span className="text-xs text-[var(--color-success)]">Passed</span>}
          {status === "error" && <span className="text-xs text-[var(--color-error)]">Failed</span>}
        </div>
      </div>
      {logs.length > 0 && (
        <div className="max-h-48 overflow-y-auto bg-[var(--color-bg-base)] px-4 py-2 font-mono text-[11px] leading-relaxed">
          {logs.map((line, i) => (
            <div key={i} className={line.stream === "stderr" ? "text-[var(--color-error)]" : "text-[var(--color-text-secondary)]"}>
              {line.text}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export function AiBuilderPage() {
  const provider = useAiStore((s) => s.provider);
  const setProvider = useAiStore((s) => s.setProvider);
  const prompt = useAiStore((s) => s.prompt);
  const setPrompt = useAiStore((s) => s.setPrompt);
  const isGenerating = useAiStore((s) => s.isGenerating);
  const panelError = useAiStore((s) => s.panelError);
  const clearPanelError = useAiStore((s) => s.clearPanelError);
  const isHistoryFull = useAiStore((s) => s.isHistoryFull);
  const resetConversation = useAiStore((s) => s.resetConversation);
  const partialOutput = useAiStore((s) => s.partialOutput);

  // v2 builder
  const aiProvider = useAiStore((s) => s.aiProvider);
  const setAiProvider = useAiStore((s) => s.setAiProvider);
  const runBuilder = useAiStore((s) => s.runBuilder);
  const applyBuilderToolCall = useAiStore((s) => s.applyBuilderToolCall);
  const applyBuilderMessage = useAiStore((s) => s.applyBuilderMessage);
  const applyStreamToken = useAiStore((s) => s.applyStreamToken);
  const builderToolCalls = useAiStore((s) => s.builderToolCalls);
  const builderMessage = useAiStore((s) => s.builderMessage);
  const builderResult = useAiStore((s) => s.builderResult);
  const conversationHistory = useAiStore((s) => s.conversationHistory);

  // Code preview from flow store
  const project = useProjectStore((s) => s.project);
  const nodes = useFlowStore((s) => s.nodes);
  const edges = useFlowStore((s) => s.edges);

  const [selectedFile, setSelectedFile] = useState(0);
  const [showDryrun, setShowDryrun] = useState(false);
  const [exporting, setExporting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const activityRef = useRef<HTMLDivElement>(null);

  const tsFiles = useMemo(() => graphToTypeScript(project, nodes, edges), [project, nodes, edges]);
  const currentFile: GeneratedFile | undefined = tsFiles[selectedFile];
  const displayCode = currentFile?.content ?? "// Describe your integration and click Build to generate code";

  // Register AI stream listeners
  useEffect(() => {
    if (window.nango?.onAiStreamToken) {
      window.nango.onAiStreamToken(applyStreamToken);
    }
    return () => { window.nango?.removeAllAiStreamListeners?.(); };
  }, [applyStreamToken]);

  useEffect(() => {
    if (!window.aiBuilder?.onToolCall || !window.aiBuilder?.onMessage) return;
    window.aiBuilder.onToolCall(applyBuilderToolCall);
    window.aiBuilder.onMessage((event) => { applyBuilderMessage(event.text, event.done); });
    return () => { window.aiBuilder?.removeAllListeners?.(); };
  }, [applyBuilderToolCall, applyBuilderMessage]);

  // Auto-focus
  useEffect(() => { const t = setTimeout(() => textareaRef.current?.focus(), 50); return () => clearTimeout(t); }, []);

  // Scroll activity to bottom
  useEffect(() => { activityRef.current?.scrollTo(0, activityRef.current.scrollHeight); }, [builderToolCalls, builderMessage, partialOutput]);

  function handleSubmit() {
    if (!prompt.trim() || isGenerating) return;
    clearPanelError();
    runBuilder();
  }

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); handleSubmit(); }
  }, [prompt, isGenerating]);

  const exportFiles = useCallback(async () => {
    if (!window.project) return;
    const res = await window.project.showDirectoryDialog();
    if (res.status !== "ok" || !res.data.filePath) return;
    const dir = res.data.filePath;
    setExporting(true);
    try {
      for (const file of tsFiles) { await window.project.writeFile({ filePath: `${dir}/${file.path}`, data: file.content }); }
    } finally { setExporting(false); }
  }, [tsFiles]);

  const canSubmit = prompt.trim().length > 0 && !isGenerating;

  return (
    <div className="flex flex-col h-full bg-[var(--color-bg-base)]">
      <div className="flex flex-1 min-h-0">
        {/* ── Left: Configuration & Prompt ──────────────────────────────── */}
        <div className="w-[380px] shrink-0 flex flex-col border-r border-[var(--color-border)] bg-[var(--color-bg-surface)]">
          {/* Header */}
          <div className="flex items-center gap-2 px-4 h-11 border-b border-[var(--color-border)] shrink-0">
            <SparklesIcon />
            <span className="text-sm font-semibold text-[var(--color-text-primary)]">AI Builder</span>
            {isGenerating && <span className="text-[10px] text-[var(--color-text-secondary)] animate-pulse ml-1">building…</span>}
          </div>

          {/* Config */}
          <div className="px-4 py-3 border-b border-[var(--color-border)] space-y-3">
            <div>
              <label className="block text-[10px] font-medium text-[var(--color-text-secondary)] uppercase tracking-wider mb-1.5">AI Provider</label>
              <select value={aiProvider} onChange={(e) => setAiProvider(e.target.value as AiProviderType)} disabled={isGenerating}
                className="w-full px-3 py-2 text-sm rounded-md bg-[var(--color-bg-overlay)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-500)] disabled:opacity-50 cursor-pointer"
                aria-label="AI Provider">
                {AI_PROVIDERS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-medium text-[var(--color-text-secondary)] uppercase tracking-wider mb-1.5">API Key</label>
              <ApiKeyManager provider={aiProvider} disabled={isGenerating} />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-[var(--color-text-secondary)] uppercase tracking-wider mb-1.5">Integration Provider</label>
              <ProviderSelector value={provider} onChange={setProvider} disabled={isGenerating} />
            </div>
          </div>

          {/* Conversation + Activity (scrollable) */}
          <div ref={activityRef} className="flex-1 overflow-y-auto">
            {/* History */}
            {conversationHistory.length > 0 && (
              <div className="px-4 py-3 border-b border-[var(--color-border)] space-y-2">
                <p className="text-[10px] font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">
                  Conversation ({conversationHistory.length} turns)
                </p>
                {conversationHistory.map((turn, i) => (
                  <div key={i} className={cn("text-xs rounded-md px-2.5 py-1.5",
                    turn.role === "user" ? "bg-[var(--color-brand-500)]/10 text-[var(--color-brand-500)]" : "bg-[var(--color-bg-overlay)] text-[var(--color-text-secondary)]"
                  )}>
                    <span className="font-medium uppercase text-[9px] tracking-wider opacity-60 block mb-0.5">{turn.role === "user" ? "You" : "AI"}</span>
                    <p className="line-clamp-3">{turn.content}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Builder tool calls */}
            {(builderToolCalls.length > 0 || builderMessage) && (
              <div className="px-4 py-3 border-b border-[var(--color-border)] space-y-2">
                <p className="text-[10px] font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">Builder Activity</p>
                {builderToolCalls.map((tc, i) => (
                  <div key={i} className="text-xs rounded-md bg-[var(--color-bg-overlay)] px-2.5 py-1.5">
                    <span className="font-mono text-[var(--color-brand-500)]">{tc.tool}</span>
                    <span className="text-[var(--color-text-secondary)] ml-1">
                      {tc.tool === "addNode" && `→ ${(tc.args.type as string) ?? "node"}`}
                      {tc.tool === "addEdge" && `→ ${tc.args.from as string} → ${tc.args.to as string}`}
                      {tc.tool === "setIntegrationMeta" && `→ ${(tc.args.name as string) ?? ""}`}
                      {tc.tool === "getAvailableProviders" && (tc.args.search ? `→ "${tc.args.search as string}"` : "")}
                    </span>
                  </div>
                ))}
                {builderMessage && (
                  <div className="text-xs rounded-md bg-[var(--color-bg-overlay)] px-2.5 py-2">
                    <p className="text-[var(--color-text-primary)] whitespace-pre-wrap leading-snug">{builderMessage}</p>
                  </div>
                )}
              </div>
            )}

            {/* Streaming output */}
            {(isGenerating || partialOutput) && (
              <div className="px-4 py-3 border-b border-[var(--color-border)]">
                <div className="rounded-md bg-[var(--color-bg-overlay)] p-2.5 max-h-32 overflow-y-auto">
                  <pre className="text-[10px] text-[var(--color-text-secondary)] whitespace-pre-wrap font-mono leading-relaxed">
                    {partialOutput || "Generating…"}
                    {isGenerating && <span className="animate-pulse">▋</span>}
                  </pre>
                </div>
              </div>
            )}

            {/* Errors */}
            {panelError && (
              <div className="mx-4 my-3 flex items-start gap-2 rounded-md bg-[var(--color-error)]/10 px-3 py-2.5">
                <span className="text-[var(--color-error)] shrink-0 mt-0.5">✕</span>
                <div className="flex-1">
                  <p className="text-xs text-[var(--color-error)] leading-snug">{panelError}</p>
                  <button onClick={() => { clearPanelError(); handleSubmit(); }}
                    className="mt-1.5 text-xs font-medium text-[var(--color-brand-400)] hover:underline cursor-pointer">
                    Auto-iterate
                  </button>
                </div>
              </div>
            )}

            {/* Max turns */}
            {isHistoryFull && (
              <div className="mx-4 my-3 flex items-start gap-2 rounded-md bg-[var(--color-warning)]/10 px-3 py-2.5">
                <span className="text-[var(--color-warning)] shrink-0 mt-0.5">⚠</span>
                <div className="text-xs text-[var(--color-warning)] leading-snug">
                  Max conversation turns reached.{" "}
                  <button onClick={resetConversation} className="underline underline-offset-2 cursor-pointer font-medium">Start fresh</button>
                </div>
              </div>
            )}
          </div>

          {/* Prompt + actions */}
          <div className="shrink-0 border-t border-[var(--color-border)]">
            <div className="px-4 py-3">
              <label className="block text-[10px] font-medium text-[var(--color-text-secondary)] uppercase tracking-wider mb-1.5">
                {builderResult ? "Refine prompt" : "Describe integration"}
              </label>
              <textarea ref={textareaRef} value={prompt} onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown} disabled={isGenerating || isHistoryFull} rows={3}
                placeholder={builderResult ? "Describe what to change… (Ctrl+Enter to send)" : "e.g. Sync all GitHub issues with id, title, state, and labels (Ctrl+Enter)"}
                className="w-full px-3 py-2 text-sm rounded-md resize-none bg-[var(--color-bg-overlay)] border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-500)] disabled:opacity-50"
              />
            </div>
            <div className="px-4 pb-3 flex items-center gap-2">
              <button onClick={handleSubmit} disabled={!canSubmit}
                className={cn("flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-medium rounded-md transition-colors cursor-pointer",
                  canSubmit ? "bg-[var(--color-brand-500)] text-white hover:opacity-90" : "opacity-40 cursor-not-allowed bg-[var(--color-brand-500)] text-white"
                )}>
                {builderResult ? <><RefreshIcon /> Refine</> : <><SparklesIcon /> {isGenerating ? "Building…" : "Build"}</>}
              </button>
              {builderResult && (
                <button onClick={resetConversation} title="Start fresh"
                  className="flex items-center justify-center w-8 h-8 rounded-md text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-overlay)] transition-colors cursor-pointer">
                  <RefreshIcon />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Right: Code Preview ───────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Code header */}
          <div className="flex items-center justify-between px-4 h-11 border-b border-[var(--color-border)] shrink-0 bg-[var(--color-bg-surface)]">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">Generated TypeScript</span>
              {tsFiles.length > 0 && (
                <span className="text-[10px] text-[var(--color-text-secondary)]">({tsFiles.length} file{tsFiles.length !== 1 ? "s" : ""})</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowDryrun((v) => !v)}
                className={cn("flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer",
                  showDryrun
                    ? "bg-[var(--color-brand-500)]/10 text-[var(--color-brand-500)]"
                    : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-overlay)]"
                )}>
                <PlayIcon /> Test
              </button>
              <button onClick={exportFiles} disabled={exporting || tsFiles.length === 0}
                className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-overlay)] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
                <DeployIcon /> {exporting ? "Exporting…" : "Export"}
              </button>
            </div>
          </div>

          {/* File tabs */}
          {tsFiles.length > 1 && (
            <div className="flex items-center gap-1 px-4 py-1.5 border-b border-[var(--color-border)] overflow-x-auto shrink-0 bg-[var(--color-bg-surface)]">
              {tsFiles.map((file, i) => (
                <button key={file.path} onClick={() => setSelectedFile(i)}
                  className={cn("px-2 py-0.5 text-[10px] rounded whitespace-nowrap transition-colors cursor-pointer",
                    i === selectedFile ? "bg-[var(--color-brand-500)]/10 text-[var(--color-brand-500)] font-medium" : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-overlay)]"
                  )}>
                  {file.path}
                </button>
              ))}
            </div>
          )}

          {/* Monaco editor */}
          <div className="flex-1 min-h-0">
            <Editor language="typescript" value={displayCode} theme="vs-dark"
              options={{ readOnly: true, minimap: { enabled: false }, fontSize: 12, lineNumbers: "on", scrollBeyondLastLine: false, wordWrap: "on", automaticLayout: true, padding: { top: 8 } }}
            />
          </div>

          {/* Inline dry-run */}
          {showDryrun && <InlineDryrun />}
        </div>
      </div>
    </div>
  );
}
