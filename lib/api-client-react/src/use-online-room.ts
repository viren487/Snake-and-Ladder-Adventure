import { createGameRoom, joinGameRoom, getGameRoom, actInGameRoom, prepareRoomAdmission } from "./generated/api";
import type { RoomAction } from "./generated/api.schemas";
import { ApiError } from "./custom-fetch";
import type { RoomSession, RoomSnapshot } from "@workspace/game-core/online";

export type OnlineAction = Omit<RoomAction, "actionId" | "expectedVersion">;
export type PendingAdmission = { kind: "pending"; token: string; name: string; code?: string; maxPlayers: number };
export type RoomStorage = { load: () => Promise<RoomSession | PendingAdmission | null>; save: (session: RoomSession | PendingAdmission | null) => Promise<void> };
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
    /^player-[1-4]$/.test(item.playerId);
}
export function isPendingAdmission(value: unknown): value is PendingAdmission {
  if (!value || typeof value !== "object") return false;
  const item = value as PendingAdmission;
  return item.kind === "pending" && /^[a-f0-9]{64}$/.test(item.token) &&
    typeof item.name === "string" && item.name.length <= 24 &&
    (item.code === undefined || /^[A-Z2-9]{6}$/.test(item.code)) &&
    Number.isInteger(item.maxPlayers) && item.maxPlayers >= 2 && item.maxPlayers <= 4;
}
function messageOf(error: unknown) {
  if (error instanceof ApiError && error.data && typeof error.data === "object" && "error" in error.data) return String(error.data.error);
  return error instanceof Error ? error.message : "Could not connect to the online room.";
}
async function timed<T>(work: (signal: AbortSignal) => Promise<T>, timeoutMs = 8000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try { return await work(controller.signal); } finally { clearTimeout(timeout); }
}
const actionId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;

