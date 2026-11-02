export type OfficeRole = "developer" | "pm";

export type OfficePage =
  | "overview"
  | "villas"
  | "buyers"
  | "payments"
  | "updates"
  | "documents"
  | "project"
  | "villa"
  | "progress";

export interface OfficeProject {
  id: string;
  name: string;
  slug: string;
  villaCount: number;
}

/** Financial keys are absent, not merely hidden, in every PM response. */
export interface OfficeVilla {
  id: string;
  code: string;
  projectId: string;
  projectName: string;
  projectSlug: string;
  buyerName: string | null;
  status: string;
  typeLabel: string | null;
  plotM2: number | null;
  builtM2: number | null;
  outdoorM2: number | null;
  buildStarted: string | null;
  handoverExpected: string | null;
  progressPercent: number | null;
  pricePackage?: string | null;
  priceTotalUsd?: number | null;
}

export interface OfficeRecordScope {
  villaId: string;
  villaCode: string;
  projectId: string;
}

export interface OfficeTask extends OfficeRecordScope {
  id: string;
  phase: string;
  percentWeight: number;
  doneAt: string | null;
  sequence: number;
  detail: string | null;
  period: string | null;
}

export interface OfficePayment extends OfficeRecordScope {
  id: string;
  percent: number;
  dueLabel: string;
  status: string;
  paidAt: string | null;
  sequence: number;
  amountUsd: number | null;
  note: string | null;
  expectedAt: string | null;
}

export interface OfficeUpdate extends OfficeRecordScope {
  id: string;
  title: string | null;
  body: string;
  category: string | null;
  authorRoleLabel: string | null;
  createdAt: string;
}

export interface OfficeFile extends OfficeRecordScope {
  id: string;
  kind: string;
  url: string | null;
  label: string | null;
  note: string | null;
  createdAt: string;
}

export interface OfficeBuyer {
  id: string;
  name: string;
  country: string | null;
  villas: { id: string; code: string; projectId: string }[];
}

/** Explicit presentation data only: no raw database rows or session internals. */
export interface OfficePlatformData {
  page: OfficePage;
  role: OfficeRole;
  email: string | null;
  projects: OfficeProject[];
  villas: OfficeVilla[];
  buyers: OfficeBuyer[] | null;
  tasks: OfficeTask[];
  payments: OfficePayment[] | null;
  updates: OfficeUpdate[];
  files: OfficeFile[] | null;
  selection: {
    projectId: string | null;
    villaId: string | null;
    villaCode: string | null;
  };
}

export interface OfficeActionResult {
  ok: boolean;
  error?: string;
}

export interface ToggleProgressInput extends OfficeRecordScope {
  taskId: string;
  expectedDone: boolean;
}

export interface TogglePaymentInput extends OfficeRecordScope {
  milestoneId: string;
  expectedPaid: boolean;
}

export interface PublishUpdateInput extends OfficeRecordScope {
  title: string;
  body: string;
  category: "Construction" | "Payment" | "Paperwork";
}

export interface AddFileLinkInput extends OfficeRecordScope {
  label: string;
  url: string;
  note: string;
  kind: "photo" | "doc";
}

/** Supplied as props, allowing browser QA to inject fixture-only handlers. */
export interface OfficeActionHandlers {
  toggleProgress: (input: ToggleProgressInput) => Promise<OfficeActionResult>;
  togglePayment: (input: TogglePaymentInput) => Promise<OfficeActionResult>;
  publishUpdate: (input: PublishUpdateInput) => Promise<OfficeActionResult>;
  addFileLink: (input: AddFileLinkInput) => Promise<OfficeActionResult>;
}
