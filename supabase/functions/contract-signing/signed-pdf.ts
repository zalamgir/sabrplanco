import { PDFDocument, PDFFont, rgb, StandardFonts } from "npm:pdf-lib@1.17.1";

export type SignatureDetails = {
  requestId: string;
  clientName: string;
  signerName: string;
  method: "typed" | "drawn";
  signaturePng: Uint8Array;
  recipients: string[];
  sentAt: Date;
  viewedAt: Date | null;
  signedAt: Date;
  signerIp: string;
  signerUserAgent: string;
  unsignedSha256: string;
};

const INK = rgb(0.231, 0.149, 0.106);
const MUTED = rgb(0.47, 0.42, 0.37);
const ACCENT = rgb(0.588, 0.416, 0.302);
const LINE = rgb(0.84, 0.79, 0.73);

// Standard PDF fonts only cover Western characters; replace anything else so signing never fails.
function safeText(font: PDFFont, text: string): string {
  const cleaned = String(text ?? "").replace(/[\r\n\t]+/g, " ");
  try {
    font.encodeText(cleaned);
    return cleaned;
  } catch {
    return [...cleaned].map((char) => {
      try {
        font.encodeText(char);
        return char;
      } catch {
        return "?";
      }
    }).join("");
  }
}

function formatUtc(date: Date | null): string {
  if (!date) return "—";
  return `${date.toISOString().replace("T", " ").slice(0, 19)} UTC`;
}

function wrap(font: PDFFont, text: string, size: number, maxWidth: number): string[] {
  const words = safeText(font, text).split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth || !line) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export async function buildSignedPdf(unsignedBytes: Uint8Array, details: SignatureDetails): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(unsignedBytes);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const signatureImage = await pdf.embedPng(details.signaturePng);
  const reference = details.requestId.slice(0, 8).toUpperCase();

  // Stamp every original page so a printed page on its own still shows it was signed.
  const stamp = safeText(
    regular,
    `Electronically signed by ${details.signerName} on ${formatUtc(details.signedAt)} · Ref ${reference}`,
  );
  for (const page of pdf.getPages()) {
    const { width } = page.getSize();
    const size = 6.5;
    page.drawText(stamp, {
      x: Math.max(24, (width - regular.widthOfTextAtSize(stamp, size)) / 2),
      y: 12,
      size,
      font: regular,
      color: MUTED,
    });
  }

  // Signature certificate page.
  const firstSize = pdf.getPage(0).getSize();
  const page = pdf.addPage([firstSize.width, firstSize.height]);
  const { width, height } = page.getSize();
  const margin = 54;
  const contentWidth = width - margin * 2;
  let y = height - margin;

  const text = (value: string, options: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb>; x?: number } = {}) => {
    const size = options.size ?? 10;
    const font = options.font ?? regular;
    for (const line of wrap(font, value, size, contentWidth - ((options.x ?? margin) - margin))) {
      page.drawText(line, { x: options.x ?? margin, y, size, font, color: options.color ?? INK });
      y -= size * 1.45;
    }
  };

  text("SABR PLAN CO.", { size: 9, font: bold, color: ACCENT });
  y -= 6;
  text("Electronic Signature Certificate", { size: 20, font: bold });
  y -= 2;
  text(`Wedding coordination agreement for ${details.clientName}`, { size: 11, color: MUTED });
  y -= 14;
  page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 0.8, color: LINE });
  y -= 26;

  // Client signature block.
  text("SIGNATURE OF CLIENT", { size: 8, font: bold, color: ACCENT });
  y -= 4;
  const maxSignatureWidth = Math.min(260, contentWidth);
  const maxSignatureHeight = 70;
  const scale = Math.min(maxSignatureWidth / signatureImage.width, maxSignatureHeight / signatureImage.height, 1);
  const signatureWidth = signatureImage.width * scale;
  const signatureHeight = signatureImage.height * scale;
  page.drawImage(signatureImage, { x: margin, y: y - signatureHeight, width: signatureWidth, height: signatureHeight });
  y -= signatureHeight + 6;
  page.drawLine({ start: { x: margin, y }, end: { x: margin + maxSignatureWidth, y }, thickness: 0.8, color: MUTED });
  y -= 14;
  text(details.signerName, { size: 11, font: bold });
  text(`Signed ${formatUtc(details.signedAt)}`, { size: 9, color: MUTED });
  y -= 18;

  text("SIGNATURE OF COORDINATOR", { size: 8, font: bold, color: ACCENT });
  y -= 2;
  text("Printed on the agreement by Sabr Plan Co. when it was sent for signature.", { size: 9, color: MUTED });
  y -= 18;
  page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 0.8, color: LINE });
  y -= 24;

  // Audit trail.
  text("AUDIT TRAIL", { size: 8, font: bold, color: ACCENT });
  y -= 6;
  const rows: Array<[string, string]> = [
    ["Reference", details.requestId],
    ["Sent to", details.recipients.join(", ")],
    ["Sent", formatUtc(details.sentAt)],
    ["First opened", formatUtc(details.viewedAt)],
    ["Signed", formatUtc(details.signedAt)],
    ["Signer name (typed)", details.signerName],
    ["Signature", details.method === "drawn" ? "Drawn by the signer" : "Generated from the signer's typed name"],
    ["Consent", "Signer agreed to sign electronically and that the electronic signature is legally binding."],
    ["IP address", details.signerIp || "Unknown"],
    ["Device", details.signerUserAgent || "Unknown"],
    ["Document fingerprint (SHA-256 of the agreement as sent)", details.unsignedSha256],
  ];
  for (const [label, value] of rows) {
    text(label, { size: 7.5, font: bold, color: MUTED });
    text(value, { size: 9 });
    y -= 4;
  }

  return await pdf.save();
}
