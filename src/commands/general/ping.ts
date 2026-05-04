import { SlashCommandBuilder } from "discord.js"
import type { SlashCommand } from "../../types.js"
import { scsEmbed } from "../../lib/embed.js"

export default {
  data: new SlashCommandBuilder().setName("ping").setDescription("Latency check."),
  async execute(i) {
    const sent = await i.reply({ content: "Pinging…", fetchReply: true })
    const rtt = sent.createdTimestamp - i.createdTimestamp
    await i.editReply({ content: "", embeds: [scsEmbed("ice", "🏓 Pong", `Round-trip: **${rtt}ms** · WS: **${i.client.ws.ping}ms**`)] })
  },
} satisfies SlashCommand
