import { useEffect, useMemo, useState } from 'react';
import { Crown, Dices, KeyRound, RotateCcw, Sparkles, Trophy } from 'lucide-react';
import {
  createGame,
  playTurn,
  squareAt,
  SNAKES,
  LADDERS,
  BOOM_SQUARE,
  KEY_SQUARES,
  LOCKED_SQUARES,
  type GameState,
} from './game-engine';

const STORAGE_KEY = 'snack-ladder-adventure-v1';
const EXTRA_BULLET_SQUARES = [61, 77] as const;
const MYSTERY_BOX_SQUARES = [14, 35, 51, 76] as const;
const MOVEMENT_STEP_DELAY_MS = 220;
type WalkingPiece = { playerId: string; position: number };

function readGame(): GameState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const value = JSON.parse(saved) as GameState;
      if (value?.players?.length === 2 && Number.isInteger(value.currentPlayerIndex)) return value;
    }
  } catch {
    // A damaged or unavailable local save starts a fresh round.
  }
  return createGame();
}

function centerOf(square: number) {
  for (let row = 0; row < 10; row += 1) {
    for (let col = 0; col < 10; col += 1) {
      if (squareAt(row, col) === square) return { x: col * 100 + 50, y: row * 100 + 50 };
    }
  }
  return { x: 50, y: 950 };
}

function BulletIcon({ square }: { square: number }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className="bullet-glyph" data-testid={`bullet-square-${square}`}>
      <path d="M24 5C18 12 14 18 14 25v8h20v-8C34 18 30 12 24 5Z" fill="#dce6e9" stroke="#59401d" strokeWidth="2.5" />
      <path d="M14 27h20v8H14z" fill="#e3a934" stroke="#59401d" strokeWidth="2" />
      <path d="M16 31h16" stroke="#fff0ad" strokeWidth="2" strokeLinecap="round" />
      <path d="M21 14c1-2 2-4 3-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity=".8" />
    </svg>
  );
}

function MysteryBoxIcon({ square }: { square: number }) {
  return (
    <svg viewBox="0 0 56 56" aria-hidden="true" className="mystery-box-glyph" data-testid={`mystery-box-square-${square}`}>
      <path d="M7 18 28 7l21 11-21 12Z" fill="#f5c85b" stroke="#53351e" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M7 18 28 30v21L7 39Z" fill="#a34e9d" stroke="#53351e" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M49 18 28 30v21l21-12Z" fill="#633b91" stroke="#3a2852" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M25 9 30 11v38l-5 2Z" fill="#f4d374" opacity=".94" />
      <path d="M8 18 28 29l20-11" fill="none" stroke="#ffe6a1" strokeWidth="2" />
      <text x="38.5" y="43" textAnchor="middle" fill="#fff0a7" stroke="#482d62" strokeWidth=".7" paintOrder="stroke" fontSize="15" fontWeight="900" fontFamily="Fredoka, sans-serif">?</text>
    </svg>
  );
}

function GunIcon() {
  return (
    <svg viewBox="0 0 64 48" aria-hidden="true" className="gun-glyph">
      <path d="M7 14q0-4 4-4h29l19 5v10H37l-5 5h-3l-5 12H12l4-15-7-3q-2-1-2-4Z" fill="#3d4550" stroke="#24232a" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M13 13h27l13 4H17Z" fill="#d5aa4b" stroke="#63451f" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M27 29h10l-5 10h-9Z" fill="#9a5b32" stroke="#50351f" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M29 25v3q0 5 6 4" fill="none" stroke="#e8d6a5" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="13" cy="18" r="1.5" fill="#f4cc69" />
    </svg>
  );
}

function BoomIcon() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className="boom-glyph" data-testid={`boom-square-${BOOM_SQUARE}`}>
      <defs>
        <radialGradient id="boom-bomb-shell" cx="32%" cy="26%" r="76%">
          <stop offset="0" stopColor="#55575d" />
          <stop offset=".38" stopColor="#292a2f" />
          <stop offset="1" stopColor="#090a0d" />
        </radialGradient>
      </defs>
      <circle cx="29" cy="39" r="19" fill="url(#boom-bomb-shell)" stroke="#101115" strokeWidth="2.5" />
      <ellipse cx="21" cy="29" rx="6.5" ry="3.5" fill="#8a8d91" opacity=".55" transform="rotate(-34 21 29)" />
      <path d="M42 25 49 16" fill="none" stroke="#17181c" strokeWidth="6" strokeLinecap="round" />
      <path d="M47 17q1-7 7-8" fill="none" stroke="#765338" strokeWidth="3.5" strokeLinecap="round" />
      <path d="m55 3 1.6 4.2L61 9l-4 2.2-.5 4.6-3-3.2-4.4 1.2 2.4-3.9-2.4-3.9 4.5 1z" fill="#ffd34e" stroke="#e77b28" strokeWidth="1.4" strokeLinejoin="round" />
      <circle cx="51" cy="9" r="1.2" fill="#fff4b0" />
    </svg>
  );
}

