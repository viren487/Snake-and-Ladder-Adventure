import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { useColors } from "@/hooks/useColors";

type Point = { x: number; y: number };
export type Shot = { from: number; targets: (98 | 99)[] };
export const SHOT_DURATION_MS = 1000;

function Projectile({ from, target, index }: {
  from: Point;
  target: Point & { square: number };
  index: number;
}) {
  const colors = useColors();
  const progress = useSharedValue(0);
  const impact = useSharedValue(0);
  useEffect(() => {
    progress.value = 0;
    impact.value = 0;
    progress.value = withDelay(index * 100, withTiming(1, { duration: 420, easing: Easing.linear }));
    impact.value = withDelay(380 + index * 100, withTiming(1, { duration: 420 }));
  }, [progress, impact, index]);
  const projectileStyle = useAnimatedStyle(() => ({
    opacity: progress.value < 1 ? 1 : 0,
    transform: [
      { translateX: from.x + (target.x - from.x) * progress.value - 5 },
      { translateY: from.y + (target.y - from.y) * progress.value - 5 },
    ],
  }));
  const impactStyle = useAnimatedStyle(() => ({
    opacity: impact.value > 0 ? 1 - impact.value : 0,
    transform: [{ scale: 0.5 + impact.value * 1.5 }],
  }));
  return (
    <>
      <Animated.View testID={`shot-projectile-${target.square}`} style={[styles.projectile,
        { backgroundColor: colors.primary, borderColor: colors.dieFace }, projectileStyle]} />
      <Animated.View testID={`shot-impact-${target.square}`}
        style={[styles.impact, { left: target.x - 24, top: target.y - 24 }, impactStyle]}>
        <Text style={[styles.star, { color: colors.primary }]}>✹</Text>
        <Text style={[styles.hit, { color: colors.primaryForeground }]}>HIT!</Text>
      </Animated.View>
    </>
  );
}

export function ShotAnimation({ from, targets }: { from: Point; targets: (Point & { square: number })[] }) {
  return (
    <View pointerEvents="none" style={styles.layer} testID="shot-animation" accessibilityElementsHidden>
      {targets.map((target, index) => <Projectile key={target.square} from={from} target={target} index={index} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFill, zIndex: 30 },
  projectile: { position: "absolute", width: 10, height: 10, borderRadius: 5, borderWidth: 2 },
  impact: { position: "absolute", width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  star: { fontSize: 46, position: "absolute" },
  hit: { fontSize: 10, fontWeight: "900" },
});