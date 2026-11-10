import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};
const MAX_FILE_BYTES = 15 * 1024 * 1024;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function jsonResponse(status: number, body: Record<string, unknown>, origin: string) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Access-Control-Allow-Origin": origin,
      "Content-Type": "application/json",
    },
  });
}

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
  if (request.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed." }, origin || "null");
  }
  if (!origin) return new Response("Forbidden", { status: 403 });

  const authorization = request.headers.get("Authorization");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const sender = Deno.env.get("RESEND_FROM_EMAIL");
  if (!authorization || !supabaseUrl || !supabaseAnonKey || !resendApiKey || !sender) {
    return jsonResponse(500, { error: "Email delivery is not configured on the server." }, origin);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return jsonResponse(401, { error: "Sign in again before sending client documents." }, origin);
  }
  const { data: admin, error: adminError } = await supabase
    .from("portal_admins")
    .select("user_id")
    .eq("user_id", userData.user.id)
    .maybeSingle();
  if (adminError || !admin) {
    return jsonResponse(403, { error: "Only approved portal admins can send client documents." }, origin);
  }

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse(400, { error: "The email request must contain valid JSON." }, origin);
  }

  const clientId = typeof payload.clientId === "string" ? payload.clientId : "";
  const documentType = payload.documentType;
  const recipients = payload.recipients;
  const subject = typeof payload.subject === "string" ? payload.subject.trim() : "";
  const message = typeof payload.message === "string" ? payload.message.trim() : "";
  const attachments = payload.attachments;
  if (
    !UUID_PATTERN.test(clientId) ||
    (documentType !== "contract" && documentType !== "itinerary") ||
    !Array.isArray(recipients) ||
    recipients.length < 1 ||
    recipients.length > 5 ||
    !recipients.every((recipient) => typeof recipient === "string" && EMAIL_PATTERN.test(recipient)) ||
    !subject ||
    subject.length > 200 ||
    /[\r\n]/.test(subject) ||
    !message ||
    message.length > 5000 ||
    !Array.isArray(attachments) ||
    attachments.length !== 1
  ) {
    return jsonResponse(400, { error: "Check the recipient, message, and selected document, then try again." }, origin);
  }

  const attachment = attachments[0];
  if (
    !attachment ||
    typeof attachment.filename !== "string" ||
    !/^[a-zA-Z0-9][a-zA-Z0-9._ -]{0,119}\.pdf$/i.test(attachment.filename) ||
    typeof attachment.content !== "string" ||
    attachment.content.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(attachment.content)
  ) {
    return jsonResponse(400, { error: "The selected attachment is not a valid PDF." }, origin);
  }
  const decodedSize = Math.floor(attachment.content.length * 3 / 4) -
    (attachment.content.endsWith("==") ? 2 : attachment.content.endsWith("=") ? 1 : 0);
  if (decodedSize <= 5 || decodedSize > MAX_FILE_BYTES) {
    return jsonResponse(413, { error: "The PDF must be smaller than 15 MB." }, origin);
  }
  const pdfHeader = atob(attachment.content.slice(0, 1368));
  if (!pdfHeader.includes("%PDF-")) {
    return jsonResponse(400, { error: "The attachment does not appear to be a PDF." }, origin);
  }

  const clientResult = await supabase
    .from("clients")
    .select("id")
    .eq("id", clientId)
    .single();
  if (clientResult.error) {
    return jsonResponse(404, { error: "The client workspace could not be found." }, origin);
  }

  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: sender,
      to: recipients,
      reply_to: "sabrplanco@gmail.com",
      subject,
      text: message,
      attachments: [{ filename: attachment.filename, content: attachment.content }],
    }),
  });
  const resendResult = await resendResponse.json().catch(() => ({}));
  if (!resendResponse.ok || typeof resendResult.id !== "string") {
    // Resend's error text (e.g. an unverified domain) is safe to show the admin and explains the fix.
    const providerMessage = typeof resendResult.message === "string"
      ? resendResult.message.replace(/\s+/g, " ").trim().slice(0, 300)
      : "";
    console.error("Resend rejected the email", resendResponse.status, resendResult);
    return jsonResponse(502, {
      error: providerMessage
        ? `The email provider rejected this message: ${providerMessage}`
        : "The email provider could not send this message. Check the sender setup and try again.",
    }, origin);
  }

  const { error: logError } = await supabase.from("email_deliveries").insert({
    client_id: clientId,
    document_type: documentType,
    recipient_emails: recipients,
    subject,
    resend_message_id: resendResult.id,
    sent_by: userData.user.id,
  });
  return jsonResponse(200, {
    sent: true,
    logged: !logError,
    warning: logError ? "The email was sent, but its delivery record could not be saved." : undefined,
  }, origin);
});
