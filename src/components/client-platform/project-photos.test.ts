import { describe, expect, it } from "vitest";
import { projectContactHref, projectPhotos } from "./presentation";
import type { ClientDocument } from "./types";

function document(
  id: string,
  date: string,
  url = "https://files.vandertweel.com/site.jpg",
  kind = "photo",
): ClientDocument {
  return { id, kind, url, label: null, note: null, createdAt: date };
}

describe("project photography presentation", () => {
  it("orders only shared photos newest-first without changing the input records", () => {
    const records = [
      document("older", "2026-10-01"),
      document("agreement", "2026-11-04", undefined, "contract"),
      document("newest", "2026-11-03"),
    ];
    expect(projectPhotos(records).map((item) => item.id)).toEqual([
      "newest",
      "older",
    ]);
    expect(records[0].id).toBe("older");
  });

  it("retains a truthful unavailable record while letting the hero choose the newest usable photo", () => {
    const photos = projectPhotos([
      document("valid", "2026-11-01"),
      document("unsafe", "2026-11-03", "javascript:alert(1)"),
      document("example", "2026-11-02", "https://example.com/site.jpg"),
    ]);
    expect(photos[0].safeUrl).toBeNull();
    expect(photos.find((photo) => photo.safeUrl)?.id).toBe("valid");
    expect(projectPhotos([])).toEqual([]);
  });

  it("puts malformed dates last without hiding an otherwise usable photograph", () => {
    expect(
      projectPhotos([
        document("invalid-date", "unknown"),
        document("dated", "2026-11-01"),
      ]).map((item) => item.id),
    ).toEqual(["dated", "invalid-date"]);
  });
});

describe("project contact link", () => {
  it("encodes project context without letting it create extra mail headers", () => {
    const href = projectContactHref(
      "hello@vandertweel.com",
      "Bali & Beach\nBcc:other@invalid.test",
      "Villa #03",
    );
    expect(href.startsWith("mailto:hello@vandertweel.com?subject=")).toBe(true);
    expect(href).not.toContain("\n");
    const query = new URLSearchParams(href.split("?")[1]);
    expect([...query.keys()]).toEqual(["subject"]);
    expect(query.get("subject")).toBe(
      "Bali & Beach Bcc:other@invalid.test · Villa #03",
    );
    expect(query.get("subject")).not.toMatch(/[\r\n]/);
  });
});
