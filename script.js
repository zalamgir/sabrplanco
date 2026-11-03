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

document.querySelector(".inquiry-form").addEventListener("submit", (event) => {
  event.preventDefault();
  document.querySelector(".form-note").textContent =
    "Thanks for sharing a little about your day. This starter form isn't connected yet—add your preferred contact email or form service before publishing.";
});
