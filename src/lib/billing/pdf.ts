import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont } from "pdf-lib";
import type { BillingSnapshot } from "./domain";

// Bundled, licensed fonts keep PDFs independent of external font services.
// The fallback covers Chinese/Japanese/Korean buyer names as well as Latin.
export async function renderBillingPdf(snapshot: BillingSnapshot, reversal?: { at: Date; reason: string | null }) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const latinBytes = await readFile(path.join(process.cwd(), "src/lib/billing/fonts/DejaVuSans.ttf"));
  const latin = await pdf.embedFont(latinBytes, { subset: true });
  const latinChars = new Set(latin.getCharacterSet());
  // Fontkit's subset for this CJK TrueType font can preserve text extraction
  // while producing blank glyphs in PDF viewers. Embed its full glyph table.
  // Ordinary Latin documents keep their small subset-only download size.
  const needsFallback = [...JSON.stringify(snapshot), ...(reversal?.reason ?? "")].some((char) => !latinChars.has(char.codePointAt(0)!));
  const fallback = needsFallback ? await pdf.embedFont(await readFile(path.join(process.cwd(), "src/lib/billing/fonts/DroidSansFallback.ttf")), { subset: false }) : latin;
  const fallbackChars = new Set(fallback.getCharacterSet());
  const fontsFor = (text: string): { text: string; font: PDFFont }[] => {
    const runs: { text: string; font: PDFFont }[] = [];
    for (const char of text) {
      const cp = char.codePointAt(0)!;
      const font = latinChars.has(cp) ? latin : fallbackChars.has(cp) ? fallback : latin;
      // Preserve uncommon unsupported code points explicitly; never silently
      // replace characters in someone's legal billing identity with a question mark.
      const supportedText = latinChars.has(cp) || fallbackChars.has(cp) ? char : `[U+${cp.toString(16).toUpperCase()}]`;
      const last = runs[runs.length - 1];
      if (last?.font === font) last.text += supportedText; else runs.push({ text: supportedText, font });
    }
    return runs;
  };
  const width = (text: string, size: number) => fontsFor(text).reduce((sum, run) => sum + run.font.widthOfTextAtSize(run.text, size), 0);
  const ink = rgb(0.15, 0.24, 0.19), muted = rgb(0.35, 0.4, 0.36), line = rgb(0.82, 0.85, 0.81);
  let page = pdf.addPage([595.28, 841.89]);
  let y = 784;
  const margin = 48, available = 499;
  const addPage = () => { page = pdf.addPage([595.28, 841.89]); y = 784; };
  const draw = (text: string, x: number, at: number, size: number, color = ink) => {
    for (const run of fontsFor(text)) { page.drawText(run.text, { x, y: at, size, font: run.font, color }); x += run.font.widthOfTextAtSize(run.text, size); }
  };
  const lines = (text: string, size: number) => {
    const output: string[] = [];
    for (const paragraph of text.replace(/\r/g, "").split("\n")) {
      let current = "";
      for (const token of paragraph.split(/(\s+)/)) {
        if (width(current + token, size) <= available) { current += token; continue; }
        if (current) { output.push(current.trimEnd()); current = ""; }
        // Preserve word boundaries where possible, but handle uninterrupted
        // account references and CJK paragraphs without horizontal overflow.
        for (const character of token.trimStart()) {
          if (current && width(current + character, size) > available) { output.push(current.trimEnd()); current = character; }
          else current += character;
        }
      }
      output.push(current);
    }
    return output;
  };
  const text = (value: string, size = 10, color = ink, gap = 9) => {
    for (const valueLine of lines(value, size)) { if (y < 70) addPage(); draw(valueLine, margin, y, size, color); y -= size * 1.55; }
    y -= gap;
  };
  const rule = () => { if (y < 80) addPage(); page.drawLine({ start: { x: margin, y }, end: { x: 547, y }, thickness: 0.7, color: line }); y -= 24; };
  const date = (value: string) => new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
  const amount = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(snapshot.amountCents / 100);
  pdf.setTitle(`${snapshot.documentKind === "invoice" ? "Invoice" : "Payment receipt"} ${snapshot.number}`);
  pdf.setAuthor(snapshot.issuer.companyName);
  pdf.setCreationDate(new Date(snapshot.issuedAt));
  pdf.setModificationDate(new Date(snapshot.issuedAt));
  text(snapshot.issuer.companyName, 20, ink, 12);
  text(snapshot.documentKind === "invoice" ? "INVOICE" : "PAYMENT RECEIPT", 11, muted, 4);
  text(snapshot.number, 17, ink, 12);
  if (reversal) { text(`PAYMENT REVERSED · ${date(reversal.at.toISOString())}`, 12, rgb(0.55, 0.15, 0.12)); text(`Original receipt retained. This receipt no longer confirms settlement. ${reversal.reason ?? ""}`); }
  text(`Issued ${date(snapshot.issuedAt)}${snapshot.documentKind === "invoice" ? `  ·  Due ${date(snapshot.dueAt)}` : ""}`, 10, muted, 12);
  rule();
  text("FROM", 9, muted, 2);
  text(`${snapshot.issuer.companyName}\n${snapshot.issuer.address}\n${snapshot.issuer.email}`, 10);
  if (snapshot.issuer.registrationNumber) text(`Registration: ${snapshot.issuer.registrationNumber}`, 9, muted, 2);
  if (snapshot.issuer.taxNumber) text(`Tax reference: ${snapshot.issuer.taxNumber}`, 9, muted, 2);
  y -= 8;
  text("BILL TO", 9, muted, 2);
  text(`${snapshot.recipient.name}\n${snapshot.recipient.address}\n${snapshot.recipient.email}`, 10, ink, 14);
  rule();
  text(`${snapshot.projectName} · ${snapshot.villaCode}`, 13);
  text(`${snapshot.description} (${snapshot.percent}% of contract total)`, 11, muted);
  text(`${snapshot.documentKind === "invoice" ? "Amount due" : "Amount received"}   ${amount} USD`, 18, ink, 14);
  if (snapshot.payment) {
    text(`Invoice: ${snapshot.payment.invoiceNumber}\nPayment date: ${date(snapshot.payment.paidAt)}\nPayment reference: ${snapshot.payment.reference}`, 10, ink, 12);
  } else {
    text("PAYMENT INSTRUCTIONS", 9, muted, 2);
    text(snapshot.issuer.bankInstructions, 10);
    text(`Please include invoice reference ${snapshot.number} with your transfer.`, 9, muted);
  }
  rule();
  text("Contractual milestone payment in USD. No additional taxes or charges have been calculated by this document.", 9, muted);
  const pages = pdf.getPages();
  pages.forEach((item, i) => { page = item; draw(`${snapshot.number}  ·  ${i + 1} / ${pages.length}`, margin, 36, 8, muted); });
  return pdf.save();
}
