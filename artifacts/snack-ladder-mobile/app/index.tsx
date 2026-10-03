import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
  withRepeat,
  useReducedMotion,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useGameSounds } from "@/hooks/useGameSounds";
import { isSavedGame } from "@/lib/saved-game";
import { ShotAnimation, SHOT_DURATION_MS, type Shot } from "@/components/ShotAnimation";
import { PowerControls } from "@/components/PowerControls";
import { RulesDrawer } from "@/components/RulesDrawer";
import { OnlinePanel } from "@/components/OnlinePanel";
import { useOnlineGame } from "@/hooks/useOnlineGame";
import type { OnlineAction } from "@workspace/api-client-react";
import {
  BOOM_SQUARE,
  KEY_SQUARES,
  LADDERS,
  LOCKED_SQUARES,
  BULLET_PICKUP_SQUARES,
  GUN_SQUARES,
  MAX_BULLETS,
  SHOOTABLE_SNAKE_SQUARES,
  SNAKE_STUN_ROLLS,
  SNAKES,
  MYSTERY_BOX_SQUARES,
  choosePower,
  plantBomb,
  detonateBomb,
  useExtraDice,
  resolveDefense,
  createGame,
  resolveTurn,
  repairLegacyGame,
  shootSnakes,
  passFire,
  squareAt,
  type GameState,
  type TurnResolution,
  type Player,
  type ShootableSnakeSquare,
} from "@/lib/game-engine";

const STORAGE_KEY = "snack-ladder-adventure-v5";
const QUEST_STORAGE_KEY = "snack-ladder-adventure-v4";
const PREVIOUS_STORAGE_KEY = "snack-ladder-adventure-v3";
const LEGACY_STORAGE_KEY = "snack-ladder-adventure-v2";
const OLDEST_STORAGE_KEY = "snack-ladder-adventure-v1";
const STEP_DELAY_MS = 270;
const SPECIAL_MOVE_MS = { ladder: 2200, snake: 2000, boom: 700, torch: 1100, return: 1100 } as const;

const PANDA_IMAGES = {
  blue: require("../assets/images/panda-token-blue.png"),
  coral: require("../assets/images/panda-token-coral.png"),
};

const SNAKE_IMAGES = {
  violet: require("../assets/images/realistic-snake-violet.png"),
  green: require("../assets/images/realistic-snake-green.png"),
  red: require("../assets/images/realistic-snake-red.png"),
  blue: require("../assets/images/realistic-snake-blue.png"),
  orange: require("../assets/images/realistic-snake-orange.png"),
};

const DICE_PIPS: Record<number, Array<[number, number]>> = {
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [2, 0], [0, 2], [2, 2]],
  5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]],
  6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]],
};

type WalkState = {
  playerId: string;
  position: number;
  isSpecialMove: boolean;
  effect?: keyof typeof SPECIAL_MOVE_MS;
};

type Point = { x: number; y: number };

function delay(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

function getCellCenter(square: number, boardSize: number): Point {
  const zeroBased = square - 1;
  const rowFromBottom = Math.floor(zeroBased / 10);
  const offsetInRow = zeroBased % 10;
  const rowFromTop = 9 - rowFromBottom;
  const column = rowFromBottom % 2 === 0 ? offsetInRow : 9 - offsetInRow;
  const cellSize = boardSize / 10;
  return {
    x: column * cellSize + cellSize / 2,
    y: rowFromTop * cellSize + cellSize / 2,
  };
}

function Token({
  player,
  index,
  position,
  boardSize,
  stacked,
  hopping,
  specialMove,
  moveDuration,
}: {
  player: Player;
  index: number;
  position: number;
  boardSize: number;
  stacked: boolean;
  hopping: boolean;
  specialMove: boolean;
  moveDuration: number;
}) {
  const cellSize = boardSize / 10;
  const tokenWidth = cellSize * 0.65;
  const tokenHeight = cellSize * 0.84;
  const point = position > 0
    ? getCellCenter(position, boardSize)
    : { x: cellSize * 0.28, y: boardSize - cellSize * 0.22 };
  const stackOffset = stacked ? (index === 0 ? -cellSize * 0.18 : cellSize * 0.18) : 0;
  const targetX = point.x - tokenWidth / 2 + stackOffset;
  const targetY = point.y - tokenHeight / 2 + (stacked ? (index === 0 ? -2 : 2) : 0);
  const x = useSharedValue(targetX);
  const y = useSharedValue(targetY);
  const hop = useSharedValue(0);
  const sway = useSharedValue(0);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const duration = reducedMotion ? 0 : specialMove ? moveDuration : 250;
    x.value = withTiming(targetX, {
      duration,
      easing: Easing.out(Easing.cubic),
    });
    y.value = withTiming(targetY, {
      duration,
      easing: Easing.out(Easing.cubic),
    });

    if (hopping && specialMove && !reducedMotion) {
      hop.value = withRepeat(withSequence(
        withTiming(-cellSize * 0.1, { duration: 180 }),
        withTiming(0, { duration: 180 }),
      ), Math.ceil(duration / 360));
      sway.value = withRepeat(withSequence(
        withTiming(-5, { duration: 180 }),
        withTiming(5, { duration: 180 }),
      ), Math.ceil(duration / 360));
    } else if (hopping && !specialMove && !reducedMotion) {
      hop.value = withSequence(
        withTiming(-cellSize * 0.2, { duration: 115, easing: Easing.out(Easing.cubic) }),
        withTiming(0, { duration: 155, easing: Easing.inOut(Easing.cubic) }),
      );
    } else {
      hop.value = withTiming(0, { duration: 120 });
    }
    if (!specialMove || !hopping) sway.value = withTiming(0, { duration: 120 });
  }, [cellSize, hopping, specialMove, moveDuration, reducedMotion, targetX, targetY, x, y, hop, sway]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value },
      { translateY: y.value + hop.value },
      { rotate: `${sway.value}deg` },
    ],
  }));

  return (
    <Animated.View
      style={[
        styles.token,
        { width: tokenWidth, height: tokenHeight, zIndex: stacked ? 9 + index : 7 + index },
        animatedStyle,
      ]}
      testID={`piece-${player.id}`}
    >
      <Image
        source={PANDA_IMAGES[player.color]}
        style={styles.tokenImage}
        resizeMode="contain"
        accessibilityLabel={`${player.name} panda token`}
      />
    </Animated.View>
  );
}