function LadderArt({ from, to }: { from: number; to: number }) {
  const a = centerOf(from);
  const b = centerOf(to);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  const nx = (dy / length) * 10;
  const ny = (-dx / length) * 10;
  const point = (t: number, side: number) => ({
    x: a.x + dx * t + nx * side,
    y: a.y + dy * t + ny * side,
  });
  const p1 = point(0, -1);
  const p2 = point(1, -1);
  const p3 = point(0, 1);
  const p4 = point(1, 1);
  const rungs = Array.from({ length: Math.max(3, Math.floor(length / 25)) }, (_, i) => {
    const t = (i + 1) / (Math.max(3, Math.floor(length / 25)) + 1);
    const left = point(t, -1);
    const right = point(t, 1);
    return <g key={i}><line className="ladder-rung" x1={left.x} y1={left.y} x2={right.x} y2={right.y} /><line className="ladder-rung-light" x1={left.x} y1={left.y} x2={right.x} y2={right.y} /></g>;
  });
  return (
    <g data-testid={`ladder-art-${from}-${to}`}>
      <line className="ladder-rail" x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} />
      <line className="ladder-rail" x1={p3.x} y1={p3.y} x2={p4.x} y2={p4.y} />
      <line className="ladder-rail-light" x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} />
      <line className="ladder-rail-light" x1={p3.x} y1={p3.y} x2={p4.x} y2={p4.y} />
      {rungs}
    </g>
  );
}

