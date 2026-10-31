export async function onRequestPost(context: any) {
  try {
    const request = context.request;
    const body = await request.json();
    const text = body.text;

    if (!text) {
      return new Response(JSON.stringify({ error: "Text is required" }), { status: 400 });
    }

    // Cloudflare environment variables are in context.env
    const openRouterKey = context.env.OPENROUTER_API_KEY;
    const geminiKey = context.env.GEMINI_API_KEY;

    if (!openRouterKey && !geminiKey) {
      return new Response(JSON.stringify({ error: "API key is missing" }), { status: 500 });
    }

    const systemPrompt = "You are an intelligent categorization assistant for a professional programmer (Linux, Electron, Backend, Frontend, AI APIs). Categorize the user's text into EXACTLY ONE of the following keys: 'note', 'thought', 'idea', 'quote', 'list', 'link', 'code'. Respond with ONLY the exact key, nothing else. If it's a URL, use 'link'. If it's programming code, linux shell commands, server configurations, or JSON/API logs, use 'code'. If it's a task list, use 'list'.";
    
    let category = "note";

    if (geminiKey) {
      // Use direct Gemini API
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemPrompt }]
          },
          contents: [{
            parts: [{ text: text }]
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 10
          }
        })
      });

      if (!response.ok) {
        return new Response(JSON.stringify({ error: "Categorization failed (Gemini)" }), { status: response.status });
      }

      const data = await response.json();
      const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim().toLowerCase();
      if (generatedText) category = generatedText;

    } else if (openRouterKey) {
      // Use OpenRouter
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openRouterKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": context.env.APP_URL || "https://roozneveshte.vercel.app", 
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
        return new Response(JSON.stringify({ error: "Categorization failed (OpenRouter)" }), { status: response.status });
      }

      const data = await response.json();
      const generatedText = data.choices?.[0]?.message?.content?.trim().toLowerCase();
      if (generatedText) category = generatedText;
    }
      
    // Clean up response
    category = category.replace(/[^a-z]/g, '');
    const validCategories = ['note', 'thought', 'idea', 'quote', 'list', 'link', 'code'];
    if (!validCategories.includes(category)) {
      category = 'note';
    }

    return new Response(JSON.stringify({ category }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
  }
}
