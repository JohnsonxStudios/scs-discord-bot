import { Events } from "discord.js"
import type { BotEvent } from "../types.js"
import { getGuildSettings } from "../lib/db.js"
import { scsEmbed } from "../lib/embed.js"
import { updateMemberCounter } from "../lib/counter.js"

export default {
  name: Events.GuildMemberAdd,
  async execute(_client, member) {
    const settings = await getGuildSettings(member.guild.id)

    if (settings.welcome_channel_id) {
      const ch = await member.guild.channels.fetch(settings.welcome_channel_id as string).catch(() => null)
      if (ch?.isTextBased() && "send" in ch) {
        const tmpl =
          (settings.welcome_message as string | null) ??
          "Welcome to the **Secret Chel Society**, {user}! Drop your gamertag in #intros and link your account with `/link`."
        await ch.send({
          embeds: [
            scsEmbed("ice", `${member.user.username} joined`, tmpl.replace("{user}", `<@${member.id}>`))
              .setThumbnail(member.user.displayAvatarURL({ extension: "png" })),
          ],
        }).catch(() => {})
      }
    }

    if (settings.autorole_id) {
      await member.roles.add(settings.autorole_id as string).catch(() => {})
    }

    await updateMemberCounter(member.guild)
  },
} satisfies BotEvent<typeof Events.GuildMemberAdd>
