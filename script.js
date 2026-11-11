const menuToggle = document.querySelector(".menu-toggle");
const navigation = document.querySelector(".navigation");

menuToggle.addEventListener("click", () => {
  const isOpen = menuToggle.getAttribute("aria-expanded") === "true";
  menuToggle.setAttribute("aria-expanded", String(!isOpen));
  menuToggle.setAttribute("aria-label", isOpen ? "Open navigation" : "Close navigation");
  navigation.classList.toggle("is-open", !isOpen);
});

navigation.addEventListener("click", (event) => {
  if (event.target.closest("a")) {
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-label", "Open navigation");
    navigation.classList.remove("is-open");
  }
});

async function sendInquiryEmail(formData) {
  const response = await fetch(inquiryForm.action, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(Object.fromEntries(formData)),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.success !== true) {
    throw new Error(result.message || "We couldn't send your inquiry. Please try again or email sabrplanco@gmail.com.");
  }
}

async function saveInquiryToPortal(formData) {
  const config = window.PORTAL_CONFIG;
  if (!config?.supabaseUrl || !config?.supabasePublishableKey) throw new Error("Inquiry storage is not configured.");
  if (formData.get("botcheck")) throw new Error("Spam check failed.");
  const text = (name, max) => formData.get(name)?.toString().trim().slice(0, max) || null;
  const weddingDate = text("wedding_date", 10);
  // Insert-only: the website can add an inquiry but cannot read any back.
  const response = await fetch(`${config.supabaseUrl}/rest/v1/inquiries`, {
    method: "POST",
    headers: {
      apikey: config.supabasePublishableKey,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      name: text("name", 200),
      email: text("email", 320),
      service: text("service", 100),
      wedding_date: weddingDate && /^\d{4}-\d{2}-\d{2}$/.test(weddingDate) ? weddingDate : null,
      venue: text("venue", 250),
      message: text("message", 5000),
    }),
  });
  if (!response.ok) throw new Error("The inquiry could not be saved.");
}

const inquiryForm = document.querySelector(".inquiry-form");
if (inquiryForm) {
  const formStatus = inquiryForm.querySelector(".form-note");
  const submitButton = inquiryForm.querySelector('button[type="submit"]');
  const defaultButtonText = submitButton.innerText;

  inquiryForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    submitButton.disabled = true;
    submitButton.textContent = "Sending...";
    formStatus.textContent = "Sending your inquiry...";

    try {
      const formData = new FormData(inquiryForm);
      const inquiryName = formData.get("name")?.toString().trim();
      formData.set("subject", `Sabr Plan Co. - New Inquiry from ${inquiryName}`);
      // Email the inquiry (Web3Forms) and save it for the coordinator portal at the same time.
      // The inquiry counts as sent if either succeeds.
      const [emailResult, portalResult] = await Promise.allSettled([
        sendInquiryEmail(formData),
        saveInquiryToPortal(formData),
      ]);

      if (emailResult.status === "rejected" && portalResult.status === "rejected") {
        formStatus.textContent =
          emailResult.reason?.message || "We couldn't send your inquiry. Please try again or email sabrplanco@gmail.com.";
        return;
      }

      inquiryForm.reset();
      formStatus.textContent =
        "Thank you for reaching out! Your inquiry has been sent. We'll be in touch soon.";
    } catch {
      formStatus.textContent =
        "We couldn't send your inquiry. Please check your connection and try again, or email sabrplanco@gmail.com.";
    } finally {
      submitButton.disabled = false;
      submitButton.innerText = defaultButtonText;
    }
  });
}