function SnakeArt({
  from,
  to,
  color,
  boardSize,
}: {
  from: number;
  to: number;
  color: keyof typeof SNAKE_IMAGES;
  boardSize: number;
}) {
  const start = getCellCenter(from, boardSize);
  const finish = getCellCenter(to, boardSize);
  const dx = finish.x - start.x;
  const dy = finish.y - start.y;
  const length = Math.hypot(dx, dy);
  const cellSize = boardSize / 10;
  const width = Math.max(cellSize * 0.42, Math.min(cellSize * 0.72, length * 0.12));
  const rotation = Math.atan2(-dx, dy) * 180 / Math.PI;

  return (
    <Image
      source={SNAKE_IMAGES[color]}
      resizeMode="stretch"
      style={[
        styles.snakeImage,
        {
          left: (start.x + finish.x) / 2 - width / 2,
          top: (start.y + finish.y) / 2 - length / 2,
          width,
          height: length,
          transform: [{ rotate: `${rotation}deg` }],
        },
      ]}
      accessibilityLabel={`Snake from ${from} to ${to}`}
    />
  );
}

function LadderArt({
  from,
  to,
  boardSize,
  color,
}: {
  from: number;
  to: number;
  boardSize: number;
  color: string;
}) {
  const start = getCellCenter(from, boardSize);
  const finish = getCellCenter(to, boardSize);
  const dx = finish.x - start.x;
  const dy = finish.y - start.y;
  const length = Math.hypot(dx, dy);
  const angle = Math.atan2(-dx, dy) * 180 / Math.PI;
  const middleX = (start.x + finish.x) / 2;
  const middleY = (start.y + finish.y) / 2;
  const spacing = boardSize * 0.023;
  const railWidth = Math.max(2, boardSize * 0.008);
  const rungWidth = spacing * 2 + railWidth;
  const rungCount = Math.max(3, Math.floor(length / (boardSize * 0.075)));
  const normalX = -dy / length;
  const normalY = dx / length;

  return (
    <View style={StyleSheet.absoluteFill}>
      {[-1, 1].map((side) => (
        <View
          key={side}
          style={{
            position: "absolute",
            left: middleX + side * spacing * normalX - railWidth / 2,
            top: middleY + side * spacing * normalY - length / 2,
            width: railWidth,
            height: length,
            borderRadius: railWidth,
            backgroundColor: color,
            transform: [{ rotate: `${angle}deg` }],
          }}
        />
      ))}
      {Array.from({ length: rungCount }, (_, index) => {
        const ratio = (index + 1) / (rungCount + 1);
        const x = start.x + dx * ratio;
        const y = start.y + dy * ratio;
        return (
          <View
            key={index}
            style={{
              position: "absolute",
              left: x - rungWidth / 2,
              top: y - Math.max(1.5, boardSize * 0.004),
              width: rungWidth,
              height: Math.max(3, boardSize * 0.008),
              borderRadius: 4,
              backgroundColor: color,
              transform: [{ rotate: `${angle}deg` }],
            }}
          />
        );
      })}
    </View>
  );
}

