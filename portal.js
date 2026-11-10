const loginScreen = document.querySelector("#portal-login");
const portalApp = document.querySelector("#portal-app");
const clientDialog = document.querySelector("#client-dialog");
const clientForm = document.querySelector("#client-form");
const documentPanel = document.querySelector("#document-panel");
const signInForm = document.querySelector("#portal-signin-form");
const recoveryForm = document.querySelector("#portal-recovery-form");
const passwordForm = document.querySelector("#portal-password-form");
const signInButton = document.querySelector("#portal-signin-button");
const recoveryButton = document.querySelector("#portal-recovery-button");
const passwordButton = document.querySelector("#portal-password-button");
const signInStatus = document.querySelector("#portal-login-status");
const recoveryLink = document.querySelector("#show-password-recovery");
const clientSubmitButton = document.querySelector("#portal-client-submit");
const clientStatus = document.querySelector("#portal-client-status");
const supabaseConfig = window.PORTAL_CONFIG;
const supabaseSdk = window.supabase;
const supabaseClient =
  supabaseConfig?.supabaseUrl &&
  supabaseConfig?.supabasePublishableKey &&
  supabaseSdk?.createClient
    ? supabaseSdk.createClient(
        supabaseConfig.supabaseUrl,
        supabaseConfig.supabasePublishableKey,
      )
    : null;
const today = new Date();
today.setHours(0, 0, 0, 0);

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const clients = [];
const documents = new Map();
const contractServices = [
  "Creating an itinerary with the client 2 weeks prior to the event. 2 coordinator 2 hours prior to the event start time till the end of the event.",
  "Reaching out to all vendors 2 weeks prior and the day of to discuss timelines.",
  "Consultation calls and pre planning calls to discuss any chances or updates on the event.",
  "Helping with set up, ensuring decors are as planned and confirming all orders with vendors.",
  "Taking care of bride's to do list, greeting guests, placing guests based on seating chart.",
  "Organizing bridal party, groomsmen and family entrances.",
  "Assist with photography, music and any necessary announcements, coordinate time with DJ/MC.",
  "Communicate with catering service to ensure food is served on time.",
  "Getting on calls any time to adjust any changed vendors, plans, and making sure there is an open communication with client of their expectations.",
  "Any Additional help needed throughout the event to ensure the couple and their families are enjoying the event!",
  "Insurance will be provided upon request.",
];
const contractCancellationTerms = [
  "By Client. The Client may cancel this Contract at any time. If the Client cancels up to 3 months prior to the Wedding Day, the Client will be entitled to a full refund, except for the non-refundable deposit. If the Client cancels less than 1 week prior to the Wedding Day, the Client will not be entitled to a refund. In the event of a death of a family, refund will be made due to cancellation any time except for the non-refundable deposit.",
  "By Planner. If the Planner cancels, the Planner must provide a suitable, replacement planner, subject to the Client’s approval, which shall be obtained in writing. In the alternative, the Planner shall refund all monies previously paid by the Client, including any non-refundable deposits. In the event the Planner finds a suitable replacement planner, the Planner shall forward all monies previously paid by the Client to the replacement planner, less any monies the replacement planner agrees have been earned by the Planner for services performed until the date of cancellation.",
];
let activeClientId = null;
let activeDocument = "contract";
let activeView = "calendar";
let calendarMonth = new Date(today.getFullYear(), today.getMonth(), 1);
let selectedDate = toDateKey(today);
let recoverySession = null;
const PORTAL_THEME_KEY = "sabrplanco-portal-theme";

function applyPortalTheme(theme, persist = false) {
  const selectedTheme = theme === "dark" ? "dark" : "light";
  portalApp.dataset.theme = selectedTheme;
  document.querySelectorAll("[data-theme-option]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.themeOption === selectedTheme));
  });
  if (persist) localStorage.setItem(PORTAL_THEME_KEY, selectedTheme);
}

applyPortalTheme(localStorage.getItem(PORTAL_THEME_KEY) || "light");

function showLoginMode(mode) {
  signInForm.hidden = mode !== "sign-in";
  recoveryForm.hidden = mode !== "request-recovery";
  passwordForm.hidden = mode !== "update-password";
  recoveryLink.hidden = mode !== "sign-in";
  signInStatus.classList.remove("is-success");
  signInStatus.textContent = "";
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function formatDate(dateString, options = { month: "long", day: "numeric", year: "numeric" }) {
  if (!dateString) return "Date not set";
  return new Date(`${dateString}T12:00:00`).toLocaleDateString("en-US", options);
}

function getDocumentState(clientId, type) {
  if (!documents.has(clientId)) documents.set(clientId, {});
  const clientDocuments = documents.get(clientId);
  if (!clientDocuments[type]) {
    clientDocuments[type] = {
      events: [{ phase: "event", title: "", start: "", end: "", vendor: "", notes: "" }],
      aiNotes: "",
      aiOtherNotes: "",
      eventDate: "",
      eventVenue: "",
      itineraryClientName: "",
      otherNotes: "",
      mode: "create",
      uploadUrl: "",
      uploadName: "",
      uploadKept: false,
      pendingFile: null,
      uploadedDocument: null,
      savedDraft: null,
      viewSource: "",
      pdfPageNumber: 1,
      pdfDocument: null,
      pdfRenderToken: 0,
    };
  }
  return clientDocuments[type];
}

function emptyItineraryEvent() {
  return { phase: "event", title: "", start: "", end: "", vendor: "", notes: "" };
}

function normalizeItineraryEvents(events) {
  return events.map((event) => {
    const item = event && typeof event === "object" ? event : {};
    return {
      phase: item.phase === "pre-event" ? "pre-event" : "event",
      title: typeof item.title === "string" ? item.title : "",
      start: typeof item.start === "string" ? item.start : "",
      end: typeof item.end === "string" ? item.end : "",
      vendor: typeof item.vendor === "string" ? item.vendor : "",
      notes: typeof item.notes === "string" ? item.notes : "",
    };
  });
}

function readItineraryEvents(form) {
  return [...form.querySelectorAll(".portal-event-row")].map((row) => ({
    phase: row.querySelector('[name="event-phase"]').value,
    title: row.querySelector('[name="event-title"]').value.trim(),
    start: parseTimeInput(
      row.querySelector('[name="event-start"]').value,
      row.querySelector('[name="event-start-period"]').value,
    ),
    end: parseTimeInput(
      row.querySelector('[name="event-end"]').value,
      row.querySelector('[name="event-end-period"]').value,
    ),
    vendor: row.querySelector('[name="event-vendor"]').value.trim(),
    notes: row.querySelector('[name="event-notes"]').value.trim(),
  }));
}

function serviceLabel(service) {
  return service === "day_of_coordination" ? "Day-of coordination" : "Wedding planning";
}

let portalNoticeTimer;

function hidePortalNotice() {
  window.clearTimeout(portalNoticeTimer);
  document.querySelector("#portal-data-notice").hidden = true;
}

// Errors stay visible until replaced; confirmations hide themselves after a few seconds.
function setPortalNotice(message, isError = false) {
  const notice = document.querySelector("#portal-data-notice");
  window.clearTimeout(portalNoticeTimer);
  notice.classList.toggle("is-error", isError);
  notice.innerHTML = `<strong>${isError ? "Action needed." : "Done."}</strong> ${escapeHtml(message)}`;
  notice.hidden = false;
  if (!isError) portalNoticeTimer = window.setTimeout(hidePortalNotice, 6000);
}

function revokePreviewUrl(url) {
  if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
}

const PDF_PAGE_WIDTH = 612;
const PDF_MARGIN = 48;
const PDF_CONTENT_BOTTOM = 738;
const PDF_COLORS = {
  ink: [56, 41, 31],
  muted: [128, 101, 77],
  accent: [150, 106, 77],
  line: [217, 203, 187],
  stripe: [247, 242, 235],
};
let scriptLogoImagePromise;

function normalizePdfText(value) {
  return String(value ?? "")
    .replace(/[–—]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\u00a0/g, " ");
}

function loadScriptLogoImage() {
  if (!scriptLogoImagePromise) {
    scriptLogoImagePromise = new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = image.naturalWidth;
          canvas.height = image.naturalHeight;
          const context = canvas.getContext("2d");
          if (!context) throw new Error("The logo could not be prepared for PDF export.");
          context.drawImage(image, 0, 0);
          resolve(canvas.toDataURL("image/png"));
        } catch (error) {
          scriptLogoImagePromise = null;
          reject(error);
        }
      };
      image.onerror = () => {
        scriptLogoImagePromise = null;
        reject(new Error("The Sabr Plan Co. script logo could not be loaded for the PDF."));
      };
      image.src = new URL("../assets/sabr-script.png", document.baseURI).href;
    });
  }
  return scriptLogoImagePromise;
}

function drawPdfBrandHeader(pdf, scriptLogo) {
  const logoWidth = 150;
  const logoHeight = logoWidth * (320 / 660);
  pdf.addImage(scriptLogo, "PNG", (PDF_PAGE_WIDTH - logoWidth) / 2, 16, logoWidth, logoHeight);
  pdf.setFont("times", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(...PDF_COLORS.ink);
  pdf.text("P L A N   C O.", PDF_PAGE_WIDTH / 2, 101, { align: "center" });
  pdf.setDrawColor(...PDF_COLORS.line);
  pdf.setLineWidth(0.55);
  pdf.line(PDF_MARGIN + 145, 98, PDF_PAGE_WIDTH / 2 - 42, 98);
  pdf.line(PDF_PAGE_WIDTH / 2 + 42, 98, PDF_PAGE_WIDTH - PDF_MARGIN - 145, 98);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7.5);
  pdf.setTextColor(...PDF_COLORS.muted);
  pdf.text("WEDDING PLANNING & COORDINATION", PDF_PAGE_WIDTH / 2, 117, { align: "center" });
  pdf.setDrawColor(...PDF_COLORS.line);
  pdf.line(PDF_MARGIN, 130, PDF_PAGE_WIDTH - PDF_MARGIN, 130);
}

function createVectorPdfDocument(title) {
  const JsPDF = window.jspdf?.jsPDF || window.jsPDF;
  if (typeof JsPDF !== "function") {
    throw new Error("The vector PDF library did not load. Check your connection and reload the portal.");
  }
  const pdf = new JsPDF({ unit: "pt", format: "letter", compress: true });
  pdf.setProperties({ title, author: "Sabr Plan Co.", subject: "Wedding coordination" });
  let y = PDF_MARGIN;
  const contentWidth = PDF_PAGE_WIDTH - PDF_MARGIN * 2;

  function addPage() {
    pdf.addPage();
    y = PDF_MARGIN;
  }

  function ensureSpace(height) {
    if (y + height > PDF_CONTENT_BOTTOM) addPage();
  }

  function drawParagraph(value, options = {}) {
    const {
      x = PDF_MARGIN,
      width = contentWidth,
      size = 9,
      font = "helvetica",
      style = "normal",
      color = PDF_COLORS.ink,
      after = 4,
      indentContinuation = 0,
    } = options;
    const text = normalizePdfText(value).trim();
    if (!text) return;
    const lineHeight = size * 1.4;
    pdf.setFont(font, style);
    pdf.setFontSize(size);
    pdf.setTextColor(...color);
    const lines = pdf.splitTextToSize(text, width);
    lines.forEach((line, index) => {
      ensureSpace(lineHeight);
      pdf.text(line, x + (index > 0 ? indentContinuation : 0), y);
      y += lineHeight;
    });
    y += after;
  }

  function drawSectionHeading(text) {
    ensureSpace(58);
    drawParagraph(text.toUpperCase(), {
      size: 9,
      style: "bold",
      color: PDF_COLORS.accent,
      after: 5,
    });
    pdf.setDrawColor(...PDF_COLORS.line);
    pdf.setLineWidth(0.65);
    pdf.line(PDF_MARGIN, y - 2, PDF_PAGE_WIDTH - PDF_MARGIN, y - 2);
    y += 5;
  }

  function drawDetail(label, value) {
    const size = 8.5;
    const lineHeight = size * 1.4;
    const labelText = `${normalizePdfText(label)}: `;
    const safeValue = normalizePdfText(value || "—");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(size);
    pdf.setTextColor(...PDF_COLORS.ink);
    const labelWidth = pdf.getTextWidth(labelText);
    const firstLineWidth = Math.max(100, contentWidth - labelWidth);
    const valueLines = pdf.splitTextToSize(safeValue, firstLineWidth);
    ensureSpace(valueLines.length * lineHeight + 2);
    pdf.text(labelText, PDF_MARGIN, y);
    pdf.setFont("helvetica", "normal");
    pdf.text(valueLines[0] || "", PDF_MARGIN + labelWidth, y);
    y += lineHeight;
    valueLines.slice(1).forEach((line) => {
      ensureSpace(lineHeight);
      pdf.text(line, PDF_MARGIN + labelWidth, y);
      y += lineHeight;
    });
    y += 2;
  }

  function drawBullet(value) {
    ensureSpace(14);
    const x = PDF_MARGIN + 10;
    pdf.setFillColor(...PDF_COLORS.accent);
    pdf.circle(PDF_MARGIN + 2, y - 2.5, 1.5, "F");
    drawParagraph(value, { x, width: contentWidth - 10, size: 8.4, after: 4 });
  }

  function drawTableHeader(columns) {
    const rowHeight = 24;
    ensureSpace(rowHeight + 12);
    pdf.setFillColor(...PDF_COLORS.stripe);
    pdf.rect(PDF_MARGIN, y, contentWidth, rowHeight, "F");
    pdf.setDrawColor(...PDF_COLORS.line);
    pdf.setLineWidth(0.5);
    pdf.line(PDF_MARGIN, y + rowHeight, PDF_PAGE_WIDTH - PDF_MARGIN, y + rowHeight);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.5);
    pdf.setTextColor(...PDF_COLORS.muted);
    let x = PDF_MARGIN + 6;
    columns.forEach((column) => {
      pdf.text(column.label.toUpperCase(), x, y + 15);
      x += column.width;
    });
    y += rowHeight;
  }

  function drawTableRow(values, columns, rowIndex) {
    const fontSize = 8;
    const lineHeight = 10.5;
    const padding = 7;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(fontSize);
    const cellLines = values.map((value, index) => pdf.splitTextToSize(
      normalizePdfText(value || "—"),
      columns[index].width - padding * 2,
    ));
    const totalLines = Math.max(1, ...cellLines.map((lines) => lines.length));
    const fullHeight = totalLines * lineHeight + padding * 2;
    if (fullHeight <= PDF_CONTENT_BOTTOM - PDF_MARGIN - 24) {
      if (y + fullHeight > PDF_CONTENT_BOTTOM) {
        addPage();
        drawTableHeader(columns);
      }
      renderTableSegment(cellLines, columns, 0, totalLines, fullHeight, rowIndex);
      return;
    }

    let offset = 0;
    while (offset < totalLines) {
      if (PDF_CONTENT_BOTTOM - y < lineHeight + padding * 2) {
        addPage();
        drawTableHeader(columns);
      }
      const availableLines = Math.max(
        1,
        Math.floor((PDF_CONTENT_BOTTOM - y - padding * 2) / lineHeight),
      );
      const segmentLines = Math.min(availableLines, totalLines - offset);
      const segmentHeight = segmentLines * lineHeight + padding * 2;
      renderTableSegment(cellLines, columns, offset, segmentLines, segmentHeight, rowIndex);
      offset += segmentLines;
      if (offset < totalLines) {
        addPage();
        drawTableHeader(columns);
      }
    }
  }

  function renderTableSegment(cellLines, columns, offset, lineCount, rowHeight, rowIndex) {
    if (rowIndex % 2 === 1) {
      pdf.setFillColor(...PDF_COLORS.stripe);
      pdf.rect(PDF_MARGIN, y, contentWidth, rowHeight, "F");
    }
    pdf.setDrawColor(...PDF_COLORS.line);
    pdf.setLineWidth(0.35);
    pdf.line(PDF_MARGIN, y + rowHeight, PDF_PAGE_WIDTH - PDF_MARGIN, y + rowHeight);
    let x = PDF_MARGIN + 6;
    cellLines.forEach((lines, index) => {
      pdf.setFont("helvetica", index === 0 ? "bold" : "normal");
      pdf.setFontSize(index === 0 ? 8 : 7.8);
      pdf.setTextColor(...(index === 0 ? PDF_COLORS.accent : PDF_COLORS.ink));
      lines.slice(offset, offset + lineCount).forEach((line, lineIndex) => {
        pdf.text(line, x, y + 10 + lineIndex * 10.5);
      });
      x += columns[index].width;
    });
    y += rowHeight;
  }

  function addPageNumbers() {
    const pageCount = pdf.getNumberOfPages();
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      pdf.setPage(pageNumber);
      pdf.setDrawColor(...PDF_COLORS.line);
      pdf.setLineWidth(0.5);
      pdf.line(PDF_MARGIN, 756, PDF_PAGE_WIDTH - PDF_MARGIN, 756);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7);
      pdf.setTextColor(...PDF_COLORS.muted);
      pdf.text("SABR PLAN CO.  |  PRIVATE COORDINATION DOCUMENT", PDF_MARGIN, 772);
      pdf.text(`${pageNumber} / ${pageCount}`, PDF_PAGE_WIDTH - PDF_MARGIN, 772, { align: "right" });
    }
  }

  return {
    pdf,
    contentWidth,
    drawParagraph,
    drawSectionHeading,
    drawDetail,
    drawBullet,
    drawTableHeader,
    drawTableRow,
    addPageNumbers,
    ensureSpace,
    get y() { return y; },
    set y(value) { y = value; },
  };
}

