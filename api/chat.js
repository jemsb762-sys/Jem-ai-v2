// ========================================
// ACCURACY SETTINGS
// ========================================
const MODEL = process.env.OPENAI_MODEL || "gpt-4o";
const TEMPERATURE = 0.3; // ዝቅ ሲል መልሶቹ ይበልጥ ትክክለኛ እና ተመሳሳይ ይሆናሉ

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
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "OPENAI_API_KEY is missing in Vercel Environment Variables."
      });
    }

    const messages = req.body?.messages;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: "Messages are required."
      });
    }

    const valid = messages.filter(item =>
      item &&
      ["system", "user", "assistant"].includes(item.role) &&
      typeof item.content === "string"
    );

    // የ mode መመሪያ (system) ሁልጊዜ ይቀመጣል፣ ረጅም ውይይት ላይም አይጠፋም
    const modeInstruction = valid.find(m => m.role === "system");
    const conversation = valid
      .filter(m => m.role !== "system")
      .slice(-40);

    if (conversation.length === 0) {
      return res.status(400).json({
        error: "No valid messages were received."
      });
    }

    const systemContent = [
      buildBasePrompt(),
      modeInstruction ? "\nMODE INSTRUCTIONS:\n" + modeInstruction.content : ""
    ].join("\n");

    const openaiResponse = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: "system", content: systemContent },
            ...conversation
          ],
          temperature: TEMPERATURE
        })
      }
    );

    const result = await openaiResponse.json();

    if (!openaiResponse.ok) {
      console.error("OpenAI API error:", result);

      return res.status(openaiResponse.status).json({
        error:
          result.error?.message ||
          "OpenAI service request failed."
      });
    }

    const answer = result.choices?.[0]?.message?.content;

    if (!answer) {
      return res.status(502).json({
        error: "OpenAI returned an empty answer."
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
