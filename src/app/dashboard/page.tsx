"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity, AlertTriangle, ArrowRight, ArrowUpRight, BookOpen,
  CheckCircle2, ChevronRight, CircleDot, ClipboardCheck, Clock3,
  FileCheck2, History, LayoutDashboard, Plus, Radar, RefreshCw,
  ShieldCheck, Sparkles
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";

type Campaign = {
  id: string;
  name: string;
  status: string;
  channel: string;
  created_at: string;
};

type Finding = {
  id: string;
  campaign_id: string;
  title: string;
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

type ActivityItem = {
  id: string;
  action: string;
  entity_type: string;
  description: string;
  created_at: string;
};

const modules = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Company Brain", href: "/", icon: BookOpen },
  { name: "Content Checker", href: "/content-checker", icon: FileCheck2 },
  { name: "Campaigns", href: "/campaigns", icon: ClipboardCheck },
  { name: "Consistency Radar", href: "/consistency-radar", icon: Radar },
  { name: "Review Desk", href: "/review-desk", icon: ShieldCheck },
  { name: "Audit History", href: "/audit-history", icon: History },
];

function formatDate(value: string, withTime = false) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return date.toLocaleString("en-IN", withTime
    ? { dateStyle: "medium", timeStyle: "short" }
    : { dateStyle: "medium" });
}

function readable(value: string) {
  return value.replaceAll("_", " ");
}

function statusStyle(status: string) {
  switch (status.toLowerCase()) {
    case "approved":
    case "resolved":
    case "published":
      return "status-good";
    case "rejected":
    case "dismissed":
      return "status-bad";
    case "in_review":
    case "pending":
      return "status-warn";
    default:
      return "status-neutral";
  }
}

