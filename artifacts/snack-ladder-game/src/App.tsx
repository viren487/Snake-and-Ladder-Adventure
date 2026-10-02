import { useEffect, useMemo, useState } from 'react';
import { Crown, Dices, KeyRound, RotateCcw, Sparkles, Trophy } from 'lucide-react';
import {
  createGame,
  playTurn,
  squareAt,
  SNAKES,
  LADDERS,
  KEY_SQUARES,
  LOCKED_SQUARES,
  type GameState,
} from './game-engine';

const STORAGE_KEY = 'snack-ladder-adventure-v1';

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

function KeyIcon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className="key-glyph">
      <circle cx="16" cy="17" r="8" fill="none" stroke="currentColor" strokeWidth="5" />
      <path d="M22 22 40 40m-7-7 5-5m-10 0 5-5" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m8 11 4-4" stroke="#fff2b2" strokeWidth="2" strokeLinecap="round" />
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
  const d = `M ${a.x} ${a.y} C ${a.x + dx * .28 + bend} ${a.y + dy * .22}, ${a.x + dx * .72 - bend} ${a.y + dy * .78}, ${b.x} ${b.y}`;
  const colors: Record<string, string> = { violet: '#9951d4', green: '#43ae4b', red: '#eb4b3e', blue: '#278de3', orange: '#ed9129' };
  const fill = colors[color] || '#7d5bce';
  return (
    <g data-testid={`snake-art-${from}-${to}`}>
      <path d={d} className="snake-body" stroke={fill} />
      <path d={d} className="snake-highlight" />
      <g transform={`translate(${a.x} ${a.y}) rotate(${Math.atan2(dy, dx) * 180 / Math.PI + 90})`}>
        <ellipse className="snake-head" cx="0" cy="0" rx="12" ry="11" fill={fill} />
        <ellipse className="snake-eye" cx="-4" cy="-3" rx="3.2" ry="3.7" />
        <ellipse className="snake-eye" cx="4" cy="-3" rx="3.2" ry="3.7" />
        <circle className="snake-pupil" cx="-3.6" cy="-2.7" r="1.5" />
        <circle className="snake-pupil" cx="4.4" cy="-2.7" r="1.5" />
        <path d="M-3 5q3 3 6 0" fill="none" stroke="#fff4cd" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M-7-10l-3-5m17 5 3-5" stroke={fill} strokeWidth="3" strokeLinecap="round" />
      </g>
    </g>
  );
}

function Board({ game }: { game: GameState }) {
  const cells = useMemo(() => Array.from({ length: 100 }, (_, i) => {
    const row = Math.floor(i / 10);
    const col = i % 10;
    const number = squareAt(row, col);
    const locked = (LOCKED_SQUARES as readonly number[]).includes(number);
    const key = (KEY_SQUARES as readonly number[]).includes(number);
    const tone = locked ? 'locked' : key ? 'key-square' : number % 3 === 0 ? 'blue' : (row + col) % 2 === 0 ? 'green' : 'cream';
    return (
      <div className={`board-cell ${tone} ${locked || key ? 'special' : ''}`} key={number} data-testid={`board-square-${number}`}>
        <span className="cell-number" data-testid={`square-number-${number}`}>{number}</span>
        {key && <KeyIcon />}
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
        {game.players.map((player, index) => (
          <div
            key={player.id}
            className={`board-piece ${player.color === 'blue' ? 'blue-piece' : 'coral-piece'} ${game.players.some((other, i) => i !== index && other.position === player.position) ? 'stacked' : ''}`}
            style={pieceStyle(player.position, index)}
            data-testid={`piece-${player.id}`}
            aria-label={`${player.name} on square ${player.position || 'home'}`}
          >{index + 1}</div>
        ))}
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

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(game)); } catch { /* Local play remains available without storage. */ }
  }, [game]);

  const currentPlayer = game.players[game.currentPlayerIndex];
  const winner = game.players.find(player => player.id === game.winnerId);

  const rollDice = () => {
    if (rolling || game.winnerId) return;
    setRolling(true);
    let frames = 0;
    const animation = window.setInterval(() => {
      setDiceFace(1 + Math.floor(Math.random() * 6));
      frames += 1;
      if (frames >= 7) {
        window.clearInterval(animation);
        const result = 1 + Math.floor(Math.random() * 6);
        setDiceFace(result);
        setGame(previous => playTurn(previous, result));
        window.setTimeout(() => setRolling(false), 220);
      }
    }, 85);
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
          <Board game={game} />
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