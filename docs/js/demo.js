/**
 * DocQuery frontend: connects the interactive page to the local RAG API.
 */

const API_BASE =
  window.DOCQUERY_API_BASE ||
  localStorage.getItem("DOCQUERY_API_BASE") ||
  "http://127.0.0.1:8000";
const OFFLINE_MODE = new URLSearchParams(window.location.search).get("offline") === "1";

const SAMPLE_DOC = "infosys.pdf";

const DEMO_ANSWERS = [
  {
    match: /revenue|sales|income/i,
    governing: "FY2024 revenue was $18.2 billion, with growth driven mainly by recurring software and enterprise subscriptions.",
    keyLines: [
      "Subscription revenue grew 15%, which improved the quality of the revenue base.",
      "Services revenue was flat because several implementations moved out of Q2.",
      "North America remained the largest market at 58% of total revenue.",
    ],
    evidence: [
      { source: SAMPLE_DOC, page: 4 },
      { source: SAMPLE_DOC, page: 12 },
    ],
  },
  {
    match: /risk|threat|concern/i,
    governing: "The top three risks are currency exposure, supplier concentration, and regulatory change in the EU.",
    keyLines: [
      "Foreign exchange sensitivity could reduce reported margin by 80 to 120 basis points.",
      "Two suppliers account for 41% of critical components.",
      "New EU data rules may delay selected launches in the second half of 2025.",
    ],
    evidence: [
      { source: SAMPLE_DOC, page: 22 },
      { source: SAMPLE_DOC, page: 23 },
    ],
  },
  {
    match: /margin|profit|operating/i,
    governing: "Operating margin improved from 14.1% to 16.3%, primarily from cost discipline and mix shift to software.",
    keyLines: [
      "Gross margin held at 62% despite input inflation.",
      "SG&A fell 1.2 percentage points as a share of revenue through automation.",
      "One-time restructuring charges reduced net margin by 0.4 percentage points.",
    ],
    evidence: [
      { source: SAMPLE_DOC, page: 8 },
      { source: SAMPLE_DOC, page: 9 },
    ],
  },
  {
    match: /employee|headcount|people|staff/i,
    governing: "Headcount ended the year at 24,600 FTEs, up 3%, with most hiring in engineering and customer success.",
    keyLines: [
      "Voluntary attrition fell to 11% from 14%.",
      "Training spend per employee rose 18%.",
      "Remote-first policy coverage reached 72% of roles.",
    ],
    evidence: [{ source: SAMPLE_DOC, page: 31 }],
  },
];

const DEFAULT_ANSWER = {
  governing: "The sample report shows durable growth with improving margins, balanced by supplier and regulatory risks.",
  keyLines: [
    "Revenue and margin trends are positive on a full-year basis.",
    "Risk disclosures focus on foreign exchange and supplier concentration.",
    "Strategic emphasis remains on recurring software revenue.",
  ],
  evidence: [
    { source: SAMPLE_DOC, page: 2 },
    { source: SAMPLE_DOC, page: 4 },
  ],
};

const PROGRESS_STEPS = [
  "Reading document structure",
  "Separating claims, context, and evidence",
  "Building BM25 retrieval index",
  "Preparing Pyramid answer format",
];

const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("file-input");
const useSample = document.getElementById("use-sample");
const btnIndex = document.getElementById("btn-index");
const btnText = btnIndex.querySelector(".btn-text");
const btnLoader = document.getElementById("btn-loader");
const progressWrap = document.getElementById("progress-wrap");
const progressFill = document.getElementById("progress-fill");
const progressLabel = document.getElementById("progress-label");
const indexStatus = document.getElementById("index-status");
const panelUpload = document.getElementById("panel-upload");
const panelChat = document.getElementById("panel-chat");
const stepperSteps = document.querySelectorAll(".stepper-step");
const stepperFill = document.getElementById("stepper-fill");
const workflowState = document.getElementById("workflow-state");
const docList = document.getElementById("doc-list");
const docPill = document.getElementById("doc-pill");
const chunkPill = document.getElementById("chunk-pill");
const btnReset = document.getElementById("btn-reset");
const chat = document.getElementById("chat");
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const backendStatus = document.getElementById("backend-status");

let indexed = false;
let selectedFiles = [];
let docCount = 0;
let chunkCount = 0;
let currentStep = 1;
let indexingPromise = null;
let backendReady = false;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function setBackendStatus(label, state = "idle") {
  if (!backendStatus) return;
  backendStatus.textContent = label;
  backendStatus.dataset.state = state;
}

