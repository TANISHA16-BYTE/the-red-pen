
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Campaign = {
  id: string;
  name: string;
  description: string | null;
  channel: string | null;
  content: string | null;
  status: string;
};

type ApprovedRecord = {
  id: string;
  record_type: string;
  title: string;
  description: string | null;
  content: string | null;
  category: string | null;
  status: string;
};

type Finding = {
  id: string;
  campaign_id: string | null;
  finding_type: string;
  severity: "high" | "medium" | "low";
  title: string;
  explanation: string;
  evidence: string;
  recommendation: string;
  status: "open" | "resolved" | "dismissed";
  created_at: string;
};

type DetectedFinding = {
  organization_id: string;
  campaign_id: string;
  finding_type: string;
  severity: "high" | "medium" | "low";
  title: string;
  explanation: string;
  evidence: string;
  recommendation: string;
  status: "open";
};

const stopWords = new Set([
  "this", "that", "with", "from", "your", "have", "will", "into", "their",
  "they", "them", "then", "than", "when", "what", "which", "while", "where",
  "about", "after", "before", "more", "most", "only", "also", "very", "just",
  "each", "every", "some", "such", "been", "being", "were", "was", "are",
  "the", "and", "for", "you", "our", "out", "but", "not", "all", "any",
  "can", "get", "has", "had", "its", "per", "new", "now", "off", "one",
  "two", "day", "days", "use", "using", "via", "campaign", "brand"
]);

const severityStyle: Record<string, string> = {
  high: "bg-red-100 text-red-800",
  medium: "bg-amber-100 text-amber-800",
  low: "bg-slate-100 text-slate-700"
};

function keywords(campaign: Campaign) {
  const text = `${campaign.name} ${campaign.description || ""} ${campaign.content || ""}`;

  return new Set(
    (text.toLowerCase().match(/[a-z]{4,}/g) || [])
      .filter((word) => !stopWords.has(word))
  );
}

function extractValues(text: string) {
  const patterns = [
    { type: "Price", regex: /(?:₹|rs\.?\s*)\s*\d[\d,]*(?:\.\d+)?/gi },
    { type: "Discount", regex: /\b\d+(?:\.\d+)?\s*%/gi },
    { type: "Duration", regex: /\b\d+\s*(?:days?|weeks?|months?|years?)\b/gi },
    {
      type: "Date",
      regex: /\b(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}(?:,?\s+\d{4})?)\b/gi
    }
  ];

  const found: { type: string; value: string }[] = [];

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern.regex)) {
      const value = match[0].replace(/\s+/g, " ").trim().toLowerCase();

      if (!found.some((item) => item.type === pattern.type && item.value === value)) {
        found.push({ type: pattern.type, value });
      }
    }
  }

  return found;
}

function detectConflicts(
  campaigns: Campaign[],
  organizationId: string
): DetectedFinding[] {
  const results: DetectedFinding[] = [];

  for (let i = 0; i < campaigns.length; i++) {
    for (let j = i + 1; j < campaigns.length; j++) {
      const first = campaigns[i];
      const second = campaigns[j];

      const firstWords = keywords(first);
      const secondWords = keywords(second);

      const shared = [...firstWords].filter((word) => secondWords.has(word));

      if (shared.length < 2) continue;

      const firstText = `${first.name}\n${first.description || ""}\n${first.content || ""}`;
      const secondText = `${second.name}\n${second.description || ""}\n${second.content || ""}`;

      const firstValues = extractValues(firstText);
      const secondValues = extractValues(secondText);

      for (const type of ["Price", "Discount", "Duration", "Date"]) {
        const left = firstValues.filter((item) => item.type === type);
        const right = secondValues.filter((item) => item.type === type);

        for (const a of left) {
          for (const b of right) {
            if (a.value === b.value) continue;

            const title = `${type} differs across related campaigns`;
            const evidence = `${first.name}: ${a.value} | ${second.name}: ${b.value}`;

            if (results.some(
              (item) =>
                item.campaign_id === second.id &&
                item.title === title &&
                item.evidence === evidence
            )) continue;

            results.push({
              organization_id: organizationId,
              campaign_id: second.id,
              finding_type: "cross_campaign_mismatch",
              severity: type === "Price" || type === "Discount" ? "high" : "medium",
              title,
              explanation: `These campaigns share related wording (${shared.slice(0, 4).join(", ")}) but contain different ${type.toLowerCase()} values. This may be intentional, so a reviewer should verify the approved version.`,
              evidence,
              recommendation: "Compare both values with approved brand information before publishing. If the difference is intentional, document the reason.",
              status: "open"
            });
          }
        }
      }
    }
  }

  return results;
}

