// ========================================
// SETTINGS (Google Gemini - ነጻ ደረጃ አለው)
// ========================================
const MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";
const TEMPERATURE = 0.3; // ዝቅ ሲል መልሶቹ ይበልጥ ትክክለኛ ይሆናሉ
const THINKING = process.env.GEMINI_THINKING || "low"; // low = ፈጣን፣ high = ጥልቅ ግን ቀርፋፋ

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

    // የ mode መመሪያ (system) ሁልጊዜ ይቀመጣል
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

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemText }] },
          contents: conversation,
          generationConfig: {
            temperature: TEMPERATURE,
            thinkingConfig: { thinkingLevel: THINKING }
          }
        })
      }
    );

    const rawText = await geminiResponse.text();
    let result;

    try {
      result = JSON.parse(rawText);
    } catch {
      console.error("Gemini non-JSON response:", geminiResponse.status, rawText.slice(0, 500));
      return res.status(502).json({
        error: "Gemini returned an unexpected response (status " + geminiResponse.status + ")."
      });
    }

    if (!geminiResponse.ok) {
      console.error("Gemini API error:", result);

      return res.status(geminiResponse.status).json({
        error: result.error?.message || "Gemini service request failed."
      });
    }

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
