"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowDownUp,
  ArrowRight,
  BarChart3,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Clock3,
  FileCheck2,
  FileText,
  Filter,
  FolderOpen,
  History,
  LayoutDashboard,
  Lightbulb,
  Menu,
  MoreHorizontal,
  PenLine,
  Plus,
  Radar,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";

type RecordType = "rule" | "fact" | "claim" | "asset";
type RecordStatus = "draft" | "pending" | "approved" | "archived";

type BrainRecord = {
  id: string;
  organization_id: string;
  record_type: RecordType;
  title: string;
  description: string;
  content: string;
  category: string;
  status: RecordStatus;
  source_url: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type FormData = {
  record_type: RecordType;
  title: string;
  description: string;
  content: string;
  category: string;
  status: RecordStatus;
  source_url: string;
};

const emptyForm: FormData = {
  record_type: "fact",
  title: "",
  description: "",
  content: "",
  category: "General",
  status: "draft",
  source_url: "",
};

const sections: { value: "all" | RecordType; label: string }[] = [
  { value: "all", label: "All knowledge" },
  { value: "rule", label: "Brand guidelines" },
  { value: "fact", label: "Verified facts" },
  { value: "claim", label: "Promotional claims" },
  { value: "asset", label: "Brand assets" },
];

const statusOptions: RecordStatus[] = [
  "draft",
  "pending",
  "approved",
  "archived",
];

const navigation = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Company Brain", href: "/", icon: BookOpen },
  { label: "Campaigns", href: "/campaigns", icon: FolderOpen },
  { label: "Content Checker", href: "/content-checker", icon: FileCheck2 },
  { label: "Review Desk", href: "/review-desk", icon: ShieldCheck },
  { label: "Audit History", href: "/audit-history", icon: History },
  { label: "Consistency Radar", href: "/consistency-radar", icon: Radar },
];

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : date.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
}

function typeLabel(type: RecordType) {
  return {
    rule: "Brand guideline",
    fact: "Verified fact",
    claim: "Promotional claim",
    asset: "Brand asset",
  }[type];
}

function statusStyle(status: RecordStatus) {
  switch (status) {
    case "approved":
      return "bg-[#e7f3e8] text-[#34784b]";
    case "pending":
      return "bg-[#fff0dc] text-[#b56a19]";
    case "archived":
      return "bg-[#eeeae7] text-[#77716a]";
    default:
      return "bg-[#eeeaf2] text-[#766287]";
  }
}

function StatusDot({ status }: { status: RecordStatus }) {
  const color = {
    approved: "bg-[#45a568]",
    pending: "bg-[#e99a38]",
    draft: "bg-[#9a9290]",
    archived: "bg-[#aaa29c]",
  }[status];

  return <span className={`h-2 w-2 shrink-0 rounded-full ${color}`} />;
}

function PenLogo({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`rp-brand ${compact ? "rp-brand--compact" : ""}`}>
      <span className="rp-brand__mark" aria-hidden="true">
        <svg viewBox="0 0 44 44" fill="none">
          <rect x="1" y="1" width="42" height="42" rx="13" fill="#F7EAE3" />
          <path d="M13 29.5L15.2 22L27.7 9.5C29 8.2 31.1 8.2 32.4 9.5C33.7 10.8 33.7 12.9 32.4 14.2L19.9 26.7L13 29.5Z" fill="#A34B3D"/>
          <path d="M15.2 22L19.9 26.7" stroke="#FFF9F4" strokeWidth="1.8"/>
          <path d="M12 34H31" stroke="#A34B3D" strokeWidth="2" strokeLinecap="round"/>
          <path d="M25.5 31.5L28 34L33 28.5" stroke="#64836A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </span>
      {!compact && (
        <span className="rp-brand__copy">
          <strong>the red pen<span>.</span></strong>
          <small>BRAND GOVERNANCE</small>
        </span>
      )}
    </div>
  );
}

function PenIllustration() {
  return (
    <div className="relative flex h-44 w-64 items-center justify-center">
      <div className="absolute h-40 w-40 rounded-full border border-[#efd0c4]" />
      <div className="absolute h-32 w-32 rounded-full border border-[#f1d8ce]" />
      <div className="absolute h-24 w-24 rounded-full bg-[#f9e9e2]" />
      <svg viewBox="0 0 180 180" className="relative z-10 h-36 w-36" fill="none" aria-label="Fountain pen nib illustration">
        <path
          d="M89 22 119 78 103 135 90 151 77 135 61 78 89 22Z"
          fill="#A34B3D"
        />
        <path d="m89 22 30 56-16 57-13 16V22Z" fill="#C66D5A" />
        <path d="m89 34 10 43-10 28-10-28 10-43Z" fill="#F8E8DF" />
        <path d="M89 105v38" stroke="#F8E8DF" strokeWidth="3" strokeLinecap="round" />
        <circle cx="89" cy="76" r="6" fill="#FFF8F2" />
        <path
          d="M30 115c27 27 90 29 119-2 7-8 11-17 9-26"
          stroke="#A34B3D"
          strokeWidth="3"
          strokeLinecap="round"
          opacity=".75"
        />
        <path d="m157 87 5-10 5 10-5 10-5-10Z" fill="#C96E5B" />
      </svg>
      <Sparkles className="absolute right-5 top-5 h-5 w-5 text-[#c77d68]" />
      <Sparkles className="absolute bottom-6 left-5 h-4 w-4 text-[#d49b84]" />
    </div>
  );
}

