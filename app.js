// ========================================
// SETTINGS: ይህን URL በራስዎ Vercel domain ይቀይሩ
// ========================================
const API_URL = "https://YOUR-PROJECT.vercel.app/api/chat";

const form = document.getElementById("chatForm");
const input = document.getElementById("messageInput");
const messagesEl = document.getElementById("messages");
const welcome = document.getElementById("welcome");
const sendBtn = document.getElementById("sendBtn");
const sidebar = document.getElementById("sidebar");

const history = [];
let busy = false;
let mode = "general";

const modes = {
  general: {
    label: "AI Assistant",
    instruction: "You are Jem AI, a friendly, intelligent and accurate AI assistant. Answer questions clearly and practically. Adapt to the user's language."
  },
  writing: {
    label: "Writing studio",
    instruction: "Act as an expert writing assistant. Help write, rewrite, edit and improve text."
  },
  learning: {
    label: "Learn anything",
    instruction: "Act as a patient teacher. Explain concepts step by step with examples."
  },
  coding: {
    label: "Coding assistant",
    instruction: "Act as an expert software engineer. Help write, debug and explain code. Give complete working examples."
  },
  translation: {
    label: "Translator",
    instruction: "Act as a professional translator. Preserve the meaning and tone of the original text."
  },
  islamic: {
    label: "Islamic learning",
    instruction: "You are a careful Islamic learning assistant. Answer questions about Islam, Qur'an, authentic Hadith, Tafsir, worship and Islamic history. Never invent verses, Hadith or references. Identify scholarly differences and distinguish authentic evidence from weak reports. Answer in the user's language."
  },
  creative: {
    label: "Creative studio",
    instruction: "Act as a creative assistant. Help develop original ideas, names, stories, plans and practical solutions."
  }
};

// ========================================
// MODE SELECTION
// ========================================

function setMode(next) {
  if (!modes[next]) return;

  mode = next;

  const modeLabel = document.getElementById("modeLabel");
  const composerMode = document.getElementById("composerMode");

  if (modeLabel) modeLabel.textContent = modes[mode].label;
  if (composerMode) composerMode.textContent = modes[mode].label;

  document.querySelectorAll(".nav-item").forEach(button => {
    button.classList.toggle("active", button.dataset.mode === mode);
  });

  if (sidebar) sidebar.classList.remove("open");

  input.placeholder =
    mode === "translation"
      ? "Enter text to translate..."
      : mode === "coding"
      ? "Describe what you want to build or fix..."
      : "Message Jem AI...";
}

// ========================================
// DISPLAY MESSAGES
// ========================================

function addMessage(role, text) {
  if (welcome) welcome.style.display = "none";

  const wrap = document.createElement("div");
  wrap.className = `message ${role}`;

  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.textContent = role === "user" ? "Y" : "✦";

  const body = document.createElement("div");
  body.className = "bubble";
  body.textContent = text;

  wrap.append(avatar, body);

  if (role === "assistant") {
    const actions = document.createElement("div");
    actions.className = "message-actions";

    const copy = document.createElement("button");
    copy.className = "copy-btn";
    copy.textContent = "▢  Copy response";

    copy.onclick = async () => {
      try {
        await navigator.clipboard.writeText(text);
        copy.textContent = "✓ Copied";
      } catch {
        copy.textContent = "Copy unavailable";
      }
    };

    actions.appendChild(copy);
    body.appendChild(actions);
  }

  messagesEl.appendChild(wrap);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  return wrap;
}

// ========================================
// NEW CHAT
// ========================================

function newChat() {
  history.length = 0;
  messagesEl.innerHTML = "";

  if (welcome) welcome.style.display = "block";

  input.value = "";
  input.focus();
}

// ========================================
// BUTTON EVENTS
// ========================================

document.getElementById("newChat")?.addEventListener("click", newChat);

document.getElementById("menuBtn")?.addEventListener("click", () => {
  sidebar?.classList.toggle("open");
});

document.querySelectorAll(".nav-item").forEach(button => {
  button.addEventListener("click", () => {
    setMode(button.dataset.mode);
  });
});

document.querySelectorAll(".tool-card").forEach(button => {
  button.addEventListener("click", () => {
    setMode(button.dataset.mode);
    input.value = button.dataset.prompt || "";
    input.focus();

    input.style.height = "auto";
    input.style.height =
      Math.min(input.scrollHeight, 140) + "px";
  });
});

document.getElementById("themeBtn")?.addEventListener("click", () => {
  document.body.classList.toggle("light");

  const themeColor = document.querySelector(
    'meta[name="theme-color"]'
  );

  if (themeColor) {
    themeColor.content =
      document.body.classList.contains("light")
        ? "#f5f6fc"
        : "#0b0d18";
  }
});

// ========================================
// INPUT EVENTS
// ========================================

input.addEventListener("input", () => {
  input.style.height = "auto";
  input.style.height =
    Math.min(input.scrollHeight, 140) + "px";
});

input.addEventListener("keydown", event => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
});

form.addEventListener("submit", event => {
  event.preventDefault();
  sendMessage();
});

// ========================================
// JEM AI SERVER CONNECTION
// ========================================

async function sendMessage() {
  const userText = input.value.trim();

  if (!userText || busy) return;

  input.value = "";
  input.style.height = "auto";

  addMessage("user", userText);

  history.push({
    role: "user",
    content: userText
  });

  busy = true;
  sendBtn.disabled = true;

  const pending = addMessage("assistant", "Thinking...");
  pending.querySelector(".bubble").classList.add("typing");

  try {
    const apiMessages = [
      {
        role: "system",
        content: modes[mode].instruction
      },
      ...history
    ];

    // Send request to Vercel backend (full URL).
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messages: apiMessages
      })
    });

    const responseText = await response.text();

    let data;

    try {
      data = JSON.parse(responseText);
    } catch {
      throw new Error(
        "Server returned an invalid response. Check Vercel API deployment."
      );
    }

    if (!response.ok) {
      throw new Error(
        data.error || `Server error: ${response.status}`
      );
    }

    const answer =
      data.reply ||
      data.answer ||
      data.message ||
      "I could not generate an answer. Please try again.";

    pending.remove();

    addMessage("assistant", answer);

    history.push({
      role: "assistant",
      content: answer
    });

  } catch (error) {
    pending.remove();

    addMessage(
      "assistant",
      "Sorry, I could not answer: " + error.message
    );

    history.pop();

    console.error("Jem AI error:", error);

  } finally {
    busy = false;
    sendBtn.disabled = false;
    input.focus();
  }
}

// ========================================
// INITIALIZE JEM AI
// ========================================

setMode("general");

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./sw.js")
      .catch(error => {
        console.error("Service Worker error:", error);
      });
  });
}
