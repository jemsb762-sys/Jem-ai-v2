// Jem AI V2.2 — Google Gemini API backend
// Keep GEMINI_API_KEY in Vercel Environment Variables. Never expose it in app.js.

const MODE_INSTRUCTIONS = {
  general: "You are Jem AI, a capable, friendly, accurate general-purpose AI assistant. Help with a broad range of topics. Be clear, practical, honest about uncertainty, and adapt to the user's language.",
  writing: "Act as an expert writing partner. Help draft, rewrite, edit, brainstorm, and improve writing. Match the requested tone and format.",
  learning: "Act as a patient tutor. Explain concepts step by step, use examples, check understanding when useful, and adapt to the learner's level.",
  coding: "Act as a senior software engineering assistant. Help design, write, debug, explain, and review code. Give runnable examples and mention assumptions.",
  translation: "Act as a professional translator. Preserve meaning, tone, and context. If source or target language is unclear, ask a concise clarification.",
  islamic: "You are a careful Islamic learning assistant. Answer questions about Islam, Qur'an, Hadith, worship, history, and Muslim daily life. Never invent verses, hadith, citations, or rulings. Distinguish scholarly disagreement and recommend a qualified scholar for personal fatwas.",
  creative: "Act as a creative partner. Brainstorm original ideas, concepts, names, stories, plans, and practical next steps."
};

const DEFAULT_MODELS = ["gemini-3.8-flash", "gemini-3.7-flash"];
const MODELS = [
  ...(process.env.GEMINI_MODEL ? [process.env.GEMINI_MODEL] : []),
  ...DEFAULT_MODELS
].filter((model, index, models) => models.indexOf(model) === index);

const RETRYABLE_STATUS = new Set([429, 500, 503, 504]);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function buildSystemInstruction(mode) {
  return [
    MODE_INSTRUCTIONS[mode] || MODE_INSTRUCTIONS.general,
    "General guidelines:",
    "- Respond in the language used by the user unless they ask otherwise.",
    "- Give accurate, well-founded information. If uncertain, say so rather than guessing.",
    "- Never invent facts, names, numbers, quotes, links, laws, or references.",
    "- For recent events, prices, news, or live data, explain when you cannot verify current information.",
    "- Keep answers clear, direct, and well organized.",
    "- Do not claim to have browsed the web, generated files, images, or performed actions unless those capabilities were actually used.",
    "- Protect private information and refuse unsafe requests."
  ].join("\n");
}

async function callGemini(model, apiKey, requestBody) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey
    },
    body: JSON.stringify(requestBody)
  });

  const rawText = await response.text();
  let result = null;
  try {
    result = rawText ? JSON.parse(rawText) : null;
  } catch {
    console.error("Gemini returned non-JSON data:", response.status, rawText.slice(0, 300));
  }

  return { status: response.status, ok: response.ok, result };
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
    let messages = incoming
      .slice(-30)
      .filter(message =>
        message &&
        ["user", "assistant"].includes(message.role) &&
        typeof message.content === "string" &&
        message.content.trim().length > 0 &&
        message.content.length <= 20000
      );

    // Gemini conversations must begin with a user message.
    while (messages.length && messages[0].role === "assistant") messages.shift();

    if (!messages.length || messages[messages.length - 1].role !== "user") {
      return res.status(400).json({ error: "Please enter a message first." });
    }

    const mode = typeof req.body?.mode === "string" && MODE_INSTRUCTIONS[req.body.mode]
      ? req.body.mode
      : "general";

    const contents = messages.map(message => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content }]
    }));

    const requestBody = {
      systemInstruction: {
        parts: [{ text: buildSystemInstruction(mode) }]
      },
      contents,
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 4096
      }
    };

    let lastResult = null;

    for (const model of MODELS) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        lastResult = await callGemini(model, apiKey, requestBody);

        if (lastResult.ok) break;

        const providerMessage = lastResult.result?.error?.message;
        console.error("Gemini API request failed:", {
          model,
          status: lastResult.status,
          message: providerMessage
        });

        if (RETRYABLE_STATUS.has(lastResult.status) && attempt === 1) {
          await sleep(1200);
          continue;
        }
        break;
      }

      if (lastResult?.ok) break;
      // A model-not-found response may fall through to the next stable model.
      if (lastResult?.status !== 404 && !RETRYABLE_STATUS.has(lastResult?.status)) break;
    }

    if (!lastResult?.ok) {
      const status = lastResult?.status || 502;
      const providerMessage = lastResult?.result?.error?.message;
      return res.status(status >= 500 ? 502 : status).json({
        error: providerMessage || `Gemini request failed (HTTP ${status}). Check the API key, model access, and Vercel deployment.`
      });
    }

    const result = lastResult.result || {};
    const candidate = result.candidates?.[0];
    const reply = (candidate?.content?.parts || [])
      .map(part => typeof part.text === "string" ? part.text : "")
      .join("")
      .trim();

    if (!reply) {
      const reason = result.promptFeedback?.blockReason || candidate?.finishReason || "empty response";
      return res.status(502).json({
        error: `Gemini returned no text response (${reason}). Try rephrasing your message.`
      });
    }

    return res.status(200).json({ success: true, reply });
  } catch (error) {
    console.error("Jem AI Gemini backend error:", error);
    return res.status(500).json({
      error: "Unexpected server error while contacting Gemini. Please try again."
    });
  }
}
