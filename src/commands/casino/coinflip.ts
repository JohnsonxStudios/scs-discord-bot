import { SlashCommandBuilder } from "discord.js"
import type { SlashCommand } from "../../types.js"
import { findScsUserByDiscord } from "../../lib/db.js"
import { adjustBalance, logCasino, getBalance } from "../../lib/tokens.js"
import { errorEmbed, scsEmbed } from "../../lib/embed.js"

export default {
  data: new SlashCommandBuilder()
    .setName("coinflip")
    .setDescription("Flip a coin. 2× payout on win.")
    .addIntegerOption((o) => o.setName("wager").setDescription("Tokens to wager").setRequired(true).setMinValue(10))
    .addStringOption((o) => o.setName("side").setDescription("heads or tails").setRequired(true).addChoices({ name: "Heads", value: "heads" }, { name: "Tails", value: "tails" })),
  async execute(i) {
    await i.deferReply()
    const wager = i.options.getInteger("wager", true)
    const side = i.options.getString("side", true) as "heads" | "tails"
    const userId = await findScsUserByDiscord(i.user.id)
    if (!userId) { await i.editReply({ embeds: [errorEmbed("Run `/link` first.")] }); return }
    const bal = await getBalance(userId)
    if (bal < wager) { await i.editReply({ embeds: [errorEmbed(`Insufficient tokens (${bal}).`)] }); return }

    await adjustBalance(userId, -wager)
    const result: "heads" | "tails" = Math.random() < 0.5 ? "heads" : "tails"
    const won = result === side
    const payout = won ? wager * 2 : 0
    if (payout) await adjustBalance(userId, payout)
    await logCasino({ userId, discordId: i.user.id, game: "coinflip", wager, payout, meta: { side, result } })

    const newBal = await getBalance(userId)
    await i.editReply({
      embeds: [
        scsEmbed(won ? "emerald" : "rose", won ? "🪙 You win!" : "🪙 You lose", [
          `Result: **${result.toUpperCase()}**`,
          `Wager: ${wager} → Payout: ${payout}`,
          `Balance: **${newBal}** tokens`,
        ].join("\n")),
      ],
    })
  },
} satisfies SlashCommand
