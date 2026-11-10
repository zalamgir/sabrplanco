if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch((error) => {
      console.error("The portal app could not be installed.", error);
    });
    // Hand the worker everything this page loaded so the portal can open offline.
    navigator.serviceWorker.ready.then((registration) => {
      const urls = [
        window.location.href.split("#")[0],
        ...performance.getEntriesByType("resource").map((entry) => entry.name),
        "https://cdn.jsdelivr.net/npm/pdfjs-dist@6.4.299/legacy/build/pdf.min.mjs",
        "https://cdn.jsdelivr.net/npm/pdfjs-dist@6.4.299/legacy/build/pdf.worker.min.mjs",
      ];
      registration.active?.postMessage({ type: "cache-urls", urls });
    }).catch(() => {});
  });
}
