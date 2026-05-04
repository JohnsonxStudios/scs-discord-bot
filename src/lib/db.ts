import { createClient } from "@supabase/supabase-js"
import { env } from "./env.js"

export const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

/** Look up the linked SCS user_id for a Discord ID. Returns null if unlinked. */
export async function findScsUserByDiscord(discordId: string): Promise<string | null> {
  const { data } = await db
    .from("discord_links")
    .select("user_id")
    .eq("discord_id", discordId)
    .maybeSingle()
  return (data?.user_id as string | null) ?? null
}

/** Get / create per-guild settings row */
export async function getGuildSettings(guildId: string) {
  const { data } = await db
    .from("discord_settings")
    .select("*")
    .eq("guild_id", guildId)
    .maybeSingle()
  if (data) return data as Record<string, any>
  const { data: created } = await db
    .from("discord_settings")
    .insert({ guild_id: guildId } as never)
    .select("*")
    .single()
  return (created ?? { guild_id: guildId }) as Record<string, any>
}
