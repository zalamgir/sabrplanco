import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { buildSignedPdf } from "./signed-pdf.ts";

// Deploy with: supabase functions deploy contract-signing --no-verify-jwt
// The public signing page has no Supabase login, so JWT verification is done here instead:
// "create" and "void" require a signed-in portal admin; "view" and "sign" require a valid signing token.

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};
const BUCKET = "portal-documents";
const COORDINATOR_EMAIL = "sabrplanco@gmail.com";
const LINK_LIFETIME_DAYS = 30;
const MAX_PDF_BYTES = 15 * 1024 * 1024;
const MAX_SIGNATURE_BYTES = 600 * 1024;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const REQUEST_COLUMNS =
  "id, client_id, status, recipient_emails, client_name, unsigned_path, signed_path, signer_name, signature_method, expires_at, viewed_at, signed_at, voided_at, created_at";

class HttpError extends Error {
  constructor(public status: number, message: string, public code = "") {
    super(message);
  }
}

function jsonResponse(status: number, body: Record<string, unknown>, origin: string) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Access-Control-Allow-Origin": origin, "Content-Type": "application/json" },
  });
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function sha256Hex(data: Uint8Array | string): Promise<string> {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return bytesToBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function formatDate(value: string | Date): string {
  return new Date(value).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "America/New_York" });
}

async function sendEmail(options: {
  to: string[];
  subject: string;
  text: string;
  bcc?: string[];
  attachment?: { filename: string; content: string };
}): Promise<string> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const sender = Deno.env.get("RESEND_FROM_EMAIL");
  if (!apiKey || !sender) throw new HttpError(500, "Email delivery is not configured on the server.");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: sender,
      to: options.to,
      bcc: options.bcc,
      reply_to: COORDINATOR_EMAIL,
      subject: options.subject,
      text: options.text,
      attachments: options.attachment ? [options.attachment] : undefined,
    }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || typeof result.id !== "string") {
    const detail = typeof result.message === "string" ? `: ${result.message.slice(0, 300)}` : ".";
    throw new HttpError(502, `The email provider rejected this message${detail}`);
  }
  return result.id;
}

async function requireAdmin(request: Request, supabaseUrl: string, publishableKey: string) {
  const authorization = request.headers.get("Authorization");
  if (!authorization) throw new HttpError(401, "Sign in again before sending contracts for signature.");
  const userClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) throw new HttpError(401, "Sign in again before sending contracts for signature.");
  const { data: admin, error: adminError } = await userClient
    .from("portal_admins")
    .select("user_id")
    .eq("user_id", userData.user.id)
    .maybeSingle();
  if (adminError || !admin) throw new HttpError(403, "Only approved portal admins can send contracts for signature.");
  return { user: userData.user, userClient };
}

async function findByToken(service: SupabaseClient, token: unknown) {
  if (typeof token !== "string" || !TOKEN_PATTERN.test(token)) {
    throw new HttpError(404, "This signing link isn't valid. Please use the link from your email.", "invalid");
  }
  const { data, error } = await service
    .from("contract_signature_requests")
    .select(`${REQUEST_COLUMNS}, unsigned_sha256, created_by, signer_ip`)
    .eq("token_hash", await sha256Hex(token))
    .maybeSingle();
  if (error) throw new HttpError(500, "The contract could not be loaded. Please try again.");
  if (!data) throw new HttpError(404, "This signing link isn't valid. Please use the link from your email.", "invalid");
  return data;
}

async function signedUrl(service: SupabaseClient, path: string, seconds: number) {
  const { data, error } = await service.storage.from(BUCKET).createSignedUrl(path, seconds);
  if (error) throw new HttpError(500, "The contract file could not be opened. Please try again.");
  return data.signedUrl;
}

async function logDelivery(service: SupabaseClient, row: {
  client_id: string;
  recipient_emails: string[];
  subject: string;
  resend_message_id: string;
  sent_by: string;
}) {
  // Email history is informational; a failed log never fails the request.
  await service.from("email_deliveries").insert({ ...row, document_type: "contract" }).then(() => {}, () => {});
}

