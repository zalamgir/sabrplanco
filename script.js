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
      const response = await fetch(inquiryForm.action, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(Object.fromEntries(formData)),
      });
      const result = await response.json();

      if (!response.ok || result.success !== true) {
        formStatus.textContent =
          result.message || "We couldn't send your inquiry. Please try again or email sabrplanco@gmail.com.";
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