function drawItineraryPdf(state, client, scriptLogo) {
  const draft = state.savedDraft;
  const layout = createVectorPdfDocument("Sabr Plan Co. Wedding Day Itinerary");
  const { pdf, contentWidth, drawParagraph, drawSectionHeading, drawTableHeader, drawTableRow } = layout;
  drawPdfBrandHeader(pdf, scriptLogo);
  layout.y = 146;

  drawParagraph("WEDDING DAY ITINERARY", {
    x: PDF_MARGIN,
    width: contentWidth,
    font: "times",
    style: "bold",
    size: 17,
    after: 3,
  });
  drawParagraph(draft.venue || "Wedding day timeline", { size: 11, style: "bold", after: 9 });
  drawParagraph(`Couple: ${draft.clientName || client.name}    |    Wedding Date: ${formatDate(draft.date)}`, {
    size: 8.5,
    color: PDF_COLORS.muted,
    after: 3,
  });
  drawParagraph(`Venue: ${draft.venue || client.venue || "To be confirmed"}`, {
    size: 8.5,
    color: PDF_COLORS.muted,
    after: 10,
  });

  const columns = [
    { label: "Time", width: 82 },
    { label: "Event", width: 135 },
    { label: "Vendor", width: 100 },
    { label: "Notes", width: contentWidth - 317 },
  ];
  const events = normalizeItineraryEvents(Array.isArray(draft.events) ? draft.events : [])
    .filter((event) => event.title);
  [
    { phase: "pre-event", title: "Pre-Event" },
    { phase: "event", title: "Event" },
  ].forEach(({ phase, title }) => {
    const sectionEvents = events.filter((event) => event.phase === phase);
    drawSectionHeading(title);
    drawTableHeader(columns);
    if (!sectionEvents.length) {
      drawTableRow(["—", "No events added.", "—", "—"], columns, 0);
      return;
    }
    sectionEvents.forEach((event, index) => {
      const start = event.start ? formatTime(event.start) : "";
      const end = event.end ? formatTime(event.end) : "";
      const time = start && end ? `${start} - ${end}` : start || end || "—";
      drawTableRow([time, event.title, event.vendor || "—", event.notes || "—"], columns, index);
    });
    layout.y += 8;
  });
  if (typeof draft.otherNotes === "string" && draft.otherNotes.trim()) {
    drawSectionHeading("Other Notes");
    drawParagraph(draft.otherNotes.trim(), { size: 8.5, after: 2 });
  }
  layout.addPageNumbers();
  return pdf;
}

function drawContractPdf(state, scriptLogo) {
  const draft = state.savedDraft;
  const layout = createVectorPdfDocument("Sabr Plan Co. Wedding Coordination Agreement");
  const { pdf, drawParagraph, drawSectionHeading, drawDetail, drawBullet, addPageNumbers, ensureSpace } = layout;
  const amounts = calculateContractAmounts(draft.totalFee, draft.depositPercentage);
  const dates = draft.eventDates || (draft.date ? `Wedding Day | ${formatDate(draft.date)}` : "");
  const location = draft.eventLocation || draft.venue || "";

  drawPdfBrandHeader(pdf, scriptLogo);
  layout.y = 146;

  drawParagraph("COORDINATION AGREEMENT", {
    font: "helvetica",
    style: "bold",
    size: 8,
    color: PDF_COLORS.accent,
    after: 4,
  });
  drawParagraph("Wedding Coordination Services Agreement", {
    font: "times",
    style: "bold",
    size: 17,
    after: 12,
  });

  drawSectionHeading("Client & Event Details");
  [
    ["Company", "Sabr Plan Co."],
    ["Client Name", draft.clientName || draft.name || "—"],
    ["Client Contact", draft.clientContact || "—"],
    ["Email", draft.clientEmail || "—"],
    ["Event Dates", dates || "—"],
    ["Event Location", location || "—"],
  ].forEach(([label, value]) => drawDetail(label, value));

  drawSectionHeading("Fees & Payment");
  drawDetail("Total Fee for Services", `${formatCurrency(amounts?.total)} incl. Travel Fees`);
  drawDetail(
    "Non-Refundable Deposit Due Upon Execution of Contract",
    `${formatPercentage(draft.depositPercentage)}% (${formatCurrency(amounts?.deposit)}) via Zelle; (929) 240-2040`,
  );
  drawDetail("Balance", `${formatCurrency(amounts?.balance)} due by ${dates || "the event date"} via Cash`);
  drawDetail("Balance Due Date", "Day of Event (Cash/Check/Zelle)");

  drawSectionHeading("Day of Coordination Services");
  contractServices.forEach(drawBullet);

  drawSectionHeading("Terms & Cancellations");
  contractCancellationTerms.forEach((term) => drawParagraph(term, { size: 8.2, after: 7 }));

  drawSectionHeading("Photo & Video Authorization");
  drawParagraph(
    "Client authorizes posting photos/videos on social media and publication to magazines and websites.",
    { size: 8.5, after: 6 },
  );

  drawSectionHeading("Questions");
  drawParagraph("Any additional inquiries or questions, please feel free to reach out at", {
    size: 8.5,
    after: 2,
  });
  drawParagraph("sabrplanco@gmail.com  |  (929) 240-2040", {
    size: 8.5,
    style: "bold",
    after: 8,
  });

  ensureSpace(55);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(...PDF_COLORS.ink);
  const signatureGap = 32;
  const signatureWidth = (PDF_PAGE_WIDTH - PDF_MARGIN * 2 - signatureGap) / 2;
  const signatureY = layout.y + 8;
  pdf.setDrawColor(...PDF_COLORS.muted);
  pdf.line(PDF_MARGIN, signatureY, PDF_MARGIN + signatureWidth, signatureY);
  pdf.line(PDF_MARGIN + signatureWidth + signatureGap, signatureY, PDF_PAGE_WIDTH - PDF_MARGIN, signatureY);
  pdf.text("Signature of Client", PDF_MARGIN, signatureY + 13);
  pdf.text("Signature of Coordinator", PDF_MARGIN + signatureWidth + signatureGap, signatureY + 13);
  pdf.text("Prioti Taher", PDF_MARGIN + signatureWidth + signatureGap, signatureY + 25);
  layout.y = signatureY + 35;
  drawParagraph("DRAFT FOR REVIEW - NOT A SIGNED CONTRACT", {
    x: PDF_MARGIN,
    width: PDF_PAGE_WIDTH - PDF_MARGIN * 2,
    size: 7,
    color: PDF_COLORS.muted,
    after: 0,
  });
  addPageNumbers();
  return pdf;
}

async function createVectorPdf(type, state, client) {
  if (!state?.savedDraft) throw new Error("Save the document draft before exporting a PDF.");
  const scriptLogo = await loadScriptLogoImage();
  const pdf = type === "itinerary"
    ? drawItineraryPdf(state, client, scriptLogo)
    : drawContractPdf(state, scriptLogo);
  return pdf.output("blob");
}

function mapClientRow(row) {
  return {
    id: row.id,
    name: row.couple_name,
    date: row.wedding_date,
    service: serviceLabel(row.service),
    venue: row.venue || "",
  };
}

async function loadPortalData() {
  const { data, error } = await supabaseClient
    .from("clients")
    .select("id, couple_name, wedding_date, service, venue")
    .order("wedding_date", { ascending: true });
  if (error) throw new Error(`Could not load client workspaces: ${error.message}`);
  clients.splice(0, clients.length, ...data.map(mapClientRow));
  documents.clear();
  renderAll();
}

