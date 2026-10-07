import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BOOM_SQUARE,
  BULLET_PICKUP_SQUARES,
  GUN_SQUARES,
  KEY_SQUARES,
  MYSTERY_BOX_SQUARES,
  SHOOTABLE_SNAKE_SQUARES,
  choosePower,
  createGame,
  detonateBomb,
  isValidPowerState,
  passFire,
  plantBomb,
  repairLegacyGame,
  resolveDefense,
  resolveTurn,
  shootSnakes,
  useExtraDice,
  useKnife,
  useWebShooter,
  type GameState,
  type MysteryPowerType,
  type ShootableSnakeSquare,
  type TurnResolution,
} from '@workspace/game-core';
import {
  isPendingAdmission,
  isRoomSession,
  useOnlineRoom,
  type OnlineAction,
  type RoomStorage,
} from '@workspace/api-client-react';
import type { RoomSnapshot } from '@workspace/game-core/online';
import { getMrBotAction, type MrBotAction } from '@/lib/mr-bot';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { GameBoard, type BoardBlast } from '@/components/GameBoard';
import { useColors } from '@/hooks/useColors';
import { useGameSounds } from '@/lib/game-sounds';

type LocalMode = 'pass' | 'bot';
type Screen = 'home' | 'game';
type SavedRound = { id: string; mode: LocalMode; updatedAt: string; game: GameState };

const ROUNDS_KEY = 'snack-ladder-mobile:saved-rounds:v1';
const ONLINE_SEAT_KEY = 'snack-ladder-mobile:online-seat:v1';
const PROFILE_KEY = 'snack-ladder-mobile:profile:v1';
const PLAYER_COLORS = ['blue', 'coral', 'green', 'purple'] as const;

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function readGame(value: unknown): GameState {
  if (!record(value) || !Array.isArray(value.players) || value.players.length < 2 || value.players.length > 4) {
    throw new Error('This saved round is not a valid game. It has been kept unchanged.');
  }
  const candidate = value as unknown as GameState;
  const playersValid = candidate.players.every((player) =>
    record(player) &&
    typeof player.id === 'string' &&
    typeof player.name === 'string' &&
    (PLAYER_COLORS as readonly string[]).includes(player.color) &&
    Number.isInteger(player.position) &&
    player.position >= 0 &&
    player.position <= 100,
  );
  if (!playersValid ||
    !Number.isInteger(candidate.currentPlayerIndex) ||
    candidate.currentPlayerIndex < 0 ||
    candidate.currentPlayerIndex >= candidate.players.length ||
    !isValidPowerState(candidate)) {
    throw new Error('This saved round has unsupported data. It has been kept unchanged.');
  }
  return repairLegacyGame(candidate);
}

function parseRounds(raw: string | null): SavedRound[] {
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  const list = Array.isArray(parsed)
    ? parsed
    : record(parsed) && Array.isArray(parsed.rounds)
      ? parsed.rounds
      : null;
  if (!list) throw new Error('Saved rounds could not be read. The original data has not been replaced.');
  return list.map((item) => {
    if (!record(item) ||
      typeof item.id !== 'string' ||
      (item.mode !== 'pass' && item.mode !== 'bot') ||
      typeof item.updatedAt !== 'string') {
      throw new Error('A saved round has an unknown format. The original data has not been replaced.');
    }
    return {
      id: item.id,
      mode: item.mode,
      updatedAt: item.updatedAt,
      game: readGame(item.game),
    };
  });
}

function newRoundId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function niceDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Saved round'
    : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function makeLocalGame(mode: LocalMode, count: number, playerName: string, friendName: string) {
  const game = createGame(mode === 'bot' ? 2 : count);
  return {
    ...game,
    players: game.players.map((player, index) => ({
      ...player,
      name: index === 0
        ? playerName.trim().slice(0, 24) || 'Panda Player'
        : mode === 'bot'
          ? 'Mr. Bot'
          : index === 1
            ? friendName.trim().slice(0, 24) || 'Friend'
            : `Player ${index + 1}`,
    })),
  };
}

function colorForPlayer(color: string, colors: ReturnType<typeof useColors>) {
  if (color === 'coral') return colors.tokenCoral;
  if (color === 'green') return colors.tokenGreen;
  if (color === 'purple') return colors.tokenPurple;
  return colors.tokenBlue;
}

function SolidButton({
  label,
  icon,
  onPress,
  colors,
  disabled = false,
  secondary = false,
  destructive = false,
  compact = false,
  testID,
}: {
  label: string;
  icon?: React.ReactNode;
  onPress: () => void;
  colors: ReturnType<typeof useColors>;
  disabled?: boolean;
  secondary?: boolean;
  destructive?: boolean;
  compact?: boolean;
  testID?: string;
}) {
  const backgroundColor = destructive
    ? colors.destructive
    : secondary
      ? colors.secondary
      : colors.primary;
  const color = destructive
    ? colors.destructiveForeground
    : secondary
      ? colors.secondaryForeground
      : colors.primaryForeground;
  return (
    <Pressable
      accessibilityRole="button"
      testID={testID}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        { backgroundColor, opacity: disabled ? 0.45 : pressed ? 0.82 : 1 },
      ]}
    >
      {icon}
      <Text style={[styles.buttonLabel, compact && styles.buttonLabelCompact, { color }]}>{label}</Text>
    </Pressable>
  );
}

function SmallIconButton({
  label,
  icon,
  onPress,
  colors,
  testID,
}: {
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
  colors: ReturnType<typeof useColors>;
  testID?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, { borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
    >
      {icon}
    </Pressable>
  );
}

function Field({
  value,
  onChangeText,
  placeholder,
  colors,
  testID,
  maxLength,
  autoCapitalize = 'words',
  accessibilityLabel,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  colors: ReturnType<typeof useColors>;
  testID: string;
  maxLength?: number;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  accessibilityLabel: string;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.mutedForeground}
      selectionColor={colors.primary}
      autoCapitalize={autoCapitalize}
      autoCorrect={false}
      maxLength={maxLength}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      returnKeyType="done"
      onSubmitEditing={Keyboard.dismiss}
      style={[styles.input, { color: colors.foreground, backgroundColor: colors.input, borderColor: colors.border }]}
    />
  );
}

