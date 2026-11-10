
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type AuditLog = {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  description: string;
  old_value: unknown;
  new_value: unknown;
  created_at: string;
};

const categoryOf = (entityType: string) => {
  const type = entityType.toLowerCase();

  if (type === "campaign") return "campaign";
  if (
    type === "company_brain_record" ||
    type === "company_brain_records"
  ) return "company_brain_record";
  if (type === "review" || type === "campaign_review") return "review";
  if (
    type === "finding" ||
    type === "campaign_findings" ||
    type === "campaign_finding"
  ) return "finding";

  return "other";
};

const categoryLabels: Record<string, string> = {
  all: "All activity",
  campaign: "Campaigns",
  company_brain_record: "Company Brain",
  review: "Reviews",
  finding: "Findings",
  other: "Other activity",
};

const formatValue = (value: unknown) => {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
};

export default function AuditHistoryPage() {
  const router = useRouter();

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError) throw authError;

      if (!authData.user) {
        router.push("/login");
        return;
      }

      const { data: membership, error: membershipError } =
        await supabase
          .from("org_memberships")
          .select("organization_id")
          .eq("user_id", authData.user.id)
          .limit(1)
          .maybeSingle();

      if (membershipError) throw membershipError;

      if (!membership?.organization_id) {
        setError("No organization membership found. Set up your Company Brain first.");
        return;
      }

      const { data, error: logsError } = await supabase
        .from("audit_logs")
        .select(
          "id,actor_id,action,entity_type,entity_id,description,old_value,new_value,created_at"
        )
        .eq("organization_id", membership.organization_id)
        .order("created_at", { ascending: false })
        .limit(200);

      if (logsError) throw logsError;

      setLogs((data ?? []) as AuditLog[]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load audit history."
      );
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadLogs();
  }, [loadLogs]);

  const filteredLogs = useMemo(() => {
    const query = search.trim().toLowerCase();

    return logs.filter((log) => {
      const category = categoryOf(log.entity_type);

      const matchesFilter =
        filter === "all" ||
        category === filter;

      const searchableText = [
        log.description,
        log.action,
        log.entity_type,
        formatValue(log.old_value),
        formatValue(log.new_value),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return matchesFilter &&
        (!query || searchableText.includes(query));
    });
  }, [logs, filter, search]);

  const counts = useMemo(() => {
    const result = {
      total: logs.length,
      campaigns: 0,
      companyBrain: 0,
      reviews: 0,
      findings: 0,
      other: 0,
    };

    for (const log of logs) {
      const category = categoryOf(log.entity_type);

      if (category === "campaign") result.campaigns++;
      else if (category === "company_brain_record") result.companyBrain++;
      else if (category === "review") result.reviews++;
      else if (category === "finding") result.findings++;
      else result.other++;
    }

    return result;
  }, [logs]);

  return (
    <main className="min-h-screen bg-[#f7f5f0] text-[#282522]">
      <header className="border-b border-[#e8e2d9] bg-[#fffefa]">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-5">
          <div>
            <Link href="/" className="text-sm text-[#a34b3d] hover:underline">
              ← The Red Pen
            </Link>

            <h1 className="mt-2 text-2xl font-semibold tracking-tight">
              Audit History
            </h1>

            <p className="mt-1 text-sm text-[#77716a]">
              A chronological record of important workspace activity.
            </p>
          </div>

          <nav className="flex flex-wrap gap-2 text-sm">
            <Link href="/" className="rounded-full border border-[#e8e2d9] px-3 py-2 hover:bg-[#f7f5f0]">
              Company Brain
            </Link>
            <Link href="/campaigns" className="rounded-full border border-[#e8e2d9] px-3 py-2 hover:bg-[#f7f5f0]">
              Campaigns
            </Link>
            <Link href="/content-checker" className="rounded-full border border-[#e8e2d9] px-3 py-2 hover:bg-[#f7f5f0]">
              Content Checker
            </Link>
            <Link href="/consistency-radar" className="rounded-full border border-[#e8e2d9] px-3 py-2 hover:bg-[#f7f5f0]">
              Consistency Radar
            </Link>
            <Link href="/review-desk" className="rounded-full border border-[#e8e2d9] px-3 py-2 hover:bg-[#f7f5f0]">
              Review Desk
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-5 py-8">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          {[
            { label: "Total events", value: counts.total },
            { label: "Campaign events", value: counts.campaigns },
            { label: "Company Brain events", value: counts.companyBrain },
            { label: "Review events", value: counts.reviews },
            { label: "Finding events", value: counts.findings },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl border border-[#e9e3da] bg-white p-5">
              <p className="text-sm text-[#77716a]">{item.label}</p>
              <p className="mt-2 text-3xl font-semibold">{item.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#a34b3d]">
              Accountability
            </p>
            <h2 className="mt-2 text-xl font-semibold">
              Activity timeline
            </h2>
            <p className="mt-1 text-sm text-[#77716a]">
              Latest 200 recorded events, newest first.
            </p>
          </div>

          <button
            onClick={() => void loadLogs()}
            disabled={loading}
            className="rounded-xl border border-[#ded7cd] bg-white px-4 py-2.5 text-sm font-medium hover:bg-[#f8f7f3] disabled:opacity-50"
          >
            {loading ? "Refreshing..." : "Refresh history"}
          </button>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-[1fr_220px]">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search activity, action, evidence or changes..."
            className="w-full rounded-xl border border-[#e5ded4] bg-white px-4 py-3 text-sm outline-none focus:border-[#a34b3d]"
          />

          <select
            aria-label="Filter activity"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            className="rounded-xl border border-[#e5ded4] bg-white px-4 py-3 text-sm outline-none focus:border-[#a34b3d]"
          >
            {Object.entries(categoryLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        {loading ? (
          <div className="mt-6 rounded-2xl border border-[#e9e3da] bg-white p-10 text-center text-sm text-[#77716a]">
            Loading audit history...
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-[#d9d0c5] bg-white px-6 py-14 text-center">
            <h3 className="text-lg font-semibold">
              No activity found
            </h3>
            <p className="mt-2 text-sm text-[#77716a]">
              {logs.length === 0
                ? "New recorded workspace activities will appear here. Existing activity is not backfilled automatically."
                : "Try changing your search or activity filter."}
            </p>
          </div>
        ) : (
          <div className="mt-6 overflow-hidden rounded-2xl border border-[#e9e3da] bg-white">
            <div className="divide-y divide-[#eee9e1]">
              {filteredLogs.map((log) => {
                const category = categoryOf(log.entity_type);
                const previous = formatValue(log.old_value);
                const next = formatValue(log.new_value);

                return (
                  <article key={log.id} className="flex gap-4 p-5">
                    <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f4eee8] text-sm font-semibold text-[#a34b3d]">
                      {categoryLabels[category]?.slice(0, 1) ?? "A"}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-[#f4eee8] px-2.5 py-1 text-xs font-medium text-[#815344]">
                          {categoryLabels[category] ?? "Other activity"}
                        </span>

                        <span className="text-xs font-medium capitalize text-[#625c55]">
                          {log.action.replaceAll("_", " ")}
                        </span>

                        <span className="text-xs text-[#a19a91]">
                          {log.entity_type}
                        </span>
                      </div>

                      <p className="mt-2 break-words text-sm leading-6 text-[#514b44]">
                        {log.description || "Activity recorded."}
                      </p>

                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#8b847c]">
                        <span>
                          {new Date(log.created_at).toLocaleString()}
                        </span>

                        {log.actor_id && (
                          <span>
                            Actor: {log.actor_id.slice(0, 8)}…
                          </span>
                        )}

                        {log.entity_id && (
                          <span>
                            Record: {log.entity_id.slice(0, 8)}…
                          </span>
                        )}
                      </div>

                      {(previous || next) && (
                        <details className="mt-3">
                          <summary className="cursor-pointer text-xs font-medium text-[#a34b3d]">
                            View recorded changes
                          </summary>

                          <div className="mt-2 grid gap-2 sm:grid-cols-2">
                            {previous && (
                              <div className="rounded-lg bg-[#faf8f4] p-3">
                                <p className="text-xs font-semibold text-[#77716a]">
                                  Previous value
                                </p>
                                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words text-xs text-[#514b44]">
                                  {previous}
                                </pre>
                              </div>
                            )}

                            {next && (
                              <div className="rounded-lg bg-[#faf8f4] p-3">
                                <p className="text-xs font-semibold text-[#77716a]">
                                  New value
                                </p>
                                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words text-xs text-[#514b44]">
                                  {next}
                                </pre>
                              </div>
                            )}
                          </div>
                        </details>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
