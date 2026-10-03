import React from "react";
import { View } from "react-native";
import Svg, { Defs, G, LinearGradient, Path, Rect, Stop } from "react-native-svg";

const TOP = 50;
const BOTTOM = 948;
const X = 24;
const nodes = Array.from({ length: 10 }, (_, i) => TOP + 40 + i * ((BOTTOM - TOP - 80) / 9));
const halfW = (y: number) => 9 + ((y - TOP) / (BOTTOM - TOP)) * 7;

function Leaf({ x, y, a, s }: { x: number; y: number; a: number; s: number }) {
  return (
    <G transform={`translate(${x} ${y}) rotate(${a}) scale(${s})`}>
      <Path d="M0 0C10 -6 30 -6 46 0C30 6 10 6 0 0Z" fill="url(#bm-leaf)" stroke="#2f5a22" strokeWidth={0.8} />
    </G>
  );
}

export default function BambooReturnArt({ size, active }: { size: number; active: boolean }) {
  const d = `M${X - 9} ${TOP} L${X + 9} ${TOP} L${X + 16} ${BOTTOM} L${X - 16} ${BOTTOM}Z`;
  return (
    <View pointerEvents="none" testID="bamboo-return-path" accessible accessibilityLabel="Bamboo path from 100 to Home"
      style={{ position: "absolute", left: -size / 10, top: 0, width: size / 10, height: size, zIndex: 4, overflow: "hidden" }}>
      <Svg width={size / 10} height={size} viewBox="0 0 100 1000">
        <Defs>
          <LinearGradient id="bm-stalk" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#4d6b1f" /><Stop offset="0.3" stopColor="#a7bf4a" />
            <Stop offset="0.55" stopColor="#7d9a2e" /><Stop offset="1" stopColor="#3a5217" />
          </LinearGradient>
          <LinearGradient id="bm-node" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#5c4a1c" /><Stop offset="0.4" stopColor="#c2a64f" /><Stop offset="1" stopColor="#4a3a14" />
          </LinearGradient>
          <LinearGradient id="bm-leaf" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#4f8a2f" /><Stop offset="1" stopColor="#9bc34a" />
          </LinearGradient>
        </Defs>
        <G transform="translate(40 0)">
        {active && <Path d={d} fill="none" stroke="#f6d86a" strokeWidth={9} strokeLinejoin="round" opacity={0.7} />}
        <Path d={d} fill="url(#bm-stalk)" stroke="#33481a" strokeWidth={1.5} />
        <Path d={`M${X - 3} ${TOP + 6} L${X - 4} ${BOTTOM - 6}`} stroke="#e4efa6" strokeWidth={2} opacity={0.45} strokeLinecap="round" />
        {nodes.map((y, i) => {
          const w = halfW(y) + 3;
          return <Rect key={i} x={X - w} y={y - 4} width={w * 2} height={8} rx={4} fill="url(#bm-node)" stroke="#3b2d0e" strokeWidth={0.8} />;
        })}
        {[[-30, 0.9], [-10, 1], [15, 0.9], [38, 0.8], [200, 0.8], [165, 0.9]].map(([a, s], i) => (
          <Leaf key={`t${i}`} x={X + 6} y={TOP + 64 + (i % 2) * 6} a={a} s={s} />
        ))}
        {[[-20, 0.8], [20, 0.8], [160, 0.7]].map(([a, s], i) => <Leaf key={`m${i}`} x={X + 12} y={nodes[4] + 2} a={a} s={s} />)}
        {[[-15, 0.8], [25, 0.8], [170, 0.7]].map(([a, s], i) => <Leaf key={`l${i}`} x={X + 14} y={nodes[7] + 2} a={a} s={s} />)}
        </G>
      </Svg>
    </View>
  );
}