// Portfolio page: published couples from the coordinator portal ---------------------
const portfolioGrid = document.querySelector("#portfolio-grid");
if (portfolioGrid) {
  const config = window.PORTAL_CONFIG;
  const storyDialog = document.querySelector("#story-dialog");
  const lightbox = document.querySelector("#lightbox");
  const lightboxImage = document.querySelector("#lightbox-image");
  const SERVICE_LABELS = { day_of_coordination: "Day-of coordination", wedding_planning: "Wedding planning" };
  let stories = [];
  let activeStory = null;
  let lightboxIndex = 0;

  const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (character) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]
  ));
  const photoUrl = (path) => `${config.supabaseUrl}/storage/v1/object/public/portfolio-photos/${String(path).split("/").map(encodeURIComponent).join("/")}`;
  const monthYear = (dateKey) => {
    if (!dateKey) return "";
    const [year, month] = dateKey.split("-").map(Number);
    return new Date(year, month - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  };
  const safeLink = (url) => (/^https?:\/\//i.test(url || "") ? url : "");
  const snippet = (text, length = 140) => {
    const clean = String(text || "").replace(/\s+/g, " ").trim();
    return clean.length > length ? `${clean.slice(0, length).replace(/\s+\S*$/, "")}…` : clean;
  };

  function renderGrid() {
    portfolioGrid.setAttribute("aria-busy", "false");
    if (!stories.length) {
      portfolioGrid.innerHTML = `<div class="portfolio-empty">
        <p>Our first love stories are on their way.</p>
        <a class="text-link" href="https://www.instagram.com/sabrplanco" target="_blank" rel="noopener noreferrer">See recent celebrations on Instagram <span aria-hidden="true">↗︎</span></a>
      </div>`;
      return;
    }
    portfolioGrid.innerHTML = stories.map((story) => {
      const cover = story.photos[0];
      const meta = [monthYear(story.wedding_date), story.venue].filter(Boolean).join(" · ");
      return `<button type="button" class="portfolio-card" data-story="${escapeHtml(story.id)}">
        <span class="portfolio-card-image">${cover ? `<img src="${escapeHtml(photoUrl(cover.thumb))}" alt="" loading="lazy" width="${Number(cover.width) || ""}" height="${Number(cover.height) || ""}" />` : ""}</span>
        <span class="portfolio-card-body">
          <strong>${escapeHtml(story.couple_names)}</strong>
          ${meta ? `<small>${escapeHtml(meta)}</small>` : ""}
          ${story.review ? `<span class="portfolio-card-quote">“${escapeHtml(snippet(story.review))}”</span>` : ""}
          <span class="text-link">See their story <span aria-hidden="true">↗︎</span></span>
        </span>
      </button>`;
    }).join("");
  }

  function openStory(id, { push = true } = {}) {
    const story = stories.find((item) => item.id === id);
    if (!story) return;
    activeStory = story;
    document.querySelector("#story-title").textContent = story.couple_names;
    document.querySelector("#story-eyebrow").textContent = SERVICE_LABELS[story.service]?.toUpperCase() || "A LOVE STORY";
    document.querySelector("#story-meta").textContent = [monthYear(story.wedding_date), story.venue].filter(Boolean).join(" · ");
    const review = document.querySelector("#story-review");
    review.hidden = !story.review;
    document.querySelector("#story-review-text").textContent = story.review ? `“${story.review}”` : "";
    document.querySelector("#story-review-by").textContent = story.review ? `— ${story.couple_names}` : "";
    document.querySelector("#story-gallery").innerHTML = story.photos.map((photo, index) => `
      <button type="button" class="story-photo" data-photo-index="${index}" aria-label="Open photo ${index + 1} of ${story.photos.length}">
        <img src="${escapeHtml(photoUrl(photo.thumb))}" alt="${escapeHtml(`${story.couple_names} wedding photo ${index + 1}`)}" loading="lazy" />
      </button>`).join("");
    const credit = document.querySelector("#story-credit");
    const link = safeLink(story.photographer_url);
    credit.hidden = !story.photographer_name;
    credit.innerHTML = story.photographer_name
      ? `Photos by ${link ? `<a href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(story.photographer_name)}</a>` : escapeHtml(story.photographer_name)}`
      : "";
    closeLightbox();
    if (!storyDialog.open) storyDialog.showModal();
    storyDialog.querySelector(".story-inner").scrollTop = 0;
    if (push) history.pushState({ story: id }, "", `#${encodeURIComponent(id)}`);
  }

  function closeStory({ fromHistory = false } = {}) {
    closeLightbox();
    if (storyDialog.open) storyDialog.close();
    activeStory = null;
    if (!fromHistory && window.location.hash) history.pushState({}, "", window.location.pathname + window.location.search);
  }

  function showLightbox(index) {
    if (!activeStory) return;
    const count = activeStory.photos.length;
    lightboxIndex = (index + count) % count;
    const photo = activeStory.photos[lightboxIndex];
    lightboxImage.src = photoUrl(photo.full);
    lightboxImage.alt = `${activeStory.couple_names} wedding photo ${lightboxIndex + 1}`;
    document.querySelector("#lightbox-count").textContent = `${lightboxIndex + 1} / ${count}`;
    lightbox.querySelectorAll("[data-lightbox-step]").forEach((button) => {
      button.hidden = count < 2;
    });
    lightbox.hidden = false;
    // Preload the neighbours so swiping feels instant.
    [1, -1].forEach((step) => {
      const next = activeStory.photos[(lightboxIndex + step + count) % count];
      if (next) new Image().src = photoUrl(next.full);
    });
  }

  function closeLightbox() {
    lightbox.hidden = true;
    lightboxImage.removeAttribute("src");
  }

  portfolioGrid.addEventListener("click", (event) => {
    const card = event.target.closest("[data-story]");
    if (card) openStory(card.dataset.story);
  });
  storyDialog.addEventListener("click", (event) => {
    if (event.target.closest("[data-story-close]") || event.target === storyDialog) closeStory();
    else if (event.target.closest("[data-lightbox-close]")) closeLightbox();
    else if (event.target.closest("[data-lightbox-step]")) showLightbox(lightboxIndex + Number(event.target.closest("[data-lightbox-step]").dataset.lightboxStep));
    else if (event.target.closest("[data-photo-index]")) showLightbox(Number(event.target.closest("[data-photo-index]").dataset.photoIndex));
  });
  // Escape closes the photo viewer first, then the story.
  storyDialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    if (!lightbox.hidden) closeLightbox();
    else closeStory();
  });
  document.addEventListener("keydown", (event) => {
    if (lightbox.hidden) return;
    if (event.key === "ArrowRight") showLightbox(lightboxIndex + 1);
    if (event.key === "ArrowLeft") showLightbox(lightboxIndex - 1);
  });
  let touchStartX = null;
  lightbox.addEventListener("touchstart", (event) => {
    touchStartX = event.touches[0].clientX;
  }, { passive: true });
  lightbox.addEventListener("touchend", (event) => {
    if (touchStartX === null) return;
    const deltaX = event.changedTouches[0].clientX - touchStartX;
    touchStartX = null;
    if (Math.abs(deltaX) > 50) showLightbox(lightboxIndex + (deltaX < 0 ? 1 : -1));
  });
  window.addEventListener("popstate", () => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (id && stories.some((story) => story.id === id)) openStory(id, { push: false });
    else if (storyDialog.open) closeStory({ fromHistory: true });
  });

  async function loadStories() {
    if (!config?.supabaseUrl) return renderGrid();
    try {
      const query = "select=id,couple_names,wedding_date,venue,service,review,photographer_name,photographer_url,photos"
        + "&published=eq.true&order=sort_order.asc,wedding_date.desc.nullslast";
      const response = await fetch(`${config.supabaseUrl}/rest/v1/portfolio_entries?${query}`, {
        headers: { apikey: config.supabasePublishableKey, Accept: "application/json" },
      });
      if (!response.ok) throw new Error(String(response.status));
      const rows = await response.json();
      stories = rows
        .map((row) => ({ ...row, photos: Array.isArray(row.photos) ? row.photos.filter((photo) => photo?.full && photo?.thumb) : [] }))
        .filter((row) => row.photos.length);
    } catch {
      stories = [];
    }
    renderGrid();
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (id) openStory(id, { push: false });
  }

  loadStories();
}
