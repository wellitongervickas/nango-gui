import { create } from "zustand";
import type {
  AiConversationTurn,
  AiGenerationResult,
  AiStreamTokenEvent,
  AiProviderType,
  AiBuilderToolCallEvent,
  AiBuilderRunResult,
} from "@nango-gui/shared";
import { notifyIpcError } from "./notifyError";

const MAX_TURNS = 10;

interface AiState {
  /** Provider key selected in the builder (e.g. "github"). */
  provider: string;
  /** Current prompt text typed by the user. */
  prompt: string;
  /** True while a generate/refine request is in-flight. */
  isGenerating: boolean;
  /** The latest fully-resolved definition returned by the AI endpoint. */
  generatedDefinition: AiGenerationResult | null;
  /**
   * The definition that was active before the most recent refinement,
   * used to power the diff view.
   */
  previousDefinition: AiGenerationResult | null;
  /** Partial streamed output accumulated while isGenerating is true. */
  partialOutput: string;
  /** Full conversation history for multi-turn context (max MAX_TURNS entries). */
  conversationHistory: AiConversationTurn[];
  /** Inline panel error message (400-class errors, bad prompt, etc.). */
  panelError: string | null;
  /** Whether the conversation has hit the max turn limit. */
  isHistoryFull: boolean;

  // ── AI Builder v2 state ──────────────────────────────────────────────
  /** Selected AI provider for v2 (OpenAI or Anthropic). */
  aiProvider: AiProviderType;
  /** Tool calls accumulated during the current v2 builder run. */
  builderToolCalls: AiBuilderToolCallEvent[];
  /** Latest AI text message from the v2 builder. */
  builderMessage: string;
  /** Full result from the last completed v2 builder run. */
  builderResult: AiBuilderRunResult | null;

  setProvider(provider: string): void;
  setPrompt(prompt: string): void;
  setAiProvider(aiProvider: AiProviderType): void;

  /**
   * Invoke the AI generate endpoint and update state.
   * Handles streaming tokens if the preload bridge supports them.
   */
  generate(): Promise<void>;

  /**
   * Invoke the AI refine endpoint with the current prompt and conversation.
   */
  refine(): Promise<void>;

  /**
   * Run the AI builder v2 tool-calling loop via window.aiBuilder.run().
   */
  runBuilder(): Promise<void>;

  /** Append a streaming token to partialOutput. Called by the stream listener. */
  applyStreamToken(event: AiStreamTokenEvent): void;

  /** Record a tool call event from the v2 builder stream. */
  applyBuilderToolCall(event: AiBuilderToolCallEvent): void;

  /** Record an AI text message from the v2 builder stream. */
  applyBuilderMessage(text: string, done: boolean): void;

  /** Reset the conversation and all generated state to start fresh. */
  resetConversation(): void;

  clearPanelError(): void;
}

