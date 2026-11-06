import "server-only";

import Link from "next/link";
import type { ReactNode } from "react";
import { officeHref } from "./presentation";
import "./developer-help.css";

function Question({
  title,
  children,
  open = false,
}: {
  title: string;
  children: ReactNode;
  open?: boolean;
}) {
  return (
    <details className="oph-question" open={open}>
      <summary>
        <h3>{title}</h3>
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden="true">
          <path d="M3 8h10" />
          <path className="oph-plus" d="M8 3v10" />
        </svg>
      </summary>
      <div className="oph-answer">{children}</div>
    </details>
  );
}

/** Rendered only after OfficeRoute and the data loader verify a developer. */
export function DeveloperHelp({ projectId }: { projectId: string | null }) {
  return (
    <div className="office-help">
      <header className="op-heading oph-heading">
        <div>
          <div className="op-eyebrow">Developer guide</div>
          <h1>Help &amp; guidance.</h1>
          <p>Practical answers for managing your residences, schedules and owner records.</p>
        </div>
        <Link className="op-btn" href={officeHref("payments", projectId)}>Open Payments <span aria-hidden="true">↗</span></Link>
      </header>

      <section className="oph-workflow" aria-labelledby="oph-workflow-title">
        <h2 id="oph-workflow-title">The payment workflow</h2>
        <ol>
          <li><span className="oph-step" aria-hidden="true">1</span><div><strong>Prepare the schedule</strong><p>Save the template, then apply it to a residence.</p></div></li>
          <li><span className="oph-step" aria-hidden="true">2</span><div><strong>Issue the invoice</strong><p>Create the payment request for a specific step.</p></div></li>
          <li><span className="oph-step" aria-hidden="true">3</span><div><strong>Record the transfer</strong><p>After full payment arrives, record it and create a receipt.</p></div></li>
        </ol>
        <p className="oph-workflow-note">Payment status follows these records, not construction progress. The platform does not collect money or sync bank transfers.</p>
      </section>

      <div className="oph-layout">
        <nav className="oph-index" aria-label="Help topics">
          <span className="op-eyebrow">Find an answer</span>
          <a href="#help-schedules">Payment schedules <span aria-hidden="true">↓</span></a>
          <a href="#help-invoices">Invoices &amp; payments <span aria-hidden="true">↓</span></a>
          <a href="#help-residences">Residences &amp; access <span aria-hidden="true">↓</span></a>
          <a href="#help-files">Files &amp; updates <span aria-hidden="true">↓</span></a>
          <p>This guide is available only to developers.</p>
        </nav>

        <div className="oph-sections">
          <section id="help-schedules" aria-labelledby="help-schedules-title">
            <header className="oph-section-heading"><h2 id="help-schedules-title">Payment schedules</h2><p>One project template. A separate schedule for each residence.</p></header>
            <Question title="Where do I manage the current payment schedule?" open>
              <p>Open <Link href={officeHref("payments", projectId)}>Payments</Link>. Choose the development if needed, then use the <strong>Residence</strong> selector in <strong>Schedules &amp; billing</strong> to choose the villa. Its current steps appear under <strong>Payment schedule</strong>.</p>
              <p>The step labels, percentages, amounts and dates are not inline-editable. To change an unissued schedule, update the project template and explicitly apply it to that residence. Use the buttons beside a step to issue an invoice or record a payment.</p>
            </Question>
            <Question title="What is the difference between the template and the payment schedule?">
              <p><strong>Project schedule template</strong> is the reusable plan for a development: payment labels, percentages and <strong>Days from start</strong>. It is not a list of payments received.</p>
              <p><strong>Payment schedule</strong> is the plan already applied to the selected residence, with its own USD amounts, due dates and payment records. <strong>Save project template</strong> changes only the template; it does not update existing residence schedules.</p>
            </Question>
            <Question title="How do I create or replace a villa’s schedule?">
              <ol>
                <li>In <strong>Payments</strong>, select the correct development and <strong>Residence</strong>.</li>
                <li>Expand <strong>Project schedule template</strong>. Enter a template name and the payment labels, percentages and <strong>Days from start</strong>. Every percentage must be positive and the total must be exactly <strong>100%</strong>. Keep the days in schedule order, from earlier to later.</li>
                <li>Select <strong>Save project template</strong> and wait for the saved confirmation.</li>
                <li>Set the <strong>Schedule start date</strong>. Each due date is this date plus that step’s <strong>Days from start</strong>.</li>
                <li>If a schedule already exists, tick <strong>Replace this residence’s existing unissued schedule with the saved template.</strong></li>
                <li>Select <strong>Apply saved template to residence</strong>. The saved template replaces the whole unissued schedule for this residence only.</li>
              </ol>
              <p className="oph-note">A residence contract total is required. Replacement is blocked as soon as any step has an issued invoice or a recorded payment, including historical paid steps. Correcting a payment does not remove its invoice or unlock replacement.</p>
            </Question>
            <Question title="Where do I set the contract total, and does changing it recalculate the schedule?">
              <p>Before applying the first schedule, open <Link href={officeHref("villas", projectId)}>Residences</Link>, choose <strong>Edit details</strong> for the villa, enter <strong>Total price · USD</strong> and select <strong>Save residence</strong>. This is the <strong>Contract total</strong> shown in Payments. Applying a template calculates each payment amount from this total and the step’s percentage.</p>
              <p>Once a payment schedule exists, changing the contract total is blocked, even if the schedule is still unissued. Existing amounts are not recalculated. A contract amendment needs to be reconciled with the finance team; there is no self-service schedule reset or contract-amendment action here. Issued documents and recorded payments remain unchanged.</p>
            </Question>
          </section>

          <section id="help-invoices" aria-labelledby="help-invoices-title">
            <header className="oph-section-heading"><h2 id="help-invoices-title">Invoices &amp; payments</h2><p>Request a payment, record what arrived and retain the original documents.</p></header>
            <Question title="How do I change a step from Planned or Next to Paid?">
              <ol>
                <li>In <strong>Payments → Schedules &amp; billing</strong>, select the residence and find the step under <strong>Payment schedule</strong>.</li>
                <li>Select <strong>Issue invoice</strong>, check the amount and recipient, then select <strong>Confirm &amp; issue invoice</strong>. If an invoice already exists, continue with that invoice.</li>
                <li>Once the full transfer has actually arrived, select <strong>Record payment</strong>.</li>
                <li>Check <strong>Amount received (USD)</strong>, enter the actual <strong>Payment date</strong> and <strong>Bank / transfer reference</strong>, then select <strong>Record payment &amp; create receipt</strong>.</li>
              </ol>
              <p>The step becomes <strong>Paid</strong> and a receipt is created. There is no manual status dropdown or automatic bank confirmation. This form records the exact full invoice amount; partial payments and overpayments cannot be recorded here. A future payment date is not accepted.</p>
            </Question>
            <Question title="Why is Issue invoice disabled, or why does issuing fail?">
              <p>Complete <strong>Company &amp; payment instructions</strong> and select <strong>Save issuer details</strong>. For the selected villa, complete <strong>Billing recipient</strong> and select <strong>Save recipient</strong>. The step also needs a valid amount and due date; a <strong>Draft</strong> step cannot be issued.</p>
              <p>A buyer must be assigned to the residence before an invoice can be issued. Manage that in <Link href={officeHref("buyers", projectId)}>CRM</Link>; entering an email in Billing recipient does not grant the person access. Historical paid steps cannot be retrospectively invoiced with this action.</p>
            </Question>
            <Question title="What do Draft, Planned, Next, Invoiced, Overdue and Paid mean?">
              <dl className="oph-statuses">
                <div><dt>Draft</dt><dd>An unissued step is missing its amount or due date.</dd></div>
                <div><dt>Planned</dt><dd>A complete, unissued step later in the payment sequence.</dd></div>
                <div><dt>Next</dt><dd>The first unpaid step in the sequence, ready to invoice. It is not an invoice yet.</dd></div>
                <div><dt>Invoiced</dt><dd>An invoice has been issued, but full payment has not been recorded.</dd></div>
                <div><dt>Overdue</dt><dd>An issued, unpaid invoice has passed its due date. Unissued steps do not become overdue.</dd></div>
                <div><dt>Paid</dt><dd>The step is recorded as paid, either through the payment workflow or as a historical paid record.</dd></div>
              </dl>
              <p>These labels are calculated from the stored records when billing loads. Completing construction tasks does not advance payment status.</p>
            </Question>
            <Question title="How do I correct a payment recorded by mistake?">
              <p>On the paid step, select <strong>Correct entry</strong>, enter a clear <strong>Reason for correction</strong> and select <strong>Reverse payment entry</strong>. The invoice reopens and the original receipt is marked as reversed. Record the correct transfer separately with <strong>Record payment</strong>.</p>
              <p>This corrects the record; it does not refund money. The invoice and original receipt are retained, so the schedule remains locked. A historical paid step without a payment entry has no <strong>Correct entry</strong> action here.</p>
            </Question>
            <Question title="Where are invoices and receipts, and can I edit an issued invoice?">
              <p>For the selected residence, find <strong>Invoices &amp; receipts</strong> below the payment schedule and select <strong>Download PDF</strong>. Issued documents are also available in the assigned buyer’s documents.</p>
              <p>Issued invoices cannot be edited or deleted here. Changes to company details, bank instructions or the billing recipient apply to future invoices only; existing documents keep their original details.</p>
            </Question>
          </section>

          <section id="help-residences" aria-labelledby="help-residences-title">
            <header className="oph-section-heading"><h2 id="help-residences-title">Residences &amp; access</h2><p>Open the working record and connect the right people.</p></header>
            <Question title="How do I open a residence or change its details?">
              <p>Go to <Link href={officeHref("villas", projectId)}>Residences</Link> and select <strong>Open residence</strong> beside the villa to open its working record. Use <strong>Edit details</strong> for its code, status, dimensions, total price and planning dates, then select <strong>Save residence</strong>.</p>
              <p>These are platform records. Editing them does not update the public brochure, change buyer assignments or rewrite existing payment milestones.</p>
            </Question>
            <Question title="How do I give an owner or project manager access?">
              <p>Open <Link href={officeHref("buyers", projectId)}>CRM</Link>, select <strong>Invite a person</strong> and enter their name, email and <strong>Access role</strong>. Select the owner’s residences or the project manager’s projects, then choose <strong>Save access &amp; send invitation</strong>.</p>
              <p>Use <strong>Add access</strong> for an existing person. This adds assignments; it does not remove existing access or change the account’s role. If a residence already has an owner, confirm the additional owner should also see its files, payments and updates.</p>
              <p>Owners see their assigned residences. Project managers work with construction progress and photos, not finances, CRM or this Help tab. An invitation’s delivery status does not prove that the person has signed in.</p>
            </Question>
          </section>

          <section id="help-files" aria-labelledby="help-files-title">
            <header className="oph-section-heading"><h2 id="help-files-title">Files &amp; updates</h2><p>Review privately, then share with the intended owners.</p></header>
            <Question title="Why can’t the buyer see a file I uploaded?">
              <p>Files uploaded with <strong>Upload internally</strong> are private to the team. In <Link href={officeHref("documents", projectId)}>Documents</Link>, find the file, select <strong>Share</strong>, check the audience and select <strong>Confirm share</strong>. A project file is shared with that project’s buyers; a villa file is shared with its linked buyers.</p>
              <p>Use <strong>Make internal</strong> to stop sharing. Replacing a file retains its previous version and makes the replacement internal until you share it again. If private storage is not configured, uploading is unavailable.</p>
            </Question>
            <Question title="How do I publish an update to the right owners?">
              <p>Open <Link href={officeHref("updates", projectId)}>Site updates</Link> and check <strong>Audience</strong>: choose all owners in the development or one villa’s owners. Fill in <strong>Title</strong>, <strong>Category</strong> and <strong>Update</strong>, attach published site photographs if needed, then select <strong>Publish update</strong>.</p>
              <p>The update becomes visible to that audience and email delivery is queued. <strong>Activity &amp; delivery</strong> shows the recorded activity and delivery state; publication alone does not confirm mailbox receipt.</p>
            </Question>
          </section>
        </div>
      </div>
    </div>
  );
}
