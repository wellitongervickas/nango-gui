import { AlertTriangleIcon } from "@/components/icons";

export function WarningBanner({
  message,
  detail,
  className = "",
}: {
  message: string;
  detail?: string;
  className?: string;
}) {
  return (
    <div
      className={`rounded-lg border border-[#f59e0b]/30 bg-[#f59e0b]/10 px-4 py-3 text-sm text-[#f59e0b] flex items-start gap-2.5 ${className}`}
    >
      <span className="mt-0.5 shrink-0">
        <AlertTriangleIcon />
      </span>
      <div>
        <p>{message}</p>
        {detail && (
          <p className="text-xs mt-1 opacity-80">{detail}</p>
        )}
      </div>
    </div>
  );
}
