import OpenAI from "openai";

const client = new OpenAI({
  baseURL: `${process.env.MODAL_URL}/v1`,
  apiKey: "not-needed",
  defaultHeaders: {
    "Modal-Key": process.env.MODAL_KEY,
    "Modal-Secret": process.env.MODAL_SECRET,
  },
});

export const MODEL = "mistralai/Ministral-3-14B-Instruct-2512";
const SEARXNG_URL = "http://searxng:8080";
export type Message = OpenAI.Chat.ChatCompletionMessageParam;
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
// Content can be a simple string OR an array of parts (text, image, video)
export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }
  | { type: "video_url"; video_url: { url: string } };

// Resolve tool calls and return the messages array ready for a final completion
async function resolveToolCalls(messages: Message[]): Promise<Message[]> {
  let currentMessages: Message[] = [...messages];

  for (let round = 0; round < 5; round++) {
    const response = await client.chat.completions.create({
      model: MODEL,
      messages: currentMessages,
      tools,
      tool_choice: "auto",
    });

    const choice = response.choices[0];

    if (choice.finish_reason === "tool_calls" && choice.message.tool_calls) {
      currentMessages.push(choice.message);
      for (const toolCall of choice.message.tool_calls) {
        if (
          toolCall.type === "function" &&
          toolCall.function.name === "web_search"
        ) {
          const args = JSON.parse(toolCall.function.arguments) as {
            query: string;
          };
          console.log(`[web_search] "${args.query}"`);
          const result = await runWebSearch(args.query);
          currentMessages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: result,
          });
        }
      }
    } else {
      // No tool call — messages are ready for a final streaming pass
      // Pop the assistant message; caller will stream it fresh
      return currentMessages;
    }
  }

  return currentMessages;
}

// Non-streaming (original behaviour)
export async function sendMessage(messages: Message[]): Promise<string> {
  const resolved = await resolveToolCalls(messages);
  const response = await client.chat.completions.create({
    model: MODEL,
    messages: resolved,
  });
  return response.choices[0].message.content ?? "";
}

// Streaming: resolves tool calls, then yields SSE chunks from the final turn
export async function* sendMessageStream(
  messages: Message[]
): AsyncGenerator<string> {
  const resolved = await resolveToolCalls(messages);

  const stream = await client.chat.completions.create({
    model: MODEL,
    messages: resolved,
    stream: true,
  });

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) yield delta;
  }
}
