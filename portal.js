const loginScreen = document.querySelector("#portal-login");
const portalApp = document.querySelector("#portal-app");
const clientDialog = document.querySelector("#client-dialog");
const clientForm = document.querySelector("#client-form");
const documentPanel = document.querySelector("#document-panel");
const today = new Date();
today.setHours(0, 0, 0, 0);

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateAfter(days) {
  const date = new Date(today);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

const sampleClients = [
  { id: "sample-1", name: "Amira + Sam", date: dateAfter(24), service: "Wedding planning", venue: "The Garden House" },
  { id: "sample-2", name: "Lina + Omar", date: dateAfter(58), service: "Day-of coordination", venue: "Hudson Valley, NY" },
  { id: "sample-3", name: "Maya + Elias", date: dateAfter(103), service: "Wedding planning", venue: "New Jersey" },
];
const clients = [...sampleClients];
const documents = new Map();
let activeClientId = null;
let activeDocument = "itinerary";
let activeView = "calendar";
let calendarMonth = new Date(today.getFullYear(), today.getMonth(), 1);
let selectedDate = toDateKey(today);
let clientIdCounter = 1;

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
      events: [{ title: "Guest arrival", start: "16:00", end: "16:30" }],
      eventDate: "",
      eventVenue: "",
      mode: "create",
      uploadUrl: "",
      uploadName: "",
      savedDraft: null,
    };
  }
  return clientDocuments[type];
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
  renderAgenda();
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
}

function renderDocumentModeButtons(type, state) {
  return `
    <div class="portal-mode-tabs" role="tablist" aria-label="${type === "itinerary" ? "Itinerary" : "Contract"} options">
      <button type="button" class="portal-mode-tab${state.mode === "create" ? " is-active" : ""}" data-mode="create" role="tab" aria-selected="${state.mode === "create"}">Create from template</button>
      <button type="button" class="portal-mode-tab${state.mode === "upload" ? " is-active" : ""}" data-mode="upload" role="tab" aria-selected="${state.mode === "upload"}">Upload PDF</button>
    </div>`;
}

function renderPdfPreview(state) {
  if (!state.uploadUrl) {
    return `<div class="portal-upload-empty">
      <span aria-hidden="true">▤</span>
      <strong>No PDF uploaded in this demo</strong>
      <small>Select a PDF to preview it temporarily in this browser.</small>
    </div>`;
  }
  return `<div class="portal-pdf-preview">
    <div class="portal-pdf-heading"><strong>${escapeHtml(state.uploadName)}</strong><button type="button" class="portal-text-button" data-action="remove-upload">Remove file</button></div>
    <iframe src="${state.uploadUrl}" title="Temporary PDF preview" class="portal-pdf-frame"></iframe>
  </div>`;
}

