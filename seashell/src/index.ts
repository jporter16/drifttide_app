import dotenv from "dotenv";
dotenv.config();
import express, { Request, Response } from "express";
import { sendMessage, Message } from "./chat";

const app = express();
const PORT = process.env.PORT ?? 3000;

// Increase limit for base64 image/video payloads
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
