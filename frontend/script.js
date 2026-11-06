const API_BASE = window.location.port === "5500" ? "http://127.0.0.1:8000" : window.location.origin;
const getStorageKey = () => `my_ai_conversations_${localStorage.getItem("my_ai_user_id") || "guest"}`;

let history = [];
let conversations = loadConversations();
let currentChatId = null;
let isSending = false;

let selectedDocumentId = null;
let selectedDocumentName = null;

const $ = id => document.getElementById(id);

// ---------------- CONVERSATION STORAGE ----------------

function loadConversations() {
  try {
    return JSON.parse(localStorage.getItem(getStorageKey()) || "[]");
  } catch {
    return [];
  }
}

function saveAllConversations() {
  localStorage.setItem(getStorageKey(), JSON.stringify(conversations));
}

function saveConversation() {
  if (!history.length) return;

  if (!currentChatId) {
    currentChatId = String(Date.now());

    conversations.push({
      id: currentChatId,
      title: history.find(item => item.role === "user")
        ?.content.slice(0, 40) || "New conversation",
      history: [...history]
    });
  } else {
    const existing = conversations.find(
      chat => chat.id === currentChatId
    );

    if (existing) {
      existing.history = [...history];
    }
  }

  saveAllConversations();
  renderHistory();
}

// ---------------- MARKDOWN ----------------

function renderMarkdown(text) {
  if (!window.marked || !window.DOMPurify) return null;

  const html = marked.parse(text, {
    gfm: true,
    breaks: true
  });

  return DOMPurify.sanitize(html);
}

function enhanceMessage(element) {
  element.querySelectorAll("table").forEach(table => {
    const wrapper = document.createElement("div");
    wrapper.className = "markdown-table-wrap";

    table.parentNode.insertBefore(wrapper, table);
    wrapper.appendChild(table);
  });

  element.querySelectorAll("pre").forEach(pre => {
    const button = document.createElement("button");

    button.className = "copy-code-btn";
    button.textContent = "Copy";

    button.addEventListener("click", async () => {
      const code = pre.querySelector("code")?.textContent || pre.textContent;

      try {
        await navigator.clipboard.writeText(code);
        button.textContent = "Copied!";

        setTimeout(() => button.textContent = "Copy", 1500);
      } catch {
        button.textContent = "Copy failed";
      }
    });

    pre.appendChild(button);
  });
}

// ---------------- CHAT MESSAGES ----------------

function addMessage(text, role, extraClass = "") {
  const chatBox = $("chat-box");
  const welcome = $("welcome");

  if (welcome) welcome.remove();

  const element = document.createElement("div");
  element.className = `message ${role} ${extraClass}`.trim();

  if (role === "assistant" && !extraClass) {
    const rendered = renderMarkdown(text);

    if (rendered !== null) {
      element.innerHTML = rendered;
      enhanceMessage(element);
    } else {
      element.textContent = text;
    }
  } else {
    element.textContent = text;
  }

  chatBox.appendChild(element);
  chatBox.scrollTop = chatBox.scrollHeight;

  return element;
}

function addSources(element, sources) {
  if (!sources || !sources.length) return;

  const container = document.createElement("div");
  container.className = "source-container";

  const heading = document.createElement("div");
  heading.className = "source-heading";
  heading.textContent = "Sources";
  container.appendChild(heading);

  sources.forEach(source => {
    const card = document.createElement("div");
    card.className = "source-card";

    const filename = document.createElement("strong");
    filename.textContent = source.filename || "Document";

    const details = document.createElement("span");

    const pageText = source.page
      ? `Page ${source.page}`
      : "Page unavailable";

    details.textContent =
      `${pageText} · Chunk ${source.chunk_id}`;

    card.append(filename, details);
    container.appendChild(card);
  });

  element.appendChild(container);
  $("chat-box").scrollTop = $("chat-box").scrollHeight;
}

// ---------------- CONVERSATION HISTORY ----------------




