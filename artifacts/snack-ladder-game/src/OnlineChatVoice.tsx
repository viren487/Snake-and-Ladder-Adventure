import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { MessageCircle, Mic, MicOff, Phone, PhoneOff, Send, Volume2, VolumeX, X } from 'lucide-react';
import { sendRoomCommunication } from '@workspace/api-client-react';
import type { RoomSession, RoomSnapshot } from '@workspace/game-core/online';
import type { RoomCommunicationInput } from '@workspace/api-client-react';
import './OnlineChatVoice.css';

type Props = {
  room: RoomSnapshot;
  session: RoomSession;
  connected: boolean;
  open: boolean;
  onClose: () => void;
};
type VoiceState = 'off' | 'requesting' | 'connecting' | 'connected' | 'error';
type Peer = { connection: RTCPeerConnection; callId: string | null; lastOfferAt: number };
type PeerStates = Record<string, RTCPeerConnectionState>;

const rtcConfiguration: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

function waitForIceGathering(connection: RTCPeerConnection, timeoutMs = 6000) {
  if (connection.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise<void>((resolve) => {
    const finish = () => {
      window.clearTimeout(timeout);
      connection.removeEventListener('icegatheringstatechange', onChange);
      resolve();
    };
    const onChange = () => {
      if (connection.iceGatheringState === 'complete') finish();
    };
    const timeout = window.setTimeout(finish, timeoutMs);
    connection.addEventListener('icegatheringstatechange', onChange);
  });
}

function callId() {
  return crypto.randomUUID();
}

function errorText(error: unknown) {
  if (error instanceof DOMException && error.name === 'NotAllowedError') {
    return 'Microphone access was blocked. Allow it in your browser settings, then try again.';
  }
  if (error instanceof DOMException && error.name === 'NotFoundError') {
    return 'No microphone was found on this device.';
  }
  if (error && typeof error === 'object' && 'data' in error) {
    const data = (error as { data?: unknown }).data;
    if (data && typeof data === 'object' && 'error' in data && typeof data.error === 'string') return data.error;
  }
  return error instanceof Error ? error.message : 'Could not start voice chat.';
}

export function OnlineChatVoice({ room, session, connected, open, onClose }: Props) {
  const [draft, setDraft] = useState('');
  const [sendingChat, setSendingChat] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [voiceState, setVoiceState] = useState<VoiceState>('off');
  const [voiceMessage, setVoiceMessage] = useState('');
  const [micMuted, setMicMuted] = useState(false);
  const [mutedPlayers, setMutedPlayers] = useState<Set<string>>(() => new Set());
  const [peerStates, setPeerStates] = useState<PeerStates>({});
  const chatLogRef = useRef<HTMLDivElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef(new Map<string, Peer>());
  const audioRefs = useRef(new Map<string, HTMLAudioElement>());
  const remoteStreamsRef = useRef(new Map<string, MediaStream>());
  const processedSignalsRef = useRef(new Set<string>());
  const mutedPlayersRef = useRef(new Set<string>());
  const roomRef = useRef(room);
  const sessionRef = useRef(session);
  const voiceActiveRef = useRef(false);
  const requestingMicRef = useRef(false);
  const mountedRef = useRef(false);
  const leaveVoiceRef = useRef<() => void>(() => undefined);
  roomRef.current = room;
  sessionRef.current = session;

  const postCommunication = useCallback((body: RoomCommunicationInput) => {
    const current = sessionRef.current;
    return sendRoomCommunication(current.code, body, {
      headers: { Authorization: `Bearer ${current.token}` },
    });
  }, []);

  const connectAudio = useCallback((playerId: string, stream: MediaStream) => {
    remoteStreamsRef.current.set(playerId, stream);
    const audio = audioRefs.current.get(playerId);
    if (!audio) return;
    audio.srcObject = stream;
    audio.muted = mutedPlayersRef.current.has(playerId);
    void audio.play().catch(() => {
      if (mountedRef.current) setVoiceMessage('Voice is connected. Tap the page if your browser is blocking audio playback.');
    });
  }, []);

  const setAudioElement = useCallback((playerId: string, audio: HTMLAudioElement | null) => {
    if (!audio) {
      audioRefs.current.delete(playerId);
      return;
    }
    audioRefs.current.set(playerId, audio);
    const stream = remoteStreamsRef.current.get(playerId);
    if (stream) {
      audio.srcObject = stream;
      audio.muted = mutedPlayersRef.current.has(playerId);
      void audio.play().catch(() => undefined);
    }
  }, []);

  const closePeer = useCallback((playerId: string, sendHangup = false) => {
    const peer = peersRef.current.get(playerId);
    if (sendHangup && peer?.callId) {
      void postCommunication({ type: 'hangup', targetPlayerId: playerId, callId: peer.callId }).catch(() => undefined);
    }
    if (peer) {
      peer.connection.ontrack = null;
      peer.connection.onconnectionstatechange = null;
      peer.connection.close();
      peersRef.current.delete(playerId);
    }
    remoteStreamsRef.current.delete(playerId);
    const audio = audioRefs.current.get(playerId);
    if (audio) audio.srcObject = null;
    if (mountedRef.current) {
      setPeerStates((previous) => {
        const next = { ...previous };
        delete next[playerId];
        return next;
      });
    }
  }, [postCommunication]);

  const createPeer = useCallback((playerId: string) => {
    const existing = peersRef.current.get(playerId);
    if (existing) return existing;
    const connection = new RTCPeerConnection(rtcConfiguration);
    const peer: Peer = { connection, callId: null, lastOfferAt: 0 };
    peersRef.current.set(playerId, peer);
    const localStream = localStreamRef.current;
    localStream?.getAudioTracks().forEach((track) => connection.addTrack(track, localStream));
    connection.ontrack = (event) => {
      const stream = event.streams[0] ?? new MediaStream([event.track]);
      connectAudio(playerId, stream);
    };
    connection.onconnectionstatechange = () => {
      if (peersRef.current.get(playerId) !== peer) return;
      const state = connection.connectionState;
      if (mountedRef.current) {
        setPeerStates((previous) => ({ ...previous, [playerId]: state }));
        const hasConnectedPeer = [...peersRef.current.values()]
          .some((item) => item.connection.connectionState === 'connected');
        if (voiceActiveRef.current) setVoiceState(hasConnectedPeer ? 'connected' : 'connecting');
        if (state === 'failed') setVoiceMessage('A direct voice route could not be made. This network may block peer-to-peer audio.');
      }
    };
    if (mountedRef.current) setPeerStates((previous) => ({ ...previous, [playerId]: connection.connectionState }));
    return peer;
  }, [connectAudio]);

  const startOffer = useCallback(async (playerId: string, peer: Peer) => {
    if (!voiceActiveRef.current || peersRef.current.get(playerId) !== peer || peer.connection.signalingState !== 'stable') return;
    try {
      const id = callId();
      peer.callId = id;
      peer.lastOfferAt = Date.now();
      const offer = await peer.connection.createOffer();
      await peer.connection.setLocalDescription(offer);
      await waitForIceGathering(peer.connection);
      if (!voiceActiveRef.current || peersRef.current.get(playerId) !== peer) return;
      const sdp = peer.connection.localDescription?.sdp;
      if (!sdp) throw new Error('The browser did not create a voice offer.');
      await postCommunication({ type: 'offer', targetPlayerId: playerId, callId: id, sdp });
    } catch (error) {
      if (mountedRef.current) setVoiceMessage(errorText(error));
    }
  }, [postCommunication]);

  const processSignals = useCallback(async () => {
    if (!voiceActiveRef.current || !localStreamRef.current) return;
    for (const signal of roomRef.current.voiceSignals) {
      if (processedSignalsRef.current.has(signal.id) || signal.toPlayerId !== sessionRef.current.playerId) continue;
      processedSignalsRef.current.add(signal.id);
      const remote = roomRef.current.members.find((member) => member.id === signal.fromPlayerId);
      if (!remote || !remote.online || remote.id === sessionRef.current.playerId) continue;
      try {
        let peer = peersRef.current.get(remote.id);
        if (signal.type === 'hangup') {
          if (peer?.callId === signal.callId) closePeer(remote.id);
          continue;
        }
        if (signal.type === 'offer') {
          if (peer && peer.callId !== signal.callId) {
            closePeer(remote.id);
            peer = undefined;
          }
          peer ??= createPeer(remote.id);
          if (peer.connection.signalingState !== 'stable' || !signal.sdp) continue;
          peer.callId = signal.callId;
          await peer.connection.setRemoteDescription({ type: 'offer', sdp: signal.sdp });
          const answer = await peer.connection.createAnswer();
          await peer.connection.setLocalDescription(answer);
          await waitForIceGathering(peer.connection);
          if (peersRef.current.get(remote.id) !== peer) continue;
          const sdp = peer.connection.localDescription?.sdp;
          if (!sdp) throw new Error('The browser did not create a voice answer.');
          await postCommunication({ type: 'answer', targetPlayerId: remote.id, callId: signal.callId, sdp });
        } else if (peer?.callId === signal.callId && signal.sdp &&
          peer.connection.signalingState === 'have-local-offer') {
          await peer.connection.setRemoteDescription({ type: 'answer', sdp: signal.sdp });
        }
      } catch (error) {
        if (mountedRef.current) setVoiceMessage(errorText(error));
      }
    }
  }, [closePeer, createPeer, postCommunication]);

  const leaveVoice = useCallback(() => {
    const wasActive = voiceActiveRef.current;
    voiceActiveRef.current = false;
    requestingMicRef.current = false;
    for (const playerId of [...peersRef.current.keys()]) closePeer(playerId, wasActive);
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    if (mountedRef.current) {
      setVoiceState('off');
      setMicMuted(false);
      setPeerStates({});
    }
  }, [closePeer]);
  leaveVoiceRef.current = leaveVoice;

  const joinVoice = useCallback(async () => {
    if (voiceActiveRef.current || requestingMicRef.current) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setVoiceState('error');
      setVoiceMessage('This browser does not support microphone access.');
      return;
    }
    requestingMicRef.current = true;
    setVoiceState('requesting');
    setVoiceMessage('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      });
      if (!mountedRef.current || roomRef.current.status === 'closed') {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      localStreamRef.current = stream;
      voiceActiveRef.current = true;
      setVoiceState('connecting');
      setMicMuted(false);
    } catch (error) {
      if (mountedRef.current) {
        setVoiceState('error');
        setVoiceMessage(errorText(error));
      }
    } finally {
      requestingMicRef.current = false;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      leaveVoiceRef.current();
    };
  }, []);

  useEffect(() => {
    if (room.status === 'closed') {
      leaveVoice();
      return;
    }
    if (!voiceActiveRef.current || !localStreamRef.current) return;
    const onlineIds = new Set(room.members.filter((member) => member.online && member.id !== session.playerId).map((member) => member.id));
    for (const playerId of peersRef.current.keys()) if (!onlineIds.has(playerId)) closePeer(playerId);
    for (const playerId of onlineIds) {
      const peer = createPeer(playerId);
      if (session.playerId < playerId && !peer.callId) void startOffer(playerId, peer);
    }
  }, [room.members, room.status, session.playerId, voiceState, closePeer, createPeer, startOffer]);

  useEffect(() => {
    void processSignals();
  }, [room.voiceSignals, voiceState, processSignals]);

  useEffect(() => {
    if (voiceState === 'off' || voiceState === 'error') return;
    const timer = window.setInterval(() => {
      for (const [playerId, peer] of peersRef.current) {
        if (sessionRef.current.playerId < playerId &&
          peer.connection.connectionState !== 'connected' &&
          Date.now() - peer.lastOfferAt >= 30_000 &&
          roomRef.current.members.some((member) => member.id === playerId && member.online)) {
          closePeer(playerId);
          void startOffer(playerId, createPeer(playerId));
        }
      }
    }, 10_000);
    return () => window.clearInterval(timer);
  }, [voiceState, closePeer, createPeer, startOffer]);

  useEffect(() => {
    mutedPlayersRef.current = mutedPlayers;
    for (const [playerId, audio] of audioRefs.current) audio.muted = mutedPlayers.has(playerId);
  }, [mutedPlayers]);

  useEffect(() => {
    const log = chatLogRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [room.chatMessages]);

  const sendChat = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || sendingChat || room.status === 'closed' || !connected) return;
    setSendingChat(true);
    setChatError(null);
    try {
      await postCommunication({ type: 'chat', text });
      setDraft('');
    } catch (error) {
      setChatError(errorText(error));
    } finally {
      setSendingChat(false);
    }
  };

  const toggleMic = () => {
    const nextMuted = !micMuted;
    localStreamRef.current?.getAudioTracks().forEach((track) => { track.enabled = !nextMuted; });
    setMicMuted(nextMuted);
  };

  return (
    <section id="room-chat-voice" className="ov-panel" hidden={!open} aria-label="Room chat and voice" data-testid="room-chat-voice">
      <header className="ov-header">
        <div className="ov-title"><MessageCircle size={16} aria-hidden="true" /> Chat &amp; voice <span>{room.code}</span></div>
        <button type="button" className="ov-icon-button" aria-label="Close chat and voice" onClick={onClose}><X size={16} /></button>
      </header>

      <section className="ov-voice" aria-label="Voice chat controls">
        <div className="ov-voice-main">
          <div className="ov-voice-status" role="status" aria-live="polite">
            <span className={`ov-voice-dot ${voiceState === 'connected' ? 'is-live' : ''}`} />
            <span>{voiceState === 'off' ? 'Voice is off' : voiceState === 'requesting' ? 'Waiting for microphone permission…' :
              voiceState === 'connecting' ? 'Connecting directly to players…' : voiceState === 'connected' ? 'Voice connected' : 'Voice unavailable'}</span>
          </div>
          {voiceState === 'off' || voiceState === 'error' ? (
            <button type="button" className="ov-action-button ov-join-button" data-testid="join-voice"
              disabled={!connected || room.status === 'closed'} onClick={() => { void joinVoice(); }}>
              <Phone size={14} /> Join voice
            </button>
          ) : (
            <>
              <button type="button" className="ov-action-button" data-testid="toggle-microphone" aria-pressed={micMuted}
                disabled={voiceState === 'requesting'} onClick={toggleMic}>
                {micMuted ? <MicOff size={14} /> : <Mic size={14} />} {micMuted ? 'Unmute mic' : 'Mute mic'}
              </button>
              <button type="button" className="ov-action-button ov-leave-button" data-testid="leave-voice" onClick={leaveVoice}>
                <PhoneOff size={14} /> Leave
              </button>
            </>
          )}
        </div>
        {voiceMessage && <p className="ov-voice-message" role="status">{voiceMessage}</p>}
        <p className="ov-privacy-note">Audio goes directly between browsers, so players may see network connection details. Some networks block direct voice.</p>
        <div className="ov-voice-roster">
          {room.members.filter((member) => member.id !== session.playerId).map((member) => {
            const state = peerStates[member.id];
            const isMuted = mutedPlayers.has(member.id);
            const voiceLabel = !member.online ? 'offline' : state === 'connected' ? 'connected' :
              state === 'failed' ? 'connection blocked' : voiceState === 'off' ? 'not in voice' : 'waiting';
            return (
              <div className="ov-player" key={member.id} data-testid={`voice-player-${member.id}`}>
                <audio className="ov-audio" ref={(node) => setAudioElement(member.id, node)} autoPlay playsInline aria-hidden="true" />
                <span className={`ov-player-dot ${state === 'connected' ? 'is-live' : ''}`} aria-hidden="true" />
                <span className="ov-player-name">{member.name}</span>
                <span className="ov-player-status">{voiceLabel}</span>
                <button type="button" className="ov-mute-player" aria-pressed={isMuted}
                  aria-label={`${isMuted ? 'Unmute' : 'Mute'} ${member.name} on this device`}
                  onClick={() => setMutedPlayers((previous) => {
                    const next = new Set(previous);
                    if (next.has(member.id)) next.delete(member.id); else next.add(member.id);
                    return next;
                  })}>
                  {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                  <span>{isMuted ? 'Unmute here' : 'Mute here'}</span>
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <div className="ov-chat-heading">Room messages <span>{room.chatMessages.length}</span></div>
      <div className="ov-chat-log" ref={chatLogRef} role="log" aria-live="polite" aria-relevant="additions text" data-testid="room-chat-log">
        {room.chatMessages.length === 0 ? (
          <p className="ov-empty">No messages yet. Say hello to the room.</p>
        ) : room.chatMessages.map((message) => {
          const time = new Date(message.sentAt);
          return (
            <article className={`ov-message ${message.playerId === session.playerId ? 'is-mine' : ''}`} key={message.id}>
              <div className="ov-message-meta"><strong>{message.playerName}</strong><time dateTime={message.sentAt}>{Number.isNaN(time.getTime()) ? '' : time.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</time></div>
              <p>{message.text}</p>
            </article>
          );
        })}
      </div>
      <form className="ov-chat-form" onSubmit={(event) => { void sendChat(event); }}>
        <input value={draft} maxLength={400} aria-label="Room message" placeholder="Write a message…"
          data-testid="room-chat-input" disabled={!connected || room.status === 'closed' || sendingChat}
          onChange={(event) => { setDraft(event.target.value); setChatError(null); }} />
        <button type="submit" aria-label="Send message" data-testid="send-room-message"
          disabled={!connected || room.status === 'closed' || sendingChat || !draft.trim()}>
          <Send size={15} />
        </button>
      </form>
      {chatError && <p className="ov-chat-error" role="alert">{chatError}</p>}
    </section>
  );
}