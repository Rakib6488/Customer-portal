import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Initialize Gemini client safely
  const getGeminiClient = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not defined");
    }
    return new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  };

  // API Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // API Endpoint for Google Search Grounded query
  app.post("/api/gemini/search", async (req, res) => {
    try {
      const { message, history } = req.body;
      if (!message) {
        return res.status(400).json({ error: "Message is required" });
      }

      const ai = getGeminiClient();

      // Map history to the format Gemini expects
      const contents = [];
      if (history && Array.isArray(history)) {
        for (const turn of history) {
          contents.push({
            role: turn.role,
            parts: [{ text: turn.text }]
          });
        }
      }
      // Append current message
      contents.push({
        role: "user",
        parts: [{ text: message }]
      });

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: contents,
        config: {
          systemInstruction: "You are a professional CRM Knowledge Base Search Assistant. Help customer support agents find accurate, up-to-date, and verified information using your Google Search Grounding capabilities. Be precise, clear, and cite sources from the grounding metadata. Format your answer with elegant Markdown.",
          tools: [{ googleSearch: {} }],
        },
      });

      const text = response.text || "";
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

      // Extract sources
      const sources = chunks
        .map((c: any) => {
          if (c.web) {
            return {
              title: c.web.title || "Source",
              uri: c.web.uri || ""
            };
          }
          return null;
        })
        .filter(Boolean);

      // Unique sources by URI
      const uniqueSources: any[] = [];
      const seenUris = new Set();
      for (const src of sources) {
        if (src && src.uri && !seenUris.has(src.uri)) {
          seenUris.add(src.uri);
          uniqueSources.push(src);
        }
      }

      res.json({
        text,
        sources: uniqueSources
      });
    } catch (error: any) {
      console.error("Gemini search grounding error:", error);
      res.status(500).json({ error: error.message || "An error occurred during search grounding" });
    }
  });

  // Vite middleware setup
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
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