export default function CompanyBrainPage() {
  const router = useRouter();

  const [records, setRecords] = useState<BrainRecord[]>([]);
  const [organizationId, setOrganizationId] = useState("");
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [activeSection, setActiveSection] =
    useState<"all" | RecordType>("all");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const { data: auth, error: authError } =
        await supabase.auth.getUser();

      if (authError) throw authError;

      if (!auth.user) {
        router.push("/login");
        return;
      }

      setUserId(auth.user.id);

      const { data: membership, error: membershipError } =
        await supabase
          .from("org_memberships")
          .select("organization_id")
          .eq("user_id", auth.user.id)
          .limit(1)
          .maybeSingle();

      if (membershipError) throw membershipError;

      if (!membership?.organization_id) {
        setError(
          "No organization membership found. Please complete your workspace setup."
        );
        setRecords([]);
        return;
      }

      const orgId = membership.organization_id;
      setOrganizationId(orgId);

      const { data, error: recordsError } = await supabase
        .from("company_brain_records")
        .select("*")
        .eq("organization_id", orgId)
        .order("updated_at", { ascending: false });

      if (recordsError) throw recordsError;

      setRecords((data ?? []) as BrainRecord[]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load Company Brain."
      );
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadRecords();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadRecords]);

  const logActivity = async (
    action: string,
    entityId: string,
    description: string,
    oldValue: unknown = null,
    newValue: unknown = null
  ) => {
    if (!organizationId) return;

    try {
      await supabase.from("audit_logs").insert({
        organization_id: organizationId,
        actor_id: userId || null,
        action,
        entity_type: "company_brain_record",
        entity_id: entityId,
        description,
        old_value: oldValue,
        new_value: newValue,
      });
    } catch {
      // Audit failure must not undo the primary operation.
    }
  };

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();

    return records.filter((record) => {
      const matchesSection =
        activeSection === "all" ||
        record.record_type === activeSection;

      const matchesStatus =
        statusFilter === "all" ||
        record.status === statusFilter;

      const searchable = [
        record.title,
        record.description,
        record.content,
        record.category,
        record.record_type,
      ]
        .join(" ")
        .toLowerCase();

      return (
        matchesSection &&
        matchesStatus &&
        (!query || searchable.includes(query))
      );
    });
  }, [records, activeSection, statusFilter, search]);

  const counts = useMemo(
    () => ({
      total: records.length,
      rules: records.filter((r) => r.record_type === "rule").length,
      facts: records.filter((r) => r.record_type === "fact").length,
      claims: records.filter((r) => r.record_type === "claim").length,
      assets: records.filter((r) => r.record_type === "asset").length,
      approved: records.filter((r) => r.status === "approved").length,
      pending: records.filter((r) => r.status === "pending").length,
      drafts: records.filter((r) => r.status === "draft").length,
    }),
    [records]
  );

  const health = counts.total
    ? Math.round((counts.approved / counts.total) * 100)
    : 0;

  function openNewRecord(type: RecordType = "fact") {
    setEditingId(null);
    setForm({ ...emptyForm, record_type: type });
    setError("");
    setMessage("");
    setModalOpen(true);
  }

  function openEditRecord(record: BrainRecord) {
    setEditingId(record.id);
    setForm({
      record_type: record.record_type,
      title: record.title,
      description: record.description || "",
      content: record.content || "",
      category: record.category || "General",
      status: record.status,
      source_url: record.source_url || "",
    });
    setError("");
    setMessage("");
    setModalOpen(true);
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!organizationId || !userId) {
      setError("Your workspace session is not ready. Refresh and try again.");
      return;
    }

    if (!form.title.trim()) {
      setError("Please enter a title.");
      return;
    }

    if (!form.content.trim() && form.record_type !== "asset") {
      setError("Please add the actual guideline, fact or claim content.");
      return;
    }

    if (form.source_url.trim()) {
      try {
        const url = new URL(form.source_url.trim());
        if (!["http:", "https:"].includes(url.protocol)) {
          throw new Error("Invalid URL");
        }
      } catch {
        setError("Please enter a valid source URL starting with https:// or http://.");
        return;
      }
    }

    setSaving(true);
    setError("");
    setMessage("");

    const payload = {
      record_type: form.record_type,
      title: form.title.trim(),
      description: form.description.trim(),
      content: form.content.trim(),
      category: form.category.trim() || "General",
      status: form.status,
      source_url: form.source_url.trim() || null,
      updated_at: new Date().toISOString(),
    };

    try {
      if (editingId) {
        const previous = records.find((r) => r.id === editingId);

        const { data, error: updateError } = await supabase
          .from("company_brain_records")
          .update(payload)
          .eq("id", editingId)
          .eq("organization_id", organizationId)
          .select("*")
          .single();

        if (updateError) throw updateError;

        const updated = data as BrainRecord;

        setRecords((current) =>
          current.map((r) => (r.id === editingId ? updated : r))
        );

        await logActivity(
          "record_updated",
          editingId,
          `Updated Company Brain record: ${updated.title}`,
          previous,
          updated
        );

        setMessage("Record updated successfully.");
      } else {
        const { data, error: insertError } = await supabase
          .from("company_brain_records")
          .insert({
            ...payload,
            organization_id: organizationId,
            created_by: userId,
          })
          .select("*")
          .single();

        if (insertError) throw insertError;

        const created = data as BrainRecord;

        setRecords((current) =>
          [created, ...current].sort(
            (a, b) =>
              new Date(b.updated_at).getTime() -
              new Date(a.updated_at).getTime()
          )
        );

        await logActivity(
          "record_created",
          created.id,
          `Created Company Brain record: ${created.title}`,
          null,
          created
        );

        setMessage("Record created successfully.");
      }

      setModalOpen(false);
      setEditingId(null);
      setForm(emptyForm);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to save this record."
      );
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(
    record: BrainRecord,
    nextStatus: RecordStatus
  ) {
    if (record.status === nextStatus) return;

    setError("");
    setMessage("");

    const { data, error: updateError } = await supabase
      .from("company_brain_records")
      .update({
        status: nextStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", record.id)
      .eq("organization_id", organizationId)
      .select("*")
      .single();

    if (updateError) {
      setError(updateError.message);
      return;
    }

    const updated = data as BrainRecord;

    setRecords((current) =>
      current.map((r) => (r.id === record.id ? updated : r))
    );

    await logActivity(
      "record_status_changed",
      record.id,
      `Changed "${record.title}" status from ${record.status} to ${nextStatus}.`,
      { status: record.status },
      { status: nextStatus }
    );

    setMessage(`Status changed to ${nextStatus}.`);
  }

  async function deleteRecord(record: BrainRecord) {
    const confirmed = window.confirm(
      `Delete "${record.title}" permanently? This cannot be undone.`
    );

    if (!confirmed) return;

    setError("");
    setMessage("");

    const { error: deleteError } = await supabase
      .from("company_brain_records")
      .delete()
      .eq("id", record.id)
      .eq("organization_id", organizationId);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setRecords((current) =>
      current.filter((r) => r.id !== record.id)
    );

    await logActivity(
      "record_deleted",
      record.id,
      `Deleted Company Brain record: ${record.title}`,
      record,
      null
    );

    setMessage("Record deleted successfully.");
  }

  const closeModal = () => {
    if (!saving) {
      setModalOpen(false);
      setEditingId(null);
    }
  };

  return (
    <main className="min-h-screen bg-[#F7F5F0] text-[#282624]">
      <div className="min-h-screen lg:flex">
        {/* SIDEBAR */}
        <aside className="relative z-20 hidden w-[260px] shrink-0 flex-col border-r border-[#E8DED2] bg-[#FFFEFC] px-5 py-7 lg:sticky lg:top-0 lg:flex lg:h-screen">
          <Link href="/" className="mb-8 px-2">
            <PenLogo />
          </Link>

          <div className="mb-7 flex items-center gap-3 rounded-xl border border-[#E8DED2] bg-[#FCF9F5] p-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#F5E2DA] text-sm font-bold text-[#8C4439]">
              RP
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">Your workspace</p>
              <p className="text-xs text-[#8B8179]">Organization</p>
            </div>
            <ChevronDown className="h-4 w-4 text-[#8B8179]" />
          </div>

          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[.16em] text-[#A49A91]">
            Workspace
          </p>

          <nav className="space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              const active = item.href === "/";

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group flex min-h-11 items-center gap-3 rounded-xl px-3 text-[13px] font-medium transition ${
                    active
                      ? "bg-[#F8E8E3] text-[#A34B3D] shadow-sm"
                      : "text-[#6F665F] hover:bg-[#F7F3EE] hover:text-[#302B27]"
                  }`}
                >
                  <Icon className="h-[18px] w-[18px]" />
                  {item.label}
                  {active && (
                    <span className="ml-auto h-2 w-2 rounded-full bg-[#A34B3D]" />
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="mt-8">
            <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[.16em] text-[#A49A91]">
              Preferences
            </p>
            <Link
              href="/dashboard"
              className="flex min-h-10 items-center gap-3 rounded-xl px-3 text-[13px] text-[#6F665F] hover:bg-[#F7F3EE]"
            >
              <Settings className="h-[17px] w-[17px]" />
              Workspace settings
            </Link>
            <Link
              href="/audit-history"
              className="flex min-h-10 items-center gap-3 rounded-xl px-3 text-[13px] text-[#6F665F] hover:bg-[#F7F3EE]"
            >
              <CircleHelp className="h-[17px] w-[17px]" />
              Help & activity
            </Link>
          </div>

          <div className="mt-auto">
            <div className="rounded-2xl border border-[#F0DCD3] bg-gradient-to-br from-[#FBEEE8] to-[#F8E5DC] p-4">
              <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-white/70 text-[#A34B3D]">
                <Lightbulb className="h-5 w-5" />
              </div>
              <p className="text-sm font-semibold text-[#5E3029]">
                Keep your brand consistent.
              </p>
              <p className="mt-1 text-xs leading-5 text-[#896C62]">
                Review knowledge records regularly to keep your team aligned.
              </p>
              <Link
                href="/review-desk"
                className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#A34B3D] hover:underline"
              >
                Open Review Desk <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            <div className="mt-5 flex items-center gap-3 border-t border-[#EDE6DE] pt-5">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-[#F3DED5] text-sm font-bold text-[#8B493D]">
                TJ
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">Workspace admin</p>
                <p className="text-xs text-[#92877F]">Administrator</p>
              </div>
              <ChevronDown className="h-4 w-4 text-[#92877F]" />
            </div>
          </div>
        </aside>

        {/* MOBILE NAV */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 bg-[#282624]/35 lg:hidden">
            <div className="h-full w-[285px] bg-[#FFFEFC] p-5 shadow-2xl">
              <div className="mb-8 flex items-center justify-between">
                <PenLogo />
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Close navigation"
                  className="rounded-lg p-2 hover:bg-[#F5EEE8]"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <nav className="space-y-1">
                {navigation.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm ${
                        item.href === "/"
                          ? "bg-[#F8E8E3] font-semibold text-[#A34B3D]"
                          : "text-[#6F665F] hover:bg-[#F7F3EE]"
                      }`}
                    >
                      <Icon className="h-[18px] w-[18px]" />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>
          </div>
        )}

        {/* MAIN AREA */}
        <div className="min-w-0 flex-1">
          {/* TOPBAR */}
          <header className="sticky top-0 z-10 flex h-[72px] items-center justify-between border-b border-[#E8DED2] bg-[#FFFEFC]/95 px-5 backdrop-blur-xl sm:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button
                className="rounded-lg p-2 text-[#655B53] hover:bg-[#F5EEE8] lg:hidden"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Open navigation"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="hidden items-center gap-2 text-xs text-[#948980] sm:flex">
                <span>Workspace</span>
                <span>/</span>
                <span className="font-semibold text-[#6D5148]">
                  Company Brain
                </span>
              </div>
              <div className="relative w-full sm:hidden">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A49A91]" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search records..."
                  className="w-full rounded-xl border border-[#E8DED2] bg-[#FAF7F2] py-2 pl-9 pr-3 text-xs outline-none focus:border-[#A34B3D]"
                />
              </div>
            </div>

            <div className="hidden w-full max-w-[390px] sm:block">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-[#8E8178]" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search in Company Brain..."
                  className="w-full rounded-xl border border-[#E8DED2] bg-[#FAF7F2] py-2.5 pl-11 pr-4 text-[13px] outline-none transition focus:border-[#A34B3D] focus:bg-white"
                />
              </div>
            </div>

            <div className="ml-3 flex shrink-0 items-center gap-3">
              <button
                onClick={() => setMessage("You're all caught up.")}
                aria-label="Notifications"
                className="relative rounded-full p-2 text-[#71645D] hover:bg-[#F5EEE8]"
              >
                <Activity className="h-5 w-5" />
                {counts.pending > 0 && (
                  <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[#B54C3D] ring-2 ring-white" />
                )}
              </button>
              <div className="grid h-9 w-9 place-items-center rounded-full bg-[#F1DFD7] text-xs font-bold text-[#82483D]">
                TJ
              </div>
            </div>
          </header>

          <div className="mx-auto max-w-[1500px] px-5 pb-10 sm:px-8">
            {/* HERO */}
            <section className="relative mt-7 overflow-hidden rounded-[22px] border border-[#F0DDD3] bg-gradient-to-r from-[#FFF9F4] via-[#FBEFE8] to-[#F8E8E0] px-6 py-7 sm:px-8 lg:px-9">
              <div className="pointer-events-none absolute -right-10 -top-24 h-64 w-64 rounded-full border border-[#F0D4C8]/70" />
              <div className="pointer-events-none absolute right-16 top-0 h-48 w-48 rounded-full border border-[#F0D4C8]/60" />

              <div className="relative z-[1] flex flex-wrap items-center justify-between gap-4">
                <div className="max-w-[680px]">
                  <p className="text-[11px] font-bold uppercase tracking-[.19em] text-[#A34B3D]">
                    Company Brain
                  </p>
                  <h1 className="mt-3 font-serif text-4xl font-semibold leading-[1.12] tracking-[-.045em] text-[#292320] sm:text-5xl">
                    Your Company Brain
                  </h1>
                  <p className="mt-3 max-w-xl text-sm leading-6 text-[#80675D] sm:text-base">
                    Centralized knowledge for consistent, on-brand and
                    compliant content.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="hidden md:block">
                    <PenIllustration />
                  </div>
                  <button
                    onClick={() => openNewRecord()}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#A34B3D] px-5 py-3.5 text-sm font-semibold text-white shadow-[0_5px_15px_rgba(163,75,61,.17)] transition hover:-translate-y-0.5 hover:bg-[#873C32]"
                  >
                    <Plus className="h-4 w-4" />
                    Add Record
                  </button>
                </div>
              </div>
            </section>

            {/* ALERTS */}
            {error && (
              <div className="mt-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                <CircleHelp className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
                <button
                  onClick={() => setError("")}
                  className="ml-auto"
                  aria-label="Dismiss error"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {message && (
              <div className="mt-5 flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{message}</span>
                <button
                  onClick={() => setMessage("")}
                  className="ml-auto"
                  aria-label="Dismiss message"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* STAT CARDS */}
            <section className="mt-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
              {[
                {
                  label: "Total Records",
                  value: counts.total,
                  icon: BookOpen,
                  tone: "bg-[#FBE7E5] text-[#B54B43]",
                  note: "Across all knowledge",
                },
                {
                  label: "Approved",
                  value: counts.approved,
                  icon: CheckCircle2,
                  tone: "bg-[#E6F2E6] text-[#42875B]",
                  note: "Ready to use",
                },
                {
                  label: "Pending Review",
                  value: counts.pending,
                  icon: Clock3,
                  tone: "bg-[#FFF0DC] text-[#C17B28]",
                  note: "Awaiting approval",
                },
                {
                  label: "Drafts",
                  value: counts.drafts,
                  icon: FileText,
                  tone: "bg-[#F0EAF4] text-[#80658C]",
                  note: "Still being prepared",
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-[#EDE3D9] bg-[#FFFEFC] p-4 shadow-[0_2px_12px_rgba(48,37,28,.025)] sm:p-5"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${item.tone}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-[#8C8178]">{item.label}</p>
                        <p className="mt-0.5 text-2xl font-semibold tracking-tight text-[#302823]">
                          {loading ? "—" : item.value}
                        </p>
                      </div>
                    </div>
                    <p className="mt-3 text-[11px] text-[#9A8E85]">
                      {item.note}
                    </p>
                  </div>
                );
              })}
            </section>

            {/* HEALTH AND TIP */}
            <section className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_310px]">
              <div className="rounded-2xl border border-[#EDE3D9] bg-[#FFFEFC] p-5 shadow-[0_2px_12px_rgba(48,37,28,.025)] sm:p-6">
                <div className="grid items-center gap-6 md:grid-cols-[1fr_170px_1fr]">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-semibold text-[#38312C]">
                        Knowledge Health
                      </h2>
                      <span title="Approved records divided by total records">
                        <CircleHelp className="h-3.5 w-3.5 text-[#A79A90]" />
                      </span>
                    </div>
                    <div className="mt-3 flex items-center gap-3">
                      <span className="font-serif text-5xl tracking-tight text-[#292320]">
                        {loading ? "—" : `${health}%`}
                      </span>
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                        health >= 80
                          ? "bg-[#E7F3E8] text-[#3D7C4F]"
                          : health >= 50
                            ? "bg-[#FFF0DC] text-[#A96B24]"
                            : "bg-[#F8E9E5] text-[#A34B3D]"
                      }`}>
                        {health >= 80 ? "Strong" : health >= 50 ? "Growing" : "Needs review"}
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-[#887D74]">
                      {counts.total
                        ? `${counts.approved} of ${counts.total} records are approved and ready for use.`
                        : "Add and approve knowledge records to build your knowledge health."}
                    </p>
                  </div>

                  <div className="flex justify-center">
                    <div className="relative h-32 w-32">
                      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
                        <circle
                          cx="60"
                          cy="60"
                          r="49"
                          stroke="#EDEBE5"
                          strokeWidth="10"
                          fill="none"
                        />
                        <circle
                          cx="60"
                          cy="60"
                          r="49"
                          stroke="#48A66A"
                          strokeWidth="10"
                          strokeLinecap="round"
                          fill="none"
                          strokeDasharray={`${(health / 100) * 307.88} 307.88`}
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Check className="h-9 w-9 text-[#48A66A]" strokeWidth={3} />
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-[#EAE2D9] pt-4 md:border-l md:border-t-0 md:pl-6 md:pt-0">
                    <p className="mb-4 text-sm font-semibold">Status breakdown</p>
                    {[
                      { label: "Approved", count: counts.approved, color: "bg-[#48A66A]" },
                      { label: "Pending", count: counts.pending, color: "bg-[#E99B38]" },
                      { label: "Drafts", count: counts.drafts, color: "bg-[#A29A96]" },
                    ].map((item) => (
                      <div key={item.label} className="mb-3 flex items-center justify-between gap-3 text-xs">
                        <span className="flex items-center gap-2 text-[#81766E]">
                          <span className={`h-2.5 w-2.5 rounded-full ${item.color}`} />
                          {item.label}
                        </span>
                        <span className="font-semibold text-[#3B342E]">
                          {loading ? "—" : item.count}
                          <span className="ml-1 font-normal text-[#9B9189]">
                            ({counts.total ? Math.round((item.count / counts.total) * 100) : 0}%)
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-col justify-between rounded-2xl border border-[#F0DDD3] bg-gradient-to-br from-[#FCECE5] to-[#F9E5DD] p-5">
                <div>
                  <div className="flex items-center gap-2 text-[#81483C]">
                    <Lightbulb className="h-5 w-5" />
                    <h3 className="text-sm font-semibold">A little reminder</h3>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[#80665C]">
                    Keep your company knowledge up to date. Approved facts
                    and guidelines help your team review content consistently.
                  </p>
                </div>
                <Link
                  href="/review-desk"
                  className="mt-5 inline-flex w-fit items-center gap-2 rounded-full bg-white/70 px-4 py-2 text-xs font-semibold text-[#974B3D] transition hover:bg-white"
                >
                  Review pending records <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </section>

            {/* RECORDS AND QUICK ACTIONS */}
            <section className="mt-5 grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_310px]">
              <div className="min-w-0 rounded-2xl border border-[#EDE3D9] bg-[#FFFEFC] p-4 shadow-[0_2px_12px_rgba(48,37,28,.025)] sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-serif text-2xl font-semibold tracking-tight text-[#302823]">
                      Knowledge Records
                    </h2>
                    <p className="mt-1 text-xs text-[#8D8178]">
                      Manage and organize your company knowledge
                    </p>
                  </div>
                  <button
                    onClick={() => void loadRecords()}
                    disabled={loading}
                    className="inline-flex items-center gap-2 rounded-xl border border-[#E8DED2] px-3 py-2 text-xs font-medium text-[#6E6259] hover:bg-[#F8F3ED] disabled:opacity-50"
                  >
                    <ArrowDownUp className="h-3.5 w-3.5" />
                    {loading ? "Refreshing" : "Refresh"}
                  </button>
                </div>

                {/* FILTERS */}
                <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                  <div className="relative min-w-0 flex-1">
                    <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A1978F]" />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search knowledge records..."
                      className="w-full rounded-xl border border-[#E8DED2] bg-[#FCFAF7] py-2.5 pl-10 pr-3 text-xs outline-none focus:border-[#A34B3D]"
                    />
                  </div>
                  <div className="relative sm:w-[170px]">
                    <Filter className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#968A80]" />
                    <select
                      value={activeSection}
                      onChange={(e) =>
                        setActiveSection(e.target.value as "all" | RecordType)
                      }
                      className="w-full appearance-none rounded-xl border border-[#E8DED2] bg-[#FCFAF7] py-2.5 pl-9 pr-8 text-xs outline-none focus:border-[#A34B3D]"
                    >
                      {sections.map((section) => (
                        <option key={section.value} value={section.value}>
                          {section.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#968A80]" />
                  </div>
                  <div className="relative sm:w-[150px]">
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="w-full appearance-none rounded-xl border border-[#E8DED2] bg-[#FCFAF7] px-3 py-2.5 pr-8 text-xs outline-none focus:border-[#A34B3D]"
                    >
                      <option value="all">All statuses</option>
                      {statusOptions.map((status) => (
                        <option key={status} value={status}>
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#968A80]" />
                  </div>
                </div>

                {/* CATEGORY CHIPS */}
                <div className="mt-4 flex flex-wrap gap-2">
                  {sections.map((section) => (
                    <button
                      key={section.value}
                      onClick={() => setActiveSection(section.value)}
                      className={`rounded-full px-3 py-1.5 text-[11px] font-medium transition ${
                        activeSection === section.value
                          ? "bg-[#A34B3D] text-white"
                          : "bg-[#F5F0E9] text-[#766B62] hover:bg-[#EEE5DC]"
                      }`}
                    >
                      {section.label}
                    </button>
                  ))}
                </div>

                <div className="mt-4 overflow-hidden rounded-xl border border-[#EEE7DF]">
                  <div className="hidden grid-cols-[minmax(0,1.7fr)_minmax(110px,.8fr)_minmax(100px,.8fr)_minmax(100px,.8fr)_70px] gap-3 bg-[#F8F3ED] px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-[#887C72] md:grid">
                    <span>Title</span>
                    <span>Type</span>
                    <span>Status</span>
                    <span>Last updated</span>
                    <span className="text-right">Actions</span>
                  </div>

                  {loading ? (
                    <div className="px-5 py-14 text-center text-sm text-[#8B8178]">
                      Loading your organization&apos;s knowledge...
                    </div>
                  ) : filteredRecords.length === 0 ? (
                    <div className="px-5 py-14 text-center">
                      <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#F7EEE8] text-[#A34B3D]">
                        <BookOpen className="h-6 w-6" />
                      </div>
                      <h3 className="mt-4 text-base font-semibold">
                        No matching knowledge records
                      </h3>
                      <p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-[#8D8178]">
                        Add your first guideline, verified fact, promotional
                        claim or official asset to build your source of truth.
                      </p>
                      <button
                        onClick={() => openNewRecord()}
                        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#A34B3D] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#873C32]"
                      >
                        <Plus className="h-4 w-4" />
                        Add first record
                      </button>
                    </div>
                  ) : (
                    filteredRecords.map((record) => (
                      <article
                        key={record.id}
                        className="grid gap-3 border-t border-[#F0EAE3] px-4 py-4 transition hover:bg-[#FFFCF8] md:grid-cols-[minmax(0,1.7fr)_minmax(110px,.8fr)_minmax(100px,.8fr)_minmax(100px,.8fr)_70px] md:items-center"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 shrink-0 text-[#A34B3D]" />
                            <h3 className="truncate text-[13px] font-semibold text-[#39312B]">
                              {record.title}
                            </h3>
                          </div>
                          {record.description && (
                            <p className="mt-1 line-clamp-2 pl-6 text-[11px] leading-5 text-[#92877F]">
                              {record.description}
                            </p>
                          )}
                          <p className="mt-1 pl-6 text-[10px] text-[#A59A91]">
                            {record.category || "General"}
                          </p>
                          <div className="mt-2 flex gap-2 md:hidden">
                            <span className="rounded-full bg-[#F3EEE7] px-2.5 py-1 text-[10px] text-[#79695D]">
                              {typeLabel(record.record_type)}
                            </span>
                            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold capitalize ${statusStyle(record.status)}`}>
                              <StatusDot status={record.status} />
                              {record.status}
                            </span>
                            <select
                              value={record.status}
                              onChange={(e) =>
                                void changeStatus(record, e.target.value as RecordStatus)
                              }
                              aria-label={`Change status for ${record.title}`}
                              className="mt-2 w-full rounded-lg border border-[#E8DED2] bg-white px-2.5 py-2 text-[11px] font-semibold capitalize text-[#71564C] outline-none focus:border-[#A34B3D]"
                            >
                              {statusOptions.map((status) => (
                                <option key={status} value={status}>
                                  Change to: {status}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="hidden md:block">
                          <span className="rounded-full bg-[#F3EEE7] px-2.5 py-1.5 text-[10px] font-medium text-[#79695D]">
                            {typeLabel(record.record_type)}
                          </span>
                        </div>

                        <div className="hidden md:block">
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[10px] font-semibold capitalize ${statusStyle(record.status)}`}>
                            <StatusDot status={record.status} />
                            {record.status}
                          </span>
                            <select
                              value={record.status}
                              onChange={(e) =>
                                void changeStatus(record, e.target.value as RecordStatus)
                              }
                              aria-label={`Change status for ${record.title}`}
                              className="mt-2 w-full rounded-lg border border-[#E8DED2] bg-white px-2.5 py-2 text-[11px] font-semibold capitalize text-[#71564C] outline-none focus:border-[#A34B3D]"
                            >
                              {statusOptions.map((status) => (
                                <option key={status} value={status}>
                                  Change to: {status}
                                </option>
                              ))}
                            </select>
                        </div>

                        <div className="text-[11px] text-[#8D8178]">
                          <span className="md:hidden">Updated </span>
                          {formatDate(record.updated_at)}
                        </div>

                        <div className="flex items-center justify-start gap-1 md:justify-end">
                          <button
                            onClick={() => openEditRecord(record)}
                            title="Edit record"
                            aria-label={`Edit ${record.title}`}
                            className="rounded-lg p-2 text-[#83776E] hover:bg-[#F5EAE3] hover:text-[#A34B3D]"
                          >
                            <PenLine className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => void deleteRecord(record)}
                            title="Delete record"
                            aria-label={`Delete ${record.title}`}
                            className="rounded-lg p-2 text-[#9A817A] hover:bg-red-50 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => openEditRecord(record)}
                            title="More options"
                            aria-label={`More options for ${record.title}`}
                            className="rounded-lg p-2 text-[#83776E] hover:bg-[#F5EAE3]"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </div>
                      </article>
                    ))
                  )}
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#958980]">
                  <span>
                    Showing {filteredRecords.length} of {records.length} records
                  </span>
                  <button
                    onClick={() => {
                      setSearch("");
                      setStatusFilter("all");
                      setActiveSection("all");
                    }}
                    className="font-semibold text-[#A34B3D] hover:underline"
                  >
                    Clear all filters
                  </button>
                </div>
              </div>

              {/* QUICK ACTIONS */}
              <aside className="rounded-2xl border border-[#EDE3D9] bg-[#FFFEFC] p-5 shadow-[0_2px_12px_rgba(48,37,28,.025)]">
                <h2 className="font-serif text-xl font-semibold text-[#302823]">
                  Quick Actions
                </h2>
                <p className="mt-1 text-xs text-[#93877E]">
                  Keep your brand knowledge organized.
                </p>

                <div className="mt-5 space-y-2.5">
                  <button
                    onClick={() => openNewRecord()}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#A34B3D] px-4 py-3 text-xs font-semibold text-white shadow-sm transition hover:bg-[#873C32]"
                  >
                    <Plus className="h-4 w-4" />
                    Add Record
                  </button>

                  <button
                    onClick={() => {
                      setActiveSection("all");
                      setStatusFilter("all");
                      setSearch("");
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#E5D5CA] bg-[#FFFEFC] px-4 py-3 text-xs font-semibold text-[#71564C] transition hover:bg-[#FAF4EE]"
                  >
                    <BookOpen className="h-4 w-4" />
                    Browse All Records
                  </button>

                  <Link
                    href="/dashboard"
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#E5D5CA] bg-[#FFFEFC] px-4 py-3 text-xs font-semibold text-[#71564C] transition hover:bg-[#FAF4EE]"
                  >
                    <BarChart3 className="h-4 w-4" />
                    View Dashboard
                  </Link>

                  <Link
                    href="/consistency-radar"
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#E5D5CA] bg-[#FFFEFC] px-4 py-3 text-xs font-semibold text-[#71564C] transition hover:bg-[#FAF4EE]"
                  >
                    <Radar className="h-4 w-4" />
                    Check Consistency
                  </Link>
                </div>

                <div className="mt-6 rounded-xl bg-[#F8F3ED] p-4">
                  <div className="flex items-center gap-2 text-[#8C4D40]">
                    <Sparkles className="h-4 w-4" />
                    <p className="text-xs font-semibold">Knowledge tip</p>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-[#81756C]">
                    Only mark information as approved when it has been
                    verified and is ready for your content review workflow.
                  </p>
                </div>
              </aside>
            </section>

            <footer className="mt-9 flex flex-wrap items-center justify-between gap-3 border-t border-[#E8DED2] py-5 text-[11px] text-[#A0958B]">
              <span className="flex items-center gap-2">
                <PenLogo compact />
                The Red Pen · Review. Refine. Grow.
              </span>
              <span>One trusted source of brand knowledge.</span>
            </footer>
          </div>
        </div>
      </div>

      {/* ADD / EDIT MODAL */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-[#29221F]/45 p-4 backdrop-blur-[3px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) {
              closeModal();
            }
          }}
        >
          <div className="my-auto w-full max-w-2xl overflow-hidden rounded-2xl border border-[#E8DED2] bg-[#FFFEFC] shadow-[0_25px_90px_rgba(35,25,20,.22)]">
            <div className="flex items-start justify-between gap-4 border-b border-[#EEE7DF] bg-[#FCF7F1] px-6 py-5 sm:px-7">
              <div className="flex items-center gap-3">
                <PenLogo compact />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#A34B3D]">
                    Company Brain
                  </p>
                  <h2 className="mt-1 text-xl font-semibold text-[#302823]">
                    {editingId ? "Edit knowledge record" : "Add a new record"}
                  </h2>
                  <p className="mt-1 text-xs text-[#8D8178]">
                    Add reliable information to your brand knowledge base.
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={closeModal}
                aria-label="Close dialog"
                className="rounded-lg p-2 text-[#857970] hover:bg-[#F0E7DE] disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 px-6 py-6 sm:px-7">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-semibold text-[#51463E]">
                    Record type *
                  </span>
                  <select
                    value={form.record_type}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        record_type: event.target.value as RecordType,
                      })
                    }
                    className="mt-2 w-full rounded-xl border border-[#E5DCD2] bg-white px-3 py-3 text-sm outline-none focus:border-[#A34B3D]"
                  >
                    <option value="rule">Brand guideline</option>
                    <option value="fact">Verified fact</option>
                    <option value="claim">Promotional claim</option>
                    <option value="asset">Brand asset</option>
                  </select>
                </label>

                <label className="block">
                  <span className="text-xs font-semibold text-[#51463E]">
                    Status *
                  </span>
                  <select
                    value={form.status}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        status: event.target.value as RecordStatus,
                      })
                    }
                    className="mt-2 w-full rounded-xl border border-[#E5DCD2] bg-white px-3 py-3 text-sm outline-none focus:border-[#A34B3D]"
                  >
                    {statusOptions.map((status) => (
                      <option key={status} value={status}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block">
                <span className="text-xs font-semibold text-[#51463E]">
                  Title *
                </span>
                <input
                  required
                  value={form.title}
                  onChange={(event) =>
                    setForm({ ...form, title: event.target.value })
                  }
                  placeholder="e.g. Official brand voice"
                  className="mt-2 w-full rounded-xl border border-[#E5DCD2] bg-white px-3 py-3 text-sm outline-none focus:border-[#A34B3D]"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-semibold text-[#51463E]">
                    Category
                  </span>
                  <input
                    value={form.category}
                    onChange={(event) =>
                      setForm({ ...form, category: event.target.value })
                    }
                    placeholder="e.g. Tone of voice"
                    className="mt-2 w-full rounded-xl border border-[#E5DCD2] bg-white px-3 py-3 text-sm outline-none focus:border-[#A34B3D]"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-semibold text-[#51463E]">
                    Source URL
                  </span>
                  <input
                    type="url"
                    value={form.source_url}
                    onChange={(event) =>
                      setForm({ ...form, source_url: event.target.value })
                    }
                    placeholder="https://..."
                    className="mt-2 w-full rounded-xl border border-[#E5DCD2] bg-white px-3 py-3 text-sm outline-none focus:border-[#A34B3D]"
                  />
                </label>
              </div>

              <label className="block">
                <span className="text-xs font-semibold text-[#51463E]">
                  Short description
                </span>
                <input
                  value={form.description}
                  onChange={(event) =>
                    setForm({ ...form, description: event.target.value })
                  }
                  placeholder="Explain what this record is used for."
                  className="mt-2 w-full rounded-xl border border-[#E5DCD2] bg-white px-3 py-3 text-sm outline-none focus:border-[#A34B3D]"
                />
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-[#51463E]">
                  Actual knowledge / approved wording
                  {form.record_type !== "asset" ? " *" : ""}
                </span>
                <textarea
                  rows={5}
                  value={form.content}
                  onChange={(event) =>
                    setForm({ ...form, content: event.target.value })
                  }
                  placeholder="Enter the verified fact, brand rule, approved claim or asset details..."
                  className="mt-2 w-full resize-y rounded-xl border border-[#E5DCD2] bg-white px-3 py-3 text-sm leading-6 outline-none focus:border-[#A34B3D]"
                />
              </label>

              {error && (
                <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-800">
                  {error}
                </p>
              )}

              <div className="flex flex-wrap justify-end gap-3 border-t border-[#EEE7DF] pt-5">
                <button
                  type="button"
                  disabled={saving}
                  onClick={closeModal}
                  className="rounded-xl border border-[#E2D8CE] px-5 py-3 text-xs font-semibold text-[#71655D] hover:bg-[#F8F4EF] disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#A34B3D] px-5 py-3 text-xs font-semibold text-white shadow-sm hover:bg-[#873C32] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      {editingId ? "Save changes" : "Create record"}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
