"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { ManagedAccount, ManagedVilla, ManagementData } from "@/lib/management/types";
import "./management-panel.css";

export interface ManagementPanelProps {
  projects: { id: string; name: string }[];
  villas: { id: string; code: string; projectId: string }[];
  initialData?: ManagementData;
}

function dateLabel(value: string | null) {
  return value ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(value)) : "Not recorded yet";
}

function deliveryLabel(account: ManagedAccount) {
  if (!account.invitation) return "No invitation recorded";
  const labels = { queued: "Email queued", sending: "Sending email", sent: "Email sent", failed: "Delivery failed", unknown: "Delivery not confirmed" };
  return labels[account.invitation.state];
}

export function ManagementPanel({ projects, villas, initialData }: ManagementPanelProps) {
  const router = useRouter();
  const [data, setData] = useState<ManagementData | null>(initialData ?? null);
  const [loading, setLoading] = useState(!initialData);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [tab, setTab] = useState<"accounts" | "residences">("accounts");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteAccount, setInviteAccount] = useState<ManagedAccount | null>(null);
  const [role, setRole] = useState<"buyer" | "pm">("buyer");
  const [editingVilla, setEditingVilla] = useState<ManagedVilla | "new" | null>(null);
  const requests = useRef(new Map<string, { fingerprint: string; requestId: string }>());
  const requestBusy = useRef(false);
  const [search, setSearch] = useState("");

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const response = await fetch("/api/management", { cache: "no-store", signal });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || "Management information could not be loaded.");
      setData(result.data);
    } catch (cause) {
      if (signal?.aborted) return;
      setError(cause instanceof Error ? cause.message : "Management information could not be loaded.");
    } finally { if (!signal?.aborted) setLoading(false); }
  }, []);

  useEffect(() => {
    if (initialData) return;
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [initialData, load]);

  async function save(path: string, body: Record<string, unknown>, action: string) {
    if (requestBusy.current) return false;
    requestBusy.current = true;
    setBusy(action); setError(""); setNotice("");
    const fingerprint = JSON.stringify(body);
    let receipt = requests.current.get(path);
    if (!receipt || receipt.fingerprint !== fingerprint) {
      receipt = { fingerprint, requestId: crypto.randomUUID() };
      requests.current.set(path, receipt);
    }
    try {
      const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, requestId: receipt.requestId }) });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || "The save could not be confirmed. Refresh before trying again.");
      requests.current.delete(path);
      setNotice(result.result?.message || "Saved.");
      await load();
      router.refresh();
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The save could not be confirmed. Refresh before trying again.");
      return false;
    } finally { setBusy(null); requestBusy.current = false; }
  }

  async function submitInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const success = await save("/api/management/invitations", {
      email: form.get("email"), name: form.get("name"), role,
      villaIds: role === "buyer" ? form.getAll("villaIds") : [],
      projectIds: role === "pm" ? form.getAll("projectIds") : [],
      allowSharedVilla: form.get("allowSharedVilla") === "on",
    }, "invite");
    if (success) { setInviteOpen(false); setInviteAccount(null); }
  }

  async function submitVilla(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const optional = (key: string) => String(form.get(key) ?? "").trim() || null;
    const existing = editingVilla && editingVilla !== "new" ? editingVilla : null;
    const success = await save("/api/management/villas", {
      ...(existing ? { id: existing.id, expectedRevision: existing.revision } : {}),
      projectId: form.get("projectId"), code: form.get("code"), status: form.get("status"),
      typeLabel: optional("typeLabel"), plotM2: optional("plotM2"), builtM2: optional("builtM2"), outdoorM2: optional("outdoorM2"),
      leaseYears: optional("leaseYears") ? Number(form.get("leaseYears")) : null,
      pricePackage: optional("pricePackage"), priceTotalUsd: optional("priceTotalUsd"),
      buildStarted: optional("buildStarted"), handoverExpected: optional("handoverExpected"),
    }, "villa");
    if (success) setEditingVilla(null);
  }

  const existingVilla = editingVilla && editingVilla !== "new" ? editingVilla : null;
  const managedVillas = data?.villas ?? [];
  const selectionVillas = managedVillas.length ? managedVillas : villas;
  const query = search.trim().toLowerCase();
  const filteredAccounts = data?.accounts.filter((account) => !query || `${account.name} ${account.email} ${account.role}`.toLowerCase().includes(query)) ?? [];
  const filteredVillas = managedVillas.filter((villa) => !query || `${villa.code} ${villa.typeLabel ?? ""} ${projects.find((project) => project.id === villa.projectId)?.name ?? ""}`.toLowerCase().includes(query));

  return <section className="op-management" aria-label="Account and residence management">
    <div className="opm-heading">
      <div><span className="opm-eyebrow">Developer workspace</span><h2>People & residences</h2><p>Manage assigned access and the details your team works with.</p></div>
      <button type="button" className="opm-button opm-button-quiet" disabled={loading || Boolean(busy)} onClick={() => { setError(""); void load(); }}> {loading ? "Refreshing…" : "Refresh"}</button>
    </div>
    <div className="opm-tabs" role="group" aria-label="Management sections">
      <button type="button" aria-pressed={tab === "accounts"} onClick={() => { setTab("accounts"); setSearch(""); setError(""); setNotice(""); }}>People & access <span>{data?.accounts.length ?? "—"}</span></button>
      <button type="button" aria-pressed={tab === "residences"} onClick={() => { setTab("residences"); setSearch(""); setError(""); setNotice(""); }}>Residence details <span>{data?.villas.length ?? "—"}</span></button>
    </div>
    {error ? <p className="opm-message opm-message-error" role="alert">{error}</p> : null}
    {notice ? <p className="opm-message" role="status">{notice}</p> : null}
    <div className="opm-toolbar">
      <label className="opm-search">Search {tab === "accounts" ? "people" : "residences"}<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={tab === "accounts" ? "Name or email" : "Villa or project"} /></label>
      <button type="button" className="opm-button" disabled={Boolean(busy) || !projects.length} onClick={() => {
        setError(""); setNotice("");
        if (tab === "accounts") { setInviteAccount(null); setRole("buyer"); setInviteOpen(true); } else setEditingVilla("new");
      }}>{tab === "accounts" ? "Invite a person" : "Add residence"}</button>
    </div>

    {tab === "accounts" && inviteOpen ? <form className="opm-form" onSubmit={submitInvite} key={inviteAccount?.id ?? "new-invitation"}>
      <div className="opm-form-heading"><h3>{inviteAccount ? "Add access & invite again" : "Invite a person"}</h3><button type="button" className="opm-button opm-button-quiet" disabled={Boolean(busy)} onClick={() => { setInviteOpen(false); setError(""); }}>Cancel</button></div>
      <p>They will request their own secure sign-in link. Existing access is kept; an invitation never changes an existing account’s role.</p>
      <div className="opm-fields">
        <label>Full name<input name="name" autoComplete="name" required maxLength={200} defaultValue={inviteAccount?.name ?? ""} /></label>
        <label>Email address<input name="email" type="email" autoComplete="email" required maxLength={320} readOnly={Boolean(inviteAccount)} defaultValue={inviteAccount?.email ?? ""} /></label>
        <label>Access role<select value={role} disabled={Boolean(inviteAccount)} onChange={(event) => setRole(event.target.value as "buyer" | "pm")}><option value="buyer">Buyer / owner</option><option value="pm">Project manager</option></select></label>
      </div>
      <fieldset className="opm-choices"><legend>{role === "buyer" ? "Residences this owner may access" : "Projects this manager may access"}</legend>
        {role === "buyer" ? selectionVillas.map((villa) => <label key={villa.id}><input type="checkbox" name="villaIds" value={villa.id} defaultChecked={inviteAccount?.villaIds.includes(villa.id)} /><span>{villa.code}<small>{projects.find((project) => project.id === villa.projectId)?.name ?? "Project"}</small></span></label>) : projects.map((project) => <label key={project.id}><input type="checkbox" name="projectIds" value={project.id} defaultChecked={inviteAccount?.projectIds.includes(project.id)} /><span>{project.name}</span></label>)}
      </fieldset>
      {role === "buyer" ? <label className="opm-check"><input type="checkbox" name="allowSharedVilla" /><span>If a residence already has another owner, I confirm this person should also have access to its files, payments and updates.</span></label> : <p>Project managers can access construction progress and photos, not owner finances or account management.</p>}
      <button className="opm-button" disabled={Boolean(busy)}>{busy === "invite" ? "Saving invitation…" : "Save access & send invitation"}</button>
    </form> : null}

    {tab === "accounts" ? <div className="opm-people" aria-busy={loading}>
      {!data && loading ? <p className="opm-empty">Loading people and assigned access…</p> : null}
      {data && !filteredAccounts.length ? <p className="opm-empty">{query ? "No people match this search." : "No buyers or project managers yet. Invite someone to get started."}</p> : null}
      {filteredAccounts.map((account) => <article className="opm-person" key={account.id}>
        <div className="opm-person-name"><strong>{account.name}</strong><span>{account.email}</span><span className="opm-tag">{account.role === "buyer" ? "Owner" : "Project manager"}</span></div>
        <dl><div><dt>Assigned access</dt><dd>{(account.role === "buyer" ? account.villaIds.map((id) => selectionVillas.find((villa) => villa.id === id)?.code ?? "Residence") : account.projectIds.map((id) => projects.find((project) => project.id === id)?.name ?? "Project")).join(", ") || "No assignments"}</dd></div><div><dt>Last sign-in · UTC</dt><dd>{dateLabel(account.lastLoginAt)}</dd></div><div><dt>Invitation</dt><dd className={account.invitation?.state === "failed" ? "opm-error-text" : ""}>{deliveryLabel(account)}{account.invitation ? <small>{dateLabel(account.invitation.requestedAt)}</small> : null}</dd></div></dl>
        <div className="opm-row-actions"><button type="button" className="opm-button opm-button-quiet" disabled={Boolean(busy)} onClick={() => { setInviteAccount(account); setRole(account.role); setInviteOpen(true); }}>Add access</button>{account.invitation ? <button type="button" className="opm-button opm-button-quiet" disabled={Boolean(busy) || Date.now() - Date.parse(account.invitation.requestedAt) < 900000} title="Invitations can be resent after 15 minutes" onClick={() => void save("/api/management/invitations/resend", { accountId: account.id }, account.id)}>{busy === account.id ? "Queuing…" : "Resend invitation"}</button> : null}</div>
      </article>)}
    </div> : null}

    {tab === "residences" && editingVilla ? <form className="opm-form" onSubmit={submitVilla} key={existingVilla?.id ?? "new-villa"}>
      <div className="opm-form-heading"><h3>{existingVilla ? `Edit ${existingVilla.code}` : "New residence"}</h3><button type="button" className="opm-button opm-button-quiet" disabled={Boolean(busy)} onClick={() => { setEditingVilla(null); setError(""); }}>Cancel</button></div>
      <p>These are platform records. Existing ownership, payments and documents are preserved. The public brochure is managed separately.</p>
      <div className="opm-fields">
        <label>Project{existingVilla ? <><input value={projects.find((project) => project.id === existingVilla.projectId)?.name ?? "Project"} readOnly /><input type="hidden" name="projectId" value={existingVilla.projectId} /></> : <select name="projectId" required defaultValue={projects[0]?.id}>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select>}</label>
        <label>Unique villa code<input name="code" required maxLength={20} pattern="[a-zA-Z0-9][a-zA-Z0-9 _\-]*" defaultValue={existingVilla?.code ?? ""} placeholder="Villa 03" /></label>
        <label>Status<select name="status" defaultValue={existingVilla?.status ?? "planned"}>{["planned", "on_schedule", "in_build", "in_progress", "delayed", "completed", "complete", "available", "reserved", "sold"].map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}</select></label>
        <label>Residence type<input name="typeLabel" maxLength={80} defaultValue={existingVilla?.typeLabel ?? ""} placeholder="One-bedroom loft" /></label>
        <label>Plot · m²<input name="plotM2" type="number" inputMode="decimal" min="0" max="999999.99" step="0.01" defaultValue={existingVilla?.plotM2 ?? ""} /></label>
        <label>Built area · m²<input name="builtM2" type="number" inputMode="decimal" min="0" max="999999.99" step="0.01" defaultValue={existingVilla?.builtM2 ?? ""} /></label>
        <label>Outdoor area · m²<input name="outdoorM2" type="number" inputMode="decimal" min="0" max="999999.99" step="0.01" defaultValue={existingVilla?.outdoorM2 ?? ""} /></label>
        <label>Lease · years<input name="leaseYears" type="number" inputMode="numeric" min="1" max="999" step="1" defaultValue={existingVilla?.leaseYears ?? ""} /></label>
        <label>Package label<input name="pricePackage" maxLength={60} defaultValue={existingVilla?.pricePackage ?? ""} /></label>
        <label>Total price · USD<input name="priceTotalUsd" type="number" inputMode="decimal" min="0" max="9999999999.99" step="0.01" defaultValue={existingVilla?.priceTotalUsd ?? ""} /></label>
        <label>Construction starts<input name="buildStarted" type="date" defaultValue={existingVilla?.buildStarted ?? ""} /></label>
        <label>Expected handover<input name="handoverExpected" type="date" defaultValue={existingVilla?.handoverExpected ?? ""} /></label>
      </div><p>Leave unknown measurements, amounts and dates empty. Price changes do not rewrite existing payment milestones.</p>
      <button className="opm-button" disabled={Boolean(busy)}>{busy === "villa" ? "Saving residence…" : "Save residence"}</button>
    </form> : null}

    {tab === "residences" ? <div className="opm-residences" aria-busy={loading}>
      {!data && loading ? <p className="opm-empty">Loading residences…</p> : null}
      {data && !filteredVillas.length ? <p className="opm-empty">{query ? "No residences match this search." : "No residences yet. Add the first residence to an existing project."}</p> : null}
      {filteredVillas.map((villa) => <article className="opm-residence" key={villa.id}><div><strong>{villa.code}</strong><span>{projects.find((project) => project.id === villa.projectId)?.name}</span></div><span className="opm-tag">{villa.status.replaceAll("_", " ")}</span><div className="opm-row-actions"><a className="opm-button opm-button-quiet" href={`/office/preview/${encodeURIComponent(villa.id)}`}>View as buyer</a><button type="button" className="opm-button opm-button-quiet" disabled={Boolean(busy)} onClick={() => setEditingVilla(villa)}>Edit details</button></div></article>)}
    </div> : null}
    <p className="opm-footnote">Access is added only after a successful save. Invitation delivery does not prove a first sign-in. “Not recorded yet” can also mean an older account whose earlier sign-ins were not tracked.</p>
  </section>;
}
