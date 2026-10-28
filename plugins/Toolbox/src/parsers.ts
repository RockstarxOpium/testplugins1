// Pure helpers (no Discord APIs) — easy to test.

// ---------------- Time parsing ----------------
// Accepts things like:
//   10m, 1h30m, 2d, 1w, 90s, "in 2 hours", "3 days"
//   5pm, 5:30pm, 17:30            (next time that clock time happens)
//   tomorrow, tomorrow 9am, today 18:00
//   friday, fri 8pm               (next friday)
//   2026-11-01, 2026-11-01 18:00, 11/1, 11/1 6pm
//   now
// Returns a unix timestamp in ms, or null if it couldn't parse.

const UNIT_MS: Record<string, number> = {
    s: 1e3, sec: 1e3, secs: 1e3, second: 1e3, seconds: 1e3,
    m: 6e4, min: 6e4, mins: 6e4, minute: 6e4, minutes: 6e4,
    h: 36e5, hr: 36e5, hrs: 36e5, hour: 36e5, hours: 36e5,
    d: 864e5, day: 864e5, days: 864e5,
    w: 6048e5, wk: 6048e5, week: 6048e5, weeks: 6048e5,
};

const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function parseClock(s: string): [number, number] | null {
    const m = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
    if (!m) return null;
    let h = parseInt(m[1]);
    const min = m[2] ? parseInt(m[2]) : 0;
    const ap = m[3];
    if (!ap && !m[2]) return null; // bare "5" is ambiguous
    if (min > 59) return null;
    if (ap) {
        if (h < 1 || h > 12) return null;
        if (ap === "pm" && h < 12) h += 12;
        if (ap === "am" && h === 12) h = 0;
    } else if (h > 23) return null;
    return [h, min];
}

export function parseWhen(input: string, now: Date = new Date()): number | null {
    let s = (input || "").toLowerCase().trim().replace(/\s+/g, " ");
    if (!s) return null;
    if (s === "now") return now.getTime();

    // Durations: "in 2h 30m", "1h30m", "3 days"
    const durStr = s.replace(/^in /, "").replace(/ and /g, " ");
    const durRe = /(\d+(?:\.\d+)?)\s*([a-z]+)/g;
    let total = 0, consumed = "", m: RegExpExecArray | null;
    while ((m = durRe.exec(durStr))) {
        const ms = UNIT_MS[m[2]];
        if (!ms) { total = 0; break; }
        total += parseFloat(m[1]) * ms;
        consumed += m[0];
    }
    if (total > 0 && consumed.replace(/\s/g, "") === durStr.replace(/\s/g, "")) {
        return now.getTime() + total;
    }

    // Split "<date part> <time part>"
    const parts = s.split(" ");
    let datePart = parts[0];
    let timePart = parts.slice(1).join(" ");

    // Lone clock time: "5pm", "17:30", "5:30 pm"
    const loneClock = parseClock(s.replace(/ (am|pm)$/, "$1"));
    if (loneClock) {
        const d = new Date(now);
        d.setHours(loneClock[0], loneClock[1], 0, 0);
        if (d.getTime() <= now.getTime()) d.setDate(d.getDate() + 1);
        return d.getTime();
    }

    timePart = timePart.replace(/ (am|pm)$/, "$1");
    const clock = timePart ? parseClock(timePart) : [9, 0] as [number, number];
    if (!clock) return null;

    const d = new Date(now);
    d.setSeconds(0, 0);

    if (datePart === "today") {
        // keep date
    } else if (datePart === "tomorrow" || datePart === "tmr" || datePart === "tmrw") {
        d.setDate(d.getDate() + 1);
    } else if (DAYS.some((day) => day.startsWith(datePart) && datePart.length >= 3)) {
        const target = DAYS.findIndex((day) => day.startsWith(datePart));
        let diff = (target - d.getDay() + 7) % 7;
        if (diff === 0) diff = 7;
        d.setDate(d.getDate() + diff);
    } else if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(datePart)) {
        const [y, mo, da] = datePart.split("-").map(Number);
        d.setFullYear(y, mo - 1, da);
    } else if (/^\d{1,2}\/\d{1,2}(\/\d{2,4})?$/.test(datePart)) {
        const [mo, da, yRaw] = datePart.split("/").map(Number);
        const y = yRaw ? (yRaw < 100 ? 2000 + yRaw : yRaw) : d.getFullYear();
        d.setFullYear(y, mo - 1, da);
        if (!yRaw) {
            d.setHours(clock[0], clock[1], 0, 0);
            if (d.getTime() < now.getTime()) d.setFullYear(y + 1);
        }
    } else {
        return null;
    }

    d.setHours(clock[0], clock[1], 0, 0);
    return isNaN(d.getTime()) ? null : d.getTime();
}

