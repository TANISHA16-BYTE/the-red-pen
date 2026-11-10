
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type Campaign = {
  id: string;
  name: string;
  description: string | null;
  channel: string;
  content: string;
  status: string;
  created_at: string;
};

type Finding = {
  id: string;
  campaign_id: string | null;
  title: string;
  explanation: string;
  evidence: string | null;
  recommendation: string;
  severity: string;
  status: string;
};

type Review = {
  id: string;
  campaign_id: string;
  decision: string;
  comments: string;
  created_at: string;
};

type Decision = "approved" | "rejected" | "changes_requested";

const decisionLabels: Record<string, string> = {
  approved: "Approved",
  rejected: "Rejected",
  changes_requested: "Changes requested",
};

export default function ReviewDeskPage() {
  const router = useRouter();

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [organizationId, setOrganizationId] = useState("");
  const [userId, setUserId] = useState("");
  const [comments, setComments] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [resolvingId, setResolvingId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
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

      setUserId(authData.user.id);

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
      setOrganizationId(orgId);

      const [campaignResult, findingResult, reviewResult] = await Promise.all([
        supabase
          .from("campaigns")
          .select("id,name,description,channel,content,status,created_at")
          .eq("organization_id", orgId)
          .order("created_at", { ascending: false }),

        supabase
          .from("campaign_findings")
          .select("id,campaign_id,title,explanation,evidence,recommendation,severity,status")
          .eq("organization_id", orgId)
          .order("created_at", { ascending: false }),

        supabase
          .from("campaign_reviews")
          .select("id,campaign_id,decision,comments,created_at")
          .eq("organization_id", orgId)
          .order("created_at", { ascending: false }),
      ]);

      if (campaignResult.error) throw campaignResult.error;
      if (findingResult.error) throw findingResult.error;
      if (reviewResult.error) throw reviewResult.error;

      setCampaigns((campaignResult.data ?? []) as Campaign[]);
      setFindings((findingResult.data ?? []) as Finding[]);
      setReviews((reviewResult.data ?? []) as Review[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load Review Desk.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadData(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  const pendingCampaigns = useMemo(
    () => campaigns.filter((campaign) =>
      ["draft", "in_review"].includes(campaign.status)
    ),
    [campaigns]
  );

  const visibleCampaigns = useMemo(() => {
    if (filter === "all") return campaigns;
    if (filter === "pending") return pendingCampaigns;
    return campaigns.filter((campaign) => campaign.status === filter);
  }, [campaigns, filter, pendingCampaigns]);

  function getFindings(campaignId: string) {
    return findings.filter((finding) => finding.campaign_id === campaignId);
  }

  function getLatestReview(campaignId: string) {
    return reviews.find((review) => review.campaign_id === campaignId);
  }

  async function writeAudit(
    action: string,
    entityType: string,
    entityId: string | null,
    description: string,
    oldValue?: unknown,
    newValue?: unknown
  ) {
    const { error: auditError } = await supabase
      .from("audit_logs")
      .insert({
        organization_id: organizationId,
        actor_id: userId,
        action,
        entity_type: entityType,
        entity_id: entityId,
        description,
        old_value: oldValue ?? null,
        new_value: newValue ?? null,
      });

    return auditError?.message ?? null;
  }

  async function resolveFinding(finding: Finding) {
    if (!organizationId || !finding.id) return;
    if (finding.status !== "open") return;

    setResolvingId(finding.id);
    setError("");
    setMessage("");

    try {
      const { data, error: updateError } = await supabase
        .from("campaign_findings")
        .update({ status: "resolved" })
        .eq("id", finding.id)
        .eq("organization_id", organizationId)
        .eq("status", "open")
        .select("id,status")
        .single();

      if (updateError) throw updateError;
      if (!data) throw new Error("Finding was not updated. Refresh and try again.");

      setFindings((previous) =>
        previous.map((item) =>
          item.id === finding.id ? { ...item, status: "resolved" } : item
        )
      );

      const auditWarning = await writeAudit(
        "resolved",
        "campaign_finding",
        finding.id,
        `Resolved finding: ${finding.title}`,
        { status: "open" },
        { status: "resolved" }
      );

      setMessage(
        auditWarning
          ? "Finding resolved. Audit entry could not be recorded."
          : "Finding marked as resolved."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to resolve finding.");
    } finally {
      setResolvingId("");
    }
  }

  async function submitDecision(campaign: Campaign, decision: Decision) {
    if (!organizationId || !userId) return;
    if (savingId) return;

    const openHighFindings = findings.filter(
      (finding) =>
        finding.campaign_id === campaign.id &&
        finding.status === "open" &&
        finding.severity === "high"
    );

    if (decision === "approved" && openHighFindings.length > 0) {
      setError(
        `Approval blocked: resolve all ${openHighFindings.length} open high-severity finding(s) first.`
      );
      setMessage("");
      return;
    }

    setSavingId(campaign.id);
    setError("");
    setMessage("");

    const reviewerComments = comments[campaign.id]?.trim() ?? "";

    const nextStatus =
      decision === "approved"
        ? "approved"
        : decision === "rejected"
          ? "rejected"
          : "in_review";

    let insertedReviewId: string | null = null;

    try {
      const { data: reviewData, error: reviewError } = await supabase
        .from("campaign_reviews")
        .insert({
          organization_id: organizationId,
          campaign_id: campaign.id,
          decision,
          comments: reviewerComments,
          reviewed_by: userId,
        })
        .select("id")
        .single();

      if (reviewError) throw reviewError;

      insertedReviewId = reviewData.id;

      const { data: updatedCampaign, error: campaignError } = await supabase
        .from("campaigns")
        .update({
          status: nextStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", campaign.id)
        .eq("organization_id", organizationId)
        .eq("status", campaign.status)
        .select("id,status")
        .single();

      if (campaignError || !updatedCampaign) {
        if (insertedReviewId) {
          await supabase
            .from("campaign_reviews")
            .delete()
            .eq("id", insertedReviewId)
            .eq("organization_id", organizationId);
        }

        throw new Error(
          campaignError?.message ??
          "Campaign status changed elsewhere. Refresh the review queue."
        );
      }

      setCampaigns((previous) =>
        previous.map((item) =>
          item.id === campaign.id
            ? { ...item, status: nextStatus }
            : item
        )
      );

      const auditWarning = await writeAudit(
        decision,
        "review",
        campaign.id,
        `${campaign.name}: ${decisionLabels[decision]}`,
        { status: campaign.status },
        {
          status: nextStatus,
          decision,
          comments: reviewerComments,
        }
      );

      setComments((previous) => ({
        ...previous,
        [campaign.id]: "",
      }));

      setMessage(
        auditWarning
          ? `${campaign.name}: ${decisionLabels[decision]}. Audit entry could not be recorded.`
          : `${campaign.name}: ${decisionLabels[decision]} — review saved successfully.`
      );

      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save review.");
    } finally {
      setSavingId("");
    }
  }

  const stats = [
    { label: "Total campaigns", value: campaigns.length },
    { label: "Awaiting review", value: pendingCampaigns.length },
    { label: "Approved", value: campaigns.filter((c) => c.status === "approved").length },
    { label: "Open findings", value: findings.filter((f) => f.status === "open").length },
  ];

  return (
    <main className="min-h-screen bg-[#f7f5f0] text-[#282522]">
      <header className="border-b border-[#e8e2d9] bg-[#fffefa]">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-5">
          <div>
            <Link href="/" className="text-sm text-[#a34b3d] hover:underline">
              ← The Red Pen
            </Link>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">Review Desk</h1>
            <p className="mt-1 text-sm text-[#77716a]">
              Human decisions, clear accountability, safer publishing.
            </p>
          </div>

          <nav className="flex flex-wrap gap-2 text-sm">
            <Link className="rounded-full border border-[#e8e2d9] px-3 py-2 hover:bg-[#f7f5f0]" href="/">Company Brain</Link>
            <Link className="rounded-full border border-[#e8e2d9] px-3 py-2 hover:bg-[#f7f5f0]" href="/content-checker">Content Checker</Link>
            <Link className="rounded-full border border-[#e8e2d9] px-3 py-2 hover:bg-[#f7f5f0]" href="/campaigns">Campaigns</Link>
            <Link className="rounded-full border border-[#e8e2d9] px-3 py-2 hover:bg-[#f7f5f0]" href="/consistency-radar">Consistency Radar</Link>
            <Link className="rounded-full border border-[#e8e2d9] px-3 py-2 hover:bg-[#f7f5f0]" href="/audit-history">Audit History</Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-5 py-8">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-[#e9e3da] bg-white p-5">
              <p className="text-sm text-[#77716a]">{stat.label}</p>
              <p className="mt-2 text-3xl font-semibold">{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#a34b3d]">
              Human approval workflow
            </p>
            <h2 className="mt-2 text-xl font-semibold">Campaign review queue</h2>
            <p className="mt-1 text-sm text-[#77716a]">
              Resolve blocking findings before approving campaign content.
            </p>
          </div>

          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            className="rounded-xl border border-[#e5ded4] bg-white px-4 py-3 text-sm outline-none focus:border-[#a34b3d]"
          >
            <option value="pending">Awaiting review</option>
            <option value="all">All campaigns</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="published">Published</option>
          </select>
        </div>

        {message && (
          <div role="status" className="mt-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            {message}
          </div>
        )}

        {error && (
          <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        {loading ? (
          <div className="mt-8 rounded-2xl border border-[#e9e3da] bg-white p-10 text-center text-sm text-[#77716a]">
            Loading your review queue...
          </div>
        ) : visibleCampaigns.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-[#d9d0c5] bg-white px-6 py-14 text-center">
            <h3 className="text-lg font-semibold">No campaigns in this view</h3>
            <p className="mt-2 text-sm text-[#77716a]">
              Create a campaign or change the filter to see review items here.
            </p>
            <Link href="/campaigns" className="mt-5 inline-flex rounded-xl bg-[#a34b3d] px-5 py-3 text-sm font-medium text-white hover:bg-[#873b30]">
              Open Campaign Management
            </Link>
          </div>
        ) : (
          <div className="mt-5 space-y-5">
            {visibleCampaigns.map((campaign) => {
              const campaignFindings = getFindings(campaign.id);
              const latestReview = getLatestReview(campaign.id);
              const isPending = ["draft", "in_review"].includes(campaign.status);

              const blockingCount = campaignFindings.filter(
                (finding) =>
                  finding.status === "open" && finding.severity === "high"
              ).length;

              return (
                <article key={campaign.id} className="overflow-hidden rounded-2xl border border-[#e9e3da] bg-white">
                  <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#eee9e1] p-5 md:p-6">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-[#f4eee8] px-3 py-1 text-xs font-medium capitalize text-[#815344]">
                          {campaign.channel || "Other"}
                        </span>
                        <span className="rounded-full bg-[#f3f1ed] px-3 py-1 text-xs font-medium capitalize text-[#625c55]">
                          {campaign.status.replaceAll("_", " ")}
                        </span>
                      </div>

                      <h3 className="mt-3 text-lg font-semibold">{campaign.name}</h3>
                      <p className="mt-1 max-w-3xl whitespace-pre-wrap text-sm leading-6 text-[#77716a]">
                        {campaign.description || "No campaign description provided."}
                      </p>
                    </div>

                    <span className="text-xs text-[#8b847c]">
                      Created {new Date(campaign.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="grid gap-5 p-5 md:grid-cols-[1.2fr_0.8fr] md:p-6">
                    <div>
                      <h4 className="text-sm font-semibold">Campaign content</h4>
                      <div className="mt-2 max-h-56 overflow-y-auto whitespace-pre-wrap rounded-xl bg-[#faf8f4] p-4 text-sm leading-6 text-[#514b44]">
                        {campaign.content || "No campaign content has been added yet."}
                      </div>

                      <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
                        <h4 className="text-sm font-semibold">
                          Related findings ({campaignFindings.length})
                        </h4>
                        {blockingCount > 0 && (
                          <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
                            {blockingCount} approval blocker(s)
                          </span>
                        )}
                      </div>

                      {campaignFindings.length === 0 ? (
                        <p className="mt-2 rounded-xl bg-[#f8f7f3] p-4 text-sm text-[#77716a]">
                          No findings are linked to this campaign.
                        </p>
                      ) : (
                        <div className="mt-2 space-y-2">
                          {campaignFindings.map((finding) => {
                            const isOpen = finding.status === "open";

                            return (
                              <div key={finding.id} className="rounded-xl border border-[#eee9e1] p-4">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${
                                    finding.severity === "high"
                                      ? "bg-red-50 text-red-700"
                                      : finding.severity === "medium"
                                        ? "bg-amber-50 text-amber-700"
                                        : "bg-slate-100 text-slate-600"
                                  }`}>
                                    {finding.severity}
                                  </span>

                                  <span className="text-xs capitalize text-[#8b847c]">
                                    {finding.status}
                                  </span>
                                </div>

                                <p className="mt-2 text-sm font-medium">{finding.title}</p>
                                <p className="mt-1 text-sm leading-6 text-[#77716a]">{finding.explanation}</p>

                                {finding.evidence && (
                                  <p className="mt-2 text-xs text-[#8b5d50]">
                                    Evidence: {finding.evidence}
                                  </p>
                                )}

                                {finding.recommendation && (
                                  <p className="mt-2 text-xs text-[#5f705c]">
                                    Suggested action: {finding.recommendation}
                                  </p>
                                )}

                                {isOpen && (
                                  <button
                                    type="button"
                                    disabled={resolvingId === finding.id}
                                    onClick={() => void resolveFinding(finding)}
                                    className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
                                  >
                                    {resolvingId === finding.id ? "Resolving..." : "Mark as resolved"}
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold">Reviewer decision</h4>

                      {latestReview && (
                        <div className="mt-2 rounded-xl bg-[#f8f7f3] p-4">
                          <p className="text-xs text-[#8b847c]">Latest recorded review</p>
                          <p className="mt-1 text-sm font-semibold">
                            {decisionLabels[latestReview.decision] ?? latestReview.decision}
                          </p>
                          {latestReview.comments && (
                            <p className="mt-2 text-sm text-[#77716a]">{latestReview.comments}</p>
                          )}
                          <p className="mt-2 text-xs text-[#8b847c]">
                            {new Date(latestReview.created_at).toLocaleString()}
                          </p>
                        </div>
                      )}

                      {isPending ? (
                        <>
                          <label className="mt-4 block text-sm font-medium" htmlFor={`comments-${campaign.id}`}>
                            Review comments
                          </label>

                          <textarea
                            id={`comments-${campaign.id}`}
                            value={comments[campaign.id] ?? ""}
                            onChange={(event) =>
                              setComments((previous) => ({
                                ...previous,
                                [campaign.id]: event.target.value,
                              }))
                            }
                            rows={4}
                            placeholder="Explain your decision or requested changes..."
                            className="mt-2 w-full resize-y rounded-xl border border-[#e5ded4] bg-white p-3 text-sm outline-none focus:border-[#a34b3d]"
                          />

                          {blockingCount > 0 && (
                            <p className="mt-2 text-xs leading-5 text-red-700">
                              Approval is disabled until all open high-severity findings are resolved.
                            </p>
                          )}

                          <div className="mt-3 grid grid-cols-1 gap-2">
                            <button
                              type="button"
                              disabled={savingId === campaign.id || blockingCount > 0}
                              onClick={() => void submitDecision(campaign, "approved")}
                              className="rounded-xl bg-[#47634a] px-4 py-3 text-sm font-medium text-white hover:bg-[#38513b] disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              {savingId === campaign.id ? "Saving..." : "Approve campaign"}
                            </button>

                            <button
                              type="button"
                              disabled={savingId === campaign.id}
                              onClick={() => void submitDecision(campaign, "changes_requested")}
                              className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                            >
                              Request changes
                            </button>

                            <button
                              type="button"
                              disabled={savingId === campaign.id}
                              onClick={() => void submitDecision(campaign, "rejected")}
                              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                            >
                              Reject campaign
                            </button>
                          </div>
                        </>
                      ) : (
                        <p className="mt-4 rounded-xl bg-[#f8f7f3] p-4 text-sm text-[#77716a]">
                          This campaign is not currently awaiting review. Its status is {campaign.status.replaceAll("_", " ")}.
                        </p>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <div className="mt-8 flex justify-end">
          <button
            type="button"
            onClick={() => void loadData()}
            className="rounded-xl border border-[#ded7cd] bg-white px-4 py-2.5 text-sm font-medium hover:bg-[#f8f7f3]"
          >
            Refresh review queue
          </button>
        </div>
      </section>
    </main>
  );
}
