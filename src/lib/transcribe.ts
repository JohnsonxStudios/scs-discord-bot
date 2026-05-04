import OpenAI from "openai"
import { createReadStream } from "node:fs"
import { env } from "./env.js"

/**
 * Transcribe an audio file. Routes to whichever provider is configured:
 * 1) Vercel AI Gateway (uses your existing AI credits, model: openai/whisper-1)
 * 2) Groq (free tier, model: whisper-large-v3)
 * 3) Direct OpenAI (model: whisper-1)
 *
 * Returns null if no provider is configured.
 */
export async function transcribeAudio(filePath: string): Promise<string | null> {
  if (env.AI_GATEWAY_API_KEY) {
    const client = new OpenAI({
      apiKey: env.AI_GATEWAY_API_KEY,
      baseURL: "https://ai-gateway.vercel.sh/v1",
    })
    const tx = await client.audio.transcriptions.create({
      file: createReadStream(filePath) as any,
      model: "openai/whisper-1",
    })
    return tx.text?.trim() ?? ""
  }

  if (env.GROQ_API_KEY) {
    const client = new OpenAI({
      apiKey: env.GROQ_API_KEY,
      baseURL: "https://api.groq.com/openai/v1",
    })
    const tx = await client.audio.transcriptions.create({
      file: createReadStream(filePath) as any,
      model: "whisper-large-v3",
    })
    return tx.text?.trim() ?? ""
  }

  if (env.OPENAI_API_KEY) {
    const client = new OpenAI({ apiKey: env.OPENAI_API_KEY })
    const tx = await client.audio.transcriptions.create({
      file: createReadStream(filePath) as any,
      model: "whisper-1",
    })
    return tx.text?.trim() ?? ""
  }

  return null
}

export function transcriptionProviderName(): string {
  if (env.AI_GATEWAY_API_KEY) return "Vercel AI Gateway"
  if (env.GROQ_API_KEY) return "Groq Whisper"
  if (env.OPENAI_API_KEY) return "OpenAI Whisper"
  return "none"
}