export function humanDuration(ms: number): string {
    const neg = ms < 0;
    let s = Math.round(Math.abs(ms) / 1000);
    const out: string[] = [];
    for (const [label, size] of [["d", 86400], ["h", 3600], ["m", 60], ["s", 1]] as const) {
        const n = Math.floor(s / size);
        if (n) out.push(`${n}${label}`);
        s -= n * size;
    }
    const txt = out.slice(0, 2).join(" ") || "0s";
    return neg ? `${txt} ago` : txt;
}

// ---------------- Discord timestamps ----------------
export const TS_STYLES: Record<string, string> = {
    t: "Short time (4:20 PM)",
    T: "Long time (4:20:30 PM)",
    d: "Short date (11/28/2026)",
    D: "Long date (November 28, 2026)",
    f: "Date + time",
    F: "Full date + time",
    R: "Relative (in 2 hours)",
};
export const tsCode = (ms: number, style: string) => `<t:${Math.floor(ms / 1000)}:${style}>`;

// ---------------- Snowflakes ----------------
const DISCORD_EPOCH = 1420070400000;
export function snowflakeToMs(id: string): number | null {
    if (!/^\d{15,21}$/.test(id)) return null;
    return Math.floor(Number(id) / 4194304) + DISCORD_EPOCH;
}

// ---------------- Safe calculator ----------------
// Recursive-descent parser: + - * / % ^, parentheses, unary minus,
// functions (sqrt abs round floor ceil sin cos tan log ln), constants (pi, e).
// "x" and "×" work as multiply, "÷" as divide. No eval().
const FUNCS: Record<string, (n: number) => number> = {
    sqrt: Math.sqrt, abs: Math.abs, round: Math.round, floor: Math.floor, ceil: Math.ceil,
    sin: Math.sin, cos: Math.cos, tan: Math.tan, log: Math.log10, ln: Math.log,
};
const CONSTS: Record<string, number> = { pi: Math.PI, e: Math.E };

export function calc(expr: string): number {
    const src = expr.toLowerCase().replace(/×/g, "*").replace(/÷/g, "/").replace(/,/g, "")
        .replace(/(\d)\s*x\s*(?=[\d(.])/g, "$1*");
    const tokens = src.match(/\d*\.?\d+(?:e[+-]?\d+)?|[a-z]+|[-+*/%^()]/g);
    if (!tokens || tokens.join("") !== src.replace(/\s+/g, "")) throw new Error("Unknown characters in expression");
    let i = 0;
    const peek = () => tokens[i];
    const take = () => tokens[i++];

    function primary(): number {
        const t = take();
        if (t === undefined) throw new Error("Unexpected end");
        if (t === "(") { const v = expr0(); if (take() !== ")") throw new Error("Missing )"); return v; }
        if (t === "-") return -power();
        if (t === "+") return power();
        if (/^[\d.]/.test(t)) return parseFloat(t);
        if (t in CONSTS) return CONSTS[t];
        if (t in FUNCS) {
            if (peek() === "(") { take(); const v = expr0(); if (take() !== ")") throw new Error("Missing )"); return FUNCS[t](v); }
            return FUNCS[t](power());
        }
        throw new Error(`Unknown "${t}"`);
    }
    function power(): number {
        const base = primary();
        if (peek() === "^") { take(); return Math.pow(base, unary()); }
        return base;
    }
    function unary(): number {
        if (peek() === "-") { take(); return -unary(); }
        if (peek() === "+") { take(); return unary(); }
        return power();
    }
    function term(): number {
        let v = unary();
        while (["*", "/", "%"].includes(peek())) {
            const op = take();
            const r = unary();
            v = op === "*" ? v * r : op === "/" ? v / r : v % r;
        }
        return v;
    }
    function expr0(): number {
        let v = term();
        while (peek() === "+" || peek() === "-") {
            const op = take();
            const r = term();
            v = op === "+" ? v + r : v - r;
        }
        return v;
    }

    const result = expr0();
    if (i < tokens.length) throw new Error(`Unexpected "${tokens[i]}"`);
    if (!isFinite(result)) throw new Error("Result is not a finite number");
    return result;
}

export function formatNumber(n: number): string {
    if (Number.isInteger(n) && Math.abs(n) < 1e15) return n.toLocaleString("en-US");
    return parseFloat(n.toPrecision(12)).toString();
}