async function createRequest(request: Request, payload: Record<string, unknown>, ctx: Context) {
  const { user, userClient } = await requireAdmin(request, ctx.supabaseUrl, ctx.publishableKey);
  const clientId = typeof payload.clientId === "string" ? payload.clientId : "";
  const recipients = Array.isArray(payload.recipients) ? payload.recipients : [];
  const message = typeof payload.message === "string" ? payload.message.trim() : "";
  const subject = typeof payload.subject === "string" ? payload.subject.trim() : "";
  const pdfBase64 = typeof payload.pdfBase64 === "string" ? payload.pdfBase64 : "";
  if (
    !UUID_PATTERN.test(clientId) ||
    recipients.length < 1 || recipients.length > 5 ||
    !recipients.every((email) => typeof email === "string" && EMAIL_PATTERN.test(email)) ||
    !subject || subject.length > 200 || /[\r\n]/.test(subject) ||
    message.length > 5000 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(pdfBase64)
  ) {
    throw new HttpError(400, "Check the recipients and message, then try again.");
  }
  const pdfBytes = base64ToBytes(pdfBase64);
  if (pdfBytes.length < 100 || pdfBytes.length > MAX_PDF_BYTES) throw new HttpError(413, "The contract PDF must be smaller than 15 MB.");
  if (new TextDecoder().decode(pdfBytes.subarray(0, 1024)).indexOf("%PDF-") === -1) {
    throw new HttpError(400, "The contract does not appear to be a PDF.");
  }

  // Reading the client through the admin's own session confirms they can access it.
  const { data: client, error: clientError } = await userClient
    .from("clients")
    .select("id, couple_name")
    .eq("id", clientId)
    .single();
  if (clientError || !client) throw new HttpError(404, "The client workspace could not be found.");

  const id = crypto.randomUUID();
  const token = newToken();
  const unsignedPath = `${clientId}/signatures/${id}/contract-for-signature.pdf`;
  const { error: uploadError } = await ctx.service.storage
    .from(BUCKET)
    .upload(unsignedPath, pdfBytes, { contentType: "application/pdf", upsert: false });
  if (uploadError) throw new HttpError(500, `The contract could not be saved: ${uploadError.message}`);

  const expiresAt = new Date(Date.now() + LINK_LIFETIME_DAYS * 24 * 60 * 60 * 1000);
  const { data: row, error: insertError } = await ctx.service
    .from("contract_signature_requests")
    .insert({
      id,
      client_id: clientId,
      token_hash: await sha256Hex(token),
      recipient_emails: recipients,
      client_name: client.couple_name,
      unsigned_path: unsignedPath,
      unsigned_sha256: await sha256Hex(pdfBytes),
      expires_at: expiresAt.toISOString(),
      created_by: user.id,
    })
    .select(REQUEST_COLUMNS)
    .single();
  if (insertError || !row) {
    await ctx.service.storage.from(BUCKET).remove([unsignedPath]);
    throw new HttpError(500, `The signature request could not be created: ${insertError?.message || "Unknown error"}`);
  }

  const link = `${ctx.origin}/sign/#${token}`;
  const text = `${message || "Hello,\n\nYour wedding coordination contract is ready for your review and signature."}\n\n` +
    `Review and sign your contract here:\n${link}\n\n` +
    `This private link expires on ${formatDate(expiresAt)}. Please don't forward it.\n\nWarmly,\nSabr Plan Co.`;
  let messageId: string;
  try {
    messageId = await sendEmail({ to: recipients as string[], subject, text });
  } catch (error) {
    // Don't leave a live link behind if the couple never received it.
    await ctx.service.from("contract_signature_requests").update({ status: "voided", voided_at: new Date().toISOString() }).eq("id", id);
    throw error;
  }

  // Only one open request per client: cancel older unsigned links once the new one is sent.
  await ctx.service
    .from("contract_signature_requests")
    .update({ status: "voided", voided_at: new Date().toISOString() })
    .eq("client_id", clientId)
    .in("status", ["sent", "viewed"])
    .neq("id", id);
  await logDelivery(ctx.service, {
    client_id: clientId,
    recipient_emails: recipients as string[],
    subject,
    resend_message_id: messageId,
    sent_by: user.id,
  });
  return { request: row };
}

