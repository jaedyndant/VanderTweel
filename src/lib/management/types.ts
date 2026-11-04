export interface ManagedAccount {
  id: string;
  email: string;
  name: string;
  role: "buyer" | "pm";
  lastLoginAt: string | null;
  villaIds: string[];
  projectIds: string[];
  invitation: { requestedAt: string; deliveryCount: number; state: "queued" | "sent" | "failed" | "sending" | "unknown" } | null;
}

export interface ManagedVilla {
  id: string;
  projectId: string;
  code: string;
  status: string;
  typeLabel: string | null;
  plotM2: string | null;
  builtM2: string | null;
  outdoorM2: string | null;
  leaseYears: number | null;
  pricePackage: string | null;
  priceTotalUsd: string | null;
  buildStarted: string | null;
  handoverExpected: string | null;
  revision: string;
}

export interface ManagementData {
  accounts: ManagedAccount[];
  villas: ManagedVilla[];
}
