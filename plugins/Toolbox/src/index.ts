import { registerCommand } from "@vendetta/commands";
import { findByProps, findByStoreName } from "@vendetta/metro";
import { clipboard } from "@vendetta/metro/common";
import { storage } from "@vendetta/plugin";
import { showToast } from "@vendetta/ui/toasts";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { logger } from "@vendetta";
import {
    parseWhen, humanDuration, tsCode, TS_STYLES,
    snowflakeToMs, calc, formatNumber,
} from "./parsers";
import Settings from "./Settings";

const TAG = "[Toolbox]";
const Clyde = findByProps("sendBotMessage");
const UserStore = findByStoreName("UserStore");
const GuildStore = findByStoreName("GuildStore");
const GuildMemberStore = findByStoreName("GuildMemberStore");
const GuildMemberCountStore = findByStoreName("GuildMemberCountStore");
const GuildChannelStore = findByStoreName("GuildChannelStore");

// ---------- storage defaults ----------
export type Reminder = { id: string; channelId: string; text: string; at: number; created: number };
export type Note = { text: string; at: number };
storage.reminders ??= [] as Reminder[];
storage.notes ??= [] as Note[];
storage.defaultStyle ??= "F";
storage.copyTimestamp ??= true;

const OPT = { STRING: 3, INTEGER: 4, BOOLEAN: 5, USER: 6 };

const reply = (channelId: string, text: string) => Clyde?.sendBotMessage?.(channelId, text);
const toast = (text: string, icon = "Check") => showToast(text, getAssetIDByName(icon));
const full = (ms: number) => `${tsCode(ms, "F")} (${tsCode(ms, "R")})`;

// ---------- reminders ----------
const timers = new Map<string, ReturnType<typeof setTimeout>>();

function fireReminder(r: Reminder, late = false) {
    timers.delete(r.id);
    storage.reminders = storage.reminders.filter((x: Reminder) => x.id !== r.id);
    reply(r.channelId, `⏰ **Reminder${late ? " (missed while closed)" : ""}:** ${r.text}\n-# set ${tsCode(r.created, "R")}`);
    toast(`⏰ ${r.text}`, "ic_notif");
}

function armReminder(r: Reminder) {
    const delay = r.at - Date.now();
    if (delay <= 0) return fireReminder(r, delay < -60_000);
    // setTimeout max is ~24.8 days — re-arm in chunks for longer reminders
    const step = Math.min(delay, 2_000_000_000);
    timers.set(r.id, setTimeout(() => (Date.now() >= r.at ? fireReminder(r) : armReminder(r)), step));
}

export function cancelReminder(id: string) {
    const t = timers.get(id);
    if (t) clearTimeout(t);
    timers.delete(id);
    storage.reminders = storage.reminders.filter((x: Reminder) => x.id !== id);
}

// ---------- command helpers ----------
type Opt = { name: string; description: string; type?: number; required?: boolean; choices?: { name: string; value: string }[] };

function cmd(name: string, description: string, options: Opt[], run: (get: (n: string) => any, ctx: any) => any) {
    return registerCommand({
        name, displayName: name,
        description, displayDescription: description,
        applicationId: "-1", inputType: 1, type: 1,
        options: options.map((o) => ({
            name: o.name, displayName: o.name,
            description: o.description, displayDescription: o.description,
            type: o.type ?? OPT.STRING,
            required: !!o.required,
            ...(o.choices ? { choices: o.choices.map((c) => ({ ...c, displayName: c.name })) } : {}),
        })),
        execute: (args: any[], ctx: any) => {
            const get = (n: string) => args?.find((a) => a.name === n)?.value;
            try {
                return run(get, ctx);
            } catch (e: any) {
                logger.log(TAG, `/${name} failed`, e);
                reply(ctx.channel.id, `❌ ${e?.message ?? "Something went wrong."}`);
            }
        },
    } as any);
}

const sendOpt: Opt = { name: "send", description: "Post it in chat instead of only showing you", type: OPT.BOOLEAN };