function renderHistory() {
  const container = $("history");
  if (!container) return;

  container.innerHTML = "";

  conversations.slice().reverse().forEach(chat => {
    const row = document.createElement("div");
    row.className = "history-row";

    const open = document.createElement("button");
    open.className = "history-item";
    open.textContent = chat.title || "New conversation";
    open.title = open.textContent;

    if (String(chat.id) === String(currentChatId)) {
      open.classList.add("active");
    }

    open.addEventListener("click", () => {
      loadConversation(chat.id);
    });

    const wrap = document.createElement("div");
    wrap.className = "history-menu-wrap";

    const dots = document.createElement("button");
    dots.type = "button";
    dots.className = "history-menu-trigger";
    dots.setAttribute("aria-label", "Chat options");
    dots.innerHTML =
      '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>';

    const menu = document.createElement("div");
    menu.className = "history-menu";
    menu.hidden = true;

    const rename = document.createElement("button");
    rename.type = "button";
    rename.className = "history-menu-item";
    rename.textContent = "Rename";

    rename.onclick = () => {
      menu.hidden = true;

      const title = prompt("Rename conversation:", chat.title || "");

      if (!title || !title.trim()) return;

      chat.title = title.trim();
      saveAllConversations();
      renderHistory();
    };

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "history-menu-item danger";
    remove.textContent = "Delete";

    remove.onclick = () => {
      menu.hidden = true;

      if (!confirm("Delete this conversation?")) return;

      conversations = conversations.filter(
        item => String(item.id) !== String(chat.id)
      );

      saveAllConversations();

      if (String(currentChatId) === String(chat.id)) {
        newChat();
      } else {
        renderHistory();
      }
    };

    dots.onclick = event => {
      event.stopPropagation();

      if (!menu.hidden) {
        menu.hidden = true;
        dots.setAttribute("aria-expanded", "false");
        return;
      }

      document.querySelectorAll("#history .history-menu").forEach(item => {
        item.hidden = true;
      });

      menu.hidden = false;
      dots.setAttribute("aria-expanded", "true");

      const rect = dots.getBoundingClientRect();
      const menuWidth = menu.offsetWidth;
      const menuHeight = menu.offsetHeight;

      const left = Math.max(
        8,
        Math.min(window.innerWidth - menuWidth - 8, rect.right - menuWidth)
      );

      let top = rect.top - menuHeight - 8;

      if (top < 8) top = rect.bottom + 8;

      if (top + menuHeight > window.innerHeight - 8) {
        top = window.innerHeight - menuHeight - 8;
      }

      menu.style.setProperty("--nova-menu-left", left + "px");
      menu.style.setProperty("--nova-menu-top", top + "px");
    };

    menu.append(rename, remove);
    wrap.append(dots, menu);
    row.append(open, wrap);
    container.appendChild(row);
  });
}

// Close menu when clicking outside
if (!window.novaMenuOutsideHandler) {
  document.addEventListener("click", event => {
    if (!event.target.closest(".history-menu-wrap")) {
      document.querySelectorAll("#history .history-menu").forEach(menu => {
        menu.hidden = true;
      });
    }
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      document.querySelectorAll("#history .history-menu").forEach(menu => {
        menu.hidden = true;
      });
    }
  });

  window.novaMenuOutsideHandler = true;
}



function loadConversation(id) {
  const chat = conversations.find(item => item.id === id);
  if (!chat) return;

  currentChatId = id;
  history = [...chat.history];

  $("chat-box").innerHTML = "";

  history.forEach(item => {
    addMessage(
      item.content,
      item.role === "user" ? "user" : "assistant"
    );
  });

  renderHistory();
}

function newChat() {
  history = [];
  currentChatId = null;

  $("chat-box").innerHTML = `
    <div class="welcome" id="welcome">
      <div class="welcome-icon">✦</div>
      <h1>How can I help you today?</h1>
      <p>Ask a question, explore an idea, or get help with a task.</p>
      <div class="suggestions">
        <button class="suggestion"
          data-prompt="Explain how large language models work in simple terms.">
          Explain LLMs simply
        </button>
        <button class="suggestion"
          data-prompt="Give me a beginner-friendly Python project idea.">
          Suggest a Python project
        </button>
        <button class="suggestion"
          data-prompt="Help me understand RAG architecture with an example.">
          Explain RAG architecture
        </button>
      </div>
    </div>`;

  bindSuggestions();
  renderHistory();
}

// ---------------- CHAT MODE ----------------

function updateSelectedDocument() {
  const display = $("selected-document");

  if (selectedDocumentId) {
    display.innerHTML = "";

    const attachment = document.createElement("div");
    attachment.className = "attachment-chip";

    const icon = document.createElement("span");
    icon.textContent = "📄";

    const filename = document.createElement("span");
    filename.textContent = selectedDocumentName || "Attached document";

    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "×";
    remove.title = "Remove attachment";

    remove.addEventListener("click", () => {
      selectedDocumentId = null;
      selectedDocumentName = null;
      updateSelectedDocument();
    });

    attachment.append(icon, filename, remove);
    display.appendChild(attachment);
  } else {
    display.textContent = "";
  }
}