async function parseApiResponse(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = payload.detail || payload.message || response.statusText;
    throw new Error(detail);
  }
  return payload;
}

async function apiGet(path) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { Accept: "application/json" },
  });
  return parseApiResponse(response);
}

async function apiPostJson(path, body) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return parseApiResponse(response);
}

async function apiPostForm(path, formData) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { Accept: "application/json" },
    body: formData,
  });
  return parseApiResponse(response);
}

function showIndexError(message) {
  indexStatus.classList.remove("hidden");
  indexStatus.classList.add("error");
  indexStatus.textContent = message;
}

function formatApiError(error) {
  if (error instanceof TypeError) {
    return `Backend unavailable at ${API_BASE}. Start the API server and retry.`;
  }
  return error.message || "Backend request failed.";
}

function setWorkflowLabel(step) {
  const labels = {
    1: "Upload",
    2: "Index",
    3: "Ask",
  };
  workflowState.textContent = labels[step];
}

function updateStepperFill(step) {
  const progress = step <= 1 ? 0 : step === 2 ? 50 : 100;
  const horizontal = window.matchMedia("(max-width: 980px)").matches;

  if (horizontal) {
    stepperFill.style.width = `${progress}%`;
    stepperFill.style.height = "100%";
  } else {
    stepperFill.style.height = `${progress}%`;
    stepperFill.style.width = "100%";
  }
}

function setStep(step) {
  currentStep = step;
  stepperSteps.forEach((item) => {
    const num = Number(item.dataset.step);
    item.classList.toggle("done", num < step);
    item.classList.toggle("active", num === step);
    item.setAttribute("aria-selected", String(num === step));
  });
  updateStepperFill(step);
  setWorkflowLabel(step);
}

function renderDocList() {
  if (useSample.checked) {
    docList.innerHTML = `
      <div class="doc-row">
        <span class="doc-icon">PDF</span>
        <div>
          <strong>${SAMPLE_DOC}</strong>
          <span>24 indexed chunks</span>
        </div>
      </div>
    `;
    return;
  }

  if (!selectedFiles.length) {
    docList.innerHTML = `
      <div class="doc-row">
        <span class="doc-icon">PDF</span>
        <div>
          <strong>No document selected</strong>
          <span>Upload a PDF or enable the sample report</span>
        </div>
      </div>
    `;
    return;
  }

  docList.innerHTML = selectedFiles
    .map(
      (file) => `
        <div class="doc-row">
          <span class="doc-icon">PDF</span>
          <div>
            <strong>${escapeHtml(file.name)}</strong>
            <span>${formatFileSize(file.size)}</span>
          </div>
        </div>
      `
    )
    .join("");
}