export const useAiStore = create<AiState>((set, get) => ({
  provider: "",
  prompt: "",
  isGenerating: false,
  generatedDefinition: null,
  previousDefinition: null,
  partialOutput: "",
  conversationHistory: [],
  panelError: null,
  isHistoryFull: false,

  // v2 state
  aiProvider: "openai" as AiProviderType,
  builderToolCalls: [],
  builderMessage: "",
  builderResult: null,

  setProvider: (provider) => set({ provider }),
  setPrompt: (prompt) => set({ prompt }),
  setAiProvider: (aiProvider) => set({ aiProvider }),

  generate: async () => {
    const { provider, prompt, conversationHistory } = get();
    if (!provider || !prompt.trim()) return;
    if (!window.nango?.aiGenerateIntegration) return;

    set({ isGenerating: true, partialOutput: "", panelError: null });

    const res = await window.nango.aiGenerateIntegration({
      provider,
      prompt: prompt.trim(),
      conversationHistory: conversationHistory.length > 0 ? conversationHistory : undefined,
    });

    if (res.status === "ok") {
      const newHistory: AiConversationTurn[] = [
        ...conversationHistory,
        { role: "user" as const, content: prompt.trim() },
        { role: "assistant" as const, content: res.data.description },
      ].slice(-MAX_TURNS);

      set({
        isGenerating: false,
        generatedDefinition: res.data,
        previousDefinition: null,
        partialOutput: "",
        conversationHistory: newHistory,
        isHistoryFull: newHistory.length >= MAX_TURNS,
        prompt: "",
      });
    } else {
      notifyIpcError(res);
      set({
        isGenerating: false,
        partialOutput: "",
        // Only show inline error for bad-prompt (UNKNOWN); rate-limit shown as toast
        panelError: res.errorCode === "UNKNOWN" ? res.error : null,
      });
    }
  },

  refine: async () => {
    const { provider, prompt, conversationHistory, generatedDefinition } = get();
    if (!provider || !prompt.trim() || !generatedDefinition) return;
    if (!window.nango?.aiRefineIntegration) return;

    set({
      isGenerating: true,
      partialOutput: "",
      panelError: null,
      previousDefinition: generatedDefinition,
    });

    const res = await window.nango.aiRefineIntegration({
      provider,
      prompt: prompt.trim(),
      conversationHistory,
      currentDefinition: generatedDefinition,
    });

    if (res.status === "ok") {
      const newHistory: AiConversationTurn[] = [
        ...conversationHistory,
        { role: "user" as const, content: prompt.trim() },
        { role: "assistant" as const, content: res.data.description },
      ].slice(-MAX_TURNS);

      set({
        isGenerating: false,
        generatedDefinition: res.data,
        partialOutput: "",
        conversationHistory: newHistory,
        isHistoryFull: newHistory.length >= MAX_TURNS,
        prompt: "",
      });
    } else {
      notifyIpcError(res);
      set({
        isGenerating: false,
        partialOutput: "",
        previousDefinition: null,
        panelError: res.errorCode === "UNKNOWN" ? res.error : null,
      });
    }
  },

  runBuilder: async () => {
    const { aiProvider, prompt, conversationHistory } = get();
    if (!prompt.trim()) return;
    if (!window.aiBuilder?.run) return;

    set({
      isGenerating: true,
      builderToolCalls: [],
      builderMessage: "",
      builderResult: null,
      panelError: null,
    });

    const res = await window.aiBuilder.run({
      aiProvider,
      prompt: prompt.trim(),
      conversationHistory: conversationHistory.length > 0 ? conversationHistory : undefined,
    });

    if (res.status === "ok") {
      const newHistory: AiConversationTurn[] = [
        ...conversationHistory,
        { role: "user" as const, content: prompt.trim() },
        { role: "assistant" as const, content: res.data.summary },
      ].slice(-MAX_TURNS);

      set({
        isGenerating: false,
        builderResult: res.data,
        builderToolCalls: res.data.toolCalls,
        builderMessage: res.data.summary,
        conversationHistory: newHistory,
        isHistoryFull: newHistory.length >= MAX_TURNS,
        prompt: "",
      });
    } else {
      notifyIpcError(res);
      set({
        isGenerating: false,
        panelError: res.errorCode === "UNKNOWN" ? res.error : null,
      });
    }
  },

  applyStreamToken: (event) => {
    if (event.done && event.result) {
      set({ partialOutput: "" });
    } else {
      set((s) => ({ partialOutput: s.partialOutput + event.token }));
    }
  },

  applyBuilderToolCall: (event) => {
    set((s) => ({ builderToolCalls: [...s.builderToolCalls, event] }));
  },

  applyBuilderMessage: (text, done) => {
    if (done) {
      set({ builderMessage: text });
    } else {
      set((s) => ({ builderMessage: s.builderMessage + text }));
    }
  },

  resetConversation: () =>
    set({
      prompt: "",
      isGenerating: false,
      generatedDefinition: null,
      previousDefinition: null,
      partialOutput: "",
      conversationHistory: [],
      panelError: null,
      isHistoryFull: false,
      builderToolCalls: [],
      builderMessage: "",
      builderResult: null,
    }),

  clearPanelError: () => set({ panelError: null }),
}));