function showView(view) {
  activeView = view;
  document.querySelectorAll(".portal-view").forEach((section) => {
    const visible = section.id === `${view}-view`;
    section.hidden = !visible;
    section.classList.toggle("is-visible", visible);
  });
  document.querySelectorAll(".portal-nav-item").forEach((button) => {
    const selected = button.dataset.view === (view === "workspace" ? "clients" : view);
    button.classList.toggle("is-active", selected);
    if (selected) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  const titles = { calendar: "Your calendar", clients: "Your clients", workspace: "Client workspace", empty: "Your clients", settings: "Portal settings" };
  document.querySelector("#portal-page-title").textContent = titles[view] || "Coordinator portal";
}

function renderSummary() {
  const upcomingClients = clients.filter((client) => {
    const weddingDate = new Date(`${client.date}T12:00:00`);
    return weddingDate >= today;
  }).sort((a, b) => a.date.localeCompare(b.date));
  document.querySelector("#portal-summary").innerHTML = `
    <article class="portal-summary-card">
      <span class="portal-summary-icon" aria-hidden="true">♡</span>
      <span><small>Active couples</small><strong>${clients.length}</strong></span>
    </article>
    <article class="portal-summary-card">
      <span class="portal-summary-icon" aria-hidden="true">▦</span>
      <span><small>Upcoming weddings</small><strong>${upcomingClients.length}</strong></span>
    </article>
    <article class="portal-summary-card">
      <span class="portal-summary-icon" aria-hidden="true">✧</span>
      <span><small>Next celebration</small><strong>${escapeHtml(upcomingClients[0] ? formatDate(upcomingClients[0].date, { month: "short", day: "numeric" }) : "—")}</strong></span>
    </article>`;
}

function renderCalendar() {
  const year = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const label = calendarMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  document.querySelector("#calendar-month-label").textContent = label;

  const cells = [];
  for (let blank = 0; blank < firstDay; blank += 1) {
    cells.push('<span class="calendar-day is-outside" aria-hidden="true"></span>');
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day);
    const dateKey = toDateKey(date);
    const matchingClients = clients.filter((client) => client.date === dateKey);
    const labels = matchingClients.map((client) => client.name).join(", ");
    const isToday = dateKey === toDateKey(today);
    const isSelected = dateKey === selectedDate;
    cells.push(`
      <button class="calendar-day${matchingClients.length ? " has-wedding" : ""}${isSelected ? " is-selected" : ""}${isToday ? " is-today" : ""}"
        type="button" data-date="${dateKey}" aria-pressed="${isSelected}"
        aria-label="${escapeHtml(formatDate(dateKey, { weekday: "long", month: "long", day: "numeric", year: "numeric" }))}${labels ? `, ${escapeHtml(labels)}` : ""}">
        <span class="calendar-day-number">${day}</span>
        ${matchingClients.map((client) => `<span class="calendar-day-event">${escapeHtml(client.name)}</span>`).join("")}
      </button>`);
  }
  document.querySelector("#calendar-grid").innerHTML = cells.join("");
  renderSelectedDay();
  renderAgenda();
}

function renderSelectedDay() {
  const selectedClients = clients
    .filter((client) => client.date === selectedDate)
    .sort((a, b) => a.name.localeCompare(b.name));
  document.querySelector("#selected-day-heading").textContent = formatDate(selectedDate, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const list = document.querySelector("#selected-day-list");
  if (!selectedClients.length) {
    list.innerHTML = '<p class="portal-muted">No weddings scheduled for this date.</p>';
    return;
  }

  list.innerHTML = selectedClients.map((client) => `
    <button class="portal-selected-event" type="button" data-open-client="${escapeHtml(client.id)}">
      <span class="portal-selected-event-icon" aria-hidden="true">♡</span>
      <span class="portal-selected-event-copy">
        <strong>${escapeHtml(client.name)}</strong>
        <small>${escapeHtml(client.service)}${client.venue ? ` · ${escapeHtml(client.venue)}` : ""}</small>
      </span>
      <span class="portal-agenda-arrow" aria-hidden="true">Open workspace ↗︎</span>
    </button>`).join("");
}

function renderAgenda() {
  const upcoming = clients
    .filter((client) => new Date(`${client.date}T12:00:00`) >= today)
    .sort((a, b) => a.date.localeCompare(b.date));
  const list = document.querySelector("#upcoming-list");
  if (!upcoming.length) {
    list.innerHTML = '<p class="portal-muted">No upcoming weddings yet. Add a client to get started.</p>';
    return;
  }
  list.innerHTML = upcoming.map((client) => `
    <button class="portal-agenda-item" type="button" data-open-client="${escapeHtml(client.id)}">
      <span class="portal-agenda-date"><strong>${new Date(`${client.date}T12:00:00`).getDate()}</strong><small>${new Date(`${client.date}T12:00:00`).toLocaleDateString("en-US", { month: "short" })}</small></span>
      <span class="portal-agenda-copy"><strong>${escapeHtml(client.name)}</strong><small>${escapeHtml(client.venue || client.service)}</small></span>
      <span class="portal-agenda-arrow" aria-hidden="true">↗︎</span>
    </button>`).join("");
}

function renderClients() {
  const grid = document.querySelector("#client-grid");
  grid.innerHTML = clients.map((client) => `
    <button class="portal-client-card" type="button" data-open-client="${escapeHtml(client.id)}">
      <span class="portal-client-card-top"><span class="portal-client-avatar" aria-hidden="true">♡</span><span class="portal-agenda-arrow" aria-hidden="true">↗︎</span></span>
      <strong>${escapeHtml(client.name)}</strong>
      <span class="portal-client-date">${escapeHtml(formatDate(client.date))}</span>
      <span class="portal-client-service">${escapeHtml(client.service)}</span>
      <span class="portal-client-venue">${escapeHtml(client.venue || "Venue to be confirmed")}</span>
    </button>`).join("");
}

function renderDocument(clientId = activeClientId) {
  const client = clients.find((item) => item.id === clientId);
  if (!client) return;
  const state = getDocumentState(client.id, activeDocument);
  document.querySelectorAll(".portal-document-link").forEach((button) => {
    const selected = button.dataset.document === activeDocument;
    button.classList.toggle("is-active", selected);
    if (selected) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  documentPanel.innerHTML = activeDocument === "itinerary"
    ? renderItinerary(client, state)
    : renderContract(client, state);
  if ((state.mode === "view" || state.mode === "upload") && state.uploadUrl) renderPdfPage(state);
}

function renderDocumentModeButtons(type, state) {
  const hasSavedDocument = Boolean(state.uploadedDocument || state.savedDraft);
  return `
    <div class="portal-mode-tabs" role="tablist" aria-label="${type === "itinerary" ? "Itinerary" : "Contract"} options">
      ${hasSavedDocument ? `<button type="button" class="portal-mode-tab${state.mode === "view" ? " is-active" : ""}" data-mode="view" role="tab" aria-selected="${state.mode === "view"}">View ${type}</button>` : ""}
      <button type="button" class="portal-mode-tab${state.mode === "create" ? " is-active" : ""}" data-mode="create" role="tab" aria-selected="${state.mode === "create"}">Create from template</button>
      <button type="button" class="portal-mode-tab${state.mode === "upload" ? " is-active" : ""}" data-mode="upload" role="tab" aria-selected="${state.mode === "upload"}">Upload PDF</button>
    </div>`;
}

function renderPdfCanvas(state) {
  return `<div class="portal-pdf-viewer">
    <div class="portal-pdf-toolbar">
      <span class="portal-pdf-toolbar-label">DOCUMENT PREVIEW</span>
      <div class="portal-pdf-pagination">
        <button type="button" class="portal-pdf-page-button" data-pdf-page="previous" aria-label="Previous PDF page">‹</button>
        <span><span data-pdf-current-page>1</span><span class="portal-pdf-page-divider"> / </span><span data-pdf-total-pages>…</span></span>
        <button type="button" class="portal-pdf-page-button" data-pdf-page="next" aria-label="Next PDF page">›</button>
      </div>
    </div>
    <div class="portal-pdf-canvas-wrap">
      <canvas data-pdf-canvas aria-label="PDF page preview"></canvas>
      <p class="portal-pdf-loading" data-pdf-status role="status">Preparing document preview…</p>
    </div>
  </div>`;
}

function waitForPdfOperation(operation) {
  let timeoutId;
  return Promise.race([
    operation,
    new Promise((resolve, reject) => {
      timeoutId = window.setTimeout(
        () => reject(new Error("PDF preview took too long to load. Reload the document and try again.")),
        15000,
      );
    }),
  ]).finally(() => window.clearTimeout(timeoutId));
}

async function extractItineraryTextFromPdf(file) {
  const pdfjs = window.pdfjsLib;
  if (!pdfjs) throw new Error("The PDF text library did not load. Reload the page and try again.");
  pdfjs.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
  const loadingTask = pdfjs.getDocument({ data: await file.arrayBuffer(), isEvalSupported: false });
  try {
    const pdfDocument = await waitForPdfOperation(loadingTask.promise);
    const pages = [];
    for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
      const page = await waitForPdfOperation(pdfDocument.getPage(pageNumber));
      const content = await waitForPdfOperation(page.getTextContent());
      const pageText = content.items
        .filter((item) => "str" in item && item.str.trim())
        .map((item) => `${item.str}${item.hasEOL ? "\n" : " "}`)
        .join("")
        .replace(/[ \t]+\n/g, "\n")
        .trim();
      pages.push(pageText);
    }
    return pages.join("\n\n").trim();
  } finally {
    await loadingTask.destroy();
  }
}

async function renderPdfPage(state) {
  const canvas = documentPanel.querySelector("[data-pdf-canvas]");
  const status = documentPanel.querySelector("[data-pdf-status]");
  if (!canvas || !status) return;
  const pdfjs = window.pdfjsLib;
  if (!pdfjs) {
    status.textContent = "The document preview library did not load. Reload the page and try again.";
    return;
  }

  const renderToken = ++state.pdfRenderToken;
  status.hidden = false;
  status.textContent = "Preparing document preview…";
  try {
    pdfjs.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
    const previousRenderTask = state.pdfRenderTask;
    if (previousRenderTask) {
      previousRenderTask.cancel();
      try {
        await previousRenderTask.promise;
      } catch (error) {
        if (error?.name !== "RenderingCancelledException") throw error;
      }
    }
    if (renderToken !== state.pdfRenderToken) return;
    if (!state.pdfDocument || state.pdfSource !== state.uploadUrl) {
      if (state.pdfLoadingTask) await state.pdfLoadingTask.destroy();
      state.pdfLoadingTask = pdfjs.getDocument({ url: state.uploadUrl, isEvalSupported: false });
      state.pdfDocument = await waitForPdfOperation(state.pdfLoadingTask.promise);
      state.pdfSource = state.uploadUrl;
      state.pdfPageNumber = 1;
    }
    if (renderToken !== state.pdfRenderToken) return;

    const pdfDocument = state.pdfDocument;
    state.pdfPageNumber = Math.min(Math.max(state.pdfPageNumber, 1), pdfDocument.numPages);
    const page = await pdfDocument.getPage(state.pdfPageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const availableWidth = Math.max(canvas.parentElement.clientWidth - 48, 240);
    const scale = Math.min(availableWidth / viewport.width, 1.5);
    const scaledViewport = page.getViewport({ scale });
    const outputScale = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.floor(scaledViewport.width * outputScale);
    canvas.height = Math.floor(scaledViewport.height * outputScale);
    canvas.style.width = `${Math.floor(scaledViewport.width)}px`;
    canvas.style.height = `${Math.floor(scaledViewport.height)}px`;
    state.pdfRenderTask?.cancel();
    state.pdfRenderTask = page.render({
      canvasContext: canvas.getContext("2d"),
      viewport: scaledViewport,
      transform: outputScale === 1 ? null : [outputScale, 0, 0, outputScale, 0, 0],
    });
    await waitForPdfOperation(state.pdfRenderTask.promise);
    if (renderToken !== state.pdfRenderToken) return;

    status.hidden = true;
    documentPanel.querySelector("[data-pdf-current-page]").textContent = String(state.pdfPageNumber);
    documentPanel.querySelector("[data-pdf-total-pages]").textContent = String(pdfDocument.numPages);
    documentPanel.querySelector('[data-pdf-page="previous"]').disabled = state.pdfPageNumber <= 1;
    documentPanel.querySelector('[data-pdf-page="next"]').disabled = state.pdfPageNumber >= pdfDocument.numPages;
  } catch (error) {
    if (error?.name === "RenderingCancelledException") return;
    if (renderToken !== state.pdfRenderToken) return;
    status.hidden = false;
    status.textContent = "This PDF preview couldn’t be displayed. Try reloading the document.";
    setPortalNotice(`Could not render the PDF preview: ${error.message || "Unknown PDF error"}`, true);
  }
}

function renderPdfPreview(state) {
  if (!state.uploadUrl) {
    if (state.uploadedDocument) {
      return `<div class="portal-pdf-preview">
        <div class="portal-pdf-heading">
          <strong>${escapeHtml(state.uploadName || state.uploadedDocument.file_name)}</strong>
          <span class="portal-upload-status is-kept" role="status">Saved securely</span>
        </div>
        <p class="portal-muted">The PDF is saved, but its private preview is unavailable right now.</p>
        <div class="portal-upload-actions">
          <button type="button" class="button button-dark" data-action="retry-preview">Retry preview</button>
          <button type="button" class="button" data-action="download-pdf">Download PDF</button>
          <button type="button" class="button portal-delete-upload" data-action="delete-upload">Delete PDF</button>
        </div>
      </div>`;
    }
    return `<div class="portal-upload-empty">
      <span aria-hidden="true">▤</span>
      <strong>No PDF uploaded</strong>
      <small>Select a PDF to preview it before saving it to private storage.</small>
    </div>`;
  }
  return `<div class="portal-pdf-preview">
    <div class="portal-pdf-heading">
      <strong>${escapeHtml(state.uploadName)}</strong>
      <span class="portal-upload-status${state.uploadKept ? " is-kept" : ""}" role="status" aria-live="polite">
        ${state.uploadKept ? "Saved securely" : "Ready to review"}
      </span>
    </div>
    ${renderPdfCanvas(state)}
    <div class="portal-upload-actions">
      ${state.uploadedDocument ? `
      <button type="button" class="button button-dark" data-action="download-pdf">Download PDF</button>
      <button type="button" class="button portal-delete-upload" data-action="delete-upload">Delete PDF</button>` : `
      <button type="button" class="button button-dark" data-action="keep-upload">Save this PDF</button>
      <button type="button" class="button portal-delete-upload" data-action="delete-upload">Discard PDF</button>`}
    </div>
    <p class="portal-muted portal-upload-footnote">${state.uploadKept
      ? "This PDF is saved in the private Supabase bucket and can be previewed by approved portal admins."
      : "Review the PDF, then save it to private storage or discard it."}</p>
  </div>`;
}

async function downloadPrivatePdf(state, button) {
  if (!state.uploadedDocument) return;
  button.disabled = true;
  const originalLabel = button.textContent;
  button.textContent = "Preparing download…";
  try {
    const { data, error } = await supabaseClient.storage
      .from("portal-documents")
      .download(state.uploadedDocument.storage_path);
    if (error) throw new Error(`PDF download failed: ${error.message}`);
    const downloadUrl = URL.createObjectURL(data);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = state.uploadedDocument.file_name;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
    setPortalNotice("The PDF download has started.");
  } catch (error) {
    setPortalNotice(error.message || "Unable to download this PDF.", true);
  } finally {
    button.disabled = false;
    button.textContent = originalLabel;
  }
}

async function downloadGeneratedContract(button) {
  button.disabled = true;
  const originalLabel = button.textContent;
  button.textContent = "Preparing contract…";
  try {
    const state = getDocumentState(activeClientId, "contract");
    const client = clients.find((item) => item.id === activeClientId);
    if (!client || !state.savedDraft) throw new Error("The saved contract draft is unavailable.");
    const clientName = state.savedDraft.clientName || client.name;
    const safeName = clientName
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const blob = await createVectorPdf("contract", state, client);
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = `Sabr-Plan-Co-${safeName || "Wedding"}-Coordination-Agreement.pdf`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
    setPortalNotice("The generated contract PDF has been downloaded.");
  } catch (error) {
    setPortalNotice(`Could not download the generated contract: ${error.message || "Unknown error"}`, true);
  } finally {
    button.disabled = false;
    button.textContent = originalLabel;
  }
}

async function createEmailPdfAttachment(type, state, client, source) {
  if (source === "uploaded") {
    if (!state.uploadedDocument) throw new Error("The saved PDF is no longer available.");
    const { data, error } = await supabaseClient.storage
      .from("portal-documents")
      .download(state.uploadedDocument.storage_path);
    if (error) throw new Error(`Could not load the saved PDF: ${error.message}`);
    return {
      filename: safePdfFilename(state.uploadedDocument.file_name, `${client.name}-${type}`),
      blob: data,
    };
  }
  const safeName = client.name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const label = type === "contract" ? "Coordination-Agreement" : "Wedding-Itinerary";
  const blob = await createVectorPdf(type, state, client);
  if (blob.size > 15 * 1024 * 1024) throw new Error("The generated PDF is larger than the 15 MB email limit.");
  return { filename: `Sabr-Plan-Co-${safeName || "Wedding"}-${label}.pdf`, blob };
}

async function downloadFormattedItinerary(button) {
  const state = getDocumentState(activeClientId, "itinerary");
  const client = clients.find((item) => item.id === activeClientId);
  if (!client || !state.savedDraft) {
    setPortalNotice("Save the formatted itinerary before downloading its PDF.", true);
    return;
  }
  button.disabled = true;
  const originalLabel = button.textContent;
  button.textContent = "Preparing formatted PDF…";
  try {
    const { blob, filename } = await createEmailPdfAttachment("itinerary", state, client, "generated");
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
    setPortalNotice("The formatted itinerary PDF has been downloaded.");
  } catch (error) {
    setPortalNotice(`Could not download the formatted itinerary: ${error.message || "Unknown error"}`, true);
  } finally {
    button.disabled = false;
    button.textContent = originalLabel;
  }
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      if (typeof dataUrl !== "string" || !dataUrl.includes(",")) {
        reject(new Error("The PDF could not be prepared as an email attachment."));
        return;
      }
      resolve(dataUrl.slice(dataUrl.indexOf(",") + 1));
    };
    reader.onerror = () => reject(new Error("The PDF could not be read for email delivery."));
    reader.readAsDataURL(blob);
  });
}

function renderItinerary(client, state) {
  if (state.mode === "view" && state.viewSource === "pdf" && (state.uploadedDocument || state.pendingFile)) {
    return `<div class="portal-document-heading"><div><p class="eyebrow"><span class="eyebrow-line"></span> ITINERARY</p><h3>Your wedding-day itinerary</h3></div><span class="portal-draft-label">SAVED PDF</span></div>
      ${renderDocumentModeButtons("itinerary", state)}
      ${state.savedDraft ? '<div class="portal-draft-actions"><button type="button" class="button portal-text-button" data-action="view-formatted-itinerary">View formatted itinerary</button></div>' : ""}
      <div class="portal-itinerary-document">${renderPdfPreview(state)}</div>
      ${renderEmailForm(client, "itinerary", state)}`;
  }
  if (state.mode === "view" && state.viewSource === "draft" && state.savedDraft) {
    return `<div class="portal-document-heading"><div><p class="eyebrow"><span class="eyebrow-line"></span> ITINERARY</p><h3>Your wedding-day itinerary</h3></div><span class="portal-draft-label">SAVED ITINERARY</span></div>
      ${renderDocumentModeButtons("itinerary", state)}
      ${renderSavedPreview(state, "itinerary", client)}
      <div class="portal-draft-actions">
        <button type="button" class="button button-dark" data-action="download-formatted-itinerary">Download formatted itinerary PDF</button>
        ${state.uploadedDocument || state.pendingFile ? `<button type="button" class="button portal-text-button" data-action="view-original-itinerary-pdf">View ${state.uploadedDocument ? "original uploaded" : "source"} PDF</button>` : ""}
      </div>
      ${renderEmailForm(client, "itinerary", state)}
      ${renderDraftDeleteButton("itinerary")}`;
  }
  if (state.mode === "upload") {
    return `<div class="portal-document-heading"><div><p class="eyebrow"><span class="eyebrow-line"></span> ITINERARY</p><h3>Upload an itinerary</h3></div><span class="portal-draft-label">PDF PREVIEW</span></div>
      ${renderDocumentModeButtons("itinerary", state)}
      <div class="portal-upload-area">
        <label class="portal-file-label" for="document-upload">Choose itinerary PDF<input id="document-upload" type="file" accept="application/pdf,.pdf" data-document-upload /></label>
        <p class="portal-muted">PDF files only, up to 15 MB. The file is not saved until you choose Save this PDF.</p>
        ${renderPdfPreview(state)}
        ${state.pendingFile || state.uploadedDocument ? `<form class="portal-pdf-format-form" data-pdf-format-form>
          <div>
            <h4>Convert to a formatted itinerary</h4>
            <p class="portal-muted">The PDF text is extracted in your browser and sent to Google Gemini to organize into the same editable, styled itinerary used by the portal. This creates a separate draft and does not change the PDF. Save the original separately if you want to keep it in the workspace.</p>
          </div>
          <label class="portal-ai-consent"><input name="pdf-format-consent" type="checkbox" required /><span>I understand text extracted from this itinerary, plus the client’s name, wedding date, and venue, will be sent to Google Gemini to create an editable draft. I will review it before saving or sharing.</span></label>
          <div class="portal-form-actions">
            <span class="portal-form-status" role="status" aria-live="polite"></span>
            <button type="submit" class="button button-dark">Convert PDF to formatted draft</button>
          </div>
        </form>` : ""}
      </div>`;
  }
  return `<div class="portal-document-heading"><div><p class="eyebrow"><span class="eyebrow-line"></span> ITINERARY</p><h3>Wedding-day timeline</h3></div><span class="portal-draft-label">STARTER TEMPLATE</span></div>
    ${renderDocumentModeButtons("itinerary", state)}
    <form class="portal-ai-itinerary-form" data-ai-itinerary-form>
      <div>
        <p class="eyebrow"><span class="eyebrow-line"></span> AI-ASSISTED OPTION</p>
        <h4>Generate a first draft with AI</h4>
        <p class="portal-muted">Describe the schedule, traditions, and timing details you want included. The AI will create editable timeline entries below.</p>
      </div>
      <label>Wedding details and notes<textarea name="ai-notes" rows="5" maxlength="10000" required placeholder="Example: Ceremony begins at 4 PM. Allow time for family photos, cocktail hour, dinner, speeches, and dancing. Include the cultural traditions and vendor timing details we discussed.">${escapeHtml(state.aiNotes || "")}</textarea></label>
      <label>Other notes to include after the timeline<textarea name="ai-other-notes" rows="3" maxlength="10000" placeholder="Add important reminders, family details, setup instructions, or other notes for the end of the itinerary.">${escapeHtml(state.aiOtherNotes || "")}</textarea></label>
      <label class="portal-ai-consent"><input name="ai-consent" type="checkbox" required /><span>I understand the itinerary notes and other notes, the client’s name, wedding date, and venue will be sent to Google Gemini to generate this draft. I will review all generated details before saving or sharing.</span></label>
      <div class="portal-form-actions">
        <span class="portal-form-status" role="status" aria-live="polite"></span>
        <button type="submit" class="button button-dark">Generate itinerary draft</button>
      </div>
    </form>
    <div class="portal-ai-divider"><span>Or build the timeline manually</span></div>
    <form class="portal-template-form" data-template-form="itinerary">
      <div class="portal-form-grid">
        <label>Wedding date<input name="date" type="date" value="${escapeHtml(state.eventDate || state.savedDraft?.date || client.date)}" /></label>
        <label>Venue<input name="venue" type="text" value="${escapeHtml(state.eventVenue || state.savedDraft?.venue || client.venue || "")}" placeholder="Venue or location" /></label>
      </div>
      <div class="portal-template-subheading"><div><h4>Timeline</h4><p>Separate the pre-event schedule from the wedding-day event. Add vendor assignments and useful coordination notes.</p></div><button type="button" class="portal-text-button" data-action="add-event">+ Add event</button></div>
      <div class="portal-event-table-wrap">
        <table class="portal-event-table">
          <thead><tr><th scope="col">Time</th><th scope="col">Events</th><th scope="col">Vendor</th><th scope="col">Notes</th><th scope="col"><span class="portal-sr-only">Actions</span></th></tr></thead>
          <tbody class="portal-event-rows">${state.events.map((event, index) => `
            <tr class="portal-event-row">
              <td><div class="portal-event-time-fields">
                <label><span class="portal-sr-only">Event ${index + 1} start time</span><span class="portal-event-time-label">Start</span><div class="portal-time-inputs"><input name="event-start" type="text" inputmode="numeric" placeholder="4:00" pattern="(0?[1-9]|1[0-2]):[0-5][0-9]" title="Enter the time as hour:minute, such as 4:00" value="${escapeHtml(formatTimeInput(event.start))}" /><select name="event-start-period" aria-label="Start time AM or PM"><option value="AM"${timePeriod(event.start) === "AM" ? " selected" : ""}>AM</option><option value="PM"${timePeriod(event.start) === "PM" ? " selected" : ""}>PM</option></select></div></label>
                <label><span class="portal-sr-only">Event ${index + 1} end time</span><span class="portal-event-time-label">End</span><div class="portal-time-inputs"><input name="event-end" type="text" inputmode="numeric" placeholder="4:30" pattern="(0?[1-9]|1[0-2]):[0-5][0-9]" title="Enter the time as hour:minute, such as 4:30" value="${escapeHtml(formatTimeInput(event.end))}" /><select name="event-end-period" aria-label="End time AM or PM"><option value="AM"${timePeriod(event.end) === "AM" ? " selected" : ""}>AM</option><option value="PM"${timePeriod(event.end) === "PM" ? " selected" : ""}>PM</option></select></div></label>
              </div></td>
              <td><label><span class="portal-sr-only">Event ${index + 1} section</span><select name="event-phase" aria-label="Event ${index + 1} section"><option value="pre-event"${event.phase === "pre-event" ? " selected" : ""}>Pre-Event</option><option value="event"${event.phase !== "pre-event" ? " selected" : ""}>Event</option></select></label><label class="portal-event-name"><span class="portal-sr-only">Event ${index + 1} name</span><input name="event-title" type="text" maxlength="160" value="${escapeHtml(event.title)}" placeholder="e.g. Ceremony" /></label></td>
              <td><label><span class="portal-sr-only">Event ${index + 1} vendor</span><input name="event-vendor" type="text" maxlength="200" value="${escapeHtml(event.vendor || "")}" placeholder="Vendor or team" /></label></td>
              <td><label><span class="portal-sr-only">Event ${index + 1} notes</span><textarea name="event-notes" rows="2" maxlength="2000" placeholder="Details and coordination notes">${escapeHtml(event.notes || "")}</textarea></label></td>
              <td><button type="button" class="portal-remove-event" data-remove-event="${index}" aria-label="Remove event ${index + 1}">×</button></td>
            </tr>`).join("")}</tbody>
        </table>
      </div>
      <label class="portal-other-notes-field">Other Notes (shown after the timeline)<textarea name="other-notes" rows="5" maxlength="10000" placeholder="Add family details, setup checklists, entrance orders, priorities, and other information for the end of the itinerary.">${escapeHtml(state.otherNotes || state.savedDraft?.otherNotes || "")}</textarea></label>
      <div class="portal-form-actions">
        <span class="portal-form-status" role="status" aria-live="polite"></span>
        <button type="submit" class="button button-dark">Save itinerary draft</button>
      </div>
    </form>
    ${renderSavedPreview(state, "itinerary", client)}`;
}

function renderContract(client, state) {
  if (state.mode === "view" && state.viewSource === "pdf" && state.uploadedDocument) {
    return `<div class="portal-document-heading"><div><p class="eyebrow"><span class="eyebrow-line"></span> CONTRACT</p><h3>Uploaded contract</h3></div><span class="portal-draft-label">SAVED PDF</span></div>
      ${renderDocumentModeButtons("contract", state)}
      <div class="portal-itinerary-document">${renderPdfPreview(state)}</div>
      ${renderEmailForm(client, "contract", state)}`;
  }
  if (state.mode === "view" && state.viewSource === "draft" && state.savedDraft) {
    return `<div class="portal-document-heading"><div><p class="eyebrow"><span class="eyebrow-line"></span> CONTRACT</p><h3>Agreement draft</h3></div><span class="portal-draft-label">SAVED DRAFT</span></div>
      ${renderDocumentModeButtons("contract", state)}
      ${renderSavedPreview(state, "contract", client)}
      ${renderEmailForm(client, "contract", state)}
      ${renderDraftDeleteButton("contract")}`;
  }
  if (state.mode === "upload") {
    return `<div class="portal-document-heading"><div><p class="eyebrow"><span class="eyebrow-line"></span> CONTRACT</p><h3>Upload a contract</h3></div><span class="portal-draft-label">PDF PREVIEW</span></div>
      ${renderDocumentModeButtons("contract", state)}
      <div class="portal-upload-area">
        <label class="portal-file-label" for="document-upload">Choose contract PDF<input id="document-upload" type="file" accept="application/pdf,.pdf" data-document-upload /></label>
        <p class="portal-muted">PDF files only, up to 15 MB. The file is not saved until you choose Save this PDF.</p>
        ${renderPdfPreview(state)}
      </div>`;
  }
  const savedAmounts = calculateContractAmounts(state.savedDraft?.totalFee, state.savedDraft?.depositPercentage);
  return `<div class="portal-document-heading"><div><p class="eyebrow"><span class="eyebrow-line"></span> CONTRACT</p><h3>Wedding coordination agreement</h3></div><span class="portal-draft-label">DRAFT TEMPLATE</span></div>
    ${renderDocumentModeButtons("contract", state)}
    <div class="portal-legal-notice"><strong>Draft for review only.</strong> This template reflects the sample contract provided. Have the final agreement reviewed and approved before using it with clients.</div>
    <form class="portal-template-form" data-template-form="contract">
      <div class="portal-form-grid">
        <label>Client Name<input name="client-name" type="text" value="${escapeHtml(state.savedDraft?.clientName || state.savedDraft?.name || client.name)}" required /></label>
        <label>Client Contact Number<input name="client-contact" type="tel" value="${escapeHtml(state.savedDraft?.clientContact || "")}" placeholder="Include area or country code" required /></label>
        <label>Client Email<input name="client-email" type="text" inputmode="email" value="${escapeHtml(state.savedDraft?.clientEmail || "")}" placeholder="Email addresses for the couple" required /></label>
        <label>Event Dates<input name="event-dates" type="text" value="${escapeHtml(state.savedDraft?.eventDates || (state.savedDraft?.date ? `Wedding Day | ${formatDate(state.savedDraft.date)}` : `Wedding Day | ${formatDate(client.date)}`))}" required /></label>
        <label>Event Location<input name="event-location" type="text" value="${escapeHtml(state.savedDraft?.eventLocation || state.savedDraft?.venue || client.venue || "")}" required /></label>
        <label>Total Fee for Services (USD)<input name="total-fee" type="number" min="0.01" step="0.01" value="${escapeHtml(state.savedDraft?.totalFee ?? "")}" placeholder="0.00" required /></label>
        <label>Non-Refundable Deposit (%)<input name="deposit-percentage" type="number" min="0" max="100" step="0.01" value="${escapeHtml(state.savedDraft?.depositPercentage ?? "30")}" required /></label>
      </div>
      <div class="portal-contract-calculations" aria-live="polite">
        <p>Non-Refundable Deposit <strong data-contract-deposit>${escapeHtml(formatCurrency(savedAmounts?.deposit))}</strong></p>
        <p>Balance Due on Event Day <strong data-contract-balance>${escapeHtml(formatCurrency(savedAmounts?.balance))}</strong></p>
      </div>
      <div class="portal-form-actions">
        <span class="portal-form-status" role="status" aria-live="polite"></span>
        <button type="submit" class="button button-dark">Generate contract</button>
      </div>
    </form>
    ${renderSavedPreview(state, "contract", client)}`;
}

function renderSavedPreview(state, type, client) {
  if (!state.savedDraft) return "";
  if (type === "itinerary") {
    const draft = state.savedDraft;
    const events = normalizeItineraryEvents(Array.isArray(draft.events) ? draft.events : [])
      .filter((event) => event.title);
    const renderTimeline = (phase, title) => {
      const sectionEvents = events.filter((event) => event.phase === phase);
      return `<section class="portal-itinerary-timeline-section">
        <h5 class="portal-itinerary-section-title">${title}</h5>
        <table class="portal-itinerary-timeline-table">
          <thead><tr><th scope="col">Time</th><th scope="col">Events</th><th scope="col">Vendor</th><th scope="col">Notes</th></tr></thead>
          <tbody>${sectionEvents.map((event) => {
            const start = event.start ? formatTime(event.start) : "";
            const end = event.end ? formatTime(event.end) : "";
            const time = start && end ? `${start}–${end}` : start || end || "—";
            return `<tr>
              <td class="portal-itinerary-time" data-label="Time">${escapeHtml(time)}</td>
              <td data-label="Event">${escapeHtml(event.title)}</td>
              <td data-label="Vendor">${escapeHtml(event.vendor || "—")}</td>
              <td class="portal-itinerary-event-notes" data-label="Notes">${escapeHtml(event.notes || "—")}</td>
            </tr>`;
          }).join("") || '<tr><td colspan="4" class="portal-itinerary-empty-row">No events added.</td></tr>'}</tbody>
        </table>
      </section>`;
    };
    return `<section class="portal-draft-preview portal-itinerary-sheet" aria-label="Saved itinerary">
      <header class="portal-itinerary-sheet-header">
        <span class="portal-itinerary-wordmark">SABR PLAN CO. <span>·</span> COORDINATION</span>
        <p>WEDDING DAY ITINERARY</p>
        <h4>${escapeHtml(draft.venue || "Wedding day timeline")}</h4>
        <div class="portal-itinerary-details">
          <span><small>COUPLE</small><strong>${escapeHtml(draft.clientName || client.name)}</strong></span>
          <span><small>WEDDING DATE</small><strong>${escapeHtml(formatDate(draft.date))}</strong></span>
          <span><small>VENUE</small><strong>${escapeHtml(draft.venue || client.venue || "To be confirmed")}</strong></span>
        </div>
      </header>
      ${renderTimeline("pre-event", "Pre-Event")}
      ${renderTimeline("event", "Event")}
      ${typeof draft.otherNotes === "string" && draft.otherNotes.trim() ? `<section class="portal-itinerary-other-notes"><h5 class="portal-itinerary-section-title">Other Notes</h5><p>${escapeHtml(draft.otherNotes.trim())}</p></section>` : ""}
      <footer class="portal-itinerary-sheet-footer">Prepared for ${escapeHtml(client.name)} · Private coordination workspace</footer>
    </section>`;
  }
  const draft = state.savedDraft;
  if (!draft.totalFee && !draft.clientName) {
    return `<section class="portal-draft-preview" aria-label="Saved contract draft">
      <div class="portal-preview-header"><span class="portal-draft-label">LEGACY DRAFT</span><small>Saved to private Supabase storage</small></div>
      <h4>Wedding coordination agreement</h4>
      <p>This older draft does not contain the new contract fields. Choose <strong>Create from template</strong> to generate a complete contract.</p>
    </section>`;
  }
  const amounts = calculateContractAmounts(draft.totalFee, draft.depositPercentage);
  const dates = draft.eventDates || (draft.date ? `Wedding Day | ${formatDate(draft.date)}` : "");
  const location = draft.eventLocation || draft.venue || "";
  return `<div class="portal-contract-output">
    <section class="portal-draft-preview portal-contract-sheet" aria-label="Generated wedding coordination agreement">
      <header class="portal-contract-header">
        <img src="../assets/sabr-script.png" alt="Sabr Plan Co." />
        <p>WEDDING PLANNING &amp; COORDINATION</p>
      </header>
      <div class="portal-contract-title">
        <p>COORDINATION AGREEMENT</p>
        <h4>Wedding Coordination Services Agreement</h4>
      </div>
      <div class="portal-contract-details">
        <p><strong>Company:</strong> Sabr Plan Co.</p>
        <p><strong>Client Name:</strong> ${escapeHtml(draft.clientName || draft.name || "—")}</p>
        <p><strong>Client Contact:</strong> ${escapeHtml(draft.clientContact || "—")}</p>
        <p><strong>Email:</strong> ${escapeHtml(draft.clientEmail || "—")}</p>
        <p><strong>Event Dates:</strong> ${escapeHtml(dates || "—")}</p>
        <p><strong>Event Location:</strong> ${escapeHtml(location || "—")}</p>
      </div>
      <div class="portal-contract-fees">
        <p><strong>Total Fee for Services:</strong> ${escapeHtml(formatCurrency(amounts?.total))} incl. Travel Fees</p>
        <p><strong>Non-Refundable Deposit Due Upon Execution of Contract:</strong> ${escapeHtml(formatPercentage(draft.depositPercentage))}% (${escapeHtml(formatCurrency(amounts?.deposit))}) via Zelle<br />(929) 240-2040</p>
        <p><strong>Balance:</strong> ${escapeHtml(formatCurrency(amounts?.balance))} due by ${escapeHtml(dates || "the event date")} via Cash</p>
        <p><strong>Balance Due Date:</strong> Day of Event (Cash/Check/Zelle)</p>
      </div>
      <section class="portal-contract-section">
        <h5>Day of Coordination Services</h5>
        <ul>${contractServices.map((service) => `<li>${escapeHtml(service)}</li>`).join("")}</ul>
      </section>
      <section class="portal-contract-section">
        <h5>Terms &amp; Cancellations</h5>
        ${contractCancellationTerms.map((term) => `<p>${escapeHtml(term)}</p>`).join("")}
      </section>
      <section class="portal-contract-section portal-contract-photo-term">
        <p>Client Authorizes posting photos/videos on social media and publication to magazines and websites.</p>
      </section>
      <p class="portal-contract-contact">Any Additional inquiries or questions, please feel free to reach out at<br /><strong>sabrplanco@gmail.com · (929) 240-2040</strong></p>
      <div class="portal-contract-signatures">
        <div><span></span><strong>Signature of Client</strong></div>
        <div><span></span><strong>Signature of Coordinator</strong><small>Prioti Taher</small></div>
      </div>
      <footer class="portal-contract-draft-note">DRAFT FOR REVIEW · NOT A SIGNED CONTRACT</footer>
    </section>
    <div class="portal-contract-actions">
      <button type="button" class="button button-dark" data-action="download-contract">Download contract PDF</button>
    </div>
  </div>`;
}

function calculateContractAmounts(totalFee, depositPercentage) {
  const fee = Number(totalFee);
  const percentage = Number(depositPercentage);
  if (!Number.isFinite(fee) || fee <= 0 || !Number.isFinite(percentage) || percentage < 0 || percentage > 100) return null;
  const totalCents = Math.round(fee * 100);
  if (!Number.isSafeInteger(totalCents)) return null;
  const depositCents = Math.round(totalCents * percentage / 100);
  return {
    total: totalCents / 100,
    deposit: depositCents / 100,
    balance: (totalCents - depositCents) / 100,
  };
}

function formatCurrency(amount) {
  return Number.isFinite(amount) ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount) : "—";
}

