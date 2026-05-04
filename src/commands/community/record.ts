import {
  ChannelType, GuildMember, PermissionFlagsBits, SlashCommandBuilder, MessageFlags,
} from "discord.js"
import {
  EndBehaviorType, joinVoiceChannel, getVoiceConnection, VoiceConnectionStatus, entersState,
} from "@discordjs/voice"
import prism from "prism-media"
import { createWriteStream, mkdtempSync, existsSync, mkdirSync, statSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { SlashCommand } from "../../types.js"
import { errorEmbed, scsEmbed, successEmbed } from "../../lib/embed.js"
import { transcribeAudio, transcriptionProviderName } from "../../lib/transcribe.js"

type SessionState = {
  guildId: string
  channelId: string
  startedAt: number
  startedBy: string
  dir: string
  speakers: Map<string, { username: string; pcmPath: string; bytes: number }>
}

const sessions = new Map<string, SessionState>() // keyed by guildId

export default {
  data: new SlashCommandBuilder()
    .setName("record")
    .setDescription("Record + auto-transcribe a voice channel.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Connect)
    .addSubcommand((s) => s.setName("start").setDescription("Start recording in your current voice channel"))
    .addSubcommand((s) => s.setName("stop").setDescription("Stop and post the transcript")),
  async execute(i) {
    if (!i.guild) return
    const sub = i.options.getSubcommand()

    if (sub === "start") {
      const member = i.member as GuildMember
      const vc = member?.voice?.channel
      if (!vc || vc.type !== ChannelType.GuildVoice) {
        await i.reply({ embeds: [errorEmbed("Join a voice channel first.")], flags: MessageFlags.Ephemeral })
        return
      }
      if (sessions.has(i.guild.id)) {
        await i.reply({ embeds: [errorEmbed("Already recording in this server. Use `/record stop` first.")], flags: MessageFlags.Ephemeral })
        return
      }

      const dir = mkdtempSync(join(tmpdir(), `scs-rec-${Date.now()}-`))
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
      const session: SessionState = {
        guildId: i.guild.id,
        channelId: vc.id,
        startedAt: Date.now(),
        startedBy: i.user.id,
        dir,
        speakers: new Map(),
      }
      sessions.set(i.guild.id, session)

      const conn = joinVoiceChannel({
        channelId: vc.id,
        guildId: i.guild.id,
        adapterCreator: i.guild.voiceAdapterCreator,
        selfDeaf: false,
        selfMute: true,
      })
      try { await entersState(conn, VoiceConnectionStatus.Ready, 15_000) }
      catch (err) {
        sessions.delete(i.guild.id)
        conn.destroy()
        await i.reply({ embeds: [errorEmbed("Failed to join voice.")], flags: MessageFlags.Ephemeral })
        return
      }

      conn.receiver.speaking.on("start", async (userId) => {
        const speaker = session.speakers.get(userId) ?? {
          username: (await i.guild!.members.fetch(userId).catch(() => null))?.user.username ?? userId,
          pcmPath: join(dir, `${userId}.pcm`),
          bytes: 0,
        }
        session.speakers.set(userId, speaker)

        const opusStream = conn.receiver.subscribe(userId, {
          end: { behavior: EndBehaviorType.AfterSilence, duration: 1000 },
        })
        const decoder = new prism.opus.Decoder({ rate: 48000, channels: 2, frameSize: 960 })
        const out = createWriteStream(speaker.pcmPath, { flags: "a" })
        opusStream.pipe(decoder).on("data", (chunk: Buffer) => { speaker.bytes += chunk.length }).pipe(out)
      })

      await i.reply({
        embeds: [successEmbed(`Recording <#${vc.id}>. Use \`/record stop\` to finish + transcribe.`, "🎙️ Started")],
      })
      return
    }

    if (sub === "stop") {
      const session = sessions.get(i.guild.id)
      if (!session) {
        await i.reply({ embeds: [errorEmbed("No active session in this server.")], flags: MessageFlags.Ephemeral })
        return
      }
      await i.deferReply()
      const conn = getVoiceConnection(i.guild.id)
      conn?.destroy()
      sessions.delete(i.guild.id)

      const provider = transcriptionProviderName()
      if (provider === "none") {
        await i.editReply({ embeds: [errorEmbed("No transcription provider configured. Set AI_GATEWAY_API_KEY (recommended), GROQ_API_KEY, or OPENAI_API_KEY in the bot env.")] })
        return
      }

      const lines: string[] = []
      for (const [_, speaker] of session.speakers.entries()) {
        if (speaker.bytes < 48000) continue   // < 1s of audio
        try {
          const wavPath = await pcmToWav(speaker.pcmPath)
          const sizeMb = statSync(wavPath).size / 1024 / 1024
          if (sizeMb > 25) {
            lines.push(`**${speaker.username}** — clip too long (${sizeMb.toFixed(1)} MB), skipped`)
            continue
          }
          const text = await transcribeAudio(wavPath)
          if (text) lines.push(`**${speaker.username}:** ${text}`)
        } catch (err: any) {
          lines.push(`**${speaker.username}** — transcription failed: ${err?.message ?? err}`)
        }
      }

      const minutes = Math.round((Date.now() - session.startedAt) / 60_000)
      const body = lines.length ? lines.join("\n\n") : "No audible speech captured."
      await i.editReply({
        embeds: [
          scsEmbed("aurora", `🎧 Transcript (${minutes}m)`, body.length > 4000 ? body.slice(0, 4000) + "…" : body)
            .setFooter({ text: `via ${provider}` }),
        ],
      })
      return
    }
  },
} satisfies SlashCommand

// PCM (48kHz s16le stereo) → WAV by prepending the 44-byte RIFF header.
import { promises as fs } from "node:fs"
async function pcmToWav(pcmPath: string): Promise<string> {
  const wavPath = pcmPath.replace(/\.pcm$/, ".wav")
  const data = await fs.readFile(pcmPath)
  const header = Buffer.alloc(44)
  const sampleRate = 48000, channels = 2, bitsPerSample = 16
  const byteRate = sampleRate * channels * bitsPerSample / 8
  const blockAlign = channels * bitsPerSample / 8
  header.write("RIFF", 0)
  header.writeUInt32LE(36 + data.length, 4)
  header.write("WAVE", 8)
  header.write("fmt ", 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(channels, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(byteRate, 28)
  header.writeUInt16LE(blockAlign, 32)
  header.writeUInt16LE(bitsPerSample, 34)
  header.write("data", 36)
  header.writeUInt32LE(data.length, 40)
  await fs.writeFile(wavPath, Buffer.concat([header, data]))
  return wavPath
}
