import OpenAI from "openai";
import { Message } from ".";

const client = new OpenAI({
  baseURL: `${process.env.MODAL_URL}/v1`,
  apiKey: "not-needed",
  defaultHeaders: {
    "Modal-Key": process.env.MODAL_KEY,
    "Modal-Secret": process.env.MODAL_SECRET,
  },
});

const MODEL = "mistralai/Ministral-3-14B-Instruct-2512";
// Content can be a simple string OR an array of parts (text, image, video)
export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }
  | { type: "video_url"; video_url: { url: string } };

export async function sendMessage(messages: Message[]): Promise<string> {
  const response = await client.chat.completions.create({
    model: MODEL,
    messages,
  });
  return response.choices[0].message.content ?? "";
}
