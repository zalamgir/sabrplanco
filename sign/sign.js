// Public contract signing page. The private token is in the URL fragment (#...), which
// browsers never send to a server; it is only passed to the contract-signing function.
(() => {
  const token = window.location.hash.slice(1);
  const config = window.PORTAL_CONFIG;
  const endpoint = config?.supabaseUrl ? `${config.supabaseUrl}/functions/v1/contract-signing` : "";
  const states = ["loading", "error", "ready", "done"];
  const canvas = document.querySelector("#signature-canvas");
  const context = canvas.getContext("2d");
  const nameInput = document.querySelector("#signer-name");
  const hint = document.querySelector("#signature-hint");
  const clearButton = document.querySelector("#signature-clear");
  const status = document.querySelector("#sign-status");
  const submitButton = document.querySelector("#sign-submit");
  const INK = "#3b261b";
  let method = "typed";
  let hasDrawing = false;

  function show(state) {
    states.forEach((name) => {
      document.querySelector(`#sign-${name}`).hidden = name !== state;
    });
    window.scrollTo(0, 0);
  }

  function showError(message) {
    document.querySelector("#sign-error-message").textContent = message;
    show("error");
  }

  function showSigned({ signerName, signedAt, downloadUrl, emailed, justSigned }) {
    const firstName = (signerName || "").split(" ")[0] || "you";
    document.querySelector("#sign-done-name").textContent = `${firstName}.`;
    const when = signedAt
      ? new Date(signedAt).toLocaleString("en-US", { month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })
      : "";
    document.querySelector("#sign-done-message").textContent = justSigned
      ? `Your contract is signed${when ? ` (${when})` : ""}. ${emailed === false ? "Download your copy below to keep for your records." : "A copy has been emailed to you, and you can also download it below."}`
      : `This contract was signed${signerName ? ` by ${signerName}` : ""}${when ? ` on ${when}` : ""}. You can download a copy below.`;
    const download = document.querySelector("#sign-download");
    download.href = downloadUrl || "#";
    download.hidden = !downloadUrl;
    show("done");
  }

  async function callFunction(body) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: config.supabasePublishableKey },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.error || "Something went wrong. Please try again.");
      error.code = data.code;
      throw error;
    }
    return data;
  }

  // Contract preview --------------------------------------------------------
  async function renderContract(url) {
    const container = document.querySelector("#sign-document");
    const pdfjs = window.pdfjsLib;
    if (!pdfjs) {
      container.innerHTML = `<p class="sign-muted">The contract preview couldn't load. <a href="${url}" target="_blank" rel="noopener">Open the contract PDF</a> to read it.</p>`;
      return;
    }
    pdfjs.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
    const pdf = await pdfjs.getDocument({ url, isEvalSupported: false }).promise;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    for (let number = 1; number <= pdf.numPages; number += 1) {
      const page = await pdf.getPage(number);
      const width = container.clientWidth || 600;
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: (width / base.width) * ratio });
      const pageCanvas = document.createElement("canvas");
      pageCanvas.width = viewport.width;
      pageCanvas.height = viewport.height;
      pageCanvas.className = "sign-page";
      pageCanvas.setAttribute("aria-label", `Contract page ${number} of ${pdf.numPages}`);
      container.append(pageCanvas);
      await page.render({ canvasContext: pageCanvas.getContext("2d"), viewport }).promise;
    }
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener";
    link.className = "sign-open-pdf";
    link.textContent = "Open the contract as a PDF";
    container.append(link);
  }

  // Signature pad ------------------------------------------------------------
  function sizeCanvas() {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * ratio;
    canvas.height = canvas.clientHeight * ratio;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = 2.4;
    context.strokeStyle = INK;
    context.fillStyle = INK;
  }

  function clearCanvas() {
    context.clearRect(0, 0, canvas.width, canvas.height);
    hasDrawing = false;
  }

  function drawTypedSignature() {
    clearCanvas();
    const name = nameInput.value.trim();
    hint.hidden = Boolean(name);
    if (!name) return;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    let size = 64;
    context.textBaseline = "middle";
    do {
      context.font = `${size}px "Great Vibes", cursive`;
      size -= 2;
    } while (context.measureText(name).width > width - 32 && size > 20);
    context.fillText(name, 16, height / 2);
  }

  function setMethod(next) {
    method = next;
    document.querySelectorAll("[data-sign-method]").forEach((button) => {
      const active = button.dataset.signMethod === method;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    clearButton.hidden = method !== "drawn";
    canvas.classList.toggle("is-drawing", method === "drawn");
    clearCanvas();
    hint.textContent = method === "drawn"
      ? "Draw your signature here with your finger or mouse."
      : "Type your name above to create your signature.";
    hint.hidden = false;
    if (method === "typed") drawTypedSignature();
    status.textContent = "";
  }

  let drawingPointer = null;
  canvas.addEventListener("pointerdown", (event) => {
    if (method !== "drawn") return;
    drawingPointer = event.pointerId;
    canvas.setPointerCapture(event.pointerId);
    const rect = canvas.getBoundingClientRect();
    context.beginPath();
    context.moveTo(event.clientX - rect.left, event.clientY - rect.top);
    hint.hidden = true;
  });
  canvas.addEventListener("pointermove", (event) => {
    if (event.pointerId !== drawingPointer) return;
    const rect = canvas.getBoundingClientRect();
    context.lineTo(event.clientX - rect.left, event.clientY - rect.top);
    context.stroke();
    hasDrawing = true;
  });
  const endStroke = () => {
    drawingPointer = null;
  };
  canvas.addEventListener("pointerup", endStroke);
  canvas.addEventListener("pointercancel", endStroke);

  // Crop to the signature with a little padding so it sits nicely on the certificate.
  function signatureDataUrl() {
    const { width, height } = canvas;
    const pixels = context.getImageData(0, 0, width, height).data;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (pixels[(y * width + x) * 4 + 3] > 10) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) return "";
    const pad = 12;
    const cropX = Math.max(0, minX - pad);
    const cropY = Math.max(0, minY - pad);
    const cropWidth = Math.min(width, maxX + pad) - cropX;
    const cropHeight = Math.min(height, maxY + pad) - cropY;
    const output = document.createElement("canvas");
    output.width = cropWidth;
    output.height = cropHeight;
    output.getContext("2d").drawImage(canvas, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
    return output.toDataURL("image/png");
  }

  document.querySelectorAll("[data-sign-method]").forEach((button) => {
    button.addEventListener("click", () => setMethod(button.dataset.signMethod));
  });
  clearButton.addEventListener("click", () => {
    clearCanvas();
    hint.hidden = false;
  });
  nameInput.addEventListener("input", () => {
    if (method === "typed") drawTypedSignature();
    status.textContent = "";
  });
  document.querySelectorAll(".sign-check input").forEach((box) => {
    box.addEventListener("change", () => {
      status.textContent = "";
    });
  });
  window.addEventListener("resize", () => {
    sizeCanvas();
    if (method === "typed") drawTypedSignature();
    else clearCanvas();
  });

  document.querySelector("#sign-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const signerName = nameInput.value.replace(/\s+/g, " ").trim();
    if (signerName.length < 2) {
      status.textContent = "Type your full legal name.";
      nameInput.focus();
      return;
    }
    if (method === "drawn" && !hasDrawing) {
      status.textContent = "Draw your signature in the box, or choose Use my typed name.";
      return;
    }
    if (!document.querySelector("#agree-terms").checked || !document.querySelector("#agree-electronic").checked) {
      status.textContent = "Please tick both boxes to confirm before signing.";
      return;
    }
    if (method === "typed") drawTypedSignature();
    const signature = signatureDataUrl();
    if (!signature) {
      status.textContent = "Your signature is empty. Please try again.";
      return;
    }
    submitButton.disabled = true;
    submitButton.textContent = "Signing…";
    status.textContent = "";
    try {
      const result = await callFunction({ action: "sign", token, signerName, method, signature, consent: true });
      showSigned({ ...result, justSigned: true });
    } catch (error) {
      if (error.code === "signed" || error.code === "expired" || error.code === "voided") showError(error.message);
      else status.textContent = error.message;
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Sign contract";
    }
  });

  async function start() {
    if (!endpoint) return showError("Contract signing isn't available right now. Please contact Sabr Plan Co.");
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
      return showError("This signing link isn't complete. Please open the link from your email again.");
    }
    try {
      const data = await callFunction({ action: "view", token });
      if (data.status === "signed") return showSigned(data);
      document.querySelector("#sign-client-name").textContent = data.clientName;
      show("ready");
      sizeCanvas();
      // Wait for the signature font so the typed signature uses it.
      await document.fonts?.load('48px "Great Vibes"').catch(() => {});
      drawTypedSignature();
      await renderContract(data.pdfUrl).catch(() => {
        document.querySelector("#sign-document").innerHTML =
          `<p class="sign-muted">The contract preview couldn't load. <a href="${data.pdfUrl}" target="_blank" rel="noopener">Open the contract PDF</a> to read it.</p>`;
      });
    } catch (error) {
      showError(error.message);
    }
  }

  start();
})();