// ---------------- DOCUMENT MANAGEMENT ----------------

async function uploadDocument(file) {
  if (!file) return;

  const allowedExtensions = [".pdf", ".docx", ".txt"];
  const extension = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();

  if (!allowedExtensions.includes(extension)) {
    $("upload-status").textContent =
      "Only PDF, DOCX and TXT files are supported.";
    return;
  }

  const uploadStatus = $("upload-status");
  const uploadButton = $("upload-btn");

  uploadButton.disabled = true;
  uploadStatus.textContent = "Uploading document...";

  try {
    const formData = new FormData();
    formData.append("file", file);

    const uploadResponse = await authFetch(`${API_BASE}/upload`, {
      method: "POST",
      body: formData
    });

    const uploadData = await uploadResponse.json();

    if (!uploadResponse.ok) {
      throw new Error(uploadData.detail || "Document upload failed.");
    }

    const documentId = uploadData.document_id;

    if (!documentId) {
      throw new Error("Upload response did not contain a document ID.");
    }

    uploadStatus.textContent = "Upload successful. Generating embeddings...";

    const embedResponse = await authFetch(
      `${API_BASE}/embed/${encodeURIComponent(documentId)}`,
      { method: "POST" }
    );

    const embedData = await embedResponse.json();

    if (!embedResponse.ok) {
      throw new Error(embedData.detail || "Embedding generation failed.");
    }

    selectedDocumentId = documentId;
    selectedDocumentName = uploadData.filename || file.name;

    updateSelectedDocument();

    uploadStatus.textContent =
      `${uploadData.filename} is ready. ${embedData.total_chunks} chunks indexed.`;

    addMessage(
      `Document **${uploadData.filename}** uploaded and indexed successfully. ` +
      `It contains ${embedData.total_chunks} searchable chunks. You can now ask questions about it.`,
      "assistant"
    );

  } catch (error) {
    uploadStatus.textContent = `Error: ${error.message}`;
  } finally {
    uploadButton.disabled = false;
    $("file-input").value = "";
  }
}

// ---------------- SEND MESSAGE ----------------

async function sendMessage(prefilledText = null) {
  const input = $("message");
  const sendButton = $("send-btn");

  const message = (prefilledText ?? input.value).trim();

  if (!message || isSending) return;

  if (false && !selectedDocumentId) {
    addMessage(
      "Please upload or select a document before using Document Chat.",
      "assistant",
      "error"
    );
    return;
  }

  isSending = true;
  sendButton.disabled = true;

  addMessage(message, "user");

  const previousHistory = [...history];

  history.push({
    role: "user",
    content: message
  });

  input.value = "";
  input.style.height = "auto";

  const pending = addMessage("Thinking...", "assistant", "pending");

  try {
    let endpoint;
    let body;

    if (selectedDocumentId) {
      endpoint =
        `${API_BASE}/chat-with-doc/${encodeURIComponent(selectedDocumentId)}`;

      body = {
        question: message,
        top_k: 3
      };
    } else {
      endpoint = `${API_BASE}/chat`;

      body = {
        message,
        history: previousHistory,
        enabled_plugins: enabledPlugins
      };
    }

    const response = await authFetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.detail || `Request failed (${response.status})`);
    }

    pending.remove();

    const answer = selectedDocumentId
      ? data.answer
      : data.response;

    if (!answer) {
      throw new Error("The AI returned an empty response.");
    }

    const assistantElement = addMessage(answer, "assistant");

    if (!selectedDocumentId && data.plugin_used && Array.isArray(data.plugins)) {
      const badge = document.createElement("div");
      badge.className = "plugin-used-badge";
      badge.textContent = "Used: " + data.plugins.join(", ");
      assistantElement.appendChild(badge);
    }

    if (selectedDocumentId) {
      addSources(assistantElement, data.sources);
    }

    history.push({
      role: "assistant",
      content: answer
    });

    saveConversation();

  } catch (error) {
    pending.remove();

    addMessage(`Error: ${error.message}`, "assistant", "error");
    history.pop();

  } finally {
    isSending = false;
    sendButton.disabled = false;
    input.focus();
  }
}


// ---------------- PLUGIN STORE ----------------

const PLUGIN_STORAGE_KEY = "my_ai_enabled_plugins";