function detectApprovedReferenceConflicts(
  campaigns: Campaign[],
  records: ApprovedRecord[],
  organizationId: string
): DetectedFinding[] {
  const results: DetectedFinding[] = [];

  const eligibleRecords = records.filter((record) =>
    ["fact", "claim"].includes((record.record_type || "").toLowerCase()) &&
    ["approved", "active", "verified", "published"].includes((record.status || "").toLowerCase())
  );

  for (const campaign of campaigns) {
    const campaignText = `${campaign.name}\n${campaign.description || ""}\n${campaign.content || ""}`;
    const campaignWords = keywords(campaign);
    const campaignValues = extractValues(campaignText);

    for (const record of eligibleRecords) {
      const referenceText = `${record.title}\n${record.description || ""}\n${record.content || ""}`;

      const referenceWords = new Set(
        (referenceText.toLowerCase().match(/[a-z]{4,}/g) || [])
          .filter((word) => !stopWords.has(word))
      );

      const shared = [...campaignWords].filter((word) => referenceWords.has(word));

      if (shared.length < 2) continue;

      const approvedValues = extractValues(referenceText);

      for (const type of ["Price", "Discount", "Duration", "Date"]) {
        const campaignMatches = campaignValues.filter((item) => item.type === type);
        const referenceMatches = approvedValues.filter((item) => item.type === type);

        if (!campaignMatches.length || !referenceMatches.length) continue;

        const approvedSet = new Set(referenceMatches.map((item) => item.value));
        const conflicting = campaignMatches.filter((item) => !approvedSet.has(item.value));

        if (!conflicting.length) continue;

        const evidence =
          `Campaign "${campaign.name}": ${conflicting.map((item) => item.value).join(", ")} | Approved reference "${record.title}": ${referenceMatches.map((item) => item.value).join(", ")}`;

        const title = `${type} may differ from approved Company Brain information`;

        if (results.some(
          (item) =>
            item.campaign_id === campaign.id &&
            item.title === title &&
            item.evidence === evidence
        )) continue;

        results.push({
          organization_id: organizationId,
          campaign_id: campaign.id,
          finding_type: "approved_reference_mismatch",
          severity: type === "Price" || type === "Discount" ? "high" : "medium",
          title,
          explanation: `This campaign shares related wording (${shared.slice(0, 4).join(", ")}) with an approved Company Brain ${record.record_type}, but its ${type.toLowerCase()} value does not match the reference. Verify whether the campaign has an authorised exception.`,
          evidence,
          recommendation: `Verify the campaign value against the approved Company Brain record "${record.title}". Update the campaign or document an authorised exception before publishing.`,
          status: "open"
        });
      }
    }
  }

  return results;
}

