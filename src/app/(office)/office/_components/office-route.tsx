import "server-only";

import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getOfficePlatformData } from "@/lib/office-platform-data";
import {
  addFileLink,
  publishUpdate,
  togglePayment,
  toggleProgress,
} from "@/lib/office-platform-actions";
import { OfficePlatform } from "@/components/office-platform/office-platform";
import type {
  OfficeActionHandlers,
  OfficePage,
} from "@/components/office-platform/types";

export type OfficeSearchParams = Promise<{
  projectId?: string | string[];
}>;

const officeActions: OfficeActionHandlers = {
  toggleProgress,
  togglePayment,
  publishUpdate,
  addFileLink,
};

/**
 * All pages share the same server-only scope boundary. The adapter repeats
 * authorization and returns only explicitly permitted presentation fields.
 */
export async function OfficeRoute({
  page,
  searchParams,
  projectSlug,
  villaCode,
}: {
  page: OfficePage;
  searchParams: OfficeSearchParams;
  projectSlug?: string;
  villaCode?: string;
}) {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id || (user.role !== "pm" && user.role !== "developer")) {
    redirect("/login");
  }
  if (
    user.role === "pm" &&
    (page === "buyers" || page === "payments" || page === "documents")
  ) {
    notFound();
  }

  const { projectId } = await searchParams;
  // A malformed explicit selection must not fall back to a broader view.
  if (
    Array.isArray(projectId) ||
    (projectId !== undefined && projectId.trim().length === 0)
  ) {
    notFound();
  }

  const data = await getOfficePlatformData(page, {
    projectSlug,
    villaCode,
    projectId,
  });
  if (!data) notFound();

  return <OfficePlatform data={data} actions={officeActions} />;
}
