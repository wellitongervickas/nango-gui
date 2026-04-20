import type { AuthErrorType } from "@nangohq/frontend";

export type HighlightField =
  | "oauthClientId"
  | "oauthClientSecret"
  | "userScopes"
  | "authParams";

export interface ConnectError {
  errorType: AuthErrorType;
  message: string;
  providerError?: string;
  highlightField?: HighlightField;
}

/** True when the error originates from the external OAuth provider rather than Nango itself. */
export function isProviderOAuthError(errorType: AuthErrorType): boolean {
  return errorType === "connection_validation_failed" || errorType === "connection_test_failed";
}

/**
 * Extracts the provider-specific error detail from the raw error message.
 * Provider errors often arrive as structured strings like
 * "invalid_scope: The scope 'foo' is not valid" or
 * "access_denied: The resource owner denied the request".
 * Returns undefined when no provider detail can be isolated.
 */
export function extractProviderDetail(errorType: AuthErrorType, rawMessage: string): string | undefined {
  if (!rawMessage || !isProviderOAuthError(errorType)) return undefined;
  return rawMessage;
}

/** Maps Nango AuthErrorType codes to developer-friendly messages. */
export function getFriendlyErrorMessage(errorType: AuthErrorType, rawMessage: string): string {
  switch (errorType) {
    case "connection_validation_failed":
      return rawMessage
        ? `Provider rejected the authorization: ${rawMessage}`
        : "The credentials were rejected by the provider. Check your client ID, secret, or scopes and retry.";
    case "missing_credentials":
      return "Missing required credentials. Fill in all required fields and retry.";
    case "blocked_by_browser":
      return "The OAuth popup was blocked by your browser. Allow popups for this window and try again.";
    case "window_closed":
      return "The authorization window was closed before completing. Click Connect to try again.";
    case "connection_test_failed":
      return rawMessage
        ? `Provider connectivity check failed: ${rawMessage}`
        : "The provider accepted the credentials but the connectivity check failed. The integration may have permission or network issues.";
    case "missing_connect_session_token":
      return "The session token expired. Click Connect to start a fresh authorization.";
    case "invalid_host_url":
      return "Invalid Nango server URL. Check your server URL in the app settings.";
    case "resource_capped":
      return "You have reached the connection limit for this integration.";
    case "missing_auth_token":
      return "Authorization token missing. Retry the connection.";
    case "unknown_error":
    default:
      return rawMessage || "An unexpected error occurred. Try again or check Nango server logs.";
  }
}

/** Short human-readable label for the error category. */
export function getErrorTitle(errorType: AuthErrorType): string {
  if (isProviderOAuthError(errorType)) return "Provider error";
  switch (errorType) {
    case "blocked_by_browser": return "Popup blocked";
    case "window_closed": return "Authorization cancelled";
    case "missing_credentials": return "Missing credentials";
    case "missing_connect_session_token": return "Session expired";
    case "invalid_host_url": return "Configuration error";
    case "resource_capped": return "Limit reached";
    case "missing_auth_token": return "Token missing";
    default: return "Authorization failed";
  }
}

/**
 * Best-effort field identification from error type + message.
 * Returns undefined when the source field is not identifiable.
 */
export function getErrorHighlightField(
  errorType: AuthErrorType,
  rawMessage: string,
): HighlightField | undefined {
  if (errorType === "connection_validation_failed") {
    const msg = rawMessage.toLowerCase();
    if (msg.includes("client_secret") || msg.includes("client secret")) return "oauthClientSecret";
    if (msg.includes("client_id") || msg.includes("client id")) return "oauthClientId";
    if (msg.includes("scope")) return "userScopes";
    if (msg.includes("param")) return "authParams";
  }
  if (errorType === "missing_credentials") return "oauthClientId";
  return undefined;
}
