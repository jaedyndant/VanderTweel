"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { BillingStatus, ScheduleStep } from "@/lib/billing/domain";
import "./billing-manager.css";

type Issuer = { companyName: string; address: string; email: string; registrationNumber: string | null; taxNumber: string | null; bankInstructions: string; invoicePrefix: string; updatedAt: string };
type Recipient = { name: string; address: string; email: string; updatedAt: string };
type Milestone = { id: string; dueLabel: string; percent: string; amountUsd: string | null; expectedAt: string | null; paidAt: string | null; billingStatus: BillingStatus; invoice: { id: string; number: string } | null };
type Payment = { id: string; invoiceId: string; reference: string; paidAt: string; reversedAt: string | null; reversalReason: string | null };
type Dashboard = { issuer: Issuer | null; template: { name: string; steps: ScheduleStep[]; updatedAt: string } | null; recipient: Recipient | null; contractTotal: string | null; milestones: Milestone[]; documents: { id: string; number: string; kind: string; url: string; reversed: boolean }[]; payments: Payment[] };
export type BillingManagerProps = { projectId: string; villas: Array<{ id: string; code: string }> };
const money = (value: string | null) => value ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(Number(value)) : "Not set";
const date = (value: string | null) => value ? new Date(value).toLocaleDateString("en-GB", { timeZone: "UTC" }) : "Not set";
const today = () => new Date().toISOString().slice(0, 10);
const values = (form: HTMLFormElement) => Object.fromEntries(new FormData(form));

/** A focused developer-only billing workspace. The API enforces roles again;
 * hiding this component from PMs is never the authorization boundary. */
