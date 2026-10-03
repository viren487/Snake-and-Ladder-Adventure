import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
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
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import {
  BOOM_SQUARE,
  KEY_SQUARES,
  LADDERS,
  LOCKED_SQUARES,
  SNAKES,
  createGame,
  playTurn,
  squareAt,
  type GameState,
  type Player,
} from "@/lib/game-engine";

const STORAGE_KEY = "snack-ladder-adventure-v1";
const EXTRA_BULLET_SQUARES = [61, 77] as const;
const MYSTERY_BOX_SQUARES = [14, 35, 51, 76] as const;
const GUN_SQUARES = [94, 95, 96] as const;
const STEP_DELAY_MS = 270;

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

function isSavedGame(value: unknown): value is GameState {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<GameState>;
  return (
    Array.isArray(candidate.players) &&
    candidate.players.length === 2 &&
    candidate.players.every(
      (player) =>
        player &&
        Number.isInteger(player.position) &&
        player.position >= 0 &&
        player.position <= 100 &&
        Number.isInteger(player.keys) &&
        player.keys >= 0,
    ) &&
    Number.isInteger(candidate.currentPlayerIndex) &&
    (candidate.currentPlayerIndex === 0 || candidate.currentPlayerIndex === 1) &&
    Number.isInteger(candidate.turnNumber) &&
    typeof candidate.message === "string"
  );
}

function Token({
  player,
  index,
  position,
  boardSize,
  stacked,
  hopping,
  specialMove,
}: {
  player: Player;
  index: number;
  position: number;
  boardSize: number;
  stacked: boolean;
  hopping: boolean;
  specialMove: boolean;
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

  useEffect(() => {
    const duration = specialMove ? 540 : 250;
    x.value = withTiming(targetX, {
      duration,
      easing: Easing.out(Easing.cubic),
    });
    y.value = withTiming(targetY, {
      duration,
      easing: Easing.out(Easing.cubic),
    });

    if (hopping && !specialMove) {
      hop.value = withSequence(
        withTiming(-cellSize * 0.2, { duration: 115, easing: Easing.out(Easing.cubic) }),
        withTiming(0, { duration: 155, easing: Easing.inOut(Easing.cubic) }),
      );
    } else {
      hop.value = withTiming(0, { duration: 120 });
    }
  }, [cellSize, hopping, specialMove, targetX, targetY, x, y, hop]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value },
      { translateY: y.value + hop.value },
    ],
  }));

  return (
    <Animated.View
      pointerEvents="none"
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
      pointerEvents="none"
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

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {[-1, 1].map((side) => (
        <View
          key={side}
          style={{
            position: "absolute",
            left: middleX + side * spacing - railWidth / 2,
            top: middleY - length / 2,
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
              transform: [{ rotate: `${angle + 90}deg` }],
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
}: {
  game: GameState;
  walking: WalkState | null;
  size: number;
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
        const bullet = (EXTRA_BULLET_SQUARES as readonly number[]).includes(number);
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
    <View style={[styles.boardFrame, { width: size + 14, backgroundColor: colors.boardFrame }]}>
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
                      <MaterialCommunityIcons name="lock" size={cellSize * 0.3} color={colors.primaryForeground} />
                    </View>
                  )}
                  {cell.keySquare && (
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
        >
          <MaterialCommunityIcons name="crown" size={cellSize * 0.43} color={colors.primaryForeground} />
          <Text style={[styles.goalNumber, { color: colors.primaryForeground, fontSize: cellSize * 0.22 }]}>100</Text>
        </View>

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
            />
          );
        })}
      </View>
    </View>
  );
}

