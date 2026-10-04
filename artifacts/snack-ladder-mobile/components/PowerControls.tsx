import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

export type PowerKind = "bomb" | "antiVenom" | "defuser" | "extraDice";
export interface PowerControlsProps {
  position: number;
  detonationBombs: { id: string; square: number; ownerName: string }[];
  detonationDisabled: boolean;
  playerName: string;
  powers: Record<PowerKind, number>;
  pending: { kind: "mystery" | "snake" | "bomb"; square: number } | null;
  bombs: { id: string; square: number; ownerName: string; owned: boolean; ready: boolean }[];
  busy: boolean;
  actionsEnabled: boolean;
  extraRollCredits: number;
  onChoose: (power: PowerKind) => void;
  onDefense: (use: boolean) => void;
  onPlant: (square: number) => void;
  onDetonate: (id: string) => void;
  onExtraDice: () => void;
}

const LABELS: Record<PowerKind, string> = { bomb: "Bomb", antiVenom: "Anti-Venom", defuser: "Defuser Kit", extraDice: "Extra Dice" };
const BLURB: Record<PowerKind, string> = {
  bomb: "Plant in your current room",
  antiVenom: "Blocks one snake bite",
  defuser: "Disarms one bomb",
  extraDice: "Bank one extra roll",
};
const ORDER: PowerKind[] = ["bomb", "antiVenom", "defuser", "extraDice"];
const ICONS: Record<PowerKind, "bomb" | "shield-plus" | "wrench" | "dice-multiple"> = {
  bomb: "bomb",
  antiVenom: "shield-plus",
  defuser: "wrench",
  extraDice: "dice-multiple",
};