const PLUGIN_REGISTRY = [
  {
    id: "calculator",
    name: "Calculator",
    icon: "🧮",
    description: "Perform accurate mathematical calculations.",
    available: true
  },
  {
    id: "wikipedia",
    name: "Wikipedia",
    icon: "📚",
    description: "Search Wikipedia for general knowledge and educational information.",
    available: true
  },
  {
    id: "web_search",
    name: "Web Search",
    icon: "🌐",
    description: "Search the internet for current information.",
    available: true
  },
  {
    id: "weather",
    name: "Weather",
    icon: "🌤️",
    description: "Get weather forecasts and conditions.",
    available: true
  }
];

let enabledPlugins = ["calculator"];

function loadEnabledPlugins() {
  try {
    const saved = localStorage.getItem(PLUGIN_STORAGE_KEY);
    if (saved !== null) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        enabledPlugins = parsed.filter(id =>
          PLUGIN_REGISTRY.some(p => p.id === id && p.available)
        );
      }
    }
  } catch (error) {
    console.error("Could not load plugin settings:", error);
  }
}

function saveEnabledPlugins() {
  localStorage.setItem(
    PLUGIN_STORAGE_KEY,
    JSON.stringify(enabledPlugins)
  );
}

function renderActivePlugins() {
  const container = $("active-plugins");
  if (!container) return;

  const active = PLUGIN_REGISTRY.filter(p =>
    enabledPlugins.includes(p.id)
  );

  if (!active.length) {
    container.innerHTML =
      '<div class="active-plugin-item">No active plugins</div>';
    return;
  }

  container.innerHTML = active.map(plugin => `
    <div class="active-plugin-item">
      <span>${plugin.icon} ${plugin.name}</span>
      <span class="active-plugin-status">● ON</span>
    </div>
  `).join("");
}

function renderPluginStore() {
  const container = $("plugin-list");
  if (!container) return;

  container.innerHTML = PLUGIN_REGISTRY.map(plugin => {
    const enabled = enabledPlugins.includes(plugin.id);

    let button;

    if (!plugin.available) {
      button = '<button class="plugin-action" disabled>Coming Soon</button>';
    } else {
      button = `
        <button
          class="plugin-action ${enabled ? "enabled" : ""}"
          data-plugin-action="${enabled ? "disable" : "enable"}"
          data-plugin-id="${plugin.id}">
          ${enabled ? "Disable" : "Enable"}
        </button>
      `;
    }

    return `
      <div class="plugin-card">
        <div class="plugin-icon">${plugin.icon}</div>
        <div class="plugin-info">
          <h3>${plugin.name}</h3>
          <p>${plugin.description}</p>
        </div>
        ${button}
      </div>
    `;
  }).join("");
}

function initPluginStore() {
  loadEnabledPlugins();

  renderActivePlugins();
  renderPluginStore();

  $("open-plugin-store").addEventListener("click", () => {
    $("plugin-store-overlay").classList.add("open");
  });

  $("close-plugin-store").addEventListener("click", () => {
    $("plugin-store-overlay").classList.remove("open");
  });

  $("plugin-store-overlay").addEventListener("click", event => {
    if (event.target.id === "plugin-store-overlay") {
      event.currentTarget.classList.remove("open");
    }
  });

  $("plugin-list").addEventListener("click", event => {
    const button = event.target.closest("[data-plugin-action]");
    if (!button) return;

    const id = button.dataset.pluginId;
    const action = button.dataset.pluginAction;

    if (action === "enable" && !enabledPlugins.includes(id)) {
      enabledPlugins.push(id);
    }

    if (action === "disable") {
      enabledPlugins = enabledPlugins.filter(item => item !== id);
    }

    saveEnabledPlugins();
    renderActivePlugins();
    renderPluginStore();
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      $("plugin-store-overlay").classList.remove("open");
    }
  });
}


// ---------------- EVENT LISTENERS ----------------

function bindSuggestions() {
  document.querySelectorAll(".suggestion").forEach(button => {
    button.addEventListener("click", () => {
      sendMessage(button.dataset.prompt);
    });
  });
}

$("send-btn").addEventListener("click", () => sendMessage());

$("new-chat").addEventListener("click", newChat);

$("upload-btn").addEventListener("click", () => $("file-input").click());

$("file-input").addEventListener("change", event => {
  uploadDocument(event.target.files[0]);
});

$("message").addEventListener("keydown", event => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
});

$("message").addEventListener("input", event => {
  event.target.style.height = "auto";

  event.target.style.height =
    `${Math.min(event.target.scrollHeight, 180)}px`;
});

// ---------------- INITIAL SETUP ----------------

initPluginStore();
bindSuggestions();
renderHistory();


window.addEventListener("myai:authenticated", () => {
    history = [];
    currentChatId = null;
    conversations = loadConversations();
    newChat();
});
