import { registerCommand } from "@vendetta/commands";
import { findByProps } from "@vendetta/metro";
import { storage } from "@vendetta/plugin";
import { logger } from "@vendetta";
import * as gen from "./commands";
import Settings from "./Settings";

const TAG = "[PartyPack]";
const Clyde = findByProps("sendBotMessage");

// ---- defaults ----
storage.privateResults ??= false; // show game results only to you
storage.clapEmoji ??= "👏";
storage.disabled ??= [] as string[];

const STRING = 3;
let unregisters: (() => void)[] = [];

type Opt = { name: string; description: string; required?: boolean };
type Def = {
    name: string;
    description: string;
    kind: "game" | "text"; // games respect "private results", text transforms always send
    options?: Opt[];
    run: (get: (name: string) => string) => string;
};

export const COMMANDS: Def[] = [
    {
        name: "roll", kind: "game", description: "Roll dice (e.g. 2d20+3)",
        options: [{ name: "dice", description: "Dice notation, defaults to 1d6" }],
        run: (get) => gen.roll(get("dice")),
    },
    { name: "flip", kind: "game", description: "Flip a coin", run: () => gen.flip() },
    {
        name: "8ball", kind: "game", description: "Ask the magic 8-ball",
        options: [{ name: "question", description: "Your yes/no question", required: true }],
        run: (get) => gen.eightBall(get("question")),
    },
    {
        name: "choose", kind: "game", description: "Let fate pick for you",
        options: [{ name: "options", description: "Options split by | or ,", required: true }],
        run: (get) => gen.choose(get("options")),
    },
    {
        name: "rate", kind: "game", description: "Rate anything out of 100",
        options: [{ name: "thing", description: "What should I rate?", required: true }],
        run: (get) => gen.rate(get("thing")),
    },
    {
        name: "ship", kind: "game", description: "Check the compatibility of two things",
        options: [
            { name: "first", description: "First name", required: true },
            { name: "second", description: "Second name", required: true },
        ],
        run: (get) => gen.ship(get("first"), get("second")),
    },
    {
        name: "mock", kind: "text", description: "sEnD tExT lIkE tHiS",
        options: [{ name: "text", description: "Text to mock", required: true }],
        run: (get) => gen.mock(get("text")),
    },
    {
        name: "clap", kind: "text", description: "Add 👏 between 👏 words",
        options: [{ name: "text", description: "Text to clap", required: true }],
        run: (get) => gen.clap(get("text"), storage.clapEmoji || "👏"),
    },
    {
        name: "reverse", kind: "text", description: "esrever ni txet dneS",
        options: [{ name: "text", description: "Text to reverse", required: true }],
        run: (get) => gen.reverse(get("text")),
    },
    {
        name: "tiny", kind: "text", description: "ˢᵉⁿᵈ ᵗⁱⁿʸ ᵗᵉˣᵗ",
        options: [{ name: "text", description: "Text to shrink", required: true }],
        run: (get) => gen.tiny(get("text")),
    },
];

function register(def: Def) {
    return registerCommand({
        name: def.name,
        displayName: def.name,
        description: def.description,
        displayDescription: def.description,
        applicationId: "-1",
        inputType: 1,
        type: 1,
        options: (def.options ?? []).map((o) => ({
            name: o.name,
            displayName: o.name,
            description: o.description,
            displayDescription: o.description,
            type: STRING,
            required: !!o.required,
        })),
        execute: (args: any[], ctx: any) => {
            const get = (name: string) => args?.find((a) => a.name === name)?.value ?? "";
            let content: string;
            try {
                content = def.run(get);
            } catch (e) {
                logger.log(TAG, `/${def.name} failed:`, e);
                content = "❌ Something went wrong.";
            }

            if (def.kind === "game" && storage.privateResults) {
                Clyde?.sendBotMessage?.(ctx.channel.id, content);
                return;
            }
            return { content };
        },
    } as any);
}

// Re-registers commands so toggles in Settings apply instantly.
export function refreshCommands() {
    unregisters.forEach((u) => {
        try { u(); } catch {}
    });
    unregisters = COMMANDS
        .filter((c) => !storage.disabled.includes(c.name))
        .map(register);
}

export default {
    onLoad() {
        refreshCommands();
        logger.log(TAG, `Loaded ${unregisters.length} commands`);
    },
    onUnload() {
        unregisters.forEach((u) => {
            try { u(); } catch {}
        });
        unregisters = [];
    },
    settings: Settings,
};
