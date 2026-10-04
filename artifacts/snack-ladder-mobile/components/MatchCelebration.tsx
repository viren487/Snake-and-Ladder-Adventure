import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import Svg, { Circle, Ellipse, G, Path } from "react-native-svg";

export type CelebrationPlayer = { id: string; name: string; color: string };
type Props = { players: CelebrationPlayer[]; winnerIds: string[]; loserId: string | null };
const ORD = ["1st", "2nd", "3rd", "4th"];
const SCARF: Record<string, [string, string]> = { blue: ["#25a9df", "#0879ad"], coral: ["#f06e50", "#c44839"], green:["#36ba7b","#168353"], purple:["#ad78ea","#714cba"] };

function Panda({ color, sad }: { color: string; sad: boolean }) {
  const [scarf, shade] = SCARF[color] ?? [color, color];
  const eye = sad ? 2.8 : 2.3;
  return (
    <Svg width={84} height={100} viewBox="0 0 52 62">
      <Ellipse cx="26" cy="57" rx="14" ry="3" fill="#10151b" opacity={0.4} />
      <Ellipse cx="26" cy="47" rx="15" ry="11" fill={scarf} stroke="#473523" strokeWidth="1.5" />
      <Path d="M13 44q13 8 26 0v6q-13 9-26 0Z" fill={shade} />
      <Circle cx="12" cy="17" r="8" fill="#24252a" />
      <Circle cx="40" cy="17" r="8" fill="#24252a" />
      <Circle cx="12" cy="17" r="3.2" fill="#efb7ad" />
      <Circle cx="40" cy="17" r="3.2" fill="#efb7ad" />
      <Path d="M8 28c0-12 7-20 18-20s18 8 18 20c0 11-7 18-18 18S8 39 8 28Z" fill="#fff7e8" stroke="#55412f" strokeWidth="1.5" />
      <Ellipse cx="17" cy="26" rx="5.6" ry="7.3" fill="#28282b" transform="rotate(18 17 26)" />
      <Ellipse cx="35" cy="26" rx="5.6" ry="7.3" fill="#28282b" transform="rotate(-18 35 26)" />
      <Circle cx="18.4" cy="25.8" r={eye} fill="#fffdf5" />
      <Circle cx="33.6" cy="25.8" r={eye} fill="#fffdf5" />
      <Circle cx="18.8" cy={sad ? 27 : 26} r="1.3" fill="#18191c" />
      <Circle cx="33.2" cy={sad ? 27 : 26} r="1.3" fill="#18191c" />
      <Ellipse cx="26" cy="34" rx="8.2" ry="5.7" fill="#fffdf5" stroke="#dfd5c5" strokeWidth=".7" />
      <Path d="M23 32q3-2 6 0-1.5 3.2-3 3.2T23 32Z" fill="#352724" />
      {sad ? <Path d="M22 40q4-3 8 0" fill="none" stroke="#43312a" strokeWidth="1.3" strokeLinecap="round" />
        : <Path d="M22 37q4 5 8 0Z" fill="#a8453b" stroke="#43312a" strokeWidth="1" />}
      <Circle cx="12" cy="35" r="2" fill="#ee9989" opacity={0.65} />
      <Circle cx="40" cy="35" r="2" fill="#ee9989" opacity={0.65} />
      {sad ? <Path d="M13 19l9 3M39 19l-9 3" stroke="#3b3028" strokeWidth="1.4" strokeLinecap="round" />
        : <G fill="#fff7e8" stroke="#55412f" strokeWidth="1.2">
          <Ellipse cx="6" cy="40" rx="4" ry="7" transform="rotate(-25 6 40)" />
          <Ellipse cx="46" cy="40" rx="4" ry="7" transform="rotate(25 46 40)" />
        </G>}
    </Svg>
  );
}

