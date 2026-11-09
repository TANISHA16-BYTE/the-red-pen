
"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  Activity,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  FileCheck2,
  FileText,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";

// -----------------------------------------------------
// DATE: Safe client-side date without setState in effect
// -----------------------------------------------------

function subscribeToDate() {
  return () => {};
}

function getClientDate() {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    month: "long",
    day: "2-digit",
    year: "numeric",
  }).format(new Date());
}

function getServerDate() {
  return "";
}

// -----------------------------------------------------
// NAVIGATION
// -----------------------------------------------------

const navigation = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Company Brain", icon: BookOpen },
  { label: "Campaigns", icon: FileText },
  { label: "Content Checker", icon: ShieldCheck },
  { label: "Consistency Radar", icon: Activity },
  { label: "Review Desk", icon: FileCheck2 },
];

// -----------------------------------------------------
// TYPES
// -----------------------------------------------------

type DashboardData = {
  organizationName: string;
  rules: number;
  facts: number;
  claims: number;
  assets: number;
};

type DashboardStat = {
  label: string;
  value: number;
  icon: typeof ShieldCheck;
};

// -----------------------------------------------------
// DASHBOARD
// -----------------------------------------------------

export default function Dashboard() {
  const [activePage, setActivePage] = useState("Overview");

  const [data, setData] = useState<DashboardData | null>(null);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  // The server and initial hydration both receive an empty date.
  // The actual browser date is displayed after hydration.
  const today = useSyncExternalStore(
    subscribeToDate,
    getClientDate,
    getServerDate
  );

  // ---------------------------------------------------
  // LOAD WORKSPACE DATA
  // ---------------------------------------------------

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      try {
        const supabase = createClient();

        // 1. Get authenticated user
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError) {
          throw authError;
        }

        if (!user) {
          throw new Error(
            "Your session was not found. Please log in again."
          );
        }

        // 2. Find user's workspace membership
        const {
          data: membership,
          error: membershipError,
        } = await supabase
          .from("org_memberships")
          .select("organization_id")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle();

        if (membershipError) {
          throw membershipError;
        }

        if (!membership) {
          throw new Error(
            "No workspace is linked to this account yet. Workspace setup is the next step."
          );
        }

        const organizationId = membership.organization_id;

        // 3. Fetch workspace and Company Brain records together
        const [
          organizationResult,
          rulesResult,
          factsResult,
          claimsResult,
          assetsResult,
        ] = await Promise.all([
          supabase
            .from("organizations")
            .select("name")
            .eq("id", organizationId)
            .single(),

          supabase
            .from("brand_rules")
            .select("id", {
              count: "exact",
              head: true,
            })
            .eq("organization_id", organizationId),

          supabase
            .from("approved_facts")
            .select("id", {
              count: "exact",
              head: true,
            })
            .eq("organization_id", organizationId),

          supabase
            .from("approved_claims")
            .select("id", {
              count: "exact",
              head: true,
            })
            .eq("organization_id", organizationId),

          supabase
            .from("brand_assets")
            .select("id", {
              count: "exact",
              head: true,
            })
            .eq("organization_id", organizationId),
        ]);

        // 4. Check all database responses
        const results = [
          organizationResult,
          rulesResult,
          factsResult,
          claimsResult,
          assetsResult,
        ];

        const failedResult = results.find(
          (result) => result.error
        );

        if (failedResult?.error) {
          throw failedResult.error;
        }

        if (!organizationResult.data) {
          throw new Error(
            "Workspace organization was not found."
          );
        }

        // Do not update state if component has unmounted
        if (cancelled) {
          return;
        }

        // 5. Save real database values
        setData({
          organizationName: organizationResult.data.name,
          rules: rulesResult.count ?? 0,
          facts: factsResult.count ?? 0,
          claims: claimsResult.count ?? 0,
          assets: assetsResult.count ?? 0,
        });
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Something went wrong while loading your workspace."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadDashboard();

    return () => {
      cancelled = true;
    };
  }, []);

  // ---------------------------------------------------
  // DERIVED DATA
  // ---------------------------------------------------

  const totalRecords = data
    ? data.rules + data.facts + data.claims + data.assets
    : 0;

  const stats: DashboardStat[] = [
    {
      label: "BRAND RULES",
      value: data?.rules ?? 0,
      icon: ShieldCheck,
    },
    {
      label: "APPROVED FACTS",
      value: data?.facts ?? 0,
      icon: BookOpen,
    },
    {
      label: "APPROVED CLAIMS",
      value: data?.claims ?? 0,
      icon: Check,
    },
    {
      label: "BRAND ASSETS",
      value: data?.assets ?? 0,
      icon: FileCheck2,
    },
  ];

  // ---------------------------------------------------
  // NAVIGATION HANDLER
  // ---------------------------------------------------

  function handleNavigation(page: string) {
    setActivePage(page);
  }

  // ---------------------------------------------------
  // UI
  // ---------------------------------------------------

  return (
    <main className="app-shell">

      {/* SIDEBAR */}

      <aside className="sidebar">

        <div className="brand">
          <div className="brand-mark">R.</div>

          <div>
            <div className="brand-name">
              the red pen<span>.</span>
            </div>

            <div className="brand-caption">
              BRAND GOVERNANCE
            </div>
          </div>
        </div>

        {/* WORKSPACE SELECTOR */}

        <div className="workspace">

          <div className="workspace-avatar">
            {data?.organizationName?.charAt(0)?.toUpperCase() ?? "W"}
          </div>

          <div className="workspace-info">
            <strong>
              {loading
                ? "Loading..."
                : data?.organizationName ?? "Workspace"}
            </strong>

            <span>Workspace</span>
          </div>

          <ChevronDown size={15} />

        </div>

        {/* MAIN NAVIGATION */}

        <div className="nav-heading">
          WORKSPACE
        </div>

        <nav className="navigation">

          {navigation.map((item) => {
            const Icon = item.icon;
            const active = activePage === item.label;

            return (
              <button
                key={item.label}
                type="button"
                onClick={() => handleNavigation(item.label)}
                className={`nav-item ${active ? "active" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                <Icon size={18} strokeWidth={1.8} />

                <span>{item.label}</span>
              </button>
            );
          })}

        </nav>

        {/* MANAGEMENT NAVIGATION */}

        <div className="nav-heading tools-heading">
          MANAGE
        </div>

        <button
          type="button"
          className={`nav-item ${
            activePage === "Audit & Activity" ? "active" : ""
          }`}
          onClick={() => handleNavigation("Audit & Activity")}
          aria-current={
            activePage === "Audit & Activity" ? "page" : undefined
          }
        >
          <Clock3 size={18} />
          <span>Audit & Activity</span>
        </button>

        <button
          type="button"
          className={`nav-item ${
            activePage === "Settings" ? "active" : ""
          }`}
          onClick={() => handleNavigation("Settings")}
          aria-current={
            activePage === "Settings" ? "page" : undefined
          }
        >
          <Settings size={18} />
          <span>Settings</span>
        </button>

        {/* SIDEBAR BOTTOM */}

        <div className="sidebar-bottom">

          <div className="help-card">

            <div className="help-icon">
              <Sparkles size={17} />
            </div>

            <strong>
              Keep your brand aligned.
            </strong>

            <p>
              Every claim needs a source. Every approval needs a person.
            </p>

          </div>

          <div className="profile">

            <div className="profile-avatar">
              T
            </div>

            <div className="profile-info">
              <strong>Workspace Member</strong>
              <span>Signed in</span>
            </div>

            <ChevronDown size={15} />

          </div>

        </div>

      </aside>

      {/* MAIN CONTENT */}

      <section className="main-area">

        {/* TOP BAR */}

        <header className="topbar">

          <div className="breadcrumb">
            Workspace
            <ChevronRight size={14} />
            <strong>{activePage}</strong>
          </div>

          <div className="topbar-actions">
            <div className="topbar-avatar">
              T
            </div>
          </div>

        </header>

        {/* PAGE CONTENT */}

        <div className="page-content">

          {activePage === "Overview" ? (

            <>

              {/* WELCOME */}

              <section className="welcome-section">

                <div>

                  <div className="eyebrow">
                    {today.toUpperCase()}
                  </div>

                  <h1>
                    Good afternoon.
                  </h1>

                  <p className="welcome-description">
                    Your brand&apos;s integrity starts with what goes out.
                    Here&apos;s your workspace at a glance.
                  </p>

                </div>

              </section>

              {/* ERROR STATE */}

              {error && (

                <div
                  className="section-card"
                  style={{ marginBottom: 20 }}
                  role="alert"
                >

                  <strong>
                    Workspace connection needs attention
                  </strong>

                  <p>{error}</p>

                </div>

              )}

              {/* COMPANY BRAIN HEALTH PANEL */}

              <section className="health-panel">

                <div className="health-copy">

                  <div className="panel-eyebrow">
                    COMPANY BRAIN
                  </div>

                  <div className="health-number">
                    {loading ? "—" : totalRecords}
                    <span> records</span>
                  </div>

                  <div className="health-status">
                    <Check size={15} />
                    <span>Live database information</span>
                  </div>

                  <p>
                    Your approved brand knowledge, facts, claims and assets
                    available in this workspace.
                  </p>

                </div>

                <div className="health-visual">

                  <div className="health-ring">

                    <div className="ring-inner">

                      <BookOpen size={31} />

                      <strong>
                        {loading ? "—" : totalRecords}
                      </strong>

                      <span>RECORDS</span>

                    </div>

                  </div>

                </div>

                <div className="health-divider" />

                <div className="health-breakdown">

                  <div>
                    <span className="breakdown-dot red-dot" />
                    <span>Brand rules</span>
                    <strong>
                      {loading ? "—" : data?.rules ?? 0}
                    </strong>
                  </div>

                  <div>
                    <span className="breakdown-dot amber-dot" />
                    <span>Approved facts</span>
                    <strong>
                      {loading ? "—" : data?.facts ?? 0}
                    </strong>
                  </div>

                  <div>
                    <span className="breakdown-dot green-dot" />
                    <span>Approved claims</span>
                    <strong>
                      {loading ? "—" : data?.claims ?? 0}
                    </strong>
                  </div>

                </div>

              </section>

              {/* DATABASE STATISTICS */}

              <section className="stats-grid">

                {stats.map((stat) => {

                  const Icon = stat.icon;

                  return (

                    <div
                      className="stat-card"
                      key={stat.label}
                    >

                      <div className="stat-top">

                        <span>{stat.label}</span>

                        <div className="stat-icon">
                          <Icon size={18} />
                        </div>

                      </div>

                      <div className="stat-value">
                        {loading ? "—" : stat.value}
                      </div>

                      <div className="stat-foot">
                        <span className="neutral">
                          {loading
                            ? "Loading records..."
                            : "From Supabase"}
                        </span>
                      </div>

                    </div>

                  );

                })}

              </section>

              {/* CONTENT WORKFLOW AND ACTIVITY */}

              <section className="content-grid">

                <div className="section-card issues-card">

                  <div className="section-header">

                    <div>

                      <div className="section-kicker">
                        CONTENT WORKFLOW
                      </div>

                      <h2>Review queue</h2>

                      <p>
                        Content reviews will appear here.
                      </p>

                    </div>

                  </div>

                  <div className="empty-state">

                    <FileCheck2 size={24} />

                    <strong>
                      Review workflow coming next
                    </strong>

                    <span>
                      Content submission and review records are not connected
                      yet.
                    </span>

                  </div>

                </div>

                <div className="section-card activity-card">

                  <div className="section-header">

                    <div>

                      <div className="section-kicker">
                        WORKSPACE LOG
                      </div>

                      <h2>Recent activity</h2>

                      <p>
                        Workspace activity history.
                      </p>

                    </div>

                  </div>

                  <div className="empty-state">

                    <Clock3 size={24} />

                    <strong>
                      Activity log coming next
                    </strong>

                    <span>
                      No activity table is connected yet.
                    </span>

                  </div>

                </div>

              </section>

              {/* COMPANY BRAIN BANNER */}

              <section className="bottom-banner">

                <div className="banner-icon">
                  <BookOpen size={20} />
                </div>

                <div>

                  <strong>
                    Your Company Brain is the source of truth.
                  </strong>

                  <p>
                    Manage approved facts, brand rules and claims in one place.
                  </p>

                </div>

                <button
                  type="button"
                  onClick={() => handleNavigation("Company Brain")}
                >
                  Explore Company Brain
                  <ChevronRight size={15} />
                </button>

              </section>

              {/* FOOTER */}

              <footer className="footer">

                <span>
                  THE RED PEN © 2026
                </span>

                <span>
                  One source of truth. Every campaign aligned.
                </span>

              </footer>

            </>

          ) : (

            /* OTHER MODULES */

            <section className="placeholder-page">

              <div className="placeholder-icon">
                <BookOpen size={28} />
              </div>

              <div className="eyebrow">
                THE RED PEN WORKSPACE
              </div>

              <h1>
                {activePage}
              </h1>

              <p>
                This module is next in the implementation plan. Your existing
                workspace data remains safe.
              </p>

              <button
                type="button"
                className="primary-button"
                onClick={() => handleNavigation("Overview")}
              >
                Back to Overview
                <ChevronRight size={15} />
              </button>

            </section>

          )}

        </div>

      </section>

    </main>
  );
}