function SnakeArt({ from, to, color, index }: { from: number; to: number; color: string; index: number }) {
  const a = centerOf(from);
  const b = centerOf(to);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const bend = index % 2 ? 30 : -30;
  const c1 = { x: a.x + dx * .28 + bend, y: a.y + dy * .22 };
  const c2 = { x: a.x + dx * .72 - bend, y: a.y + dy * .78 };
  const d = `M ${a.x} ${a.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${b.x} ${b.y}`;
  const palettes: Record<string, { base: string; light: string; shade: string; belly: string }> = {
    violet: { base: '#74309d', light: '#d3a0ea', shade: '#32154d', belly: '#d9b6c9' },
    green: { base: '#267747', light: '#a6d17a', shade: '#123b2a', belly: '#c4d1a0' },
    red: { base: '#b63232', light: '#f0a06b', shade: '#541d26', belly: '#e5c097' },
    blue: { base: '#176da6', light: '#80c9df', shade: '#12304b', belly: '#bfd3c8' },
    orange: { base: '#ba601f', light: '#ffd27d', shade: '#5a2d1b', belly: '#e8c08c' },
  };
  const palette = palettes[color] || palettes.violet;
  const outlinePoints = Array.from({ length: 33 }, (_, i) => {
    const t = i / 32;
    const u = 1 - t;
    const x = u ** 3 * a.x + 3 * u ** 2 * t * c1.x + 3 * u * t ** 2 * c2.x + t ** 3 * b.x;
    const y = u ** 3 * a.y + 3 * u ** 2 * t * c1.y + 3 * u * t ** 2 * c2.y + t ** 3 * b.y;
    const tx = 3 * u ** 2 * (c1.x - a.x) + 6 * u * t * (c2.x - c1.x) + 3 * t ** 2 * (b.x - c2.x);
    const ty = 3 * u ** 2 * (c1.y - a.y) + 6 * u * t * (c2.y - c1.y) + 3 * t ** 2 * (b.y - c2.y);
    const length = Math.hypot(tx, ty) || 1;
    const radius = 1.8 + 7.2 * (1 - t ** 3);
    const nx = -ty / length;
    const ny = tx / length;
    return {
      upper: `${x + nx * radius} ${y + ny * radius}`,
      lower: `${x - nx * radius} ${y - ny * radius}`,
    };
  });
  const silhouette = `M ${outlinePoints[0].upper} ${outlinePoints.slice(1).map(point => `L ${point.upper}`).join(' ')} ${outlinePoints.slice(0, -1).reverse().map(point => `L ${point.lower}`).join(' ')} Z`;
  const skinId = `snake-scales-${from}`;
  const glossId = `snake-gloss-${from}`;
  const headRotation = Math.atan2(dy, dx) * 180 / Math.PI;
  return (
    <g data-testid={`snake-art-${from}-${to}`}>
      <defs>
        <pattern id={skinId} width="12" height="10" patternUnits="userSpaceOnUse">
          <rect width="12" height="10" fill={palette.base} />
          <path d="M-3 0 Q2 5 7 0 M3 5 Q8 10 13 5" fill="none" stroke={palette.shade} strokeWidth="1.1" opacity=".62" />
          <path d="M-2 1 Q2 4 6 1 M4 6 Q8 9 12 6" fill="none" stroke={palette.light} strokeWidth=".8" opacity=".72" />
        </pattern>
        <linearGradient id={glossId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={palette.light} stopOpacity=".76" />
          <stop offset=".34" stopColor={palette.light} stopOpacity=".18" />
          <stop offset=".62" stopColor={palette.shade} stopOpacity=".06" />
          <stop offset="1" stopColor={palette.shade} stopOpacity=".55" />
        </linearGradient>
      </defs>
      <path d={silhouette} fill={`url(#${skinId})`} stroke={palette.shade} strokeWidth="2.6" className="snake-silhouette" />
      <path d={silhouette} fill={`url(#${glossId})`} className="snake-glaze" />
      <path d={d} className="snake-back-highlight" />
      <g transform={`translate(${a.x} ${a.y}) rotate(${headRotation})`}>
        <path
          className="snake-head"
          d="M-17 0 C-14-6-8-9 0-8 C8-8 15-5 20 0 C14 5 7 8-1 8 C-9 8-14 5-17 0Z"
          fill={`url(#${glossId})`}
          style={{ color: palette.base, stroke: palette.shade }}
        />
        <path d="M-11 2 Q0 6 13 2" className="snake-jaw" stroke={palette.belly} />
        <path d="M-7-4 Q-3-7 2-5 M3-5 Q7-7 11-3" className="snake-brow" stroke={palette.shade} />
        <ellipse cx="-2" cy="-5" rx="2.5" ry="1.4" className="snake-eye" />
        <ellipse cx="5" cy="5" rx="2.2" ry="1.2" className="snake-eye" />
        <ellipse cx="-2" cy="-5" rx=".65" ry="1.25" className="snake-pupil" />
        <ellipse cx="5" cy="5" rx=".6" ry="1.1" className="snake-pupil" />
        <circle cx="-13" cy="-2" r=".9" className="snake-nostril" />
        <circle cx="-13" cy="2" r=".7" className="snake-nostril" />
        <path d="M-16 0 Q-22 1-26-2 M-22 1l-4 4" className="snake-tongue" />
      </g>
    </g>
  );
}

function Board({ game, walking }: { game: GameState; walking: WalkingPiece | null }) {
  const cells = useMemo(() => Array.from({ length: 100 }, (_, i) => {
    const row = Math.floor(i / 10);
    const col = i % 10;
    const number = squareAt(row, col);
    const locked = (LOCKED_SQUARES as readonly number[]).includes(number);
    const key = (KEY_SQUARES as readonly number[]).includes(number);
    const bullet = key || (EXTRA_BULLET_SQUARES as readonly number[]).includes(number);
    const mysteryBox = (MYSTERY_BOX_SQUARES as readonly number[]).includes(number);
    const gun = number === 94 || number === 95 || number === 96;
    const boom = number === BOOM_SQUARE;
    const tone = locked ? 'locked' : key ? 'key-square' : number % 3 === 0 ? 'blue' : (row + col) % 2 === 0 ? 'green' : 'cream';
    return (
      <div className={`board-cell ${tone} ${locked || key ? 'special' : ''}`} key={number} data-testid={`board-square-${number}`} aria-label={`Square ${number}${bullet ? key ? ', bullet pickup' : ', bullet' : ''}${mysteryBox ? ', mystery box' : ''}${gun ? ', gun' : ''}${boom ? ', boom trap' : ''}`}>
        <span className="cell-number" data-testid={`square-number-${number}`}>{number}</span>
        {bullet && <BulletIcon square={number} />}
        {mysteryBox && <MysteryBoxIcon square={number} />}
        {gun && <GunIcon />}
        {boom && <BoomIcon />}
        {locked && <>
          <span className="lock-caption">TORCH KEY<br />REQUIRED</span>
          <KeyRound className="locked-glyph" strokeWidth={2.2} />
        </>}
      </div>
    );
  }), []);
  const pieceStyle = (position: number, playerIndex: number) => {
    const point = position > 0 ? centerOf(position) : { x: 24, y: 948 };
    const player = game.players[playerIndex];
    const stacked = game.players.some((other, index) => index !== playerIndex && other.position === position);
    return {
      left: `${point.x / 10}%`,
      top: `${point.y / 10}%`,
      ...(stacked ? { marginLeft: playerIndex === 0 ? '-8%' : '8%', marginTop: playerIndex === 0 ? '-7%' : '7%' } : {}),
    };
  };
  return (
    <div className="board-wrap" data-testid="game-board">
      <div className="board-inner">
        <div className="board-grid">{cells}</div>
        <svg className="board-svg" viewBox="0 0 1000 1000" aria-label="Illustrated snakes and ladders">
          {SNAKES.map((snake, index) => <SnakeArt key={snake.from} from={snake.from} to={snake.to} color={snake.color} index={index} />)}
          {LADDERS.map(ladder => <LadderArt key={ladder.from} from={ladder.from} to={ladder.to} />)}
        </svg>
        <div className="crown-tile" data-testid="goal-crown" aria-label="Finish at square 100">
          <Crown />
          <span>100</span>
        </div>
        {game.players.map((player, index) => {
          const position = walking?.playerId === player.id ? walking.position : player.position;
          const stacked = game.players.some((other, otherIndex) => otherIndex !== index && other.position === position);
          return (
            <div
              key={player.id}
              className={`board-piece ${player.color === 'blue' ? 'blue-piece' : 'coral-piece'} ${stacked ? 'stacked' : ''}`}
              style={pieceStyle(position, index)}
              data-testid={`piece-${player.id}`}
              aria-label={`${player.name} on square ${position || 'home'}`}
            >{index + 1}</div>
          );
        })}
      </div>
      <svg className="home-roof" viewBox="0 0 100 75" aria-hidden="true">
        <path d="M6 42 50 7l44 35-8 9-36-28L14 51z" fill="#df4e36" stroke="#ffd77a" strokeWidth="5" strokeLinejoin="round" />
        <path d="M20 44h60v26H20z" fill="#edbd62" stroke="#7d421f" strokeWidth="4" />
        <path d="M43 52h15v18H43z" fill="#714022" />
      </svg>
      <div className="home-badge" data-testid="home-base"><Sparkles size={12} /> START</div>
    </div>
  );
}

function App() {
  const [game, setGame] = useState<GameState>(readGame);
  const [rolling, setRolling] = useState(false);
  const [diceFace, setDiceFace] = useState<number | null>(game.lastRoll);
  const [walking, setWalking] = useState<WalkingPiece | null>(null);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(game)); } catch { /* Local play remains available without storage. */ }
  }, [game]);

  const currentPlayer = game.players[game.currentPlayerIndex];
  const winner = game.players.find(player => player.id === game.winnerId);

  const rollDice = async () => {
    if (rolling || game.winnerId) return;
    setRolling(true);
    try {
      const result = await new Promise<number>(resolve => {
        let frames = 0;
        const animation = window.setInterval(() => {
          setDiceFace(1 + Math.floor(Math.random() * 6));
          frames += 1;
          if (frames >= 7) {
            window.clearInterval(animation);
            const settledRoll = 1 + Math.floor(Math.random() * 6);
            setDiceFace(settledRoll);
            resolve(settledRoll);
          }
        }, 85);
      });

      const player = game.players[game.currentPlayerIndex];
      const destination = player.position + result;
      const blockedByGate = player.keys === 0 && (LOCKED_SQUARES as readonly number[]).some(
        square => square > player.position && square <= destination,
      );

      if (destination <= 100 && !blockedByGate) {
        const firstStep = Math.max(1, player.position + 1);
        const stepDelay = window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 45
          : MOVEMENT_STEP_DELAY_MS;
        for (let position = firstStep; position <= destination; position += 1) {
          setWalking({ playerId: player.id, position });
          await new Promise<void>(resolve => window.setTimeout(resolve, stepDelay));
        }
      }

      setGame(previous => playTurn(previous, result));
    } finally {
      setWalking(null);
      window.setTimeout(() => setRolling(false), 220);
    }
  };

  const startNewGame = () => {
    if (rolling) return;
    const fresh = createGame();
    setGame(fresh);
    setDiceFace(null);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* Ignore unavailable storage. */ }
  };

  return (
    <main className="game-shell">
      <div className="game-layout">
        <header className="topbar">
          <div className="brand-lockup">
            <div className="brand-mark" aria-hidden="true"><Crown size={23} /></div>
            <div>
              <div className="brand-title">Snakes &amp; Ladders</div>
              <div className="brand-subtitle">A tiny quest for two</div>
            </div>
          </div>
          <div className="top-chip" data-testid="game-mode"><i /> LOCAL · PASS &amp; PLAY</div>
        </header>

        <div className="game-columns">
          <Board game={game} walking={walking} />
          <section className="side-panel" aria-label="Game controls and player status">
            <div className="turn-card">
              <div className="eyebrow" data-testid="turn-number">TURN {String(game.turnNumber).padStart(2, '0')}</div>
              {winner ? (
                <>
                  <div className="turn-name" data-testid="winner-name">{winner.name} wins!</div>
                  <div className="turn-sub">The crown is yours. What a splendid climb.</div>
                </>
              ) : (
                <>
                  <div className="turn-name" data-testid="current-player">{currentPlayer.name}'s turn</div>
                  <div className="turn-sub">Pass the board, take your chance.</div>
                </>
              )}
              <div className="player-stack">
                {game.players.map((player, index) => (
                  <div className={`player-line ${!winner && index === game.currentPlayerIndex ? 'active' : ''}`} key={player.id} data-testid={`player-status-${player.id}`}>
                    <span className="player-dot" style={{ background: player.color === 'blue' ? '#36b8e6' : '#ef7653' }} />
                    <span className="player-label">{player.name}</span>
                    <span className="player-position" data-testid={`position-${player.id}`}>{player.position ? `#${player.position}` : 'HOME'}</span>
                    <span className="keys-chip" data-testid={`keys-${player.id}`}><KeyRound size={12} /> {player.keys}</span>
                  </div>
                ))}
              </div>
            </div>

            {winner ? (
              <div className="win-banner" data-testid="winner-banner"><Trophy size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Crown claimed!</div>
            ) : (
              <div className="roll-area">
                <button className="dice-button" onClick={rollDice} disabled={rolling || !!winner} aria-label="Roll the dice" data-testid="button-roll">
                  <span className={`dice-face ${rolling ? 'rolling' : ''}`} data-testid="dice-result">{diceFace ?? '—'}</span>
                </button>
                <div>
                  <div className="roll-copy">{rolling ? 'Rolling…' : game.lastRoll ? `Last roll · ${game.lastRoll}` : 'Ready when you are'}</div>
                  <div className="roll-hint">{rolling ? 'Fate is tumbling.' : 'Tap the die to move your piece.'}</div>
                </div>
              </div>
            )}
            {!winner && <button className="primary-action" onClick={rollDice} disabled={rolling} data-testid="button-roll-turn"><Dices size={17} /> {rolling ? 'Rolling the dice…' : 'Roll the dice'}</button>}

            <div className="message-card" aria-live="polite" data-testid="game-message">
              <Sparkles className="message-icon" size={16} />
              <div className="message-text">{game.message}</div>
            </div>

            <div className="rules-card">
              <div className="rules-title">A few things to know</div>
              <div className="rules-list">
                <div className="rule-line"><span className="rule-swatch" style={{ background: '#dc8540' }} /> Ladders lift you up; snakes send you sliding.</div>
                <div className="rule-line"><KeyRound size={13} color="#f0c65a" /> Find keys to open the torch gates.</div>
                <div className="rule-line"><Crown size={13} color="#f0c65a" /> Reach 100 with an exact roll to win.</div>
              </div>
            </div>
            <button className="primary-action" onClick={startNewGame} disabled={rolling} data-testid="button-new-game">
              <RotateCcw size={15} /> New game
            </button>
            <div className="panel-footer"><span>TURN {String(game.turnNumber).padStart(2, '0')}</span><span>YOUR TABLE, YOUR QUEST</span></div>
          </section>
        </div>
      </div>
    </main>
  );
}

export default App;