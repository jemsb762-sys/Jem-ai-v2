// Jem AI V2.3 — Gemini API backend with bounded request time
// Keep GEMINI_API_KEY in Vercel Environment Variables.

const MODE_INSTRUCTIONS = {
  general: "You are Jem AI, a friendly, accurate general-purpose AI assistant. Be clear, practical, honest about uncertainty, and adapt to the user's language.",
  writing: "Act as an expert writing assistant. Help draft, rewrite, edit, brainstorm, and improve writing. Match the requested tone and format.",
  learning: "Act as a patient tutor. Explain concepts step by step, use examples, and adapt to the learner's level.",
  coding: "Act as an expert software engineering assistant. Help design, write, debug, explain, and review code. Give complete, runnable examples when useful.",
  translation: "Act as a professional translator. Preserve meaning, tone, and context. Ask briefly if the target language is unclear.",
  islamic: "You are a careful Islamic learning assistant. Never invent Qur'an verses, Hadith, citations, or rulings. Distinguish scholarly differences and recommend a qualified scholar for personal fatwas.",
  creative: "Act as a creative partner. Brainstorm original ideas, names, stories, plans, and practical next steps."
};

const DEFAULT_MODEL = "gemini-3.8-flash";
const MODELS = [
  ...(process.env.GEMINI_MODEL ? [process.env.GEMINI_MODEL] : []),
  DEFAULT_MODEL
].filter((model, index, list) => list.indexOf(model) === index);

const REQUEST_TIMEOUT_MS = 22000;

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

async function callGemini(model, apiKey, requestBody) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });

    const rawText = await response.text();
    let result = null;

    try {
      result = rawText ? JSON.parse(rawText) : null;
    } catch {
      console.error("Gemini returned non-JSON response:", response.status, rawText.slice(0, 250));
    }

    return { status: response.status, ok: response.ok, result };
  } catch (error) {
    if (error?.name === "AbortError") {
      return {
        status: 504,
        ok: false,
        result: { error: { message: `Gemini did not respond within ${REQUEST_TIMEOUT_MS / 1000} seconds. Please retry.` } }
      };
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "GEMINI_API_KEY is missing. Add it in Vercel → Project → Settings → Environment Variables, then redeploy."
    });
  }

  try {
    const incoming = Array.isArray(req.body?.messages) ? req.body.messages : [];
    // Bound both the number and size of previous turns to keep requests responsive.
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

    const requestBody = {
      systemInstruction: {
        parts: [{ text: buildSystemInstruction(mode) }]
      },
      contents: messages.map(message => ({
        role: message.role === "assistant" ? "model" : "user",
        parts: [{ text: message.content }]
      })),
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 1024
      }
    };

    let last = null;

    // One bounded request per configured model. Only fall back when a model ID is unavailable.
    for (const model of MODELS) {
      last = await callGemini(model, apiKey, requestBody);
      if (last.ok) break;

      console.error("Gemini API error:", {
        model,
        status: last.status,
        message: last.result?.error?.message
      });

      if (last.status !== 404) break;
    }

    if (!last?.ok) {
      const status = last?.status || 502;
      const message = last?.result?.error?.message ||
        `Gemini request failed (HTTP ${status}). Check GEMINI_API_KEY, model access, and Google AI Studio service status.`;

      return res.status(status === 504 ? 504 : (status >= 500 ? 502 : status)).json({
        error: message
      });
    }

    const candidate = last.result?.candidates?.[0];
    const reply = (candidate?.content?.parts || [])
      .map(part => typeof part.text === "string" ? part.text : "")
      .join("")
      .trim();

    if (!reply) {
      const reason = last.result?.promptFeedback?.blockReason ||
        candidate?.finishReason ||
        "empty response";
      return res.status(502).json({
        error: `Gemini returned no text response (${reason}). Try a different message.`
      });
    }

    return res.status(200).json({ success: true, reply });
  } catch (error) {
    console.error("Jem AI backend error:", error);
    return res.status(500).json({
      error: "Unexpected server error while contacting Gemini. Please try again."
    });
  }
}