export function PowerControls({ position, detonationBombs, detonationDisabled, playerName, powers, pending, bombs, busy, actionsEnabled, extraRollCredits, onChoose, onDefense, onPlant, onDetonate, onExtraDice }: PowerControlsProps) {
  const colors = useColors();
  const [plantOpen, setPlantOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [info, setInfo] = useState<PowerKind | null>(null);
  const inventoryOk = !busy && actionsEnabled && !pending;
  const canPlant = inventoryOk && powers.bomb > 0 && position >= 1 && position <= 100 && !bombs.some((bomb) => bomb.square === position);

  const plant = () => {
    if (!canPlant) return;
    onPlant(position);
    setPlantOpen(false);
  };
  const Btn = ({ label, text, sub, onPress, disabled, testID, gold }: { label: string; text: string; sub?: string; onPress: () => void; disabled: boolean; testID: string; gold?: boolean }) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={[
        styles.btn,
        { backgroundColor: gold ? colors.primary : colors.secondary, borderColor: gold ? colors.primary : colors.border, opacity: disabled ? 0.45 : 1 },
      ]}
    >
      <Text style={[styles.btnText, { color: gold ? colors.primaryForeground : colors.foreground }]}>{text}</Text>
      {sub ? <Text style={[styles.sub, { color: gold ? colors.primaryForeground : colors.mutedForeground }]}>{sub}</Text> : null}
    </Pressable>
  );

  const defenseKind: PowerKind = pending?.kind === "snake" ? "antiVenom" : "defuser";
  const hasDefense = pending && pending.kind !== "mystery" ? powers[defenseKind] > 0 : false;
  const readyBombs = detonationBombs;
  const otherBombs = bombs.filter((b) => !(b.owned && b.ready));

  const Ico = ({ kind, label, onPress, disabled, testID, active }: { kind: PowerKind; label: string; onPress: () => void; disabled?: boolean; testID: string; active?: boolean }) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, expanded: active }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={[styles.ico, { backgroundColor: active ? colors.secondary : colors.muted, borderColor: active ? colors.primary : colors.border, opacity: disabled ? 0.4 : 1 }]}
    >
      <MaterialCommunityIcons name={ICONS[kind]} size={22} color={colors.primary} />
      <View style={[styles.badge, { backgroundColor: powers[kind] ? colors.primary : colors.border }]} testID={`power-count-${kind}`} accessibilityLabel={`${LABELS[kind]} count ${powers[kind]}`}>
        <Text style={[styles.badgeText, { color: colors.primaryForeground }]}>{powers[kind]}</Text>
      </View>
    </Pressable>
  );

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]} testID="power-controls" accessibilityLabel={`${playerName}'s powers`}>
      <Text style={[styles.copy, { color: colors.mutedForeground, fontSize: 10 }]}>{playerName} · Powers</Text>
      {pending && pending.kind !== "mystery" && (
        <View style={styles.block}>
          <View style={styles.titleRow}>
            <MaterialCommunityIcons name={pending.kind === "snake" ? "snake" : "bomb"} size={18} color={colors.primary} />
            <Text style={[styles.title, { color: colors.foreground }]}>
              {pending.kind === "snake" ? `Snake bite on ${pending.square}` : `Bomb on ${pending.square}`}
            </Text>
          </View>
          <Text style={[styles.copy, { color: colors.mutedForeground }]}>
            {pending.kind === "snake"
              ? "Spend one Anti-Venom to avoid this bite, or slide down."
              : pending.square === 97
                ? "Permanent boom trap. Defuse it, or decline and return Home."
                : "Rival bomb. Defuse it, or decline and stay in danger."}
          </Text>
          <View style={styles.grid}>
            <Btn gold label={pending.kind === "snake" ? "Use Anti-Venom" : "Use Defuser Kit"} text={pending.kind === "snake" ? "Use Anti-Venom" : "Use Defuser"}
              disabled={busy || !hasDefense} onPress={() => onDefense(true)} testID="use-defense" />
            <Btn label={pending.kind === "snake" ? "Decline and slide" : "Decline defuse"}
              text={pending.kind === "snake" ? "Slide down" : pending.square === 97 ? "Decline, go Home" : "Decline"}
              disabled={busy} onPress={() => onDefense(false)} testID="decline-defense" />
          </View>
        </View>
      )}

      <View style={styles.bar} accessibilityRole="toolbar" accessibilityLabel="Power stash">
        <Ico kind="bomb" testID="power-toggle-bomb" active={plantOpen} disabled={busy || (!plantOpen && !canPlant)}
          label={`Bomb: ${powers.bomb}. Plant a bomb`} onPress={() => setPlantOpen((o) => !o)} />
        <Ico kind="antiVenom" testID="power-info-antiVenom" active={info === "antiVenom"}
          label={`Anti-Venom: ${powers.antiVenom}. Used from a hazard prompt`} onPress={() => setInfo((c) => (c === "antiVenom" ? null : "antiVenom"))} />
        <Ico kind="defuser" testID="power-info-defuser" active={info === "defuser"}
          label={`Defuser Kit: ${powers.defuser}. Used from a hazard prompt`} onPress={() => setInfo((c) => (c === "defuser" ? null : "defuser"))} />
        <Ico kind="extraDice" testID="use-extra-dice" active={extraRollCredits > 0} disabled={!inventoryOk || powers.extraDice < 1}
          label={`Use Extra Dice, ${powers.extraDice} left`} onPress={onExtraDice} />
        {extraRollCredits > 0 && (
          <Text style={[styles.credit, { color: colors.primary, borderColor: colors.primary }]} testID="extra-roll-credits"
            accessibilityLabel={`Armed extra rolls: ${extraRollCredits}`} accessibilityLiveRegion="polite">+{extraRollCredits} roll</Text>
        )}
        {readyBombs.map((b) => (
          <Pressable key={b.id} accessibilityRole="button" accessibilityLabel={`${b.ownerName}: Use bomb in room ${b.square}`}
            accessibilityState={{ disabled: detonationDisabled }} disabled={detonationDisabled}
            onPress={() => onDetonate(b.id)} testID={`detonate-bomb-${b.id}`}
            style={[styles.chip, { backgroundColor: colors.primary, opacity: detonationDisabled ? 0.45 : 1 }]}>
            <MaterialCommunityIcons name="bomb" size={16} color={colors.primaryForeground} />
            <Text style={[styles.btnText, { color: colors.primaryForeground }]}>{b.ownerName}: Use bomb · {b.square}</Text>
          </Pressable>
        ))}
        {otherBombs.length > 0 && (
          <Pressable accessibilityRole="button" accessibilityLabel={`Planted bombs: ${otherBombs.length}`}
            accessibilityState={{ expanded: listOpen }} onPress={() => setListOpen((o) => !o)} testID="toggle-bomb-list"
            style={[styles.ico, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <MaterialCommunityIcons name="format-list-bulleted" size={20} color={colors.primary} />
          </Pressable>
        )}
      </View>

      {info ? <Text style={[styles.copy, { color: colors.mutedForeground }]}>{LABELS[info]}: {BLURB[info]}. Used only from a hazard prompt when you land on one.</Text> : null}

      {plantOpen && (<View style={styles.row}>
        <Text style={[styles.copy, {color: colors.foreground}]}>Current room: {position || "Home"}</Text>
        <Btn gold label={`Plant bomb in room ${position}`} text={`Plant here · ${position}`} disabled={!canPlant} onPress={plant} testID="plant-bomb" />
      </View>)}

      {listOpen && otherBombs.map((b) => (
        <View key={b.id} style={[styles.bombRow, { backgroundColor: colors.muted }]} testID={`bomb-row-${b.id}`}>
          <Text style={[styles.copy, { color: colors.foreground }]}>
            House {b.square} · {b.owned ? "yours, waiting for rival" : b.ownerName}
          </Text>
        </View>
      ))}
    </View>
  );
}

export default PowerControls;

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 14, padding: 10, gap: 8 },
  block: { gap: 8 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontSize: 15, fontWeight: "700" },
  copy: { fontSize: 12, lineHeight: 17 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  btn: { minHeight: 44, minWidth: 110, flexGrow: 1, flexBasis: "45%", paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderRadius: 11, justifyContent: "center" },
  btnText: { fontSize: 13, fontWeight: "700" },
  sub: { fontSize: 10, marginTop: 2 },
  bar: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },
  ico: { width: 44, height: 44, borderWidth: 1, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  badge: { position: "absolute", right: -5, top: -6, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, alignItems: "center", justifyContent: "center" },
  badgeText: { fontSize: 10, fontWeight: "800" },
  credit: { fontSize: 11, fontWeight: "700", borderWidth: 1, borderRadius: 9, paddingHorizontal: 8, paddingVertical: 3 },
  chip: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, borderRadius: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  input: { flex: 1, minHeight: 44, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, fontSize: 15 },
  bombRow: { padding: 8, borderRadius: 9 },
});
