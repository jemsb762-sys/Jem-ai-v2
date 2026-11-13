const MODE_INSTRUCTIONS = {
 general: "You are Jem AI, a capable, friendly, accurate general-purpose AI assistant. Help with a broad range of topics. Be clear, practical, honest about uncertainty, and adapt to the user's language.",
 writing: "Act as an expert writing partner. Help draft, rewrite, edit, brainstorm, and improve writing. Match the requested tone and format.",
 learning: "Act as a patient tutor. Explain concepts step by step, use examples, check understanding when useful, and adapt to the learner's level.",
 coding: "Act as a senior software engineering assistant. Help design, write, debug, explain, and review code. Give runnable examples and mention assumptions.",
 translation: "Act as a professional translator. Preserve meaning, tone, and context. If source or target language is unclear, ask a concise clarification.",
 islamic: "You are a careful Islamic learning assistant. Answer questions about Islam, Qur'an, Hadith, worship, history, and Muslim daily life. Never invent verses, hadith, citations, or rulings. Distinguish scholarly disagreement and recommend a qualified scholar for personal fatwas.",
 creative: "Act as a creative partner. Brainstorm original ideas, concepts, names, stories, plans, and practical next steps."
};

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "Server setup is incomplete: OPENAI_API_KEY is missing in Vercel Environment Variables." });

  try {
    const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
    const safeMessages = messages.slice(-20).filter(m =>
      m && ["user", "assistant"].includes(m.role) &&
      typeof m.content === "string" && m.content.length <= 12000
    );
    if (!safeMessages.length || safeMessages[safeMessages.length - 1].role !== "user") {
      return res.status(400).json({ error: "Please enter a message first." });
    }

    const mode = typeof req.body?.mode === "string" && MODE_INSTRUCTIONS[req.body.mode] ? req.body.mode : "general";
    const instructions = `${MODE_INSTRUCTIONS[mode]}\n\nGeneral guidelines: Respond in the language used by the user unless they ask otherwise. Structure longer answers with headings and lists. Do not claim to have browsed the web, generated files, images, or performed actions unless those capabilities were actually used. Be transparent about limitations. Refuse unsafe requests and protect private information.`;

    const upstream = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-6-luna",
        instructions,
        input: safeMessages.map(m => ({ role: m.role, content: m.content })),
        max_output_tokens: 2200,
        store: false
      })
    });
    const result = await upstream.json();
    if (!upstream.ok) {
      const message = result?.error?.message || "The AI provider request failed.";
      return res.status(upstream.status >= 500 ? 502 : upstream.status).json({ error: message });
    }
    const reply = (result.output || [])
      .filter(item => item.type === "message")
      .flatMap(item => item.content || [])
      .filter(part => part.type === "output_text")
      .map(part => part.text)
      .join("\n")
      .trim();
    if (!reply) return res.status(502).json({ error: "The AI provider returned an empty response." });
    return res.status(200).json({ reply });
  } catch {
    return res.status(500).json({ error: "Unexpected server error. Please try again." });
  }
}
