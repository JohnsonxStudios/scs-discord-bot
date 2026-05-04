import { EmbedBuilder, ColorResolvable } from "discord.js"

const TONES = {
  ice: 0x38bdf8,
  fire: 0xff6b35,
  aurora: 0xa78bfa,
  emerald: 0x10b981,
  rose: 0xf43f5e,
  amber: 0xf59e0b,
  slate: 0x64748b,
} as const

export type Tone = keyof typeof TONES

/** SCS-themed embed factory. Pass tone to colour-match. */
export function scsEmbed(tone: Tone = "ice", title?: string, description?: string) {
  const e = new EmbedBuilder().setColor(TONES[tone] as ColorResolvable).setTimestamp(new Date())
  if (title) e.setTitle(title)
  if (description) e.setDescription(description)
  return e.setFooter({ text: "Secret Chel Society" })
}

export function errorEmbed(message: string) {
  return scsEmbed("rose", "✕ Error", message)
}

export function successEmbed(message: string, title = "✓ Done") {
  return scsEmbed("emerald", title, message)
}