export function useOnlineRoom(options: Options, hooks: RoomHooks) {
  const { useCallback, useEffect, useRef, useState } = hooks;
  const optionsRef = useRef(options); optionsRef.current = options;
  const [session, setSession] = useState<RoomSession | null>(null);
  const [pendingAdmission, setPendingAdmission] = useState<PendingAdmission | null>(null);
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const [coolingDown, setCoolingDown] = useState(false);
  const [loadingSession, setLoadingSession] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const sessionRef = useRef<RoomSession | null>(null);
  const pendingRef = useRef<PendingAdmission | null>(null);
  const roomRef = useRef<RoomSnapshot | null>(null);
  const mounted = useRef(true), flight = useRef(false), polling = useRef(false), epoch = useRef(0), connectionIssue = useRef(false);
  const cooldown = useRef<ReturnType<typeof setTimeout> | null>(null);

  const receive = useCallback((raw: unknown) => {
    if (!mounted.current || !sessionRef.current) return;
    const snapshot = raw as RoomSnapshot;
    if (snapshot.code !== sessionRef.current.code || snapshot.yourPlayerId !== sessionRef.current.playerId ||
      !Array.isArray(snapshot.game?.players) || snapshot.game.players.length < 2 || snapshot.game.players.length > 4 ||
      !Array.isArray(snapshot.chatMessages) || !Array.isArray(snapshot.voiceSignals) ||
      !snapshot.game.players.some((player) => player.id === sessionRef.current!.playerId) ||
      !Number.isInteger(snapshot.game.currentPlayerIndex) || snapshot.game.currentPlayerIndex < 0 || snapshot.game.currentPlayerIndex >= snapshot.game.players.length) throw new Error("The room returned an invalid round.");
    snapshot.maxPlayers ??= snapshot.game.players.length;
    if (snapshot.maxPlayers !== snapshot.game.players.length) throw new Error("The room capacity does not match its players.");
    const previous = roomRef.current;
    if (previous && snapshot.version < previous.version) return;
    roomRef.current = snapshot;
    const sameIds = (left: readonly { id: string }[], right: readonly { id: string }[]) =>
      left.length === right.length && left.every((item, index) => item.id === right[index].id);
    setRoom((old) => old && old.version === snapshot.version &&
      old.members.length === snapshot.members.length &&
      old.members.every((member, index) => member.online === snapshot.members[index].online) &&
      sameIds(old.chatMessages, snapshot.chatMessages) && sameIds(old.voiceSignals, snapshot.voiceSignals)
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
  const admit = useCallback(async (name: string, code?: string, maxPlayers = 2) => {
    if (flight.current || sessionRef.current) return;
    flight.current = true; setBusy(true); setError(null); setStorageError(null);
    try {
      let pending = pendingRef.current;
      if (!pending) {
        const ticket = await timed((signal) => prepareRoomAdmission({ signal }), 30000);
        pending = { kind: "pending", token: ticket.token, name: name.trim().slice(0, 24),
          ...(code ? { code: code.trim().toUpperCase() } : {}), maxPlayers };
        if (!isPendingAdmission(pending)) throw new Error("Invalid room request.");
        // Never allocate a seat until its recovery credential is durably saved.
        try { await optionsRef.current.storage.save(pending); }
        catch { throw new Error("This device could not save join recovery. No seat was requested; check storage and retry."); }
        pendingRef.current = pending;
        if (mounted.current) setPendingAdmission(pending);
      }
      if (!mounted.current) return;
      const request = pending;
      const result = await timed((signal) => request.code
        ? joinGameRoom(request.code, { name: request.name, admissionToken: request.token }, { signal })
        : createGameRoom({ name: request.name, maxPlayers: request.maxPlayers, admissionToken: request.token }, { signal }), 30000);
      if (!mounted.current) return;
      epoch.current++; roomRef.current = null;
      sessionRef.current = result.session; setSession(result.session);
      try { await optionsRef.current.storage.save(result.session); }
      catch { setStorageError("This device could not save its room seat. Keep this page/app open to stay in the round."); }
      receive(result.room);
      pendingRef.current = null; setPendingAdmission(null);
    } catch (reason) {
      // These structured API rejections occur before admission or after rollback.
      // Keep recovery on transport failures, 5xx and rate limits: acceptance is unknown.
      if (reason instanceof ApiError && [400,404,409,410].includes(reason.status) &&
        reason.data && typeof reason.data === "object" && "error" in reason.data) {
        try {
          await optionsRef.current.storage.save(null);
          pendingRef.current = null;
          if (mounted.current) setPendingAdmission(null);
        } catch { /* Retain the saved request and retry it safely. */ }
      }
      if (mounted.current) setError(pendingRef.current && !(reason instanceof ApiError)
        ? "The connection was interrupted. Your join request is saved. Retry to recover the same seat, not a new one."
        : messageOf(reason));
    }
    finally { flight.current = false; if (mounted.current) setBusy(false); }
  }, [receive]);

  useEffect(() => {
    if (options.enabled === false) return;
    let cancelled = false;
    void optionsRef.current.storage.load().then(async (saved) => {
      if (cancelled || !mounted.current) return;
      if (isPendingAdmission(saved)) {
        pendingRef.current = saved; setPendingAdmission(saved);
        await admit(saved.name, saved.code, saved.maxPlayers);
      } else if (saved) { sessionRef.current = saved; setSession(saved); void refresh(); }
    }).catch(() => {
      if (!cancelled) setError("Your saved online seat could not be opened. It has not been overwritten.");
    }).finally(() => { if (!cancelled) setLoadingSession(false); });
    return () => { cancelled = true; };
  }, [options.enabled, refresh, admit]);

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
    if (flight.current || pendingRef.current) return;
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
    room.members.length === room.maxPlayers && room.members.every((member) => member.online || room.game.winnerIds?.includes(member.id)) &&
    room.game.players[room.game.currentPlayerIndex].id === session.playerId;
  const canDetonate = !!session && !!room && connected && !busy && !coolingDown && room.status === "playing" &&
    room.members.length === room.maxPlayers && room.members.every((member) => member.online || room.game.winnerIds?.includes(member.id)) &&
    !room.game.winnerIds?.includes(session.playerId) && !room.game.pendingChoice && !room.game.pendingFireForPlayerId && room.game.bombs.some((bomb) => {
      if (bomb.ownerId !== session.playerId) return false;
      const owner = room.game.players.find((player) => player.id === session.playerId);
      const selfDetonation = owner?.position === bomb.square;
      return selfDetonation || (bomb.armed && room.game.players.some((player) =>
        player.id !== session.playerId && player.position === bomb.square && !room.game.winnerIds?.includes(player.id)));
    });
  return { session, pendingAdmission, room, busy, connected, canAct, canDetonate, loadingSession, error: error ?? storageError,
    create: (name: string, maxPlayers = 2) => admit(name, undefined, maxPlayers), join: (code: string, name: string) => admit(name, code),
    action, leave, retry: () => pendingRef.current
      ? admit(pendingRef.current.name, pendingRef.current.code, pendingRef.current.maxPlayers) : refresh() };
}