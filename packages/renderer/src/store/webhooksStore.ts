import { create } from "zustand";
import type { NangoWebhookSettings, NangoUpdateWebhookSettingsRequest } from "@nango-gui/shared";

interface WebhooksState {
  settings: NangoWebhookSettings | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;

  fetchSettings(): Promise<void>;
  updateSettings(patch: NangoUpdateWebhookSettingsRequest): Promise<void>;
}

export const useWebhooksStore = create<WebhooksState>((set) => ({
  settings: null,
  isLoading: false,
  isSaving: false,
  error: null,

  fetchSettings: async () => {
    if (!window.nango) return;
    set({ isLoading: true, error: null });
    try {
      const res = await window.nango.getWebhookSettings();
      if (res.status === "error") {
        set({ error: res.error, isLoading: false });
        return;
      }
      set({ settings: res.data, isLoading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to fetch webhook settings",
        isLoading: false,
      });
    }
  },

  updateSettings: async (patch: NangoUpdateWebhookSettingsRequest) => {
    if (!window.nango) return;
    set({ isSaving: true, error: null });
    try {
      const res = await window.nango.updateWebhookSettings(patch);
      if (res.status === "error") {
        set({ error: res.error, isSaving: false });
        return;
      }
      set({ settings: res.data, isSaving: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to update webhook settings",
        isSaving: false,
      });
    }
  },
}));
