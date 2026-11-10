
"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type CampaignStatus = "draft" | "in_review" | "approved" | "rejected" | "published";

type Campaign = {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  channel: string;
  content: string;
  status: CampaignStatus;
  created_at: string;
  updated_at: string;
};

type Finding = {
  id: string;
  campaign_id: string;
  finding_type: string;
  severity: "high" | "medium" | "low";
  title: string;
  explanation: string;
  evidence: string | null;
  recommendation: string;
  status: string;
};

type CampaignForm = {
  name: string;
  description: string;
  channel: string;
  content: string;
  status: CampaignStatus;
};

const EMPTY_FORM: CampaignForm = {
  name: "",
  description: "",
  channel: "Instagram",
  content: "",
  status: "draft",
};

const STATUSES: { value: CampaignStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "in_review", label: "In review" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Needs changes" },
  { value: "published", label: "Published" },
];

const statusClasses: Record<CampaignStatus, string> = {
  draft: "bg-slate-100 text-slate-700",
  in_review: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-rose-100 text-rose-800",
  published: "bg-blue-100 text-blue-800",
};

const severityClasses = {
  high: "border-red-200 bg-red-50 text-red-800",
  medium: "border-amber-200 bg-amber-50 text-amber-800",
  low: "border-slate-200 bg-slate-50 text-slate-700",
};

