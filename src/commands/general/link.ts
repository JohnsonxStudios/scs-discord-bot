import { SlashCommandBuilder, MessageFlags } from "discord.js"
import type { SlashCommand } from "../../types.js"
import { db } from "../../lib/db.js"
import { env } from "../../lib/env.js"
import { scsEmbed } from "../../lib/embed.js"
import { randomBytes } from "node:crypto"

export default {
  data: new SlashCommandBuilder()
    .setName("link")
    .setDescription("Link this Discord account to your SCS website account."),
  async execute(i) {
    await i.deferReply({ flags: MessageFlags.Ephemeral })

    const { data: existing } = await db
      .from("discord_links")
      .select("user_id, linked_at")
      .eq("discord_id", i.user.id)
      .maybeSingle()
    if (existing) {
      await i.editReply({
        embeds: [scsEmbed("emerald", "Already linked", `Your Discord is already linked to a SCS account (${new Date(existing.linked_at as string).toLocaleString()}).`)],
      })
      return
    }

    const code = randomBytes(4).toString("hex").toUpperCase()
    const expires = new Date(Date.now() + 15 * 60 * 1000)
    await db.from("discord_link_codes").insert({
      code,
      discord_id: i.user.id,
      discord_username: i.user.username,
      expires_at: expires.toISOString(),
    } as never)

    const url = `${env.WEBSITE_URL}/dashboard?discord=${code}`
    await i.editReply({
      embeds: [
        scsEmbed("ice", "Link your account", [
          `1. Open the SCS website while signed in: ${url}`,
          `2. Or paste this code on /dashboard → **Link Discord**:`,
          `   \`${code}\``,
          ``,
          `Code expires in 15 minutes.`,
        ].join("\n")),
      ],
    })
  },
} satisfies SlashCommand
