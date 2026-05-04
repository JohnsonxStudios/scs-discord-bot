import "dotenv/config"
import { z } from "zod"

const schema = z.object({
  DISCORD_TOKEN: z.string().min(10),
  DISCORD_CLIENT_ID: z.string().min(5),
  DISCORD_GUILD_ID: z.string().optional(),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(10),
  WEBSITE_URL: z.string().url().default("https://scs-project-nine.vercel.app"),
  OPENAI_API_KEY: z.string().optional(),
})

const parsed = schema.safeParse(process.env)
if (!parsed.success) {
  console.error("[env] invalid configuration:")
  console.error(parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const env = parsed.data