async function voidRequest(request: Request, payload: Record<string, unknown>, ctx: Context) {
  await requireAdmin(request, ctx.supabaseUrl, ctx.publishableKey);
  const requestId = typeof payload.requestId === "string" ? payload.requestId : "";
  if (!UUID_PATTERN.test(requestId)) throw new HttpError(400, "The signature request could not be found.");
  const { data, error } = await ctx.service
    .from("contract_signature_requests")
    .update({ status: "voided", voided_at: new Date().toISOString() })
    .eq("id", requestId)
    .in("status", ["sent", "viewed"])
    .select(REQUEST_COLUMNS)
    .maybeSingle();
  if (error) throw new HttpError(500, "The signature request could not be cancelled.");
  if (!data) throw new HttpError(409, "This request was already signed or cancelled.");
  return { request: data };
}

async function viewRequest(payload: Record<string, unknown>, ctx: Context) {
  const row = await findByToken(ctx.service, payload.token);
  if (row.status === "voided") {
    throw new HttpError(410, "This signing link is no longer active. Please contact Sabr Plan Co. for a new one.", "voided");
  }
  if (row.status === "signed") {
    return {
      status: "signed",
      clientName: row.client_name,
      signerName: row.signer_name,
      signedAt: row.signed_at,
      downloadUrl: await signedUrl(ctx.service, row.signed_path, 15 * 60),
    };
  }
  if (new Date(row.expires_at).getTime() < Date.now()) {
    throw new HttpError(410, "This signing link has expired. Please contact Sabr Plan Co. for a new one.", "expired");
  }
  if (!row.viewed_at) {
    await ctx.service
      .from("contract_signature_requests")
      .update({ status: "viewed", viewed_at: new Date().toISOString() })
      .eq("id", row.id)
      .eq("status", "sent");
  }
  return {
    status: "ready",
    clientName: row.client_name,
    expiresAt: row.expires_at,
    pdfUrl: await signedUrl(ctx.service, row.unsigned_path, 30 * 60),
  };
}

async function signRequest(request: Request, payload: Record<string, unknown>, ctx: Context) {
  const signerName = typeof payload.signerName === "string" ? payload.signerName.replace(/\s+/g, " ").trim() : "";
  const method = payload.method;
  const signature = typeof payload.signature === "string" ? payload.signature : "";
  if (signerName.length < 2 || signerName.length > 200) throw new HttpError(400, "Type your full name to sign.");
  if (payload.consent !== true) throw new HttpError(400, "Please agree to sign electronically before signing.");
  if (method !== "typed" && method !== "drawn") throw new HttpError(400, "Choose how you'd like to sign.");
  const signatureMatch = /^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/.exec(signature);
  if (!signatureMatch) throw new HttpError(400, "Your signature could not be read. Please try again.");
  const signaturePng = base64ToBytes(signatureMatch[1]);
  const pngHeader = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (signaturePng.length > MAX_SIGNATURE_BYTES || !pngHeader.every((byte, index) => signaturePng[index] === byte)) {
    throw new HttpError(400, "Your signature could not be read. Please try again.");
  }

  const row = await findByToken(ctx.service, payload.token);
  if (row.status === "signed") throw new HttpError(409, "This contract has already been signed.", "signed");
  if (row.status === "voided") {
    throw new HttpError(410, "This signing link is no longer active. Please contact Sabr Plan Co. for a new one.", "voided");
  }
  if (new Date(row.expires_at).getTime() < Date.now()) {
    throw new HttpError(410, "This signing link has expired. Please contact Sabr Plan Co. for a new one.", "expired");
  }

  const { data: file, error: downloadError } = await ctx.service.storage.from(BUCKET).download(row.unsigned_path);
  if (downloadError || !file) throw new HttpError(500, "The contract could not be loaded. Please try again.");
  const unsignedBytes = new Uint8Array(await file.arrayBuffer());
  // Make sure the document being signed is exactly the one that was sent.
  if (await sha256Hex(unsignedBytes) !== row.unsigned_sha256) {
    throw new HttpError(409, "This contract has changed since it was sent. Please contact Sabr Plan Co.");
  }

  const signedAt = new Date();
  const signerIp = (request.headers.get("x-forwarded-for") || request.headers.get("cf-connecting-ip") || "")
    .split(",")[0].trim().slice(0, 100);
  const signerUserAgent = (request.headers.get("user-agent") || "").slice(0, 500);
  let signedBytes: Uint8Array;
  try {
    signedBytes = await buildSignedPdf(unsignedBytes, {
      requestId: row.id,
      clientName: row.client_name,
      signerName,
      method,
      signaturePng,
      recipients: row.recipient_emails,
      sentAt: new Date(row.created_at),
      viewedAt: row.viewed_at ? new Date(row.viewed_at) : signedAt,
      signedAt,
      signerIp,
      signerUserAgent,
      unsignedSha256: row.unsigned_sha256,
    });
  } catch {
    throw new HttpError(400, "Your signature could not be added. Please try again.");
  }

  const signedPath = `${row.client_id}/signatures/${row.id}/signed-contract.pdf`;
  const { error: uploadError } = await ctx.service.storage
    .from(BUCKET)
    .upload(signedPath, signedBytes, { contentType: "application/pdf", upsert: false });
  if (uploadError) throw new HttpError(500, "Your signature could not be saved. Please try again.");

  // Only one signature can win, even if the button is pressed twice.
  const { data: updated, error: updateError } = await ctx.service
    .from("contract_signature_requests")
    .update({
      status: "signed",
      signed_at: signedAt.toISOString(),
      viewed_at: row.viewed_at || signedAt.toISOString(),
      signer_name: signerName,
      signature_method: method,
      signer_ip: signerIp || null,
      signer_user_agent: signerUserAgent || null,
      signed_path: signedPath,
      signed_sha256: await sha256Hex(signedBytes),
    })
    .eq("id", row.id)
    .in("status", ["sent", "viewed"])
    .select("id")
    .maybeSingle();
  if (updateError || !updated) {
    await ctx.service.storage.from(BUCKET).remove([signedPath]);
    throw new HttpError(409, "This contract has already been signed.", "signed");
  }

  // Email the signed copy to the couple, with a copy to the coordinator.
  let emailed = true;
  const subject = `Your signed wedding coordination contract – Sabr Plan Co.`;
  try {
    const messageId = await sendEmail({
      to: row.recipient_emails,
      bcc: [COORDINATOR_EMAIL],
      subject,
      text: `Hello,\n\nThank you for signing your wedding coordination contract. A copy of the signed agreement is attached for your records.\n\nWarmly,\nSabr Plan Co.`,
      attachment: { filename: `Sabr-Plan-Co-Signed-Contract.pdf`, content: bytesToBase64(signedBytes) },
    });
    await logDelivery(ctx.service, {
      client_id: row.client_id,
      recipient_emails: row.recipient_emails,
      subject,
      resend_message_id: messageId,
      sent_by: row.created_by,
    });
  } catch {
    emailed = false;
  }

  return {
    status: "signed",
    signedAt: signedAt.toISOString(),
    signerName,
    emailed,
    downloadUrl: await signedUrl(ctx.service, signedPath, 15 * 60),
  };
}

