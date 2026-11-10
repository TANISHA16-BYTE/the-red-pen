"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { checkContent, type ContentCheckResult } from "@/lib/content-checker";

type BrainRecord = {
  id: string;
  record_type: "rule" | "fact" | "claim" | "asset";
  title: string;
  content: string;
  category: string;
  status: string;
};

type Campaign = {
  id: string;
  name: string;
  content: string;
  status: string;
};

export default function ContentCheckerPanel() {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [sourceProvided, setSourceProvided] = useState(false);
  const [result, setResult] = useState<ContentCheckResult | null>(null);
  const [records, setRecords] = useState<BrainRecord[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignId, setCampaignId] = useState("");
  const [organizationId, setOrganizationId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    let cancelled = false;

    async function loadReferenceData() {
      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!authData.user) {
          router.push("/login");
          return;
        }

        const { data: membership, error: membershipError } = await supabase
          .from("org_memberships")
          .select("organization_id")
          .eq("user_id", authData.user.id)
          .limit(1)
          .maybeSingle();

        if (membershipError) throw membershipError;
        if (!membership?.organization_id) {
          throw new Error("No workspace membership found. Set up Company Brain first.");
        }

        const orgId = membership.organization_id;

        const [recordResult, campaignResult] = await Promise.all([
          supabase
            .from("company_brain_records")
            .select("id, record_type, title, content, category, status")
            .eq("organization_id", orgId)
            .eq("status", "approved"),
          supabase
            .from("campaigns")
            .select("id, name, content, status")
            .eq("organization_id", orgId)
            .order("created_at", { ascending: false }),
        ]);

        if (recordResult.error) throw recordResult.error;
        if (campaignResult.error) throw campaignResult.error;

        if (cancelled) return;
        setOrganizationId(orgId);
        setRecords((recordResult.data ?? []) as BrainRecord[]);
        setCampaigns((campaignResult.data ?? []) as Campaign[]);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to load Company Brain data.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadReferenceData();
    return () => { cancelled = true; };
  }, [supabase, router]);

  const approvedFacts = useMemo(
    () => records.filter((record) => record.record_type === "fact").map((record) => record.content),
    [records]
  );

  const approvedClaims = useMemo(
    () => records.filter((record) => record.record_type === "claim").map((record) => record.content),
    [records]
  );

  const prohibitedTerms = useMemo(
    () => records
      .filter((record) =>
        record.record_type === "rule" &&
        /prohibit|avoid|not allowed|forbidden/i.test(`${record.title} ${record.category}`)
      )
      .flatMap((record) => record.content.split(/[,;\n]+/).map((term) => term.trim()).filter(Boolean)),
    [records]
  );

  const requiredTerms = useMemo(
    () => records
      .filter((record) =>
        record.record_type === "rule" &&
        /required|mandatory|must use/i.test(`${record.title} ${record.category}`)
      )
      .flatMap((record) => record.content.split(/[,;\n]+/).map((term) => term.trim()).filter(Boolean)),
    [records]
  );

  const statusLabel = useMemo(() => {
    if (!result) return "";
    if (result.status === "needs-review") return "Needs review";
    if (result.status === "review-carefully") return "Review carefully";
    return "Looks consistent";
  }, [result]);

  function runCheck() {
    setError("");
    setNotice("");
    setResult(checkContent({
      content,
      sourceProvided,
      approvedFacts,
      approvedClaims,
      requiredTerms,
      prohibitedTerms,
    }));
  }

  function loadCampaignDraft(id: string) {
    setCampaignId(id);
    const campaign = campaigns.find((item) => item.id === id);
    if (campaign?.content) setContent(campaign.content);
    setResult(null);
    setNotice("");
  }

  async function saveFindings() {
    if (!result || !campaignId || !organizationId) {
      setError("Select a campaign and run the content check first.");
      return;
    }
    if (result.findings.length === 0) {
      setNotice("There are no findings to save for this review.");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const { error: saveError } = await supabase
        .from("campaign_findings")
        .insert(result.findings.map((finding) => ({
          organization_id: organizationId,
          campaign_id: campaignId,
          finding_type: finding.category,
          severity: finding.severity,
          title: finding.title,
          explanation: finding.explanation,
          evidence: finding.excerpt,
          recommendation: finding.recommendation,
          status: "open",
        })));

      if (saveError) throw saveError;

      const { error: auditError } = await supabase.from("audit_logs").insert({
        organization_id: organizationId,
        action: "created",
        entity_type: "campaign_findings",
        entity_id: null,
        description: `Saved ${result.findings.length} content review finding(s) to campaign ${campaignId}.`,
        new_value: {
          campaign_id: campaignId,
          finding_count: result.findings.length,
          findings: result.findings.map((finding) => ({
            title: finding.title,
            severity: finding.severity,
            category: finding.category,
          })),
        },
      });

      if (auditError) {
        setNotice(`${result.findings.length} findings saved, but the audit entry could not be recorded: ${auditError.message}`);
      } else {
        setNotice(`${result.findings.length} findings saved to the selected campaign and recorded in Audit History.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save findings.");
    } finally {
      setSaving(false);
    }
  }

  function clearDraft() {
    setContent("");
    setSourceProvided(false);
    setResult(null);
    setCampaignId("");
    setError("");
    setNotice("");
  }

  const severityStyle = {
    high: "border-red-200 bg-red-50 text-red-800",
    medium: "border-amber-200 bg-amber-50 text-amber-800",
    low: "border-slate-200 bg-slate-50 text-slate-700",
  };

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-[#e8e1d8] bg-white p-5 shadow-sm sm:p-7">
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#a34e42]">
            The Red Pen / Content review
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#292522]">
            Check before you publish.
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#77706a]">
            Review draft copy against approved Company Brain facts, claims and terminology.
            This is a first-pass check, not final approval.
          </p>
        </div>

        <label htmlFor="campaign-select" className="mb-2 block text-sm font-semibold text-[#39332e]">
          Link to campaign (optional)
        </label>
        <select
          id="campaign-select"
          value={campaignId}
          onChange={(event) => loadCampaignDraft(event.target.value)}
          disabled={loading}
          className="mb-4 w-full rounded-xl border border-[#e5ddd4] bg-[#fffdfa] p-3 text-sm"
        >
          <option value="">Review without linking a campaign</option>
          {campaigns.map((campaign) => (
            <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
          ))}
        </select>

        <label htmlFor="red-pen-draft" className="mb-2 block text-sm font-semibold text-[#39332e]">
          Campaign draft
        </label>
        <textarea
          id="red-pen-draft"
          value={content}
          onChange={(event) => { setContent(event.target.value); setResult(null); }}
          placeholder="Paste your headline, campaign copy, description and call to action here..."
          rows={10}
          className="w-full resize-y rounded-xl border border-[#e5ddd4] bg-[#fffdfa] p-4 text-sm leading-6 text-[#292522] outline-none transition placeholder:text-[#aaa19a] focus:border-[#a34e42] focus:ring-2 focus:ring-[#a34e42]/10"
        />

        <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm text-[#625b55]">
          <input
            type="checkbox"
            checked={sourceProvided}
            onChange={(event) => { setSourceProvided(event.target.checked); setResult(null); }}
            className="mt-0.5 h-4 w-4 accent-[#a34e42]"
          />
          <span>I have a source for numerical claims in this draft.</span>
        </label>

        <div className="mt-4 rounded-xl bg-[#faf7f2] p-3 text-xs leading-5 text-[#77706a]">
          {loading
            ? "Loading approved Company Brain records…"
            : `${approvedFacts.length} approved facts · ${approvedClaims.length} approved claims · ${requiredTerms.length} required terms · ${prohibitedTerms.length} prohibited terms loaded`}
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={runCheck}
            disabled={!content.trim() || loading}
            className="rounded-xl bg-[#a34e42] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#873d34] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Run content check
          </button>
          <button
            type="button"
            onClick={clearDraft}
            className="rounded-xl border border-[#e5ddd4] px-5 py-3 text-sm font-semibold text-[#625b55] transition hover:bg-[#faf7f2]"
          >
            Clear draft
          </button>
        </div>
        {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
        {notice && <p role="status" className="mt-4 text-sm text-emerald-700">{notice}</p>}
      </div>

      {result && (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-[#e8e1d8] bg-white p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-[#8a8179]">Content score</p>
              <p className="mt-2 text-4xl font-semibold text-[#292522]">{result.score}<span className="text-lg text-[#8a8179]">/100</span></p>
              <p className="mt-1 text-xs text-[#8a8179]">Heuristic review score</p>
            </div>
            <div className="rounded-2xl border border-[#e8e1d8] bg-white p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-[#8a8179]">Word count</p>
              <p className="mt-2 text-4xl font-semibold text-[#292522]">{result.wordCount}</p>
              <p className="mt-1 text-xs text-[#8a8179]">Words in this draft</p>
            </div>
            <div className="rounded-2xl border border-[#e8e1d8] bg-white p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-[#8a8179]">Review status</p>
              <p className="mt-3 text-lg font-semibold text-[#a34e42]">{statusLabel}</p>
              <p className="mt-1 text-xs text-[#8a8179]">{result.findings.length} potential issue(s)</p>
            </div>
          </div>

          <div className="rounded-2xl border border-[#e8e1d8] bg-white p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-[#292522]">Review findings</h3>
              <span className="text-xs text-[#8a8179]">First-pass automated checks</span>
            </div>
            <p className="mt-2 text-sm leading-6 text-[#77706a]">{result.summary}</p>

            {result.findings.length === 0 ? (
              <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                No obvious issues detected. A human reviewer must still approve the content.
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                {result.findings.map((finding) => (
                  <article key={finding.id} className="rounded-xl border border-[#eee7df] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4 className="font-semibold text-[#39332e]">{finding.title}</h4>
                      <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase ${severityStyle[finding.severity]}`}>
                        {finding.severity}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-[#6f6760]">{finding.explanation}</p>
                    {finding.excerpt && (
                      <blockquote className="mt-3 rounded-lg bg-[#faf7f2] px-3 py-2 text-sm text-[#625b55]">
                        “{finding.excerpt}”
                      </blockquote>
                    )}
                    <p className="mt-3 text-sm text-[#a34e42]">
                      <strong>Suggested action:</strong> {finding.recommendation}
                    </p>
                  </article>
                ))}
              </div>
            )}

            {campaignId && result.findings.length > 0 && (
              <button
                type="button"
                onClick={saveFindings}
                disabled={saving}
                className="mt-5 rounded-xl bg-[#292522] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? "Saving findings…" : "Save findings to campaign"}
              </button>
            )}
          </div>

          <p className="text-xs leading-5 text-[#8a8179]">
            Important: This checker uses deterministic text patterns and approved-record matching.
            It is not an AI model, legal assessment or compliance guarantee. Verify findings and
            obtain human approval before publishing.
          </p>
        </div>
      )}
    </section>
  );
}
