import { useEffect, useState } from "react";
import type { NangoProvider } from "@nango-gui/shared";
import { useIntegrationsStore } from "@/store/integrationsStore";
import { ConnectModal } from "@/components/connections/ConnectModal";
import { Breadcrumbs } from "@/components/common/Breadcrumbs";
import { ExternalLinkIcon, SpinnerIcon, GridIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

// ── Provider logo ──────────────────────────────────────────────────────────

function ProviderLogo({ provider, size = 48 }: { provider: NangoProvider; size?: number }) {
  const [failed, setFailed] = useState(false);

  if (!provider.logo_url || failed) {
    return (
      <div
        className="rounded-lg bg-[var(--color-bg-overlay)] flex items-center justify-center text-sm font-semibold text-[var(--color-text-secondary)] uppercase shrink-0"
        style={{ width: size, height: size }}
      >
        {(provider.display_name[0] ?? "?").toUpperCase()}
      </div>
    );
  }

  return (
    <img
      src={provider.logo_url}
      alt={provider.display_name}
      width={size}
      height={size}
      className="rounded-lg object-contain shrink-0"
      onError={() => setFailed(true)}
    />
  );
}

// ── Detail row ─────────────────────────────────────────────────────────────

function DetailRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 border-b border-[var(--color-border)] last:border-0">
      <dt className="text-xs text-[var(--color-text-secondary)] shrink-0">{label}</dt>
      <dd className={cn("text-sm text-[var(--color-text-primary)] text-right truncate", mono && "font-mono text-xs")}>
        {value}
      </dd>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

interface IntegrationDetailPageProps {
  providerKey: string;
}

export function IntegrationDetailPage({ providerKey }: IntegrationDetailPageProps) {
  const { providers, fetchProviders, isLoading } = useIntegrationsStore();

  useEffect(() => {
    if (providers.length === 0) {
      fetchProviders();
    }
  }, [providers.length, fetchProviders]);

  const provider = providers.find((p) => p.name === providerKey) ?? null;

  if (isLoading && !provider) {
    return (
      <div className="flex flex-col h-full bg-[var(--color-bg-base)]">
        <div className="sticky top-0 z-10 px-6 py-3 border-b border-[var(--color-border)] bg-[var(--color-bg-surface)] shrink-0">
          <Breadcrumbs items={[{ label: "Integrations", route: "integrations" }, { label: "Loading..." }]} />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <SpinnerIcon />
        </div>
      </div>
    );
  }

  if (!provider) {
    return (
      <div className="flex flex-col h-full bg-[var(--color-bg-base)]">
        <div className="sticky top-0 z-10 px-6 py-3 border-b border-[var(--color-border)] bg-[var(--color-bg-surface)] shrink-0">
          <Breadcrumbs items={[{ label: "Integrations", route: "integrations" }, { label: providerKey }]} />
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-[var(--color-bg-surface)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-secondary)]">
            <GridIcon />
          </div>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Provider "{providerKey}" not found
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[var(--color-bg-base)] overflow-y-auto">
      {/* Header with breadcrumbs */}
      <div className="sticky top-0 z-10 px-6 py-3 border-b border-[var(--color-border)] bg-[var(--color-bg-surface)] shrink-0">
        <Breadcrumbs
          items={[
            { label: "Integrations", route: "integrations" },
            { label: provider.display_name },
          ]}
        />
      </div>

      {/* Body */}
      <div className="flex-1 px-6 py-6 max-w-3xl w-full mx-auto space-y-6">
        {/* Title section */}
        <div className="flex items-start gap-4">
          <ProviderLogo provider={provider} size={56} />
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">
              {provider.display_name}
            </h1>
            <p className="text-sm text-[var(--color-text-secondary)] font-mono mt-0.5">
              {provider.name}
            </p>
          </div>
        </div>

        {/* Details card */}
        <section className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-xl p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-3">
            Details
          </h2>
          <dl>
            <DetailRow label="Auth mode" value={provider.auth_mode} />
            <DetailRow label="Provider key" value={provider.name} mono />
          </dl>
        </section>

        {/* Categories */}
        {provider.categories && provider.categories.length > 0 && (
          <section className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-xl p-5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-3">
              Categories
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {provider.categories.map((cat) => (
                <span
                  key={cat}
                  className="text-xs px-2.5 py-1 rounded-full border border-[var(--color-border)] text-[var(--color-text-secondary)]"
                >
                  {cat}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Docs link */}
        {provider.docs && (
          <a
            href={provider.docs}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-[var(--color-brand-400)] hover:underline"
          >
            <ExternalLinkIcon />
            View documentation
          </a>
        )}

        {/* CTA */}
        <div className="pt-2">
          <ConnectModal>
            {({ open, isLoading: isConnecting }) => (
              <button
                onClick={open}
                disabled={isConnecting}
                className="px-6 py-2.5 text-sm font-medium rounded-lg bg-[var(--color-brand-500)] text-white hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50 flex items-center gap-2"
              >
                {isConnecting && <SpinnerIcon />}
                Connect {provider.display_name}
              </button>
            )}
          </ConnectModal>
        </div>
      </div>
    </div>
  );
}