export function BillingManager({ projectId, villas }: BillingManagerProps) {
  const [villaId, setVillaId] = useState(villas[0]?.id ?? "");
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [requestIds, setRequestIds] = useState<Record<string, string>>({});
  const [steps, setSteps] = useState<ScheduleStep[]>([{ label: "", percent: "", dueDays: 0 }]);
  useEffect(() => { if (!villas.some((item) => item.id === villaId)) setVillaId(villas[0]?.id ?? ""); }, [villas, villaId]);
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const query = new URLSearchParams({ projectId, ...(villaId ? { villaId } : {}) });
      const response = await fetch(`/api/billing?${query}`, { cache: "no-store", signal });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Billing could not be loaded.");
      if (!signal?.aborted) { setData(body); setSteps(body.template?.steps ?? [{ label: "", percent: "", dueDays: 0 }]); }
    } catch (err) { if (!signal?.aborted) setError(err instanceof Error ? err.message : "Billing could not be loaded."); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [projectId, villaId]);
  useEffect(() => { const controller = new AbortController(); setData(null); setExpanded(null); setError(""); setNotice(""); void load(controller.signal); return () => controller.abort(); }, [load]);
  async function submit(command: Record<string, unknown>, success: string) {
    setPending(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/billing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId, villaId, ...command }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "The change could not be saved.");
      setNotice(success); setExpanded(null); await load();
    } catch (err) { setError(err instanceof Error ? err.message : "The change could not be saved. Please retry."); }
    finally { setPending(false); }
  }
  function formSubmit(event: FormEvent<HTMLFormElement>, command: (value: Record<string, FormDataEntryValue>) => Record<string, unknown>, message: string) {
    event.preventDefault(); void submit(command(values(event.currentTarget)), message);
  }
  const hasFinancialHistory = !!data?.milestones.some((item) => item.invoice || item.billingStatus === "paid");
  const hasIssuer = !!data?.issuer;
  const hasRecipient = !!data?.recipient;
  const totalPercent = steps.reduce((sum, step) => sum + Number(step.percent || 0), 0);
  return <section className="billing-manager" aria-label="Billing workspace">
    <header className="bm-heading"><div><p className="bm-eyebrow">FINANCIAL ADMINISTRATION</p><h2>Schedules &amp; billing</h2><p>Issue a documented request. Record the transfer. Keep a clear history.</p></div>
      <label className="bm-residence">Residence<select value={villaId} disabled={pending || !villas.length} onChange={(event) => setVillaId(event.target.value)}>{!villas.length ? <option value="">No residences yet</option> : villas.map((item) => <option key={item.id} value={item.id}>{item.code}</option>)}</select></label>
    </header>
    {error ? <div className="bm-alert bm-error" role="alert">{error}{!data && !loading ? <button type="button" onClick={() => void load()}>Try again</button> : null}</div> : null}
    {notice ? <div className="bm-alert" role="status">{notice}</div> : null}
    {loading && !data ? <p role="status">Loading billing records…</p> : null}
    {data ? <>
      <div className="bm-overview"><div><span>Contract total</span><strong>{money(data.contractTotal)}</strong></div><div><span>Issuer details</span><strong>{hasIssuer ? "Configured" : "Required before issue"}</strong></div><div><span>Billing recipient</span><strong>{hasRecipient ? data.recipient!.name : "Required before issue"}</strong></div></div>
      <details className="bm-section" open={!hasIssuer}><summary><span>Company &amp; payment instructions</span><small>Project-wide · future invoices only</small></summary>
        <p>Use the actual issuing company and receiving bank. Issued documents keep their original details. No tax amounts are calculated automatically.</p>
        <form key={data.issuer?.updatedAt ?? "new-issuer"} onSubmit={(event) => formSubmit(event, (value) => ({ action: "issuer", value }), "Issuer details saved. Existing documents are unchanged.")}><fieldset disabled={pending}><div className="bm-form-grid">
          <label>Legal company name<input name="companyName" required maxLength={200} defaultValue={data.issuer?.companyName} autoComplete="organization" /></label>
          <label>Billing contact email<input name="email" type="email" required maxLength={320} defaultValue={data.issuer?.email} autoComplete="email" /></label>
          <label className="bm-wide">Company address<textarea name="address" required maxLength={1500} defaultValue={data.issuer?.address} autoComplete="street-address" rows={3} /></label>
          <label>Registration number <small>Optional</small><input name="registrationNumber" maxLength={120} defaultValue={data.issuer?.registrationNumber ?? ""} /></label>
          <label>Tax reference <small>Optional</small><input name="taxNumber" maxLength={120} defaultValue={data.issuer?.taxNumber ?? ""} /></label>
          <label className="bm-wide">Bank / transfer instructions<textarea name="bankInstructions" required maxLength={2000} rows={4} defaultValue={data.issuer?.bankInstructions} placeholder="Beneficiary, bank, account / IBAN, SWIFT, currency and any required transfer instructions" /></label>
          <label>Invoice prefix<input name="invoicePrefix" required pattern="[A-Z0-9][A-Z0-9-]{1,19}" maxLength={20} defaultValue={data.issuer?.invoicePrefix ?? "INV"} /><small>Uppercase letters, numbers and hyphens.</small></label>
        </div><button className="bm-primary" type="submit">{pending ? "Saving…" : "Save issuer details"}</button></fieldset></form>
      </details>
      {villaId ? <details className="bm-section" open={!hasRecipient}><summary><span>Billing recipient</span><small>Selected residence</small></summary>
        <p>Enter the buyer’s agreed billing identity. Documents are shared only with the buyer accounts assigned to this residence.</p>
        <form key={`${villaId}-${data.recipient?.updatedAt ?? "new"}`} onSubmit={(event) => formSubmit(event, (value) => ({ action: "recipient", value }), "Billing recipient saved. Existing documents are unchanged.")}><fieldset disabled={pending}><div className="bm-form-grid">
          <label>Full name / company<input name="name" required maxLength={200} defaultValue={data.recipient?.name} autoComplete="name" /></label><label>Email on invoice<input name="email" type="email" required maxLength={320} defaultValue={data.recipient?.email} autoComplete="email" /></label>
          <label className="bm-wide">Billing address<textarea name="address" required maxLength={1500} rows={3} defaultValue={data.recipient?.address} autoComplete="street-address" /></label>
        </div><button type="submit" className="bm-primary">Save recipient</button></fieldset></form>
      </details> : null}
      <details className="bm-section"><summary><span>Project schedule template</span><small>{data.template?.name ?? "Not configured"}</small></summary>
        <p>Changes apply only when you publish a schedule to an unissued residence. Existing invoices and paid steps cannot be replaced.</p>
        <form onSubmit={(event) => formSubmit(event, (value) => ({ action: "template", value: { name: value.name, steps } }), "Project template saved. Existing residence schedules have not changed.")}><fieldset disabled={pending}>
          <label>Template name<input key={data.template?.updatedAt ?? "new"} name="name" defaultValue={data.template?.name} maxLength={120} required /></label>
          <ol className="bm-template-steps">{steps.map((step, index) => <li key={index}><label>Payment label<input aria-label={`Step ${index + 1} label`} value={step.label} maxLength={120} required onChange={(event) => setSteps((rows) => rows.map((row, i) => i === index ? { ...row, label: event.target.value } : row))} /></label><label>Percent<input aria-label={`Step ${index + 1} percent`} value={step.percent} inputMode="decimal" pattern="[0-9]+(\.[0-9]{1,2})?" required onChange={(event) => setSteps((rows) => rows.map((row, i) => i === index ? { ...row, percent: event.target.value } : row))} /></label><label>Days from start<input aria-label={`Step ${index + 1} days from start`} type="number" min={0} max={3650} value={step.dueDays} required onChange={(event) => setSteps((rows) => rows.map((row, i) => i === index ? { ...row, dueDays: Number(event.target.value) } : row))} /></label><button type="button" disabled={steps.length < 2} aria-label={`Remove step ${index + 1}`} onClick={() => setSteps((rows) => rows.filter((_, i) => i !== index))}>Remove</button></li>)}</ol>
          <div className="bm-actions"><button type="button" disabled={steps.length >= 36} onClick={() => setSteps((rows) => [...rows, { label: "", percent: "", dueDays: rows.at(-1)?.dueDays ?? 0 }])}>Add payment step</button><span className={Math.abs(totalPercent - 100) < .00001 ? "bm-total-valid" : "bm-total-invalid"}>Total {totalPercent.toFixed(2)}% / 100%</span><button type="submit" className="bm-primary">Save project template</button></div>
        </fieldset></form>
        {villaId ? <form className="bm-apply" onSubmit={(event) => formSubmit(event, (value) => ({ action: "apply", startDate: value.startDate, replaceUnissued: value.replaceUnissued === "on" }), "Residence payment schedule published.")}><fieldset disabled={pending || !data.template || hasFinancialHistory || !data.contractTotal}>
          <label>Schedule start date<input type="date" name="startDate" required defaultValue={today()} /></label>
          {data.milestones.length ? <label className="bm-check"><input type="checkbox" name="replaceUnissued" required />Replace this residence’s existing unissued schedule with the saved template.</label> : null}
          <button type="submit" className="bm-primary">Apply saved template to residence</button>
        </fieldset>{hasFinancialHistory ? <p>The schedule is locked because it contains an invoice or a recorded payment.</p> : !data.contractTotal ? <p>Set a residence contract total before publishing a payment schedule.</p> : null}</form> : null}
      </details>
      <section className="bm-ledger"><div className="bm-section-title"><h3>Payment schedule</h3><span>{data.milestones.length} steps · USD</span></div>
        {!data.milestones.length ? <p className="bm-empty">No payment schedule yet. Save a project template, then apply it to this residence.</p> : <ol className="bm-milestones">{data.milestones.map((step) => {
          const activePayment = data.payments.find((item) => item.invoiceId === step.invoice?.id && !item.reversedAt);
          return <li key={step.id}><div className="bm-step-main"><div className="bm-step-label"><strong>{step.dueLabel}</strong><small>{step.percent}% · Due {date(step.expectedAt)}{step.invoice ? ` · ${step.invoice.number}` : ""}</small></div><strong className="bm-amount">{money(step.amountUsd)}</strong><span className={`bm-status bm-status-${step.billingStatus}`}>{step.billingStatus}</span><div className="bm-row-action">
            {!step.invoice && step.billingStatus !== "paid" ? <button type="button" disabled={pending || !hasIssuer || !hasRecipient || step.billingStatus === "draft"} onClick={() => setExpanded(expanded === `issue-${step.id}` ? null : `issue-${step.id}`)}>Issue invoice</button> : step.invoice && step.billingStatus !== "paid" ? <button type="button" disabled={pending} onClick={() => { setRequestIds((ids) => ({ ...ids, [step.id]: crypto.randomUUID() })); setExpanded(expanded === `pay-${step.id}` ? null : `pay-${step.id}`); }}>Record payment</button> : activePayment ? <button type="button" disabled={pending} onClick={() => setExpanded(expanded === `reverse-${step.id}` ? null : `reverse-${step.id}`)}>Correct entry</button> : <small>Historical payment</small>}
          </div></div>
          {expanded === `issue-${step.id}` ? <div className="bm-inline"><h4>Issue invoice for {money(step.amountUsd)}?</h4><p>{data.issuer?.companyName} → {data.recipient?.name}. Issued invoices cannot be edited or deleted. The buyer receives a document notification.</p><div className="bm-actions"><button type="button" className="bm-primary" disabled={pending} onClick={() => void submit({ action: "issue", milestoneId: step.id }, "Invoice issued and added to the buyer’s documents.")}>{pending ? "Issuing…" : "Confirm & issue invoice"}</button><button type="button" disabled={pending} onClick={() => setExpanded(null)}>Cancel</button></div></div> : null}
          {expanded === `pay-${step.id}` ? <form className="bm-inline" onSubmit={(event) => formSubmit(event, (value) => ({ action: "pay", milestoneId: step.id, requestId: requestIds[step.id], ...value }), "Payment recorded. The buyer’s receipt is available.")}><fieldset disabled={pending}><h4>Record the received transfer</h4><p>Use the actual bank reference and date. This records a full settlement and creates a receipt; it does not move money.</p><div className="bm-form-grid"><label>Amount received (USD)<input name="amount" value={step.amountUsd ?? ""} readOnly /></label><label>Payment date<input name="paidDate" type="date" max={today()} defaultValue={today()} required /></label><label className="bm-wide">Bank / transfer reference<input name="reference" required minLength={2} maxLength={200} /></label></div><div className="bm-actions"><button className="bm-primary" type="submit">{pending ? "Recording…" : "Record payment & create receipt"}</button><button type="button" onClick={() => setExpanded(null)}>Cancel</button></div></fieldset></form> : null}
          {expanded === `reverse-${step.id}` && activePayment ? <form className="bm-inline" onSubmit={(event) => formSubmit(event, (value) => ({ action: "reverse", paymentId: activePayment.id, reason: value.reason }), "Payment entry reversed. Original invoice and receipt are retained.")}><fieldset disabled={pending}><h4>Correct payment entry</h4><p>This reopens the invoice and marks the original receipt as reversed. It does not refund money. Record the correct transfer separately.</p><label>Reason for correction<textarea name="reason" required minLength={10} maxLength={2000} rows={3} /></label><div className="bm-actions"><button type="submit" className="bm-danger">Reverse payment entry</button><button type="button" onClick={() => setExpanded(null)}>Cancel</button></div></fieldset></form> : null}
          </li>;
        })}</ol>}
      </section>
      <section className="bm-ledger"><div className="bm-section-title"><h3>Invoices &amp; receipts</h3><span>Original records retained</span></div>{!data.documents.length ? <p className="bm-empty">Issued invoices and payment receipts will appear here and in the buyer’s documents.</p> : <ul className="bm-documents">{data.documents.map((document) => <li key={document.id}><div><strong>{document.number}</strong><small>{document.kind === "receipt" ? "Payment receipt" : "Invoice"}{document.reversed ? " · Payment reversed" : ""}</small></div><a href={document.url} download>Download PDF <span aria-hidden="true">↓</span></a></li>)}</ul>}</section>
    </> : null}
  </section>;
}