function formatFileSize(bytes) {
  if (!bytes) return "Ready to index";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function handleFiles(files) {
  selectedFiles = Array.from(files || []).filter((file) =>
    file.name.toLowerCase().endsWith(".pdf")
  );

  if (!selectedFiles.length) {
    indexStatus.classList.remove("hidden");
    indexStatus.classList.add("error");
    indexStatus.textContent = "Please choose one or more PDF files.";
    renderDocList();
    return;
  }

  useSample.checked = false;
  docCount = selectedFiles.length;
  indexStatus.classList.add("hidden");
  indexStatus.classList.remove("error");
  dropzone.querySelector(".drop-title").textContent =
    docCount === 1 ? "1 PDF ready" : `${docCount} PDFs ready`;
  dropzone.querySelector(".drop-hint").textContent = OFFLINE_MODE
    ? "Offline demo will simulate indexing"
    : "Backend will index these PDFs";
  renderDocList();
}

function findAnswer(query) {
  return DEMO_ANSWERS.find((item) => item.match.test(query)) || DEFAULT_ANSWER;
}

function renderPyramidAnswer(data) {
  const lines = data.keyLines.map((line) => `<li>${escapeHtml(line)}</li>`).join("");
  const chips = data.evidence
    .map(
      (item) =>
        `<span class="evidence-chip">${escapeHtml(item.source)} p.${item.page}</span>`
    )
    .join("");

  return `
    <div class="answer-pyramid">
      <div class="block block-governing">
        <span class="block-label">Governing thought</span>
        <p>${escapeHtml(data.governing)}</p>
      </div>
      <div class="block block-lines">
        <span class="block-label">Key lines</span>
        <ul>${lines}</ul>
      </div>
      <div class="block block-evidence">
        <span class="block-label">Evidence</span>
        <div class="evidence-chips">${chips}</div>
      </div>
    </div>
  `;
}

function renderBackendAnswer(data) {
  const answer = formatAnswerText(data.answer || "No answer returned.");
  const queries = data.plan?.search_queries || [];
  const queryItems = queries
    .map((query) => `<li>${escapeHtml(query)}</li>`)
    .join("");
  const sources = (data.sources || [])
    .map(
      (item) =>
        `<span class="evidence-chip">${escapeHtml(item.source)} p.${escapeHtml(item.page)}</span>`
    )
    .join("");

  return `
    <div class="answer-pyramid backend-answer">
      <div class="block block-governing">
        <span class="block-label">Backend answer</span>
        <div class="backend-answer-text">${answer}</div>
      </div>
      ${
        queryItems
          ? `<div class="block block-lines">
              <span class="block-label">Retrieval plan</span>
              <ul>${queryItems}</ul>
            </div>`
          : ""
      }
      <div class="block block-evidence">
        <span class="block-label">Evidence</span>
        <div class="evidence-chips">
          ${sources || '<span class="evidence-chip">No source returned</span>'}
        </div>
      </div>
    </div>
  `;
}

function formatAnswerText(text) {
  return escapeHtml(text)
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function addMessage(role, html) {
  const row = document.createElement("div");
  row.className = `msg-row ${role}`;
  row.innerHTML = `
    <div class="msg-avatar">${role === "user" ? "You" : "DQ"}</div>
    <div class="msg-bubble">${html}</div>
  `;
  chat.appendChild(row);
  chat.scrollTop = chat.scrollHeight;
}

function showTyping() {
  const row = document.createElement("div");
  row.className = "msg-row bot";
  row.id = "typing-row";
  row.innerHTML = `
    <div class="msg-avatar">DQ</div>
    <div class="msg-bubble">
      <div class="typing-dots" aria-label="DocQuery is composing an answer">
        <span></span><span></span><span></span>
      </div>
    </div>
  `;
  chat.appendChild(row);
  chat.scrollTop = chat.scrollHeight;
}

function hideTyping() {
  document.getElementById("typing-row")?.remove();
}

async function reply(query) {
  showTyping();
  try {
    if (OFFLINE_MODE) {
      await wait(650);
      addMessage("bot", renderPyramidAnswer(findAnswer(query)));
      return;
    }

    const result = await apiPostJson("/api/ask", { question: query });
    addMessage("bot", renderBackendAnswer(result));
  } catch (error) {
    addMessage(
      "bot",
      `<p class="msg-welcome">${escapeHtml(formatApiError(error))}</p>`
    );
  } finally {
    hideTyping();
  }
}

async function runProgress() {
  progressFill.style.width = "0%";
  progressWrap.classList.remove("hidden");
  indexStatus.classList.add("hidden");

  for (let i = 0; i < PROGRESS_STEPS.length; i += 1) {
    progressLabel.textContent = PROGRESS_STEPS[i];
    progressFill.style.width = `${((i + 1) / PROGRESS_STEPS.length) * 100}%`;
    await wait(360 + i * 80);
  }
}

async function indexWithBackend() {
  const formData = new FormData();
  formData.append("use_sample", String(useSample.checked));
  selectedFiles.forEach((file) => formData.append("files", file, file.name));

  progressWrap.classList.remove("hidden");
  indexStatus.classList.add("hidden");
  progressLabel.textContent = "Sending documents to backend";
  progressFill.style.width = "18%";

  const result = await apiPostForm("/api/index", formData);
  progressLabel.textContent = "Backend index ready";
  progressFill.style.width = "100%";
  await wait(180);
  return result;
}

function resetUploadText() {
  dropzone.querySelector(".drop-title").textContent = "Add PDF documents";
  dropzone.querySelector(".drop-hint").textContent = "Drop files here or click to browse";
}

async function startIndexing() {
  if (indexingPromise) return indexingPromise;

  indexingPromise = (async () => {
    const hasDocuments = useSample.checked || selectedFiles.length > 0;

    if (!hasDocuments) {
      showIndexError("Upload a PDF or enable the sample report.");
      return false;
    }

    btnIndex.disabled = true;
    btnText.classList.add("hidden");
    btnLoader.classList.remove("hidden");
    setStep(2);

    try {
      if (OFFLINE_MODE) {
        await runProgress();
        docCount = useSample.checked ? 1 : selectedFiles.length;
        chunkCount = useSample.checked ? 24 : Math.max(18, docCount * 18);
      } else {
        setBackendStatus("Backend indexing", "loading");
        const result = await indexWithBackend();
        docCount = result.doc_count;
        chunkCount = result.chunk_count;
        setBackendStatus("Backend connected", "ready");
        backendReady = true;
      }
      indexed = true;
    } catch (error) {
      showIndexError(formatApiError(error));
      setBackendStatus("Backend unavailable", "error");
      setStep(1);
      return false;
    } finally {
      btnIndex.disabled = false;
      btnText.classList.remove("hidden");
      btnLoader.classList.add("hidden");
    }

    docPill.textContent = String(docCount);
    chunkPill.textContent = String(chunkCount);
    docPill.nextElementSibling.textContent = docCount === 1 ? "document" : "documents";

    setStep(3);
    panelUpload.classList.add("hidden");
    panelChat.classList.remove("hidden");
    progressWrap.classList.add("hidden");
    progressFill.style.width = "0%";

    if (!chat.children.length) {
      addMessage(
        "bot",
        `<p class="msg-welcome">${OFFLINE_MODE ? "Offline demo index ready." : "Backend index ready."} Ask a question and the answer will follow the Pyramid Principle: conclusion, support, evidence.</p>`
      );
    }

    return true;
  })();

  try {
    return await indexingPromise;
  } finally {
    indexingPromise = null;
  }
}

dropzone.addEventListener("click", () => fileInput.click());

dropzone.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    fileInput.click();
  }
});