function Board({
  game,
  walking,
  size,
  shot,
}: {
  game: GameState;
  walking: WalkState | null;
  size: number;
  shot: Shot | null;
}) {
  const colors = useColors();
  const cellSize = size / 10;
  const cells = useMemo(
    () =>
      Array.from({ length: 100 }, (_, index) => {
        const row = Math.floor(index / 10);
        const column = index % 10;
        const number = squareAt(row, column);
        const locked = (LOCKED_SQUARES as readonly number[]).includes(number);
        const keySquare = (KEY_SQUARES as readonly number[]).includes(number);
        const bullet = (BULLET_PICKUP_SQUARES as readonly number[]).includes(number);
        const mystery = (MYSTERY_BOX_SQUARES as readonly number[]).includes(number);
        const gun = (GUN_SQUARES as readonly number[]).includes(number);
        const backgroundColor = locked
          ? colors.boardLocked
          : keySquare
            ? colors.boardKey
            : number % 3 === 0
              ? colors.boardBlue
              : (row + column) % 2 === 0
                ? colors.boardGreen
                : colors.boardCream;

        return {
          number,
          row,
          column,
          locked,
          keySquare,
          bullet,
          mystery,
          gun,
          backgroundColor,
        };
      }),
    [colors.boardBlue, colors.boardCream, colors.boardGreen, colors.boardKey, colors.boardLocked],
  );

  return (
    <View
      style={[
        styles.boardFrame,
        {
          width: size + 14,
          backgroundColor: colors.boardFrame,
          borderColor: colors.primary,
        },
      ]}
    >
      <View
        style={[
          styles.boardInner,
          {
            width: size,
            height: size,
            backgroundColor: colors.boardCream,
            borderColor: colors.primary,
          },
        ]}
        testID="game-board"
      >
        {Array.from({ length: 10 }, (_, row) => (
          <View key={`row-${row}`} style={styles.boardRow}>
            {cells
              .filter((cell) => cell.row === row)
              .map((cell) => (
                <View
                  key={cell.number}
                  style={[
                    styles.boardCell,
                    {
                      width: cellSize,
                      height: cellSize,
                      backgroundColor: cell.backgroundColor,
                      borderColor: colors.boardInk,
                    },
                  ]}
                  testID={`board-square-${cell.number}`}
                >
                  <Text style={[styles.cellNumber, { color: colors.boardInk, fontSize: Math.max(7, cellSize * 0.24) }]}>
                    {cell.number}
                  </Text>
                  {cell.locked && (
                    <View style={styles.cellMarker}>
                      <MaterialCommunityIcons
                        name={game.players[game.currentPlayerIndex].hasTorch ? "key-variant" : "lock"}
                        size={cellSize * 0.3}
                        color={colors.primaryForeground}
                      />
                    </View>
                  )}
                  {cell.keySquare && !cell.locked && (
                    <View style={styles.cellMarker}>
                      <MaterialCommunityIcons name="key-variant" size={cellSize * 0.34} color={colors.primaryForeground} />
                    </View>
                  )}
                  {cell.mystery && (
                    <View style={styles.cellMarker}>
                      <MaterialCommunityIcons name="gift" size={cellSize * 0.32} color={colors.primaryForeground} />
                    </View>
                  )}
                  {cell.gun && (
                    <View style={styles.cellMarker}>
                      <MaterialCommunityIcons name="pistol" size={cellSize * 0.34} color={colors.primaryForeground} />
                    </View>
                  )}
                  {cell.bullet && (
                    <View
                      style={[
                        styles.bulletMarker,
                        { backgroundColor: colors.primaryForeground, borderColor: colors.primary },
                      ]}
                    />
                  )}
                  {cell.number === BOOM_SQUARE && (
                    <View style={styles.cellMarker}>
                      <MaterialCommunityIcons name="bomb" size={cellSize * 0.34} color={colors.primaryForeground} />
                    </View>
                  )}
                  {cell.number === 1 && (
                    <View style={styles.cellMarker}>
                      <MaterialCommunityIcons name="home" size={cellSize * 0.3} color={colors.primaryForeground} />
                    </View>
                  )}
                </View>
              ))}
          </View>
        ))}

        {SNAKES.map((snake) => (
          <SnakeArt
            key={snake.from}
            from={snake.from}
            to={snake.to}
            color={snake.color}
            boardSize={size}
          />
        ))}
        {LADDERS.map((ladder) => (
          <LadderArt
            key={ladder.from}
            from={ladder.from}
            to={ladder.to}
            boardSize={size}
            color={colors.boardFrame}
          />
        ))}

        <View
          style={[
            styles.goalTile,
            {
              width: cellSize,
              height: cellSize,
              backgroundColor: colors.primary,
              borderColor: colors.foreground,
            },
          ]}
          testID="goal-crown"
          accessibilityLabel={game.players[game.currentPlayerIndex].crownKeyRoom !== null
            ? "100: return with torch and key to claim the crown"
            : "100: crown locked; first collect a torch, then a black-room key"}
        >
          <MaterialCommunityIcons name="crown" size={cellSize * 0.43} color={colors.primaryForeground} />
          {game.players[game.currentPlayerIndex].crownKeyRoom === null && (
            <MaterialCommunityIcons name={game.players[game.currentPlayerIndex].hasTorch ? "lock" : "flashlight"}
              size={cellSize * 0.23} color={colors.primaryForeground} />
          )}
          <Text style={[styles.goalNumber, { color: colors.primaryForeground, fontSize: cellSize * 0.22 }]}>100</Text>
        </View>

        {game.bombs.map((bomb) => {
          const point = getCellCenter(bomb.square, size);
          const owner = game.players.find((player) => player.id === bomb.ownerId)!;
          return <View key={bomb.id} testID={`planted-bomb-${bomb.square}`}
            accessibilityLabel={`${owner.name}'s planted bomb in house ${bomb.square}`}
            pointerEvents="none" style={{ position: "absolute", zIndex: 6, left: point.x + cellSize * 0.25 - 9,
              top: point.y + cellSize * 0.25 - 9, width: 18, height: 18, borderRadius: 4,
              alignItems: "center", justifyContent: "center", backgroundColor: colors.card,
              borderWidth: 1, borderColor: bomb.armed ? colors.primary : owner.color === "blue" ? "#36b8e6" : "#ef7653" }}>
            <MaterialCommunityIcons name="bomb" size={14} color={owner.color === "blue" ? "#36b8e6" : "#ef7653"} />
          </View>;
        })}
        {game.players.map((player, index) => {
          const position =
            walking?.playerId === player.id ? walking.position : player.position;
          const otherPosition = game.players[1 - index].id === walking?.playerId
            ? walking.position
            : game.players[1 - index].position;
          const stacked = position === otherPosition;
          return (
            <Token
              key={player.id}
              player={player}
              index={index}
              position={position}
              boardSize={size}
              stacked={stacked}
              hopping={walking?.playerId === player.id}
              specialMove={walking?.playerId === player.id && walking.isSpecialMove}
              moveDuration={walking?.effect ? SPECIAL_MOVE_MS[walking.effect] : 540}
            />
          );
        })}
        {shot && <ShotAnimation from={getCellCenter(shot.from, size)}
          targets={shot.targets.map((square) => ({ square, ...getCellCenter(square, size) }))} />}
        {(walking?.effect === "torch" || walking?.effect === "return") && (
          <View style={[styles.questPickup, { backgroundColor: colors.card }]} testID="quest-pickup">
            <MaterialCommunityIcons name={walking.effect === "torch" ? "flashlight" : "lock"} size={24} color={colors.primary} />
            <Text style={[styles.keyCountText, { color: colors.foreground }]}>
              {walking.effect === "torch" ? "Torch collected! Returning Home" : "Find a black-room key. Returning Home"}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

function DiceFace({
  value,
  color,
  faceColor,
  borderColor,
}: {
  value: number | null;
  color: string;
  faceColor: string;
  borderColor: string;
}) {
  const pips = DICE_PIPS[value ?? 1];
  return (
    <View
      style={[styles.dieFace, { backgroundColor: faceColor, borderColor }]}
      accessibilityLabel={value ? `Dice showing ${value}` : "Ready to roll"}
      accessibilityRole="image"
      testID="dice-result"
    >
      {pips.map(([column, row], index) => (
        <View
          key={index}
          testID="dice-pip"
          style={[
            styles.diePip,
            {
              left: `${column * 50}%`,
              top: `${row * 50}%`,
              backgroundColor: color,
            },
          ]}
        />
      ))}
    </View>
  );
}

function PlayerRow({
  player,
  active,
  colors,
}: {
  player: Player;
  active: boolean;
  colors: ReturnType<typeof useColors>;
}) {
  const playerColor = player.color === "blue" ? colors.bluePlayer : colors.coralPlayer;
  return (
    <View
      style={[
        styles.playerRow,
        active && { backgroundColor: colors.secondary },
        { borderColor: colors.border },
      ]}
      testID={`player-status-${player.id}`}
    >
      <Image source={PANDA_IMAGES[player.color]} style={styles.playerPanda} resizeMode="contain" />
      <View style={styles.playerInfo}>
        <Text style={[styles.playerName, { color: colors.foreground }]}>{player.name}</Text>
        <Text style={[styles.playerPosition, { color: colors.mutedForeground }]}>
          {player.position ? `SQUARE ${player.position}` : "AT HOME"}
        </Text>
        <Text style={[styles.playerPosition, { color: colors.mutedForeground }]} testID={`quest-${player.id}`}>
          {player.hasTorch ? player.crownKeyRoom !== null ? `Torch · key from ${player.crownKeyRoom}` : "Torch · find a black-room key" : "Find torch at 100"}
          {player.legacyKeys ? ` · Old keys: ${player.legacyKeys}` : ""}
        </Text>
        {SHOOTABLE_SNAKE_SQUARES.filter((square) => player.snakeStuns[square] > 0).map((square) => (
          <Text key={square} style={[styles.playerPosition, { color: colors.primary }]} testID={`stun-${player.id}-${square}`}>
            Snake {square}: {player.snakeStuns[square]} own rolls safe
          </Text>
        ))}
      </View>
      <View style={[styles.playerDot, { backgroundColor: playerColor }]} />
      <View style={[styles.keyCount, { backgroundColor: colors.muted }]}>
        <MaterialCommunityIcons name="key-variant" size={13} color={colors.primary} />
        <Text style={[styles.keyCountText, { color: colors.foreground }]}>{player.keys}/1</Text>
      </View>
      <View style={[styles.keyCount, { backgroundColor: colors.muted }]} testID={`ammo-${player.id}`}>
        <MaterialCommunityIcons name="bullet" size={13} color={colors.primary} />
        <Text style={[styles.keyCountText, { color: colors.foreground }]}>{player.bullets}/{MAX_BULLETS}</Text>
      </View>
    </View>
  );
}

export default function GameScreen() {
  const colors = useColors();
  const sounds = useGameSounds();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const [game, setGame] = useState<GameState>(createGame);
  const [hydrated, setHydrated] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [diceFace, setDiceFace] = useState<number | null>(null);
  const [walking, setWalking] = useState<WalkState | null>(null);
  const [storageError, setStorageError] = useState(false);
  const [saveBlocked, setSaveBlocked] = useState(false);
  const [firing, setFiring] = useState(false);
  const [shot, setShot] = useState<Shot | null>(null);
  const [selectedTargets, setSelectedTargets] = useState<ShootableSnakeSquare[]>([]);
  const scrollRef = useRef<ScrollView>(null);
  const boardTop = useRef(0);
  const controlsTop = useRef(0);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const rollInFlight = useRef(false);
  const latestGame = useRef(game);
  latestGame.current = game;
  const screenMounted = useRef(true);
  const online = useOnlineGame({ ready: hydrated, gameRef: latestGame, setGame, setDiceFace, setWalking,
    setShot, setRolling, setFiring, setSelectedTargets, sounds,
    focus: (section) => scrollRef.current?.scrollTo({
      y: Math.max(0, (section === "board" ? boardTop.current : controlsTop.current) - topInset), animated: false,
    }),
  });
  const remoteDisabled = online.loadingSession || online.busy || (!!online.session && !online.canAct);
  const leaveOnline = () => {
    const message = "If connected, leaving ends this room for both players. Your local saved round stays intact.";
    if (Platform.OS === "web") {
      if (window.confirm(message)) void online.leave();
    } else {
      Alert.alert("Leave online play?", message, [
        { text: "Stay", style: "cancel" }, { text: "Leave", style: "destructive", onPress: () => { void online.leave(); } },
      ]);
    }
  };
  useEffect(() => {
    screenMounted.current = true;
    return () => { screenMounted.current = false; };
  }, []);

  useEffect(() => {
    let mounted = true;
    const loadSavedGame = async () => {
      try {
        const currentSave = await AsyncStorage.getItem(STORAGE_KEY);
        const saved = currentSave ?? await AsyncStorage.getItem(QUEST_STORAGE_KEY)
          ?? await AsyncStorage.getItem(PREVIOUS_STORAGE_KEY)
          ?? await AsyncStorage.getItem(LEGACY_STORAGE_KEY)
          ?? await AsyncStorage.getItem(OLDEST_STORAGE_KEY);
        if (!mounted) return;
        if (saved) {
          const parsed: unknown = JSON.parse(saved);
          if (isSavedGame(parsed)) {
            setGame(repairLegacyGame(parsed));
            setDiceFace(parsed.lastRoll);
          } else {
            setSaveBlocked(true);
            setStorageError(true);
          }
        }
      } catch {
        if (mounted) {
          setStorageError(true);
          setSaveBlocked(true);
        }
      } finally {
        if (mounted) setHydrated(true);
      }
    };

    void loadSavedGame();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated || saveBlocked || online.session || online.loadingSession) return;
    let active = true;
    const serialized = JSON.stringify(game);
    saveQueue.current = saveQueue.current.catch(() => undefined)
      .then(() => AsyncStorage.setItem(STORAGE_KEY, serialized));
    saveQueue.current
      .then(() => {
        if (active) setStorageError(false);
      })
      .catch(() => {
        if (active) setStorageError(true);
      });
    return () => {
      active = false;
    };
  }, [game, hydrated, saveBlocked, online.session, online.loadingSession]);

  const currentPlayer = game.players[game.currentPlayerIndex];
  const waitingToFire = game.pendingFireForPlayerId === currentPlayer.id;
  const busy = rolling || firing || remoteDisabled;
  const fireAt = async () => {
    if (online.session) {
      if (online.canAct && selectedTargets.length) await online.action({ type: "shoot", targets: [...selectedTargets] });
      return;
    }
    if (!hydrated || rollInFlight.current || !waitingToFire || !selectedTargets.length) return;
    rollInFlight.current = true;
    setFiring(true);
    try {
      const nextGame = shootSnakes(game, selectedTargets);
      scrollRef.current?.scrollTo({ y: Math.max(0, boardTop.current - topInset), animated: false });
      await delay(50);
      if (!screenMounted.current) return;
      setShot({ from: currentPlayer.position, targets: [...selectedTargets] });
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => undefined);
      await delay(SHOT_DURATION_MS);
      if (!screenMounted.current) return;
      setGame(nextGame);
      setSelectedTargets([]);
    } catch {
      Alert.alert("Shot not completed", "Choose an available snake and check your bullets, then try again.");
    } finally {
      rollInFlight.current = false;
      if (screenMounted.current) {
        setShot(null);
        setFiring(false);
      }
    }
  };
  const passShot = () => {
    if (online.session) { if (online.canAct) void online.action({ type: "pass" }); return; }
    if (rollInFlight.current || !waitingToFire) return;
    setGame(passFire(game));
    setSelectedTargets([]);
  };
  const winner = game.players.find((player) => player.id === game.winnerId);
  const boardSize = Math.min(Math.max(width - 42, 300), 440);
  const topInset = Platform.OS === "web" ? 67 : Math.max(insets.top, 12) + 8;
  const bottomInset = Platform.OS === "web" ? 34 : Math.max(insets.bottom, 12) + 8;
  const applyPower = (command: (state: GameState) => GameState, action?: OnlineAction) => {
    if (online.session) { if (online.canAct && action) void online.action(action); return; }
    if (!hydrated || rollInFlight.current) return;
    try {
      const next = command(latestGame.current);
      latestGame.current = next;
      setGame(next);
    } catch (error) {
      Alert.alert("Power not available", error instanceof Error ? error.message : "Please try again.");
    }
  };
  const applyAnimatedPower = async (command: (state: GameState) => TurnResolution, movingId?: string, action?: OnlineAction) => {
    if (online.session) { if (online.canAct && action) await online.action(action); return; }
    if (!hydrated || rollInFlight.current) return;
    rollInFlight.current = true;
    setRolling(true);
    try {
      const before = latestGame.current;
      const resolution = command(before);
      const id = movingId ?? before.players[before.currentPlayerIndex].id;
      const moved = resolution.state.players.find((player) => player.id === id)!;
      const effect = resolution.effect;
      if (effect) {
        scrollRef.current?.scrollTo({ y: Math.max(0, boardTop.current - topInset), animated: false });
        await delay(50);
        if (!screenMounted.current) return;
        if (effect === "torch" || effect === "return") {
          setWalking({ playerId: id, position: 100, isSpecialMove: false, effect });
          await delay(reducedMotion ? 150 : SPECIAL_MOVE_MS[effect]);
          if (!screenMounted.current) return;
          setWalking({ playerId: id, position: 0, isSpecialMove: true });
          await delay(reducedMotion ? 45 : 600);
        } else {
          if (effect === "snake" || effect === "ladder") sounds.play(effect);
          setWalking({ playerId: id, position: moved.position, isSpecialMove: true, effect });
          await delay(reducedMotion ? 45 : SPECIAL_MOVE_MS[effect] + 80);
        }
        if (!screenMounted.current) return;
      }
      sounds.playPickups(before.players.find((player) => player.id === id)!, moved);
      latestGame.current = resolution.state;
      setGame(resolution.state);
      if (effect) scrollRef.current?.scrollTo({ y: Math.max(0, controlsTop.current - topInset), animated: false });
    } catch (error) {
      Alert.alert("Power not completed", error instanceof Error ? error.message : "Please try again.");
    } finally {
      rollInFlight.current = false;
      if (screenMounted.current) {
        setWalking(null);
        setRolling(false);
      }
    }
  };

  const rollDice = async () => {
    if (online.session) { if (online.canAct) await online.action({ type: "roll" }); return; }
    if (!hydrated || rollInFlight.current || latestGame.current.winnerId ||
      latestGame.current.pendingFireForPlayerId || latestGame.current.pendingChoice) return;
    rollInFlight.current = true;
    setRolling(true);
    sounds.play("dice");
    try {
      for (let frame = 0; frame < 7; frame += 1) {
        setDiceFace(1 + Math.floor(Math.random() * 6));
        await delay(85);
        if (!screenMounted.current) return;
      }
      const roll = 1 + Math.floor(Math.random() * 6);
      setDiceFace(roll);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);

      const before = latestGame.current;
      const player = before.players[before.currentPlayerIndex];
      const resolution = resolveTurn(before, roll);
      const nextGame = resolution.state;

      if (resolution.path.length > 0) {
        for (const position of resolution.path) {
          setWalking({ playerId: player.id, position, isSpecialMove: false });
          sounds.play("step");
          void Haptics.selectionAsync().catch(() => undefined);
          await delay(reducedMotion ? 45 : STEP_DELAY_MS);
          if (!screenMounted.current) return;
        }

        const resolvedPlayer = nextGame.players.find((item) => item.id === player.id);
        if (resolvedPlayer && resolution.effect) {
          if (resolution.effect === "torch" || resolution.effect === "return") {
            setWalking({ playerId: player.id, position: 100, isSpecialMove: false, effect: resolution.effect });
            await delay(reducedMotion ? 150 : SPECIAL_MOVE_MS[resolution.effect]);
            if (!screenMounted.current) return;
            setWalking({ playerId: player.id, position: 0, isSpecialMove: true });
            await delay(reducedMotion ? 45 : 600);
            if (!screenMounted.current) return;
          } else {
          if (resolution.effect === "ladder" || resolution.effect === "snake") {
            sounds.play(resolution.effect);
          }
          setWalking({
            playerId: player.id,
            position: resolvedPlayer.position,
            isSpecialMove: true,
            effect: resolution.effect,
          });
          await delay(reducedMotion ? 45 : SPECIAL_MOVE_MS[resolution.effect] + 80);
          if (!screenMounted.current) return;
          }
        }
      }

      sounds.playPickups(player, nextGame.players.find((item) => item.id === player.id)!);
      setGame(nextGame);
      latestGame.current = nextGame;
      if (nextGame.winnerId) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      }
    } catch {
      Alert.alert("Turn not completed", "The dice roll could not finish. Please try again.");
    } finally {
      rollInFlight.current = false;
      if (screenMounted.current) {
        setWalking(null);
        setRolling(false);
      }
    }
  };

  const startNewGame = () => {
    if (rollInFlight.current) return;
    Alert.alert("Start a new game?", "This replaces the saved round on this phone.", [
      { text: "Keep playing", style: "cancel" },
      {
        text: "New game",
        style: "destructive",
        onPress: () => {
          if (!screenMounted.current || rollInFlight.current) return;
          const fresh = createGame();
          latestGame.current = fresh;
          setGame(fresh);
          setDiceFace(null);
          setSelectedTargets([]);
          setSaveBlocked(false);
        },
      },
    ]);
  };

  if (!hydrated) {
    return (
      <View style={[styles.loadingScreen, { backgroundColor: colors.background }]}>
        <StatusBar style="light" />
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Opening your board…</Text>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <StatusBar style="light" />
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[
          styles.content,
          { paddingTop: topInset, paddingBottom: bottomInset, width },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={[styles.brandMark, { backgroundColor: colors.primary }]}>
            <MaterialCommunityIcons name="crown" size={23} color={colors.primaryForeground} />
          </View>
          <View style={styles.brandCopy}>
            <Text style={[styles.brandTitle, { color: colors.foreground }]}>Snakes &amp; Ladders</Text>
            <Text style={[styles.brandSubtitle, { color: colors.mutedForeground }]}>A tiny quest for two</Text>
          </View>
          <Pressable
            onPress={sounds.toggleMuted}
            accessibilityRole="button"
            accessibilityLabel={sounds.muted ? "Enable sound effects" : "Mute sound effects"}
            testID="button-sound"
            style={[styles.brandMark, { backgroundColor: colors.secondary }]}
          >
            <MaterialCommunityIcons
              name={sounds.muted ? "volume-off" : "volume-high"}
              size={22}
              color={colors.secondaryForeground}
            />
          </Pressable>
          <View style={[styles.modeChip, { backgroundColor: colors.secondary }]}>
            <View style={[styles.liveDot, { backgroundColor: colors.accent }]} />
            <Text style={[styles.modeText, { color: colors.secondaryForeground }]}>{online.session ? "ONLINE" : "PASS & PLAY"}</Text>
          </View>
        </View>

        <OnlinePanel room={online.room} resumeCode={online.session?.code}
          busy={online.busy || rolling || firing || online.loadingSession} connected={online.connected}
          error={online.error} onCreate={online.create} onJoin={online.join} onLeave={leaveOnline}
          onRematch={() => { void online.action({ type: "rematch" }); }}
          onRetry={() => { void online.retry(); }} />

        <View style={styles.turnHeading}>
          <View>
            <Text style={[styles.turnLabel, { color: colors.primary }]}>
              TURN {String(game.turnNumber).padStart(2, "0")}
            </Text>
            <Text style={[styles.turnTitle, { color: colors.foreground }]}>
              {winner ? `${winner.name} wins!` : `${currentPlayer.name}'s turn`}
            </Text>
          </View>
          {winner ? (
            <MaterialCommunityIcons name="trophy" size={28} color={colors.primary} />
          ) : (
            <Text style={[styles.turnHint, { color: colors.mutedForeground }]}>{online.session ? online.room?.yourPlayerId === currentPlayer.id ? "YOUR TURN" : "FRIEND'S TURN" : "LOCAL GAME"}</Text>
          )}
        </View>

        <View onLayout={(event) => { boardTop.current = event.nativeEvent.layout.y; }}>
          <Board game={game} walking={walking} size={boardSize} shot={shot} />
        </View>

        <View style={[styles.playersCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {game.players.map((player, index) => (
            <PlayerRow
              key={player.id}
              player={player}
              active={!winner && index === game.currentPlayerIndex}
              colors={colors}
            />
          ))}
        </View>
        <View style={[styles.messageCard, { backgroundColor: colors.card, borderColor: colors.border }]} testID="quest-status">
          <MaterialCommunityIcons name="flashlight" size={20} color={colors.primary} />
          <Text style={[styles.messageText, { color: colors.foreground }]}>
            {!currentPlayer.hasTorch ? "Stage 1/3 · Reach 100 for a torch, then return Home."
              : currentPlayer.crownKeyRoom === null ? "Stage 2/3 · Land in black room 17, 44 or 67 for one key."
                : winner ? "Stage 3/3 · Crown claimed!" : `Stage 3/3 · Key from ${currentPlayer.crownKeyRoom} ready. Reach 100 for the crown.`}
          </Text>
        </View>

        <View onLayout={(event) => { controlsTop.current = event.nativeEvent.layout.y; }}>
        <PowerControls
          playerName={currentPlayer.name}
          powers={currentPlayer.powers} pending={game.pendingChoice}
          extraRollCredits={currentPlayer.extraRollCredits}
          busy={busy} actionsEnabled={!remoteDisabled && !winner && !waitingToFire && !game.pendingChoice}
          bombs={game.bombs.map((bomb) => ({ ...bomb,
            ownerName: game.players.find((player) => player.id === bomb.ownerId)!.name,
            owned: bomb.ownerId === currentPlayer.id,
            ready: bomb.armed && game.players.some((player) => player.id !== bomb.ownerId && player.position === bomb.square),
          }))}
          onChoose={(power) => applyPower((state) => choosePower(state, power), { type: "choose", power })}
          onDefense={(use) => { void applyAnimatedPower((state) => resolveDefense(state, use), undefined, { type: "defense", use }); }}
          onPlant={(square) => applyPower((state) => plantBomb(state, square), { type: "plant", square })}
          onExtraDice={() => applyPower(useExtraDice, { type: "extraDice" })}
          onDetonate={(id) => { void applyAnimatedPower(
            (state) => ({ state: detonateBomb(state, id), path: [], effect: "boom" }),
            game.players.find((player) => player.id !== currentPlayer.id)!.id,
            { type: "detonate", bombId: id },
          ); }}
        />
        </View>

        {winner ? (
          <View style={[styles.winnerCard, { backgroundColor: colors.accent }]}>
            <MaterialCommunityIcons name="trophy" size={21} color={colors.accentForeground} />
            <Text style={[styles.winnerText, { color: colors.accentForeground }]}>Crown claimed. Play again?</Text>
          </View>
        ) : waitingToFire ? (
          <View style={[styles.aimCard, { backgroundColor: colors.card, borderColor: colors.border }]} testID="aim-controls">
            <Text style={[styles.rollTitle, { color: colors.foreground }]}>AIM FROM GUN ROOM {currentPlayer.position}</Text>
            <Text style={[styles.rulesText, { color: colors.mutedForeground }]}>
              One bullet per snake. Hits protect only your panda for its next {SNAKE_STUN_ROLLS} rolls.
            </Text>
            <View style={styles.aimOptions}>
              {([[98], [99], [98, 99]] as ShootableSnakeSquare[][]).map((targets) => {
                const disabled = busy || currentPlayer.bullets < targets.length ||
                  targets.some((square) => currentPlayer.snakeStuns[square] > 0);
                const selected = selectedTargets.length === targets.length &&
                  targets.every((square) => selectedTargets.includes(square));
                const label = targets.length === 2 ? "Both · 2 bullets" : `${targets[0]} · 1 bullet`;
                return (
                  <Pressable key={targets.join("-")} testID={`aim-${targets.join("-")}`}
                    accessibilityRole="radio" accessibilityLabel={`Aim at ${label}`}
                    accessibilityState={{ disabled, checked: selected }} disabled={disabled}
                    onPress={() => { if (!rollInFlight.current) setSelectedTargets(targets); }}
                    style={[styles.aimOption, { borderColor: selected ? colors.primary : colors.border,
                      backgroundColor: selected ? colors.secondary : colors.card, opacity: disabled ? 0.4 : 1 }]}>
                    <Text style={[styles.keyCountText, { color: colors.foreground }]}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Pressable onPress={fireAt} disabled={busy || !selectedTargets.length}
              accessibilityRole="button" accessibilityLabel="Fire at selected snakes" testID="button-fire"
              style={[styles.aimOption, { backgroundColor: colors.primary, opacity: busy || !selectedTargets.length ? 0.5 : 1 }]}>
              <Text style={[styles.rollTitle, { color: colors.primaryForeground }]}>{firing ? "FIRING…" : "FIRE"}</Text>
            </Pressable>
            <Pressable onPress={passShot} disabled={busy} accessibilityRole="button" testID="button-pass"
              style={[styles.aimOption, { borderColor: colors.border, opacity: busy ? 0.4 : 1 }]}>
              <Text style={[styles.keyCountText, { color: colors.foreground }]}>Pass · keep bullets</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={rollDice}
            disabled={busy || !!game.pendingChoice}
            accessibilityRole="button"
            accessibilityLabel="Roll the dice"
            testID="button-roll"
            style={({ pressed }) => [
              styles.rollCard,
              {
                backgroundColor: colors.primary,
                opacity: rolling ? 0.86 : pressed ? 0.82 : 1,
              },
            ]}
          >
            <DiceFace
              value={diceFace}
              color={colors.primaryForeground}
              faceColor={colors.dieFace}
              borderColor={colors.dieBorder}
            />
            <View style={styles.rollCopy}>
              <Text style={[styles.rollTitle, { color: colors.primaryForeground }]}>
                {game.pendingChoice ? "CHOOSE YOUR POWER FIRST" : rolling ? "ROLLING…" : "ROLL THE DICE"}
              </Text>
              <Text style={[styles.rollSubtitle, { color: colors.primaryForeground }]}>
                {rolling
                  ? "Your panda is on the move"
                  : game.lastRoll
                    ? `Last roll · ${game.lastRoll}  ·  Tap to roll`
                    : "Tap to move your panda"}
              </Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={23} color={colors.primaryForeground} />
          </Pressable>
        )}

        <View style={[styles.messageCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <MaterialCommunityIcons name="star" size={17} color={colors.primary} />
          <Text style={[styles.messageText, { color: colors.cardForeground }]} testID="game-message">
            {game.message}
          </Text>
        </View>

        <RulesDrawer>
        <View style={styles.rulesLine}>
          <MaterialCommunityIcons name="information-outline" size={16} color={colors.mutedForeground} />
          <Text style={[styles.rulesText, { color: colors.mutedForeground }]}>
            First reach 100 for a torch and return Home. With the torch, stop in black room 17, 44 or 67 for one key; then return to 100 for the crown. Without a key, 100 returns you Home to retry. Gates never block movement.{"\n\n"}
            Bullets only on final landing in 6, 12, 25, 38, 61, 63, 77 or 89, max 5. Stop on 94–96 to fire at 98, 99 or both (2 bullets). Hits protect your panda for its next 3 rolls. A valid six grants another chance; overshooting 100 does not. Exact roll required at 100.{"\n\n"}
            Mystery rooms 14, 35, 51 and 76 let you choose a Bomb, Anti-Venom, Defuser Kit or Extra Dice. Plant on any house; manually detonate on your turn after the rival stops there. Blasts send the rival Home without losing torch, key or inventory.{"\n\n"}
            Use Anti-Venom before a bite to stay in that snake room. One Defuser Kit protects a visit to boom room 97 or removes a rival planted bomb. Activate Extra Dice before rolling to bank one additional roll; a valid six gives a separate bonus and does not spend that credit.
          </Text>
        </View>
        </RulesDrawer>

        {storageError && (
          <Text style={[styles.storageWarning, { color: colors.destructive }]}>
            {saveBlocked ? "The saved round could not be opened. It has not been replaced. Start a new game to save again." : "This round may not be saved on this phone."}
          </Text>
        )}
        {sounds.error && !sounds.muted && (
          <Text style={[styles.storageWarning, { color: colors.destructive }]}>
            Sound effects could not play. Your game can still continue.
          </Text>
        )}

        {!online.session && <Pressable
          onPress={startNewGame}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Start a new game"
          testID="button-new-game"
          style={({ pressed }) => [
            styles.newGameButton,
            {
              borderColor: colors.border,
              opacity: busy ? 0.5 : pressed ? 0.65 : 1,
            },
          ]}
        >
          <MaterialCommunityIcons name="refresh" size={17} color={colors.foreground} />
          <Text style={[styles.newGameText, { color: colors.foreground }]}>New game</Text>
        </Pressable>}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  questPickup: { position: "absolute", top: "40%", left: "8%", right: "8%", zIndex: 35, padding: 14, borderRadius: 12, alignItems: "center", gap: 8 },
  aimCard: { width: "100%", borderRadius: 20, padding: 16, borderWidth: 1, gap: 12 },
  aimOptions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  aimOption: { borderWidth: 1, borderRadius: 12, padding: 12, alignItems: "center", justifyContent: "center" },
  screen: {
    flex: 1,
  },
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    fontFamily: "Nunito_600SemiBold",
    fontSize: 15,
  },
  content: {
    alignSelf: "center",
    alignItems: "center",
    paddingHorizontal: 14,
    gap: 11,
  },
  header: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  brandMark: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  brandCopy: {
    flex: 1,
  },
  brandTitle: {
    fontFamily: "Nunito_800ExtraBold",
    fontSize: 20,
    lineHeight: 24,
  },
  brandSubtitle: {
    fontFamily: "Nunito_600SemiBold",
    fontSize: 12,
    marginTop: 1,
  },
  modeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  modeText: {
    fontFamily: "Nunito_800ExtraBold",
    fontSize: 9,
    letterSpacing: 0.7,
  },
  turnHeading: {
    width: "100%",
    minHeight: 45,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 2,
  },
  turnLabel: {
    fontFamily: "Nunito_800ExtraBold",
    fontSize: 10,
    letterSpacing: 1.1,
  },
  turnTitle: {
    fontFamily: "Nunito_800ExtraBold",
    fontSize: 22,
    lineHeight: 26,
  },
  turnHint: {
    fontFamily: "Nunito_800ExtraBold",
    fontSize: 9,
    letterSpacing: 1,
  },
  boardFrame: {
    padding: 7,
    borderRadius: 20,
    borderWidth: 1,
    elevation: 7,
  },
  boardInner: {
    position: "relative",
    overflow: "hidden",
    borderWidth: 2,
    borderRadius: 9,
  },
  boardRow: {
    flexDirection: "row",
  },
  boardCell: {
    position: "relative",
    borderWidth: 0.55,
    justifyContent: "flex-start",
    alignItems: "flex-start",
  },
  cellNumber: {
    fontFamily: "Nunito_800ExtraBold",
    lineHeight: 12,
    marginTop: 1,
    marginLeft: 2,
    zIndex: 1,
  },
  cellMarker: {
    position: "absolute",
    right: 1,
    bottom: 1,
  },
  bulletMarker: {
    position: "absolute",
    right: 4,
    bottom: 4,
    width: 5,
    height: 9,
    borderRadius: 3,
    borderWidth: 1,
    transform: [{ rotate: "35deg" }],
  },
  snakeImage: {
    position: "absolute",
    zIndex: 3,
    opacity: 0.96,
  },
  goalTile: {
    position: "absolute",
    left: 0,
    top: 0,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderRadius: 5,
    zIndex: 5,
  },
  goalNumber: {
    fontFamily: "Nunito_800ExtraBold",
    lineHeight: 12,
    marginTop: -2,
  },
  token: {
    position: "absolute",
    left: 0,
    top: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  tokenImage: {
    width: "100%",
    height: "100%",
  },
  playersCard: {
    width: "100%",
    padding: 6,
    borderWidth: 1,
    borderRadius: 16,
    gap: 4,
  },
  playerRow: {
    minHeight: 39,
    borderRadius: 11,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 9,
    gap: 9,
  },
  playerPanda: {
    width: 23,
    height: 31,
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    fontFamily: "Nunito_800ExtraBold",
    fontSize: 13,
    lineHeight: 16,
  },
  playerPosition: {
    fontFamily: "Nunito_700Bold",
    fontSize: 9,
    letterSpacing: 0.55,
    marginTop: 1,
  },
  playerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  keyCount: {
    minWidth: 34,
    height: 25,
    borderRadius: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  keyCountText: {
    fontFamily: "Nunito_800ExtraBold",
    fontSize: 12,
  },
  rollCard: {
    width: "100%",
    minHeight: 76,
    borderRadius: 17,
    flexDirection: "row",
    alignItems: "center",
    padding: 9,
    gap: 12,
  },
  dieFace: {
    position: "relative",
    width: 54,
    height: 54,
    borderRadius: 13,
    borderWidth: 1,
  },
  diePip: {
    position: "absolute",
    width: 7,
    height: 7,
    borderRadius: 4,
    marginLeft: -3.5,
    marginTop: -3.5,
  },
  rollCopy: {
    flex: 1,
  },
  rollTitle: {
    fontFamily: "Nunito_800ExtraBold",
    fontSize: 15,
    letterSpacing: 0.75,
  },
  rollSubtitle: {
    fontFamily: "Nunito_700Bold",
    fontSize: 11,
    opacity: 0.78,
    marginTop: 2,
  },
  winnerCard: {
    width: "100%",
    minHeight: 64,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
  },
  winnerText: {
    fontFamily: "Nunito_800ExtraBold",
    fontSize: 15,
  },
  messageCard: {
    width: "100%",
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 9,
  },
  messageText: {
    flex: 1,
    fontFamily: "Nunito_700Bold",
    fontSize: 12,
    lineHeight: 17,
  },
  rulesLine: {
    width: "100%",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
    paddingHorizontal: 2,
  },
  rulesText: {
    flex: 1,
    fontFamily: "Nunito_600SemiBold",
    fontSize: 11,
    lineHeight: 16,
  },
  storageWarning: {
    width: "100%",
    fontFamily: "Nunito_700Bold",
    fontSize: 11,
  },
  newGameButton: {
    minHeight: 40,
    width: "100%",
    borderWidth: 1,
    borderRadius: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  newGameText: {
    fontFamily: "Nunito_800ExtraBold",
    fontSize: 13,
  },
});