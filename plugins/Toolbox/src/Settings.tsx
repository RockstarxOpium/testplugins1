import { React, ReactNative as RN } from "@vendetta/metro/common";
import { findByProps } from "@vendetta/metro";
import { storage } from "@vendetta/plugin";
import { useProxy } from "@vendetta/storage";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { showToast } from "@vendetta/ui/toasts";
import { TS_STYLES, humanDuration } from "./parsers";
import { cancelReminder, type Reminder, type Note } from "./index";

const { ScrollView } = findByProps("ScrollView");
const { TableRowGroup, TableRow, TableSwitchRow, Stack } = findByProps(
    "TableSwitchRow",
    "TableCheckboxRow",
    "TableRowGroup",
    "Stack",
    "TableRow"
);

const Trash = ({ onPress }: { onPress: () => void }) => (
    <RN.TouchableOpacity onPress={onPress}>
        <RN.Image source={getAssetIDByName("TrashIcon")} style={{ width: 20, height: 20, tintColor: "#ff4d4d" }} />
    </RN.TouchableOpacity>
);

export default function Settings() {
    useProxy(storage);
    const [, tick] = React.useReducer((x) => x + 1, 0);

    // keep the "in 5m" countdowns fresh while settings are open
    React.useEffect(() => {
        const t = setInterval(tick, 15_000);
        return () => clearInterval(t);
    }, []);

    const reminders: Reminder[] = [...storage.reminders].sort((a, b) => a.at - b.at);
    const notes: Note[] = storage.notes;

    return (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 10 }}>
            <Stack spacing={8}>
                <TableRowGroup title="🧰 Toolbox">
                    <TableRow
                        label="Commands"
                        subLabel="/timestamp · /remind · /reminders · /calc · /whois · /serverinfo · /snowflake · /note · /notes"
                    />
                    <TableRow
                        label="Private by default"
                        subLabel="Results only show to you. Add send:True to post them in chat."
                    />
                </TableRowGroup>

                <TableRowGroup title="Timestamps">
                    <TableSwitchRow
                        label="Copy to clipboard"
                        subLabel="/timestamp copies the code so you can paste it into your message"
                        value={!!storage.copyTimestamp}
                        onValueChange={(v: boolean) => (storage.copyTimestamp = v)}
                    />
                </TableRowGroup>

                <TableRowGroup title="Default timestamp style">
                    {Object.entries(TS_STYLES).map(([key, label]) => (
                        <TableRow
                            key={key}
                            label={label}
                            subLabel={`<t:…:${key}>`}
                            onPress={() => (storage.defaultStyle = key)}
                            trailing={
                                storage.defaultStyle === key ? (
                                    <RN.Image source={getAssetIDByName("Check")} style={{ width: 20, height: 20, tintColor: "#5865F2" }} />
                                ) : undefined
                            }
                        />
                    ))}
                </TableRowGroup>

                <TableRowGroup title={`Reminders (${reminders.length})`}>
                    {reminders.length === 0 ? (
                        <TableRow label="No reminders" subLabel="Set one with /remind 10m take a break" />
                    ) : (
                        reminders.map((r) => (
                            <TableRow
                                key={r.id}
                                label={r.text}
                                subLabel={`in ${humanDuration(r.at - Date.now())} · ${new Date(r.at).toLocaleString()}`}
                                trailing={
                                    <Trash
                                        onPress={() => {
                                            cancelReminder(r.id);
                                            showToast("Reminder cancelled", getAssetIDByName("Check"));
                                        }}
                                    />
                                }
                            />
                        ))
                    )}
                </TableRowGroup>

                <TableRowGroup title={`Notes (${notes.length})`}>
                    {notes.length === 0 ? (
                        <TableRow label="No notes" subLabel="Save one with /note" />
                    ) : (
                        notes.map((n, i) => (
                            <TableRow
                                key={`${n.at}-${i}`}
                                label={n.text}
                                subLabel={new Date(n.at).toLocaleString()}
                                trailing={
                                    <Trash
                                        onPress={() => {
                                            storage.notes = notes.filter((_, j) => j !== i);
                                            showToast("Note deleted", getAssetIDByName("Check"));
                                        }}
                                    />
                                }
                            />
                        ))
                    )}
                </TableRowGroup>
            </Stack>
        </ScrollView>
    );
}