type Context = {
  origin: string;
  supabaseUrl: string;
  publishableKey: string;
  service: SupabaseClient;
};

Deno.serve(async (request) => {
  const allowedOrigins = (Deno.env.get("PORTAL_ALLOWED_ORIGINS") || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const requestOrigin = request.headers.get("Origin") || "";
  const origin = allowedOrigins.includes(requestOrigin) ? requestOrigin : "";

  if (request.method === "OPTIONS") {
    if (!origin) return new Response("Forbidden", { status: 403 });
    return new Response("ok", { headers: { ...corsHeaders, "Access-Control-Allow-Origin": origin } });
  }
  if (!origin) return new Response("Forbidden", { status: 403 });
  if (request.method !== "POST") return jsonResponse(405, { error: "Method not allowed." }, origin);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !publishableKey || !serviceKey) {
    return jsonResponse(500, { error: "Contract signing is not configured on the server." }, origin);
  }
  const ctx: Context = {
    origin,
    supabaseUrl,
    publishableKey,
    service: createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } }),
  };

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse(400, { error: "The request must contain valid JSON." }, origin);
  }

  try {
    let result: Record<string, unknown>;
    switch (payload.action) {
      case "create":
        result = await createRequest(request, payload, ctx);
        break;
      case "void":
        result = await voidRequest(request, payload, ctx);
        break;
      case "view":
        result = await viewRequest(payload, ctx);
        break;
      case "sign":
        result = await signRequest(request, payload, ctx);
        break;
      default:
        return jsonResponse(400, { error: "Unknown action." }, origin);
    }
    return jsonResponse(200, result, origin);
  } catch (error) {
    if (error instanceof HttpError) return jsonResponse(error.status, { error: error.message, code: error.code }, origin);
    console.error("contract-signing failed", error);
    return jsonResponse(500, { error: "Something went wrong. Please try again." }, origin);
  }
});
