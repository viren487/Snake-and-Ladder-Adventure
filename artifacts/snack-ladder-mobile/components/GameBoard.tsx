import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Circle, Path } from 'react-native-svg';
import Animated, {
  Easing,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import type { GameState, MysteryPowerType, ShootableSnakeSquare } from '@workspace/game-core';
import { BOOM_SQUARE, BULLET_PICKUP_SQUARES, GUN_SQUARES, KEY_SQUARES, LADDERS, MYSTERY_BOX_SQUARES, SNAKES, SHOOTABLE_SNAKE_SQUARES, squareAt } from '@workspace/game-core';
import { useColors } from '@/hooks/useColors';

export type BoardBlast = {
  id: number;
  sourceSquare: number;
  victims: { playerId: string; fromSquare: number }[];
};

type Props = {
  game: GameState;
  selectedTargets?: readonly ShootableSnakeSquare[];
  onSelectTarget?: (square: ShootableSnakeSquare) => void;
  bombBlast?: BoardBlast | null;
  mysterySquare?: number | null;
  mysteryCanChoose?: boolean;
  mysteryBusy?: boolean;
  onChooseMystery?: (power: MysteryPowerType) => void;
};

const MYSTERY_POWER_OPTIONS: {
  power: MysteryPowerType;
  label: string;
  shortLabel: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
}[] = [
  { power: 'bomb', label: 'Bomb', shortLabel: 'Bomb', icon: 'bomb' },
  { power: 'antiVenom', label: 'Anti-Venom', shortLabel: 'A/V', icon: 'shield-plus' },
  { power: 'defuser', label: 'Defuser Kit', shortLabel: 'Kit', icon: 'wrench' },
  { power: 'webShooter', label: 'Web Shooter', shortLabel: 'Web', icon: 'spider-web' },
  { power: 'knife', label: 'Knife', shortLabel: 'Knife', icon: 'knife' },
];

function MysteryPowerTray({
  square,
  canChoose,
  busy,
  onChoose,
}: {
  square: number;
  canChoose: boolean;
  busy: boolean;
  onChoose?: (power: MysteryPowerType) => void;
}) {
  const colors = useColors();
  const [selected, setSelected] = React.useState<MysteryPowerType | null>(null);
  React.useEffect(() => { setSelected(null); }, [square]);
  const active = MYSTERY_POWER_OPTIONS.find((option) => option.power === selected);

  return (
    <View style={[styles.mysteryTray, { backgroundColor: colors.boardDark, borderColor: colors.boardFrameLight }]} testID="mystery-power-tray">
      <Text style={[styles.mysteryTrayTitle, { color: colors.primary }]}>
        {canChoose ? `BOX ${square} · CHOOSE ONE` : `BOX ${square} · WAITING`}
      </Text>
      <View style={styles.mysteryPowerRow}>
        {MYSTERY_POWER_OPTIONS.map((option) => {
          const isSelected = selected === option.power;
          return (
            <Pressable
              key={option.power}
              accessibilityRole="button"
              accessibilityLabel={`Choose ${option.label}`}
              accessibilityState={{ selected: isSelected, disabled: !canChoose || busy }}
              disabled={!canChoose || busy}
              onPress={() => setSelected(option.power)}
              style={[
                styles.mysteryPowerOption,
                { backgroundColor: isSelected ? colors.primary : colors.card, borderColor: isSelected ? colors.accent : colors.border },
              ]}
              testID={`mystery-option-${option.power}`}
            >
              <MaterialCommunityIcons name={option.icon} size={16} color={isSelected ? colors.primaryForeground : colors.foreground} />
              <Text style={[styles.mysteryPowerLabel, { color: isSelected ? colors.primaryForeground : colors.mutedForeground }]} numberOfLines={1}>
                {option.shortLabel}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.mysteryTrayFooter}>
        <Text style={[styles.mysterySelectedLabel, { color: colors.foreground }]} numberOfLines={1}>
          {active?.label ?? 'Pick a power'}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={active ? `Get ${active.label}` : 'Choose a power first'}
          disabled={!canChoose || busy || !selected}
          onPress={() => selected && onChoose?.(selected)}
          style={[styles.mysteryGetButton, { backgroundColor: selected ? colors.primary : colors.muted }]}
          testID="get-mystery-power"
        >
          <Text style={[styles.mysteryGetLabel, { color: selected ? colors.primaryForeground : colors.mutedForeground }]}>GET</Text>
        </Pressable>
      </View>
    </View>
  );
}

function centerForSquare(square: number) {
  for (let row = 0; row < 10; row += 1) {
    for (let column = 0; column < 10; column += 1) {
      if (squareAt(row, column) === square) {
        return { x: column * 100 + 50, y: row * 100 + 50, row, column };
      }
    }
  }
  return { x: 50, y: 950, row: 9, column: 0 };
}

function tileMarker(square: number) {
  if ((KEY_SQUARES as readonly number[]).includes(square)) return 'KEY';
  if ((BULLET_PICKUP_SQUARES as readonly number[]).includes(square)) return '+1';
  if ((MYSTERY_BOX_SQUARES as readonly number[]).includes(square)) return '?';
  if ((GUN_SQUARES as readonly number[]).includes(square)) return 'GUN';
  if (square === BOOM_SQUARE) return '!';
  if (square === 100) return 'CROWN';
  if (SNAKES.some((item) => item.from === square)) return 'S';
  if (LADDERS.some((item) => item.from === square)) return 'L';
  return '';
}

function tokenColor(color: string, colors: ReturnType<typeof useColors>) {
  switch (color) {
    case 'coral': return colors.tokenCoral;
    case 'green': return colors.tokenGreen;
    case 'purple': return colors.tokenPurple;
    default: return colors.tokenBlue;
  }
}

function PandaToken({ color }: { color: string }) {
  const colors = useColors();
  return (
    <View style={[styles.token, { backgroundColor: tokenColor(color, colors), borderColor: colors.foreground }]}>
      <View style={[styles.earLeft, { backgroundColor: colors.boardDark }]} />
      <View style={[styles.earRight, { backgroundColor: colors.boardDark }]} />
      <View style={[styles.face, { backgroundColor: colors.foreground }]}>
        <View style={[styles.eyeLeft, { backgroundColor: colors.boardDark }]} />
        <View style={[styles.eyeRight, { backgroundColor: colors.boardDark }]} />
      </View>
    </View>
  );
}

function HomecomingPanda({
  color,
  fromSquare,
  boardSize,
  delay,
  animationId,
}: {
  color: string;
  fromSquare: number;
  boardSize: number;
  delay: number;
  animationId: number;
}) {
  const progress = useSharedValue(0);
  const from = centerForSquare(fromSquare);
  const home = { x: 70, y: 948 };

  React.useEffect(() => {
    if (boardSize <= 0) return;
    progress.value = 0;
    progress.value = withDelay(delay, withTiming(1, {
      duration: 2350,
      easing: Easing.out(Easing.cubic),
    }));
  }, [animationId, boardSize, delay, progress]);

  const motionStyle = useAnimatedStyle(() => {
    const amount = progress.value;
    const sway = Math.sin(amount * Math.PI * 3) * boardSize * 0.018;
    return {
      opacity: interpolate(amount, [0, 0.8, 1], [1, 1, 0]),
      transform: [
        { translateX: ((from.x + (home.x - from.x) * amount) / 1000) * boardSize - 12 + sway },
        { translateY: ((from.y + (home.y - from.y) * amount) / 1000) * boardSize - 14 + sway * 0.55 },
        { rotate: `${amount * 1080}deg` },
        { scale: interpolate(amount, [0, 0.36, 0.76, 1], [1, 1.18, 1.04, 0.72]) },
      ],
    };
  });

  return (
    <Animated.View pointerEvents="none" style={[styles.homecomingPanda, motionStyle]}>
      <PandaToken color={color} />
    </Animated.View>
  );
}

function BlastRing({
  progress,
  delay,
  color,
}: {
  progress: SharedValue<number>;
  delay: number;
  color: string;
}) {
  const ringStyle = useAnimatedStyle(() => {
    const amount = Math.max(0, Math.min(1, (progress.value - delay) / (1 - delay)));
    return {
      opacity: interpolate(amount, [0, 0.12, 0.72, 1], [0, 0.9, 0.42, 0]),
      transform: [{ scale: interpolate(amount, [0, 1], [0.25, 3.7]) }],
    };
  });

  return <Animated.View pointerEvents="none" style={[styles.blastRing, { borderColor: color }, ringStyle]} />;
}

function BombBlastVisual({ blast }: { blast: BoardBlast }) {
  const colors = useColors();
  const progress = useSharedValue(0);
  const source = centerForSquare(blast.sourceSquare);
  const row = Math.floor(source.y / 100);
  const column = Math.floor(source.x / 100);
  const flashStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.08, 0.2, 0.38, 1], [0, 0.48, 0.18, 0, 0]),
  }));
  const coreStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.12, 0.42, 0.8, 1], [0, 0.95, 0.55, 0.16, 0]),
    transform: [{ scale: interpolate(progress.value, [0, 0.16, 0.48, 1], [0.25, 1.2, 1.8, 2.6]) }],
  }));

  React.useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(1, { duration: 1250, easing: Easing.out(Easing.cubic) });
  }, [blast.id, progress]);

  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: colors.destructive }, flashStyle]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.blastCell,
          { left: `${column * 10}%`, top: `${row * 10}%` },
        ]}
      >
        <BlastRing progress={progress} delay={0} color={colors.destructive} />
        <BlastRing progress={progress} delay={0.16} color={colors.primary} />
        <BlastRing progress={progress} delay={0.31} color={colors.foreground} />
        <Animated.View style={[styles.blastCore, { backgroundColor: colors.destructive }, coreStyle]} />
      </View>
    </>
  );
}

