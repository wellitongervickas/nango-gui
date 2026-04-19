import { navigate } from "@/lib/router";
import { ChevronIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

export interface BreadcrumbItem {
  label: string;
  route?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className={cn("flex items-center gap-1.5", className)}>
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && (
              <span className="text-[var(--color-text-secondary)]">
                <ChevronIcon direction="right" />
              </span>
            )}
            {item.route && !isLast ? (
              <button
                onClick={() => navigate(item.route!)}
                className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer"
              >
                {item.label}
              </button>
            ) : (
              <span
                className={cn(
                  "text-xs truncate max-w-[200px]",
                  isLast
                    ? "text-[var(--color-text-primary)] font-medium"
                    : "text-[var(--color-text-secondary)]"
                )}
              >
                {item.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
