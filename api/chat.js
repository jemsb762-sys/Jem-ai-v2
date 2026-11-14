// Jem AI V2.4 — Groq Free API backend
// Set GROQ_API_KEY in Vercel Environment Variables. Never expose it in frontend files.

const MODE_INSTRUCTIONS = {
  general: "You are Jem AI, a friendly, accurate general-purpose AI assistant. Be clear, practical, honest about uncertainty, and adapt to the user's language.",
  writing: "Act as an expert writing assistant. Help draft, rewrite, edit, brainstorm, and improve writing. Match the requested tone and format.",
  learning: "Act as a patient tutor. Explain concepts step by step, use examples, and adapt to the learner's level.",
  coding: "Act as an expert software engineering assistant. Help design, write, debug, explain, and review code. Give complete, runnable examples when useful.",
  translation: "Act as a professional translator. Preserve meaning, tone, and context. Ask briefly if the target language is unclear.",
  islamic: "You are a careful Islamic learning assistant. Never invent Qur'an verses, Hadith, citations, or rulings. Distinguish scholarly differences and recommend a qualified scholar for personal fatwas.",
  creative: "Act as a creative partner. Brainstorm original ideas, names, stories, plans, and practical next steps."
};

const DEFAULT_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-20b";
const REQUEST_TIMEOUT_MS = 25000;

function buildSystemInstruction(mode) {
  return [
    MODE_INSTRUCTIONS[mode] || MODE_INSTRUCTIONS.general,
    "General rules:",
    "- Reply in the language used by the user unless they ask otherwise.",
    "- Be accurate. If uncertain, say so; do not invent facts, names, links, quotes, or references.",
    "- For current events, prices, or live information, explain when you cannot verify it.",
    "- Keep answers clear, direct, and well organized."
  ].join("\n");
}

async function callGroq(apiKey, messages) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        messages,
        temperature: 0.4,
        max_completion_tokens: 1200
      }),
      signal: controller.signal
    });

    const rawText = await response.text();
    let result = null;
    try {
      result = rawText ? JSON.parse(rawText) : null;
    } catch {
      console.error("Groq returned non-JSON response:", response.status, rawText.slice(0, 250));
    }
    return { status: response.status, ok: response.ok, result, retryAfter: response.headers.get("retry-after") };
  } catch (error) {
    if (error?.name === "AbortError") {
      return {
        status: 504,
        ok: false,
        result: { error: { message: `The AI service did not respond within ${REQUEST_TIMEOUT_MS / 1000} seconds. Please try again.` } }
      };
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function publicError(status, providerMessage, retryAfter) {
  if (status === 401 || status === 403) {
    return "Groq API key is invalid or does not have access. Check GROQ_API_KEY in Vercel Environment Variables.";
  }
  if (status === 429) {
    const wait = retryAfter ? ` Please wait about ${retryAfter} seconds and try again.` : " Please wait a little and try again.";
    return "The free Groq usage limit has been reached." + wait;
  }
  if (status === 404) {
    return "The selected Groq model is unavailable. Check GROQ_MODEL or use the default model.";
  }
  return providerMessage || `Groq request failed (HTTP ${status}). Please try again.`;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "GROQ_API_KEY is missing. Add it in Vercel → Project → Settings → Environment Variables, then redeploy."
    });
  }

  try {
    const incoming = Array.isArray(req.body?.messages) ? req.body.messages : [];
    let messages = incoming
      .slice(-12)
      .filter(message =>
        message &&
        ["user", "assistant"].includes(message.role) &&
        typeof message.content === "string" &&
        message.content.trim().length > 0
      )
      .map(message => ({
        role: message.role,
        content: message.content.slice(0, 8000)
      }));

    while (messages.length && messages[0].role === "assistant") messages.shift();

    if (!messages.length || messages[messages.length - 1].role !== "user") {
      return res.status(400).json({ error: "Please enter a message first." });
    }

    const mode = typeof req.body?.mode === "string" && MODE_INSTRUCTIONS[req.body.mode]
      ? req.body.mode
      : "general";

    const requestMessages = [
      { role: "system", content: buildSystemInstruction(mode) },
      ...messages
    ];

    const result = await callGroq(apiKey, requestMessages);
    if (!result.ok) {
      const status = result.status || 502;
      const providerMessage = result.result?.error?.message;
      console.error("Groq API error:", { status, message: providerMessage });
      return res.status(status === 504 ? 504 : (status >= 500 ? 502 : status)).json({
        error: publicError(status, providerMessage, result.retryAfter)
      });
    }

    const reply = result.result?.choices?.[0]?.message?.content?.trim();
    if (!reply) {
      return res.status(502).json({ error: "Groq returned an empty response. Please try again." });
    }

    return res.status(200).json({ success: true, reply });
  } catch (error) {
    console.error("Jem AI Groq backend error:", error);
    return res.status(500).json({
      error: "Unexpected server error while contacting the AI service. Please try again."
    });
  }
}
