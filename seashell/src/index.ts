import dotenv from "dotenv";
import express, { Request, Response } from "express";
import { Message, MODEL, sendMessage, sendMessageStream } from "./chat";

const app = express();
const PORT = process.env.PORT ?? 3000;

// Increase limit for base64 image/video payloads

app.use(express.json({ limit: "50mb" }));

// OpenAI-compatible endpoint — handles both streaming and non-streaming
app.post("/v1/chat/completions", async (req: Request, res: Response) => {
  const { messages, stream } = req.body as {
    messages: Message[];
    stream?: boolean;
  };

  if (!messages || !Array.isArray(messages)) {
    res.status(400).json({ error: "messages array is required" });
    return;
  }

  if (stream) {
    // SSE streaming response
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const chunkId = `chatcmpl-${Date.now()}`;
    const created = Math.floor(Date.now() / 1000);

    try {
      for await (const delta of sendMessageStream(messages)) {
        const chunk = {
          id: chunkId,
          object: "chat.completion.chunk",
          created,
          model: MODEL,
          choices: [
            {
              index: 0,
              delta: { role: "assistant", content: delta },
              finish_reason: null,
            },
          ],
        };
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      }

      // Final chunk signals end of stream
      const doneChunk = {
        id: chunkId,
        object: "chat.completion.chunk",
        created,
        model: MODEL,
        choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
      };
      res.write(`data: ${JSON.stringify(doneChunk)}\n\n`);
      res.write("data: [DONE]\n\n");
      res.end();
    } catch (err) {
      console.error("Stream error:", err);
      res.write(`data: ${JSON.stringify({ error: "Stream failed" })}\n\n`);
      res.end();
    }
  } else {
    // Non-streaming fallback
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
  }
});

// Updated model name
app.get("/v1/models", (_req, res) => {
  res.json({
    object: "list",
    data: [
      {
        id: MODEL,
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
