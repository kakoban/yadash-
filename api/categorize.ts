import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: "Text is required" });
    }

    const apiKey = process.env.OPENROUTER_API_KEY || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "API key is missing" });
    }

    const model = "openai/gpt-oss-120b";
      
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.APP_URL || "https://roozneveshte.vercel.app", 
        "X-Title": "Roozneveshte", 
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: "system",
            content: "You are an intelligent categorization assistant for a professional programmer (Linux, Electron, Backend, Frontend, AI APIs). Categorize the user's text into EXACTLY ONE of the following keys: 'note', 'thought', 'idea', 'quote', 'list', 'link', 'code'. Respond with ONLY the exact key, nothing else. If it's a URL, use 'link'. If it's programming code, linux shell commands, server configurations, or JSON/API logs, use 'code'. If it's a task list, use 'list'."
          },
          {
            role: "user",
            content: text
          }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("API error:", errorText);
      return res.status(response.status).json({ error: "Categorization failed" });
    }

    const data = await response.json();
    let category = data.choices?.[0]?.message?.content?.trim().toLowerCase();
      
    const validCategories = ['note', 'thought', 'idea', 'quote', 'list', 'link', 'code'];
    if (!validCategories.includes(category)) {
      category = 'note'; // fallback
    }

    return res.status(200).json({ category });
  } catch (error) {
    console.error("Categorization endpoint error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
