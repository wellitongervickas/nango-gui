import type { ConnectUIProps } from "@nangohq/frontend";
import type { AppTheme } from "@nango-gui/shared";

/** Build Connect UI display options from the user's settings. */
export function buildConnectUIOptions(
  theme: AppTheme,
  _primaryColor: string | null,
): Pick<ConnectUIProps, "themeOverride"> {
  return {
    themeOverride: theme,
  };
}
