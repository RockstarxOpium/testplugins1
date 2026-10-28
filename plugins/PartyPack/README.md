# Party Pack

A bundle of fun slash commands for Revenge (Vendetta-based Discord mobile client).

| Command | What it does |
|---|---|
| `/roll [dice]` | Dice roller — `d20`, `2d6`, `3d8+4`. Nat 20 / nat 1 callouts on single d20s |
| `/flip` | Coin flip (1-in-1000 chance it lands on its edge) |
| `/8ball <question>` | Magic 8-ball |
| `/choose <a \| b \| c>` | Picks one option (split by `\|` or `,`) |
| `/rate <thing>` | Rates anything out of 100 — same thing always gets the same score |
| `/ship <first> <second>` | Compatibility % plus a ship name |
| `/mock <text>` | sPoNgEbOb TeXt |
| `/clap <text>` | Adds 👏 between 👏 words (emoji is configurable) |
| `/reverse <text>` | Reverses text |
| `/tiny <text>` | ˢᵘᵖᵉʳˢᶜʳⁱᵖᵗ text |

## Settings
- **Private results** — game commands show their result only to you (as a local Clyde message) instead of sending it.
- **Clap emoji** — swap 👏 for anything.
- Toggle each command on/off; changes apply instantly.
- Tap **Try it out** for a random preview.

## Install
Drop the `PartyPack` folder into `plugins/` of a repo made from the
[vendetta plugin template](https://github.com/vendetta-mod/plugin-template) (same setup as Apex-Plugins),
push to `master`, and the GitHub Action builds and deploys it. Then paste
`https://<your-user>.github.io/<your-repo>/PartyPack/` into Revenge → Plugins.

To build locally: `pnpm i` (or `npm i --legacy-peer-deps`) then `node build.mjs`.
