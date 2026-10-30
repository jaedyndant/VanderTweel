"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  clientHref,
  dateLabel,
  humanLabel,
  milestoneAmount,
  money,
  paymentCsv,
  paymentSummary,
  safeDocumentUrl,
} from "./presentation";
import type { ClientDocument, ClientPage, ClientPlatformData } from "./types";
import "./client-platform.css";

const images = [
  {
    src: "/client-platform/villa-exterior.jpg",
    label: "Exterior architecture",
  },
  { src: "/client-platform/villa-interior.jpg", label: "Interior palette" },
  { src: "/client-platform/pool.jpg", label: "Pool inspiration" },
];
const navigation: { page: ClientPage; icon: string; label: string }[] = [
  { page: "home", icon: "⌂", label: "Overview" },
  { page: "villa", icon: "▱", label: "Your villa" },
  { page: "progress", icon: "◷", label: "Progress" },
  { page: "payments", icon: "▤", label: "Payments" },
  { page: "documents", icon: "▧", label: "Documents" },
  { page: "updates", icon: "◫", label: "Updates" },
];
type Modal =
  | { kind: "contact" }
  | { kind: "document"; id: string }
  | { kind: "payment"; id: string }
  | { kind: "photo"; src: string; label: string; illustrative: boolean };

function Badge({
  children,
  tone = "",
}: {
  children: ReactNode;
  tone?: "" | "amber" | "neutral";
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

function ProgressBar({
  value,
  label,
  teak = false,
}: {
  value: number | null;
  label: string;
  teak?: boolean;
}) {
  const bounded = value === null ? 0 : Math.max(0, Math.min(100, value));
  return (
    <div
      className={`progress ${teak ? "teak" : ""}`}
      role="progressbar"
      aria-valuenow={value === null ? undefined : bounded}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      aria-valuetext={
        value === null ? "Not yet available" : `${numberLabel(value)}%`
      }
    >
      <i style={{ width: `${bounded}%` }} />
    </div>
  );
}

function Heading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </header>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>;
}

function numberLabel(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(
    value,
  );
}

function Area({ value }: { value: number | null }) {
  return <>{value === null ? "To be confirmed" : `${numberLabel(value)} m²`}</>;
}

type PhotoProps = {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
};

function Photo(props: PhotoProps) {
  // A changed uploaded URL gets a fresh loading/error state after a poll refresh.
  return <PhotoImage key={props.src} {...props} />;
}

function PhotoImage({ src, alt, className, priority = false }: PhotoProps) {
  const [failed, setFailed] = useState(false);
  if (failed)
    return (
      <span
        className={`photo-unavailable ${className ?? ""}`}
        role="img"
        aria-label={alt}
      >
        Image unavailable
      </span>
    );
  // These are local, pre-sized reference photographs, or an authorized file URL.
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      width={1000}
      height={700}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}

function DocumentList({
  items,
  villaCode,
  open,
}: {
  items: ClientDocument[];
  villaCode: string;
  open: (item: ClientDocument) => void;
}) {
  if (!items.length)
    return <Empty>Your team has not shared any documents yet.</Empty>;
  return items.map((item) => (
    <div className="document" key={item.id}>
      <span className="file-icon" aria-hidden="true">
        DOC
      </span>
      <div className="document-copy">
        <strong>{item.label ?? "Project document"}</strong>
        <small>
          {villaCode} · {dateLabel(item.createdAt)}
        </small>
      </div>
      <button
        type="button"
        className="text-link"
        onClick={() => open(item)}
        aria-label={`View ${item.label ?? "project document"}`}
      >
        View ↗
      </button>
    </div>
  ));
}

function UpdateList({ items }: { items: ClientPlatformData["updates"] }) {
  if (!items.length)
    return (
      <Empty>
        Your team has not posted any updates yet. New notes will appear here.
      </Empty>
    );
  return items.map((item, index) => (
    <article className="update" key={item.id}>
      <Photo
        src={images[index % 2].src}
        alt="Illustrative architectural inspiration, not a site photograph"
      />
      <div>
        <small>
          {dateLabel(item.createdAt)} ·{" "}
          {(item.authorRoleLabel ?? "Site team").toUpperCase()}
          {item.category ? ` · ${item.category}` : ""}
        </small>
        <h4>{item.title ?? "A note from your team"}</h4>
        <p>{item.body}</p>
      </div>
    </article>
  ));
}

function FloorPlan({ upper }: { upper: boolean }) {
  return (
    <svg
      viewBox="0 0 600 330"
      role="img"
      aria-label={`Illustrative ${upper ? "upper" : "ground"} floor concept plan, not an approved drawing`}
    >
      <rect
        x="65"
        y="30"
        width="470"
        height="265"
        fill="#fcfaf4"
        stroke="#4c6150"
        strokeWidth="5"
      />
      <path
        d="M365 30V295M65 200H365M455 30V160H535"
        fill="none"
        stroke="#4c6150"
        strokeWidth="3"
      />
      <rect
        x="90"
        y="65"
        width={upper ? 145 : 65}
        height={upper ? 95 : 110}
        rx="3"
        fill="#d8d7c4"
        stroke="#8b937d"
      />
      <rect
        x={upper ? 98 : 95}
        y={upper ? 72 : 73}
        width={upper ? 129 : 50}
        height={upper ? 24 : 94}
        fill="#f1eee5"
      />
      <rect
        x="235"
        y="72"
        width="85"
        height="60"
        fill="#d8d7c4"
        stroke="#8b937d"
      />
      <path
        d="M382 190H430M382 205H430M382 220H430M382 235H430M382 250H430M382 265H430"
        stroke="#8b937d"
      />
      <rect
        x="90"
        y="220"
        width="245"
        height="50"
        fill={upper ? "#e3e2d4" : "#b9cebe"}
      />
      <g fill="#4c6150" fontSize="11" textAnchor="middle">
        <text x="225" y="175">
          {upper ? "BEDROOM SUITE" : "LIVING & DINING"}
        </text>
        <text x="215" y="250">
          {upper ? "PRIVATE TERRACE" : "POOL & TERRACE"}
        </text>
        <text x="410" y="110">
          {upper ? "DRESSING" : "KITCHEN"}
        </text>
        <text x="495" y="100">
          BATH
        </text>
        <text x="490" y="240">
          STAIR
        </text>
        <text x="300" y="322">
          CONCEPT PLAN · NOT TO SCALE
        </text>
      </g>
    </svg>
  );
}

export function ClientPlatform({
  data,
  page,
}: {
  data: ClientPlatformData;
  page: ClientPage;
}) {
  const { villa, buyerName } = data;
  const tasks = [...data.tasks].sort((a, b) => a.sequence - b.sequence);
  const milestones = [...data.milestones].sort(
    (a, b) => a.sequence - b.sequence,
  );
  const documents = data.documents.filter((item) => item.kind !== "photo");
  const photos = data.documents.filter((item) => item.kind === "photo");
  const progress = tasks.length
    ? tasks.reduce(
        (sum, task) => sum + (task.doneAt ? task.percentWeight : 0),
        0,
      )
    : null;
  const payments = paymentSummary(milestones, villa.priceTotalUsd);
  const currentTask = tasks.find((task) => !task.doneAt);
  const [floor, setFloor] = useState<"ground" | "upper">("ground");
  const [modal, setModal] = useState<Modal | null>(null);
  const [exportStatus, setExportStatus] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const ownerNavigation = useRef<HTMLElement>(null);
  const dialogTitle = useId();
  const floorId = useId();
  const href = (destination: ClientPage) => clientHref(destination, villa.id);
  const openDocument = (item: ClientDocument) =>
    setModal({ kind: "document", id: item.id });
  // Resolve selected records from the latest server props, not a stale modal snapshot.
  const modalDocument =
    modal?.kind === "document"
      ? documents.find((item) => item.id === modal.id)
      : null;
  const modalPayment =
    modal?.kind === "payment"
      ? milestones.find((item) => item.id === modal.id)
      : null;
  const initials = (buyerName ?? "Owner")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((name) => name[0])
    .join("")
    .toUpperCase();

  useEffect(() => {
    if (window.matchMedia("(max-width: 700px)").matches) {
      ownerNavigation.current
        ?.querySelector('[aria-current="page"]')
        ?.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }, [page]);

  useEffect(() => {
    if (!modal) return;
    const element = dialog.current;
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    if (element && !element.open) element.showModal();
    return () => {
      if (element?.open) element.close();
      previousFocus?.focus();
    };
  }, [modal]);

  function exportPayments() {
    const url = URL.createObjectURL(
      new Blob(["\uFEFF", paymentCsv(milestones, villa.priceTotalUsd)], {
        type: "text/csv;charset=utf-8",
      }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${villa.code.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-payment-ledger.csv`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setExportStatus("Your payment ledger has been exported.");
  }

  let body: ReactNode;
  if (page === "home") {
    const residenceSummary = [
      villa.builtM2 === null ? null : `${numberLabel(villa.builtM2)} m²`,
      villa.pricePackage ? humanLabel(villa.pricePackage) : villa.typeLabel,
      villa.outdoorM2 === null
        ? null
        : `${numberLabel(villa.outdoorM2)} m² outdoors`,
    ]
      .filter(Boolean)
      .join(" · ");
    body = (
      <>
        <Heading
          eyebrow="Welcome home"
          title="A little closer to Bali."
          description={`${buyerName ? `Welcome back, ${buyerName.split(/\s+/)[0]}.` : "Welcome back."} Here is the latest on your villa.`}
          action={
            <button
              type="button"
              className="btn light"
              onClick={() => setModal({ kind: "contact" })}
            >
              Contact your team ↗
            </button>
          }
        />
        <div className="dashboard-grid">
          <div className="villa-visual">
            <Photo
              src={images[0].src}
              alt="Illustrative contemporary pool villa, not a project photograph"
              priority
            />
            <div className="villa-caption">
              <p>YOUR RESIDENCE / {villa.projectName.toUpperCase()}</p>
              <h2>{villa.code}</h2>
              <p>{residenceSummary || "Your residence at a glance"}</p>
            </div>
          </div>
          <section className="panel">
            <div className="panel-title">
              <h3>Your villa at a glance</h3>
              <Badge>{humanLabel(villa.status)}</Badge>
            </div>
            <div className="metric-pair">
              <div>
                <span className="label">CONSTRUCTION</span>
                <div className="big">
                  {progress === null ? "—" : numberLabel(progress)}
                  {progress !== null && <span className="percent-unit">%</span>}
                </div>
                <ProgressBar
                  value={progress}
                  label="Physical construction progress"
                />
                <span className="fine">
                  {progress === null
                    ? "Awaiting construction records"
                    : "Physical build progress"}
                </span>
              </div>
              <div>
                <span className="label">PAYMENTS RECORDED</span>
                <div className="big">
                  {payments.percent === null
                    ? "—"
                    : numberLabel(payments.percent)}
                  {payments.percent !== null && (
                    <span className="percent-unit">%</span>
                  )}
                </div>
                <ProgressBar
                  value={payments.percent}
                  label="Recorded payment progress"
                  teak
                />
                <span className="fine">
                  {payments.paid === null
                    ? "Awaiting payment amounts"
                    : `${money(payments.paid)}${villa.priceTotalUsd === null ? " recorded" : ` of ${money(villa.priceTotalUsd)}`}`}
                </span>
              </div>
            </div>
            <div className="milestone-note">
              <span className="label">
                {currentTask
                  ? "NEXT CONSTRUCTION MILESTONE"
                  : "CONSTRUCTION MILESTONES"}
              </span>
              <h3 className="current-milestone">
                {currentTask?.phase ??
                  (tasks.length
                    ? "All milestones recorded complete"
                    : "Your journey is taking shape")}
              </h3>
              <p>
                {currentTask?.detail ??
                  (currentTask
                    ? "The next phase in your construction schedule."
                    : tasks.length
                      ? "View the recorded phases of your villa’s construction."
                      : "Your team will share the construction schedule here.")}
              </p>
              <Link className="btn light small" href={href("progress")}>
                View your progress →
              </Link>
            </div>
          </section>
        </div>
        <div className="lower-grid">
          <section className="panel">
            <div className="panel-title">
              <h3>From the atelier</h3>
              <Link href={href("updates")} className="text-link">
                All updates ↗
              </Link>
            </div>
            <UpdateList items={data.updates.slice(0, 2)} />
          </section>
          <section className="panel">
            <div className="panel-title">
              <h3>Always within reach</h3>
              <Link className="text-link" href={href("documents")}>
                All documents ↗
              </Link>
            </div>
            <DocumentList
              items={documents.slice(0, 4)}
              villaCode={villa.code}
              open={openDocument}
            />
            <div className="milestone-note row-between">
              <div>
                <span className="label">YOUR NEXT CHAPTER</span>
                <p className="handover-line">
                  Target handover · {dateLabel(villa.handoverExpected, true)}
                </p>
              </div>
              <span className="handover-arrow" aria-hidden="true">
                ↗
              </span>
            </div>
          </section>
        </div>
      </>
    );
  } else if (page === "villa") {
    const specification = documents.find((item) =>
      /specification/i.test(item.label ?? ""),
    );
    body = (
      <>
        <Heading
          eyebrow={`${villa.projectName} · ${villa.code}`}
          title="Your space, considered."
          description={
            villa.typeLabel
              ? `${villa.typeLabel}. Explore your residence, details and design inspiration.`
              : "Explore your residence, details and design inspiration."
          }
        />
        <div className="dashboard-grid">
          <section className="panel">
            <div className="panel-title">
              <h3>Explore the layout</h3>
              <span className="label">ILLUSTRATIVE CONCEPT</span>
            </div>
            <div
              className="tabs"
              role="tablist"
              aria-label="Illustrative floor plan"
              onKeyDown={(event) => {
                if (
                  !["ArrowLeft", "ArrowRight", "Home", "End"].includes(
                    event.key,
                  )
                )
                  return;
                event.preventDefault();
                const next =
                  event.key === "Home"
                    ? "ground"
                    : event.key === "End"
                      ? "upper"
                      : floor === "ground"
                        ? "upper"
                        : "ground";
                setFloor(next);
                event.currentTarget
                  .querySelector<HTMLButtonElement>(`[data-floor="${next}"]`)
                  ?.focus();
              }}
            >
              {(["ground", "upper"] as const).map((level) => (
                <button
                  type="button"
                  key={level}
                  id={`${floorId}-${level}`}
                  data-floor={level}
                  role="tab"
                  aria-selected={floor === level}
                  aria-controls={`${floorId}-plan`}
                  tabIndex={floor === level ? 0 : -1}
                  className={floor === level ? "active" : ""}
                  onClick={() => setFloor(level)}
                >
                  {level === "ground" ? "Ground floor" : "Upper floor"}
                </button>
              ))}
            </div>
            <div
              className="floorplan"
              id={`${floorId}-plan`}
              role="tabpanel"
              aria-labelledby={`${floorId}-${floor}`}
              tabIndex={0}
            >
              <FloorPlan upper={floor === "upper"} />
            </div>
            <p className="note">
              Concept illustration only; not your villa’s approved technical
              drawing. Refer to your project documents for confirmed dimensions.
            </p>
          </section>
          <section className="panel">
            <div className="eyebrow">Your selected package</div>
            <h2>
              {villa.pricePackage
                ? humanLabel(villa.pricePackage)
                : "Your residence"}
            </h2>
            <p className="package-description">
              {villa.typeLabel ??
                "The details of your villa, brought together in one place."}
            </p>
            <div className="material-list">
              <div>
                <span>Residence</span>
                <strong>{villa.code}</strong>
              </div>
              <div>
                <span>Built area</span>
                <strong>
                  <Area value={villa.builtM2} />
                </strong>
              </div>
              <div>
                <span>Outdoor space</span>
                <strong>
                  <Area value={villa.outdoorM2} />
                </strong>
              </div>
              <div>
                <span>Plot</span>
                <strong>
                  <Area value={villa.plotM2} />
                </strong>
              </div>
              {villa.leaseYears !== null && (
                <div>
                  <span>Lease term</span>
                  <strong>{villa.leaseYears} years</strong>
                </div>
              )}
              <div>
                <span>Target handover</span>
                <strong>{dateLabel(villa.handoverExpected, true)}</strong>
              </div>
            </div>
            <div className="specification-action">
              {specification ? (
                <button
                  type="button"
                  className="btn light"
                  onClick={() => openDocument(specification)}
                >
                  View specification ↗
                </button>
              ) : (
                <Link href={href("documents")} className="btn light">
                  View your documents ↗
                </Link>
              )}
            </div>
          </section>
        </div>
        <div className="gallery design-gallery">
          {images.map((item) => (
            <button
              type="button"
              key={item.src}
              onClick={() =>
                setModal({ kind: "photo", ...item, illustrative: true })
              }
            >
              <Photo
                src={item.src}
                alt={`${item.label} — illustrative design inspiration`}
              />
              <p>{item.label} ↗</p>
            </button>
          ))}
        </div>
        {photos.length > 0 && (
          <section className="panel project-photos">
            <div className="panel-title">
              <h3>From your site</h3>
              <span className="label">SHARED BY YOUR TEAM</span>
            </div>
            <div className="gallery">
              {photos.map((item) => {
                const url = safeDocumentUrl(item.url);
                return (
                  <div key={item.id}>
                    {url ? (
                      <button
                        type="button"
                        onClick={() =>
                          setModal({
                            kind: "photo",
                            src: url,
                            label: item.label ?? "Project photograph",
                            illustrative: false,
                          })
                        }
                      >
                        <Photo
                          src={url}
                          alt={
                            item.label ??
                            "Photograph shared by your project team"
                          }
                        />
                        <p>{item.label ?? "Project photograph"} ↗</p>
                      </button>
                    ) : (
                      <div className="empty">
                        <p>{item.label ?? "Project photograph"}</p>
                        <span className="fine">Photo not yet available</span>
                      </div>
                    )}
                    <p className="fine">
                      {dateLabel(item.createdAt)}
                      {item.note ? ` · ${item.note}` : ""}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </>
    );
  } else if (page === "progress") {
    body = (
      <>
        <Heading
          eyebrow="Your journey"
          title="Built, step by step."
          description="A clear view of what is complete and what comes next."
        />
        <section className="panel">
          <div className="row-between">
            <h3>Construction journey</h3>
            <Badge>
              {progress === null
                ? "Awaiting schedule"
                : `${numberLabel(progress)}% complete`}
            </Badge>
          </div>
          <ProgressBar value={progress} label="Overall construction progress" />
          {tasks.length ? (
            <div className="timeline">
              {tasks.map((task, index) => (
                <div
                  className={`timeline-item ${task.doneAt ? "done" : ""}`}
                  key={task.id}
                >
                  <span className="timeline-number" aria-hidden="true">
                    {task.doneAt ? "✓" : index + 1}
                  </span>
                  <div>
                    <h3>{task.phase}</h3>
                    <p>
                      {task.detail ??
                        (task.doneAt
                          ? `Recorded complete · ${dateLabel(task.doneAt)}`
                          : task.period
                            ? `Planned period · ${task.period}`
                            : "Scheduled after the preceding milestone")}
                    </p>
                    {task.detail && (
                      <p className="fine">
                        {task.doneAt
                          ? `Recorded complete · ${dateLabel(task.doneAt)}`
                          : task.period
                            ? `Planned period · ${task.period}`
                            : `${numberLabel(task.percentWeight)}% of the construction schedule`}
                      </p>
                    )}
                  </div>
                  <Badge
                    tone={
                      task.doneAt
                        ? ""
                        : task.id === currentTask?.id
                          ? "amber"
                          : "neutral"
                    }
                  >
                    {task.doneAt
                      ? "Complete"
                      : task.id === currentTask?.id
                        ? "Next milestone"
                        : "Upcoming"}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <Empty>Your construction schedule has not been shared yet.</Empty>
          )}
        </section>
      </>
    );
  } else if (page === "payments") {
    body = (
      <>
        <Heading
          eyebrow="Your payment schedule"
          title="Every payment, in view."
          description={`${villa.priceTotalUsd === null ? "Agreement value to be confirmed." : `Agreement value: ${money(villa.priceTotalUsd)} USD.`} Payment records and build progress are shown separately.`}
        />
        <div className="metrics payment-metrics">
          {[
            [
              "Recorded paid",
              money(payments.paid),
              milestones.length
                ? `Across ${payments.paidCount} ${payments.paidCount === 1 ? "milestone" : "milestones"}`
                : "Awaiting payment records",
            ],
            [
              "Remaining",
              money(payments.remaining),
              "According to your agreement",
            ],
            [
              "Next instalment",
              payments.next
                ? money(milestoneAmount(payments.next, villa.priceTotalUsd))
                : milestones.length
                  ? "All recorded"
                  : "Not available",
              payments.next?.dueLabel ??
                (milestones.length
                  ? "No outstanding instalments"
                  : "Awaiting payment schedule"),
            ],
          ].map(([label, amount, detail]) => (
            <div className="panel" key={label}>
              <span className="label">{label}</span>
              <div className="big">{amount}</div>
              <p>{detail}</p>
            </div>
          ))}
        </div>
        <section className="panel">
          <div className="panel-title">
            <h3>Milestone ledger</h3>
            <button
              type="button"
              className="btn light small"
              disabled={!milestones.length}
              onClick={exportPayments}
            >
              Export CSV ↓
            </button>
          </div>
          {milestones.length ? (
            <div
              className="table-wrap"
              role="region"
              aria-label="Payment milestone ledger; scroll horizontally to see all columns"
              tabIndex={0}
            >
              <table>
                <thead>
                  <tr>
                    <th scope="col">Milestone</th>
                    <th scope="col">Share</th>
                    <th scope="col">Amount</th>
                    <th scope="col">Status</th>
                    <th scope="col">Record</th>
                  </tr>
                </thead>
                <tbody>
                  {milestones.map((item, index) => (
                    <tr key={item.id}>
                      <td>
                        <span className="ledger-sequence">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        {item.dueLabel}
                      </td>
                      <td>{numberLabel(item.percent)}%</td>
                      <td className="ledger-amount">
                        {money(milestoneAmount(item, villa.priceTotalUsd))}
                      </td>
                      <td>
                        <Badge
                          tone={
                            item.status === "paid"
                              ? ""
                              : item.id === payments.next?.id
                                ? "amber"
                                : "neutral"
                          }
                        >
                          {item.status === "paid"
                            ? "Paid"
                            : item.id === payments.next?.id
                              ? "Upcoming"
                              : "Scheduled"}
                        </Badge>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="text-link"
                          onClick={() =>
                            setModal({ kind: "payment", id: item.id })
                          }
                          aria-label={`View payment record: ${item.dueLabel}`}
                        >
                          View ↗
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>Your payment schedule has not been shared yet.</Empty>
          )}
          <p className="note">
            A recorded payment is independent of technical inspection approval;
            no transfer is initiated here. Where a recorded amount is
            unavailable, the amount is calculated from the agreement value and
            milestone share.
          </p>
          <p className="visually-hidden" role="status">
            {exportStatus}
          </p>
        </section>
      </>
    );
  } else if (page === "documents") {
    body = (
      <>
        <Heading
          eyebrow="Your records"
          title="Everything in its place."
          description="The latest project documents, organized for you."
        />
        <section className="panel">
          <DocumentList
            items={documents}
            villaCode={villa.code}
            open={openDocument}
          />
        </section>
      </>
    );
  } else {
    body = (
      <>
        <Heading
          eyebrow="From your site team"
          title="The story so far."
          description="A regular view into your villa’s progress and design."
        />
        <section className="panel">
          <UpdateList items={data.updates} />
        </section>
      </>
    );
  }

  return (
    <div className="client-platform">
      <a href="#client-main" className="skip-link">
        Skip to content
      </a>
      <div className="shell">
        <aside className="sidebar">
          <Link
            className="brand"
            href={href("home")}
            aria-label="Van der Tweel owner platform home"
          >
            <span className="mark" aria-hidden="true" />
            <span>
              <strong>Van der Tweel</strong>
              <small>Bali · Development atelier</small>
            </span>
          </Link>
          <div className="workspace-label">
            <small>YOUR RESIDENCE</small>
            {villa.projectName} · {villa.code}
          </div>
          <nav
            ref={ownerNavigation}
            className="side-nav"
            aria-label="Owner navigation"
          >
            {navigation.map((item) => (
              <Link
                key={item.page}
                href={href(item.page)}
                className={page === item.page ? "active" : ""}
                aria-current={page === item.page ? "page" : undefined}
              >
                <span className="nav-icon" aria-hidden="true">
                  {item.icon}
                </span>
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="side-bottom">
            <div className="person">
              <span className="avatar" aria-hidden="true">
                {initials}
              </span>
              <span>
                {buyerName ?? "Owner"}
                <small>Owner · {villa.code}</small>
              </span>
            </div>
          </div>
        </aside>
        <main className="main" id="client-main">
          <div className="topbar">
            <span>Owner platform &nbsp; / &nbsp; {villa.projectName}</span>
            <span className="topbar-residence">
              {villa.code}
              <Badge>Owner workspace</Badge>
            </span>
          </div>
          <div className="content">
            {body}
            <p className="note">
              Your private owner platform · Construction, payments and records
              are shared by your project team.
              {["home", "villa", "updates"].includes(page)
                ? " Design photography and concept layouts are illustrative, not project records."
                : ""}
            </p>
          </div>
        </main>
      </div>
      <dialog
        ref={dialog}
        aria-labelledby={dialogTitle}
        onClose={() => setModal(null)}
        onClick={(event) => {
          if (event.target !== event.currentTarget) return;
          const rect = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          )
            event.currentTarget.close();
        }}
      >
        <button
          type="button"
          className="close"
          aria-label="Close dialog"
          onClick={() => dialog.current?.close()}
        >
          ×
        </button>
        {modal?.kind === "contact" && (
          <>
            <div className="eyebrow">Your atelier team</div>
            <h2 id={dialogTitle}>A personal connection.</h2>
            <p>
              Please use your existing contact with the development team for
              questions about {villa.code}.
            </p>
            <div className="task">
              <strong>Your project, in one place</strong>
              <p>
                Construction updates, payment records and documents shared by
                your team appear in this owner platform.
              </p>
            </div>
            <p className="note">
              Messaging is not available in the owner platform.
            </p>
          </>
        )}
        {modal?.kind === "document" &&
          (modalDocument ? (
            <>
              <div className="eyebrow">Your project archive</div>
              <h2 id={dialogTitle}>
                {modalDocument.label ?? "Project document"}
              </h2>
              <div className="modal-data">
                <p>
                  <span>Project</span>
                  <strong>{villa.projectName}</strong>
                </p>
                <p>
                  <span>Residence</span>
                  <strong>{villa.code}</strong>
                </p>
                <p>
                  <span>Shared</span>
                  <strong>{dateLabel(modalDocument.createdAt)}</strong>
                </p>
              </div>
              {modalDocument.note && (
                <p className="record-note">{modalDocument.note}</p>
              )}
              {safeDocumentUrl(modalDocument.url) ? (
                <a
                  className="btn light modal-action"
                  href={safeDocumentUrl(modalDocument.url)!}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open document ↗
                  <span className="visually-hidden"> in a new tab</span>
                </a>
              ) : (
                <p className="note">
                  The document file is not yet available. Please contact your
                  team for the latest copy.
                </p>
              )}
            </>
          ) : (
            <>
              <h2 id={dialogTitle}>Document unavailable</h2>
              <p>
                This record is no longer available. Please check with your team.
              </p>
            </>
          ))}
        {modal?.kind === "payment" &&
          (modalPayment ? (
            <>
              <div className="eyebrow">Your payment record</div>
              <h2 id={dialogTitle}>{modalPayment.dueLabel}</h2>
              <div className="modal-data">
                <p>
                  <span>Residence</span>
                  <strong>{villa.code}</strong>
                </p>
                <p>
                  <span>Amount</span>
                  <strong>
                    {money(milestoneAmount(modalPayment, villa.priceTotalUsd))}
                  </strong>
                </p>
                <p>
                  <span>Share of agreement</span>
                  <strong>{numberLabel(modalPayment.percent)}%</strong>
                </p>
                <p>
                  <span>Status</span>
                  <strong>
                    {modalPayment.status === "paid"
                      ? "Recorded paid"
                      : "Not yet recorded"}
                  </strong>
                </p>
                {modalPayment.paidAt && (
                  <p>
                    <span>Recorded paid</span>
                    <strong>{dateLabel(modalPayment.paidAt)}</strong>
                  </p>
                )}
                {modalPayment.expectedAt && (
                  <p>
                    <span>Expected date</span>
                    <strong>{dateLabel(modalPayment.expectedAt)}</strong>
                  </p>
                )}
              </div>
              {modalPayment.note && (
                <p className="record-note">{modalPayment.note}</p>
              )}
              <p className="note">
                This is a ledger record, not a payable invoice. No transfer is
                initiated here.
                {modalPayment.amountUsd === null && villa.priceTotalUsd !== null
                  ? " The displayed amount is calculated from the agreement value and milestone share."
                  : ""}
              </p>
            </>
          ) : (
            <>
              <h2 id={dialogTitle}>Payment record unavailable</h2>
              <p>
                This record is no longer available. Please check with your team.
              </p>
            </>
          ))}
        {modal?.kind === "photo" && (
          <>
            <h2 id={dialogTitle}>{modal.label}</h2>
            <Photo key={modal.src} src={modal.src} alt={modal.label} priority />
            <p className="note">
              {modal.illustrative
                ? "Illustrative photography · Design inspiration, not a photograph of the project."
                : `Project photography · ${villa.code} · Shared by your team.`}
            </p>
          </>
        )}
      </dialog>
    </div>
  );
}
