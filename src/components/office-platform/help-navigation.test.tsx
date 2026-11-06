import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { OfficeActionHandlers, OfficePlatformData } from "./types";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("./office-sign-out", () => ({ OfficeSignOut: () => null }));

import { OfficePlatform } from "./office-platform";
import { DeveloperHelp } from "./developer-help";

const data: OfficePlatformData = {
  page: "help", role: "developer", email: "developer@example.test",
  projects: [{ id: "project-a", name: "Cemagi", slug: "cemagi", villaCount: 3 }],
  villas: [], buyers: [], tasks: [], payments: [], updates: [], files: [],
  selection: { projectId: "project-a", villaId: null, villaCode: null },
};
const actions: OfficeActionHandlers = {
  toggleProgress: vi.fn(), saveProgressTask: vi.fn(), deleteProgressTask: vi.fn(),
  togglePayment: vi.fn(), publishUpdate: vi.fn(), addFileLink: vi.fn(),
};

describe("Help navigation", () => {
  it("shows the active, scoped Help link in desktop and mobile developer navigation", () => {
    const html = renderToStaticMarkup(<OfficePlatform data={data} actions={actions} helpContent={<p>Developer guide content</p>} />);
    const helpLinks = html.match(/<a\b[^>]*href="\/office\/help\?projectId=project-a"[^>]*>/g);
    expect(helpLinks).toHaveLength(2);
    for (const link of helpLinks!) {
      expect(link).toContain('class="is-active"');
      expect(link).toContain('aria-current="page"');
    }
    expect(html).toContain("Developer guide content");
    expect(html).toContain("3 residences within your access");
  });

  it("omits Help and its supplied guide from the PM shell", () => {
    const html = renderToStaticMarkup(<OfficePlatform data={{ ...data, role: "pm" }} actions={actions} helpContent={<p>Developer guide content</p>} />);
    expect(html).not.toContain("/office/help");
    expect(html).not.toContain("Developer guide content");
  });

  it("keeps all guide workspace links scoped to the selected project", () => {
    const html = renderToStaticMarkup(<DeveloperHelp projectId="a & b" />);
    const workspaceLinks = Array.from(html.matchAll(/href="(\/office[^\"]*)"/g), (match) => match[1]);
    expect(workspaceLinks.length).toBeGreaterThan(4);
    for (const href of workspaceLinks) expect(href).toMatch(/\?projectId=a%20%26%20b$/);
    expect(html).not.toContain("/office/preview/");
  });
});
