import { useHashRoute, navigate } from "../../lib/router";
import { cn } from "../../lib/utils";

interface NavItem {
  label: string;
  route: string;
  disabled?: boolean;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: "BUILD",
    items: [
      { label: "Canvas", route: "canvas" },
      { label: "AI Builder", route: "ai-builder" },
    ],
  },
  {
    title: "DATA",
    items: [
      { label: "Connections", route: "connections" },
      { label: "Integrations", route: "integrations" },
      { label: "Syncs", route: "syncs" },
      { label: "Records", route: "records" },
      { label: "Actions", route: "actions" },
    ],
  },
  {
    title: "MONITOR",
    items: [
      { label: "Dashboard", route: "dashboard" },
      { label: "Webhook Inspector", route: "webhooks" },
      { label: "MCP Servers", route: "mcp" },
    ],
  },
];

function isRouteActive(route: string, currentRoute: string): boolean {
  if (route === "dashboard") {
    return currentRoute === "/" || currentRoute === "dashboard";
  }
  return currentRoute === route;
}

export function NavSidebar() {
  const currentRoute = useHashRoute();

  return (
    <aside className="w-[200px] shrink-0 bg-[var(--color-surface)] border-r border-[var(--color-border)] flex flex-col overflow-y-auto">
      <nav className="flex-1 py-3 px-2 flex flex-col gap-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.title}>
            <h3 className="px-2 mb-1 text-[10px] font-semibold tracking-wider text-[var(--color-text-muted)] uppercase">
              {group.title}
            </h3>
            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const active = !item.disabled && isRouteActive(item.route, currentRoute);
                return (
                  <li key={item.route}>
                    <button
                      onClick={() => {
                        if (!item.disabled) navigate(item.route);
                      }}
                      disabled={item.disabled}
                      className={cn(
                        "w-full text-left px-2 py-1.5 text-xs rounded-md transition-colors flex items-center justify-between gap-1",
                        item.disabled
                          ? "text-[var(--color-text-muted)]/50 cursor-default"
                          : active
                            ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-medium"
                            : "text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)]/50 cursor-pointer"
                      )}
                    >
                      <span>{item.label}</span>
                      {item.disabled && (
                        <span className="text-[9px] px-1 py-0.5 rounded bg-[var(--color-border)] text-[var(--color-text-muted)] font-medium leading-none">
                          v1.1
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Bottom-anchored Settings */}
      <div className="px-2 pb-3 border-t border-[var(--color-border)] pt-2">
        <button
          onClick={() => navigate("settings")}
          className={cn(
            "w-full text-left px-2 py-1.5 text-xs rounded-md transition-colors cursor-pointer",
            currentRoute === "settings"
              ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-medium"
              : "text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)]/50"
          )}
        >
          Settings
        </button>
        <button
          onClick={() => navigate("deploys")}
          className={cn(
            "w-full text-left px-2 py-1.5 text-xs rounded-md transition-colors cursor-pointer",
            currentRoute === "deploys"
              ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-medium"
              : "text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)]/50"
          )}
        >
          Deploy History
        </button>
      </div>
    </aside>
  );
}