function formatPercentage(percentage) {
  const value = Number(percentage);
  return Number.isFinite(value) ? String(value) : "—";
}

function updateContractCalculations(form) {
  const amounts = calculateContractAmounts(
    form.elements.namedItem("total-fee").value,
    form.elements.namedItem("deposit-percentage").value,
  );
  form.querySelector("[data-contract-deposit]").textContent = formatCurrency(amounts?.deposit);
  form.querySelector("[data-contract-balance]").textContent = formatCurrency(amounts?.balance);
}

function renderDraftDeleteButton(type) {
  const label = type === "itinerary" ? "itinerary" : "contract";
  return `<div class="portal-draft-actions">
    <button type="button" class="button portal-delete-upload" data-action="delete-draft" data-draft-type="${type}">Delete ${label} draft</button>
  </div>`;
}

function renderEmailForm(client, type, state) {
  const isUploadedPdf = state.viewSource === "pdf" && Boolean(state.uploadedDocument);
  const hasGeneratedDraft = type === "itinerary"
    ? Boolean(state.savedDraft && Array.isArray(state.savedDraft.events))
    : Boolean(state.savedDraft?.clientName && calculateContractAmounts(state.savedDraft.totalFee, state.savedDraft.depositPercentage));
  if (!isUploadedPdf && !hasGeneratedDraft) return "";
  const contractState = getDocumentState(client.id, "contract");
  const storedRecipients = parseEmailRecipients(contractState.savedDraft?.clientEmail || "");
  const documentLabel = type === "itinerary" ? "wedding-day itinerary" : "wedding coordination contract";
  const defaultSubject = `Your ${documentLabel} from Sabr Plan Co.`;
  const defaultMessage = `Hello,\n\nAttached is your ${documentLabel} for your review.\n\nPlease let us know if you have any questions.\n\nWarmly,\nSabr Plan Co.`;
  const itineraryClientName = type === "itinerary" ? state.savedDraft?.clientName || client.couple_name : client.couple_name;
  const vendorSubject = `Wedding day itinerary for ${itineraryClientName} from Sabr Plan Co.`;
  const vendorMessage = `Hello,\n\nAttached is the wedding day itinerary for ${itineraryClientName}.\n\nPlease let us know if you have any questions.\n\nLooking forward working with you!\n\nWarmly,\nSabr Plan Co.`;
  const supportsVendorRecipients = type === "itinerary";
  return `<details class="portal-email-panel">
    <summary>Email ${type}${supportsVendorRecipients ? "" : " to client"}</summary>
    <form class="portal-email-form" data-email-form="${type}" data-email-source="${isUploadedPdf ? "uploaded" : "generated"}" data-client-id="${escapeHtml(client.id)}">
      ${supportsVendorRecipients ? `<label>Send to<select name="recipient-type">
        <option value="client">Client</option>
        <option value="vendors">Vendors</option>
      </select></label>` : ""}
      <label data-recipient-label>Client email address(es)
        <div class="portal-email-recipient-entry">
          <div class="portal-email-recipient-list" data-recipient-list>${storedRecipients.map(renderEmailRecipient).join("")}</div>
          <div class="portal-email-recipient-controls">
            <input name="recipient-entry" type="email" autocomplete="email" placeholder="Enter one email address" />
            <button type="button" class="button portal-email-add-recipient" data-action="add-email-recipient">Add email</button>
          </div>
          <span class="portal-email-recipient-help">Add each address separately, up to five recipients.</span>
        </div>
      </label>
      <label>Subject<input name="subject" type="text" maxlength="200" required value="${escapeHtml(defaultSubject)}" data-client-subject="${escapeHtml(defaultSubject)}"${supportsVendorRecipients ? ` data-vendor-subject="${escapeHtml(vendorSubject)}"` : ""} /></label>
      <label>Message
        <div class="portal-email-message-editor">
          <textarea name="message" rows="4" maxlength="5000" required data-client-message="${escapeHtml(defaultMessage)}"${supportsVendorRecipients ? ` data-vendor-message="${escapeHtml(vendorMessage)}"` : ""}>${escapeHtml(defaultMessage)}</textarea>
          <button type="button" class="portal-email-expand-message" data-action="toggle-email-message" aria-expanded="false">Expand message box</button>
        </div>
      </label>
      <label class="portal-email-confirm"><input name="confirm-ready" type="checkbox" required /><span>I’ve reviewed this document and confirm it is ready to send as a PDF.</span></label>
      <div class="portal-form-actions">
        <span class="portal-form-status" role="status" aria-live="polite"></span>
        <button type="submit" class="button button-dark">Review and send ${type}</button>
      </div>
    </form>
  </details>`;
}