export default function DashboardPage() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;

      if (!authData.user) {
        router.replace("/login");
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

      const [campaignResult, findingResult, reviewResult, activityResult] =
        await Promise.all([
          supabase.from("campaigns")
            .select("id,name,status,channel,created_at")
            .eq("organization_id", orgId)
            .order("created_at", { ascending: false }),
          supabase.from("campaign_findings")
            .select("id,campaign_id,title,severity,status")
            .eq("organization_id", orgId)
            .order("created_at", { ascending: false }),
          supabase.from("campaign_reviews")
            .select("id,campaign_id,decision,comments,created_at")
            .eq("organization_id", orgId)
            .order("created_at", { ascending: false })
            .limit(5),
          supabase.from("audit_logs")
            .select("id,action,entity_type,description,created_at")
            .eq("organization_id", orgId)
            .order("created_at", { ascending: false })
            .limit(6),
        ]);

      if (campaignResult.error) throw campaignResult.error;
      if (findingResult.error) throw findingResult.error;
      if (reviewResult.error) throw reviewResult.error;
      if (activityResult.error) throw activityResult.error;

      setCampaigns(campaignResult.data ?? []);
      setFindings(findingResult.data ?? []);
      setReviews(reviewResult.data ?? []);
      setActivities(activityResult.data ?? []);
      setLastUpdated(new Date().toLocaleTimeString("en-IN", {
        hour: "2-digit", minute: "2-digit"
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load workspace data.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    // Initial Supabase synchronization; state updates happen inside the async loader.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadDashboard();
  }, [loadDashboard]);

  const pending = campaigns.filter(c =>
    ["draft", "in_review", "pending"].includes(c.status.toLowerCase())
  ).length;
  const approved = campaigns.filter(c =>
    c.status.toLowerCase() === "approved"
  ).length;
  const openFindings = findings.filter(f =>
    f.status.toLowerCase() === "open"
  );
  const highFindings = openFindings.filter(f =>
    ["high", "critical"].includes(f.severity.toLowerCase())
  ).length;
  const mediumFindings = openFindings.filter(f =>
    f.severity.toLowerCase() === "medium"
  ).length;
  const resolvedFindings = findings.filter(f =>
    f.status.toLowerCase() === "resolved"
  ).length;

  const healthScore = useMemo(() => {
    if (campaigns.length === 0 && findings.length === 0) return 100;
    const penalty = openFindings.reduce((total, finding) => {
      const severity = finding.severity.toLowerCase();
      return total + (severity === "critical" ? 15 : severity === "high" ? 10 : severity === "medium" ? 5 : 2);
    }, 0);
    return Math.max(0, Math.min(100, 100 - penalty));
  }, [campaigns.length, findings.length, openFindings]);

  const campaignNames = useMemo(
    () => new Map(campaigns.map(c => [c.id, c.name])),
    [campaigns]
  );

  const stats = [
    { label: "TOTAL CAMPAIGNS", value: campaigns.length, detail: "Across your workspace", icon: ClipboardCheck, tone: "neutral" },
    { label: "AWAITING REVIEW", value: pending, detail: "Draft and pending", icon: Clock3, tone: "amber" },
    { label: "APPROVED", value: approved, detail: "Successfully approved", icon: CheckCircle2, tone: "green" },
    { label: "OPEN FINDINGS", value: openFindings.length, detail: `${highFindings} high severity`, icon: AlertTriangle, tone: "red" },
  ];

  const latestIssues = openFindings.slice(0, 5);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/dashboard" className="brand">
          <div className="brand-mark"><span>R</span></div>
          <div>
            <strong>The Red Pen</strong>
            <small>BRAND GOVERNANCE</small>
          </div>
        </Link>

        <div className="workspace">
          <span className="workspace-label">WORKSPACE</span>
          <div className="workspace-name">
            <span className="workspace-avatar">S</span>
            <span>My workspace</span>
            <ChevronRight size={14} />
          </div>
        </div>

        <p className="nav-heading">WORKSPACE MENU</p>
        <nav className="navigation">
          {modules.map(item => {
            const Icon = item.icon;
            const active = item.href === "/dashboard";
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-item ${active ? "active" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                <Icon size={17} strokeWidth={1.8} />
                <span>{item.name}</span>
                {active && <span className="nav-count">01</span>}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <Sparkles size={17} />
            <strong>Brand clarity, built in.</strong>
            <p>Keep every campaign aligned with what your brand stands for.</p>
          </div>
          <span>THE RED PEN · SOLOARC</span>
        </div>
      </aside>

      <div className="dashboard-main">
        <header className="topbar">
          <div className="breadcrumb">Workspace <ChevronRight size={13} /> <strong>Overview</strong></div>
          <div className="topbar-right">
            <span className="live-indicator"><i /> Workspace data</span>
            <button className="icon-button" onClick={() => void loadDashboard()} disabled={loading} aria-label="Refresh dashboard">
              <RefreshCw size={16} className={loading ? "spin" : ""} />
            </button>
            <div className="profile-avatar">S</div>
          </div>
        </header>

        <main className="page-content">
          <section className="welcome-section">
            <div>
              <p className="eyebrow">TUESDAY, YOUR WORKSPACE AT A GLANCE</p>
              <h1>Good to have you back.</h1>
              <p className="welcome-subtitle">A clear view of your brand governance, campaigns and approvals.</p>
            </div>
            <Link href="/campaigns" className="primary-button">
              <Plus size={16} /> New campaign
            </Link>
          </section>

          {error && (
            <div className="dashboard-error" role="alert">
              <AlertTriangle size={17} />
              <span>{error}</span>
              <button onClick={() => void loadDashboard()}>Try again</button>
            </div>
          )}

          <section className="health-panel">
            <div className="health-copy">
              <p className="eyebrow">YOUR BRAND GOVERNANCE</p>
              <h2>Workspace health</h2>
              <div className="health-number">{loading ? "—" : healthScore}<span>/100</span></div>
              <div className="health-status">
                <ShieldCheck size={14} />
                {loading ? "Updating workspace status" : healthScore >= 85 ? "Your workspace is in good shape" : healthScore >= 60 ? "A few things need your attention" : "Important issues need attention"}
              </div>
              <p>A live indicator based on the severity of currently open findings. Resolve issues to improve your score.</p>
            </div>

            <div className="health-visual">
              <div className="health-ring" style={{ background: `conic-gradient(#47745A 0deg ${healthScore * 3.6}deg, #e9eee9 ${healthScore * 3.6}deg 360deg)` }}>
                <div className="ring-inner">
                  <ShieldCheck size={25} />
                  <strong>{loading ? "—" : `${healthScore}%`}</strong>
                  <span>HEALTH SCORE</span>
                </div>
              </div>
            </div>

            <div className="health-divider" />
            <div className="health-breakdown">
              <div><i className="breakdown-dot red-dot" /> High severity <strong>{loading ? "—" : highFindings}</strong></div>
              <div><i className="breakdown-dot amber-dot" /> Medium severity <strong>{loading ? "—" : mediumFindings}</strong></div>
              <div><i className="breakdown-dot green-dot" /> Resolved findings <strong>{loading ? "—" : resolvedFindings}</strong></div>
            </div>
          </section>

          <section className="stats-grid">
            {stats.map(stat => {
              const Icon = stat.icon;
              return (
                <article className="stat-card" key={stat.label}>
                  <div className="stat-top">
                    <span>{stat.label}</span>
                    <span className={`stat-icon ${stat.tone}-icon`}><Icon size={17} /></span>
                  </div>
                  <div className="stat-value">{loading ? "—" : stat.value}</div>
                  <div className="stat-foot">{stat.detail}</div>
                </article>
              );
            })}
          </section>

          <div className="content-grid">
            <section className="section-card">
              <div className="section-header">
                <div>
                  <p className="eyebrow">NEEDS YOUR ATTENTION</p>
                  <h2>Open findings</h2>
                  <p>Issues detected across your campaigns.</p>
                </div>
                <Link href="/consistency-radar" className="text-button">View radar <ArrowUpRight size={14} /></Link>
              </div>

              {loading ? (
                <div className="dashboard-empty"><Activity size={22} /><span>Loading findings...</span></div>
              ) : latestIssues.length === 0 ? (
                <div className="empty-state">
                  <CheckCircle2 size={27} />
                  <strong>All clear for now</strong>
                  <span>No open findings in your workspace.</span>
                </div>
              ) : (
                <div className="issue-list">
                  {latestIssues.map(finding => {
                    const severity = finding.severity.toLowerCase();
                    const severityClass = severity === "critical" ? "critical" : severity === "high" ? "high" : "medium";
                    return (
                      <article className="issue-item" key={finding.id}>
                        <i className={`issue-marker ${severityClass}`} />
                        <div className="issue-content">
                          <div className="issue-title-row">
                            <strong>{finding.title}</strong>
                            <span className={`severity ${severityClass}`}>{severity}</span>
                          </div>
                          <span className="issue-campaign">{campaignNames.get(finding.campaign_id) || "Workspace finding"}</span>
                        </div>
                        <Link href="/review-desk" className="issue-action" aria-label="Open review desk"><ArrowUpRight size={15} /></Link>
                      </article>
                    );
                  })}
                </div>
              )}
              <Link href="/review-desk" className="activity-link">Go to Review Desk <ArrowRight size={14} /></Link>
            </section>

            <section className="section-card">
              <div className="section-header">
                <div>
                  <p className="eyebrow">WORKSPACE PULSE</p>
                  <h2>Recent activity</h2>
                  <p>Your latest recorded changes.</p>
                </div>
                <Link href="/audit-history" className="text-button">All activity <ArrowUpRight size={14} /></Link>
              </div>
              {loading ? (
                <div className="dashboard-empty"><Activity size={22} /><span>Loading activity...</span></div>
              ) : activities.length === 0 ? (
                <div className="dashboard-empty"><CircleDot size={22} /><span>No activity recorded yet.</span></div>
              ) : (
                <div className="activity-list">
                  {activities.slice(0, 5).map(activity => (
                    <article className="activity-item" key={activity.id}>
                      <div className="activity-icon"><Activity size={15} /></div>
                      <div className="activity-content">
                        <strong>{activity.description || readable(activity.action)}</strong>
                        <span>{readable(activity.entity_type)}</span>
                      </div>
                      <time>{formatDate(activity.created_at)}</time>
                    </article>
                  ))}
                </div>
              )}
              <Link href="/audit-history" className="activity-link">Explore audit history <ArrowRight size={14} /></Link>
            </section>
          </div>

          <section className="section-card campaign-section">
            <div className="section-header">
              <div>
                <p className="eyebrow">YOUR WORK IN PROGRESS</p>
                <h2>Recent campaigns</h2>
                <p>Keep track of the latest campaign activity.</p>
              </div>
              <Link href="/campaigns" className="text-button">Manage campaigns <ArrowUpRight size={14} /></Link>
            </div>

            {loading ? (
              <div className="dashboard-empty">Loading campaigns...</div>
            ) : campaigns.length === 0 ? (
              <div className="campaign-empty">
                <div className="empty-icon"><ClipboardCheck size={22} /></div>
                <strong>Your first campaign starts here.</strong>
                <p>Create a campaign to check its content, review findings and manage approvals.</p>
                <Link href="/campaigns" className="primary-button"><Plus size={15} /> Create campaign</Link>
              </div>
            ) : (
              <div className="campaign-table-wrap">
                <table className="campaign-table">
                  <thead><tr><th>CAMPAIGN</th><th>CHANNEL</th><th>STATUS</th><th>CREATED</th><th /></tr></thead>
                  <tbody>
                    {campaigns.slice(0, 5).map(campaign => (
                      <tr key={campaign.id}>
                        <td><strong>{campaign.name}</strong></td>
                        <td>{campaign.channel || "Not specified"}</td>
                        <td><span className={`campaign-status ${statusStyle(campaign.status)}`}>{readable(campaign.status)}</span></td>
                        <td>{formatDate(campaign.created_at)}</td>
                        <td><Link href="/campaigns" aria-label={`Manage ${campaign.name}`}><ChevronRight size={16} /></Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="section-card campaign-section">
            <div className="section-header">
              <div>
                <p className="eyebrow">HUMAN OVERSIGHT</p>
                <h2>Recent review decisions</h2>
                <p>The latest decisions recorded by your reviewers.</p>
              </div>
              <Link href="/review-desk" className="text-button">Open review desk <ArrowUpRight size={14} /></Link>
            </div>

            {loading ? (
              <div className="dashboard-empty">Loading review decisions...</div>
            ) : reviews.length === 0 ? (
              <div className="dashboard-empty">
                <ShieldCheck size={22} />
                <span>No review decisions recorded yet.</span>
              </div>
            ) : (
              <div className="activity-list">
                {reviews.map(review => (
                  <article className="activity-item" key={review.id}>
                    <div className="activity-icon"><ShieldCheck size={15} /></div>
                    <div className="activity-content">
                      <strong>{readable(review.decision)}</strong>
                      <span>{review.comments || campaignNames.get(review.campaign_id) || "Review decision recorded"}</span>
                    </div>
                    <time>{formatDate(review.created_at)}</time>
                  </article>
                ))}
              </div>
            )}
          </section>

          <div className="bottom-banner">
            <div className="banner-icon"><Sparkles size={19} /></div>
            <div>
              <strong>Keep every message on brand.</strong>
              <p>Start with approved knowledge, check your content and let people make the final call.</p>
            </div>
            <Link href="/content-checker">Check content <ArrowRight size={14} /></Link>
          </div>

          <footer className="footer">
            <span>THE RED PEN · BRAND GOVERNANCE WITH HUMAN OVERSIGHT</span>
            <span>{lastUpdated ? `LAST UPDATED ${lastUpdated}` : "WORKSPACE OVERVIEW"}</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