function renderItinerary(client, state) {
  if (state.mode === "upload") {
    return `<div class="portal-document-heading"><div><p class="eyebrow"><span class="eyebrow-line"></span> ITINERARY</p><h3>Upload an itinerary</h3></div><span class="portal-draft-label">PDF PREVIEW</span></div>
      ${renderDocumentModeButtons("itinerary", state)}
      <div class="portal-upload-area">
        <label class="portal-file-label" for="document-upload">Choose itinerary PDF<input id="document-upload" type="file" accept="application/pdf,.pdf" data-document-upload /></label>
        <p class="portal-muted">PDF files only. This preview is temporary and disappears when you leave or refresh.</p>
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
          <label>Start<input name="event-start" type="time" value="${escapeHtml(event.start)}" /></label>
          <label>End<input name="event-end" type="time" value="${escapeHtml(event.end)}" /></label>
          <button type="button" class="portal-remove-event" data-remove-event="${index}" aria-label="Remove event ${index + 1}">×</button>
        </div>`).join("")}</div>
      <div class="portal-form-actions">
        <span class="portal-form-status" role="status" aria-live="polite"></span>
        <button type="submit" class="button button-dark">Save demo draft</button>
      </div>
    </form>
    ${renderSavedPreview(state, "itinerary")}`;
}

function renderContract(client, state) {
  if (state.mode === "upload") {
    return `<div class="portal-document-heading"><div><p class="eyebrow"><span class="eyebrow-line"></span> CONTRACT</p><h3>Upload a contract</h3></div><span class="portal-draft-label">PDF PREVIEW</span></div>
      ${renderDocumentModeButtons("contract", state)}
      <div class="portal-upload-area">
        <label class="portal-file-label" for="document-upload">Choose contract PDF<input id="document-upload" type="file" accept="application/pdf,.pdf" data-document-upload /></label>
        <p class="portal-muted">PDF files only. This preview is temporary and disappears when you leave or refresh.</p>
        ${renderPdfPreview(state)}
      </div>`;
  }
  return `<div class="portal-document-heading"><div><p class="eyebrow"><span class="eyebrow-line"></span> CONTRACT</p><h3>Agreement starter</h3></div><span class="portal-draft-label">DRAFT TEMPLATE</span></div>
    ${renderDocumentModeButtons("contract", state)}
    <div class="portal-legal-notice"><strong>Structure demo only.</strong> This isn't legal language or a usable contract. Replace it with your approved template before real use.</div>
    <form class="portal-template-form" data-template-form="contract">
      <div class="portal-form-grid">
        <label>Couple / client name<input name="client-name" type="text" value="${escapeHtml(state.savedDraft?.name || client.name)}" /></label>
        <label>Wedding date<input name="date" type="date" value="${escapeHtml(state.savedDraft?.date || client.date)}" /></label>
        <label>Service<input name="service" type="text" value="${escapeHtml(state.savedDraft?.service || client.service)}" /></label>
        <label>Venue / location<input name="venue" type="text" value="${escapeHtml(state.savedDraft?.venue || client.venue || "")}" placeholder="Venue or location" /></label>
      </div>
      <label class="portal-terms-label">Approved terms / notes<textarea name="terms" rows="4" placeholder="Add your approved template terms here when ready.">${escapeHtml(state.savedDraft?.terms || "")}</textarea></label>
      <div class="portal-form-actions">
        <span class="portal-form-status" role="status" aria-live="polite"></span>
        <button type="submit" class="button button-dark">Save demo draft</button>
      </div>
    </form>
    ${renderSavedPreview(state, "contract")}`;
}

function renderSavedPreview(state, type) {
  if (!state.savedDraft) return "";
  if (type === "itinerary") {
    const draft = state.savedDraft;
    return `<section class="portal-draft-preview" aria-label="Saved itinerary demo draft">
      <div class="portal-preview-header"><span class="portal-draft-label">DEMO DRAFT</span><small>Saved in memory for this session</small></div>
      <h4>${escapeHtml(draft.venue || "Wedding day itinerary")}</h4>
      <p class="portal-muted">${escapeHtml(formatDate(draft.date))}</p>
      <ol class="portal-preview-timeline">${draft.events.filter((event) => event.title).map((event) => `<li><time>${escapeHtml(event.start || "—")}${event.end ? `–${escapeHtml(event.end)}` : ""}</time><span>${escapeHtml(event.title)}</span></li>`).join("") || "<li>Add timeline events to preview them.</li>"}</ol>
    </section>`;
  }
  const draft = state.savedDraft;
  return `<section class="portal-draft-preview" aria-label="Saved contract demo draft">
    <div class="portal-preview-header"><span class="portal-draft-label">DEMO DRAFT · NOT A CONTRACT</span><small>Saved in memory for this session</small></div>
    <h4>Wedding coordination agreement</h4>
    <p><strong>Client:</strong> ${escapeHtml(draft.name || "Not specified")}</p>
    <p><strong>Date:</strong> ${escapeHtml(formatDate(draft.date))}</p>
    <p><strong>Service:</strong> ${escapeHtml(draft.service || "Not specified")}</p>
    <p><strong>Location:</strong> ${escapeHtml(draft.venue || "Not specified")}</p>
    <p class="portal-preview-placeholder">Approved agreement terms will go here once the template is provided.</p>
    ${draft.terms ? `<p>${escapeHtml(draft.terms).replace(/\n/g, "<br />")}</p>` : ""}
  </section>`;
}

function openWorkspace(clientId) {
  const client = clients.find((item) => item.id === clientId);
  if (!client) return;
  activeClientId = clientId;
  activeDocument = "itinerary";
  document.querySelector("#workspace-title").textContent = client.name;
  document.querySelector("#workspace-meta").textContent = `${formatDate(client.date)} · ${client.service}${client.venue ? ` · ${client.venue}` : ""}`;
  renderDocument();
  showView("workspace");
}

function renderAll() {
  renderSummary();
  renderCalendar();
  renderClients();
}

document.querySelector("#enter-demo").addEventListener("click", () => {
  loginScreen.hidden = true;
  portalApp.hidden = false;
  renderAll();
});

document.querySelector("#exit-demo").addEventListener("click", () => {
  documents.forEach((clientDocuments) => {
    Object.values(clientDocuments).forEach((state) => {
      if (state.uploadUrl) URL.revokeObjectURL(state.uploadUrl);
    });
  });
  documents.clear();
  clients.splice(0, clients.length, ...sampleClients);
  calendarMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  selectedDate = toDateKey(today);
  activeClientId = null;
  clientDialog.close();
  clientForm.reset();
  renderAll();
  portalApp.hidden = true;
  loginScreen.hidden = false;
  showView("calendar");
});

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
  renderCalendar();
});

document.querySelector("#next-month").addEventListener("click", () => {
  calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1);
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

documentPanel.addEventListener("click", (event) => {
  const modeButton = event.target.closest("[data-mode]");
  if (modeButton) {
    const state = getDocumentState(activeClientId, activeDocument);
    state.mode = modeButton.dataset.mode;
    renderDocument();
    return;
  }
  if (event.target.closest('[data-action="add-event"]')) {
    const form = documentPanel.querySelector('[data-template-form="itinerary"]');
    const rows = [...form.querySelectorAll(".portal-event-row")].map((row) => ({
      title: row.querySelector('[name="event-title"]').value,
      start: row.querySelector('[name="event-start"]').value,
      end: row.querySelector('[name="event-end"]').value,
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
    const rows = [...form.querySelectorAll(".portal-event-row")].map((row) => ({
      title: row.querySelector('[name="event-title"]').value,
      start: row.querySelector('[name="event-start"]').value,
      end: row.querySelector('[name="event-end"]').value,
    }));
    rows.splice(Number(removeButton.dataset.removeEvent), 1);
    const state = getDocumentState(activeClientId, activeDocument);
    state.events = rows.length ? rows : [{ title: "", start: "", end: "" }];
    state.eventDate = form.querySelector('[name="date"]').value;
    state.eventVenue = form.querySelector('[name="venue"]').value;
    renderDocument();
    return;
  }
  if (event.target.closest('[data-action="remove-upload"]')) {
    const state = getDocumentState(activeClientId, activeDocument);
    if (state.uploadUrl) URL.revokeObjectURL(state.uploadUrl);
    state.uploadUrl = "";
    state.uploadName = "";
    renderDocument();
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
  if (file.size > 15 * 1024 * 1024) {
    event.target.value = "";
    window.alert("For this browser demo, please choose a PDF smaller than 15 MB.");
    return;
  }
  const state = getDocumentState(activeClientId, activeDocument);
  if (state.uploadUrl) URL.revokeObjectURL(state.uploadUrl);
  state.uploadUrl = URL.createObjectURL(file);
  state.uploadName = file.name;
  renderDocument();
});

documentPanel.addEventListener("submit", (event) => {
  const form = event.target.closest("[data-template-form]");
  if (!form) return;
  event.preventDefault();
  const type = form.dataset.templateForm;
  const state = getDocumentState(activeClientId, type);
  const formData = new FormData(form);
  if (type === "itinerary") {
    const titles = formData.getAll("event-title");
    const starts = formData.getAll("event-start");
    const ends = formData.getAll("event-end");
    state.events = titles.map((title, index) => ({
      title: title.toString(),
      start: starts[index].toString(),
      end: ends[index].toString(),
    }));
    state.savedDraft = {
      date: formData.get("date").toString(),
      venue: formData.get("venue").toString().trim(),
      events: state.events,
    };
    state.eventDate = state.savedDraft.date;
    state.eventVenue = state.savedDraft.venue;
  } else {
    state.savedDraft = {
      name: formData.get("client-name").toString().trim(),
      date: formData.get("date").toString(),
      service: formData.get("service").toString().trim(),
      venue: formData.get("venue").toString().trim(),
      terms: formData.get("terms").toString().trim(),
    };
  }
  renderDocument();
  const status = documentPanel.querySelector(".portal-form-status");
  status.textContent = "Demo draft saved for this browser session.";
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

clientForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(clientForm);
  const client = {
    id: `demo-${clientIdCounter++}`,
    name: formData.get("name").toString().trim(),
    date: formData.get("date").toString(),
    service: formData.get("service").toString(),
    venue: formData.get("venue").toString().trim(),
  };
  clients.push(client);
  renderAll();
  clientForm.reset();
  clientDialog.close();
  openWorkspace(client.id);
});

window.addEventListener("beforeunload", () => {
  documents.forEach((clientDocuments) => {
    Object.values(clientDocuments).forEach((state) => {
      if (state.uploadUrl) URL.revokeObjectURL(state.uploadUrl);
    });
  });
});