function Tear({ left, delay, still }: { left: number; delay: number; still: boolean }) {
  const t = useSharedValue(0);
  useEffect(() => {
    if (still) { t.value = 0.3; return; }
    t.value = withDelay(delay, withRepeat(withTiming(1, { duration: 1200, easing: Easing.in(Easing.quad) }), -1, false));
    return () => cancelAnimation(t);
  }, [still, delay, t]);
  const style = useAnimatedStyle(() => ({ opacity: still ? 1 : 1 - t.value, transform: [{ translateY: t.value * 28 }] }));
  return <Animated.View style={[styles.tear, { left }, style]} />;
}

function Figure({ p, sad, label, index }: { p: CelebrationPlayer; sad: boolean; label: string; index: number }) {
  const reduced = useReducedMotion();
  const m = useSharedValue(0);
  useEffect(() => {
    if (reduced) { m.value = 0; return; }
    m.value = sad
      ? withRepeat(withSequence(withTiming(1, { duration: 550 }), withTiming(0, { duration: 550 })), -1)
      : withDelay(index * 110, withRepeat(withSequence(withTiming(1, { duration: 350 }), withTiming(-1, { duration: 350 })), -1, true));
    return () => cancelAnimation(m);
  }, [reduced, sad, index, m]);
  const style = useAnimatedStyle(() => sad
    ? { transform: [{ translateY: m.value * 4 }, { rotate: `${m.value * -3}deg` }] }
    : { transform: [{ translateY: -Math.abs(m.value) * 12 }, { rotate: `${m.value * 9}deg` }] });
  return (
    <View style={[styles.card, sad && styles.cardSad]} accessible accessibilityLabel={`${p.name}, ${label}${sad ? ", crying" : ", dancing"}`} testID={`celebration-${p.id}`}>
      <Animated.View style={[styles.panda, style]}>
        <Panda color={p.color} sad={sad} />
        {sad && <><Tear left={26} delay={0} still={reduced} /><Tear left={52} delay={600} still={reduced} /></>}
      </Animated.View>
      <Text style={styles.name} numberOfLines={2}>{p.name}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

export function MatchCelebration({ players, winnerIds, loserId }: Props) {
  const winners = winnerIds.map((id) => players.find((p) => p.id === id)).filter((p): p is CelebrationPlayer => !!p);
  const loser = players.find((p) => p.id === loserId);
  const cast = winners.map((p, i) => ({ p, sad: false, label: `${ORD[i]} · Winner` }));
  if (loser) cast.push({ p: loser, sad: true, label: `${ORD[winners.length] ?? "Last"} · Last place` });
  return (
    <View style={styles.root} accessibilityRole="summary" accessibilityLiveRegion="polite" testID="match-celebration">
      <Text style={styles.title} accessibilityRole="header">Match over!</Text>
      <View style={styles.row}>
        {cast.map((c, i) => <Figure key={c.p.id} index={i} {...c} />)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { marginTop: 14, padding: 12, borderRadius: 18, backgroundColor: "#fff3cf", borderWidth: 3, borderColor: "#f3bd42", alignItems: "center" },
  title: { fontSize: 22, fontWeight: "800", color: "#3d2a17", marginBottom: 8 },
  row: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 10 },
  card: { width: "46%", maxWidth: 150, alignItems: "center", paddingVertical: 8, paddingHorizontal: 4, borderRadius: 14, backgroundColor: "#fffaf0", borderWidth: 2, borderColor: "#e3c47a" },
  cardSad: { backgroundColor: "#e7eef3", borderColor: "#8aa5b8" },
  panda: { width: 84, height: 100 },
  tear: { position: "absolute", top: 46, width: 7, height: 10, borderRadius: 5, backgroundColor: "#7fd3f5", borderWidth: 1, borderColor: "#2d87b3" },
  name: { fontSize: 16, fontWeight: "700", color: "#3d2a17", textAlign: "center" },
  label: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase", color: "#5b4630", textAlign: "center" },
});

export default MatchCelebration;