function formatDate(value: string) {
  if (!value) return "Recently";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export default function CampaignsPage() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [organizationId, setOrganizationId] = useState("");
  const [organizationName, setOrganizationName] = useState("Workspace");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | CampaignStatus>("all");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [form, setForm] = useState<CampaignForm>(EMPTY_FORM);
  const [expandedCampaign, setExpandedCampaign] = useState<string | null>(null);

  const loadCampaigns = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const supabase = createClient();

      const { data: { user }, error: authError } =
        await supabase.auth.getUser();

      if (authError) throw authError;

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: membership, error: membershipError } = await supabase
        .from("org_memberships")
        .select("organization_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (membershipError) throw membershipError;

      if (!membership?.organization_id) {
        throw new Error("No workspace is linked to your account.");
      }

      const orgId = membership.organization_id;

      const [orgResult, campaignResult, findingResult] = await Promise.all([
        supabase
          .from("organizations")
          .select("name")
          .eq("id", orgId)
          .single(),

        supabase
          .from("campaigns")
          .select("*")
          .eq("organization_id", orgId)
          .order("updated_at", { ascending: false }),

        supabase
          .from("campaign_findings")
          .select(
            "id,campaign_id,finding_type,severity,title,explanation,evidence,recommendation,status"
          )
          .eq("organization_id", orgId)
          .order("id", { ascending: false }),
      ]);

      if (orgResult.error) throw orgResult.error;
      if (campaignResult.error) throw campaignResult.error;
      if (findingResult.error) throw findingResult.error;

      setOrganizationId(orgId);
      setOrganizationName(orgResult.data.name);
      setCampaigns((campaignResult.data ?? []) as Campaign[]);
      setFindings((findingResult.data ?? []) as Finding[]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load campaign workspace."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadCampaigns(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadCampaigns]);

  const counts = useMemo(() => ({
    total: campaigns.length,
    draft: campaigns.filter((item) => item.status === "draft").length,
    review: campaigns.filter((item) => item.status === "in_review").length,
    approved: campaigns.filter((item) => item.status === "approved").length,
    published: campaigns.filter((item) => item.status === "published").length,
  }), [campaigns]);

  const findingCounts = useMemo(() => ({
    total: findings.length,
    high: findings.filter((item) => item.severity === "high").length,
    medium: findings.filter((item) => item.severity === "medium").length,
    low: findings.filter((item) => item.severity === "low").length,
  }), [findings]);

  const filtered = useMemo(() => campaigns.filter((item) => {
    const matchesSearch =
      `${item.name} ${item.description ?? ""} ${item.channel}`
        .toLowerCase()
        .includes(search.toLowerCase());

    return matchesSearch && (filter === "all" || item.status === filter);
  }), [campaigns, search, filter]);

  function campaignFindings(campaignId: string) {
    return findings.filter((item) => item.campaign_id === campaignId);
  }

  async function writeAudit(
    action: string,
    entityType: string,
    entityId: string | null,
    description: string,
    oldValue?: unknown,
    newValue?: unknown
  ) {
    try {
      const supabase = createClient();

      const { error: auditError } = await supabase
        .from("audit_logs")
        .insert({
          organization_id: organizationId,
          action,
          entity_type: entityType,
          entity_id: entityId,
          description,
          old_value: oldValue ?? null,
          new_value: newValue ?? null,
        });

      return auditError?.message ?? null;
    } catch (err) {
      return err instanceof Error ? err.message : "Audit logging failed.";
    }
  }

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setEditorOpen(true);
    setError("");
    setNotice("");
  }

  function openEdit(campaign: Campaign) {
    setEditing(campaign);

    setForm({
      name: campaign.name,
      description: campaign.description ?? "",
      channel: campaign.channel,
      content: campaign.content ?? "",
      status: campaign.status,
    });

    setEditorOpen(true);
    setError("");
    setNotice("");
  }

  async function saveCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!organizationId || !form.name.trim()) return;

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const supabase = createClient();

      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        channel: form.channel,
        content: form.content,
        status: form.status,
        updated_at: new Date().toISOString(),
      };

      if (editing) {
        const { data, error: updateError } = await supabase
          .from("campaigns")
          .update(payload)
          .eq("id", editing.id)
          .eq("organization_id", organizationId)
          .select("*")
          .single();

        if (updateError) throw updateError;

        setCampaigns((previous) =>
          previous.map((item) => item.id === editing.id ? data as Campaign : item)
        );

        const auditWarning = await writeAudit(
          "updated",
          "campaign",
          data.id,
          `Updated campaign: ${data.name}`,
          editing,
          data
        );

        setNotice(
          auditWarning
            ? "Campaign updated. Audit entry could not be recorded."
            : "Campaign updated successfully."
        );
      } else {
        const { data, error: insertError } = await supabase
          .from("campaigns")
          .insert({
            ...payload,
            organization_id: organizationId,
          })
          .select("*")
          .single();

        if (insertError) throw insertError;

        setCampaigns((previous) => [data as Campaign, ...previous]);

        const auditWarning = await writeAudit(
          "created",
          "campaign",
          data.id,
          `Created campaign: ${data.name}`,
          null,
          data
        );

        setNotice(
          auditWarning
            ? "Campaign created. Audit entry could not be recorded."
            : "Campaign created successfully."
        );
      }

      setEditorOpen(false);
      setEditing(null);
      setForm(EMPTY_FORM);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save campaign.");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(campaign: Campaign, status: CampaignStatus) {
    if (status === "approved" || status === "published") {
      setError("Approval and publication must be completed through the Review Desk.");
      setNotice("");
      return;
    }

    if (campaign.status === status) return;

    setError("");
    setNotice("");

    const supabase = createClient();

    const { data, error: updateError } = await supabase
      .from("campaigns")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", campaign.id)
      .eq("organization_id", organizationId)
      .select("*")
      .single();

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setCampaigns((previous) =>
      previous.map((item) => item.id === campaign.id ? data as Campaign : item)
    );

    const auditWarning = await writeAudit(
      "status_changed",
      "campaign",
      campaign.id,
      `Changed campaign "${campaign.name}" from ${campaign.status} to ${status}`,
      { status: campaign.status },
      { status }
    );

    setNotice(
      auditWarning
        ? "Campaign status updated. Audit entry could not be recorded."
        : `Campaign moved to ${STATUSES.find((item) => item.value === status)?.label}.`
    );
  }

  async function deleteCampaign(campaign: Campaign) {
    if (!window.confirm(`Delete "${campaign.name}"? This cannot be undone.`)) return;

    setError("");
    setNotice("");

    const supabase = createClient();

    const { error: deleteError } = await supabase
      .from("campaigns")
      .delete()
      .eq("id", campaign.id)
      .eq("organization_id", organizationId);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setCampaigns((previous) =>
      previous.filter((item) => item.id !== campaign.id)
    );

    setFindings((previous) =>
      previous.filter((item) => item.campaign_id !== campaign.id)
    );

    const auditWarning = await writeAudit(
      "deleted",
      "campaign",
      campaign.id,
      `Deleted campaign: ${campaign.name}`,
      campaign
    );

    setNotice(
      auditWarning
        ? "Campaign deleted. Audit entry could not be recorded."
        : "Campaign deleted successfully."
    );
  }

  return (
    <main className="min-h-screen bg-[#faf7f2] text-[#292522]">
      <header className="border-b border-[#e8e1d8] bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <div className="flex flex-wrap items-center gap-4">
            <Link href="/" className="text-sm font-semibold text-[#a34e42] hover:underline">
              ← Company Brain
            </Link>
            <Link href="/content-checker" className="text-sm text-[#6f6760] hover:text-[#a34e42]">
              Content Checker
            </Link>
            <Link href="/review-desk" className="text-sm text-[#6f6760] hover:text-[#a34e42]">
              Review Desk
            </Link>
            <Link href="/consistency-radar" className="text-sm text-[#6f6760] hover:text-[#a34e42]">
              Consistency Radar
            </Link>
          </div>
          <div className="font-bold tracking-tight">
            the red pen<span className="text-[#a34e42]">.</span>
          </div>
          <div className="text-sm text-[#77706a]">{organizationName}</div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-9 sm:px-8">
        <section className="mb-8 flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#a34e42]">
              Campaign workspace
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              Campaigns
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#77706a]">
              Manage campaign drafts, inspect content-check findings and track
              each campaign before publication.
            </p>
          </div>

          <button
            onClick={openCreate}
            disabled={!organizationId || loading}
            className="rounded-xl bg-[#a34e42] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#873d34] disabled:opacity-40"
          >
            + New campaign
          </button>
        </section>

        {error && (
          <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        )}

        {notice && (
          <div role="status" className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            {notice}
          </div>
        )}

        <section className="mb-7 grid grid-cols-2 gap-3 lg:grid-cols-5">
          {[
            ["Total campaigns", counts.total],
            ["Drafts", counts.draft],
            ["In review", counts.review],
            ["Approved", counts.approved],
            ["Published", counts.published],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-[#e8e1d8] bg-white p-5">
              <p className="text-xs font-medium text-[#8a8179]">{label}</p>
              <p className="mt-2 text-3xl font-semibold">{value}</p>
            </div>
          ))}
        </section>

        <section className="mb-7 rounded-2xl border border-[#e8e1d8] bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Content review overview</h2>
              <p className="mt-1 text-xs text-[#8a8179]">
                Findings saved from Content Checker across all campaigns.
              </p>
            </div>
            <Link href="/content-checker" className="text-sm font-semibold text-[#a34e42] hover:underline">
              Open Content Checker →
            </Link>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Total findings", findingCounts.total],
              ["High severity", findingCounts.high],
              ["Medium severity", findingCounts.medium],
              ["Low severity", findingCounts.low],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-[#faf7f2] p-4">
                <p className="text-xs text-[#8a8179]">{label}</p>
                <p className="mt-2 text-2xl font-semibold">{value}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-[#e8e1d8] bg-white p-5 sm:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Campaign library</h2>

            <div className="flex flex-wrap gap-2">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search campaigns..."
                className="w-full rounded-lg border border-[#e5ddd4] px-3 py-2 text-sm outline-none focus:border-[#a34e42] sm:w-56"
              />

              <select
                value={filter}
                onChange={(event) => setFilter(event.target.value as "all" | CampaignStatus)}
                className="rounded-lg border border-[#e5ddd4] bg-white px-3 py-2 text-sm"
              >
                <option value="all">All statuses</option>
                {STATUSES.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="py-14 text-center text-sm text-[#8a8179]">
              Loading campaigns and findings...
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#ded5ca] bg-[#fffdfa] px-5 py-14 text-center">
              <p className="text-lg font-semibold">
                {campaigns.length ? "No matching campaigns" : "Your campaign workspace is ready"}
              </p>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#8a8179]">
                {campaigns.length
                  ? "Try another search or status filter."
                  : "Create your first campaign to organize content and track its approval journey."}
              </p>
              {campaigns.length === 0 && (
                <button onClick={openCreate} className="mt-5 rounded-lg bg-[#a34e42] px-4 py-2.5 text-sm font-semibold text-white">
                  Create first campaign
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filtered.map((campaign) => {
                const campaignItems = campaignFindings(campaign.id);
                const high = campaignItems.filter((item) => item.severity === "high").length;
                const medium = campaignItems.filter((item) => item.severity === "medium").length;
                const low = campaignItems.filter((item) => item.severity === "low").length;
                const expanded = expandedCampaign === campaign.id;

                return (
                  <article key={campaign.id} className="rounded-xl border border-[#eee7df] p-4 transition hover:border-[#d8c8b9] sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold">{campaign.name}</h3>
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClasses[campaign.status]}`}>
                            {STATUSES.find((item) => item.value === campaign.status)?.label ?? campaign.status}
                          </span>
                        </div>

                        <p className="mt-1 text-xs text-[#8a8179]">
                          {campaign.channel} · Updated {formatDate(campaign.updated_at)}
                        </p>

                        {campaign.description && (
                          <p className="mt-3 text-sm leading-6 text-[#6f6760]">
                            {campaign.description}
                          </p>
                        )}

                        {campaign.content && (
                          <p className="mt-3 line-clamp-2 whitespace-pre-wrap text-sm leading-6 text-[#77706a]">
                            {campaign.content}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          aria-label={`Change status for ${campaign.name}`}
                          value={campaign.status}
                          onChange={(event) => void changeStatus(campaign, event.target.value as CampaignStatus)}
                          className="rounded-lg border border-[#e5ddd4] bg-white px-2.5 py-2 text-xs"
                        >
                          {STATUSES.map((item) => (
                            <option key={item.value} value={item.value}>{item.label}</option>
                          ))}
                        </select>

                        <button onClick={() => openEdit(campaign)} className="rounded-lg border border-[#e5ddd4] px-3 py-2 text-xs font-semibold hover:bg-[#faf7f2]">
                          Edit
                        </button>

                        <button onClick={() => void deleteCampaign(campaign)} className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50">
                          Delete
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#f0ebe5] pt-4">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-semibold text-[#625b55]">
                          {campaignItems.length} finding(s)
                        </span>
                        {high > 0 && <span className="rounded-full bg-red-50 px-2.5 py-1 font-semibold text-red-800">{high} high</span>}
                        {medium > 0 && <span className="rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-800">{medium} medium</span>}
                        {low > 0 && <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">{low} low</span>}
                      </div>

                      <div className="flex flex-wrap gap-4">
                        <button
                          type="button"
                          onClick={() => setExpandedCampaign(expanded ? null : campaign.id)}
                          className="text-xs font-semibold text-[#625b55] hover:text-[#a34e42]"
                        >
                          {expanded ? "Hide findings ↑" : "View findings ↓"}
                        </button>

                        <Link
                          href="/content-checker"
                          className="text-xs font-semibold text-[#a34e42] hover:underline"
                        >
                          Check content →
                        </Link>

                        <Link
                          href="/review-desk"
                          className="text-xs font-semibold text-[#a34e42] hover:underline"
                        >
                          Review Desk →
                        </Link>
                      </div>
                    </div>

                    {expanded && (
                      <div className="mt-4 space-y-3">
                        {campaignItems.length === 0 ? (
                          <div className="rounded-lg bg-[#faf7f2] p-4 text-sm text-[#77706a]">
                            No saved findings for this campaign yet. Run a check in Content Checker and save its findings here.
                          </div>
                        ) : (
                          campaignItems.map((finding) => (
                            <div key={finding.id} className="rounded-xl border border-[#eee7df] p-4">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <h4 className="text-sm font-semibold">{finding.title}</h4>
                                <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase ${severityClasses[finding.severity] ?? severityClasses.low}`}>
                                  {finding.severity}
                                </span>
                              </div>
                              <p className="mt-2 text-sm leading-6 text-[#6f6760]">
                                {finding.explanation}
                              </p>
                              {finding.evidence && (
                                <blockquote className="mt-2 rounded-lg bg-[#faf7f2] px-3 py-2 text-xs text-[#625b55]">
                                  “{finding.evidence}”
                                </blockquote>
                              )}
                              <p className="mt-2 text-sm text-[#a34e42]">
                                <strong>Suggested action:</strong> {finding.recommendation}
                              </p>
                              <p className="mt-2 text-xs text-[#8a8179]">
                                Type: {finding.finding_type} · Status: {finding.status}
                              </p>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {editorOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#211b18]/50 p-4"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget && !saving) setEditorOpen(false);
            }}
          >
            <form onSubmit={saveCampaign} className="my-6 w-full max-w-2xl rounded-2xl bg-white p-5 shadow-2xl sm:p-7">
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-[#a34e42]">
                    Campaign details
                  </p>
                  <h2 className="mt-1 text-2xl font-semibold">
                    {editing ? "Edit campaign" : "New campaign"}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setEditorOpen(false)}
                  disabled={saving}
                  aria-label="Close"
                  className="rounded-lg px-3 py-1 text-xl text-[#77706a] hover:bg-[#faf7f2]"
                >
                  ×
                </button>
              </div>

              <div className="space-y-4">
                <label className="block text-sm font-semibold">
                  Campaign name *
                  <input
                    required
                    maxLength={120}
                    value={form.name}
                    onChange={(event) => setForm({ ...form, name: event.target.value })}
                    placeholder="e.g. Winter launch campaign"
                    className="mt-2 w-full rounded-lg border border-[#e5ddd4] px-3 py-3 font-normal outline-none focus:border-[#a34e42]"
                  />
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm font-semibold">
                    Channel
                    <select
                      value={form.channel}
                      onChange={(event) => setForm({ ...form, channel: event.target.value })}
                      className="mt-2 w-full rounded-lg border border-[#e5ddd4] bg-white px-3 py-3 font-normal"
                    >
                      {["Instagram", "Facebook", "LinkedIn", "Website", "Email", "Print", "Other"].map((channel) => (
                        <option key={channel}>{channel}</option>
                      ))}
                    </select>
                  </label>

                  <label className="block text-sm font-semibold">
                    Status
                    <select
                      value={form.status}
                      onChange={(event) => setForm({ ...form, status: event.target.value as CampaignStatus })}
                      className="mt-2 w-full rounded-lg border border-[#e5ddd4] bg-white px-3 py-3 font-normal"
                    >
                      {STATUSES.map((item) => (
                        <option
                          key={item.value}
                          value={item.value}
                          disabled={item.value === "approved" || item.value === "published"}
                        >
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="block text-sm font-semibold">
                  Description
                  <textarea
                    rows={2}
                    maxLength={500}
                    value={form.description}
                    onChange={(event) => setForm({ ...form, description: event.target.value })}
                    placeholder="What is this campaign about?"
                    className="mt-2 w-full rounded-lg border border-[#e5ddd4] px-3 py-3 font-normal outline-none focus:border-[#a34e42]"
                  />
                </label>

                <label className="block text-sm font-semibold">
                  Draft content
                  <textarea
                    rows={7}
                    value={form.content}
                    onChange={(event) => setForm({ ...form, content: event.target.value })}
                    placeholder="Add campaign copy, headline, CTA or draft..."
                    className="mt-2 w-full rounded-lg border border-[#e5ddd4] px-3 py-3 font-normal outline-none focus:border-[#a34e42]"
                  />
                </label>
              </div>

              <div className="mt-6 flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setEditorOpen(false)}
                  className="rounded-lg border border-[#e5ddd4] px-4 py-3 text-sm font-semibold"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving || !form.name.trim()}
                  className="rounded-lg bg-[#a34e42] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {saving ? "Saving..." : editing ? "Save changes" : "Create campaign"}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </main>
  );
}
