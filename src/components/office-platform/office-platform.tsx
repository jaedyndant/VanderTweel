"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  dateLabel,
  humanLabel,
  money,
  numberLabel,
  officeHref,
  paymentAmount,
  paymentCsv,
  paymentTotals,
  safeFileUrl,
  villaHref,
} from "./presentation";
import type {
  OfficeActionHandlers,
  OfficeActionResult,
  OfficeFile,
  OfficePage,
  OfficePlatformData,
  OfficeTask,
  OfficeUpdate,
  OfficeVilla,
  PublishUpdateInput,
} from "./types";
import "./office-platform.css";

type Modal =
  | { kind: "villa"; id: string }
  | { kind: "payment"; id: string }
  | { kind: "payment-confirm"; id: string; expected: boolean }
  | { kind: "progress-confirm"; id: string; expected: boolean }
  | { kind: "update"; id: string }
  | { kind: "file"; id: string }
  | { kind: "publish" }
  | { kind: "add-file" };

const navigation: {
  page: OfficePage;
  label: string;
  icon: string;
  developerOnly?: boolean;
}[] = [
  { page: "overview", label: "Overview", icon: "overview" },
  { page: "villas", label: "Villas", icon: "villa" },
  { page: "buyers", label: "Clients", icon: "people", developerOnly: true },
  { page: "payments", label: "Payments", icon: "payment", developerOnly: true },
  { page: "updates", label: "Site updates", icon: "clock" },
  { page: "documents", label: "Documents", icon: "file", developerOnly: true },
];

function Icon({ name }: { name: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {name === "overview" ? (
        <>
          <rect x="4" y="4" width="16" height="16" rx="1" />
          <path d="M10 4v16" />
        </>
      ) : name === "villa" ? (
        <>
          <path d="m3 15 5-8h13l-5 8H3Z" />
          <path d="M7 16v3h10v-3" />
        </>
      ) : name === "people" ? (
        <>
          <circle cx="12" cy="7" r="3" />
          <path d="M6 20v-3a6 6 0 0 1 12 0v3H6Z" />
        </>
      ) : name === "clock" ? (
        <>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 6v6l4 2" />
        </>
      ) : name === "file" ? (
        <>
          <path d="M6 3h9l4 4v14H6V3Z" />
          <path d="M14 3v5h5M9 12h7M9 16h7" />
        </>
      ) : (
        <>
          <rect x="4" y="4" width="16" height="16" rx="1" />
          <path d="M4 9h16M8 13h3M8 17h8" />
        </>
      )}
    </svg>
  );
}

function Badge({
  children,
  tone = "green",
}: {
  children: ReactNode;
  tone?: "green" | "amber" | "neutral";
}) {
  return <span className={`op-badge op-badge-${tone}`}>{children}</span>;
}

function Progress({ value, label }: { value: number | null; label: string }) {
  const bounded = value === null ? 0 : Math.max(0, Math.min(100, value));
  return (
    <div
      className="op-progress"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value === null ? undefined : bounded}
      aria-valuetext={
        value === null ? "Not available" : `${numberLabel(bounded)}%`
      }
    >
      <span style={{ width: `${bounded}%` }} />
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
    <header className="op-heading">
      <div>
        <div className="op-eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </header>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="op-empty">{children}</p>;
}

function Metric({
  title,
  value,
  detail,
}: {
  title: string;
  value: ReactNode;
  detail: string;
}) {
  return (
    <div className="op-panel op-metric">
      <div className="op-metric-label">{title}</div>
      <div className="op-metric-value">{value}</div>
      <small>{detail}</small>
    </div>
  );
}

function PanelTitle({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="op-panel-title">
      <h2>{title}</h2>
      {children}
    </div>
  );
}