export function GameBoard({
  game,
  selectedTargets = [],
  onSelectTarget,
  bombBlast = null,
  mysterySquare = null,
  mysteryCanChoose = false,
  mysteryBusy = false,
  onChooseMystery,
}: Props) {
  const colors = useColors();
  const [boardSize, setBoardSize] = React.useState(0);
  const shake = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shake.value }],
  }));
  React.useEffect(() => {
    if (!bombBlast) return;
    shake.value = 0;
    shake.value = withSequence(
      withTiming(-6, { duration: 45 }),
      withTiming(7, { duration: 55 }),
      withTiming(-5, { duration: 55 }),
      withTiming(3, { duration: 65 }),
      withTiming(0, { duration: 110 }),
    );
  }, [bombBlast?.id, shake]);
  const cells = Array.from({ length: 100 }, (_, index) => {
    const row = Math.floor(index / 10);
    const column = index % 10;
    return { row, column, square: squareAt(row, column) };
  });

  const snakePaths = SNAKES.map((snake) => {
    const start = centerForSquare(snake.from);
    const end = centerForSquare(snake.to);
    const bend = (start.x + end.x) / 2 + (snake.from % 2 ? 75 : -75);
    return { ...snake, start, end, d: `M ${start.x} ${start.y} Q ${bend} ${(start.y + end.y) / 2} ${end.x} ${end.y}` };
  });

  const ladderPaths = LADDERS.map((ladder) => {
    const start = centerForSquare(ladder.from);
    const end = centerForSquare(ladder.to);
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.hypot(dx, dy) || 1;
    const offsetX = (dy / length) * 10;
    const offsetY = (-dx / length) * 10;
    const rungs = Array.from({ length: 5 }, (_, index) => {
      const fraction = (index + 1) / 6;
      const x = start.x + dx * fraction;
      const y = start.y + dy * fraction;
      return `M ${x - offsetX} ${y - offsetY} L ${x + offsetX} ${y + offsetY}`;
    }).join(' ');
    return {
      ...ladder,
      rails: `M ${start.x - offsetX} ${start.y - offsetY} L ${end.x - offsetX} ${end.y - offsetY} M ${start.x + offsetX} ${start.y + offsetY} L ${end.x + offsetX} ${end.y + offsetY}`,
      rungs,
    };
  });

  return (
    <View
      style={[
        styles.frame,
        {
          backgroundColor: colors.boardFrame,
          borderColor: colors.boardFrameLight,
          shadowColor: colors.boardDark,
        },
      ]}
      accessibilityLabel="Snake and ladder game board"
      testID="game-board"
    >
      <Animated.View
        onLayout={(event) => {
          const size = Math.min(event.nativeEvent.layout.width, event.nativeEvent.layout.height);
          setBoardSize((previous) => previous === size ? previous : size);
        }}
        style={[styles.inner, { borderColor: colors.boardFrameLight, backgroundColor: colors.boardGreen }, shakeStyle]}
      >
        <View style={styles.grid}>
          {cells.map(({ row, column, square }) => {
            const locked = (KEY_SQUARES as readonly number[]).includes(square);
            const marked = !!tileMarker(square);
            const shade = (row + column) % 2 === 0 ? colors.boardCream : colors.boardGreen;
            const backgroundColor = locked
              ? colors.boardDark
              : square === 100
                ? colors.primary
                : marked && (BULLET_PICKUP_SQUARES as readonly number[]).includes(square)
                  ? colors.boardBlue
                  : shade;
            const isSnakeTarget = (SHOOTABLE_SNAKE_SQUARES as readonly number[]).includes(square);
            const targetAvailable = isSnakeTarget && game.players[game.currentPlayerIndex]?.snakeStuns[square as ShootableSnakeSquare] === 0;
            const accessibleTarget = targetAvailable && !!onSelectTarget;
            const selected = selectedTargets.includes(square as ShootableSnakeSquare);
            return (
              <Pressable
                key={square}
                accessibilityRole={accessibleTarget ? 'button' : undefined}
                accessibilityLabel={accessibleTarget ? `Aim at snake ${square}${selected ? ', selected' : ''}` : `Square ${square}${locked ? ', black key room' : ''}`}
                accessibilityState={accessibleTarget ? { selected } : undefined}
                disabled={!accessibleTarget}
                onPress={() => onSelectTarget?.(square as ShootableSnakeSquare)}
                style={[
                  styles.cell,
                  { backgroundColor, borderColor: locked ? colors.boardFrameLight : colors.transparentBorder },
                  accessibleTarget && styles.targetCell,
                ]}
              >
                <Text style={[styles.squareNumber, { color: locked ? colors.foreground : colors.boardInk }]}>
                  {square}
                </Text>
                {tileMarker(square) !== '' && (
                  <Text
                    style={[
                      styles.marker,
                      {
                        color: locked || square === 100 ? colors.primaryForeground : colors.boardDark,
                        backgroundColor: locked ? colors.boardFrame : 'transparent',
                      },
                    ]}
                  >
                    {isSnakeTarget ? `S${square}` : tileMarker(square)}
                  </Text>
                )}
              </Pressable>
            );
          })}
        </View>

        <Svg style={StyleSheet.absoluteFill} viewBox="0 0 1000 1000" pointerEvents="none">
          {ladderPaths.map((ladder) => (
            <React.Fragment key={`ladder-${ladder.from}`}>
              <Path d={ladder.rails} stroke={colors.ladderInk} strokeWidth={13} strokeLinecap="round" fill="none" opacity={0.92} />
              <Path d={ladder.rungs} stroke={colors.boardFrameLight} strokeWidth={7} strokeLinecap="round" fill="none" />
            </React.Fragment>
          ))}
          {snakePaths.map((snake) => (
            <React.Fragment key={`snake-${snake.from}`}>
              <Path d={snake.d} stroke={colors.snakeInk} strokeWidth={15} strokeLinecap="round" fill="none" opacity={0.86} />
              <Circle cx={snake.start.x} cy={snake.start.y} r={15} fill={colors.snakeInk} />
              <Circle cx={snake.start.x - 5} cy={snake.start.y - 3} r={2.5} fill={colors.foreground} />
              <Circle cx={snake.start.x + 5} cy={snake.start.y - 3} r={2.5} fill={colors.foreground} />
              {selectedTargets.includes(snake.from as ShootableSnakeSquare) && (
                <>
                  <Circle cx={snake.start.x} cy={snake.start.y} r={28} fill="none" stroke={colors.boardDark} strokeWidth={11} />
                  <Circle cx={snake.start.x} cy={snake.start.y} r={25} fill="none" stroke={colors.destructive} strokeWidth={8} />
                </>
              )}
            </React.Fragment>
          ))}
        </Svg>

        {game.players.map((player) => {
          if (player.position <= 0) return null;
          const { row, column } = centerForSquare(player.position);
          const stack = game.players.filter((other) => other.position === player.position);
          const stackIndex = stack.findIndex((other) => other.id === player.id);
          const shift = (stackIndex - (stack.length - 1) / 2) * 11;
          return (
            <View
              key={player.id}
              pointerEvents="none"
              style={[
                styles.pawnSpot,
                {
                  left: `${column * 10}%`,
                  top: `${row * 10}%`,
                  transform: [{ translateX: shift }],
                },
              ]}
            >
              <PandaToken color={player.color} />
            </View>
          );
        })}
        {bombBlast && <BombBlastVisual key={`blast-${bombBlast.id}`} blast={bombBlast} />}
        {bombBlast?.victims.map((victim, index) => {
          const player = game.players.find((item) => item.id === victim.playerId);
          if (!player) return null;
          return (
            <HomecomingPanda
              key={`homecoming-${bombBlast.id}-${victim.playerId}`}
              animationId={bombBlast.id}
              color={player.color}
              fromSquare={victim.fromSquare}
              boardSize={boardSize}
              delay={index * 150}
            />
          );
        })}
        {mysterySquare !== null && (
          <MysteryPowerTray
            square={mysterySquare}
            canChoose={mysteryCanChoose}
            busy={mysteryBusy}
            onChoose={onChooseMystery}
          />
        )}
      </Animated.View>
      <View style={styles.legend}>
        <Text style={[styles.legendText, { color: colors.secondaryForeground }]}>KEY · +1 ammo · ? mystery · GUN · ! boom</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    maxWidth: 620,
    alignSelf: 'center',
    padding: 8,
    borderWidth: 2,
    borderRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.26,
    shadowRadius: 16,
    elevation: 7,
  },
  inner: {
    width: '100%',
    aspectRatio: 1,
    borderWidth: 3,
    borderRadius: 11,
    overflow: 'hidden',
    position: 'relative',
  },
  mysteryTray: {
    position: 'absolute',
    left: '50%',
    top: '80%',
    width: '50%',
    height: '20%',
    zIndex: 30,
    padding: 2,
    borderWidth: 1,
    borderRadius: 8,
    justifyContent: 'space-between',
    overflow: 'hidden',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 9,
  },
  mysteryTrayTitle: { fontFamily: 'Nunito_700Bold', fontSize: 7, lineHeight: 9, textAlign: 'center', letterSpacing: 0.35 },
  mysteryPowerRow: { flexDirection: 'row', gap: 1, alignItems: 'center', justifyContent: 'space-between', flex: 1 },
  mysteryPowerOption: { flex: 1, minWidth: 0, height: '100%', maxHeight: 34, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 6, paddingHorizontal: 1 },
  mysteryPowerLabel: { fontFamily: 'Nunito_700Bold', fontSize: 6, lineHeight: 8 },
  mysteryTrayFooter: { minHeight: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 3 },
  mysterySelectedLabel: { flex: 1, fontFamily: 'Nunito_700Bold', fontSize: 7, lineHeight: 9 },
  mysteryGetButton: { minWidth: 31, height: 16, alignItems: 'center', justifyContent: 'center', borderRadius: 5, paddingHorizontal: 4 },
  mysteryGetLabel: { fontFamily: 'Nunito_700Bold', fontSize: 7, lineHeight: 9 },
  grid: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: '10%',
    height: '10%',
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    paddingTop: 2,
    paddingBottom: 1,
    overflow: 'hidden',
  },
  targetCell: { borderWidth: 1.5 },
  squareNumber: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 10,
    lineHeight: 12,
  },
  marker: {
    alignSelf: 'flex-end',
    fontFamily: 'Nunito_700Bold',
    fontSize: 6,
    lineHeight: 8,
    paddingHorizontal: 1,
    borderRadius: 2,
  },
  pawnSpot: {
    position: 'absolute',
    width: '10%',
    height: '10%',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  homecomingPanda: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 24,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 24,
  },
  blastCell: {
    position: 'absolute',
    width: '10%',
    height: '10%',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 18,
  },
  blastRing: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 20,
    borderWidth: 2.5,
  },
  blastCore: {
    width: 23,
    height: 23,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#fff4d2',
  },
  token: {
    width: 17,
    height: 20,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  face: {
    width: 12,
    height: 12,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    zIndex: 2,
  },
  earLeft: {
    position: 'absolute',
    top: 1,
    left: 1,
    width: 5,
    height: 5,
    borderRadius: 4,
  },
  earRight: {
    position: 'absolute',
    top: 1,
    right: 1,
    width: 5,
    height: 5,
    borderRadius: 4,
  },
  eyeLeft: { width: 3, height: 4, borderRadius: 3, transform: [{ rotate: '25deg' }] },
  eyeRight: { width: 3, height: 4, borderRadius: 3, transform: [{ rotate: '-25deg' }] },
  legend: { paddingTop: 8, alignItems: 'center' },
  legendText: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 10,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
});
