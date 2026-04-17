import { create } from "zustand";
import type {
  AiConversationTurn,
  AiGenerationResult,
  AiStreamTokenEvent,
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

  setProvider(provider: string): void;
  setPrompt(prompt: string): void;

  /**
   * Invoke the AI generate endpoint and update state.
   * Handles streaming tokens if the preload bridge supports them.
   */
  generate(): Promise<void>;

  /**
   * Invoke the AI refine endpoint with the current prompt and conversation.
   */
  refine(): Promise<void>;

  /** Append a streaming token to partialOutput. Called by the stream listener. */
  applyStreamToken(event: AiStreamTokenEvent): void;

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

  setProvider: (provider) => set({ provider }),
  setPrompt: (prompt) => set({ prompt }),

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

  applyStreamToken: (event) => {
    if (event.done && event.result) {
      set({ partialOutput: "" });
    } else {
      set((s) => ({ partialOutput: s.partialOutput + event.token }));
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
    }),

  clearPanelError: () => set({ panelError: null }),
}));
