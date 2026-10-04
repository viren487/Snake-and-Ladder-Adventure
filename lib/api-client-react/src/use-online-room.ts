import { createGameRoom, joinGameRoom, getGameRoom, actInGameRoom } from "./generated/api";
import type { RoomAction } from "./generated/api.schemas";
import { ApiError } from "./custom-fetch";
import type { RoomSession, RoomSnapshot } from "@workspace/game-core/online";

export type OnlineAction = Omit<RoomAction, "actionId" | "expectedVersion">;
export type RoomStorage = { load: () => Promise<RoomSession | null>; save: (session: RoomSession | null) => Promise<void> };
type Options = {
  storage: RoomStorage; enabled?: boolean;
  onUpdate: (room: RoomSnapshot, animate: boolean) => void | Promise<void>;
  onExit: () => void;
};
// Use the host app's hooks: Expo and the browser may use different React versions.
type RoomHooks = {
  useState<T>(initial: T | (() => T)): [T, (value: T | ((previous: T) => T)) => void];
  useRef<T>(initial: T): { current: T };
  useCallback<T extends (...args: never[]) => unknown>(callback: T, dependencies: readonly unknown[]): T;
  useEffect(effect: () => void | (() => void), dependencies?: readonly unknown[]): void;
};
export function isRoomSession(value: unknown): value is RoomSession {
  if (!value || typeof value !== "object") return false;
  const item = value as RoomSession;
  return /^[A-Z2-9]{6}$/.test(item.code) && /^[a-f0-9]{64}$/.test(item.token) &&
    (item.playerId === "player-1" || item.playerId === "player-2");
}
function messageOf(error: unknown) {
  if (error instanceof ApiError && error.data && typeof error.data === "object" && "error" in error.data) return String(error.data.error);
  return error instanceof Error ? error.message : "Could not connect to the online room.";
}
async function timed<T>(work: (signal: AbortSignal) => Promise<T>) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try { return await work(controller.signal); } finally { clearTimeout(timeout); }
}
const actionId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;

