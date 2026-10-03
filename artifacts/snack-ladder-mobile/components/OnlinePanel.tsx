import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, Share, StyleSheet, Text, TextInput, View } from "react-native";
import { useColors } from "@/hooks/useColors";

export interface OnlinePanelProps {
  room: null | {
    code: string;
    status: "waiting" | "playing" | "finished" | "closed";
    members: { id: string; name: string; online: boolean }[];
    yourPlayerId: string;
    rematchVotes: string[];
  };
  busy: boolean;
  connected: boolean;
  error: string | null;
  onCreate: (name: string) => void;
  onJoin: (code: string, name: string) => void;
  onLeave: () => void;
  onRematch: () => void;
  onRetry: () => void;
  resumeCode?: string;
}

export function OnlinePanel({ room, busy, connected, error, onCreate, onJoin, onLeave, onRematch, onRetry, resumeCode }: OnlinePanelProps) {
  const colors = useColors();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [localErr, setLocalErr] = useState<string | null>(null);
  const shownErr = localErr ?? error;

  const Btn = ({ text, onPress, disabled, testID, gold, icon }: { text: string; onPress: () => void; disabled?: boolean; testID: string; gold?: boolean; icon?: "content-copy" | "logout" | "refresh" }) => (
    <Pressable accessibilityRole="button" accessibilityLabel={text} accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={onPress} testID={testID}
      style={[styles.btn, { backgroundColor: gold ? colors.primary : colors.secondary, borderColor: gold ? colors.primary : colors.border, opacity: disabled ? 0.45 : 1 }]}>
      {icon ? <MaterialCommunityIcons name={icon} size={16} color={gold ? colors.primaryForeground : colors.foreground} /> : null}
      <Text style={[styles.btnText, { color: gold ? colors.primaryForeground : colors.foreground }]}>{text}</Text>
    </Pressable>
  );
  const card = [styles.card, { backgroundColor: colors.card, borderColor: colors.border }];

  if (!room && resumeCode) {
    return (
      <View style={card} testID="online-restoring">
        <Text style={[styles.copy, { color: colors.mutedForeground }]}>RESTORING ROOM</Text>
        <Text style={[styles.code, { color: colors.primary }]} testID="room-code">{resumeCode}</Text>
        <Text style={[styles.copy, { color: colors.mutedForeground }]} accessibilityLiveRegion="polite">{busy ? "Reconnecting to your seat..." : "Your seat is saved on this device."}</Text>
        {error ? <Text style={[styles.copy, { color: colors.destructive }]} accessibilityRole="alert">{error}</Text> : null}
        <View style={styles.row}>
          <Btn gold icon="refresh" text="Retry" disabled={busy} onPress={onRetry} testID="retry-online" />
          <Btn icon="logout" text="Back to local play" onPress={onLeave} testID="leave-online-room" />
        </View>
      </View>
    );
  }

  if (!room) {
    const join = () => {
      if (code.length !== 6) { setLocalErr("Room codes have 6 letters or digits."); return; }
      setLocalErr(null);
      onJoin(code, name.trim().slice(0, 24));
    };
    return (
      <View style={card}>
        <Pressable accessibilityRole="button" accessibilityLabel="Play Online" accessibilityState={{ expanded: open }} onPress={() => setOpen((o) => !o)} testID="online-mode-toggle" style={styles.toggle}>
          <MaterialCommunityIcons name="earth" size={18} color={colors.primary} />
          <Text style={[styles.title, { color: colors.foreground, flex: 1 }]}>Play Online</Text>
          <MaterialCommunityIcons name={open ? "chevron-up" : "chevron-down"} size={20} color={colors.mutedForeground} />
        </Pressable>
        {open && (
          <>
            <TextInput style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.muted }]} placeholder="Your name (optional)"
              placeholderTextColor={colors.mutedForeground} maxLength={24} value={name} editable={!busy} onChangeText={setName} testID="room-player-name" accessibilityLabel="Your name, optional" />
            <Btn gold text={busy ? "Working..." : "Create Room"} disabled={busy} onPress={() => { setLocalErr(null); onCreate(name.trim().slice(0, 24)); }} testID="create-room" />
            <View style={styles.row}>
              <TextInput style={[styles.input, { flex: 1, letterSpacing: 3, textAlign: "center", color: colors.foreground, borderColor: colors.border, backgroundColor: colors.muted }]}
                placeholder="CODE" placeholderTextColor={colors.mutedForeground} maxLength={6} autoCapitalize="characters" autoCorrect={false} value={code} editable={!busy}
                onChangeText={(t) => { setCode(t.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6)); setLocalErr(null); }}
                onSubmitEditing={() => { if (!busy) join(); }} testID="room-code-input" accessibilityLabel="Room code" />
              <Btn text="Join Room" disabled={busy || code.length !== 6} onPress={join} testID="join-room" />
            </View>
            {shownErr ? <Text style={[styles.copy, { color: colors.destructive }]} accessibilityRole="alert">{shownErr}</Text> : null}
            <Text style={[styles.copy, { color: colors.mutedForeground }]}>Play from separate devices on any internet connection.</Text>
          </>
        )}
        {!open && shownErr ? <Text style={[styles.copy, { color: colors.destructive }]} accessibilityRole="alert">{shownErr}</Text> : null}
      </View>
    );
  }

  const me = room.members.find((m) => m.id === room.yourPlayerId);
  const voted = room.rematchVotes.includes(room.yourPlayerId);
  return (
    <View style={card} testID="online-room">
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.copy, { color: colors.mutedForeground }]}>ROOM CODE</Text>
          <Text style={[styles.code, { color: colors.primary }]} testID="room-code" accessibilityLabel={`Room code ${room.code.split("").join(" ")}`}>{room.code}</Text>
        </View>
        <Btn icon="content-copy" text="Share" testID="copy-room-code" onPress={() => { void Share.share({ message: room.code }).catch(() => setLocalErr("Sharing is unavailable. Read the code aloud.")); }} />
      </View>
      <Text style={[styles.copy, { color: colors.foreground }]} testID="room-seat">You are {me?.name ?? "seated"}.</Text>
      {room.members.map((m) => (
        <View key={m.id} style={[styles.member, { backgroundColor: colors.muted }]} testID={`room-member-${m.id}`}>
          <View style={[styles.dot, { backgroundColor: m.online && room.status !== "closed" ? colors.primary : colors.mutedForeground }]} />
          <Text style={[styles.copy, { color: colors.foreground, flex: 1 }]}>{m.name}{m.id === room.yourPlayerId ? " (you)" : ""}</Text>
          <Text style={[styles.copy, { color: colors.mutedForeground }]}>{room.status === "closed" ? "ended" : m.online ? "online" : "offline"}</Text>
        </View>
      ))}
      {room.status === "waiting" ? <Text style={[styles.copy, { color: colors.mutedForeground }]} accessibilityLiveRegion="polite">Waiting for a friend. Share the code; the game starts when they join.</Text> : null}
      {room.status === "playing" && room.members.some((m) => !m.online) ? <Text style={[styles.copy, { color: colors.mutedForeground }]} accessibilityLiveRegion="polite">Your friend is offline. Opening the game again on their original device restores their seat.</Text> : null}
      {!connected ? (
        <View style={styles.row} accessibilityLiveRegion="polite">
          <Text style={[styles.copy, { color: colors.primary, flex: 1 }]}>Reconnecting...</Text>
          <Btn icon="refresh" text="Retry" onPress={onRetry} testID="retry-online" />
        </View>
      ) : null}
      {shownErr ? <Text style={[styles.copy, { color: colors.destructive }]} accessibilityRole="alert">{shownErr}</Text> : null}
      {room.status === "finished" ? (
        <Btn gold testID="request-rematch" disabled={busy || !connected || voted} onPress={onRematch}
          text={voted ? "Waiting for friend to agree" : room.rematchVotes.length ? "Friend wants a rematch: accept" : "Request rematch"} />
      ) : null}
      {room.status === "closed" ? <Text style={[styles.copy, { color: colors.foreground }]} testID="room-ended">This room has ended. Return to local play.</Text> : null}
      <Btn icon="logout" testID="leave-online-room" disabled={busy} onPress={onLeave} text={room.status === "closed" ? "Back to local play" : "Leave room"} />
    </View>
  );
}

export default OnlinePanel;

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 14, padding: 10, gap: 8 },
  toggle: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44 },
  title: { fontSize: 15, fontWeight: "700" },
  copy: { fontSize: 12, lineHeight: 17 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  input: { minHeight: 44, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, fontSize: 15 },
  btn: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 12, borderWidth: 1, borderRadius: 11 },
  btnText: { fontSize: 13, fontWeight: "700" },
  code: { fontSize: 24, fontWeight: "800", letterSpacing: 4 },
  member: { flexDirection: "row", alignItems: "center", gap: 8, padding: 8, borderRadius: 9 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