function parseEmailRecipients(value) {
  return [...new Set(value.split(/[,;|\n]+/).map((email) => email.trim()).filter(Boolean))];
}

function renderEmailRecipient(email) {
  return `<span class="portal-email-recipient" data-email-recipient="${escapeHtml(email)}">
    <span>${escapeHtml(email)}</span>
    <button type="button" data-action="remove-email-recipient" aria-label="Remove ${escapeHtml(email)}">×</button>
  </span>`;
}

function addEmailRecipient(form, status) {
  const input = form.elements.namedItem("recipient-entry");
  const email = input.value.trim();
  const recipients = [...form.querySelectorAll("[data-email-recipient]")].map((item) => item.dataset.emailRecipient);

  if (!email || !input.checkValidity()) {
    status.textContent = "Enter a valid email address, then choose Add email.";
    input.focus();
    return false;
  }
  if (recipients.includes(email)) {
    status.textContent = "That email address is already on the recipient list.";
    input.focus();
    return false;
  }
  if (recipients.length >= 5) {
    status.textContent = "You can add up to five email addresses.";
    input.focus();
    return false;
  }

  form.querySelector("[data-recipient-list]").insertAdjacentHTML("beforeend", renderEmailRecipient(email));
  input.value = "";
  status.textContent = "";
  input.focus();
  return true;
}

function safePdfFilename(value, fallback) {
  const name = String(value || fallback)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\.pdf$/i, "")
    .replace(/[^a-zA-Z0-9._ -]+/g, "-")
    .replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, "")
    .slice(0, 115);
  return `${name || "Client-Document"}.pdf`;
}

function formatTime(time) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time || "");
  if (!match) return time || "—";
  const hours = Number(match[1]);
  if (hours > 23 || Number(match[2]) > 59) return time;
  const period = hours < 12 ? "AM" : "PM";
  return `${hours % 12 || 12}:${match[2]} ${period}`;
}

function parseTimeInput(time, period = "") {
  const value = time.trim();
  if (!value) return "";
  const match = /^(0?[1-9]|1[0-2]):([0-5]\d)$/.exec(value);
  if (!match) return value;
  const meridiem = period.toUpperCase() === "PM" ? "PM" : "AM";
  const hour = Number(match[1]) % 12 + (meridiem === "PM" ? 12 : 0);
  return `${String(hour).padStart(2, "0")}:${match[2]}`;
}

function formatTimeInput(time) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time || "");
  if (!match) return "";
  const hours = Number(match[1]);
  if (hours > 23 || Number(match[2]) > 59) return "";
  return `${hours % 12 || 12}:${match[2]}`;
}

function timePeriod(time) {
  const match = /^(\d{1,2}):\d{2}$/.exec(time || "");
  if (!match || Number(match[1]) > 23) return "AM";
  return Number(match[1]) < 12 ? "AM" : "PM";
}

async function loadClientWorkspace(clientId) {
  documents.delete(clientId);
  const [draftResult, documentResult] = await Promise.all([
    supabaseClient
      .from("document_drafts")
      .select("document_type, content")
      .eq("client_id", clientId),
    supabaseClient
      .from("client_documents")
      .select("id, document_type, storage_path, file_name")
      .eq("client_id", clientId),
  ]);
  if (draftResult.error) throw new Error(`Could not load document drafts: ${draftResult.error.message}`);
  if (documentResult.error) throw new Error(`Could not load uploaded PDFs: ${documentResult.error.message}`);

  const clientDocuments = {};
  for (const draft of draftResult.data) {
    clientDocuments[draft.document_type] = {
      ...getDocumentState(clientId, draft.document_type),
      savedDraft: draft.content,
    viewSource: "draft",
    mode: "view",
      events: draft.document_type === "itinerary" && Array.isArray(draft.content.events)
        ? normalizeItineraryEvents(draft.content.events)
        : [emptyItineraryEvent()],
      eventDate: draft.document_type === "itinerary" ? draft.content.date || "" : "",
      eventVenue: draft.document_type === "itinerary" ? draft.content.venue || "" : "",
      otherNotes: draft.document_type === "itinerary" ? draft.content.otherNotes || "" : "",
      aiOtherNotes: draft.document_type === "itinerary" ? draft.content.otherNotes || "" : "",
      itineraryClientName: draft.document_type === "itinerary" ? draft.content.clientName || "" : "",
    };
  }

  for (const uploadedDocument of documentResult.data) {
    const { data, error } = await supabaseClient.storage
      .from("portal-documents")
      .createSignedUrl(uploadedDocument.storage_path, 3600);
    if (error) throw new Error(`Could not create a private PDF preview: ${error.message}`);
    const state = clientDocuments[uploadedDocument.document_type] || getDocumentState(clientId, uploadedDocument.document_type);
    state.uploadUrl = data.signedUrl;
    state.uploadName = uploadedDocument.file_name;
    state.uploadKept = true;
    state.uploadedDocument = uploadedDocument;
    state.viewSource = "pdf";
    state.mode = "view";
    clientDocuments[uploadedDocument.document_type] = state;
  }
  documents.set(clientId, clientDocuments);
}

