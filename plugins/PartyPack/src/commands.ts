// Pure text generators for Party Pack. No Discord APIs in here,
// so everything is easy to test and reuse.

const rand = (max: number) => Math.floor(Math.random() * max);
const pick = <T>(arr: T[]): T => arr[rand(arr.length)];

// Stable 0–100 score from a string, so "/rate pizza" always gives the same answer.
function stableScore(input: string): number {
    let h = 2166136261;
    for (const ch of input.toLowerCase().trim()) {
        h ^= ch.charCodeAt(0);
        h = Math.imul(h, 16777619);
    }
    return Math.abs(h) % 101;
}

function bar(percent: number, width = 10): string {
    const filled = Math.round((percent / 100) * width);
    return "▰".repeat(filled) + "▱".repeat(width - filled);
}

// ---------- /roll ----------
// Supports "d20", "2d6", "3d8+4", "1d100-10". Defaults to 1d6.
export function roll(notation?: string): string {
    const input = (notation || "1d6").replace(/\s+/g, "").toLowerCase();
    const m = input.match(/^(\d*)d(\d+)([+-]\d+)?$/);
    if (!m) return `❌ Couldn't read \`${notation}\`. Try something like \`2d20+3\`.`;

    const count = Math.min(Math.max(parseInt(m[1] || "1"), 1), 100);
    const sides = Math.min(Math.max(parseInt(m[2]), 2), 1000);
    const mod = m[3] ? parseInt(m[3]) : 0;

    const rolls = Array.from({ length: count }, () => rand(sides) + 1);
    const total = rolls.reduce((a, b) => a + b, 0) + mod;

    let flair = "";
    if (count === 1 && sides === 20) {
        if (rolls[0] === 20) flair = " — **NAT 20!** 🎉";
        else if (rolls[0] === 1) flair = " — **nat 1...** 💀";
    }

    const shown = rolls.length > 20 ? `${rolls.slice(0, 20).join(", ")}, …` : rolls.join(", ");
    const modText = mod ? ` ${mod > 0 ? "+" : "-"} ${Math.abs(mod)}` : "";
    return `🎲 **${count}d${sides}${m[3] || ""}** → [${shown}]${modText} = **${total}**${flair}`;
}

// ---------- /flip ----------
export function flip(): string {
    if (rand(1000) === 0) return "🪙 The coin landed on its **edge**. Nobody wins. 😳";
    return `🪙 **${pick(["Heads", "Tails"])}!**`;
}

// ---------- /8ball ----------
const EIGHT_BALL = [
    "It is certain.", "Without a doubt.", "You may rely on it.", "Yes, definitely.",
    "Most likely.", "Outlook good.", "Signs point to yes.", "Yes.",
    "Reply hazy, try again.", "Ask again later.", "Better not tell you now.", "Cannot predict now.",
    "Don't count on it.", "My reply is no.", "My sources say no.", "Very doubtful.",
];
export function eightBall(question: string): string {
    return `🎱 *${question.trim()}*\n> ${pick(EIGHT_BALL)}`;
}

// ---------- /choose ----------
// Options split by "|" or ","
export function choose(options: string): string {
    const list = options.split(/[|,]/).map((o) => o.trim()).filter(Boolean);
    if (list.length < 2) return "❌ Give me at least two options, separated by `|` or `,`.";
    return `🤔 Out of ${list.length} options, I pick… **${pick(list)}**`;
}

// ---------- /rate ----------
export function rate(thing: string): string {
    const score = stableScore("rate:" + thing);
    const verdict =
        score >= 90 ? "absolute peak 🔥" :
        score >= 70 ? "pretty great 😎" :
        score >= 40 ? "mid, honestly 😐" :
        score >= 15 ? "not it 😬" : "a crime 🚨";
    return `⭐ **${thing.trim()}**: ${score}/100\n${bar(score)} — ${verdict}`;
}

// ---------- /ship ----------
export function ship(a: string, b: string): string {
    const pair = [a.trim(), b.trim()].sort().join("♥");
    const score = stableScore("ship:" + pair);
    const half = (s: string, front: boolean) =>
        front ? s.slice(0, Math.ceil(s.length / 2)) : s.slice(Math.floor(s.length / 2));
    const shipName = half(a.trim(), true) + half(b.trim(), false);
    const heart = score >= 80 ? "💞" : score >= 50 ? "❤️" : score >= 25 ? "💛" : "💔";
    return `${heart} **${a.trim()}** × **${b.trim()}** = *${shipName}*\n${bar(score)} ${score}%`;
}

// ---------- text transforms ----------
export function mock(text: string): string {
    let upper = false;
    return [...text]
        .map((c) => {
            if (!/[a-z]/i.test(c)) return c;
            upper = !upper;
            return upper ? c.toUpperCase() : c.toLowerCase();
        })
        .join("");
}

export function clap(text: string, emoji = "👏"): string {
    return text.trim().split(/\s+/).join(` ${emoji} `);
}

export function reverse(text: string): string {
    return [...text].reverse().join("");
}

const TINY: Record<string, string> = {
    a: "ᵃ", b: "ᵇ", c: "ᶜ", d: "ᵈ", e: "ᵉ", f: "ᶠ", g: "ᵍ", h: "ʰ", i: "ⁱ", j: "ʲ", k: "ᵏ", l: "ˡ", m: "ᵐ",
    n: "ⁿ", o: "ᵒ", p: "ᵖ", q: "q", r: "ʳ", s: "ˢ", t: "ᵗ", u: "ᵘ", v: "ᵛ", w: "ʷ", x: "ˣ", y: "ʸ", z: "ᶻ",
    "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
};
export function tiny(text: string): string {
    return [...text.toLowerCase()].map((c) => TINY[c] ?? c).join("");
}
