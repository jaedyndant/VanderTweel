export type ClientPage =
  | "home"
  | "villa"
  | "progress"
  | "payments"
  | "documents"
  | "updates";

/** Only authorized, serializable buyer-facing fields cross this boundary. */
export interface ClientPlatformData {
  buyerName: string | null;
  villa: {
    id: string;
    code: string;
    projectName: string;
    status: string;
    typeLabel: string | null;
    builtM2: number | null;
    plotM2: number | null;
    outdoorM2: number | null;
    leaseYears: number | null;
    pricePackage: string | null;
    priceTotalUsd: number | null;
    buildStarted: string | null;
    handoverExpected: string | null;
  };
  tasks: {
    id: string;
    phase: string;
    percentWeight: number;
    doneAt: string | null;
    sequence: number;
    detail: string | null;
    period: string | null;
  }[];
  milestones: {
    id: string;
    percent: number;
    dueLabel: string;
    status: string;
    paidAt: string | null;
    sequence: number;
    amountUsd: number | null;
    note: string | null;
    expectedAt: string | null;
  }[];
  documents: {
    id: string;
    kind: string;
    url: string;
    label: string | null;
    note: string | null;
    createdAt: string;
  }[];
  updates: {
    id: string;
    title: string | null;
    body: string;
    category: string | null;
    authorRoleLabel: string | null;
    createdAt: string;
  }[];
}

export type ClientDocument = ClientPlatformData["documents"][number];
export type ClientMilestone = ClientPlatformData["milestones"][number];