function DiceFace({ value, color }: { value: number | null; color: string }) {
  const pips = DICE_PIPS[value ?? 1];
  return (
    <View style={styles.dieFace} accessibilityLabel={value ? `Dice showing ${value}` : "Ready to roll"}>
      {pips.map(([column, row], index) => (
        <View
          key={index}
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
      </View>
      <View style={[styles.playerDot, { backgroundColor: playerColor }]} />
      <View style={[styles.keyCount, { backgroundColor: colors.muted }]}>
        <MaterialCommunityIcons name="key-variant" size={13} color={colors.primary} />
        <Text style={[styles.keyCountText, { color: colors.foreground }]}>{player.keys}</Text>
      </View>
    </View>
  );
}

export default function GameScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [game, setGame] = useState<GameState>(createGame);
  const [hydrated, setHydrated] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [diceFace, setDiceFace] = useState<number | null>(null);
  const [walking, setWalking] = useState<WalkState | null>(null);
  const [storageError, setStorageError] = useState(false);

  useEffect(() => {
    let mounted = true;
    const loadSavedGame = async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (!mounted) return;
        if (saved) {
          const parsed: unknown = JSON.parse(saved);
          if (isSavedGame(parsed)) {
            setGame(parsed);
            setDiceFace(parsed.lastRoll);
          }
        }
      } catch {
        if (mounted) setStorageError(true);
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
    if (!hydrated) return;
    let active = true;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(game))
      .then(() => {
        if (active) setStorageError(false);
      })
      .catch(() => {
        if (active) setStorageError(true);
      });
    return () => {
      active = false;
    };
  }, [game, hydrated]);

  const currentPlayer = game.players[game.currentPlayerIndex];
  const winner = game.players.find((player) => player.id === game.winnerId);
  const boardSize = Math.min(Math.max(width - 42, 300), 440);
  const topInset = Platform.OS === "web" ? 67 : Math.max(insets.top, 12) + 8;
  const bottomInset = Platform.OS === "web" ? 34 : Math.max(insets.bottom, 12) + 8;

  const rollDice = async () => {
    if (rolling || game.winnerId) return;
    setRolling(true);
    try {
      for (let frame = 0; frame < 7; frame += 1) {
        setDiceFace(1 + Math.floor(Math.random() * 6));
        await delay(85);
      }
      const roll = 1 + Math.floor(Math.random() * 6);
      setDiceFace(roll);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);

      const player = game.players[game.currentPlayerIndex];
      const destination = player.position + roll;
      const blockedByGate =
        player.keys === 0 &&
        (LOCKED_SQUARES as readonly number[]).some(
          (square) => square > player.position && square <= destination,
        );
      const nextGame = playTurn(game, roll);

      if (destination <= 100 && !blockedByGate) {
        for (let position = Math.max(1, player.position + 1); position <= destination; position += 1) {
          setWalking({ playerId: player.id, position, isSpecialMove: false });
          void Haptics.selectionAsync().catch(() => undefined);
          await delay(STEP_DELAY_MS);
        }

        const resolvedPlayer = nextGame.players.find((item) => item.id === player.id);
        if (resolvedPlayer && resolvedPlayer.position !== destination) {
          setWalking({
            playerId: player.id,
            position: resolvedPlayer.position,
            isSpecialMove: true,
          });
          await delay(560);
        }
      }

      setGame(nextGame);
      if (nextGame.winnerId) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      }
    } catch {
      Alert.alert("Turn not completed", "The dice roll could not finish. Please try again.");
    } finally {
      setWalking(null);
      setRolling(false);
    }
  };

  const startNewGame = () => {
    if (rolling) return;
    Alert.alert("Start a new game?", "This replaces the saved round on this phone.", [
      { text: "Keep playing", style: "cancel" },
      {
        text: "New game",
        style: "destructive",
        onPress: () => {
          setGame(createGame());
          setDiceFace(null);
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
          <View style={[styles.modeChip, { backgroundColor: colors.secondary }]}>
            <View style={[styles.liveDot, { backgroundColor: colors.accent }]} />
            <Text style={[styles.modeText, { color: colors.secondaryForeground }]}>PASS &amp; PLAY</Text>
          </View>
        </View>

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
            <Text style={[styles.turnHint, { color: colors.mutedForeground }]}>LOCAL GAME</Text>
          )}
        </View>

        <Board game={game} walking={walking} size={boardSize} />

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

        {winner ? (
          <View style={[styles.winnerCard, { backgroundColor: colors.accent }]}>
            <MaterialCommunityIcons name="trophy" size={21} color={colors.accentForeground} />
            <Text style={[styles.winnerText, { color: colors.accentForeground }]}>Crown claimed. Play again?</Text>
          </View>
        ) : (
          <Pressable
            onPress={rollDice}
            disabled={rolling}
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
            <DiceFace value={diceFace} color={colors.primaryForeground} />
            <View style={styles.rollCopy}>
              <Text style={[styles.rollTitle, { color: colors.primaryForeground }]}>
                {rolling ? "ROLLING…" : "ROLL THE DICE"}
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
          <MaterialCommunityIcons name="sparkles" size={17} color={colors.primary} />
          <Text style={[styles.messageText, { color: colors.cardForeground }]} testID="game-message">
            {game.message}
          </Text>
        </View>

        <View style={styles.rulesLine}>
          <MaterialCommunityIcons name="information-outline" size={16} color={colors.mutedForeground} />
          <Text style={[styles.rulesText, { color: colors.mutedForeground }]}>
            Keys open the gates. Snakes slide you down; ladders lift you up. Reach 100 exactly to win.
          </Text>
        </View>

        {storageError && (
          <Text style={[styles.storageWarning, { color: colors.destructive }]}>
            This round may not be saved on this phone.
          </Text>
        )}

        <Pressable
          onPress={startNewGame}
          disabled={rolling}
          accessibilityRole="button"
          accessibilityLabel="Start a new game"
          testID="button-new-game"
          style={({ pressed }) => [
            styles.newGameButton,
            {
              borderColor: colors.border,
              opacity: rolling ? 0.5 : pressed ? 0.65 : 1,
            },
          ]}
        >
          <MaterialCommunityIcons name="refresh" size={17} color={colors.foreground} />
          <Text style={[styles.newGameText, { color: colors.foreground }]}>New game</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
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
    borderColor: "#d49b48",
    shadowColor: "#05070b",
    shadowOpacity: 0.35,
    shadowRadius: 13,
    shadowOffset: { width: 0, height: 6 },
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
    backgroundColor: "#fff8e8",
    borderWidth: 1,
    borderColor: "#ffffff",
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