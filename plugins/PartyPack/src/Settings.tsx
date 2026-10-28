import { React } from "@vendetta/metro/common";
import { findByProps } from "@vendetta/metro";
import { storage } from "@vendetta/plugin";
import { useProxy } from "@vendetta/storage";
import { showToast } from "@vendetta/ui/toasts";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { COMMANDS, refreshCommands } from "./index";
import * as gen from "./commands";

const { ScrollView } = findByProps("ScrollView");
const { TableRowGroup, TableRow, TableSwitchRow, Stack, TextInput } = findByProps(
    "TableSwitchRow",
    "TableCheckboxRow",
    "TableRowGroup",
    "Stack",
    "TableRow"
);

export default function Settings() {
    useProxy(storage);
    const [preview, setPreview] = React.useState(gen.roll("1d20"));

    const toggleCommand = (name: string, enabled: boolean) => {
        storage.disabled = enabled
            ? storage.disabled.filter((n: string) => n !== name)
            : [...storage.disabled, name];
        refreshCommands();
    };

    const games = COMMANDS.filter((c) => c.kind === "game");
    const text = COMMANDS.filter((c) => c.kind === "text");

    return (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 10 }}>
            <Stack spacing={8}>
                <TableRowGroup title="🎉 Party Pack">
                    <TableRow
                        label="Try it out"
                        subLabel={preview}
                        trailing={<TableRow.Arrow />}
                        onPress={() => {
                            const samples = [
                                () => gen.roll("1d20"),
                                () => gen.flip(),
                                () => gen.eightBall("Is this plugin cool?"),
                                () => gen.rate("this plugin"),
                                () => gen.mock("tap me again"),
                                () => gen.tiny("tiny text"),
                            ];
                            setPreview(samples[Math.floor(Math.random() * samples.length)]());
                        }}
                    />
                </TableRowGroup>

                <TableRowGroup title="Behaviour">
                    <TableSwitchRow
                        label="Private results"
                        subLabel="Game commands (roll, flip, 8ball…) show results only to you instead of sending them"
                        value={!!storage.privateResults}
                        onValueChange={(v: boolean) => (storage.privateResults = v)}
                    />
                </TableRowGroup>

                <TableRowGroup title="Clap emoji">
                    <Stack spacing={4}>
                        <TextInput
                            placeholder="👏"
                            value={storage.clapEmoji}
                            onChange={(v: string) => (storage.clapEmoji = v)}
                            isClearable
                            returnKeyType="done"
                            onSubmitEditing={() =>
                                showToast(`Clap emoji set to ${storage.clapEmoji || "👏"}`, getAssetIDByName("Check"))
                            }
                        />
                    </Stack>
                </TableRowGroup>

                <TableRowGroup title="Game commands">
                    {games.map((c) => (
                        <TableSwitchRow
                            key={c.name}
                            label={`/${c.name}`}
                            subLabel={c.description}
                            value={!storage.disabled.includes(c.name)}
                            onValueChange={(v: boolean) => toggleCommand(c.name, v)}
                        />
                    ))}
                </TableRowGroup>

                <TableRowGroup title="Text commands">
                    {text.map((c) => (
                        <TableSwitchRow
                            key={c.name}
                            label={`/${c.name}`}
                            subLabel={c.description}
                            value={!storage.disabled.includes(c.name)}
                            onValueChange={(v: boolean) => toggleCommand(c.name, v)}
                        />
                    ))}
                </TableRowGroup>
            </Stack>
        </ScrollView>
    );
}
