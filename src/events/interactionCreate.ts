import { Events, MessageFlags } from "discord.js"
import type { BotEvent } from "../types.js"
import { commands, findButton, findModal, findSelect } from "../lib/registry.js"
import { errorEmbed } from "../lib/embed.js"

export default {
  name: Events.InteractionCreate,
  async execute(_client, interaction) {
    try {
      if (interaction.isChatInputCommand()) {
        const cmd = commands.get(interaction.commandName)
        if (!cmd) return
        await cmd.execute(interaction)
        return
      }
      if (interaction.isButton()) {
        const h = findButton(interaction.customId)
        if (h) await h.execute(interaction)
        return
      }
      if (interaction.isModalSubmit()) {
        const h = findModal(interaction.customId)
        if (h) await h.execute(interaction)
        return
      }
      if (interaction.isStringSelectMenu()) {
        const h = findSelect(interaction.customId)
        if (h) await h.execute(interaction)
        return
      }
    } catch (err: any) {
      console.error("interaction error:", err)
      const payload = { embeds: [errorEmbed(err?.message ?? "Unexpected error.")], flags: MessageFlags.Ephemeral }
      if (interaction.isRepliable()) {
        if (interaction.replied || interaction.deferred) await interaction.followUp(payload).catch(() => {})
        else await interaction.reply(payload).catch(() => {})
      }
    }
  },
} satisfies BotEvent<typeof Events.InteractionCreate>
