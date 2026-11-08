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
      events: [{ title: "", start: "", end: "" }],
      eventDate: "",
      eventVenue: "",
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

function serviceLabel(service) {
  return service === "day_of_coordination" ? "Day-of coordination" : "Wedding planning";
}

function setPortalNotice(message, isError = false) {
  const notice = document.querySelector("#portal-data-notice");
  notice.classList.toggle("is-error", isError);
  notice.innerHTML = `<strong>${isError ? "Action needed." : "Supabase connected."}</strong> ${escapeHtml(message)}`;
}

function revokePreviewUrl(url) {
  if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
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
  const titles = { calendar: "Your calendar", clients: "Your clients", workspace: "Client workspace", empty: "Your clients" };
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
      <span class="portal-agenda-arrow" aria-hidden="true">Open workspace ↗</span>
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
      <span class="portal-agenda-arrow" aria-hidden="true">↗</span>
    </button>`).join("");
}

function renderClients() {
  const grid = document.querySelector("#client-grid");
  grid.innerHTML = clients.map((client) => `
    <button class="portal-client-card" type="button" data-open-client="${escapeHtml(client.id)}">
      <span class="portal-client-card-top"><span class="portal-client-avatar" aria-hidden="true">♡</span><span class="portal-agenda-arrow" aria-hidden="true">↗</span></span>
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
      state.pdfLoadingTask = pdfjs.getDocument(state.uploadUrl);
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
  const contract = documentPanel.querySelector(".portal-contract-sheet");
  if (!contract) throw new Error("The generated contract preview is unavailable.");
  if (typeof window.html2pdf !== "function") {
    throw new Error("The PDF generator did not load. Check your connection and try again.");
  }
  button.disabled = true;
  const originalLabel = button.textContent;
  button.textContent = "Preparing contract…";
  try {
    await Promise.all([...contract.querySelectorAll("img")].map((image) => image.decode()));
    await document.fonts.ready;
    contract.classList.add("is-pdf-export");
    const clientName = getDocumentState(activeClientId, "contract").savedDraft.clientName;
    const safeName = clientName
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const pdfWorker = window.html2pdf()
      .set({
        margin: [0.35, 0.35, 0.35, 0.35],
        filename: `Sabr-Plan-Co-${safeName || "Wedding"}-Coordination-Agreement.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
          scrollX: 0,
          scrollY: 0,
          windowHeight: Math.max(window.innerHeight, contract.scrollHeight),
        },
        jsPDF: { unit: "in", format: "letter", orientation: "portrait" },
        pagebreak: { mode: [] },
      })
      .from(contract);
    await pdfWorker.toCanvas();
    const canvas = await pdfWorker.get("canvas");
    if (!canvas.width || !canvas.height) throw new Error("The contract PDF preview is empty.");
    const pixels = canvas.getContext("2d", { willReadFrequently: true })
      .getImageData(0, 0, canvas.width, canvas.height).data;
    let visiblePixels = 0;
    for (let index = 0; index < pixels.length && visiblePixels < 100; index += 4) {
      if (pixels[index + 3] && (pixels[index] < 245 || pixels[index + 1] < 245 || pixels[index + 2] < 245)) {
        visiblePixels += 1;
      }
    }
    if (visiblePixels < 100) throw new Error("The contract could not be rendered, so no blank PDF was downloaded.");
    await pdfWorker.toPdf();
    const pdf = await pdfWorker.get("pdf");
    if (pdf.getNumberOfPages() > 1) {
      throw new Error("This contract is too long to fit on one page. Shorten unusually long client or event details and try again.");
    }
    await pdfWorker.save();
    setPortalNotice("The generated contract PDF has been downloaded.");
  } catch (error) {
    setPortalNotice(`Could not download the generated contract: ${error.message || "Unknown error"}`, true);
  } finally {
    contract.classList.remove("is-pdf-export");
    button.disabled = false;
    button.textContent = originalLabel;
  }
}

function renderItinerary(client, state) {
  if (state.mode === "view" && state.viewSource === "pdf" && state.uploadedDocument) {
    return `<div class="portal-document-heading"><div><p class="eyebrow"><span class="eyebrow-line"></span> ITINERARY</p><h3>Your wedding-day itinerary</h3></div><span class="portal-draft-label">SAVED PDF</span></div>
      ${renderDocumentModeButtons("itinerary", state)}
      <div class="portal-itinerary-document">${renderPdfPreview(state)}</div>`;
  }
  if (state.mode === "view" && state.viewSource === "draft" && state.savedDraft) {
    return `<div class="portal-document-heading"><div><p class="eyebrow"><span class="eyebrow-line"></span> ITINERARY</p><h3>Your wedding-day itinerary</h3></div><span class="portal-draft-label">SAVED ITINERARY</span></div>
      ${renderDocumentModeButtons("itinerary", state)}
      ${renderSavedPreview(state, "itinerary", client)}
      ${renderDraftDeleteButton("itinerary")}`;
  }
  if (state.mode === "upload") {
    return `<div class="portal-document-heading"><div><p class="eyebrow"><span class="eyebrow-line"></span> ITINERARY</p><h3>Upload an itinerary</h3></div><span class="portal-draft-label">PDF PREVIEW</span></div>
      ${renderDocumentModeButtons("itinerary", state)}
      <div class="portal-upload-area">
        <label class="portal-file-label" for="document-upload">Choose itinerary PDF<input id="document-upload" type="file" accept="application/pdf,.pdf" data-document-upload /></label>
        <p class="portal-muted">PDF files only, up to 15 MB. The file is not saved until you choose Save this PDF.</p>
        ${renderPdfPreview(state)}
      </div>`;
  }
  return `<div class="portal-document-heading"><div><p class="eyebrow"><span class="eyebrow-line"></span> ITINERARY</p><h3>Wedding-day timeline</h3></div><span class="portal-draft-label">STARTER TEMPLATE</span></div>
    ${renderDocumentModeButtons("itinerary", state)}
    <form class="portal-template-form" data-template-form="itinerary">
      <div class="portal-form-grid">
        <label>Wedding date<input name="date" type="date" value="${escapeHtml(state.eventDate || state.savedDraft?.date || client.date)}" /></label>
        <label>Venue<input name="venue" type="text" value="${escapeHtml(state.eventVenue || state.savedDraft?.venue || client.venue || "")}" placeholder="Venue or location" /></label>
      </div>
      <div class="portal-template-subheading"><div><h4>Timeline</h4><p>Add the key moments for the day.</p></div><button type="button" class="portal-text-button" data-action="add-event">+ Add event</button></div>
      <div class="portal-event-rows">${state.events.map((event, index) => `
        <div class="portal-event-row">
          <label class="portal-event-name">Event ${index + 1}<input name="event-title" type="text" value="${escapeHtml(event.title)}" placeholder="e.g. Ceremony" /></label>
          <label>Start<div class="portal-time-inputs"><input name="event-start" type="text" inputmode="numeric" placeholder="4:00" pattern="(0?[1-9]|1[0-2]):[0-5][0-9]" title="Enter the time as hour:minute, such as 4:00" value="${escapeHtml(formatTimeInput(event.start))}" /><select name="event-start-period" aria-label="Start time AM or PM"><option value="AM"${timePeriod(event.start) === "AM" ? " selected" : ""}>AM</option><option value="PM"${timePeriod(event.start) === "PM" ? " selected" : ""}>PM</option></select></div></label>
          <label>End<div class="portal-time-inputs"><input name="event-end" type="text" inputmode="numeric" placeholder="4:30" pattern="(0?[1-9]|1[0-2]):[0-5][0-9]" title="Enter the time as hour:minute, such as 4:30" value="${escapeHtml(formatTimeInput(event.end))}" /><select name="event-end-period" aria-label="End time AM or PM"><option value="AM"${timePeriod(event.end) === "AM" ? " selected" : ""}>AM</option><option value="PM"${timePeriod(event.end) === "PM" ? " selected" : ""}>PM</option></select></div></label>
          <button type="button" class="portal-remove-event" data-remove-event="${index}" aria-label="Remove event ${index + 1}">×</button>
        </div>`).join("")}</div>
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
      <div class="portal-itinerary-document">${renderPdfPreview(state)}</div>`;
  }
  if (state.mode === "view" && state.viewSource === "draft" && state.savedDraft) {
    return `<div class="portal-document-heading"><div><p class="eyebrow"><span class="eyebrow-line"></span> CONTRACT</p><h3>Agreement draft</h3></div><span class="portal-draft-label">SAVED DRAFT</span></div>
      ${renderDocumentModeButtons("contract", state)}
      ${renderSavedPreview(state, "contract", client)}
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
    return `<section class="portal-draft-preview portal-itinerary-sheet" aria-label="Saved itinerary">
      <header class="portal-itinerary-sheet-header">
        <span class="portal-itinerary-wordmark">SABR PLAN CO. <span>·</span> COORDINATION</span>
        <p>WEDDING DAY ITINERARY</p>
        <h4>${escapeHtml(draft.venue || "Wedding day timeline")}</h4>
        <div class="portal-itinerary-details">
          <span><small>COUPLE</small><strong>${escapeHtml(client.name)}</strong></span>
          <span><small>WEDDING DATE</small><strong>${escapeHtml(formatDate(draft.date))}</strong></span>
          <span><small>VENUE</small><strong>${escapeHtml(draft.venue || client.venue || "To be confirmed")}</strong></span>
        </div>
      </header>
      <h5 class="portal-itinerary-section-title">Schedule</h5>
      <ol class="portal-preview-timeline">${draft.events.filter((event) => event.title).map((event) => `<li><time>${escapeHtml(formatTime(event.start))}${event.end ? `–${escapeHtml(formatTime(event.end))}` : ""}</time><span>${escapeHtml(event.title)}</span></li>`).join("") || "<li>Add timeline events to preview them.</li>"}</ol>
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
        <img src="assets/sabr-script.png" alt="Sabr Plan Co." />
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
        ? draft.content.events
        : [{ title: "", start: "", end: "" }],
      eventDate: draft.document_type === "itinerary" ? draft.content.date || "" : "",
      eventVenue: draft.document_type === "itinerary" ? draft.content.venue || "" : "",
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
  setPortalNotice("Client records, drafts, and PDFs are stored in the private Supabase project. Contract content is a placeholder until your approved template is provided.");
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
    signInButton.innerHTML = 'Sign in <span aria-hidden="true">↗</span>';
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
    recoveryButton.innerHTML = 'Send recovery email <span aria-hidden="true">↗</span>';
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
    passwordButton.innerHTML = 'Set new password <span aria-hidden="true">↗</span>';
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

documentPanel.addEventListener("click", async (event) => {
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
      state.events = [{ title: "", start: "", end: "" }];
      state.eventDate = "";
      state.eventVenue = "";
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
    const rows = [...form.querySelectorAll(".portal-event-row")].map((row) => ({
      title: row.querySelector('[name="event-title"]').value,
      start: parseTimeInput(
        row.querySelector('[name="event-start"]').value,
        row.querySelector('[name="event-start-period"]').value,
      ),
      end: parseTimeInput(
        row.querySelector('[name="event-end"]').value,
        row.querySelector('[name="event-end-period"]').value,
      ),
    }));
    rows.push({ title: "", start: "", end: "" });
    const state = getDocumentState(activeClientId, activeDocument);
    state.events = rows;
    state.eventDate = form.querySelector('[name="date"]').value;
    state.eventVenue = form.querySelector('[name="venue"]').value;
    renderDocument();
    return;
  }
  const removeButton = event.target.closest("[data-remove-event]");
  if (removeButton) {
    const form = documentPanel.querySelector('[data-template-form="itinerary"]');
    if (!form.reportValidity()) return;
    const rows = [...form.querySelectorAll(".portal-event-row")].map((row) => ({
      title: row.querySelector('[name="event-title"]').value,
      start: parseTimeInput(
        row.querySelector('[name="event-start"]').value,
        row.querySelector('[name="event-start-period"]').value,
      ),
      end: parseTimeInput(
        row.querySelector('[name="event-end"]').value,
        row.querySelector('[name="event-end-period"]').value,
      ),
    }));
    rows.splice(Number(removeButton.dataset.removeEvent), 1);
    const state = getDocumentState(activeClientId, activeDocument);
    state.events = rows.length ? rows : [{ title: "", start: "", end: "" }];
    state.eventDate = form.querySelector('[name="date"]').value;
    state.eventVenue = form.querySelector('[name="venue"]').value;
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
});

documentPanel.addEventListener("submit", async (event) => {
  const form = event.target.closest("[data-template-form]");
  if (!form) return;
  event.preventDefault();
  const type = form.dataset.templateForm;
  const clientId = activeClientId;
  const state = getDocumentState(clientId, type);
  const formData = new FormData(form);
  let draft;
  if (type === "itinerary") {
    const titles = formData.getAll("event-title");
    const starts = formData.getAll("event-start");
    const startPeriods = formData.getAll("event-start-period");
    const ends = formData.getAll("event-end");
    const endPeriods = formData.getAll("event-end-period");
    state.events = titles.map((title, index) => ({
      title: title.toString(),
      start: parseTimeInput(starts[index].toString(), startPeriods[index].toString()),
      end: parseTimeInput(ends[index].toString(), endPeriods[index].toString()),
    }));
    draft = {
      date: formData.get("date").toString(),
      venue: formData.get("venue").toString().trim(),
      events: state.events,
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
