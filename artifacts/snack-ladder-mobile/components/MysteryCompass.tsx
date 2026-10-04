import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

type Power = "bomb" | "antiVenom" | "defuser" | "extraDice";
export interface MysteryCompassProps {
  square: number;
  size: number;
  canChoose: boolean;
  busy: boolean;
  onChoose: (power: Power) => void;
}

const DIRS: { power: Power; dir: string; label: string; blurb: string; icon: "bomb" | "shield-plus" | "wrench" | "dice-multiple" }[] = [
  { power: "bomb", dir: "North", label: "Bomb", blurb: "Plant in your current room", icon: "bomb" },
  { power: "antiVenom", dir: "East", label: "Anti-Venom", blurb: "Blocks one snake bite", icon: "shield-plus" },
  { power: "defuser", dir: "South", label: "Defuser Kit", blurb: "Disarms one bomb", icon: "wrench" },
  { power: "extraDice", dir: "West", label: "Extra Dice", blurb: "Bank one extra roll", icon: "dice-multiple" },
];
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Absolute overlay: render inside the board's positioned container of width/height `size`. */
export default function MysteryCompass({ square, size, canChoose, busy, onChoose }: MysteryCompassProps) {
  const colors = useColors();
  const [sel, setSel] = useState<Power | null>(null);
  const cell = size / 10;
  const rb = Math.floor((square - 1) / 10);
  const i = (square - 1) % 10;
  const col = rb % 2 === 0 ? i : 9 - i;
  const cx = col * cell + cell / 2;
  const cy = (9 - rb) * cell + cell / 2;
  const W = Math.min(300, size - 8);
  const H = Math.min(318, size - 8);
  const left = clamp(cx - W / 2, 4, size - W - 4);
  const top = clamp(cy - H / 2, 4, size - H - 4);
  const active = DIRS.find((d) => d.power === sel);
  const readOnly = !canChoose;
  const off = readOnly || busy;
  const tile = (p: (typeof DIRS)[number], pos: object) => {
    const on = sel === p.power;
    return (
      <Pressable key={p.power} testID={`choose-power-${p.power}`} accessibilityRole="button"
        accessibilityLabel={`${p.dir}: ${p.label}. ${p.blurb}`} accessibilityState={{ selected: on, disabled: off }}
        disabled={off} onPress={() => setSel(p.power)}
        style={[s.tile, pos, { backgroundColor: on ? colors.primary : colors.secondary, borderColor: on ? colors.foreground : colors.border, opacity: off && !on ? 0.7 : 1 }]}>
        <MaterialCommunityIcons name={p.icon} size={22} color={on ? colors.primaryForeground : colors.foreground} />
        <Text numberOfLines={1} style={[s.tileText, { color: on ? colors.primaryForeground : colors.foreground }]}>{p.label}</Text>
      </Pressable>
    );
  };
  const T = 92, G = 6, RH = 56;
  return (
    <>
      <View pointerEvents="none" style={[s.halo, { left: cx - cell * 0.5, top: cy - cell * 0.5, width: cell, height: cell, borderRadius: cell, borderColor: colors.primary }]} />
      <View testID="mystery-compass" accessibilityLabel={`Mystery room ${square} power choice`}
        style={[s.card, { left, top, width: W, height: H, backgroundColor: colors.card, borderColor: colors.primary }]}>
        <View style={{ height: RH * 3 + G * 2, width: T * 3 + G * 2, alignSelf: "center", maxWidth: "100%" }}>
          {tile(DIRS[0], { left: T + G, top: 0 })}
          {tile(DIRS[1], { left: (T + G) * 2, top: RH + G })}
          {tile(DIRS[2], { left: T + G, top: (RH + G) * 2 })}
          {tile(DIRS[3], { left: 0, top: RH + G })}
          <View style={[s.center, { left: T + G + 18, top: RH + G + 2, width: RH - 4, height: RH - 4, borderRadius: RH, borderColor: colors.primary }]}>
            <Text style={{ color: colors.primary, fontWeight: "800", fontSize: 18 }}>{square}</Text>
          </View>
        </View>
        <Text accessibilityLiveRegion="polite" style={[s.info, { color: colors.mutedForeground }]}>
          {readOnly ? "Spectating: the player is choosing a power." : active ? `${active.label} — ${active.blurb}` : "Select a power to see what it does."}
        </Text>
        <Pressable testID="get-mystery-power" accessibilityRole="button" accessibilityLabel={active ? `Get ${active.label}` : "Get power"}
          accessibilityState={{ disabled: off || !sel }} disabled={off || !sel} onPress={() => sel && onChoose(sel)}
          style={[s.get, { backgroundColor: off || !sel ? colors.muted : colors.primary }]}>
          <Text style={{ color: off || !sel ? colors.mutedForeground : colors.primaryForeground, fontWeight: "800", fontSize: 14 }}>
            {active ? `Get ${active.label}` : "Get"}
          </Text>
        </Pressable>
      </View>
    </>
  );
}

const s = StyleSheet.create({
  halo: { position: "absolute", borderWidth: 3, zIndex: 29 },
  card: { position: "absolute", zIndex: 30, borderWidth: 2, borderRadius: 14, padding: 8, gap: 6, justifyContent: "space-between", elevation: 12 },
  tile: { position: "absolute", width: 92, height: 56, minHeight: 44, borderWidth: 1, borderRadius: 10, alignItems: "center", justifyContent: "center", gap: 1 },
  tileText: { fontSize: 11, fontWeight: "700" },
  center: { position: "absolute", borderWidth: 2, borderStyle: "dashed", alignItems: "center", justifyContent: "center" },
  info: { fontSize: 12, textAlign: "center", minHeight: 32 },
  get: { minHeight: 44, borderRadius: 10, alignItems: "center", justifyContent: "center" },
});