dropzone.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropzone.classList.add("is-dragging");
});

dropzone.addEventListener("dragleave", () => {
  dropzone.classList.remove("is-dragging");
});

dropzone.addEventListener("drop", (event) => {
  event.preventDefault();
  dropzone.classList.remove("is-dragging");
  handleFiles(event.dataTransfer.files);
});

fileInput.addEventListener("change", () => {
  handleFiles(fileInput.files);
});

useSample.addEventListener("change", () => {
  indexStatus.classList.add("hidden");
  indexStatus.classList.remove("error");

  if (useSample.checked) {
    selectedFiles = [];
    docCount = 0;
    fileInput.value = "";
    resetUploadText();
  }

  renderDocList();
});

btnIndex.addEventListener("click", () => {
  startIndexing();
});

btnReset.addEventListener("click", async () => {
  if (!OFFLINE_MODE) {
    apiPostJson("/api/reset", {}).catch(() => {});
  }
  indexed = false;
  selectedFiles = [];
  docCount = 0;
  chunkCount = 0;
  chat.innerHTML = "";
  panelChat.classList.add("hidden");
  panelUpload.classList.remove("hidden");
  progressWrap.classList.add("hidden");
  indexStatus.classList.add("hidden");
  indexStatus.classList.remove("error");
  fileInput.value = "";
  useSample.checked = true;
  resetUploadText();
  renderDocList();
  setStep(1);
});

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const query = chatInput.value.trim();
  if (!query || !indexed) return;

  addMessage("user", escapeHtml(query));
  chatInput.value = "";
  await reply(query);
});

document.querySelectorAll(".chip").forEach((chip) => {
  chip.addEventListener("click", async () => {
    if (!indexed) {
      useSample.checked = true;
      renderDocList();
      const ready = await startIndexing();
      if (!ready) return;
    }

    chatInput.value = chip.dataset.q;
    chatForm.requestSubmit();
  });
});

async function checkBackend() {
  if (OFFLINE_MODE) {
    setBackendStatus("Offline demo", "idle");
    return;
  }

  try {
    const health = await apiGet("/api/health");
    backendReady = Boolean(health.llm_ready);
    setBackendStatus(
      backendReady ? "Backend connected" : "Backend needs key",
      backendReady ? "ready" : "warning"
    );

    if (health.indexed) {
      indexed = true;
      docCount = health.doc_count;
      chunkCount = health.chunk_count;
      docPill.textContent = String(docCount);
      chunkPill.textContent = String(chunkCount);
      docPill.nextElementSibling.textContent = docCount === 1 ? "document" : "documents";
      setStep(3);
      panelUpload.classList.add("hidden");
      panelChat.classList.remove("hidden");
      addMessage(
        "bot",
        `<p class="msg-welcome">Existing backend index detected. Ask a question to query the live RAG pipeline.</p>`
      );
    }
  } catch (error) {
    backendReady = false;
    setBackendStatus("Backend offline", "error");
  }
}

window.addEventListener("resize", () => updateStepperFill(currentStep));

renderDocList();
setStep(1);
checkBackend();