async function openWorkspace(clientId) {
  const client = clients.find((item) => item.id === clientId);
  if (!client) return;
  activeClientId = clientId;
  activeDocument = "contract";
  document.querySelector("#workspace-title").textContent = client.name;
  document.querySelector("#workspace-meta").textContent = `${formatDate(client.date)} · ${client.service}${client.venue ? ` · ${client.venue}` : ""}`;
  showView("workspace");
  documentPanel.innerHTML = '<p class="portal-muted">Loading this client’s private workspace…</p>';
  try {
    await loadClientWorkspace(clientId);
    if (activeClientId === clientId) renderDocument();
  } catch (error) {
    if (activeClientId === clientId) {
      setPortalNotice(error.message || "Unable to load this client workspace.", true);
      documentPanel.innerHTML = '<p class="portal-muted">The workspace could not be loaded. Please retry by opening the client again.</p>';
    }
  }
}

function renderAll() {
  renderSummary();
  renderCalendar();
  renderClients();
}

function clearPortalData() {
  documents.forEach((clientDocuments) => {
    Object.values(clientDocuments).forEach((state) => {
      revokePreviewUrl(state.uploadUrl);
    });
  });
  documents.clear();
  clients.splice(0, clients.length);
  calendarMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  selectedDate = toDateKey(today);
  activeClientId = null;
  clientDialog.close();
  clientForm.reset();
  renderAll();
  showView("calendar");
}

function showSignedInPortal(user) {
  loginScreen.hidden = true;
  portalApp.hidden = false;
  document.querySelector("#portal-user-email").textContent = user.email || "Administrator";
  renderAll();
}

async function authorizePortalUser(user) {
  const { data, error } = await supabaseClient
    .from("portal_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    await supabaseClient.auth.signOut();
    throw new Error("Unable to verify portal administrator access. Check the Supabase migration and RLS policies.");
  }
  if (!data) {
    await supabaseClient.auth.signOut();
    throw new Error("This account is not approved to access the coordinator portal.");
  }

  await loadPortalData();
  showSignedInPortal(user);
  hidePortalNotice();
}

signInForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  signInStatus.textContent = "";
  if (!supabaseClient) {
    signInStatus.textContent = "The portal connection is not configured. Check portal-config.js and reload.";
    return;
  }

  signInButton.disabled = true;
  signInButton.textContent = "Signing in...";
  try {
    const formData = new FormData(signInForm);
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email: formData.get("email").toString().trim(),
      password: formData.get("password").toString(),
    });
    if (error) throw new Error("Sign-in failed. Check the email and password, then try again.");
    await authorizePortalUser(data.user);
    signInForm.reset();
  } catch (error) {
    signInStatus.textContent = error.message || "Unable to sign in. Please try again.";
  } finally {
    signInButton.disabled = false;
    signInButton.innerHTML = 'Sign in <span aria-hidden="true">↗︎</span>';
  }
});

recoveryLink.addEventListener("click", () => {
  recoveryForm.elements.email.value = signInForm.elements.email.value.trim();
  showLoginMode("request-recovery");
});

document.querySelector("#back-to-sign-in").addEventListener("click", () => {
  showLoginMode("sign-in");
});

recoveryForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  signInStatus.textContent = "";
  if (!supabaseClient) {
    signInStatus.textContent = "The portal connection is not configured. Check portal-config.js and reload.";
    return;
  }

  recoveryButton.disabled = true;
  recoveryButton.textContent = "Sending email...";
  try {
    const email = new FormData(recoveryForm).get("email").toString().trim();
    const redirectTo = `${window.location.origin}${window.location.pathname}?reset-password=1`;
    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw error;
    signInStatus.classList.add("is-success");
    signInStatus.textContent = "If this email belongs to an account, a recovery link will be sent. Check your inbox and spam folder.";
  } catch (error) {
    signInStatus.textContent = error.message || "Unable to send a recovery email. Please try again.";
  } finally {
    recoveryButton.disabled = false;
    recoveryButton.innerHTML = 'Send recovery email <span aria-hidden="true">↗︎</span>';
  }
});

passwordForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  signInStatus.textContent = "";
  if (!supabaseClient || !recoverySession) {
    showLoginMode("sign-in");
    signInStatus.textContent = "This recovery session is missing or expired. Request a new recovery email.";
    return;
  }

  const formData = new FormData(passwordForm);
  const password = formData.get("password").toString();
  if (password !== formData.get("confirm-password").toString()) {
    signInStatus.textContent = "The passwords do not match.";
    return;
  }

  passwordButton.disabled = true;
  passwordButton.textContent = "Updating password...";
  try {
    const { data, error } = await supabaseClient.auth.updateUser({ password });
    if (error) throw error;
    recoverySession = null;
    window.history.replaceState({}, document.title, `${window.location.pathname}`);
    passwordForm.reset();
    await authorizePortalUser(data.user);
  } catch (error) {
    signInStatus.textContent = error.message || "Unable to update the password. Request a new recovery email and try again.";
  } finally {
    passwordButton.disabled = false;
    passwordButton.innerHTML = 'Set new password <span aria-hidden="true">↗︎</span>';
  }
});

document.querySelector("#portal-sign-out").addEventListener("click", async () => {
  const { error } = await supabaseClient.auth.signOut();
  if (error) {
    const warning = document.querySelector(".portal-warning");
    warning.textContent = "Sign out failed. Please retry and close this browser tab when finished.";
    return;
  }
  clearPortalData();
  portalApp.hidden = true;
  loginScreen.hidden = false;
  showLoginMode("sign-in");
  signInStatus.textContent = "You have signed out.";
});

async function restorePortalSession() {
  if (!supabaseClient) {
    signInStatus.textContent = "The portal connection is not configured. Check portal-config.js and reload.";
    signInButton.disabled = true;
    return;
  }

  signInButton.disabled = true;
  signInStatus.textContent = "Checking your session...";
  try {
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) throw error;
    if (data.session?.user) {
      if (new URLSearchParams(window.location.search).has("reset-password")) {
        recoverySession = data.session;
        showLoginMode("update-password");
        signInStatus.textContent = "Choose a new password for your account.";
      } else {
        await authorizePortalUser(data.session.user);
      }
    } else {
      const hashParams = new URLSearchParams(window.location.hash.slice(1));
      const recoveryError = hashParams.get("error_code");
      if (recoveryError === "otp_expired" || recoveryError === "access_denied") {
        signInStatus.textContent = "That recovery link has expired or was already used. Request a new one below.";
        window.history.replaceState({}, document.title, `${window.location.pathname}`);
      } else if (new URLSearchParams(window.location.search).has("reset-password")) {
        signInStatus.textContent = "The recovery link is invalid or expired. Request a new one below.";
        window.history.replaceState({}, document.title, `${window.location.pathname}`);
      } else {
        signInStatus.textContent = "";
      }
    }
  } catch (error) {
    signInStatus.textContent = error.message || "Unable to verify this session. Please sign in again.";
  } finally {
    signInButton.disabled = false;
  }
}

if (supabaseClient) {
  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY" && session) {
      recoverySession = session;
      showLoginMode("update-password");
      signInStatus.textContent = "Choose a new password for your account.";
    }
  });
}

restorePortalSession();

document.querySelectorAll(".portal-nav-item").forEach((button) => {
  button.addEventListener("click", () => {
    if (button.dataset.view === "clients" && !clients.length) {
      showView("empty");
      return;
    }
    showView(button.dataset.view);
  });
});

document.querySelector("#portal-calendar-brand").addEventListener("click", (event) => {
  event.preventDefault();
  showView("calendar");
  window.scrollTo({ top: 0, behavior: "smooth" });
});

document.querySelectorAll("[data-theme-option]").forEach((button) => {
  button.addEventListener("click", () => {
    applyPortalTheme(button.dataset.themeOption, true);
  });
});

document.querySelector("#previous-month").addEventListener("click", () => {
  calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1);
  selectedDate = toDateKey(calendarMonth);
  renderCalendar();
});

document.querySelector("#calendar-today").addEventListener("click", () => {
  calendarMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  selectedDate = toDateKey(today);
  renderCalendar();
});

document.querySelector("#next-month").addEventListener("click", () => {
  calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1);
  selectedDate = toDateKey(calendarMonth);
  renderCalendar();
});

document.querySelector("#calendar-grid").addEventListener("click", (event) => {
  const dayButton = event.target.closest("[data-date]");
  if (!dayButton) return;
  selectedDate = dayButton.dataset.date;
  renderCalendar();
});

document.querySelector("#upcoming-list").addEventListener("click", (event) => {
  const clientButton = event.target.closest("[data-open-client]");
  if (clientButton) openWorkspace(clientButton.dataset.openClient);
});

document.querySelector("#selected-day-list").addEventListener("click", (event) => {
  const clientButton = event.target.closest("[data-open-client]");
  if (clientButton) openWorkspace(clientButton.dataset.openClient);
});

document.querySelector("#client-grid").addEventListener("click", (event) => {
  const clientButton = event.target.closest("[data-open-client]");
  if (clientButton) openWorkspace(clientButton.dataset.openClient);
});

document.querySelector("#back-to-clients").addEventListener("click", () => showView("clients"));

document.querySelectorAll(".portal-document-link").forEach((button) => {
  button.addEventListener("click", () => {
    activeDocument = button.dataset.document;
    renderDocument();
  });
});

document.querySelector("#delete-client-workspace").addEventListener("click", async (event) => {
  const button = event.currentTarget;
  const clientId = activeClientId;
  const client = clients.find((item) => item.id === clientId);
  if (!client) return;

  const confirmed = window.confirm(
    `Permanently delete ${client.name}'s client workspace? This removes the client from the calendar and deletes its contract, itinerary, uploaded PDFs, and email history. This cannot be undone.`,
  );
  if (!confirmed) return;

  button.disabled = true;
  button.textContent = "Deleting…";
  let uploadedDocuments;
  try {
    const { data, error: documentError } = await supabaseClient
      .from("client_documents")
      .select("storage_path")
      .eq("client_id", clientId);
    if (documentError) throw new Error(`Could not check the client's uploaded PDFs: ${documentError.message}`);
    uploadedDocuments = data;

    const { data: deletedClient, error: deleteError } = await supabaseClient
      .from("clients")
      .delete()
      .eq("id", clientId)
      .select("id")
      .maybeSingle();
    if (deleteError) throw new Error(`Could not delete the client workspace: ${deleteError.message}`);
    if (!deletedClient) throw new Error("The client workspace was not found or could not be deleted.");
  } catch (error) {
    button.disabled = false;
    button.textContent = "Delete client";
    setPortalNotice(error.message || "Unable to delete the client workspace.", true);
    return;
  }

  const clientDocuments = documents.get(clientId);
  if (clientDocuments) {
    Object.values(clientDocuments).forEach((state) => revokePreviewUrl(state.uploadUrl));
  }
  documents.delete(clientId);
  const clientIndex = clients.findIndex((item) => item.id === clientId);
  if (clientIndex >= 0) clients.splice(clientIndex, 1);
  const wasActiveWorkspace = activeClientId === clientId;
  if (wasActiveWorkspace) activeClientId = null;
  renderAll();
  if (wasActiveWorkspace) showView("calendar");

  const storagePaths = uploadedDocuments.map((item) => item.storage_path);
  if (storagePaths.length) {
    try {
      const { error: storageError } = await supabaseClient.storage
        .from("portal-documents")
        .remove(storagePaths);
      if (storageError) {
        setPortalNotice(
          `The client workspace was deleted, but Supabase Storage could not remove its uploaded PDFs. Remove these files from the private portal-documents bucket: ${storagePaths.join(", ")}. ${storageError.message}`,
          true,
        );
        return;
      }
    } catch (storageError) {
      setPortalNotice(
        `The client workspace was deleted, but Supabase Storage could not remove its uploaded PDFs. Remove these files from the private portal-documents bucket: ${storagePaths.join(", ")}. ${storageError.message || "Unknown storage error"}`,
        true,
      );
      return;
    }
  }
  setPortalNotice(`${client.name}'s workspace and related documents were permanently deleted.`);
});

