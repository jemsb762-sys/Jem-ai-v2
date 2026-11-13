
export default async function handler(req, res) {
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

    const validMessages = messages
      .filter(item =>
        item &&
        ["system", "user", "assistant"].includes(item.role) &&
        typeof item.content === "string"
      )
      .slice(-41);

    if (validMessages.length === 0) {
      return res.status(400).json({
        error: "No valid messages were received."
      });
    }

    const openaiResponse = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: validMessages,
          temperature: 0.7
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

    const answer =
      result.choices?.[0]?.message?.content;

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
