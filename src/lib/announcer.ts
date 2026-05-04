import type { Client, TextBasedChannel } from "discord.js"
import { db } from "./db.js"
import { scsEmbed } from "./embed.js"
import { env } from "./env.js"

const POLL_MS = 60_000

async function watermark(guildId: string, topic: string): Promise<{ id: string | null; at: string | null }> {
  const { data } = await db.from("discord_announce_watermarks")
    .select("last_seen_id,last_seen_at").eq("guild_id", guildId).eq("topic", topic).maybeSingle()
  return { id: (data?.last_seen_id as string | null) ?? null, at: (data?.last_seen_at as string | null) ?? null }
}

async function setWatermark(guildId: string, topic: string, id: string | null, at: string | null) {
  await db.from("discord_announce_watermarks").upsert({
    guild_id: guildId, topic, last_seen_id: id, last_seen_at: at,
  } as never, { onConflict: "guild_id,topic" })
}

async function safeSend(channel: TextBasedChannel | null, payload: any) {
  if (!channel || !("send" in channel)) return
  try { await (channel as any).send(payload) } catch { /* ignore */ }
}

async function tickGuild(client: Client, settings: Record<string, any>) {
  const guildId = settings.guild_id as string
  const guild = await client.guilds.fetch(guildId).catch(() => null)
  if (!guild) return
  const teamCache = new Map<string, { name: string; abbreviation: string | null }>()
  async function teamName(id: string | null) {
    if (!id) return "?"
    if (teamCache.has(id)) return teamCache.get(id)!.abbreviation || teamCache.get(id)!.name
    const { data } = await db.from("teams").select("name,abbreviation").eq("id", id).maybeSingle()
    if (data) { teamCache.set(id, data as any); return (data.abbreviation as string) || (data.name as string) }
    return "?"
  }

  // ── 1. Newly-scheduled matches ────────────────────────────────────
  if (settings.announce_matches_channel_id) {
    const wm = await watermark(guildId, "matches")
    const { data } = await db.from("matches").select("id,match_date,home_team_id,away_team_id,created_at")
      .eq("status", "scheduled").gt("created_at", wm.at ?? "1970-01-01").order("created_at").limit(20)
    const ch = await guild.channels.fetch(settings.announce_matches_channel_id).catch(() => null)
    let lastAt = wm.at, lastId = wm.id
    for (const m of (data ?? []) as Array<any>) {
      const ts = Math.floor(new Date(m.match_date).getTime() / 1000)
      await safeSend(ch as any, {
        embeds: [scsEmbed("ice", "📅 Match Scheduled",
          `**${await teamName(m.home_team_id)} vs ${await teamName(m.away_team_id)}**\n<t:${ts}:F> · <t:${ts}:R>\n${env.WEBSITE_URL}/matches/${m.id}`)],
      })
      lastAt = m.created_at; lastId = m.id
    }
    if (data?.length) await setWatermark(guildId, "matches", lastId, lastAt)
  }

  // ── 2. Match results ──────────────────────────────────────────────
  if (settings.announce_results_channel_id) {
    const wm = await watermark(guildId, "results")
    const { data } = await db.from("matches")
      .select("id,match_date,home_team_id,away_team_id,home_score,away_score,three_stars,updated_at")
      .eq("status", "completed").gt("updated_at", wm.at ?? "1970-01-01").order("updated_at").limit(20)
    const ch = await guild.channels.fetch(settings.announce_results_channel_id).catch(() => null)
    let lastAt = wm.at, lastId = wm.id
    for (const m of (data ?? []) as Array<any>) {
      const home = await teamName(m.home_team_id)
      const away = await teamName(m.away_team_id)
      const winner = (m.home_score ?? 0) > (m.away_score ?? 0) ? home : (m.away_score ?? 0) > (m.home_score ?? 0) ? away : "Tie"
      const stars = (Array.isArray(m.three_stars) ? m.three_stars : []).slice(0, 3)
        .map((s: any, idx: number) => `${idx + 1}. **${s.playerName ?? "—"}** ${s.statLine ?? ""}`).join("\n")
      await safeSend(ch as any, {
        embeds: [scsEmbed("emerald", "🏒 Final",
          `**${home} ${m.home_score ?? 0} — ${m.away_score ?? 0} ${away}** (${winner} win)\n${stars ? "\n**3 Stars**\n" + stars + "\n" : ""}\n${env.WEBSITE_URL}/matches/${m.id}`)],
      })
      lastAt = m.updated_at; lastId = m.id
    }
    if (data?.length) await setWatermark(guildId, "results", lastId, lastAt)
  }

  // ── 3. News ──────────────────────────────────────────────────────
  if (settings.announce_news_channel_id) {
    const wm = await watermark(guildId, "news")
    const { data } = await db.from("news").select("id,title,subtitle,excerpt,image_url,published,created_at")
      .eq("published", true).gt("created_at", wm.at ?? "1970-01-01").order("created_at").limit(10)
    const ch = await guild.channels.fetch(settings.announce_news_channel_id).catch(() => null)
    let lastAt = wm.at, lastId = wm.id
    for (const n of (data ?? []) as Array<any>) {
      const e = scsEmbed("aurora", `📰 ${n.title ?? "News"}`, n.excerpt ?? n.subtitle ?? "").setURL(`${env.WEBSITE_URL}/news/${n.id}`)
      if (n.image_url) e.setImage(n.image_url)
      await safeSend(ch as any, { embeds: [e] })
      lastAt = n.created_at; lastId = n.id
    }
    if (data?.length) await setWatermark(guildId, "news", lastId, lastAt)
  }

  // ── 4. Daily recaps ──────────────────────────────────────────────
  if (settings.announce_recaps_channel_id) {
    const wm = await watermark(guildId, "recaps")
    const { data } = await db.from("daily_recaps").select("id,date,title,content,published,created_at")
      .eq("published", true).gt("created_at", wm.at ?? "1970-01-01").order("created_at").limit(5)
    const ch = await guild.channels.fetch(settings.announce_recaps_channel_id).catch(() => null)
    let lastAt = wm.at, lastId = wm.id
    for (const r of (data ?? []) as Array<any>) {
      await safeSend(ch as any, {
        embeds: [scsEmbed("ice", `📒 ${r.title ?? `Daily Recap — ${r.date}`}`, (r.content ?? "").slice(0, 1500))
          .setURL(`${env.WEBSITE_URL}/news/daily-recap`)],
      })
      lastAt = r.created_at; lastId = r.id
    }
    if (data?.length) await setWatermark(guildId, "recaps", lastId, lastAt)
  }

  // ── 5. Trades / waivers / IR (from `requests` table) ─────────────
  if (settings.announce_trades_channel_id) {
    const wm = await watermark(guildId, "trades")
    const { data } = await db.from("requests")
      .select("id,request_type,status,team_id,payload,updated_at")
      .in("status", ["approved", "completed"])
      .in("request_type", ["trade_proposal", "waiver_claim", "free_agency_signing"])
      .gt("updated_at", wm.at ?? "1970-01-01").order("updated_at").limit(20)
    const ch = await guild.channels.fetch(settings.announce_trades_channel_id).catch(() => null)
    let lastAt = wm.at, lastId = wm.id
    for (const r of (data ?? []) as Array<any>) {
      const label = r.request_type === "trade_proposal" ? "🔁 Trade" : r.request_type === "waiver_claim" ? "📜 Waiver" : "🆓 Free Agent"
      await safeSend(ch as any, {
        embeds: [scsEmbed("amber", `${label} — ${r.status}`, `\`\`\`json\n${JSON.stringify(r.payload ?? {}, null, 2).slice(0, 1500)}\n\`\`\``)],
      })
      lastAt = r.updated_at; lastId = r.id
    }
    if (data?.length) await setWatermark(guildId, "trades", lastId, lastAt)
  }

  // ── 6. Notification → DM bridge ──────────────────────────────────
  if (settings.notifications_dm !== false) {
    const wm = await watermark(guildId, "notifications")
    const { data: notes } = await db.from("notifications")
      .select("id,user_id,title,message,link,created_at")
      .gt("created_at", wm.at ?? "1970-01-01")
      .order("created_at").limit(50)
    const userIds = Array.from(new Set(((notes ?? []) as any[]).map((n) => n.user_id).filter(Boolean)))
    if (userIds.length) {
      const { data: links } = await db.from("discord_links").select("user_id,discord_id").in("user_id", userIds)
      const discordByUser = new Map(((links ?? []) as any[]).map((l) => [l.user_id, l.discord_id]))
      let lastAt = wm.at, lastId = wm.id
      for (const n of (notes ?? []) as Array<any>) {
        const did = discordByUser.get(n.user_id)
        if (did) {
          try {
            const u = await client.users.fetch(did)
            await u.send({ embeds: [scsEmbed("ice", n.title ?? "SCS Notification", `${n.message ?? ""}${n.link ? `\n${env.WEBSITE_URL}${n.link}` : ""}`)] })
          } catch { /* dms off */ }
        }
        lastAt = n.created_at; lastId = n.id
      }
      if (notes?.length) await setWatermark(guildId, "notifications", lastId, lastAt)
    }
  }
}

export function startAnnouncer(client: Client) {
  setInterval(async () => {
    try {
      const { data } = await db.from("discord_settings").select("*")
      for (const s of (data ?? []) as Array<Record<string, any>>) {
        await tickGuild(client, s)
      }
    } catch (err) {
      console.error("[announcer]", err)
    }
  }, POLL_MS)
}
