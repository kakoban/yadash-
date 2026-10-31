import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route for AI Categorization
  app.post("/api/categorize", async (req, res) => {
    try {
      const { text } = req.body;
      if (!text) {
        return res.status(400).json({ error: "Text is required" });
      }

      const openRouterKey = process.env.OPENROUTER_API_KEY;
      const geminiKey = process.env.GEMINI_API_KEY;

      if (!openRouterKey && !geminiKey) {
        return res.status(500).json({ error: "API keys are missing" });
      }

      const systemPrompt = "You are an intelligent categorization assistant for a professional programmer (Linux, Electron, Backend, Frontend, AI APIs). Categorize the user's text into EXACTLY ONE of the following keys: 'note', 'thought', 'idea', 'quote', 'list', 'link', 'code'. Respond with ONLY the exact key, nothing else. If it's a URL, use 'link'. If it's programming code, linux shell commands, server configurations, or JSON/API logs, use 'code'. If it's a task list, use 'list'.";
      let category = "note";

      if (geminiKey) {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [{ parts: [{ text: text }] }],
            generationConfig: { temperature: 0.1, maxOutputTokens: 10 }
          })
        });

        if (!response.ok) {
          const err = await response.text();
          console.error("Gemini API error:", err);
          return res.status(response.status).json({ error: "Categorization failed" });
        }

        const data = await response.json();
        const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim().toLowerCase();
        if (generatedText) category = generatedText;

      } else if (openRouterKey) {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${openRouterKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": process.env.APP_URL || "https://roozneveshte.vercel.app", 
            "X-Title": "Roozneveshte", 
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: text }
            ]
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error("OpenRouter API error:", errorText);
          return res.status(response.status).json({ error: "Categorization failed" });
        }

        const data = await response.json();
        const generatedText = data.choices?.[0]?.message?.content?.trim().toLowerCase();
        if (generatedText) category = generatedText;
      }
      
      category = category.replace(/[^a-z]/g, '');
      const validCategories = ['note', 'thought', 'idea', 'quote', 'list', 'link', 'code'];
      if (!validCategories.includes(category)) {
        category = 'note'; // fallback
      }

      res.json({ category });
    } catch (error) {
      console.error("Categorization endpoint error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