function Metadata({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="op-metadata">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Dialog({
  children,
  close,
  busy,
  titleId,
}: {
  children: ReactNode;
  close: () => void;
  busy: boolean;
  titleId: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    if (element && !element.open) element.showModal();
    return () => {
      if (element?.open) element.close();
      // Restore before React removes the dialog. Passive-effect cleanup runs
      // too late for native focus restoration when the dialog is unmounted.
      // A keyed detail → confirmation transition also hands this focus target
      // to the next dialog without leaving focus on a removed dialog button.
      if (
        previousFocus?.isConnected &&
        previousFocus.getClientRects().length > 0 &&
        getComputedStyle(previousFocus).visibility === "visible" &&
        !previousFocus.closest("[hidden], [inert]") &&
        !previousFocus.matches(":disabled") &&
        !document.querySelector("dialog[open]")
      ) {
        previousFocus.focus({ preventScroll: true });
      }
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="op-dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) close();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) close();
      }}
    >
      <button
        type="button"
        className="op-close"
        aria-label="Close dialog"
        disabled={busy}
        onClick={close}
      >
        ×
      </button>
      {children}
    </dialog>
  );
}

function VillaTable({
  villas,
  tasks,
  open,
}: {
  villas: OfficeVilla[];
  tasks: OfficeTask[];
  open: (id: string) => void;
}) {
  if (!villas.length) return <Empty>No residences match this selection.</Empty>;
  const nextTasks = new Map<string, OfficeTask>();
  for (const task of tasks)
    if (!task.doneAt && !nextTasks.has(task.villaId))
      nextTasks.set(task.villaId, task);
  return (
    <div
      className="op-table-wrap"
      tabIndex={0}
      role="region"
      aria-label="Residence overview"
    >
      <table className="op-table op-villa-table">
        <thead>
          <tr>
            <th scope="col">Residence / owner</th>
            <th scope="col">Build progress</th>
            <th scope="col">Status</th>
            <th scope="col">Current focus</th>
            <th scope="col">
              <span className="op-sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {villas.map((villa) => {
            const task = nextTasks.get(villa.id);
            return (
              <tr key={villa.id}>
                <td>
                  <button
                    type="button"
                    className="op-text-link"
                    onClick={() => open(villa.id)}
                  >
                    {villa.code} ↗
                  </button>
                  <small>{villa.buyerName ?? "No owner assigned"}</small>
                </td>
                <td>
                  <span>
                    {villa.progressPercent === null
                      ? "Not available"
                      : `${numberLabel(villa.progressPercent)}%`}
                  </span>
                  <Progress
                    value={villa.progressPercent}
                    label={`${villa.code} build progress`}
                  />
                </td>
                <td>
                  <Badge
                    tone={
                      ["completed", "complete", "sold"].includes(villa.status)
                        ? "green"
                        : "neutral"
                    }
                  >
                    {humanLabel(villa.status)}
                  </Badge>
                </td>
                <td>
                  {task?.phase ??
                    (villa.progressPercent === 100
                      ? "All recorded tasks complete"
                      : "No open task recorded")}
                  <small>{task?.period ?? villa.projectName}</small>
                </td>
                <td>
                  <button
                    className="op-btn op-btn-light op-btn-small"
                    type="button"
                    onClick={() => open(villa.id)}
                    aria-label={`Open ${villa.code}`}
                  >
                    Open →
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function UpdateList({
  updates,
  open,
  compact = false,
}: {
  updates: OfficeUpdate[];
  open: (id: string) => void;
  compact?: boolean;
}) {
  if (!updates.length)
    return (
      <Empty>No site updates have been published in this selection.</Empty>
    );
  return (
    <div
      className={
        compact ? "op-update-list op-update-list-compact" : "op-update-list"
      }
    >
      {updates.map((update) => (
        <article className="op-update" key={update.id}>
          <div className="op-update-mark" aria-hidden="true">
            <Icon name="clock" />
          </div>
          <div>
            <small>
              {dateLabel(update.createdAt)} ·{" "}
              {update.authorRoleLabel ?? "Site team"} · {update.villaCode}
              {update.category ? ` · ${update.category}` : ""}
            </small>
            <h3>
              <button type="button" onClick={() => open(update.id)}>
                {update.title ?? "A note from the site"}
              </button>
            </h3>
            <p>{update.body}</p>
          </div>
        </article>
      ))}
    </div>
  );
}

function FileList({
  files,
  open,
}: {
  files: OfficeFile[];
  open: (id: string) => void;
}) {
  if (!files.length)
    return <Empty>No files have been shared in this selection.</Empty>;
  return (
    <div>
      {files.map((file) => (
        <div className="op-file" key={file.id}>
          <span className="op-file-icon" aria-hidden="true">
            {file.kind === "photo" ? "IMG" : "DOC"}
          </span>
          <div className="op-file-copy">
            <strong>
              {file.label ??
                (file.kind === "photo"
                  ? "Site photograph"
                  : "Project document")}
            </strong>
            <small>
              {file.villaCode} · {dateLabel(file.createdAt)}
            </small>
          </div>
          <button
            type="button"
            className="op-text-link"
            onClick={() => open(file.id)}
            aria-label={`View ${file.label ?? "file"}`}
          >
            View ↗
          </button>
        </div>
      ))}
    </div>
  );
}

function ResidenceFilter({
  villas,
  value,
  onChange,
  label = "Residence",
}: {
  villas: OfficeVilla[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
}) {
  const id = useId();
  return (
    <div className="op-inline-field">
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">All residences</option>
        {villas.map((villa) => (
          <option value={villa.id} key={villa.id}>
            {villa.code} · {villa.projectName}
          </option>
        ))}
      </select>
    </div>
  );
}

type RunAction = (
  action: () => Promise<OfficeActionResult>,
  message: string,
) => Promise<boolean>;

function PublishForm({
  data,
  actions,
  run,
  busy,
  error,
  titleId,
  initialVillaId,
}: {
  data: OfficePlatformData;
  actions: OfficeActionHandlers;
  run: RunAction;
  busy: boolean;
  error: string | null;
  titleId: string;
  initialVillaId: string;
}) {
  const id = useId();
  const [villaId, setVillaId] = useState(initialVillaId);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] =
    useState<PublishUpdateInput["category"]>("Construction");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const villa = data.villas.find((item) => item.id === villaId);
    if (!villa || busy) return;
    await run(
      () =>
        actions.publishUpdate({
          villaId: villa.id,
          villaCode: villa.code,
          projectId: villa.projectId,
          title,
          body,
          category,
        }),
      "Site update published.",
    );
  }
  return (
    <>
      <div className="op-eyebrow">Owner update</div>
      <h2 id={titleId}>A note from the site.</h2>
      <p>Share a clear update with the owners of the selected residence.</p>
      <form onSubmit={submit} aria-busy={busy}>
        <fieldset disabled={busy}>
          <label htmlFor={`${id}-villa`}>Residence</label>
          <select
            id={`${id}-villa`}
            required
            value={villaId}
            onChange={(event) => setVillaId(event.target.value)}
          >
            {data.villas.map((villa) => (
              <option key={villa.id} value={villa.id}>
                {villa.code} · {villa.projectName}
              </option>
            ))}
          </select>
          <label htmlFor={`${id}-category`}>Category</label>
          <select
            id={`${id}-category`}
            value={category}
            onChange={(event) =>
              setCategory(event.target.value as PublishUpdateInput["category"])
            }
          >
            <option>Construction</option>
            {data.role === "developer" ? (
              <>
                <option>Payment</option>
                <option>Paperwork</option>
              </>
            ) : null}
          </select>
          <label htmlFor={`${id}-title`}>Update title</label>
          <input
            id={`${id}-title`}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
            maxLength={100}
            placeholder="Roof slab preparation complete"
          />
          <label htmlFor={`${id}-body`}>What has changed?</label>
          <textarea
            id={`${id}-body`}
            required
            maxLength={1500}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Share a clear, helpful progress update…"
          />
          <p className="op-form-hint">
            The saved update appears in the linked client platform. Email
            delivery is handled separately.
          </p>
          {error ? (
            <p className="op-form-error" role="alert">
              {error}
            </p>
          ) : null}
          <button
            className="op-btn op-submit"
            disabled={!villaId || busy}
            type="submit"
          >
            {busy ? "Publishing…" : "Publish site update →"}
          </button>
        </fieldset>
      </form>
    </>
  );
}

function FileForm({
  data,
  actions,
  run,
  busy,
  error,
  titleId,
  initialVillaId,
}: {
  data: OfficePlatformData;
  actions: OfficeActionHandlers;
  run: RunAction;
  busy: boolean;
  error: string | null;
  titleId: string;
  initialVillaId: string;
}) {
  const id = useId();
  const [villaId, setVillaId] = useState(initialVillaId);
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [kind, setKind] = useState<"photo" | "doc">("doc");
  const [urlError, setUrlError] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const villa = data.villas.find((item) => item.id === villaId);
    if (!villa || busy) return;
    if (!safeFileUrl(url)) {
      setUrlError(
        "Enter a complete HTTP or HTTPS file link without embedded login details or a placeholder domain.",
      );
      return;
    }
    setUrlError(null);
    await run(
      () =>
        actions.addFileLink({
          villaId: villa.id,
          villaCode: villa.code,
          projectId: villa.projectId,
          label,
          url,
          note,
          kind,
        }),
      "File link shared with this residence.",
    );
  }
  return (
    <>
      <div className="op-eyebrow">Project archive</div>
      <h2 id={titleId}>Share a file link.</h2>
      <p>
        Add a link to an existing document or site photograph. This does not
        upload a file.
      </p>
      <form onSubmit={submit} aria-busy={busy}>
        <fieldset disabled={busy}>
          <label htmlFor={`${id}-villa`}>Residence</label>
          <select
            id={`${id}-villa`}
            required
            value={villaId}
            onChange={(event) => setVillaId(event.target.value)}
          >
            {data.villas.map((villa) => (
              <option key={villa.id} value={villa.id}>
                {villa.code} · {villa.projectName}
              </option>
            ))}
          </select>
          <label htmlFor={`${id}-kind`}>File type</label>
          <select
            id={`${id}-kind`}
            value={kind}
            onChange={(event) => setKind(event.target.value as "photo" | "doc")}
          >
            <option value="doc">Document</option>
            <option value="photo">Site photograph</option>
          </select>
          <label htmlFor={`${id}-label`}>Title</label>
          <input
            id={`${id}-label`}
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            required
            maxLength={180}
          />
          <label htmlFor={`${id}-url`}>File URL</label>
          <input
            id={`${id}-url`}
            type="url"
            value={url}
            onChange={(event) => {
              setUrl(event.target.value);
              setUrlError(null);
            }}
            required
            maxLength={2000}
            placeholder="https://…"
            aria-invalid={!!urlError}
            aria-describedby={`${id}-url-hint`}
          />
          <p id={`${id}-url-hint`} className="op-form-hint">
            Use an HTTP(S) link that the intended owners can access.
          </p>
          <label htmlFor={`${id}-note`}>
            Note <span className="op-muted">(optional)</span>
          </label>
          <textarea
            id={`${id}-note`}
            maxLength={1500}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
          {urlError || error ? (
            <p className="op-form-error" role="alert">
              {urlError ?? error}
            </p>
          ) : null}
          <button
            className="op-btn op-submit"
            disabled={!villaId || busy}
            type="submit"
          >
            {busy ? "Saving…" : "Share file link →"}
          </button>
        </fieldset>
      </form>
    </>
  );
}

export function OfficePlatform({
  data,
  actions,
}: {
  data: OfficePlatformData;
  actions: OfficeActionHandlers;
}) {
  const router = useRouter();
  const [modal, setModal] = useState<Modal | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [villaFilter, setVillaFilter] = useState("");
  const [villaStatus, setVillaStatus] = useState("all");
  const [paymentStatus, setPaymentStatus] = useState("all");
  const [fileKind, setFileKind] = useState("all");
  const busyRef = useRef(false);
  const titleId = useId();
  const projectId = data.selection.projectId;
  const selectedVilla = data.villas.find(
    (villa) => villa.id === data.selection.villaId,
  );
  const project = data.projects.find((item) => item.id === projectId);
  const context = selectedVilla
    ? `${selectedVilla.projectName} · ${selectedVilla.code}`
    : (project?.name ??
      (data.projects.length === 1
        ? data.projects[0].name
        : "All developments"));
  const allowedNavigation = navigation.filter(
    (item) => !item.developerOnly || data.role === "developer",
  );
  const activePage = ["villa", "progress"].includes(data.page)
    ? "villas"
    : data.page === "project"
      ? "overview"
      : data.page;

  useEffect(() => {
    setModal(null);
    setError(null);
    setNotice(null);
    setSearch("");
    setVillaFilter("");
    setVillaStatus("all");
    setPaymentStatus("all");
    setFileKind("all");
  }, [data.page, data.selection.projectId, data.selection.villaId]);

  function open(next: Modal) {
    setError(null);
    setModal(next);
  }
  function close() {
    if (!busyRef.current) {
      setModal(null);
      setError(null);
    }
  }
  async function run(
    action: () => Promise<OfficeActionResult>,
    message: string,
  ) {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await action();
      if (!result.ok) {
        setError(
          result.error ?? "This change could not be saved. Please try again.",
        );
        return false;
      }
      setModal(null);
      setNotice(message);
      router.refresh();
      return true;
    } catch {
      setError(
        "This change could not be confirmed. Refresh to check its status before trying again.",
      );
      return false;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  const publishButton = (
    <button
      className="op-btn"
      type="button"
      disabled={!data.villas.length}
      onClick={() => open({ kind: "publish" })}
    >
      New site update +
    </button>
  );
  const availableVillas = data.villas.filter(
    (villa) => !villaFilter || villa.id === villaFilter,
  );
  const openTaskVillaIds = new Set(
    data.tasks.filter((task) => !task.doneAt).map((task) => task.villaId),
  );
  const filteredVillas = availableVillas.filter(
    (villa) =>
      `${villa.code} ${villa.buyerName ?? ""} ${villa.projectName}`
        .toLowerCase()
        .includes(search.trim().toLowerCase()) &&
      (villaStatus === "all" ||
        (villaStatus === "active"
          ? openTaskVillaIds.has(villa.id)
          : villa.status === villaStatus)),
  );
  const payments = (data.payments ?? []).filter(
    (payment) => !villaFilter || payment.villaId === villaFilter,
  );
  const visiblePayments = payments.filter(
    (payment) =>
      paymentStatus === "all" ||
      (paymentStatus === "paid"
        ? payment.status === "paid"
        : payment.status !== "paid"),
  );
  const updates = data.updates.filter(
    (update) => !villaFilter || update.villaId === villaFilter,
  );
  const files = (data.files ?? []).filter(
    (file) =>
      (!villaFilter || file.villaId === villaFilter) &&
      (fileKind === "all" || file.kind === fileKind),
  );
  const financials = paymentTotals(payments, data.villas);
  const tasks = data.tasks.filter(
    (task) => !villaFilter || task.villaId === villaFilter,
  );
  const pendingTasks = tasks.filter((task) => !task.doneAt);
  const progress =
    data.villas.length &&
    data.villas.every((villa) => villa.progressPercent !== null)
      ? data.villas.reduce(
          (sum, villa) => sum + (villa.progressPercent ?? 0),
          0,
        ) / data.villas.length
      : null;
  const handovers = data.villas
    .map((villa) => villa.handoverExpected)
    .filter((value): value is string => !!value)
    .sort();
  function exportPayments() {
    const url = URL.createObjectURL(
      new Blob(["\uFEFF", paymentCsv(visiblePayments, data.villas)], {
        type: "text/csv;charset=utf-8",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "van-der-tweel-payment-ledger.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function projectSelection(value: string) {
    router.push(
      officeHref(
        ["villa", "progress", "project"].includes(data.page) ||
          data.selection.villaId
          ? "overview"
          : data.page,
        value || null,
      ),
    );
  }
  const filterControl =
    !data.selection.villaId && data.villas.length > 1 ? (
      <ResidenceFilter
        villas={data.villas}
        value={villaFilter}
        onChange={setVillaFilter}
      />
    ) : null;
  const jumpLinks = selectedVilla ? (
    <nav
      className="op-villa-links"
      aria-label={`${selectedVilla.code} sections`}
    >
      <Link
        className={data.page === "villa" ? "is-active" : ""}
        href={villaHref(selectedVilla)}
      >
        Residence
      </Link>
      <Link
        className={data.page === "progress" ? "is-active" : ""}
        href={villaHref(selectedVilla, "voortgang")}
      >
        Progress
      </Link>
      {data.role === "developer" ? (
        <Link
          className={data.page === "payments" ? "is-active" : ""}
          href={villaHref(selectedVilla, "betalingen")}
        >
          Payments
        </Link>
      ) : null}
      <Link
        className={data.page === "updates" ? "is-active" : ""}
        href={villaHref(selectedVilla, "updates")}
      >
        {data.role === "pm" ? "Your updates" : "Updates"}
      </Link>
      {data.role === "developer" ? (
        <Link
          className={data.page === "documents" ? "is-active" : ""}
          href={villaHref(selectedVilla, "bestanden")}
        >
          Documents
        </Link>
      ) : null}
    </nav>
  ) : null;

  let content: ReactNode;
  if (data.page === "overview" || data.page === "project") {
    content = (
      <>
        <Heading
          eyebrow="Estate overview"
          title="A clear view of the whole."
          description={`${context} · Every residence, one considered view.`}
          action={publishButton}
        />
        <div className="op-metrics">
          <Metric
            title="Residences"
            value={String(data.villas.length).padStart(2, "0")}
            detail={project?.name ?? "Within your access"}
          />
          <Metric
            title="Build progress"
            value={progress === null ? "—" : `${numberLabel(progress)}%`}
            detail={
              progress === null
                ? "Progress not yet available for every residence"
                : "Average across these residences"
            }
          />
          <Metric
            title="Open tasks"
            value={String(pendingTasks.length).padStart(2, "0")}
            detail="Recorded construction tasks"
          />
          <Metric
            title="Target handover"
            value={handovers.length ? dateLabel(handovers[0], true) : "—"}
            detail={
              handovers.length
                ? "Next recorded target"
                : "Dates to be confirmed"
            }
          />
        </div>
        <section className="op-panel">
          <PanelTitle title="Estate at a glance">
            <Link
              className="op-text-link"
              href={officeHref("villas", projectId)}
            >
              Manage villas ↗
            </Link>
          </PanelTitle>
          <VillaTable
            villas={data.villas}
            tasks={data.tasks}
            open={(id) => open({ kind: "villa", id })}
          />
        </section>
        <div className="op-lower-grid">
          <section className="op-panel">
            <PanelTitle title="Next actions">
              <Badge tone="neutral">{pendingTasks.length} open</Badge>
            </PanelTitle>
            {pendingTasks.length ? (
              pendingTasks.slice(0, 3).map((task) => {
                const villa = data.villas.find(
                  (item) => item.id === task.villaId,
                );
                return (
                  <article className="op-task-preview" key={task.id}>
                    <strong>
                      {task.villaCode} · {task.phase}
                    </strong>
                    <p>
                      {task.detail ??
                        "Review the recorded construction task and update its completion when the work is finished."}
                    </p>
                    {villa ? (
                      <Link
                        className="op-text-link"
                        href={villaHref(villa, "voortgang")}
                      >
                        Open task details →
                      </Link>
                    ) : null}
                  </article>
                );
              })
            ) : (
              <Empty>No open construction tasks are recorded.</Empty>
            )}
          </section>
          <section className="op-panel">
            <PanelTitle
              title={
                data.role === "pm" ? "Your latest updates" : "Latest activity"
              }
            >
              <Link
                className="op-text-link"
                href={officeHref("updates", projectId)}
              >
                View updates ↗
              </Link>
            </PanelTitle>
            <UpdateList
              updates={data.updates.slice(0, 3)}
              open={(id) => open({ kind: "update", id })}
              compact
            />
          </section>
        </div>
      </>
    );
  } else if (data.page === "villas") {
    content = (
      <>
        <Heading
          eyebrow="Estate management"
          title="Every villa. Every detail."
          description="Find a residence or owner and open the latest project records."
        />
        <div className="op-filter-row">
          <div
            className="op-filter-buttons"
            role="group"
            aria-label="Residence status"
          >
            <button
              type="button"
              className={villaStatus === "all" ? "is-active" : ""}
              onClick={() => setVillaStatus("all")}
            >
              All villas · {data.villas.length}
            </button>
            <button
              type="button"
              className={villaStatus === "active" ? "is-active" : ""}
              onClick={() => setVillaStatus("active")}
            >
              Open tasks · {openTaskVillaIds.size}
            </button>
          </div>
          <label className="op-search">
            <span className="op-sr-only">Search villas or owners</span>
            <input
              type="search"
              placeholder="Search villa or owner…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
        </div>
        <section className="op-panel">
          <VillaTable
            villas={filteredVillas}
            tasks={data.tasks}
            open={(id) => open({ kind: "villa", id })}
          />
        </section>
      </>
    );
  } else if (data.page === "buyers" && data.role === "developer") {
    const buyers = (data.buyers ?? []).filter((buyer) =>
      `${buyer.name} ${buyer.villas.map((villa) => villa.code).join(" ")}`
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
    );
    content = (
      <>
        <Heading
          eyebrow="Relationships"
          title="People behind the places."
          description="The owners connected to your residences, in one considered view."
        />
        <div className="op-filter-row">
          <label className="op-search">
            <span className="op-sr-only">Search owners or residences</span>
            <input
              type="search"
              placeholder="Search owner or residence…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
        </div>
        <section className="op-panel">
          <PanelTitle title="Residence owners">
            <Badge tone="neutral">{buyers.length} owners</Badge>
          </PanelTitle>
          {buyers.length ? (
            <div
              className="op-table-wrap"
              tabIndex={0}
              role="region"
              aria-label="Residence owners"
            >
              <table className="op-table">
                <thead>
                  <tr>
                    <th scope="col">Owner</th>
                    <th scope="col">Residence</th>
                    <th scope="col">Location</th>
                    <th scope="col">
                      <span className="op-sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {buyers.map((buyer) => (
                    <tr key={buyer.id}>
                      <td>
                        <strong>{buyer.name}</strong>
                      </td>
                      <td>
                        {buyer.villas.map((villa) => villa.code).join(", ") ||
                          "No residence assigned"}
                      </td>
                      <td>{buyer.country ?? "Not recorded"}</td>
                      <td>
                        <div className="op-owner-links">
                          {buyer.villas.map((villa) => (
                            <button
                              key={villa.id}
                              type="button"
                              className="op-text-link"
                              onClick={() =>
                                open({ kind: "villa", id: villa.id })
                              }
                            >
                              View {villa.code} →
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>No owners match this selection.</Empty>
          )}
        </section>
      </>
    );
  } else if (data.page === "payments" && data.role === "developer") {
    content = (
      <>
        <Heading
          eyebrow={`Finance${selectedVilla ? ` · ${selectedVilla.code}` : ""}`}
          title="Every payment, in view."
          description="Payment records remain separate from physical construction progress."
          action={
            <button
              type="button"
              className="op-btn"
              disabled={!financials.next}
              onClick={() =>
                financials.next &&
                open({ kind: "payment", id: financials.next.id })
              }
            >
              Record payment +
            </button>
          }
        />
        {jumpLinks}
        <div className="op-filter-row">{filterControl}</div>
        <div className="op-metrics op-metrics-three">
          <Metric
            title="Recorded paid"
            value={money(financials.paid)}
            detail={`${financials.paidCount} recorded milestone${financials.paidCount === 1 ? "" : "s"}`}
          />
          <Metric
            title="Remaining"
            value={money(financials.remaining)}
            detail="Across the recorded payment schedule"
          />
          <Metric
            title={
              availableVillas.length === 1
                ? "Next instalment"
                : "Open milestones"
            }
            value={
              availableVillas.length === 1 && financials.next
                ? money(paymentAmount(financials.next, availableVillas[0]))
                : String(financials.openCount).padStart(2, "0")
            }
            detail={
              availableVillas.length === 1
                ? (financials.next?.dueLabel ?? "No open milestone recorded")
                : "Across these residences"
            }
          />
        </div>
        <section className="op-panel">
          <PanelTitle title="Milestone ledger">
            <button
              className="op-btn op-btn-light op-btn-small"
              type="button"
              disabled={!visiblePayments.length}
              onClick={exportPayments}
            >
              Export CSV ↓
            </button>
          </PanelTitle>
          <div
            className="op-filter-buttons op-ledger-filters"
            role="group"
            aria-label="Payment status"
          >
            {["all", "open", "paid"].map((status) => (
              <button
                key={status}
                type="button"
                className={paymentStatus === status ? "is-active" : ""}
                onClick={() => setPaymentStatus(status)}
              >
                {status === "all" ? "All records" : humanLabel(status)}
              </button>
            ))}
          </div>
          {visiblePayments.length ? (
            <div
              className="op-table-wrap"
              tabIndex={0}
              role="region"
              aria-label="Payment milestone ledger"
            >
              <table className="op-table op-payment-table">
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
                  {visiblePayments.map((payment) => (
                    <tr key={payment.id}>
                      <td>
                        <strong>{payment.dueLabel}</strong>
                        <small>{payment.villaCode}</small>
                      </td>
                      <td>{numberLabel(payment.percent)}%</td>
                      <td>
                        {money(
                          paymentAmount(
                            payment,
                            data.villas.find(
                              (villa) => villa.id === payment.villaId,
                            ),
                          ),
                        )}
                      </td>
                      <td>
                        <Badge
                          tone={
                            payment.status === "paid"
                              ? "green"
                              : payment.status === "open"
                                ? "amber"
                                : "neutral"
                          }
                        >
                          {humanLabel(payment.status)}
                        </Badge>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="op-text-link"
                          onClick={() =>
                            open({ kind: "payment", id: payment.id })
                          }
                          aria-label={`View ${payment.dueLabel} for ${payment.villaCode}`}
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
            <Empty>No payment milestones match this selection.</Empty>
          )}
        </section>
      </>
    );
  } else if (data.page === "updates") {
    content = (
      <>
        <Heading
          eyebrow="Field notes"
          title="From site to owner."
          description={
            data.role === "pm"
              ? "Your construction updates for the residences assigned to you."
              : "Create an update and share it with the linked residence owners."
          }
          action={publishButton}
        />
        {jumpLinks}
        <div className="op-filter-row">{filterControl}</div>
        <section className="op-panel">
          <PanelTitle
            title={data.role === "pm" ? "Your updates" : "Site updates"}
          >
            <Badge tone="neutral">{updates.length} records</Badge>
          </PanelTitle>
          <UpdateList
            updates={updates}
            open={(id) => open({ kind: "update", id })}
          />
        </section>
      </>
    );
  } else if (data.page === "documents" && data.role === "developer") {
    content = (
      <>
        <Heading
          eyebrow="Project records"
          title="An orderly archive."
          description="Specifications, drawings and site photographs shared with residence owners."
          action={
            <button
              type="button"
              className="op-btn"
              disabled={!data.villas.length}
              onClick={() => open({ kind: "add-file" })}
            >
              Share file link +
            </button>
          }
        />
        {jumpLinks}
        <div className="op-filter-row">
          {filterControl}
          <div
            className="op-filter-buttons"
            role="group"
            aria-label="File type"
          >
            {["all", "doc", "photo"].map((kind) => (
              <button
                key={kind}
                type="button"
                className={fileKind === kind ? "is-active" : ""}
                onClick={() => setFileKind(kind)}
              >
                {kind === "all"
                  ? "All files"
                  : kind === "doc"
                    ? "Documents"
                    : "Site photographs"}
              </button>
            ))}
          </div>
        </div>
        <section className="op-panel">
          <FileList files={files} open={(id) => open({ kind: "file", id })} />
        </section>
      </>
    );
  } else if (data.page === "villa" && selectedVilla) {
    content = (
      <>
        <Heading
          eyebrow={selectedVilla.projectName}
          title={selectedVilla.code}
          description="Construction, owner updates and project records for this residence."
          action={publishButton}
        />
        {jumpLinks}
        <div className="op-metrics op-metrics-three">
          <Metric
            title="Build progress"
            value={
              selectedVilla.progressPercent === null
                ? "—"
                : `${numberLabel(selectedVilla.progressPercent)}%`
            }
            detail="Completed task weights"
          />
          <Metric
            title="Construction tasks"
            value={`${data.tasks.filter((task) => task.doneAt).length} / ${data.tasks.length}`}
            detail="Recorded tasks complete"
          />
          <Metric
            title="Target handover"
            value={
              selectedVilla.handoverExpected
                ? dateLabel(selectedVilla.handoverExpected, true)
                : "—"
            }
            detail={
              selectedVilla.handoverExpected
                ? "Recorded planning target"
                : "Date to be confirmed"
            }
          />
        </div>
        <div className="op-lower-grid">
          <section className="op-panel">
            <PanelTitle title="Residence details">
              <Badge tone="neutral">{humanLabel(selectedVilla.status)}</Badge>
            </PanelTitle>
            <VillaMetadata
              villa={selectedVilla}
              developer={data.role === "developer"}
            />
            <Link
              className="op-text-link"
              href={villaHref(selectedVilla, "voortgang")}
            >
              Review construction tasks →
            </Link>
          </section>
          <section className="op-panel">
            <PanelTitle
              title={
                data.role === "pm" ? "Your latest updates" : "Latest activity"
              }
            >
              <Link
                className="op-text-link"
                href={villaHref(selectedVilla, "updates")}
              >
                View updates ↗
              </Link>
            </PanelTitle>
            <UpdateList
              updates={data.updates.slice(0, 3)}
              open={(id) => open({ kind: "update", id })}
              compact
            />
          </section>
        </div>
      </>
    );
  } else if (data.page === "progress" && selectedVilla) {
    content = (
      <>
        <Heading
          eyebrow={`Construction · ${selectedVilla.code}`}
          title="Every step, considered."
          description="Record completed construction tasks. Progress changes never mark a payment as paid."
        />
        {jumpLinks}
        <section className="op-panel">
          <PanelTitle title="Construction progress">
            <Badge tone="neutral">
              {data.tasks.filter((task) => task.doneAt).length} of{" "}
              {data.tasks.length} complete
            </Badge>
          </PanelTitle>
          <div className="op-progress-summary">
            <span>
              {selectedVilla.progressPercent === null
                ? "Not available"
                : `${numberLabel(selectedVilla.progressPercent)}%`}
            </span>
            <Progress
              value={selectedVilla.progressPercent}
              label={`${selectedVilla.code} construction progress`}
            />
          </div>
          {data.tasks.length ? (
            <div className="op-task-list">
              {data.tasks.map((task, index) => (
                <article className="op-task" key={task.id}>
                  <span
                    className={`op-task-number${task.doneAt ? " is-complete" : ""}`}
                    aria-hidden="true"
                  >
                    {task.doneAt ? "✓" : String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="op-task-copy">
                    <div className="op-task-heading">
                      <h3>{task.phase}</h3>
                      <Badge tone={task.doneAt ? "green" : "neutral"}>
                        {task.doneAt ? "Completed" : "Open"}
                      </Badge>
                    </div>
                    <p>
                      {task.detail ?? "No additional task details recorded."}
                    </p>
                    <small>
                      {numberLabel(task.percentWeight)}% of build progress
                      {task.period ? ` · ${task.period}` : ""}
                      {task.doneAt
                        ? ` · Completed ${dateLabel(task.doneAt)}`
                        : ""}
                    </small>
                  </div>
                  <button
                    className="op-btn op-btn-light op-btn-small"
                    type="button"
                    onClick={() =>
                      open({
                        kind: "progress-confirm",
                        id: task.id,
                        expected: !!task.doneAt,
                      })
                    }
                  >
                    {task.doneAt ? "Reopen task" : "Mark complete"}
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <Empty>
              No construction tasks have been recorded for this residence.
            </Empty>
          )}
        </section>
      </>
    );
  } else {
    content = (
      <>
        <Heading
          eyebrow="Development office"
          title="No records to show."
          description="Choose an available development or residence to continue."
        />
        <section className="op-panel">
          <Empty>This view is not available for the current selection.</Empty>
          <Link className="op-text-link" href="/office">
            Return to overview →
          </Link>
        </section>
      </>
    );
  }

  const modalVilla =
    modal?.kind === "villa"
      ? data.villas.find((villa) => villa.id === modal.id)
      : undefined;
  const modalPayment =
    modal &&
    ["payment", "payment-confirm"].includes(modal.kind) &&
    "id" in modal
      ? data.payments?.find((payment) => payment.id === modal.id)
      : undefined;
  const modalTask =
    modal?.kind === "progress-confirm"
      ? data.tasks.find((task) => task.id === modal.id)
      : undefined;
  const modalUpdate =
    modal?.kind === "update"
      ? data.updates.find((update) => update.id === modal.id)
      : undefined;
  const modalFile =
    modal?.kind === "file"
      ? data.files?.find((file) => file.id === modal.id)
      : undefined;
  let dialogContent: ReactNode;
  if (modal?.kind === "publish")
    dialogContent = (
      <PublishForm
        data={data}
        actions={actions}
        run={run}
        busy={busy}
        error={error}
        titleId={titleId}
        initialVillaId={
          data.selection.villaId ?? (villaFilter || data.villas[0]?.id || "")
        }
      />
    );
  else if (modal?.kind === "add-file" && data.role === "developer")
    dialogContent = (
      <FileForm
        data={data}
        actions={actions}
        run={run}
        busy={busy}
        error={error}
        titleId={titleId}
        initialVillaId={
          data.selection.villaId ?? (villaFilter || data.villas[0]?.id || "")
        }
      />
    );
  else if (modal?.kind === "villa" && modalVilla)
    dialogContent = (
      <>
        <div className="op-eyebrow">{modalVilla.projectName} · Residence</div>
        <h2 id={titleId}>{modalVilla.code}</h2>
        <Progress
          value={modalVilla.progressPercent}
          label={`${modalVilla.code} build progress`}
        />
        <VillaMetadata
          villa={modalVilla}
          developer={data.role === "developer"}
        />
        <div className="op-dialog-actions">
          <Link className="op-btn" href={villaHref(modalVilla)} onClick={close}>
            Open residence →
          </Link>
          <Link
            className="op-btn op-btn-light"
            href={villaHref(modalVilla, "voortgang")}
            onClick={close}
          >
            Review tasks
          </Link>
        </div>
      </>
    );
  else if (
    modalPayment &&
    data.role === "developer" &&
    (modal?.kind === "payment" || modal?.kind === "payment-confirm")
  ) {
    const villa = data.villas.find((item) => item.id === modalPayment.villaId);
    const changed =
      modal.kind === "payment-confirm" &&
      (modalPayment.status === "paid") !== modal.expected;
    dialogContent = (
      <>
        <div className="op-eyebrow">Finance · {modalPayment.villaCode}</div>
        <h2 id={titleId}>
          {modal.kind === "payment-confirm"
            ? modal.expected
              ? "Reopen this payment?"
              : "Record this payment?"
            : modalPayment.dueLabel}
        </h2>
        <Metadata
          rows={[
            ["Milestone", modalPayment.dueLabel],
            ["Amount", money(paymentAmount(modalPayment, villa))],
            ["Share of agreement", `${numberLabel(modalPayment.percent)}%`],
            ["Status", humanLabel(modalPayment.status)],
            [
              "Recorded paid",
              modalPayment.paidAt
                ? dateLabel(modalPayment.paidAt)
                : "Not recorded",
            ],
            ["Expected date", dateLabel(modalPayment.expectedAt)],
          ]}
        />
        {modalPayment.note ? (
          <p className="op-record-body">{modalPayment.note}</p>
        ) : null}
        <p>
          {modal.kind === "payment-confirm"
            ? modal.expected
              ? "This corrects the record to open. It does not refund or move money."
              : "Confirm that this milestone has been paid. This records its status only; it does not collect a payment or complete construction."
            : "Payment records and construction progress are managed separately."}
        </p>
        {modalPayment.amountUsd === null && villa?.priceTotalUsd != null ? (
          <p className="op-form-hint">
            The displayed amount is calculated from the recorded agreement total
            and milestone share.
          </p>
        ) : null}
        {changed ? (
          <p className="op-form-error" role="alert">
            This record changed while the dialog was open. Close it and review
            the latest status.
          </p>
        ) : null}
        {error ? (
          <p className="op-form-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="op-dialog-actions">
          {modal.kind === "payment-confirm" ? (
            <button
              className="op-btn"
              type="button"
              disabled={busy || changed}
              onClick={() =>
                run(
                  () =>
                    actions.togglePayment({
                      villaId: modalPayment.villaId,
                      villaCode: modalPayment.villaCode,
                      projectId: modalPayment.projectId,
                      milestoneId: modalPayment.id,
                      expectedPaid: modal.expected,
                    }),
                  modal.expected
                    ? "Payment record reopened."
                    : "Payment recorded as paid.",
                )
              }
            >
              {busy
                ? "Saving…"
                : modal.expected
                  ? "Confirm reopen →"
                  : "Confirm payment received →"}
            </button>
          ) : (
            <button
              type="button"
              className="op-btn"
              onClick={() =>
                open({
                  kind: "payment-confirm",
                  id: modalPayment.id,
                  expected: modalPayment.status === "paid",
                })
              }
            >
              {modalPayment.status === "paid"
                ? "Reopen payment record →"
                : "Mark as paid →"}
            </button>
          )}
          <button
            className="op-btn op-btn-light"
            disabled={busy}
            type="button"
            onClick={close}
          >
            Cancel
          </button>
        </div>
      </>
    );
  } else if (modal?.kind === "progress-confirm" && modalTask) {
    const changed = !!modalTask.doneAt !== modal.expected;
    dialogContent = (
      <>
        <div className="op-eyebrow">Construction · {modalTask.villaCode}</div>
        <h2 id={titleId}>
          {modal.expected ? "Reopen this task?" : "Complete this task?"}
        </h2>
        <Metadata
          rows={[
            ["Task", modalTask.phase],
            ["Progress weight", `${numberLabel(modalTask.percentWeight)}%`],
            ["Status", modalTask.doneAt ? "Completed" : "Open"],
          ]}
        />
        {modalTask.detail ? <p>{modalTask.detail}</p> : null}
        <p className="op-confirm-copy">
          {modal.expected
            ? "Reopening corrects the recorded build progress."
            : "Confirm that the recorded construction task is complete."}{" "}
          This does not change any payment record.
        </p>
        {changed ? (
          <p className="op-form-error" role="alert">
            This task changed while the dialog was open. Close it and review the
            latest status.
          </p>
        ) : null}
        {error ? (
          <p className="op-form-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="op-dialog-actions">
          <button
            type="button"
            className="op-btn"
            disabled={busy || changed}
            onClick={() =>
              run(
                () =>
                  actions.toggleProgress({
                    villaId: modalTask.villaId,
                    villaCode: modalTask.villaCode,
                    projectId: modalTask.projectId,
                    taskId: modalTask.id,
                    expectedDone: modal.expected,
                  }),
                modal.expected
                  ? "Construction task reopened."
                  : "Construction task marked complete.",
              )
            }
          >
            {busy
              ? "Saving…"
              : modal.expected
                ? "Confirm reopen →"
                : "Confirm completion →"}
          </button>
          <button
            className="op-btn op-btn-light"
            type="button"
            disabled={busy}
            onClick={close}
          >
            Cancel
          </button>
        </div>
      </>
    );
  } else if (modal?.kind === "update" && modalUpdate)
    dialogContent = (
      <>
        <div className="op-eyebrow">Site update · {modalUpdate.villaCode}</div>
        <h2 id={titleId}>{modalUpdate.title ?? "A note from the site."}</h2>
        <Metadata
          rows={[
            ["Published", dateLabel(modalUpdate.createdAt)],
            ["From", modalUpdate.authorRoleLabel ?? "Site team"],
            ["Category", modalUpdate.category ?? "Not recorded"],
          ]}
        />
        <p className="op-record-body">{modalUpdate.body}</p>
      </>
    );
  else if (modal?.kind === "file" && modalFile && data.role === "developer") {
    const url = safeFileUrl(modalFile.url);
    dialogContent = (
      <>
        <div className="op-eyebrow">
          Project archive · {modalFile.villaCode}
        </div>
        <h2 id={titleId}>{modalFile.label ?? "Project file"}</h2>
        <Metadata
          rows={[
            ["Residence", modalFile.villaCode],
            [
              "Type",
              modalFile.kind === "photo" ? "Site photograph" : "Document",
            ],
            ["Shared", dateLabel(modalFile.createdAt)],
          ]}
        />
        {modalFile.note ? (
          <p className="op-record-body">{modalFile.note}</p>
        ) : null}
        {url ? (
          <div className="op-dialog-actions">
            <a
              className="op-btn"
              href={url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open original file ↗
            </a>
          </div>
        ) : (
          <p className="op-form-error">
            A usable file link is not available for this record.
          </p>
        )}
      </>
    );
  } else
    dialogContent = (
      <>
        <h2 id={titleId}>Record unavailable.</h2>
        <p>
          This record is no longer in the current selection. Close the dialog
          and refresh the view.
        </p>
      </>
    );

  return (
    <div className="office-platform">
      <a href="#office-main" className="op-skip-link">
        Skip to content
      </a>
      <div className="op-shell">
        <aside className="op-sidebar">
          <Link
            href="/office"
            className="op-brand"
            aria-label="Van der Tweel development office"
          >
            <span className="op-mark" aria-hidden="true" />
            <span>
              <strong>Van der Tweel</strong>
              <small>Bali · Development atelier</small>
            </span>
          </Link>
          <div className="op-workspace">
            <span>Active development</span>
            <strong>{context}</strong>
            <small>
              {data.villas.length} residence
              {data.villas.length === 1 ? "" : "s"} within your access
            </small>
          </div>
          <nav className="op-nav" aria-label="Development office">
            {allowedNavigation.map((item) => (
              <Link
                href={officeHref(item.page, projectId)}
                className={activePage === item.page ? "is-active" : ""}
                aria-current={activePage === item.page ? "page" : undefined}
                key={item.page}
              >
                <Icon name={item.icon} />
                <span>
                  {data.role === "pm" && item.page === "updates"
                    ? "Your updates"
                    : item.label}
                </span>
              </Link>
            ))}
          </nav>
          <div className="op-person">
            <span className="op-avatar" aria-hidden="true">
              {data.role === "developer" ? "DO" : "PM"}
            </span>
            <div>
              <strong>
                {data.email ??
                  (data.role === "developer"
                    ? "Development team"
                    : "Project team")}
              </strong>
              <small>
                {data.role === "developer"
                  ? "Development office"
                  : "Project manager"}
              </small>
            </div>
          </div>
        </aside>
        <div className="op-main-wrap">
          <div className="op-topbar">
            <span>
              Development office <i>/</i> <strong>{context}</strong>
            </span>
            <Badge tone="neutral">
              {data.role === "developer" ? "Developer" : "Project manager"}
            </Badge>
          </div>
          <main id="office-main" className="op-content" tabIndex={-1}>
            {data.projects.length > 1 ? (
              <div className="op-project-selector">
                <label htmlFor="office-project-select">Development</label>
                <select
                  id="office-project-select"
                  value={projectId ?? ""}
                  onChange={(event) => projectSelection(event.target.value)}
                >
                  <option value="">All developments</option>
                  {data.projects.map((item) => (
                    <option value={item.id} key={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
                {project ? (
                  <Link
                    className="op-text-link"
                    href={`/office/projecten/${encodeURIComponent(project.slug)}?projectId=${encodeURIComponent(project.id)}`}
                  >
                    Open development ↗
                  </Link>
                ) : null}
              </div>
            ) : null}
            {notice ? (
              <div className="op-notice" role="status">
                <span>{notice}</span>
                <button
                  type="button"
                  aria-label="Dismiss confirmation"
                  onClick={() => setNotice(null)}
                >
                  ×
                </button>
              </div>
            ) : null}
            {content}
          </main>
        </div>
      </div>
      {modal ? (
        <Dialog
          key={modal.kind + ("id" in modal ? modal.id : "")}
          close={close}
          busy={busy}
          titleId={titleId}
        >
          {dialogContent}
        </Dialog>
      ) : null}
    </div>
  );
}

function VillaMetadata({
  villa,
  developer,
}: {
  villa: OfficeVilla;
  developer: boolean;
}) {
  function area(value: number | null) {
    return value === null ? "Not recorded" : `${numberLabel(value)} m²`;
  }
  const rows: [string, ReactNode][] = [
    ["Owner", villa.buyerName ?? "No owner assigned"],
    ["Development", villa.projectName],
    ["Status", humanLabel(villa.status)],
    [
      "Construction",
      villa.progressPercent === null
        ? "Not available"
        : `${numberLabel(villa.progressPercent)}% complete`,
    ],
    ["Residence type", villa.typeLabel ?? "Not recorded"],
    [
      "Plot / built / outdoor",
      `${area(villa.plotM2)} / ${area(villa.builtM2)} / ${area(villa.outdoorM2)}`,
    ],
    ["Build started", dateLabel(villa.buildStarted)],
    ["Expected handover", dateLabel(villa.handoverExpected)],
  ];
  if (developer)
    rows.push(["Agreement total", money(villa.priceTotalUsd ?? null)]);
  return <Metadata rows={rows} />;
}