export default function IndexScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const sounds = useGameSounds();
  const muted = sounds.muted;
  const [screen, setScreen] = useState<Screen>('home');
  const [localMode, setLocalMode] = useState<LocalMode>('pass');
  const [localGame, setLocalGame] = useState<GameState | null>(null);
  const [localRoundId, setLocalRoundId] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState('Panda Player');
  const [friendName, setFriendName] = useState('Friend');
  const [localPlayerCount, setLocalPlayerCount] = useState(2);
  const [roomPlayerCount, setRoomPlayerCount] = useState(2);
  const [roomCode, setRoomCode] = useState('');
  const [savedRounds, setSavedRounds] = useState<SavedRound[]>([]);
  const [storageReady, setStorageReady] = useState(false);
  const [saveBlocked, setSaveBlocked] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [rolling, setRolling] = useState(false);
  const [diceFace, setDiceFace] = useState<number | null>(null);
  const [selectedTargets, setSelectedTargets] = useState<ShootableSnakeSquare[]>([]);
  const [fireStage, setFireStage] = useState<'decision' | 'targets'>('decision');
  const [bombBlast, setBombBlast] = useState<BoardBlast | null>(null);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const botTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMounted = useRef(true);
  const previousOnlineGame = useRef<GameState | null>(null);
  const previousBlastGame = useRef<GameState | null>(null);
  const blastSequence = useRef(0);
  const gameScrollRef = useRef<ScrollView | null>(null);

  const roomStorage = useMemo<RoomStorage>(() => ({
    async load() {
      const raw = await AsyncStorage.getItem(ONLINE_SEAT_KEY);
      if (!raw) return null;
      const value: unknown = JSON.parse(raw);
      if (!isRoomSession(value) && !isPendingAdmission(value)) {
        throw new Error('The saved room seat is invalid. It has not been overwritten.');
      }
      return value;
    },
    async save(session) {
      if (session) await AsyncStorage.setItem(ONLINE_SEAT_KEY, JSON.stringify(session));
      else await AsyncStorage.removeItem(ONLINE_SEAT_KEY);
    },
  }), []);

  const online = useOnlineRoom({
    storage: roomStorage,
    onUpdate: (room: RoomSnapshot, animate: boolean) => {
      const previous = previousOnlineGame.current;
      previousOnlineGame.current = room.game;
      if (!animate || !room.event || !previous) return;
      const bombBlast = (room.event.kind === 'detonate' || room.event.effect === 'boom') &&
        /(detonated the bomb|hit the boom)/i.test(room.game.message);
      for (const player of room.game.players) {
        const before = previous.players.find((item) => item.id === player.id);
        if (!before) continue;
        sounds.playPickups(before, player);
        if (before.position !== player.position && !bombBlast) sounds.play('step');
      }
      if (room.event.kind === 'roll') sounds.play('dice');
      if (room.event.effect === 'snake' || room.event.effect === 'ladder') sounds.play(room.event.effect);
      if (room.event.effect === 'torch') sounds.play('happy');
      if (room.event.kind === 'shoot') {
        sounds.play('fire');
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      }
    },
    onExit: () => {
      previousOnlineGame.current = null;
      setScreen('home');
      setSelectedTargets([]);
      setActionError(null);
    },
  }, React);

  useEffect(() => {
    isMounted.current = true;
    void (async () => {
      try {
        const [rawRounds, storedName] = await Promise.all([
          AsyncStorage.getItem(ROUNDS_KEY),
          AsyncStorage.getItem(PROFILE_KEY),
        ]);
        const rounds = parseRounds(rawRounds);
        setSavedRounds(rounds);
        if (storedName?.trim()) setPlayerName(storedName.trim().slice(0, 24));
      } catch (reason) {
        setSaveBlocked(true);
        setStorageError(reason instanceof Error ? reason.message : 'Saved data could not be read. It has not been replaced.');
      } finally {
        setStorageReady(true);
      }
    })();
    return () => {
      isMounted.current = false;
      if (botTimer.current) clearTimeout(botTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    const trimmed = playerName.trim().slice(0, 24);
    if (!trimmed) return;
    void AsyncStorage.setItem(PROFILE_KEY, trimmed).catch(() => {
      if (isMounted.current) setStorageError('Your name could not be saved on this device.');
    });
  }, [playerName, storageReady]);

  const persistRound = useCallback((round: SavedRound) => {
    if (saveBlocked) return;
    const task = saveQueue.current.catch(() => undefined).then(async () => {
      const stored = parseRounds(await AsyncStorage.getItem(ROUNDS_KEY));
      const next = [round, ...stored.filter((item) => item.id !== round.id)]
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      await AsyncStorage.setItem(ROUNDS_KEY, JSON.stringify({ version: 1, rounds: next }));
      if (isMounted.current) {
        setSavedRounds(next);
        setStorageError(null);
      }
    });
    saveQueue.current = task;
    void task.catch((reason) => {
      if (isMounted.current) {
        setSaveBlocked(true);
        setStorageError(reason instanceof Error ? reason.message : 'This round could not be saved; existing saves were left unchanged.');
      }
    });
  }, [saveBlocked]);

  useEffect(() => {
    if (!storageReady || !localGame || !localRoundId || online.session || saveBlocked) return;
    persistRound({
      id: localRoundId,
      mode: localMode,
      updatedAt: new Date().toISOString(),
      game: localGame,
    });
  }, [localGame, localMode, localRoundId, online.session, persistRound, saveBlocked, storageReady]);

  useEffect(() => {
    sounds.setCelebrating(!!(online.room?.game.winnerId ?? localGame?.winnerId));
  }, [localGame?.winnerId, online.room?.game.winnerId, sounds.setCelebrating]);

  const showGame = screen === 'game' || (!!online.session && !!online.room);
  const game = online.session ? online.room?.game ?? null : localGame;
  const currentPlayer = game?.players[game.currentPlayerIndex] ?? null;
  useEffect(() => {
    if (!game) {
      previousBlastGame.current = null;
      return;
    }
    const previous = previousBlastGame.current;
    previousBlastGame.current = game;
    const blastLocation = game.message.match(/(?:house|square)\s+(\d+)/i);
    if (!previous || previous.message === game.message || !/(detonated the bomb|hit the boom)/i.test(game.message)) return;
    const sourceSquare = blastLocation ? Number(blastLocation[1]) : undefined;
    const victims = game.players.flatMap((player) => {
      const before = previous.players.find((item) => item.id === player.id);
      return before && before.position > 0 && player.position === 0
        ? [{ playerId: player.id, fromSquare: sourceSquare ?? before.position }]
        : [];
    });
    if (victims.length === 0) return;
    blastSequence.current += 1;
    setBombBlast({ id: blastSequence.current, sourceSquare: victims[0].fromSquare, victims });
    sounds.play('bomb');
  }, [game, sounds.play]);
  useEffect(() => {
    if (!bombBlast) return;
    const timeout = setTimeout(() => setBombBlast(null), 2750);
    return () => clearTimeout(timeout);
  }, [bombBlast?.id]);
  useEffect(() => {
    if (screen !== 'game' || game?.pendingChoice?.kind !== 'mystery') return;
    const timeout = setTimeout(() => gameScrollRef.current?.scrollTo({ y: 0, animated: true }), 60);
    return () => clearTimeout(timeout);
  }, [screen, game?.pendingChoice?.kind, game?.pendingChoice?.square]);
  const botId = game?.players[1]?.id;
  const botTurn = !online.session && localMode === 'bot' && !!game && game.players[game.currentPlayerIndex]?.id === botId;
  const currentPlayerIsHuman = !!currentPlayer && (!botTurn || !!online.session);
  const waitingForShot = !!game && !!currentPlayer && game.pendingFireForPlayerId === currentPlayer.id;
  useEffect(() => {
    setFireStage('decision');
    setSelectedTargets([]);
  }, [game?.pendingFireForPlayerId]);
  const actionDisabled = rolling || online.busy || !!online.pendingAdmission ||
    (!!online.session && (!online.canAct || !online.connected)) ||
    (!!botTurn && !online.session);
  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;

  const saveLocalGame = useCallback((next: GameState) => {
    setLocalGame(next);
    setActionError(null);
    if (game && currentPlayer) {
      const nextPlayer = next.players.find((item) => item.id === currentPlayer.id);
      if (nextPlayer) {
        sounds.playPickups(currentPlayer, nextPlayer);
        const isBlast = /(detonated the bomb|hit the boom)/i.test(next.message);
        if (nextPlayer.position !== currentPlayer.position && !isBlast) {
          sounds.play('step');
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
        }
        if (nextPlayer.position < currentPlayer.position && /snake|slid/i.test(next.message)) sounds.play('snake');
        if (nextPlayer.position > currentPlayer.position && /climbed/i.test(next.message)) sounds.play('ladder');
      }
    }
    if (next.message !== game?.message && /collected the torch/i.test(next.message)) sounds.play('happy');
  }, [currentPlayer, game, sounds]);

  const startLocalGame = (mode: LocalMode) => {
    const next = makeLocalGame(mode, localPlayerCount, playerName, friendName);
    setLocalMode(mode);
    setLocalGame(next);
    setLocalRoundId(newRoundId());
    setSelectedTargets([]);
    setDiceFace(null);
    setActionError(null);
    setScreen('game');
  };

  const resumeRound = (round: SavedRound) => {
    try {
      const safeGame = readGame(round.game);
      setLocalMode(round.mode);
      setLocalGame(safeGame);
      setLocalRoundId(round.id);
      setDiceFace(safeGame.lastRoll);
      setSelectedTargets([]);
      setScreen('game');
      setActionError(null);
    } catch (reason) {
      setStorageError(reason instanceof Error ? reason.message : 'That saved round could not be opened.');
      setSaveBlocked(true);
    }
  };

  const deleteRound = (id: string) => {
    const task = saveQueue.current.catch(() => undefined).then(async () => {
      const stored = parseRounds(await AsyncStorage.getItem(ROUNDS_KEY));
      const next = stored.filter((round) => round.id !== id);
      await AsyncStorage.setItem(ROUNDS_KEY, JSON.stringify({ version: 1, rounds: next }));
      if (isMounted.current) {
        setSavedRounds(next);
        setStorageError(null);
      }
    });
    saveQueue.current = task;
    void task.catch((reason) => {
      if (isMounted.current) setStorageError(reason instanceof Error ? reason.message : 'The saved round was not deleted.');
    });
  };

  const remoteAction = (action: OnlineAction) => {
    const allowed = action.type === 'rematch'
      ? online.connected && !online.busy && online.room?.status === 'finished'
      : action.type === 'detonate'
        ? online.canDetonate
        : online.canAct;
    if (!allowed) return;
    setActionError(null);
    void online.action(action).then((ok) => {
      if (!ok && online.error) setActionError(online.error);
    });
  };

  const applyRoll = useCallback(async () => {
    if (!game || !currentPlayer || rolling || game.winnerId || game.pendingChoice || game.pendingFireForPlayerId) return;
    if (online.session) {
      remoteAction({ type: 'roll' });
      return;
    }
    setRolling(true);
    sounds.play('dice');
    try {
      for (let tick = 0; tick < 6; tick += 1) {
        setDiceFace(1 + Math.floor(Math.random() * 6));
        await new Promise((resolve) => setTimeout(resolve, 65));
      }
      const roll = 1 + Math.floor(Math.random() * 6);
      setDiceFace(roll);
      const resolution = resolveTurn(game, roll);
      saveLocalGame(resolution.state);
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : 'The move could not be completed.');
    } finally {
      if (isMounted.current) setRolling(false);
    }
  }, [currentPlayer, game, online.session, remoteAction, rolling, saveLocalGame, sounds]);

  const chooseAimTargets = (choice: '98' | '99' | 'both') => {
    if (actionDisabled || !waitingForShot || !currentPlayer) return;
    const targets: ShootableSnakeSquare[] = choice === 'both' ? [98, 99] : [choice === '98' ? 98 : 99];
    if (targets.length > currentPlayer.bullets || targets.some((target) => currentPlayer.snakeStuns[target] > 0)) return;
    setSelectedTargets((current) =>
      current.length === targets.length && current.every((target, index) => target === targets[index]) ? [] : targets,
    );
  };

  const fireSelected = () => {
    if (!game || !waitingForShot || actionDisabled || selectedTargets.length === 0) return;
    if (online.session) {
      remoteAction({ type: 'shoot', targets: selectedTargets });
    } else {
      try {
        sounds.play('fire');
        saveLocalGame(shootSnakes(game, selectedTargets));
      } catch (reason) {
        setActionError(reason instanceof Error ? reason.message : 'The shot could not be fired.');
      }
    }
    setSelectedTargets([]);
  };

  const leaveShot = () => {
    if (!game || !waitingForShot || actionDisabled) return;
    if (online.session) remoteAction({ type: 'pass' });
    else saveLocalGame(passFire(game));
    setSelectedTargets([]);
    setFireStage('decision');
  };

  const currentPowerAction = (onlineAction: OnlineAction, localRun: (state: GameState) => GameState | TurnResolution) => {
    const remoteDetonation = !!online.session && onlineAction.type === 'detonate';
    if (!game || (remoteDetonation ? !online.canDetonate : actionDisabled)) return;
    if (online.session) {
      remoteAction(onlineAction);
      return;
    }
    try {
      const result = localRun(game);
      if ('state' in result) {
        saveLocalGame(result.state);
      } else {
        saveLocalGame(result);
      }
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : 'That power could not be used.');
    }
  };

  const activeRivals = game && currentPlayer
    ? game.players.filter((player) => player.id !== currentPlayer.id && !(game.winnerIds ?? []).includes(player.id))
    : [];
  const usableBomb = game?.bombs.find((bomb) =>
    (!online.session || (bomb.ownerId === online.session.playerId && online.canDetonate)) &&
    (game.players.find((player) => player.id === bomb.ownerId)?.position === bomb.square ||
      (bomb.armed && game.players.some((player) => player.id !== bomb.ownerId && player.position === bomb.square && !(game.winnerIds ?? []).includes(player.id)))),
  );
  const readyToPlant = !!game && !!currentPlayer && currentPlayer.powers.bomb > 0 &&
    currentPlayer.position > 0 && !game.bombs.some((bomb) => bomb.square === currentPlayer.position);

  const performBotAction = useCallback((action: MrBotAction, state: GameState) => {
    try {
      switch (action.type) {
        case 'roll': {
          const roll = 1 + Math.floor(Math.random() * 6);
          setDiceFace(roll);
          sounds.play('dice');
          const result = resolveTurn(state, roll);
          saveLocalGame(result.state);
          break;
        }
        case 'choose': saveLocalGame(choosePower(state, action.power)); break;
        case 'defend': {
          const result = resolveDefense(state, action.use);
          saveLocalGame(result.state);
          break;
        }
        case 'shoot': sounds.play('fire'); saveLocalGame(shootSnakes(state, action.targets)); break;
        case 'pass-shot': saveLocalGame(passFire(state)); break;
        case 'extra-dice': saveLocalGame(useExtraDice(state)); break;
        case 'web': saveLocalGame(useWebShooter(state, action.targetPlayerId).state); break;
        case 'knife': saveLocalGame(useKnife(state, action.targetPlayerId).state); break;
        case 'plant': saveLocalGame(plantBomb(state, action.square)); break;
        case 'detonate': {
          const bomb = state.bombs.find((item) => item.id === action.bombId);
          if (bomb) saveLocalGame(detonateBomb(state, bomb.id, bomb.ownerId));
          break;
        }
      }
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : 'Mr. Bot could not make a move.');
    }
  }, [saveLocalGame, sounds]);

  useEffect(() => {
    if (botTimer.current) clearTimeout(botTimer.current);
    if (online.session || online.loadingSession || online.pendingAdmission || localMode !== 'bot' ||
      !showGame || !localGame || !botId) return;
    const action = getMrBotAction(localGame, botId);
    if (!action) return;
    botTimer.current = setTimeout(() => {
      botTimer.current = null;
      if (isMounted.current) performBotAction(action, localGame);
    }, 550);
    return () => {
      if (botTimer.current) clearTimeout(botTimer.current);
      botTimer.current = null;
    };
  }, [botId, localGame, localMode, online.loadingSession, online.pendingAdmission, online.session, performBotAction, showGame]);

  const createOnlineRoom = () => {
    Keyboard.dismiss();
    setActionError(null);
    void online.create(playerName.trim().slice(0, 24) || 'Panda Player', roomPlayerCount);
  };

  const joinOnlineRoom = () => {
    Keyboard.dismiss();
    if (roomCode.trim().length !== 6) {
      setActionError('Enter the six-character room code.');
      return;
    }
    setActionError(null);
    void online.join(roomCode.trim().toUpperCase(), playerName.trim().slice(0, 24) || 'Panda Player');
  };

  const shareRoomCode = async (code: string) => {
    try {
      await Share.share({ message: `Join my Snake & Ladder Adventure room: ${code}` });
    } catch {
      setActionError(`Room code: ${code}`);
    }
  };

  const leaveRoom = () => {
    setActionError(null);
    void online.leave();
  };

  const roomStatus = online.room;
  const renderRoomCard = (compact = false) => {
    if (!online.session) return null;
    if (!roomStatus) {
      return (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.row}>
            <ActivityIndicator color={colors.primary} />
            <Text style={[styles.body, { color: colors.foreground }]}>Restoring your saved room seat…</Text>
          </View>
          {!!online.error && <Text style={[styles.errorText, { color: colors.destructive }]}>{online.error}</Text>}
          <View style={styles.row}>
            <SolidButton label="Retry" icon={<Feather name="refresh-cw" size={15} color={colors.primaryForeground} />} onPress={() => void online.retry()} colors={colors} compact />
            {!online.pendingAdmission && <SolidButton label="Back to local games" onPress={leaveRoom} colors={colors} secondary compact />}
          </View>
        </View>
      );
    }
    const myMember = roomStatus.members.find((member) => member.id === roomStatus.yourPlayerId);
    return (
      <View style={[styles.card, compact && styles.compactCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.sectionHeader}>
          <View style={styles.roomBadge}>
            <Feather name="globe" size={14} color={colors.accent} />
            <Text style={[styles.eyebrow, { color: colors.accent }]}>ONLINE ROOM</Text>
          </View>
          <Text style={[styles.roomCode, { color: colors.primary }]}>{roomStatus.code}</Text>
        </View>
        <Text style={[styles.body, { color: colors.foreground }]}>
          {myMember?.name ?? 'You'} · {roomStatus.members.length}/{roomStatus.maxPlayers} players · {roomStatus.status}
        </Text>
        <View style={styles.memberList}>
          {roomStatus.members.map((member, index) => (
            <View key={member.id} style={styles.memberRow}>
              <View style={[styles.statusDot, { backgroundColor: member.online ? colors.accent : colors.mutedForeground }]} />
              <Text style={[styles.memberName, { color: colors.foreground }]} numberOfLines={1}>
                {member.name}{member.id === roomStatus.yourPlayerId ? ' (you)' : ''}
              </Text>
              <Text style={[styles.memberState, { color: colors.mutedForeground }]}>{member.online ? 'online' : 'offline'}</Text>
            </View>
          ))}
        </View>
        {roomStatus.status === 'waiting' && (
          <Text style={[styles.note, { color: colors.mutedForeground }]}>
            Waiting for {roomStatus.maxPlayers - roomStatus.members.length} more player{roomStatus.maxPlayers - roomStatus.members.length === 1 ? '' : 's'}.
          </Text>
        )}
        {roomStatus.status === 'playing' && roomStatus.members.some((member) => !member.online && !roomStatus.game.winnerIds.includes(member.id)) && (
          <Text style={[styles.note, { color: colors.mutedForeground }]}>An unfinished player is offline. Their original device can reconnect to the same seat.</Text>
        )}
        {roomStatus.status === 'finished' && (
          <SolidButton
            label={roomStatus.rematchVotes.includes(roomStatus.yourPlayerId) ? 'Waiting for rematch votes' : 'Request rematch'}
            onPress={() => remoteAction({ type: 'rematch' })}
            colors={colors}
            disabled={online.busy || !online.connected || roomStatus.rematchVotes.includes(roomStatus.yourPlayerId)}
          />
        )}
        {!!online.error && <Text style={[styles.errorText, { color: colors.destructive }]}>{online.error}</Text>}
        <View style={styles.row}>
          <SolidButton
            label="Share code"
            icon={<Feather name="share-2" size={15} color={colors.primaryForeground} />}
            onPress={() => void shareRoomCode(roomStatus.code)}
            colors={colors}
            compact
          />
          <SolidButton
            label={roomStatus.status === 'closed' ? 'Back to local' : 'Leave room'}
            icon={<Feather name="log-out" size={15} color={colors.secondaryForeground} />}
            onPress={leaveRoom}
            colors={colors}
            secondary
            compact
          />
        </View>
      </View>
    );
  };

  const renderSavedRounds = () => (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.sectionHeader}>
        <View>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>Saved rounds</Text>
          <Text style={[styles.note, { color: colors.mutedForeground }]}>Your local games stay on this device.</Text>
        </View>
        <Text style={[styles.roundCount, { color: colors.mutedForeground }]}>{savedRounds.length}</Text>
      </View>
      {savedRounds.length === 0 ? (
        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Your next round will appear here automatically.</Text>
      ) : (
        savedRounds.slice(0, 8).map((round) => {
          const activeName = round.game.players[round.game.currentPlayerIndex]?.name ?? 'Saved round';
          return (
            <View key={round.id} style={[styles.savedRow, { borderTopColor: colors.border }]}>
              <View style={styles.savedInfo}>
                <Text style={[styles.savedName, { color: colors.foreground }]} numberOfLines={1}>
                  {round.mode === 'bot' ? 'Mr. Bot' : 'Pass & Play'} · {activeName}
                </Text>
                <Text style={[styles.note, { color: colors.mutedForeground }]}>{niceDate(round.updatedAt)} · {round.game.players.length} players</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Resume saved round"
                testID={`resume-round-${round.id}`}
                onPress={() => resumeRound(round)}
                style={[styles.roundAction, { backgroundColor: colors.secondary }]}
              >
                <Feather name="play" size={15} color={colors.secondaryForeground} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Delete saved round"
                testID={`delete-round-${round.id}`}
                onPress={() => deleteRound(round.id)}
                style={[styles.roundAction, { backgroundColor: colors.muted }]}
              >
                <Feather name="trash-2" size={15} color={colors.mutedForeground} />
              </Pressable>
            </View>
          );
        })
      )}
      {savedRounds.length > 8 && <Text style={[styles.note, { color: colors.mutedForeground }]}>Showing the 8 most recent rounds.</Text>}
    </View>
  );

  if (!showGame || !game || !currentPlayer) {
    return (
      <KeyboardAwareScrollViewCompat
        style={[styles.screen, { backgroundColor: colors.background }]}
        contentContainerStyle={[styles.homeContent, { paddingTop: topInset + 12, paddingBottom: bottomInset + 28 }]}
        bottomOffset={30}
        keyboardShouldPersistTaps="handled"
        testID="home-screen"
      >
        <View style={styles.homeHeader}>
          <Image source={require('../assets/images/icon.png')} style={styles.appIcon} accessibilityLabel="Panda with a crown" />
          <View style={styles.brandCopy}>
            <Text style={[styles.brandTitle, { color: colors.foreground }]}>Snake & Ladder</Text>
            <Text style={[styles.brandSubtitle, { color: colors.mutedForeground }]}>ADVENTURE · PANDA EDITION</Text>
          </View>
          <SmallIconButton
            label={muted ? 'Turn sound on' : 'Mute sound'}
            onPress={() => sounds.toggleMuted()}
            colors={colors}
            icon={<Feather name={muted ? 'volume-x' : 'volume-2'} size={18} color={colors.foreground} />}
            testID="sound-toggle"
          />
        </View>

        <View style={[styles.heroCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.eyebrow, { color: colors.primary }]}>A CLASSIC QUEST, WITH A TWIST</Text>
          <Text style={[styles.heroTitle, { color: colors.foreground }]}>Roll, climb, and claim the crown.</Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>
            Reach 100 for a torch, find a key in a black room, then return to unlock the crown.
          </Text>
          <View style={styles.fieldLabelRow}>
            <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Your panda name</Text>
          </View>
          <Field value={playerName} onChangeText={setPlayerName} placeholder="Panda Player" maxLength={24} colors={colors} testID="player-name" accessibilityLabel="Your panda name" />
          <View style={styles.modeCardRow}>
            <Pressable
              accessibilityRole="button"
              testID="start-pass-play"
              onPress={() => startLocalGame('pass')}
              style={({ pressed }) => [styles.modeCard, { backgroundColor: colors.primary, opacity: pressed ? 0.82 : 1 }]}
            >
              <MaterialCommunityIcons name="account-multiple" size={22} color={colors.primaryForeground} />
              <Text style={[styles.modeTitle, { color: colors.primaryForeground }]}>Pass & Play</Text>
              <Text style={[styles.modeDescription, { color: colors.primaryForeground }]}>Take turns on one device</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              testID="start-mr-bot"
              onPress={() => startLocalGame('bot')}
              style={({ pressed }) => [styles.modeCard, { backgroundColor: colors.secondary, borderColor: colors.border, opacity: pressed ? 0.82 : 1 }]}
            >
              <MaterialCommunityIcons name="robot-happy-outline" size={22} color={colors.accent} />
              <Text style={[styles.modeTitle, { color: colors.foreground }]}>Play Mr. Bot</Text>
              <Text style={[styles.modeDescription, { color: colors.mutedForeground }]}>A panda opponent, any time</Text>
            </Pressable>
          </View>
          <View style={styles.fieldLabelRow}>
            <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Pass & Play players</Text>
            <View style={styles.row}>
              {[2, 3, 4].map((count) => (
                <Pressable
                  key={count}
                  accessibilityRole="button"
                  accessibilityState={{ selected: localPlayerCount === count }}
                  testID={`local-player-count-${count}`}
                  onPress={() => setLocalPlayerCount(count)}
                  style={[styles.countChip, { backgroundColor: localPlayerCount === count ? colors.primary : colors.secondary }]}
                >
                  <Text style={[styles.countChipText, { color: localPlayerCount === count ? colors.primaryForeground : colors.secondaryForeground }]}>{count}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          {localPlayerCount > 1 && (
            <Field value={friendName} onChangeText={setFriendName} placeholder="Friend" maxLength={24} colors={colors} testID="friend-name" accessibilityLabel="Second player name" />
          )}
        </View>

        {!online.session && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={[styles.cardTitle, { color: colors.foreground }]}>Play online</Text>
                <Text style={[styles.note, { color: colors.mutedForeground }]}>Invite 1–3 friends on other devices.</Text>
              </View>
              <Feather name="globe" size={20} color={colors.accent} />
            </View>
            <View style={styles.fieldLabelRow}>
              <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Room size</Text>
              <View style={styles.row}>
                {[2, 3, 4].map((count) => (
                  <Pressable
                    key={count}
                    accessibilityRole="button"
                    accessibilityState={{ selected: roomPlayerCount === count }}
                    testID={`room-size-${count}`}
                    onPress={() => setRoomPlayerCount(count)}
                    style={[styles.countChip, { backgroundColor: roomPlayerCount === count ? colors.primary : colors.secondary }]}
                  >
                    <Text style={[styles.countChipText, { color: roomPlayerCount === count ? colors.primaryForeground : colors.secondaryForeground }]}>{count}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <SolidButton label={online.busy ? 'Creating room…' : 'Create a room'} icon={<Feather name="plus" size={16} color={colors.primaryForeground} />} onPress={createOnlineRoom} colors={colors} disabled={online.busy || online.loadingSession} testID="create-room" />
            <View style={styles.inputRow}>
              <Field
                value={roomCode}
                onChangeText={(value) => setRoomCode(value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                placeholder="6-character code"
                maxLength={6}
                autoCapitalize="characters"
                colors={colors}
                testID="room-code-input"
                accessibilityLabel="Room code"
              />
              <SolidButton label="Join" onPress={joinOnlineRoom} colors={colors} secondary disabled={online.busy || roomCode.trim().length !== 6} testID="join-room" />
            </View>
            <Text style={[styles.note, { color: colors.mutedForeground }]}>Rooms start when everyone joins. Local saved rounds stay separate.</Text>
            {!!online.error && <Text style={[styles.errorText, { color: colors.destructive }]}>{online.error}</Text>}
          </View>
        )}

        {!!online.session && renderRoomCard()}
        {!storageReady && (
          <View style={styles.row}>
            <ActivityIndicator color={colors.primary} />
            <Text style={[styles.note, { color: colors.mutedForeground }]}>Loading your saved rounds…</Text>
          </View>
        )}
        {!!storageError && <Text style={[styles.errorText, { color: colors.destructive }]}>{storageError}</Text>}
        {renderSavedRounds()}
      </KeyboardAwareScrollViewCompat>
    );
  }

  const winningPlayers = game.players.filter((player) => (game.winnerIds ?? []).includes(player.id));
  const losingPlayer = game.players.find((player) => player.id === game.loserId);
  const onlineMode = !!online.session;
  const turnLocked = actionDisabled || !currentPlayerIsHuman;
  const noUnspentLandingChoice = !game.pendingChoice && !game.pendingFireForPlayerId;
  const powerButtons = currentPlayer.powers;
  const playerProgress = (game.winnerIds ?? []).includes(currentPlayer.id) || game.winnerId === currentPlayer.id
    ? 'Crown claimed'
    : currentPlayer.crownKeyRoom !== null
      ? 'Return to 100 with your key'
      : currentPlayer.hasTorch
        ? 'Find a key in room 17, 44 or 67'
        : 'Reach 100 to collect the torch';

  return (
    <ScrollView
      ref={gameScrollRef}
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.gameContent, { paddingTop: topInset + 8, paddingBottom: bottomInset + 28 }]}
      keyboardShouldPersistTaps="handled"
      testID="game-screen"
    >
      <View style={styles.gameHeader}>
        <View style={styles.brandLockup}>
          <Image source={require('../assets/images/icon.png')} style={styles.gameIcon} accessibilityLabel="Panda with a crown" />
          <View>
            <Text style={[styles.gameBrand, { color: colors.foreground }]}>Snake & Ladder</Text>
            <Text style={[styles.brandSubtitle, { color: colors.mutedForeground }]}>ADVENTURE</Text>
          </View>
        </View>
        <View style={styles.row}>
          <SmallIconButton
            label={muted ? 'Turn sound on' : 'Mute sound'}
            onPress={() => sounds.toggleMuted()}
            colors={colors}
            icon={<Feather name={muted ? 'volume-x' : 'volume-2'} size={17} color={colors.foreground} />}
            testID="sound-toggle"
          />
          {!onlineMode && (
            <SmallIconButton
              label="Back to games"
              onPress={() => setScreen('home')}
              colors={colors}
              icon={<Feather name="home" size={17} color={colors.foreground} />}
              testID="back-home"
            />
          )}
        </View>
      </View>

      {onlineMode && renderRoomCard(true)}
      {!onlineMode && (
        <View style={[styles.turnBanner, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <View style={[styles.statusDot, { backgroundColor: colorForPlayer(currentPlayer.color, colors) }]} />
          <Text style={[styles.turnText, { color: colors.secondaryForeground }]}>{currentPlayer.name}{botTurn ? ' is thinking…' : ' to play'}</Text>
          <Text style={[styles.modeTag, { color: colors.mutedForeground }]}>{localMode === 'bot' ? 'VS MR. BOT' : 'PASS & PLAY'}</Text>
        </View>
      )}

      <View style={styles.playerStrip}>
        {game.players.map((player, index) => {
          const crowned = (game.winnerIds ?? []).includes(player.id) || game.winnerId === player.id;
          return (
            <View
              key={player.id}
              testID={`player-status-${player.id}`}
              style={[
                styles.playerCard,
                {
                  backgroundColor: colors.card,
                  borderColor: index === game.currentPlayerIndex && !game.winnerId ? colorForPlayer(player.color, colors) : colors.border,
                  opacity: crowned ? 0.8 : 1,
                },
              ]}
            >
              <View style={[styles.playerDot, { backgroundColor: colorForPlayer(player.color, colors) }]} />
              <View style={styles.playerMeta}>
                <Text style={[styles.playerName, { color: colors.foreground }]} numberOfLines={1}>{player.name}</Text>
                <Text style={[styles.playerPosition, { color: colors.mutedForeground }]}>
                  {crowned ? 'CROWN CLAIMED' : player.position === 0 ? 'HOME' : `ROOM ${player.position}`}
                </Text>
              </View>
              <Text style={[styles.ammoText, { color: colors.primary }]}>{player.bullets}/{5}</Text>
            </View>
          );
        })}
      </View>

      <GameBoard
        game={game}
        selectedTargets={selectedTargets}
        bombBlast={bombBlast}
        mysterySquare={game.pendingChoice?.kind === 'mystery' ? game.pendingChoice.square : null}
        mysteryCanChoose={currentPlayerIsHuman && !actionDisabled && (!onlineMode || online.canAct)}
        mysteryBusy={actionDisabled}
        onChooseMystery={(power) => currentPowerAction({ type: 'choose', power }, (state) => choosePower(state, power))}
      />

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.eyebrow, { color: colors.primary }]}>CROWN QUEST</Text>
        <Text style={[styles.questTitle, { color: colors.foreground }]}>{playerProgress}</Text>
        <View style={styles.questSteps}>
          {[
            { label: 'Torch', done: currentPlayer.hasTorch || currentPlayer.crownKeyRoom !== null || !!game.winnerId && game.winnerIds.includes(currentPlayer.id) },
            { label: 'Key', done: currentPlayer.crownKeyRoom !== null || !!game.winnerId && game.winnerIds.includes(currentPlayer.id) },
            { label: 'Crown', done: !!game.winnerId && game.winnerIds.includes(currentPlayer.id) },
          ].map((step) => (
            <View key={step.label} style={styles.questStep}>
              <View style={[styles.questDot, { backgroundColor: step.done ? colors.accent : colors.muted }]} />
              <Text style={[styles.questStepText, { color: step.done ? colors.accent : colors.mutedForeground }]}>{step.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={[styles.actionPanel, { backgroundColor: colors.card, borderColor: colors.border }]} testID="game-controls">
        {waitingForShot ? (
          <View style={[styles.aimFlow, { backgroundColor: colors.background, borderColor: colors.border }]} testID="fire-choice">
            <View style={styles.aimHeader}>
              <Text style={[styles.eyebrow, { color: colors.primary }]}>GUN ROOM · {currentPlayer.position}</Text>
              <Text style={[styles.aimAmmo, { color: colors.mutedForeground }]}>{currentPlayer.bullets}/{5} bullets</Text>
            </View>
            {fireStage === 'decision' ? (
              <View style={styles.aimDecisionRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Fire now and choose a target"
                  onPress={() => setFireStage('targets')}
                  disabled={actionDisabled || currentPlayer.bullets < 1 || currentPlayer.snakeStuns[98] > 0 && currentPlayer.snakeStuns[99] > 0}
                  style={[styles.aimDecisionButton, { backgroundColor: colors.destructive, borderColor: colors.destructive, opacity: actionDisabled ? 0.55 : 1 }]}
                  testID="button-fire-start"
                >
                  <Feather name="crosshair" size={16} color={colors.primaryForeground} />
                  <Text style={[styles.aimDecisionLabel, { color: colors.primaryForeground }]}>Fire</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Leave this shot"
                  onPress={leaveShot}
                  disabled={actionDisabled}
                  style={[styles.aimDecisionButton, { backgroundColor: colors.card, borderColor: colors.border, opacity: actionDisabled ? 0.55 : 1 }]}
                  testID="button-pass-fire"
                >
                  <Text style={[styles.aimDecisionLabel, { color: colors.foreground }]}>Leave this time</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <Text style={[styles.note, { color: colors.mutedForeground }]}>Choose a target. Red circles mark your aim.</Text>
                <View style={styles.aimTargetRow} accessibilityRole="radiogroup">
                  {([
                    { choice: '98', label: '98', valid: currentPlayer.bullets > 0 && currentPlayer.snakeStuns[98] === 0 },
                    { choice: '99', label: '99', valid: currentPlayer.bullets > 0 && currentPlayer.snakeStuns[99] === 0 },
                    { choice: 'both', label: 'Both', valid: currentPlayer.bullets >= 2 && currentPlayer.snakeStuns[98] === 0 && currentPlayer.snakeStuns[99] === 0 },
                  ] as const).map(({ choice, label, valid }) => {
                    const selected = choice === 'both'
                      ? selectedTargets.length === 2
                      : selectedTargets.length === 1 && selectedTargets[0] === Number(choice);
                    return (
                      <Pressable
                        key={choice}
                        accessibilityRole="radio"
                        accessibilityLabel={label === 'Both' ? 'Target both snakes using two bullets' : `Target snake ${label}`}
                        accessibilityState={{ checked: selected, disabled: !valid || actionDisabled }}
                        onPress={() => chooseAimTargets(choice)}
                        disabled={!valid || actionDisabled}
                        style={[
                          styles.aimTargetOption,
                          { backgroundColor: selected ? colors.destructive : colors.card, borderColor: selected ? colors.destructive : colors.border, opacity: valid ? 1 : 0.4 },
                        ]}
                        testID={`aim-choice-${choice}`}
                      >
                        <Text style={[styles.aimTargetOptionLabel, { color: selected ? colors.primaryForeground : colors.foreground }]}>{label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <View style={styles.aimSubmitRow}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={selectedTargets.length === 2 ? 'Fire at both snakes' : selectedTargets.length === 1 ? `Fire at snake ${selectedTargets[0]}` : 'Choose a target before firing'}
                    onPress={fireSelected}
                    disabled={actionDisabled || selectedTargets.length === 0 || selectedTargets.length > currentPlayer.bullets}
                    style={[styles.aimFireSubmit, { backgroundColor: colors.destructive, opacity: actionDisabled || selectedTargets.length === 0 ? 0.48 : 1 }]}
                    testID="fire-shot"
                  >
                    <Feather name="crosshair" size={16} color={colors.primaryForeground} />
                    <Text style={[styles.aimDecisionLabel, { color: colors.primaryForeground }]}>
                      {selectedTargets.length === 2 ? 'Fire both' : selectedTargets.length === 1 ? `Fire ${selectedTargets[0]}` : 'Fire'}
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Leave this shot"
                    onPress={leaveShot}
                    disabled={actionDisabled}
                    style={styles.aimLeaveLink}
                    testID="button-pass-fire"
                  >
                    <Text style={[styles.aimLeaveLabel, { color: colors.mutedForeground }]}>Leave</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        ) : (
          <View style={styles.actionTopRow}>
            <View>
              <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>LAST ROLL</Text>
              <Text style={[styles.diceResult, { color: colors.foreground }]}>{diceFace ?? game.lastRoll ?? '—'}</Text>
            </View>
            <SolidButton
              label={rolling ? 'Rolling…' : onlineMode && !online.canAct ? 'Waiting for turn' : 'Roll dice'}
              icon={<MaterialCommunityIcons name="dice-6" size={20} color={colors.primaryForeground} />}
              onPress={() => void applyRoll()}
              colors={colors}
              disabled={turnLocked || !!game.winnerId || !!game.pendingChoice || !!game.pendingFireForPlayerId || (onlineMode && roomStatus?.status !== 'playing')}
              testID="roll-dice"
            />
          </View>
        )}
        <Text style={[styles.gameMessage, { color: colors.foreground }]} accessibilityLiveRegion="polite" testID="game-message">{game.message}</Text>

        {onlineMode && roomStatus?.status === 'waiting' && (
          <Text style={[styles.note, { color: colors.mutedForeground }]}>Share the room code above. The round begins when all {roomStatus.maxPlayers} players are ready.</Text>
        )}

        {game.pendingChoice?.kind === 'mystery' && (
          <View style={styles.choiceBlock}>
            <Text style={[styles.sectionLabel, { color: colors.foreground }]}>Choose a power from the compact tray at the board’s bottom-right.</Text>
          </View>
        )}

        {(game.pendingChoice?.kind === 'snake' || game.pendingChoice?.kind === 'bomb') && (
          <View style={styles.choiceBlock}>
            <Text style={[styles.sectionLabel, { color: colors.foreground }]}>
              {game.pendingChoice.kind === 'snake' ? 'A snake is here. Use Anti-Venom?' : 'A bomb room. Use a Defuser Kit?'}
            </Text>
            <View style={styles.row}>
              <SolidButton
                label="Use protection"
                icon={<Feather name="shield" size={15} color={colors.primaryForeground} />}
                onPress={() => currentPowerAction({ type: 'defense', use: true }, (state) => resolveDefense(state, true))}
                colors={colors}
                disabled={!currentPlayerIsHuman || actionDisabled || onlineMode && !online.canAct}
                compact
              />
              <SolidButton
                label="Save it"
                onPress={() => currentPowerAction({ type: 'defense', use: false }, (state) => resolveDefense(state, false))}
                colors={colors}
                secondary
                disabled={!currentPlayerIsHuman || actionDisabled || onlineMode && !online.canAct}
                compact
              />
            </View>
          </View>
        )}

        {noUnspentLandingChoice && !game.winnerId && currentPlayerIsHuman && (
          <View style={styles.choiceBlock}>
            <Text style={[styles.sectionLabel, { color: colors.foreground }]}>Power stash</Text>
            <View style={styles.wrapRow}>
              {powerButtons.extraDice > 0 && (
                <SolidButton label={`Extra Dice · ${powerButtons.extraDice}`} onPress={() => currentPowerAction({ type: 'extraDice' }, (state) => useExtraDice(state))} colors={colors} secondary compact disabled={turnLocked} />
              )}
              {powerButtons.webShooter > 0 && activeRivals.filter((rival) => rival.position > currentPlayer.position && rival.position - currentPlayer.position <= 3).map((rival) => (
                <SolidButton key={`web-${rival.id}`} label={`Web · ${rival.name}`} onPress={() => currentPowerAction({ type: 'web', targetPlayerId: rival.id }, (state) => useWebShooter(state, rival.id))} colors={colors} secondary compact disabled={turnLocked} />
              ))}
              {powerButtons.knife > 0 && activeRivals.filter((rival) => currentPlayer.position > 0 && rival.position === currentPlayer.position).map((rival) => (
                <SolidButton key={`knife-${rival.id}`} label={`Knife · ${rival.name}`} onPress={() => currentPowerAction({ type: 'knife', targetPlayerId: rival.id }, (state) => useKnife(state, rival.id))} colors={colors} secondary compact disabled={turnLocked} />
              ))}
              {readyToPlant && (
                <SolidButton label="Plant bomb here" icon={<Feather name="target" size={14} color={colors.secondaryForeground} />} onPress={() => currentPowerAction({ type: 'plant', square: currentPlayer.position }, (state) => plantBomb(state, currentPlayer.position))} colors={colors} secondary compact disabled={turnLocked} />
              )}
              {!!usableBomb && (
                <SolidButton label={`Detonate room ${usableBomb.square}`} destructive onPress={() => currentPowerAction({ type: 'detonate', bombId: usableBomb.id }, (state) => detonateBomb(state, usableBomb.id, online.session?.playerId ?? usableBomb.ownerId))} colors={colors} compact disabled={rolling || online.busy || onlineMode && !online.canDetonate} testID="detonate-bomb" />
              )}
            </View>
            {powerButtons.antiVenom + powerButtons.defuser + powerButtons.bomb + powerButtons.webShooter + powerButtons.knife + powerButtons.extraDice === 0 && (
              <Text style={[styles.note, { color: colors.mutedForeground }]}>Land on a mystery room to choose a power.</Text>
            )}
          </View>
        )}

        {!!actionError && <Text style={[styles.errorText, { color: colors.destructive }]} accessibilityRole="alert">{actionError}</Text>}
        {!!online.error && <Text style={[styles.errorText, { color: colors.destructive }]} accessibilityRole="alert">{online.error}</Text>}
        {!!storageError && <Text style={[styles.note, { color: colors.mutedForeground }]}>{storageError}</Text>}
      </View>

      {!!game.winnerId && (
        <View style={[styles.card, { backgroundColor: colors.accent, borderColor: colors.accent }]}>
          <Text style={[styles.questTitle, { color: colors.accentForeground }]}>{winningPlayers.map((player) => player.name).join(', ')} claimed the crown!</Text>
          <Text style={[styles.body, { color: colors.accentForeground }]}>
            {losingPlayer ? `${losingPlayer.name} finished last and loses; the other players win.` : 'The finish order is complete.'}
          </Text>
          {!onlineMode && <SolidButton label="Start a new round" onPress={() => setScreen('home')} colors={colors} secondary />}
        </View>
      )}
    </ScrollView>
  );
}

 const styles = StyleSheet.create({
  screen: { flex: 1 },
  homeContent: { paddingHorizontal: 16, gap: 14 },
  gameContent: { paddingHorizontal: 12, gap: 11 },
  homeHeader: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 2 },
  appIcon: { width: 54, height: 54, borderRadius: 17 },
  brandCopy: { flex: 1 },
  brandTitle: { fontFamily: 'Fredoka_600SemiBold', fontSize: 22, letterSpacing: 0.1 },
  brandSubtitle: { fontFamily: 'Nunito_700Bold', fontSize: 9, letterSpacing: 1.35, marginTop: 2 },
  heroCard: { padding: 17, borderRadius: 22, borderWidth: 1, gap: 10 },
  eyebrow: { fontFamily: 'Nunito_700Bold', fontSize: 10, letterSpacing: 1.1 },
  heroTitle: { fontFamily: 'Fredoka_600SemiBold', fontSize: 28, lineHeight: 32, marginTop: -3 },
  body: { fontFamily: 'Nunito_600SemiBold', fontSize: 14, lineHeight: 20 },
  fieldLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 3, gap: 8 },
  fieldLabel: { fontFamily: 'Nunito_700Bold', fontSize: 13 },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, fontFamily: 'Nunito_600SemiBold', fontSize: 14 },
  modeCardRow: { flexDirection: 'row', gap: 9, marginTop: 3 },
  modeCard: { flex: 1, minHeight: 106, borderWidth: 1, borderColor: 'transparent', padding: 12, borderRadius: 17, gap: 4, justifyContent: 'center' },
  modeTitle: { fontFamily: 'Fredoka_600SemiBold', fontSize: 17, marginTop: 2 },
  modeDescription: { fontFamily: 'Nunito_600SemiBold', fontSize: 11, lineHeight: 15 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  wrapRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  countChip: { minWidth: 44, minHeight: 42, paddingHorizontal: 12, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  countChipText: { fontFamily: 'Nunito_700Bold', fontSize: 13 },
  card: { padding: 15, borderRadius: 20, borderWidth: 1, gap: 10 },
  compactCard: { padding: 12, borderRadius: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  cardTitle: { fontFamily: 'Fredoka_600SemiBold', fontSize: 20 },
  note: { fontFamily: 'Nunito_600SemiBold', fontSize: 11, lineHeight: 16 },
  roomBadge: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  roomCode: { fontFamily: 'Nunito_700Bold', fontSize: 18, letterSpacing: 2 },
  memberList: { gap: 6 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  memberName: { flex: 1, fontFamily: 'Nunito_700Bold', fontSize: 12 },
  memberState: { fontFamily: 'Nunito_600SemiBold', fontSize: 10 },
  button: { minHeight: 48, borderRadius: 15, paddingHorizontal: 15, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  buttonCompact: { minHeight: 42, borderRadius: 13, paddingHorizontal: 12 },
  buttonLabel: { fontFamily: 'Nunito_700Bold', fontSize: 14 },
  buttonLabelCompact: { fontSize: 12 },
  iconButton: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  emptyText: { fontFamily: 'Nunito_600SemiBold', fontSize: 12, paddingVertical: 8 },
  roundCount: { fontFamily: 'Nunito_700Bold', fontSize: 13 },
  savedRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10 },
  savedInfo: { flex: 1, gap: 2 },
  savedName: { fontFamily: 'Nunito_700Bold', fontSize: 13 },
  roundAction: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  errorText: { fontFamily: 'Nunito_700Bold', fontSize: 12, lineHeight: 17 },
  gameHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, minHeight: 46 },
  brandLockup: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  gameIcon: { width: 42, height: 42, borderRadius: 13 },
  gameBrand: { fontFamily: 'Fredoka_600SemiBold', fontSize: 18 },
  turnBanner: { minHeight: 46, borderRadius: 15, borderWidth: 1, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 9 },
  turnText: { flex: 1, fontFamily: 'Nunito_700Bold', fontSize: 14 },
  modeTag: { fontFamily: 'Nunito_700Bold', fontSize: 9, letterSpacing: 0.9 },
  playerStrip: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  playerCard: { flexGrow: 1, flexBasis: 145, minWidth: 130, minHeight: 56, borderRadius: 15, borderWidth: 1.5, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 7 },
  playerDot: { width: 10, height: 10, borderRadius: 5 },
  playerMeta: { flex: 1, minWidth: 0 },
  playerName: { fontFamily: 'Nunito_700Bold', fontSize: 12 },
  playerPosition: { fontFamily: 'Nunito_700Bold', fontSize: 8, letterSpacing: 0.7 },
  ammoText: { fontFamily: 'Nunito_700Bold', fontSize: 11 },
  questTitle: { fontFamily: 'Fredoka_600SemiBold', fontSize: 20, lineHeight: 25 },
  questSteps: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 2 },
  questStep: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  questDot: { width: 7, height: 7, borderRadius: 4 },
  questStepText: { fontFamily: 'Nunito_700Bold', fontSize: 11 },
  actionPanel: { padding: 15, borderRadius: 20, borderWidth: 1, gap: 11 },
  actionTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  aimFlow: { width: '100%', borderWidth: 1, borderRadius: 15, padding: 10, gap: 9 },
  aimHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  aimAmmo: { fontFamily: 'Nunito_700Bold', fontSize: 10 },
  aimDecisionRow: { flexDirection: 'row', gap: 8 },
  aimDecisionButton: { flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 8, borderWidth: 1, borderRadius: 13 },
  aimDecisionLabel: { fontFamily: 'Nunito_700Bold', fontSize: 13 },
  aimTargetRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 2 },
  aimTargetOption: { width: 50, height: 50, borderRadius: 25, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  aimTargetOptionLabel: { fontFamily: 'Fredoka_600SemiBold', fontSize: 15 },
  aimSubmitRow: { alignItems: 'center', gap: 3 },
  aimFireSubmit: { width: '68%', minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 13, paddingHorizontal: 12 },
  aimLeaveLink: { minHeight: 26, justifyContent: 'center', paddingHorizontal: 12 },
  aimLeaveLabel: { fontFamily: 'Nunito_700Bold', fontSize: 11 },
  diceResult: { fontFamily: 'Fredoka_600SemiBold', fontSize: 30, lineHeight: 34 },
  gameMessage: { fontFamily: 'Nunito_600SemiBold', fontSize: 13, lineHeight: 19 },
  choiceBlock: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.12)', paddingTop: 10, gap: 8 },
  sectionLabel: { fontFamily: 'Nunito_700Bold', fontSize: 12 },
});
