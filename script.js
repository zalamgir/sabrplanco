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

const portfolioTabs = [...document.querySelectorAll(".portfolio-tab")];
const portfolioPanels = [...document.querySelectorAll(".portfolio-panel")];

function selectPortfolioTab(tab) {
  portfolioTabs.forEach((portfolioTab) => {
    const isSelected = portfolioTab === tab;
    portfolioTab.classList.toggle("is-active", isSelected);
    portfolioTab.setAttribute("aria-selected", String(isSelected));
    portfolioTab.tabIndex = isSelected ? 0 : -1;
  });

  const selectedPanelId = tab.getAttribute("aria-controls");
  portfolioPanels.forEach((panel) => {
    panel.hidden = panel.id !== selectedPanelId;
  });
}

portfolioTabs.forEach((tab, index) => {
  tab.addEventListener("click", () => selectPortfolioTab(tab));
  tab.addEventListener("keydown", (event) => {
    let nextIndex;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % portfolioTabs.length;
    if (event.key === "ArrowLeft") nextIndex = (index - 1 + portfolioTabs.length) % portfolioTabs.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = portfolioTabs.length - 1;
    if (nextIndex === undefined) return;

    event.preventDefault();
    portfolioTabs[nextIndex].focus();
    selectPortfolioTab(portfolioTabs[nextIndex]);
  });
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
