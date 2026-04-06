import dotenv from "dotenv";
dotenv.config();
import express, { Request, Response } from "express";
import { sendMessage } from "./chat";
import OpenAI from "openai";

const app = express();
const PORT = process.env.PORT ?? 3000;
const SEARXNG_URL = process.env.SEARXNG_URL ?? "http://searxng:8080";

const tools: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "web_search",
      description:
        "Search the web for current, up-to-date information. Use this for recent events, news, research, or anything that may have changed.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The search query" },
        },
        required: ["query"],
      },
    },
  },
];

export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }
  | { type: "video_url"; video_url: { url: string } };

export type Message = OpenAI.Chat.ChatCompletionMessageParam;
// Increase limit for base64 image/video payloads

async function runWebSearch(query: string): Promise<string> {
  const params = new URLSearchParams({
    q: query,
    format: "json",
    categories: "general",
    language: "en",
  });

  const res = await fetch(`${SEARXNG_URL}/search?${params}`);
  if (!res.ok) throw new Error(`SearXNG error: ${res.status}`);

  const data = (await res.json()) as {
    results: { title: string; url: string; content: string }[];
  };

  if (!data.results?.length) return "No results found.";

  return data.results
    .slice(0, 5)
    .map((r, i) => `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.content}`)
    .join("\n\n");
}

app.use(express.json({ limit: "50mb" }));

// Original endpoint
app.post("/chat", async (req: Request, res: Response) => {
  const { messages } = req.body as { messages: Message[] };

  if (!messages || !Array.isArray(messages)) {
    res.status(400).json({ error: "messages array is required" });
    return;
  }

  try {
    const reply = await sendMessage(messages);
    res.json({ reply });
  } catch (err) {
    console.error("Modal error:", err);
    res.status(500).json({ error: "Failed to reach LLM" });
  }
});

// OpenAI-compatible endpoint — Open WebUI calls this
app.post("/v1/chat/completions", async (req: Request, res: Response) => {
  const { messages } = req.body as { messages: Message[] };

  if (!messages || !Array.isArray(messages)) {
    res.status(400).json({ error: "messages array is required" });
    return;
  }

  try {
    const reply = await sendMessage(messages);
    res.json({
      choices: [
        {
          message: { role: "assistant", content: reply },
          finish_reason: "stop",
          index: 0,
        },
      ],
    });
  } catch (err) {
    console.error("Modal error:", err);
    res.status(500).json({ error: "Failed to reach LLM" });
  }
});

// Updated model name
app.get("/v1/models", (_req, res) => {
  res.json({
    object: "list",
    data: [
      {
        id: "mistralai/Ministral-3-14B-Instruct-2512",
        object: "model",
        owned_by: "user",
      },
    ],
  });
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`Seashell listening on port ${PORT}`);
});