// ---------- commands ----------
function registerAll() {
    return [
        cmd("timestamp", "Turn a time into a Discord timestamp everyone sees in their own timezone", [
            { name: "when", description: "e.g. 5pm, tomorrow 9am, fri 8pm, in 2h, 2026-12-25 18:00", required: true },
            { name: "style", description: "Format (default from settings)", choices: Object.entries(TS_STYLES).map(([value, name]) => ({ name, value })) },
            sendOpt,
        ], (get, ctx) => {
            const ms = parseWhen(get("when"));
            if (ms === null) return reply(ctx.channel.id, "❌ Couldn't understand that time. Try `5pm`, `tomorrow 9am`, `in 2h`, or `2026-12-25 18:00`.");
            const style = get("style") || storage.defaultStyle;
            const code = tsCode(ms, style);
            if (get("send")) return { content: code };
            if (storage.copyTimestamp) { clipboard.setString(code); toast("Timestamp copied — paste it in your message"); }
            const lines = Object.keys(TS_STYLES).map((s) => `${tsCode(ms, s)} → \`${tsCode(ms, s)}\``);
            reply(ctx.channel.id, `🕒 **${get("when")}**\n${lines.join("\n")}`);
        }),

        cmd("remind", "Get a reminder in this channel later", [
            { name: "when", description: "e.g. 10m, 1h30m, 6pm, tomorrow 9am", required: true },
            { name: "text", description: "What to remind you about", required: true },
        ], (get, ctx) => {
            const at = parseWhen(get("when"));
            if (at === null || at <= Date.now()) return reply(ctx.channel.id, "❌ That time is invalid or already passed.");
            const r: Reminder = { id: `${Date.now()}${Math.random().toString(36).slice(2, 6)}`, channelId: ctx.channel.id, text: get("text"), at, created: Date.now() };
            storage.reminders = [...storage.reminders, r];
            armReminder(r);
            reply(ctx.channel.id, `✅ I'll remind you ${tsCode(at, "R")} (${tsCode(at, "f")}): **${r.text}**`);
        }),

        cmd("reminders", "List or cancel your reminders", [
            { name: "cancel", description: "Number of the reminder to cancel, or 'all'" },
        ], (get, ctx) => {
            const list: Reminder[] = [...storage.reminders].sort((a, b) => a.at - b.at);
            const cancel = (get("cancel") || "").trim().toLowerCase();
            if (cancel === "all") { list.forEach((r) => cancelReminder(r.id)); return reply(ctx.channel.id, `🗑️ Cancelled ${list.length} reminder(s).`); }
            if (cancel) {
                const r = list[parseInt(cancel) - 1];
                if (!r) return reply(ctx.channel.id, "❌ No reminder with that number.");
                cancelReminder(r.id);
                return reply(ctx.channel.id, `🗑️ Cancelled: ${r.text}`);
            }
            if (!list.length) return reply(ctx.channel.id, "No reminders set. Use `/remind`.");
            reply(ctx.channel.id, "⏰ **Your reminders**\n" + list.map((r, i) => `**${i + 1}.** ${r.text} — ${tsCode(r.at, "R")} in <#${r.channelId}>`).join("\n"));
        }),

        cmd("calc", "Calculator — supports + - * / % ^ ( ) sqrt, sin, log, pi…", [
            { name: "expression", description: "e.g. (12.5*4)^2 / 3, sqrt(144), 15% of 80 → 80*0.15", required: true },
            sendOpt,
        ], (get, ctx) => {
            const expr = get("expression");
            const result = formatNumber(calc(expr));
            if (get("send")) return { content: `🧮 \`${expr}\` = **${result}**` };
            clipboard.setString(result.replace(/,/g, ""));
            reply(ctx.channel.id, `🧮 \`${expr}\` = **${result}**\n-# result copied to clipboard`);
        }),

        cmd("whois", "Info about a user: account age, server join date, IDs", [
            { name: "user", description: "Who?", type: OPT.USER, required: true },
            sendOpt,
        ], (get, ctx) => {
            const id = get("user");
            const user = UserStore?.getUser?.(id);
            const created = snowflakeToMs(id);
            const guildId = ctx.channel?.guild_id;
            const member = guildId ? GuildMemberStore?.getMember?.(guildId, id) : null;
            const lines = [
                `👤 **${user?.globalName || user?.username || "Unknown user"}**${user?.bot ? " 🤖 BOT" : ""}`,
                `**Username:** ${user?.username ?? "?"}`,
                `**ID:** \`${id}\``,
                created ? `**Account created:** ${full(created)}` : "",
                member?.nick ? `**Nickname here:** ${member.nick}` : "",
                member?.joinedAt ? `**Joined this server:** ${full(new Date(member.joinedAt).getTime())}` : "",
                member?.roles ? `**Roles here:** ${member.roles.length}` : "",
                user?.avatar ? `**Avatar:** <https://cdn.discordapp.com/avatars/${id}/${user.avatar}.${user.avatar.startsWith("a_") ? "gif" : "png"}?size=1024>` : "",
            ].filter(Boolean).join("\n");
            if (get("send")) return { content: lines };
            clipboard.setString(id);
            reply(ctx.channel.id, lines + "\n-# user ID copied to clipboard");
        }),

        cmd("serverinfo", "Info about this server", [sendOpt], (get, ctx) => {
            const guildId = ctx.channel?.guild_id;
            if (!guildId) return reply(ctx.channel.id, "❌ This only works inside a server.");
            const g = GuildStore?.getGuild?.(guildId);
            const created = snowflakeToMs(guildId);
            const members = GuildMemberCountStore?.getMemberCount?.(guildId);
            const ch = GuildChannelStore?.getChannels?.(guildId);
            const text = ch?.SELECTABLE?.length ?? 0;
            const voice = ch?.VOCAL?.length ?? 0;
            const owner = g?.ownerId ? UserStore?.getUser?.(g.ownerId) : null;
            const lines = [
                `🏠 **${g?.name ?? "Unknown server"}**`,
                `**ID:** \`${guildId}\``,
                created ? `**Created:** ${full(created)}` : "",
                g?.ownerId ? `**Owner:** ${owner?.username ? `@${owner.username}` : `<@${g.ownerId}>`}` : "",
                members ? `**Members:** ${members.toLocaleString("en-US")}` : "",
                `**Channels:** ${text} text · ${voice} voice`,
                g?.premiumSubscriberCount != null ? `**Boosts:** ${g.premiumSubscriberCount} (level ${g.premiumTier ?? 0})` : "",
            ].filter(Boolean).join("\n");
            if (get("send")) return { content: lines };
            reply(ctx.channel.id, lines);
        }),

        cmd("snowflake", "When was this ID (user, message, channel, server) created?", [
            { name: "id", description: "Any Discord ID", required: true },
        ], (get, ctx) => {
            const ms = snowflakeToMs(String(get("id")).trim());
            if (!ms) return reply(ctx.channel.id, "❌ That doesn't look like a Discord ID.");
            reply(ctx.channel.id, `❄️ \`${get("id")}\` was created ${full(ms)}\n-# ${humanDuration(Date.now() - ms)}`);
        }),

        cmd("note", "Save a quick private note (stored on your device)", [
            { name: "text", description: "What to save", required: true },
        ], (get, ctx) => {
            storage.notes = [...storage.notes, { text: get("text"), at: Date.now() }];
            reply(ctx.channel.id, `📝 Saved note #${storage.notes.length}. See them with \`/notes\`.`);
        }),

        cmd("notes", "Show, copy or delete your notes", [
            { name: "copy", description: "Number of a note to copy to clipboard", type: OPT.INTEGER },
            { name: "delete", description: "Number of a note to delete, or 'all'" },
        ], (get, ctx) => {
            const notes: Note[] = storage.notes;
            const del = (get("delete") || "").trim().toLowerCase();
            const copy = get("copy");
            if (del === "all") { storage.notes = []; return reply(ctx.channel.id, "🗑️ All notes deleted."); }
            if (del) {
                const n = parseInt(del);
                if (!notes[n - 1]) return reply(ctx.channel.id, "❌ No note with that number.");
                storage.notes = notes.filter((_, i) => i !== n - 1);
                return reply(ctx.channel.id, `🗑️ Deleted note #${n}.`);
            }
            if (copy) {
                const note = notes[Number(copy) - 1];
                if (!note) return reply(ctx.channel.id, "❌ No note with that number.");
                clipboard.setString(note.text);
                return toast("Note copied");
            }
            if (!notes.length) return reply(ctx.channel.id, "No notes yet. Save one with `/note`.");
            reply(ctx.channel.id, "📝 **Your notes**\n" + notes.map((n, i) => `**${i + 1}.** ${n.text} · ${tsCode(n.at, "R")}`).join("\n"));
        }),
    ];
}

let unregisters: (() => void)[] = [];

export default {
    onLoad() {
        unregisters = registerAll();
        // Re-arm saved reminders (fires any that were missed while Discord was closed)
        [...storage.reminders].forEach(armReminder);
        logger.log(TAG, `Loaded, ${storage.reminders.length} reminder(s) pending`);
    },
    onUnload() {
        unregisters.forEach((u) => { try { u(); } catch {} });
        unregisters = [];
        timers.forEach((t) => clearTimeout(t));
        timers.clear();
    },
    settings: Settings,
};