export default function ConsistencyRadarPage() {
  const supabase = useMemo(() => createClient(), []);

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [approvedRecords, setApprovedRecords] = useState<ApprovedRecord[]>([]);
  const [organizationId, setOrganizationId] = useState("");
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [updatingId, setUpdatingId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("open");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError) throw authError;

      if (!authData.user) {
        throw new Error("Please sign in to use Consistency Radar.");
      }

      setUserId(authData.user.id);

      const { data: membership, error: membershipError } = await supabase
        .from("org_memberships")
        .select("organization_id")
        .eq("user_id", authData.user.id)
        .limit(1)
        .maybeSingle();

      if (membershipError) throw membershipError;

      if (!membership?.organization_id) {
        throw new Error("No organization membership was found for this account.");
      }

      const orgId = membership.organization_id;
      setOrganizationId(orgId);

      const [campaignResult, findingResult, brainResult] = await Promise.all([
        supabase
          .from("campaigns")
          .select("id,name,description,channel,content,status")
          .eq("organization_id", orgId)
          .order("created_at", { ascending: false }),

        supabase
          .from("campaign_findings")
          .select("id,campaign_id,finding_type,severity,title,explanation,evidence,recommendation,status,created_at")
          .eq("organization_id", orgId)
          .order("created_at", { ascending: false }),

        supabase
          .from("company_brain_records")
          .select("id,record_type,title,description,content,category,status")
          .eq("organization_id", orgId)
      ]);

      if (campaignResult.error) throw campaignResult.error;
      if (findingResult.error) throw findingResult.error;
      if (brainResult.error) throw brainResult.error;

      setCampaigns((campaignResult.data || []) as Campaign[]);
      setFindings((findingResult.data || []) as Finding[]);
      setApprovedRecords((brainResult.data || []) as ApprovedRecord[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load Consistency Radar.");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadData(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  async function writeAudit(
    action: string,
    entityId: string,
    description: string,
    oldValue: unknown,
    newValue: unknown
  ) {
    const { error: auditError } = await supabase
      .from("audit_logs")
      .insert({
        organization_id: organizationId,
        actor_id: userId,
        action,
        entity_type: "finding",
        entity_id: entityId,
        description,
        old_value: oldValue,
        new_value: newValue
      });

    return auditError?.message ?? null;
  }

  const runScan = async () => {
    if (!organizationId || scanning || loading) return;

    setScanning(true);
    setError("");
    setMessage("");

    try {
      if (campaigns.length < 1) {
        setMessage("Add at least one campaign before running a scan.");
        return;
      }

      const detected = [
        ...detectConflicts(campaigns, organizationId),
        ...detectApprovedReferenceConflicts(campaigns, approvedRecords, organizationId)
      ];

      if (detected.length === 0) {
        setMessage("Scan complete. No numeric mismatches were detected by the current checks.");
        return;
      }

      const existingKeys = new Set(
        findings.map((item) =>
          `${item.campaign_id ?? ""}::${item.title}::${item.evidence}`
        )
      );

      const newFindings = detected.filter((item) =>
        !existingKeys.has(
          `${item.campaign_id}::${item.title}::${item.evidence}`
        )
      );

      if (newFindings.length === 0) {
        setMessage(
          `Scan complete. ${detected.length} potential mismatch(es) found; all are already listed.`
        );
        return;
      }

      const { data: savedFindings, error: saveError } = await supabase
        .from("campaign_findings")
        .insert(newFindings)
        .select("*");

      if (saveError) throw saveError;

      const saved = (savedFindings ?? []) as Finding[];

      setFindings((previous) => [...saved, ...previous]);

      const auditResults = await Promise.all(
        saved.map((finding) =>
          writeAudit(
            "created",
            finding.id,
            `Consistency Radar detected: ${finding.title}`,
            null,
            finding
          )
        )
      );

      const auditFailed = auditResults.some(Boolean);

      setMessage(
        `${saved.length} new potential mismatch(es) saved for review.${auditFailed ? " Some audit entries could not be recorded." : ""}`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Consistency scan failed.");
    } finally {
      setScanning(false);
    }
  };

  const updateFinding = async (
    id: string,
    status: "resolved" | "dismissed"
  ) => {
    if (!organizationId || updatingId) return;

    const previousFinding = findings.find((item) => item.id === id);

    if (!previousFinding || previousFinding.status !== "open") return;

    setUpdatingId(id);
    setError("");
    setMessage("");

    try {
      const { data: updatedFinding, error: updateError } = await supabase
        .from("campaign_findings")
        .update({ status })
        .eq("id", id)
        .eq("organization_id", organizationId)
        .eq("status", "open")
        .select("*")
        .single();

      if (updateError) throw updateError;

      setFindings((current) =>
        current.map((item) =>
          item.id === id
            ? { ...item, status }
            : item
        )
      );

      const auditWarning = await writeAudit(
        status,
        id,
        `${status === "resolved" ? "Resolved" : "Dismissed"} finding: ${updatedFinding.title}`,
        previousFinding,
        updatedFinding
      );

      setMessage(
        auditWarning
          ? `Finding ${status} successfully. Audit entry could not be recorded.`
          : `Finding ${status} successfully. Review Desk has been updated.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update finding.");
    } finally {
      setUpdatingId("");
    }
  };

  const visibleFindings = useMemo(
    () =>
      filter === "all"
        ? findings
        : findings.filter((item) => item.status === filter),
    [findings, filter]
  );

  const openCount = findings.filter((item) => item.status === "open").length;

  const highCount = findings.filter(
    (item) => item.status === "open" && item.severity === "high"
  ).length;

  const approvedReferenceCount = approvedRecords.filter((record) =>
    ["fact", "claim"].includes((record.record_type || "").toLowerCase()) &&
    ["approved", "active", "verified", "published"].includes((record.status || "").toLowerCase())
  ).length;

  return (
    <main className="min-h-screen bg-[#f7f4ee] px-5 py-8 text-[#25221f] md:px-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-9 flex flex-wrap items-center justify-between gap-4 border-b border-[#ded8cf] pb-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#9b5148]">
              The Red Pen / Governance
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              Consistency Radar
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-[#716b63]">
              Find potential differences in offers, prices, discounts and dates across related campaigns.
            </p>
          </div>

          <nav className="flex flex-wrap gap-2">
            <Link href="/" className="rounded-full border border-[#d8cfc3] px-4 py-2 text-sm font-medium hover:bg-white">
              Company Brain
            </Link>
            <Link href="/campaigns" className="rounded-full border border-[#d8cfc3] px-4 py-2 text-sm font-medium hover:bg-white">
              Campaigns
            </Link>
            <Link href="/review-desk" className="rounded-full border border-[#d8cfc3] px-4 py-2 text-sm font-medium hover:bg-white">
              Review Desk
            </Link>
            <Link href="/audit-history" className="rounded-full border border-[#d8cfc3] px-4 py-2 text-sm font-medium hover:bg-white">
              Audit History
            </Link>
          </nav>
        </header>

        <section className="mb-7 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-[#e4ddd3] bg-white p-5">
            <p className="text-sm text-[#777067]">Campaigns scanned</p>
            <p className="mt-2 text-3xl font-semibold">{campaigns.length}</p>
          </div>

          <div className="rounded-2xl border border-[#e4ddd3] bg-white p-5">
            <p className="text-sm text-[#777067]">Open findings</p>
            <p className="mt-2 text-3xl font-semibold">{openCount}</p>
          </div>

          <div className="rounded-2xl border border-[#e4ddd3] bg-white p-5">
            <p className="text-sm text-[#777067]">High priority</p>
            <p className="mt-2 text-3xl font-semibold text-[#a33e35]">{highCount}</p>
          </div>
        </section>

        <section className="mb-7 flex flex-col justify-between gap-4 rounded-2xl border border-[#e4ddd3] bg-white p-5 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-semibold">Cross-campaign scan</h2>
            <p className="mt-1 max-w-2xl text-sm text-[#777067]">
              Compares related campaigns and checks numeric values against approved Company Brain facts and claims. Results are suggestions for human review, not proof of an error.
            </p>
            <p className="mt-2 text-xs text-[#8b8379]">
              {approvedReferenceCount} approved Company Brain fact/claim reference(s) available.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void runScan()}
            disabled={scanning || loading || !organizationId}
            className="shrink-0 rounded-full bg-[#9e4138] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#80342d] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {scanning ? "Scanning…" : "Run consistency scan"}
          </button>
        </section>

        {message && (
          <div role="status" className="mb-4 rounded-xl border border-[#e4c9a7] bg-[#fff8eb] px-4 py-3 text-sm text-[#75532c]">
            {message}
          </div>
        )}

        {error && (
          <div role="alert" className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        <section className="rounded-2xl border border-[#e4ddd3] bg-white p-5 md:p-7">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Review findings</h2>
              <p className="mt-1 text-sm text-[#777067]">
                Each finding includes the values that triggered the check.
              </p>
            </div>

            <select
              aria-label="Filter findings"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              className="rounded-full border border-[#ded8cf] bg-white px-4 py-2 text-sm"
            >
              <option value="open">Open</option>
              <option value="resolved">Resolved</option>
              <option value="dismissed">Dismissed</option>
              <option value="all">All findings</option>
            </select>
          </div>

          {loading ? (
            <p className="py-10 text-center text-sm text-[#777067]">
              Loading your campaigns and findings…
            </p>
          ) : visibleFindings.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#d8cfc3] px-5 py-12 text-center">
              <p className="font-medium">No findings in this view</p>
              <p className="mt-2 text-sm text-[#777067]">
                Run a scan after adding related campaigns with comparable information.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {visibleFindings.map((finding) => (
                <article key={finding.id} className="rounded-xl border border-[#e7e0d7] p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${severityStyle[finding.severity] || severityStyle.medium}`}>
                          {finding.severity} priority
                        </span>
                        <span className="rounded-full bg-[#f2eee8] px-3 py-1 text-xs text-[#625b52]">
                          {finding.status}
                        </span>
                        <span className="text-xs text-[#8b8379]">
                          {finding.finding_type.replaceAll("_", " ")}
                        </span>
                      </div>

                      <h3 className="font-semibold">{finding.title}</h3>
                    </div>
                  </div>

                  <p className="mt-3 text-sm leading-6 text-[#625b52]">
                    {finding.explanation}
                  </p>

                  <div className="mt-3 rounded-lg bg-[#f7f4ee] p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#8c5148]">
                      Compared evidence
                    </p>
                    <p className="mt-1 break-words text-sm">{finding.evidence}</p>
                  </div>

                  <p className="mt-3 text-sm">
                    <strong>Suggested action:</strong> {finding.recommendation}
                  </p>

                  {finding.status === "open" && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={updatingId === finding.id}
                        onClick={() => void updateFinding(finding.id, "resolved")}
                        className="rounded-full bg-[#e6efe7] px-4 py-2 text-xs font-semibold text-[#315c3c] hover:bg-[#d8e8db] disabled:opacity-50"
                      >
                        {updatingId === finding.id ? "Updating..." : "Mark resolved"}
                      </button>

                      <button
                        type="button"
                        disabled={updatingId === finding.id}
                        onClick={() => void updateFinding(finding.id, "dismissed")}
                        className="rounded-full border border-[#ded8cf] px-4 py-2 text-xs font-semibold text-[#625b52] hover:bg-[#f7f4ee] disabled:opacity-50"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        <footer className="mt-6 flex flex-wrap justify-between gap-3 text-xs text-[#8b8379]">
          <span>Rule-based checks · Human review required</span>
          <button
            type="button"
            onClick={() => void loadData()}
            disabled={loading}
            className="underline underline-offset-4 disabled:opacity-50"
          >
            Refresh data
          </button>
        </footer>
      </div>
    </main>
  );
}
