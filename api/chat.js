// ========================================
// SETTINGS (Google Gemini)
// ========================================
const DEFAULT_MODELS = [
  "gemini-3.8-flash",
  "gemini-2.0-flash"
];

const MODELS = [
  ...(process.env.GEMINI_MODEL ? [process.env.GEMINI_MODEL] : []),
  ...DEFAULT_MODELS
].filter((name, index, list) => list.indexOf(name) === index);

const TEMPERATURE = 0.3; // ዝቅ ሲል መልሶቹ ይበልጥ ትክክለኛ ይሆናሉ

// ሞዴሉ ከተጨናነቀ ወይም ከጠፋ ወደ ቀጣዩ የሚያስሄዱ status ኮዶች
const RETRYABLE = [404, 429, 500, 503, 504];

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function buildBasePrompt() {
  const today = new Date().toISOString().slice(0, 10);

  return [
    "ACCURACY RULES (always follow):",
    "- Give accurate, well-founded information. If you are not sure or do not know, say so clearly instead of guessing.",
    "- Never invent facts, names, numbers, quotes, links, laws or references.",
    "- You cannot browse the internet and your knowledge has a cutoff date. For recent events, prices, news or live data, say your information may be outdated.",
    "- Always reply in the same language the user writes in (including Amharic), with correct grammar and natural wording.",
    "- For math, logic or multi-step problems, reason step by step before giving the final answer, and double-check the result.",
    "- If the request is ambiguous, ask one short clarifying question.",
    "- Keep answers clear, direct and well organized.",
    `- Today's date is ${today}.`
  ].join("\n");
}

async function callGemini(model, apiKey, body) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify(body)
    }
  );

  const rawText = await response.text();
  let result = null;

  try {
    result = JSON.parse(rawText);
  } catch {
    console.error("Gemini non-JSON response:", model, response.status, rawText.slice(0, 300));
  }

  return { status: response.status, ok: response.ok, result };
}

export default async function handler(req, res) {
  // ===== CORS =====
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "GEMINI_API_KEY is missing in Vercel Environment Variables."
      });
    }

    const messages = req.body?.messages;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Messages are required." });
    }

    const valid = messages.filter(item =>
      item &&
      ["system", "user", "assistant"].includes(item.role) &&
      typeof item.content === "string" &&
      item.content.trim() !== ""
    );

    // ቋሚ የሰርቨር መመሪያ (system)
    const modeInstruction = valid.find(m => m.role === "system");

    const conversation = valid
      .filter(m => m.role !== "system")
      .slice(-40)
      .map(m => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }]
      }));

    if (conversation.length === 0) {
      return res.status(400).json({ error: "No valid messages were received." });
    }

    const systemText = [
      buildBasePrompt(),
      modeInstruction ? "\nMODE INSTRUCTIONS:\n" + modeInstruction.content : ""
    ].join("\n");

    const requestBody = {
      systemInstruction: { parts: [{ text: systemText }] },
      contents: conversation,
      generationConfig: {
        temperature: TEMPERATURE
      }
    };

    // ===== ሞዴሎችን በተራ ሞክር =====
    let last = null;

    for (const model of MODELS) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        last = await callGemini(model, apiKey, requestBody);

        if (last.ok) break;

        console.error("Gemini error:", model, last.status, last.result?.error?.message);

        if ((last.status === 503 || last.status === 429) && attempt === 1) {
          await sleep(1500);
          continue;
        }
        break;
      }

      if (last?.ok) break;

      if (!RETRYABLE.includes(last?.status)) break;
    }

    if (!last || !last.ok) {
      return res.status(last?.status || 502).json({
        error:
          last?.result?.error?.message ||
          "Gemini service request failed (status " + (last?.status || "unknown") + ")."
      });
    }

    const result = last.result;

    const answer = (result.candidates?.[0]?.content?.parts || [])
      .map(part => part.text || "")
      .join("")
      .trim();

    if (!answer) {
      const reason =
        result.promptFeedback?.blockReason ||
        result.candidates?.[0]?.finishReason ||
        "empty answer";

      return res.status(502).json({
        error: "Gemini returned no answer (" + reason + ")."
      });
    }

    return res.status(200).json({
      success: true,
      reply: answer
    });

  } catch (error) {
    console.error("Jem AI server error:", error);

    return res.status(500).json({
      error: "Server error: " + error.message
    });
  }
}
