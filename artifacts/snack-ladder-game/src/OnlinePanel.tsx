import { useState } from 'react';
import { Copy, Globe, LogOut, RefreshCw, Check, ChevronDown } from 'lucide-react';
import './OnlinePanel.css';

export interface OnlinePanelProps {
  room: null | {
    code: string;
    status: 'waiting' | 'playing' | 'finished' | 'closed';
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
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [localErr, setLocalErr] = useState<string | null>(null);
  const shownErr = localErr ?? error;

  const join = () => {
    if (code.length !== 6) { setLocalErr('Room codes have 6 letters or digits.'); return; }
    setLocalErr(null);
    onJoin(code, name.trim().slice(0, 24));
  };
  const copy = async () => {
    if (!room) return;
    try { await navigator.clipboard.writeText(room.code); setCopied(true); window.setTimeout(() => setCopied(false), 1600); }
    catch { setLocalErr('Copy is blocked here. Read the code aloud instead.'); }
  };

  if (!room && resumeCode) {
    return (
      <section className="op" aria-label="Restoring online room" data-testid="online-restoring">
        <div className="eyebrow">Restoring room</div>
        <div className="op-codeval" data-testid="room-code">{resumeCode}</div>
        <p className="op-note" role="status">{busy ? 'Reconnecting to your seat...' : 'Your seat is saved on this device.'}</p>
        {error && <p className="op-err" role="alert" data-testid="online-error">{error}</p>}
        <div className="op-row">
          <button type="button" className="op-btn gold" data-testid="retry-online" disabled={busy} onClick={onRetry}><RefreshCw size={14} /> Retry</button>
          <button type="button" className="op-btn" data-testid="leave-online-room" onClick={onLeave}><LogOut size={14} /> Back to local play</button>
        </div>
      </section>
    );
  }

  if (!room) {
    return (
      <section className="op" aria-label="Online play">
        <button type="button" className="op-toggle" data-testid="online-mode-toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}><Globe size={16} /> Play Online</span>
          <ChevronDown size={16} style={{ transform: open ? 'rotate(180deg)' : undefined }} />
        </button>
        {open && (
          <>
            <input className="op-input" data-testid="room-player-name" aria-label="Your name (optional)" placeholder="Your name (optional)" maxLength={24}
              value={name} disabled={busy} onChange={(e) => setName(e.target.value)} />
            <div className="op-row">
              <button type="button" className="op-btn gold" data-testid="create-room" disabled={busy} onClick={() => { setLocalErr(null); onCreate(name.trim().slice(0, 24)); }}>
                {busy ? 'Working...' : 'Create Room'}
              </button>
            </div>
            <div className="op-row">
              <input className="op-input op-code" data-testid="room-code-input" aria-label="Room code" placeholder="CODE" maxLength={6} autoCapitalize="characters" autoComplete="off"
                value={code} disabled={busy}
                onChange={(e) => { setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)); setLocalErr(null); }}
                onKeyDown={(e) => { if (e.key === 'Enter' && !busy) join(); }} />
              <button type="button" className="op-btn" data-testid="join-room" disabled={busy || code.length !== 6} onClick={join}>Join Room</button>
            </div>
            {shownErr && <p className="op-err" role="alert" data-testid="online-error">{shownErr}</p>}
            <p className="op-note">Play from separate devices on any internet connection.</p>
          </>
        )}
        {!open && shownErr && <p className="op-err" role="alert" data-testid="online-error">{shownErr}</p>}
      </section>
    );
  }

  const me = room.members.find((m) => m.id === room.yourPlayerId);
  const voted = room.rematchVotes.includes(room.yourPlayerId);
  return (
    <section className="op" aria-label="Online room" data-testid="online-room">
      <div className="op-codebox">
        <div>
          <div className="eyebrow">Room code</div>
          <div className="op-codeval" data-testid="room-code">{room.code}</div>
        </div>
        <button type="button" className="op-btn" style={{ flex: '0 0 auto' }} onClick={copy} aria-label="Copy room code" data-testid="copy-room-code">
          {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <p className="op-note" data-testid="room-seat">You are {me?.name ?? 'seated'}.</p>
      {room.members.map((m) => (
        <div className="op-member" key={m.id} data-testid={`room-member-${m.id}`}>
          <span className={`op-dot ${m.online && room.status !== 'closed' ? '' : 'off'}`} aria-hidden="true" />
          <span>{m.name}{m.id === room.yourPlayerId ? ' (you)' : ''}</span>
          <span className="op-note">{room.status === 'closed' ? 'ended' : m.online ? 'online' : 'offline'}</span>
        </div>
      ))}
      {room.status === 'waiting' && <p className="op-note" role="status">Waiting for a friend. Share the code; the game starts when they join.</p>}
      {room.status === 'playing' && room.members.some((m) => !m.online) && <p className="op-note" role="status">Your friend is offline. Opening the game again on their original device restores their seat.</p>}
      {!connected && (
        <div className="op-row" role="status">
          <p className="op-warn" style={{ flex: 1, alignSelf: 'center' }}>Reconnecting...</p>
          <button type="button" className="op-btn" style={{ flex: '0 0 auto' }} data-testid="retry-online" onClick={onRetry}><RefreshCw size={14} /> Retry</button>
        </div>
      )}
      {shownErr && <p className="op-err" role="alert" data-testid="online-error">{shownErr}</p>}
      {room.status === 'finished' && (
        <button type="button" className="op-btn gold" data-testid="request-rematch" disabled={busy || !connected || voted} onClick={onRematch}>
          {voted ? 'Waiting for friend to agree' : room.rematchVotes.length ? 'Friend wants a rematch: accept' : 'Request rematch'}
        </button>
      )}
      {room.status === 'closed' && <p className="op-note" role="status" data-testid="room-ended">This room has ended. Return to local play.</p>}
      <button type="button" className="op-btn" data-testid="leave-online-room" disabled={busy} onClick={onLeave}>
        <LogOut size={14} /> {room.status === 'closed' ? 'Back to local play' : 'Leave room'}
      </button>
    </section>
  );
}

export default OnlinePanel;