documentPanel.addEventListener("click", async (event) => {
  const formattedItineraryButton = event.target.closest('[data-action="view-formatted-itinerary"]');
  if (formattedItineraryButton) {
    const state = getDocumentState(activeClientId, "itinerary");
    state.viewSource = "draft";
    state.mode = "view";
    renderDocument();
    return;
  }
  const formattedItineraryDownloadButton = event.target.closest('[data-action="download-formatted-itinerary"]');
  if (formattedItineraryDownloadButton) {
    await downloadFormattedItinerary(formattedItineraryDownloadButton);
    return;
  }
  const originalItineraryButton = event.target.closest('[data-action="view-original-itinerary-pdf"]');
  if (originalItineraryButton) {
    const state = getDocumentState(activeClientId, "itinerary");
    state.viewSource = "pdf";
    state.mode = "view";
    renderDocument();
    return;
  }
  const addRecipientButton = event.target.closest('[data-action="add-email-recipient"]');
  if (addRecipientButton) {
    const form = addRecipientButton.closest("[data-email-form]");
    addEmailRecipient(form, form.querySelector(".portal-form-status"));
    return;
  }
  const toggleMessageButton = event.target.closest('[data-action="toggle-email-message"]');
  if (toggleMessageButton) {
    const message = toggleMessageButton.closest(".portal-email-message-editor").querySelector('[name="message"]');
    const expanded = toggleMessageButton.getAttribute("aria-expanded") !== "true";
    toggleMessageButton.setAttribute("aria-expanded", String(expanded));
    toggleMessageButton.textContent = expanded ? "Collapse message box" : "Expand message box";
    message.classList.toggle("is-expanded", expanded);
    return;
  }
  const removeRecipientButton = event.target.closest('[data-action="remove-email-recipient"]');
  if (removeRecipientButton) {
    removeRecipientButton.closest("[data-email-recipient]").remove();
    return;
  }
  const contractDownloadButton = event.target.closest('[data-action="download-contract"]');
  if (contractDownloadButton) {
    await downloadGeneratedContract(contractDownloadButton);
    return;
  }
  const downloadButton = event.target.closest('[data-action="download-pdf"]');
  if (downloadButton) {
    await downloadPrivatePdf(getDocumentState(activeClientId, activeDocument), downloadButton);
    return;
  }
  const deleteDraftButton = event.target.closest('[data-action="delete-draft"]');
  if (deleteDraftButton) {
    const clientId = activeClientId;
    const documentType = deleteDraftButton.dataset.draftType;
    const state = getDocumentState(clientId, documentType);
    const label = documentType === "itinerary" ? "itinerary" : "contract";
    if (!window.confirm(`Permanently delete this ${label} draft? This cannot be undone.`)) return;

    deleteDraftButton.disabled = true;
    deleteDraftButton.textContent = `Deleting ${label} draft…`;
    try {
      const { error } = await supabaseClient
        .from("document_drafts")
        .delete()
        .eq("client_id", clientId)
        .eq("document_type", documentType);
      if (error) throw new Error(error.message);
    } catch (error) {
      setPortalNotice(`Could not delete the ${label} draft: ${error.message || "Unknown error"}`, true);
      if (activeClientId === clientId && activeDocument === documentType) renderDocument();
      return;
    }

    state.savedDraft = null;
    if (documentType === "itinerary") {
      state.events = [emptyItineraryEvent()];
      state.eventDate = "";
      state.eventVenue = "";
      state.itineraryClientName = "";
      state.otherNotes = "";
    }
    state.viewSource = state.uploadedDocument ? "pdf" : "";
    state.mode = state.uploadedDocument ? "view" : "create";
    if (activeClientId === clientId && activeDocument === documentType) renderDocument();
    setPortalNotice(`The ${label} draft was deleted.`);
    return;
  }
  const pageButton = event.target.closest("[data-pdf-page]");
  if (pageButton) {
    const state = getDocumentState(activeClientId, activeDocument);
    state.pdfPageNumber += pageButton.dataset.pdfPage === "next" ? 1 : -1;
    await renderPdfPage(state);
    return;
  }
  const modeButton = event.target.closest("[data-mode]");
  if (modeButton) {
    const state = getDocumentState(activeClientId, activeDocument);
    state.mode = modeButton.dataset.mode;
    renderDocument();
    return;
  }
  if (event.target.closest('[data-action="add-event"]')) {
    const form = documentPanel.querySelector('[data-template-form="itinerary"]');
    if (!form.reportValidity()) return;
    const rows = readItineraryEvents(form);
    rows.push(emptyItineraryEvent());
    const state = getDocumentState(activeClientId, activeDocument);
    state.events = rows;
    state.eventDate = form.querySelector('[name="date"]').value;
    state.eventVenue = form.querySelector('[name="venue"]').value;
    state.otherNotes = form.elements.namedItem("other-notes").value;
    renderDocument();
    return;
  }
  const removeButton = event.target.closest("[data-remove-event]");
  if (removeButton) {
    const form = documentPanel.querySelector('[data-template-form="itinerary"]');
    if (!form.reportValidity()) return;
    const rows = readItineraryEvents(form);
    rows.splice(Number(removeButton.dataset.removeEvent), 1);
    const state = getDocumentState(activeClientId, activeDocument);
    state.events = rows.length ? rows : [emptyItineraryEvent()];
    state.eventDate = form.querySelector('[name="date"]').value;
    state.eventVenue = form.querySelector('[name="venue"]').value;
    state.otherNotes = form.elements.namedItem("other-notes").value;
    renderDocument();
    return;
  }
  if (event.target.closest('[data-action="keep-upload"]')) {
    const clientId = activeClientId;
    const documentType = activeDocument;
    const state = getDocumentState(activeClientId, activeDocument);
    const button = event.target.closest('[data-action="keep-upload"]');
    if (!state.pendingFile) return;
    button.disabled = true;
    button.textContent = "Saving PDF...";
    try {
      const file = state.pendingFile;
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const storagePath = `${clientId}/${documentType}/${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabaseClient.storage
        .from("portal-documents")
        .upload(storagePath, file, { contentType: "application/pdf", upsert: false });
      if (uploadError) throw new Error(`PDF upload failed: ${uploadError.message}`);

      const oldDocument = state.uploadedDocument;
      const { data: savedDocument, error: metadataError } = await supabaseClient
        .from("client_documents")
        .upsert({
          client_id: clientId,
          document_type: documentType,
          storage_path: storagePath,
          file_name: file.name,
          content_type: "application/pdf",
          size_bytes: file.size,
        }, { onConflict: "client_id,document_type" })
        .select("id, document_type, storage_path, file_name")
        .single();
      if (metadataError) {
        const { error: cleanupError } = await supabaseClient.storage
          .from("portal-documents")
          .remove([storagePath]);
        const cleanupMessage = cleanupError ? ` The unregistered uploaded file could not be cleaned up: ${cleanupError.message}` : "";
        throw new Error(`PDF metadata could not be saved: ${metadataError.message}.${cleanupMessage}`);
      }

      revokePreviewUrl(state.uploadUrl);
      state.pendingFile = null;
      state.uploadedDocument = savedDocument;
      state.viewSource = "pdf";
      state.uploadName = file.name;
      state.uploadKept = true;
      state.mode = "view";
      const { data: signedUrl, error: signedUrlError } = await supabaseClient.storage
        .from("portal-documents")
        .createSignedUrl(storagePath, 3600);
      if (signedUrlError) {
        state.uploadUrl = "";
        setPortalNotice(`The PDF was saved, but its preview could not be opened: ${signedUrlError.message}`, true);
      } else {
        state.uploadUrl = signedUrl.signedUrl;
      }
      if (activeClientId === clientId && activeDocument === documentType) renderDocument();
      if (!signedUrlError) setPortalNotice(oldDocument ? "The PDF was replaced and saved securely." : "The PDF was saved securely.");
      if (oldDocument && oldDocument.storage_path !== storagePath) {
        const { error: cleanupError } = await supabaseClient.storage
          .from("portal-documents")
          .remove([oldDocument.storage_path]);
        if (cleanupError) {
          setPortalNotice(`The new PDF is saved, but the previous file could not be removed: ${cleanupError.message}`, true);
        }
      }
    } catch (error) {
      setPortalNotice(error.message || "Unable to save this PDF.", true);
      if (activeClientId === clientId && activeDocument === documentType) renderDocument();
    }
    return;
  }
  if (event.target.closest('[data-action="retry-preview"]')) {
    const clientId = activeClientId;
    const documentType = activeDocument;
    const state = getDocumentState(clientId, documentType);
    const { data, error } = await supabaseClient.storage
      .from("portal-documents")
      .createSignedUrl(state.uploadedDocument.storage_path, 3600);
    if (error) {
      setPortalNotice(`Could not create a private PDF preview: ${error.message}`, true);
      return;
    }
    state.uploadUrl = data.signedUrl;
    renderDocument();
    setPortalNotice("The private PDF preview is ready.");
    return;
  }
  if (event.target.closest('[data-action="delete-upload"]')) {
    const clientId = activeClientId;
    const documentType = activeDocument;
    const state = getDocumentState(activeClientId, activeDocument);
    if (state.pendingFile) {
      revokePreviewUrl(state.uploadUrl);
      state.pendingFile = null;
      if (state.uploadedDocument) {
        const { data, error } = await supabaseClient.storage
          .from("portal-documents")
          .createSignedUrl(state.uploadedDocument.storage_path, 3600);
        if (error) {
          setPortalNotice(`The unsaved replacement was discarded, but the saved PDF preview failed: ${error.message}`, true);
          state.uploadUrl = "";
        } else {
          state.uploadUrl = data.signedUrl;
        }
        state.uploadName = state.uploadedDocument.file_name;
        state.uploadKept = true;
      } else {
        state.uploadUrl = "";
        state.uploadName = "";
        state.uploadKept = false;
      }
      if (activeClientId === clientId && activeDocument === documentType) renderDocument();
      return;
    }
    if (!state.uploadedDocument) return;
    const currentDocument = state.uploadedDocument;
    const { error: metadataError } = await supabaseClient
      .from("client_documents")
      .delete()
      .eq("id", currentDocument.id);
    if (metadataError) {
      setPortalNotice(`Could not remove the PDF record: ${metadataError.message}`, true);
      return;
    }
    state.uploadedDocument = null;
    state.viewSource = state.savedDraft ? "draft" : "";
    state.mode = state.savedDraft ? "view" : "create";
    state.uploadKept = false;
    revokePreviewUrl(state.uploadUrl);
    state.uploadUrl = "";
    state.uploadName = "";
    const { error: storageError } = await supabaseClient.storage
      .from("portal-documents")
      .remove([currentDocument.storage_path]);
    if (activeClientId === clientId && activeDocument === documentType) renderDocument();
    if (storageError) {
      setPortalNotice(`The PDF record was removed, but the stored file could not be deleted: ${storageError.message}`, true);
    } else {
      setPortalNotice("The PDF was deleted from private storage.");
    }
  }
});

documentPanel.addEventListener("change", (event) => {
  if (!event.target.matches("[data-document-upload]")) return;
  const file = event.target.files?.[0];
  if (!file) return;
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    event.target.value = "";
    window.alert("Please choose a PDF file.");
    return;
  }
  if (!file.size) {
    event.target.value = "";
    window.alert("The selected PDF is empty. Choose a valid PDF file.");
    return;
  }
  if (file.size > 15 * 1024 * 1024) {
    event.target.value = "";
    window.alert("Please choose a PDF no larger than 15 MB.");
    return;
  }
  const state = getDocumentState(activeClientId, activeDocument);
  revokePreviewUrl(state.uploadUrl);
  state.uploadUrl = URL.createObjectURL(file);
  state.uploadName = file.name;
  state.uploadKept = false;
  state.pendingFile = file;
  renderDocument();
});

documentPanel.addEventListener("input", (event) => {
  const form = event.target.closest('[data-template-form="contract"]');
  if (form) updateContractCalculations(form);
  if (event.target.matches('[data-ai-itinerary-form] [name="ai-notes"]') && activeClientId) {
    getDocumentState(activeClientId, "itinerary").aiNotes = event.target.value;
  }
  if (event.target.matches('[data-ai-itinerary-form] [name="ai-other-notes"]') && activeClientId) {
    getDocumentState(activeClientId, "itinerary").aiOtherNotes = event.target.value;
  }
});

documentPanel.addEventListener("change", (event) => {
  const recipientType = event.target.closest('[name="recipient-type"]');
  if (!recipientType) return;

  const form = recipientType.closest("[data-email-form]");
  const recipientInput = form.elements.namedItem("recipient-entry");
  const recipientLabel = form.querySelector("[data-recipient-label]");
  const subjectInput = form.elements.namedItem("subject");
  const messageInput = form.elements.namedItem("message");
  const isVendor = recipientType.value === "vendors";

  form.querySelector("[data-recipient-list]").replaceChildren();
  recipientInput.value = "";
  form.querySelector(".portal-form-status").textContent = "";
  recipientLabel.firstChild.textContent = `${isVendor ? "Vendor" : "Client"} email address(es)`;
  recipientInput.placeholder = `Enter one ${isVendor ? "vendor" : "client"} email address`;
  subjectInput.value = subjectInput.dataset[isVendor ? "vendorSubject" : "clientSubject"];
  messageInput.value = messageInput.dataset[isVendor ? "vendorMessage" : "clientMessage"];
});

documentPanel.addEventListener("keydown", (event) => {
  const recipientInput = event.target.closest('[name="recipient-entry"]');
  if (!recipientInput || event.key !== "Enter") return;
  event.preventDefault();
  addEmailRecipient(recipientInput.closest("[data-email-form]"), recipientInput.closest("form").querySelector(".portal-form-status"));
});

documentPanel.addEventListener("submit", async (event) => {
  const form = event.target.closest("[data-ai-itinerary-form]");
  if (!form) return;
  event.preventDefault();
  if (!form.reportValidity()) return;

  const status = form.querySelector(".portal-form-status");
  const submitButton = form.querySelector('button[type="submit"]');
  const clientId = activeClientId;
  const client = clients.find((item) => item.id === clientId);
  const templateForm = documentPanel.querySelector('[data-template-form="itinerary"]');
  if (!client || !templateForm) {
    status.textContent = "The client workspace is no longer available. Reload it and try again.";
    return;
  }

  const currentEvents = readItineraryEvents(templateForm);
  const hasExistingTimeline = currentEvents.some((item) => item.title || item.start || item.end || item.vendor || item.notes);
  if (hasExistingTimeline && !window.confirm("Replace the current unsaved timeline with the AI-generated draft?")) return;

  const selectedDate = templateForm.elements.namedItem("date").value;
  const venue = templateForm.elements.namedItem("venue").value.trim();
  const state = getDocumentState(clientId, "itinerary");
  state.aiNotes = form.elements.namedItem("ai-notes").value.trim();
  state.aiOtherNotes = form.elements.namedItem("ai-other-notes").value.trim();
  submitButton.disabled = true;
  status.textContent = "Generating a suggested timeline…";
  try {
    const { data, error } = await supabaseClient.functions.invoke("generate-itinerary", {
      body: {
        clientId,
        notes: state.aiNotes,
        otherNotes: state.aiOtherNotes,
        eventDate: selectedDate,
        venue,
      },
    });
    if (error) {
      const responseBody = error.context instanceof Response
        ? await error.context.clone().json().catch(() => null)
        : null;
      throw new Error(data?.error || responseBody?.error || error.message || "AI could not generate an itinerary.");
    }

    if (!Array.isArray(data?.events) || data.events.length < 1 || data.events.length > 40) {
      throw new Error("The AI returned an invalid itinerary. Please adjust your notes and try again.");
    }
    const events = data.events.map((item) => {
      if (!item || typeof item !== "object") {
        throw new Error("The AI returned an invalid event. Please try again.");
      }
      const start = item.start;
      const end = item.end;
      const phase = item.phase ?? "event";
      const vendor = item.vendor ?? "";
      const notes = item.notes ?? "";
      if (
        typeof item.title !== "string" ||
        !item.title.trim() ||
        item.title.length > 160 ||
        typeof start !== "string" ||
        typeof end !== "string" ||
        (phase !== "pre-event" && phase !== "event") ||
        typeof vendor !== "string" ||
        vendor.length > 200 ||
        typeof notes !== "string" ||
        notes.length > 2000 ||
        (start && !/^([01]\d|2[0-3]):[0-5]\d$/.test(start)) ||
        (end && !/^([01]\d|2[0-3]):[0-5]\d$/.test(end))
      ) {
        throw new Error("The AI returned an invalid event or time. Please try again.");
      }
      return { phase, title: item.title.trim(), start, end, vendor: vendor.trim(), notes: notes.trim() };
    });
    const metadata = data.metadata && typeof data.metadata === "object" ? data.metadata : {};
    if (
      (metadata.coupleName !== undefined && (typeof metadata.coupleName !== "string" || metadata.coupleName.length > 160)) ||
      (metadata.weddingDate !== undefined && (
        typeof metadata.weddingDate !== "string" ||
        (metadata.weddingDate && !/^\d{4}-\d{2}-\d{2}$/.test(metadata.weddingDate))
      )) ||
      (metadata.venue !== undefined && (typeof metadata.venue !== "string" || metadata.venue.length > 250))
    ) {
      throw new Error("The AI returned invalid couple or wedding details. Please try again.");
    }
    const generatedOtherNotes = data.otherNotes ?? state.aiOtherNotes;
    if (typeof generatedOtherNotes !== "string" || generatedOtherNotes.length > 10000) {
      throw new Error("The AI returned invalid other notes. Please try again.");
    }

    state.events = normalizeItineraryEvents(events);
    state.eventDate = selectedDate;
    state.eventVenue = venue;
    state.itineraryClientName = metadata.coupleName?.trim() || client.name;
    state.otherNotes = generatedOtherNotes.trim();
    renderDocument();
    const editorStatus = documentPanel.querySelector('[data-template-form="itinerary"] .portal-form-status');
    editorStatus.textContent = "AI draft generated. Review and edit every event and time, then save the itinerary.";
    setPortalNotice("AI itinerary draft generated. Review it carefully before saving or sharing.");
    documentPanel.querySelector('[data-template-form="itinerary"]').scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    status.textContent = error.message || "Unable to generate an AI itinerary.";
    setPortalNotice(status.textContent, true);
  } finally {
    submitButton.disabled = false;
  }
});

documentPanel.addEventListener("submit", async (event) => {
  const form = event.target.closest("[data-pdf-format-form]");
  if (!form) return;
  event.preventDefault();
  if (!form.reportValidity()) return;

  const state = getDocumentState(activeClientId, "itinerary");
  const clientId = activeClientId;
  const client = clients.find((item) => item.id === clientId);
  const status = form.querySelector(".portal-form-status");
  const submitButton = form.querySelector('button[type="submit"]');
  if (!client || (!state.pendingFile && !state.uploadedDocument)) {
    status.textContent = "Choose an itinerary PDF before converting it.";
    return;
  }

  submitButton.disabled = true;
  status.textContent = "Reading itinerary text from the PDF…";
  try {
    let pdfFile = state.pendingFile;
    if (!pdfFile) {
      const { data, error } = await supabaseClient.storage
        .from("portal-documents")
        .download(state.uploadedDocument.storage_path);
      if (error) throw new Error(`Could not download the saved PDF for conversion: ${error.message}`);
      pdfFile = data;
    }

    const extractedText = await extractItineraryTextFromPdf(pdfFile);
    if (!extractedText) {
      throw new Error("No selectable text was found in this PDF. Scanned/image-only PDFs need OCR before they can be converted.");
    }
    if (extractedText.length > 50_000) {
      throw new Error("This PDF contains more text than can be converted in one request. Split it into smaller sections and try again.");
    }

    status.textContent = "Formatting the itinerary with Google Gemini…";
    const { data, error } = await supabaseClient.functions.invoke("generate-itinerary", {
      body: {
        mode: "pdf-import",
        clientId,
        notes: extractedText,
        eventDate: state.eventDate || client.date,
        venue: state.eventVenue || client.venue || "",
      },
    });
    if (error) {
      const responseBody = error.context instanceof Response
        ? await error.context.clone().json().catch(() => null)
        : null;
      throw new Error(data?.error || responseBody?.error || error.message || "The PDF itinerary could not be converted.");
    }
    if (activeClientId !== clientId || activeDocument !== "itinerary") {
      throw new Error("The client workspace changed while the PDF was being converted. Reopen it and try again.");
    }

    if (!Array.isArray(data?.events) || data.events.length < 1 || data.events.length > 40) {
      throw new Error("The converted PDF did not contain a valid timeline. Try a text-based PDF with clearer event details.");
    }
    const events = data.events.map((item) => {
      if (!item || typeof item !== "object") throw new Error("The converted PDF contains an invalid event.");
      const start = item.start;
      const end = item.end;
      const phase = item.phase;
      const vendor = item.vendor;
      const notes = item.notes;
      if (
        typeof item.title !== "string" ||
        !item.title.trim() ||
        item.title.length > 160 ||
        typeof start !== "string" ||
        (start && !/^([01]\d|2[0-3]):[0-5]\d$/.test(start)) ||
        typeof end !== "string" ||
        (end && !/^([01]\d|2[0-3]):[0-5]\d$/.test(end)) ||
        (phase !== "pre-event" && phase !== "event") ||
        typeof vendor !== "string" ||
        vendor.length > 200 ||
        typeof notes !== "string" ||
        notes.length > 2000
      ) {
        throw new Error("The converted PDF contains an invalid event or time. Try again or edit the itinerary manually.");
      }
      return { phase, title: item.title.trim(), start, end, vendor: vendor.trim(), notes: notes.trim() };
    });

    const metadata = data.metadata && typeof data.metadata === "object" ? data.metadata : {};
    if (
      (metadata.coupleName !== undefined && (typeof metadata.coupleName !== "string" || metadata.coupleName.length > 160)) ||
      (metadata.weddingDate !== undefined && (
        typeof metadata.weddingDate !== "string" ||
        (metadata.weddingDate && !/^\d{4}-\d{2}-\d{2}$/.test(metadata.weddingDate))
      )) ||
      (metadata.venue !== undefined && (typeof metadata.venue !== "string" || metadata.venue.length > 250))
    ) {
      throw new Error("The converted PDF contains invalid couple or wedding details. Please try again.");
    }
    const parsedDate = typeof metadata.weddingDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(metadata.weddingDate)
      ? metadata.weddingDate
      : state.eventDate || client.date;
    state.events = normalizeItineraryEvents(events);
    state.otherNotes = typeof data.otherNotes === "string" ? data.otherNotes.trim() : "";
    state.eventDate = parsedDate;
    state.eventVenue = typeof metadata.venue === "string" && metadata.venue.trim()
      ? metadata.venue.trim()
      : state.eventVenue || client.venue || "";
    state.itineraryClientName = typeof metadata.coupleName === "string" && metadata.coupleName.trim()
      ? metadata.coupleName.trim()
      : client.name;
    state.mode = "create";
    state.viewSource = "";
    renderDocument();
    const editorStatus = documentPanel.querySelector('[data-template-form="itinerary"] .portal-form-status');
    editorStatus.textContent = "PDF converted to an editable draft. Review each section and save when ready.";
    setPortalNotice("The formatted draft is separate from the source PDF. Save the source separately if you want to keep it in the workspace.");
    documentPanel.querySelector('[data-template-form="itinerary"]').scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    status.textContent = error.message || "Unable to convert the PDF itinerary.";
    setPortalNotice(status.textContent, true);
  } finally {
    submitButton.disabled = false;
  }
});

documentPanel.addEventListener("submit", async (event) => {
  const form = event.target.closest("[data-email-form]");
  if (!form) return;
  event.preventDefault();

  const status = form.querySelector(".portal-form-status");
  const recipientInput = form.elements.namedItem("recipient-entry");
  if (recipientInput.value.trim() && !addEmailRecipient(form, status)) return;
  const recipients = [...form.querySelectorAll("[data-email-recipient]")].map((item) => item.dataset.emailRecipient);
  if (!form.reportValidity()) return;
  if (recipients.length < 1 || recipients.length > 5) {
    status.textContent = "Add at least one valid email address before sending.";
    recipientInput.focus();
    return;
  }

  const type = form.dataset.emailForm;
  const typeLabel = type === "contract" ? "contract" : "itinerary";
  const client = clients.find((item) => item.id === form.dataset.clientId);
  if (!client) {
    status.textContent = "The client workspace is no longer available. Reload it and try again.";
    return;
  }
  if (!window.confirm(`Send the ${typeLabel} PDF to ${recipients.join(", ")}?`)) return;

  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  status.textContent = "Preparing the PDF and sending email…";
  try {
    const state = getDocumentState(client.id, type);
    const { filename, blob } = await createEmailPdfAttachment(type, state, client, form.dataset.emailSource);
    if (blob.type && blob.type !== "application/pdf") throw new Error("The generated attachment is not a PDF.");
    if (blob.size > 15 * 1024 * 1024) throw new Error("The PDF is larger than the 15 MB email limit.");

    const { data, error } = await supabaseClient.functions.invoke("send-client-document", {
      body: {
        clientId: client.id,
        documentType: type,
        recipients,
        subject: form.elements.namedItem("subject").value.trim(),
        message: form.elements.namedItem("message").value.trim(),
        attachments: [{ filename, content: await blobToBase64(blob) }],
      },
    });
    if (error) {
      const responseBody = error.context instanceof Response
        ? await error.context.clone().json().catch(() => null)
        : null;
      const details = data?.error || responseBody?.error || error.message;
      throw new Error(`Email could not be sent: ${details}`);
    }
    if (!data?.sent) throw new Error(data?.error || "Email could not be sent.");

    status.textContent = data.logged === false
      ? "Email sent, but its delivery record could not be saved."
      : `Email sent to ${recipients.join(", ")}.`;
    setPortalNotice(status.textContent, data.logged === false);
  } catch (error) {
    status.textContent = error.message || "Unable to send the client email.";
    setPortalNotice(status.textContent, true);
  } finally {
    submitButton.disabled = false;
  }
});

documentPanel.addEventListener("submit", async (event) => {
  const form = event.target.closest("[data-template-form]");
  if (!form) return;
  event.preventDefault();
  const type = form.dataset.templateForm;
  const clientId = activeClientId;
  const state = getDocumentState(clientId, type);
  const client = clients.find((item) => item.id === clientId);
  if (!client) {
    setPortalNotice("The client workspace is no longer available. Reload it and try again.", true);
    return;
  }
  const formData = new FormData(form);
  let draft;
  if (type === "itinerary") {
    const titles = formData.getAll("event-title");
    const phases = formData.getAll("event-phase");
    const starts = formData.getAll("event-start");
    const startPeriods = formData.getAll("event-start-period");
    const ends = formData.getAll("event-end");
    const endPeriods = formData.getAll("event-end-period");
    const vendors = formData.getAll("event-vendor");
    const notes = formData.getAll("event-notes");
    state.events = titles.map((title, index) => ({
      phase: phases[index].toString(),
      title: title.toString(),
      start: parseTimeInput(starts[index].toString(), startPeriods[index].toString()),
      end: parseTimeInput(ends[index].toString(), endPeriods[index].toString()),
      vendor: vendors[index].toString().trim(),
      notes: notes[index].toString().trim(),
    }));
    state.otherNotes = formData.get("other-notes").toString().trim();
    draft = {
      date: formData.get("date").toString(),
      venue: formData.get("venue").toString().trim(),
      clientName: state.itineraryClientName || client.name,
      events: state.events,
      otherNotes: state.otherNotes,
    };
  } else {
    const totalFee = formData.get("total-fee").toString();
    const depositPercentage = formData.get("deposit-percentage").toString();
    if (!calculateContractAmounts(totalFee, depositPercentage)) {
      const status = form.querySelector(".portal-form-status");
      status.textContent = "Enter a total fee greater than zero and a deposit percentage from 0 to 100.";
      setPortalNotice(status.textContent, true);
      return;
    }
    draft = {
      clientName: formData.get("client-name").toString().trim(),
      clientContact: formData.get("client-contact").toString().trim(),
      clientEmail: formData.get("client-email").toString().trim(),
      eventDates: formData.get("event-dates").toString().trim(),
      eventLocation: formData.get("event-location").toString().trim(),
      totalFee: Number(totalFee),
      depositPercentage: Number(depositPercentage),
    };
  }
  const submitButton = form.querySelector('button[type="submit"]');
  const status = form.querySelector(".portal-form-status");
  submitButton.disabled = true;
  status.textContent = "Saving to Supabase…";
  try {
    const { error } = await supabaseClient
      .from("document_drafts")
      .upsert({
        client_id: clientId,
        document_type: type,
        content: draft,
      }, { onConflict: "client_id,document_type" });
    if (error) throw new Error(`Draft could not be saved: ${error.message}`);
    state.savedDraft = draft;
    state.viewSource = "draft";
    state.mode = "view";
    if (type === "itinerary") {
      state.eventDate = draft.date;
      state.eventVenue = draft.venue;
    }
  } catch (error) {
    status.textContent = error.message || "Unable to save the draft.";
    setPortalNotice(status.textContent, true);
    submitButton.disabled = false;
    return;
  }
  renderDocument();
  documentPanel.querySelector(".portal-form-status").textContent = "Draft saved securely.";
  setPortalNotice("The document draft was saved to Supabase.");
});

function openClientDialog() {
  clientDialog.showModal();
  clientDialog.querySelector('input[name="name"]').focus();
}

document.querySelector("#open-client-form").addEventListener("click", openClientDialog);
document.querySelectorAll('[data-action="add-client"]').forEach((button) => button.addEventListener("click", openClientDialog));
document.querySelector("#close-client-form").addEventListener("click", () => clientDialog.close());
document.querySelector("#cancel-client-form").addEventListener("click", () => clientDialog.close());

clientDialog.addEventListener("click", (event) => {
  if (event.target === clientDialog) clientDialog.close();
});

clientForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(clientForm);
  clientStatus.classList.remove("is-success");
  clientStatus.textContent = "";
  clientSubmitButton.disabled = true;
  clientSubmitButton.textContent = "Creating…";
  try {
    const { data, error } = await supabaseClient
      .from("clients")
      .insert({
        couple_name: formData.get("name").toString().trim(),
        wedding_date: formData.get("date").toString(),
        service: formData.get("service").toString(),
        venue: formData.get("venue").toString().trim() || null,
      })
      .select("id, couple_name, wedding_date, service, venue")
      .single();
    if (error) throw new Error(`Client workspace could not be created: ${error.message}`);
    const client = mapClientRow(data);
    clients.push(client);
    renderAll();
    clientForm.reset();
    clientDialog.close();
    setPortalNotice("The client workspace was created and saved to Supabase.");
    await openWorkspace(client.id);
  } catch (error) {
    clientStatus.textContent = error.message || "Unable to create the client workspace.";
    setPortalNotice(clientStatus.textContent, true);
  } finally {
    clientSubmitButton.disabled = false;
    clientSubmitButton.textContent = "Create workspace";
  }
});

window.addEventListener("beforeunload", () => {
  documents.forEach((clientDocuments) => {
    Object.values(clientDocuments).forEach((state) => {
      if (state.uploadUrl) URL.revokeObjectURL(state.uploadUrl);
    });
  });
});