export function useOnlineRoom(options: Options, hooks: RoomHooks) {
  const { useCallback, useEffect, useRef, useState } = hooks;
  const optionsRef = useRef(options); optionsRef.current = options;
  const [session, setSession] = useState<RoomSession | null>(null);
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const [coolingDown, setCoolingDown] = useState(false);
  const [loadingSession, setLoadingSession] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const sessionRef = useRef<RoomSession | null>(null);
  const roomRef = useRef<RoomSnapshot | null>(null);
  const mounted = useRef(true), flight = useRef(false), polling = useRef(false), epoch = useRef(0), connectionIssue = useRef(false);
  const cooldown = useRef<ReturnType<typeof setTimeout> | null>(null);

  const receive = useCallback((raw: unknown) => {
    if (!mounted.current || !sessionRef.current) return;
    const snapshot = raw as RoomSnapshot;
    if (snapshot.code !== sessionRef.current.code || snapshot.yourPlayerId !== sessionRef.current.playerId ||
      !Array.isArray(snapshot.game?.players) || snapshot.game.players.length !== 2) throw new Error("The room returned an invalid round.");
    const previous = roomRef.current;
    if (previous && snapshot.version < previous.version) return;
    roomRef.current = snapshot;
    setRoom((old) => old && old.version === snapshot.version &&
      old.members.length === snapshot.members.length &&
      old.members.every((member, index) => member.online === snapshot.members[index].online)
      ? old : snapshot);
    setConnected(true);
    if (connectionIssue.current) { connectionIssue.current = false; setError(null); }
    if (!previous || snapshot.version !== previous.version) {
      if (cooldown.current) clearTimeout(cooldown.current);
      setCoolingDown(snapshot.busyForMs > 0);
      cooldown.current = setTimeout(() => { if (mounted.current) setCoolingDown(false); }, snapshot.busyForMs);
      void Promise.resolve(optionsRef.current.onUpdate(snapshot, !!previous && snapshot.version === previous.version + 1))
        .catch(() => { if (mounted.current) setError("The move could not be displayed. Reconnect to sync your saved round."); });
    }
  }, []);

  const refresh = useCallback(async () => {
    const current = sessionRef.current;
    if (!current || polling.current) return;
    polling.current = true;
    const generation = epoch.current;
    try {
      const result = await timed((signal) => getGameRoom(current.code, { signal, headers: { Authorization: `Bearer ${current.token}` } }));
      if (mounted.current && generation === epoch.current) receive(result);
    } catch (reason) {
      if (mounted.current && generation === epoch.current) {
        connectionIssue.current = true; setConnected(false);
        setError(reason instanceof ApiError ? messageOf(reason) : "Connection interrupted. Reconnecting to your saved room…");
      }
    } finally { polling.current = false; }
  }, [receive]);

  useEffect(() => {
    mounted.current = true;
    const interval = setInterval(() => { void refresh(); }, 1000);
    return () => { mounted.current = false; epoch.current++; clearInterval(interval); if (cooldown.current) clearTimeout(cooldown.current); };
  }, [refresh]);
  useEffect(() => {
    if (options.enabled === false) return;
    let cancelled = false;
    void optionsRef.current.storage.load().then((saved) => {
      if (cancelled || !mounted.current) return;
      if (saved) { sessionRef.current = saved; setSession(saved); void refresh(); }
    }).catch(() => {
      if (!cancelled) setError("Your saved online seat could not be opened. It has not been overwritten. Create a new room or join a friend to continue.");
    }).finally(() => { if (!cancelled) setLoadingSession(false); });
    return () => { cancelled = true; };
  }, [options.enabled, refresh]);

  const admit = useCallback(async (name: string, code?: string) => {
    if (flight.current || sessionRef.current) return;
    flight.current = true; setBusy(true); setError(null); setStorageError(null);
    try {
      const result = await timed((signal) => code
        ? joinGameRoom(code.trim().toUpperCase(), { name }, { signal })
        : createGameRoom({ name }, { signal }));
      if (!mounted.current) return;
      epoch.current++; roomRef.current = null;
      sessionRef.current = result.session; setSession(result.session);
      try { await optionsRef.current.storage.save(result.session); }
      catch { setStorageError("This device could not save its room seat. Keep this page/app open to stay in the round."); }
      receive(result.room);
    } catch (reason) { if (mounted.current) setError(messageOf(reason)); }
    finally { flight.current = false; if (mounted.current) setBusy(false); }
  }, [receive]);

  const action = useCallback(async (input: OnlineAction) => {
    const current = sessionRef.current, snapshot = roomRef.current;
    if (!current || !snapshot || flight.current) return false;
    const generation = epoch.current;
    const body = { ...input, actionId: actionId(), expectedVersion: snapshot.version };
    flight.current = true; setBusy(true); setError(null);
    try {
      let result;
      try { result = await timed((signal) => actInGameRoom(current.code, body, { signal, headers: { Authorization: `Bearer ${current.token}` } })); }
      catch (reason) {
        if (reason instanceof ApiError) throw reason;
        // The first request may have committed despite losing its response.
        result = await timed((signal) => actInGameRoom(current.code, body, { signal, headers: { Authorization: `Bearer ${current.token}` } }));
      }
      if (generation !== epoch.current || !mounted.current) return false;
      receive(result); return true;
    } catch (reason) {
      if (mounted.current && generation === epoch.current) {
        setError(messageOf(reason));
        if (!(reason instanceof ApiError)) { connectionIssue.current = true; setConnected(false); }
        void refresh();
      }
      return false;
    } finally { flight.current = false; if (mounted.current) setBusy(false); }
  }, [receive, refresh]);

  const leave = useCallback(async () => {
    if (flight.current) return;
    let notice: string | null = null;
    if (connected && roomRef.current?.status !== "closed") {
      if (!await action({ type: "leave" })) return;
    } else if (roomRef.current?.status !== "closed") {
      notice = "Left on this device. The server could not be notified while disconnected; your friend may still see the room.";
    }
    epoch.current++; sessionRef.current = null; roomRef.current = null;
    if (cooldown.current) clearTimeout(cooldown.current);
    // Restore local state before enabling local autosaves; native storage may yield.
    optionsRef.current.onExit();
    setSession(null); setRoom(null); setConnected(false); setCoolingDown(false); setStorageError(null); setError(notice);
    try { await optionsRef.current.storage.save(null); }
    catch { setError("Left the room, but its saved seat could not be removed from this device."); }
  }, [action, connected]);
  const canAct = !!session && !!room && connected && !busy && !coolingDown && room.status === "playing" &&
    room.members.length === 2 && room.members.every((member) => member.online) &&
    room.game.players[room.game.currentPlayerIndex].id === session.playerId;
  const canDetonate = !!session && !!room && connected && !busy && !coolingDown && room.status === "playing" &&
    room.members.length === 2 && room.members.every((member) => member.online) &&
    !room.game.pendingChoice && !room.game.pendingFireForPlayerId && room.game.bombs.some((bomb) =>
      bomb.ownerId === session.playerId && bomb.armed && room.game.players.some((player) =>
        player.id !== session.playerId && player.position === bomb.square));
  return { session, room, busy, connected, canAct, canDetonate, loadingSession, error: error ?? storageError,
    create: (name: string) => admit(name), join: (code: string, name: string) => admit(name, code),
    action, leave, retry: refresh };
}