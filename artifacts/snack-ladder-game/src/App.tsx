import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Bomb, ChevronDown, CircleDot, Crosshair, Crown, Dices, Flashlight, KeyRound, LockKeyhole, RotateCcw, ShieldPlus, Sparkles, Trophy, Volume2, VolumeX, Wrench } from 'lucide-react';
import {
  BULLET_PICKUP_SQUARES,
  createGame,
  GUN_SQUARES,
  MAX_BULLETS,
  repairLegacyGame,
  passFire,
  resolveTurn,
  shootSnakes,
  SHOOTABLE_SNAKE_SQUARES,
  SNAKE_STUN_ROLLS,
  squareAt,
  SNAKES,
  LADDERS,
  BOOM_SQUARE,
  LOCKED_SQUARES,
  KEY_SQUARES,
  MYSTERY_BOX_SQUARES,
  choosePower,
  plantBomb,
  detonateBomb,
  useExtraDice,
  resolveDefense,
  isValidPowerState,
  type ShootableSnakeSquare,
  type GameState,
  type TurnResolution,
} from './game-engine';
import { useGameSounds } from './use-game-sounds';
import { ShotAnimation } from './ShotAnimation';
import { PowerControls } from './PowerControls';
import { DicePips } from './DicePips';

const STORAGE_KEY = 'snack-ladder-adventure-v5';
const QUEST_STORAGE_KEY = 'snack-ladder-adventure-v4';
const PREVIOUS_STORAGE_KEY = 'snack-ladder-adventure-v3';
const LEGACY_STORAGE_KEY = 'snack-ladder-adventure-v2';
const OLDEST_STORAGE_KEY = 'snack-ladder-adventure-v1';
const MOVEMENT_STEP_DELAY_MS = 240;
const SPECIAL_MOVE_DURATION_MS = { ladder: 2200, snake: 2000, boom: 700 } as const;
const SPECIAL_MOVE_STYLE = {
  '--ladder-move-duration': `${SPECIAL_MOVE_DURATION_MS.ladder}ms`,
  '--snake-move-duration': `${SPECIAL_MOVE_DURATION_MS.snake}ms`,
} as CSSProperties;
type WalkingPiece = {
  playerId: string;
  position: number;
  effect: 'step' | 'ladder' | 'snake' | 'boom' | 'torch' | 'return';
};
type Shot = { from: number; targets: ShootableSnakeSquare[] };

const SNAKE_ART: Record<string, string> = {
  violet: new URL('./realistic-snake-violet.png', import.meta.url).href,
  green: new URL('./realistic-snake-green.png', import.meta.url).href,
  red: new URL('./realistic-snake-red.png', import.meta.url).href,
  blue: new URL('./realistic-snake-blue.png', import.meta.url).href,
  orange: new URL('./realistic-snake-orange.png', import.meta.url).href,
};

function readGame(): { game: GameState; error: string | null; blocked: boolean } {
  try {
    for (const storageKey of [STORAGE_KEY, QUEST_STORAGE_KEY, PREVIOUS_STORAGE_KEY, LEGACY_STORAGE_KEY, OLDEST_STORAGE_KEY]) {
      const saved = localStorage.getItem(storageKey);
      if (!saved) continue;
      const value: unknown = JSON.parse(saved);
      if (!isSavedGame(value)) throw new Error('Invalid saved round');
      return { game: repairLegacyGame(value), error: null, blocked: false };
    }
  } catch {
    return { game: createGame(), error: 'The saved round could not be opened. It has not been replaced. Start a new game to save again.', blocked: true };
  }
  return { game: createGame(), error: null, blocked: false };
}

function isSavedGame(value: unknown): value is GameState {
  if (!value || typeof value !== 'object') return false;
  const game = value as Partial<GameState>;
  return Array.isArray(game.players) &&
    game.players.length === 2 &&
    game.players.every((player) =>
      player !== null &&
      typeof player === 'object' &&
      typeof player.id === 'string' &&
      typeof player.name === 'string' &&
      (player.color === 'blue' || player.color === 'coral') &&
      Number.isInteger(player.position) &&
      player.position >= 0 &&
      player.position <= 100 &&
      Number.isInteger(player.keys) &&
      player.keys >= 0 &&
      (player.hasTorch === undefined || typeof player.hasTorch === 'boolean') &&
      (player.crownKeyRoom === undefined || player.crownKeyRoom === null ||
        (KEY_SQUARES as readonly number[]).includes(player.crownKeyRoom)) &&
      (player.bullets === undefined ||
        (Number.isInteger(player.bullets) && player.bullets >= 0 && player.bullets <= MAX_BULLETS)) &&
      (player.snakeStuns === undefined ||
        SHOOTABLE_SNAKE_SQUARES.every((square) =>
          Number.isInteger(player.snakeStuns[square]) &&
          player.snakeStuns[square] >= 0 &&
          player.snakeStuns[square] <= SNAKE_STUN_ROLLS,
        )) &&
      (player.unlockedGates === undefined ||
        (Array.isArray(player.unlockedGates) &&
          player.unlockedGates.every((gate) =>
            (LOCKED_SQUARES as readonly number[]).includes(gate),
          ))),
    ) &&
    Number.isInteger(game.currentPlayerIndex) &&
    game.currentPlayerIndex! >= 0 &&
    game.currentPlayerIndex! <= 1 &&
    Number.isInteger(game.turnNumber) &&
    game.turnNumber! >= 1 &&
    (game.lastRoll === null || (Number.isInteger(game.lastRoll) && game.lastRoll! >= 1 && game.lastRoll! <= 6)) &&
    (game.winnerId === null || game.players.some((player) => player.id === game.winnerId)) &&
    (game.pendingFireForPlayerId === undefined ||
      game.pendingFireForPlayerId === null ||
      game.players[game.currentPlayerIndex!]?.id === game.pendingFireForPlayerId) &&
    typeof game.message === 'string' && isValidPowerState(game);
}

function centerOf(square: number) {
  for (let row = 0; row < 10; row += 1) {
    for (let col = 0; col < 10; col += 1) {
      if (squareAt(row, col) === square) return { x: col * 100 + 50, y: row * 100 + 50 };
    }
  }
  return { x: 50, y: 950 };
}

function scrollToGameSection(selector: string) {
  const section = document.querySelector(selector);
  if (!section) return;
  // Scroll the document directly; scrollIntoView can target the clipped game shell.
  window.scrollTo({
    top: Math.max(0, window.scrollY + section.getBoundingClientRect().top - 16),
    // A short shot must not start before a browser's smooth scroll has settled.
    behavior: 'instant',
  });
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

function SnakeArt({ from, to, color, sleeping }: { from: number; to: number; color: string; sleeping: boolean }) {
  const a = centerOf(from);
  const b = centerOf(to);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  const width = Math.min(72, Math.max(42, length * .12));
  const rotation = Math.atan2(-dx, dy) * 180 / Math.PI;
  return (
    <g className={sleeping ? 'snake-art-stunned' : ''} data-testid={`snake-art-${from}-${to}`} transform={`translate(${a.x} ${a.y}) rotate(${rotation})`}>
      <image
        className="snake-photo"
        href={SNAKE_ART[color] || SNAKE_ART.violet}
        x={-width / 2}
        y="0"
        width={width}
        height={length}
        preserveAspectRatio="none"
      />
    </g>
  );
}

function PandaToken({
  color,
  hopping,
  specialMove,
}: {
  color: 'blue' | 'coral';
  hopping: boolean;
  specialMove: 'ladder' | 'snake' | 'boom' | null;
}) {
  const scarf = color === 'blue' ? '#25a9df' : '#f06e50';
  const scarfShade = color === 'blue' ? '#0879ad' : '#c44839';
  return (
    <svg className={`panda-token ${hopping ? 'panda-token-hopping' : ''} ${specialMove ? `panda-token-${specialMove}` : ''}`} viewBox="0 0 52 62" aria-hidden="true">
      <ellipse cx="26" cy="57" rx="14" ry="3" fill="#10151b" opacity=".4" />
      <ellipse cx="26" cy="47" rx="15" ry="11" fill={scarf} stroke="#473523" strokeWidth="1.5" />
      <path d="M13 44q13 8 26 0v6q-13 9-26 0Z" fill={scarfShade} />
      <path d="m35 48 8 5-7 3-4-7Z" fill={scarf} stroke="#473523" strokeWidth="1" strokeLinejoin="round" />
      <circle cx="12" cy="17" r="8" fill="#24252a" />
      <circle cx="40" cy="17" r="8" fill="#24252a" />
      <circle cx="12" cy="17" r="3.2" fill="#efb7ad" />
      <circle cx="40" cy="17" r="3.2" fill="#efb7ad" />
      <path d="M8 28c0-12 7-20 18-20s18 8 18 20c0 11-7 18-18 18S8 39 8 28Z" fill="#fff7e8" stroke="#55412f" strokeWidth="1.5" />
      <ellipse cx="17" cy="26" rx="5.6" ry="7.3" fill="#28282b" transform="rotate(18 17 26)" />
      <ellipse cx="35" cy="26" rx="5.6" ry="7.3" fill="#28282b" transform="rotate(-18 35 26)" />
      <circle cx="18.4" cy="25.8" r="2.3" fill="#fffdf5" />
      <circle cx="33.6" cy="25.8" r="2.3" fill="#fffdf5" />
      <circle cx="18.8" cy="26" r="1.3" fill="#18191c" />
      <circle cx="33.2" cy="26" r="1.3" fill="#18191c" />
      <ellipse cx="26" cy="34" rx="8.2" ry="5.7" fill="#fffdf5" stroke="#dfd5c5" strokeWidth=".7" />
      <path d="M23 32q3-2 6 0-1.5 3.2-3 3.2T23 32Z" fill="#352724" />
      <path d="M26 35v2.2q-2.2 2.3-4.2.2m4.2-.2q2.2 2.3 4.2.2" fill="none" stroke="#43312a" strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="12" cy="35" r="2" fill="#ee9989" opacity=".65" />
      <circle cx="40" cy="35" r="2" fill="#ee9989" opacity=".65" />
      <path d="M20 44q6 2 12 0" fill="none" stroke="#fff9e9" strokeWidth="1.4" opacity=".8" />
      {(specialMove === 'ladder' || specialMove === 'snake') && (
        <g fill={specialMove === 'ladder' ? '#ffe998' : '#dfccff'} stroke={specialMove === 'ladder' ? '#b8762d' : '#7d5b9c'} strokeWidth=".7">
          {[{ x: 2, y: 19 }, { x: 51, y: 10 }, { x: 49, y: 51 }].map((point, index) => (
            <g key={index} transform={`translate(${point.x} ${point.y})`}>
              <path className="panda-motion-sparkle" style={{ animationDelay: `${index * .22}s` }}
                d="m0-5 1.6 3.4L5 0 1.6 1.6 0 5-1.6 1.6-5 0-1.6-1.6Z" />
            </g>
          ))}
        </g>
      )}
    </svg>
  );
}

function Board({
  game,
  walking,
  aiming,
  selectedTargets,
  shot,
  firing,
  onAimTarget,
}: {
  game: GameState;
  walking: WalkingPiece | null;
  aiming: boolean;
  selectedTargets: ShootableSnakeSquare[];
  shot: Shot | null;
  firing: boolean;
  onAimTarget: (square: ShootableSnakeSquare) => void;
}) {
  const activePlayer = game.players[game.currentPlayerIndex];
  const activeStuns = activePlayer.snakeStuns ?? { 98: 0, 99: 0 };
  const cells = useMemo(() => Array.from({ length: 100 }, (_, i) => {
    const row = Math.floor(i / 10);
    const col = i % 10;
    const number = squareAt(row, col);
    const gate = (LOCKED_SQUARES as readonly number[]).includes(number);
    const bullet = (BULLET_PICKUP_SQUARES as readonly number[]).includes(number);
    const mysteryBox = (MYSTERY_BOX_SQUARES as readonly number[]).includes(number);
    const gun = (GUN_SQUARES as readonly number[]).includes(number);
    const boom = number === BOOM_SQUARE;
    const tone = gate ? 'locked' : bullet ? 'bullet-square' : number % 3 === 0 ? 'blue' : (row + col) % 2 === 0 ? 'green' : 'cream';
    return (
      <div className={`board-cell ${tone} ${gate || bullet ? 'special' : ''} ${gate && activePlayer.hasTorch ? 'key-room-lit' : ''}`} key={number} data-testid={`board-square-${number}`} aria-label={`Square ${number}${gate ? `, black key room; ${activePlayer.hasTorch ? 'land here to collect a crown key' : 'torch required to collect its key'}` : ''}${bullet ? ', bullet pickup on landing' : ''}${mysteryBox ? ', mystery box' : ''}${gun ? ', gun' : ''}${boom ? ', boom trap' : ''}`}>
        <span className="cell-number" data-testid={`square-number-${number}`}>{number}</span>
        {bullet && <BulletIcon square={number} />}
        {mysteryBox && <MysteryBoxIcon square={number} />}
        {gun && <GunIcon />}
        {boom && <BoomIcon />}
        {gate && <>
          <span className="lock-caption">{activePlayer.hasTorch ? 'KEY ROOM' : 'DARK ROOM'}</span>
          <KeyRound className={`locked-glyph ${activePlayer.hasTorch ? 'key-revealed-glyph' : 'key-dark-glyph'}`} strokeWidth={2.2} data-testid={`key-room-${number}`} />
        </>}
      </div>
    );
  }), [activePlayer.hasTorch]);
  const pieceStyle = (position: number, playerIndex: number) => {
    const point = position > 0 ? centerOf(position) : { x: 70, y: 948 };
    const stacked = game.players.some((other, index) => index !== playerIndex && other.position === position);
    const offsetX = stacked ? playerIndex === 0 ? -8 : 8 : 0;
    const offsetY = stacked ? playerIndex === 0 ? -5 : 5 : 0;
    return {
      left: offsetX
        ? `calc(${point.x / 10}% ${offsetX < 0 ? '-' : '+'} ${Math.abs(offsetX)}px)`
        : `${point.x / 10}%`,
      top: offsetY
        ? `calc(${point.y / 10}% ${offsetY < 0 ? '-' : '+'} ${Math.abs(offsetY)}px)`
        : `${point.y / 10}%`,
    };
  };
  return (
    <div className="board-wrap" data-testid="game-board">
      <div className="board-inner">
        <div className="board-grid">{cells}</div>
        <svg className="board-svg" viewBox="0 0 1000 1000" aria-label="Photorealistic snakes and ladders">
          {SNAKES.map(snake => (
            <SnakeArt
              key={snake.from}
              from={snake.from}
              to={snake.to}
              color={snake.color}
              sleeping={SHOOTABLE_SNAKE_SQUARES.includes(snake.from as ShootableSnakeSquare) && activeStuns[snake.from as ShootableSnakeSquare] > 0}
            />
          ))}
          {LADDERS.map(ladder => <LadderArt key={ladder.from} from={ladder.from} to={ladder.to} />)}
        </svg>
        {game.bombs.map((bomb) => {
          const point = centerOf(bomb.square);
          const owner = game.players.find((player) => player.id === bomb.ownerId)!;
          return <span key={bomb.id} className={`planted-bomb planted-bomb-${owner.color} ${bomb.armed ? 'planted-bomb-armed' : ''}`}
            style={{ left: `${point.x / 10 + 2.5}%`, top: `${point.y / 10 + 2.5}%` }}
            data-testid={`planted-bomb-${bomb.square}`} aria-label={`${owner.name}'s planted bomb in house ${bomb.square}${bomb.armed ? ', rival stopped here' : ''}`}>
            <Bomb size={15} />
          </span>;
        })}
        <div className={`crown-tile ${activePlayer.crownKeyRoom === null ? 'crown-locked' : ''}`} data-testid="goal-crown"
          aria-label={!activePlayer.hasTorch ? '100: collect torch and return Home; crown locked' : activePlayer.crownKeyRoom === null ? '100: crown locked; collect a black-room key first' : '100: crown unlocked; return here to win'}>
          <Crown className="goal-crown-icon" />
          {activePlayer.crownKeyRoom === null && <LockKeyhole className="goal-lock-icon" data-testid="crown-lock" />}
          {!activePlayer.hasTorch && <Flashlight className="goal-torch-icon" data-testid="goal-torch" />}
          <span>100</span>
        </div>
        {(walking?.effect === 'torch' || walking?.effect === 'return') && (
          <div className="quest-pickup" role="status" data-testid="quest-pickup">
            {walking.effect === 'torch' ? <Flashlight size={25} /> : <LockKeyhole size={25} />}
            <strong>{walking.effect === 'torch' ? 'Torch collected!' : 'A black-room key is needed!'}</strong>
            <span>Returning Home</span>
          </div>
        )}
        {SHOOTABLE_SNAKE_SQUARES.map((square) => {
          const rounds = activeStuns[square];
          if (rounds <= 0) return null;
          const point = centerOf(square);
          return (
            <div
              className="snake-stun-badge"
              key={`stun-${square}`}
              style={{ left: `${point.x / 10}%`, top: `${point.y / 10}%` }}
              data-testid={`snake-stun-${square}`}
              aria-label={`Snake ${square} is stunned for ${rounds} more rolls by ${activePlayer.name}`}
            >
              ZZ · {rounds}
            </div>
          );
        })}
        {aiming && SHOOTABLE_SNAKE_SQUARES.map((square) => {
          const rounds = activeStuns[square];
          const point = centerOf(square);
          return (
            <button
              type="button"
              className={`aim-target ${selectedTargets.includes(square) ? 'aim-target-selected' : ''}`}
              key={`aim-${square}`}
              style={{ left: `${point.x / 10}%`, top: `${point.y / 10}%` }}
              onClick={() => onAimTarget(square)}
              disabled={rounds > 0 || firing}
              aria-pressed={selectedTargets.includes(square)}
              aria-label={rounds > 0 ? `Snake at square ${square} is already stunned for ${rounds} rolls` : `Aim at snake at square ${square}`}
              data-testid={`aim-target-${square}`}
            >
              <Crosshair size={17} />
              <span>{rounds > 0 ? `ZZ ${rounds}` : square}</span>
            </button>
          );
        })}
        {shot && <ShotAnimation from={centerOf(shot.from)} targets={shot.targets.map((square) => ({ square, ...centerOf(square) }))} />}
        {game.players.map((player, index) => {
          const position = walking?.playerId === player.id ? walking.position : player.position;
          const stacked = game.players.some((other, otherIndex) => otherIndex !== index && other.position === position);
          const movement = walking?.playerId === player.id ? walking.effect : null;
          const hopping = movement !== null;
          return (
            <div
              key={player.id}
              className={`board-piece ${stacked ? 'stacked' : ''} ${movement && movement !== 'step' ? `board-piece-${movement}` : ''}`}
              style={pieceStyle(position, index)}
              data-testid={`piece-${player.id}`}
              aria-label={`${player.name} on square ${position || 'home'}`}
            >
              <PandaToken
                key={hopping ? `${movement}-${position}` : `idle-${position}`}
                color={player.color}
                hopping={hopping}
                specialMove={movement === 'ladder' || movement === 'snake' || movement === 'boom' ? movement : null}
              />
              {(movement === 'ladder' || movement === 'snake') && (
                <span className={`move-caption move-caption-${movement}`} aria-hidden="true">
                  {movement === 'ladder' ? 'Up we go!' : 'Wheee!'}
                </span>
              )}
            </div>
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
  const [initialSave] = useState(readGame);
  const [game, setGame] = useState<GameState>(initialSave.game);
  const [saveBlocked, setSaveBlocked] = useState(initialSave.blocked);
  const [storageError, setStorageError] = useState(initialSave.error);
  const [powerError, setPowerError] = useState<string | null>(null);
  const latestGame = useRef(game);
  latestGame.current = game;
  const [rolling, setRolling] = useState(false);
  const [diceFace, setDiceFace] = useState<number | null>(game.lastRoll);
  const [walking, setWalking] = useState<WalkingPiece | null>(null);
  const [selectedTargets, setSelectedTargets] = useState<ShootableSnakeSquare[]>([]);
  const [shot, setShot] = useState<Shot | null>(null);
  const [firing, setFiring] = useState(false);
  const sounds = useGameSounds();
  const rollInFlight = useRef(false);
  const fireInFlight = useRef(false);
  const screenMounted = useRef(true);

  useEffect(() => {
    screenMounted.current = true;
    return () => { screenMounted.current = false; };
  }, []);

  useEffect(() => {
    if (saveBlocked) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(game));
      setStorageError(null);
    } catch {
      setStorageError('This round could not be saved in this browser. Keep this tab open to continue playing.');
    }
  }, [game, saveBlocked]);

  const currentPlayer = game.players[game.currentPlayerIndex];
  const winner = game.players.find(player => player.id === game.winnerId);
  const waitingToFire = game.pendingFireForPlayerId === currentPlayer.id;
  const availableTargets = SHOOTABLE_SNAKE_SQUARES.filter(
    (square) => currentPlayer.snakeStuns[square] === 0,
  );
  const applyPower = (command: (state: GameState) => GameState) => {
    if (rollInFlight.current || fireInFlight.current) return;
    try {
      const next = command(latestGame.current);
      latestGame.current = next;
      setGame(next);
      setPowerError(null);
    } catch (error) {
      setPowerError(error instanceof Error ? error.message : 'This power could not be used.');
    }
  };
  const applyAnimatedPower = async (command: (state: GameState) => TurnResolution, movingId?: string) => {
    if (rollInFlight.current || fireInFlight.current) return;
    rollInFlight.current = true;
    setRolling(true);
    const mobile = window.matchMedia('(max-width: 820px)').matches;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    try {
      const before = latestGame.current;
      const resolution = command(before);
      const id = movingId ?? before.players[before.currentPlayerIndex].id;
      const moved = resolution.state.players.find((player) => player.id === id)!;
      const effect = resolution.effect;
      if (effect) {
        if (mobile) {
          scrollToGameSection('[data-testid="game-board"]');
          await new Promise<void>((resolve) => window.setTimeout(resolve, 70));
          if (!screenMounted.current) return;
        }
        if (effect === 'torch' || effect === 'return') {
          setWalking({ playerId: id, position: 100, effect });
          await new Promise<void>((resolve) => window.setTimeout(resolve, reducedMotion ? 150 : 1100));
          if (!screenMounted.current) return;
          setWalking({ playerId: id, position: 0, effect: 'step' });
          await new Promise<void>((resolve) => window.setTimeout(resolve, reducedMotion ? 45 : 300));
        } else {
          if (effect === 'snake' || effect === 'ladder') sounds.play(effect);
          setWalking({ playerId: id, position: moved.position, effect });
          await new Promise<void>((resolve) => window.setTimeout(resolve, reducedMotion ? 45 : SPECIAL_MOVE_DURATION_MS[effect] + 80));
        }
        if (!screenMounted.current) return;
      }
      sounds.playPickups(before.players.find((player) => player.id === id)!, moved);
      latestGame.current = resolution.state;
      setGame(resolution.state);
      setPowerError(null);
      if (mobile && effect) scrollToGameSection('[data-testid="game-controls"]');
    } catch (error) {
      setPowerError(error instanceof Error ? error.message : 'The power could not finish.');
    } finally {
      rollInFlight.current = false;
      if (screenMounted.current) {
        setWalking(null);
        setRolling(false);
      }
    }
  };

  const selectTarget = (square: ShootableSnakeSquare) => {
    if (firing || !waitingToFire || !availableTargets.includes(square)) return;
    setSelectedTargets((targets) => targets.includes(square)
      ? targets.filter((target) => target !== square)
      : currentPlayer.bullets === 1 ? [square] : [...targets, square]);
  };

  const fireAt = async () => {
    if (fireInFlight.current || !waitingToFire || selectedTargets.length === 0) return;
    const nextGame = shootSnakes(game, selectedTargets);
    const targets = [...selectedTargets];
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const mobile = window.matchMedia('(max-width: 820px)').matches;
    fireInFlight.current = true;
    setFiring(true);
    try {
      if (mobile) {
        scrollToGameSection('[data-testid="game-board"]');
        await new Promise<void>((resolve) => window.setTimeout(resolve, reducedMotion ? 0 : 100));
        if (!screenMounted.current) return;
      }
      setShot({ from: currentPlayer.position, targets });
      await new Promise<void>((resolve) => window.setTimeout(resolve, reducedMotion ? 150 : 950));
      if (!screenMounted.current) return;
      setGame(nextGame);
      setSelectedTargets([]);
      setShot(null);
      if (mobile) {
        scrollToGameSection('[data-testid="game-controls"]');
      }
    } finally {
      fireInFlight.current = false;
      if (screenMounted.current) setFiring(false);
    }
  };

  const passShot = () => {
    if (fireInFlight.current) return;
    setGame(passFire(game));
    setSelectedTargets([]);
  };

  const rollDice = async () => {
    if (rollInFlight.current || fireInFlight.current || latestGame.current.winnerId ||
      latestGame.current.pendingFireForPlayerId || latestGame.current.pendingChoice) return;
    rollInFlight.current = true;
    setRolling(true);
    sounds.play('dice');
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

      const before = latestGame.current;
      const player = before.players[before.currentPlayerIndex];
      const resolution = resolveTurn(before, result);
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const stepDelay = reducedMotion
        ? 45
        : MOVEMENT_STEP_DELAY_MS;
      for (const position of resolution.path) {
        setWalking({ playerId: player.id, position, effect: 'step' });
        sounds.play('step');
        await new Promise<void>(resolve => window.setTimeout(resolve, stepDelay));
        if (!screenMounted.current) return;
      }
      const resolvedPlayer = resolution.state.players.find(item => item.id === player.id);
      const effect = resolution.effect;
      if (resolvedPlayer && (effect === 'torch' || effect === 'return')) {
        setWalking({ playerId: player.id, position: 100, effect });
        await new Promise<void>(resolve => window.setTimeout(resolve, reducedMotion ? 150 : 1100));
        if (!screenMounted.current) return;
        setWalking({ playerId: player.id, position: 0, effect: 'step' });
        await new Promise<void>(resolve => window.setTimeout(resolve, reducedMotion ? 45 : 300));
        if (!screenMounted.current) return;
      } else if (resolvedPlayer && (effect === 'ladder' || effect === 'snake' || effect === 'boom')) {
        if (effect === 'ladder' || effect === 'snake') sounds.play(effect);
        setWalking({ playerId: player.id, position: resolvedPlayer.position, effect });
        await new Promise<void>(resolve => window.setTimeout(resolve,
          reducedMotion ? 45 : SPECIAL_MOVE_DURATION_MS[effect] + 80,
        ));
        if (!screenMounted.current) return;
      }

      if (resolvedPlayer) sounds.playPickups(player, resolvedPlayer);
      setGame(resolution.state);
      latestGame.current = resolution.state;
    } finally {
      rollInFlight.current = false;
      if (screenMounted.current) {
        setWalking(null);
        setRolling(false);
      }
    }
  };

  const startNewGame = () => {
    if (rollInFlight.current || fireInFlight.current) return;
    if (!window.confirm('Start a new game? This replaces the saved round in this browser.')) return;
    const fresh = createGame();
    setGame(fresh);
    latestGame.current = fresh;
    setSaveBlocked(false);
    setPowerError(null);
    setStorageError(null);
    setDiceFace(null);
    setSelectedTargets([]);
    setShot(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(QUEST_STORAGE_KEY);
      localStorage.removeItem(PREVIOUS_STORAGE_KEY);
      localStorage.removeItem(LEGACY_STORAGE_KEY);
      localStorage.removeItem(OLDEST_STORAGE_KEY);
    } catch { /* Ignore unavailable storage. */ }
  };

  return (
    <main className="game-shell" style={SPECIAL_MOVE_STYLE}>
      <div className="game-layout">
        <header className="topbar">
          <div className="brand-lockup">
            <div className="brand-mark" aria-hidden="true"><Crown size={23} /></div>
            <div>
              <div className="brand-title">Snakes &amp; Ladders</div>
              <div className="brand-subtitle">A tiny quest for two</div>
            </div>
          </div>
          <div className="topbar-tools">
            <button
              className="sound-toggle"
              onClick={sounds.toggleMuted}
              aria-label={sounds.muted ? 'Enable sound effects' : 'Mute sound effects'}
              aria-pressed={sounds.muted}
              title={sounds.muted ? 'Enable sound effects' : 'Mute sound effects'}
              data-testid="button-sound"
            >
              {sounds.muted ? <VolumeX size={19} /> : <Volume2 size={19} />}
            </button>
            <div className="top-chip" data-testid="game-mode"><i /> LOCAL · PASS &amp; PLAY</div>
          </div>
        </header>

        <div className="game-columns">
          <Board game={game} walking={walking} aiming={waitingToFire} selectedTargets={selectedTargets} shot={shot} firing={firing} onAimTarget={selectTarget} />
          <section className="side-panel" aria-label="Game controls and player status" data-testid="game-controls">
            <div className="quest-card" data-testid="quest-status">
              <div className="quest-title">QUEST · STAGE {!currentPlayer.hasTorch ? 1 : currentPlayer.crownKeyRoom === null ? 2 : 3}/3</div>
              <div className="quest-steps">
                <span className={currentPlayer.hasTorch ? 'quest-done' : 'quest-current'}><Flashlight size={14} /> Torch</span>
                <span className={currentPlayer.crownKeyRoom !== null ? 'quest-done' : currentPlayer.hasTorch ? 'quest-current' : ''}><KeyRound size={14} /> One key</span>
                <span className={winner ? 'quest-done' : currentPlayer.crownKeyRoom !== null ? 'quest-current' : ''}><Crown size={14} /> Crown</span>
              </div>
              <p>{winner ? 'Torch, key and crown collected!' : !currentPlayer.hasTorch
                ? 'First reach 100 for your torch, then return Home. The crown is locked.'
                : currentPlayer.crownKeyRoom === null
                  ? 'Your torch is ready! Land in black room 17, 44 or 67 to collect one key.'
                  : `Key from room ${currentPlayer.crownKeyRoom} is ready. Reach 100 again with an exact roll to claim the crown.`}</p>
            </div>
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
                  <div className="turn-sub">{game.pendingChoice ? 'Resolve your landing choice before rolling.' : waitingToFire ? 'Aim carefully, or pass this shot.' : 'Use a saved power, or roll the dice.'}</div>
                </>
              )}
              <div className="player-stack">
                {game.players.map((player, index) => (
                  <div className="player-entry" key={player.id}>
                  <div className={`player-line ${!winner && index === game.currentPlayerIndex ? 'active' : ''}`} data-testid={`player-status-${player.id}`}>
                    <span className="player-dot" style={{ background: player.color === 'blue' ? '#36b8e6' : '#ef7653' }} />
                    <span className="player-label">{player.name}</span>
                    <span className="player-position" data-testid={`position-${player.id}`}>{player.position ? `#${player.position}` : 'HOME'}</span>
                    <span className="keys-chip" data-testid={`keys-${player.id}`} aria-label={`${player.keys} crown key`}><KeyRound size={12} /> {player.keys}/1</span>
                    <span className="ammo-chip" data-testid={`bullets-${player.id}`} aria-label={`${player.bullets} of ${MAX_BULLETS} bullets`}>
                      <CircleDot size={12} /> {player.bullets}/{MAX_BULLETS}
                    </span>
                  </div>
                  <div className="player-quest" data-testid={`torch-${player.id}`}>
                    <Flashlight size={12} /> {player.hasTorch ? 'Torch collected' : 'Find torch at 100'}
                    {player.crownKeyRoom !== null && <span> · Key from {player.crownKeyRoom}</span>}
                  </div>
                  </div>
                ))}
              </div>
              {SHOOTABLE_SNAKE_SQUARES.map((square) => {
                const rounds = currentPlayer.snakeStuns[square];
                return rounds > 0 ? (
                  <div className="stun-summary" key={`active-stun-${square}`} data-testid={`stun-summary-${square}`}>
                    Snake {square} is asleep for {rounds} more of your rolls.
                  </div>
                ) : null;
              })}
            </div>

            <PowerControls
              playerName={currentPlayer.name}
              powers={currentPlayer.powers} pending={game.pendingChoice}
              extraRollCredits={currentPlayer.extraRollCredits}
              busy={rolling || firing} actionsEnabled={!winner && !waitingToFire && !game.pendingChoice}
              bombs={game.bombs.map((bomb) => ({ ...bomb,
                ownerName: game.players.find((player) => player.id === bomb.ownerId)!.name,
                owned: bomb.ownerId === currentPlayer.id,
                ready: bomb.armed && game.players.some((player) => player.id !== bomb.ownerId && player.position === bomb.square),
              }))}
              onChoose={(power) => applyPower((state) => choosePower(state, power))}
              onDefense={(use) => { void applyAnimatedPower((state) => resolveDefense(state, use)); }}
              onPlant={(square) => applyPower((state) => plantBomb(state, square))}
              onExtraDice={() => applyPower(useExtraDice)}
              onDetonate={(id) => { void applyAnimatedPower(
                (state) => ({ state: detonateBomb(state, id), path: [], effect: 'boom' }),
                game.players.find((player) => player.id !== currentPlayer.id)!.id,
              ); }}
            />
            {powerError && <div className="sound-error" role="alert">{powerError}</div>}
            {storageError && <div className="sound-error" role="alert" data-testid="storage-warning">{storageError}</div>}

            {winner ? (
              <div className="win-banner" data-testid="winner-banner"><Trophy size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Crown claimed!</div>
            ) : waitingToFire ? (
              <div className="fire-choice-card" data-testid="fire-choice">
                <div className="fire-choice-title"><Crosshair size={17} /> Gun room · {currentPlayer.position}</div>
                <div className="fire-choice-copy">
                  {currentPlayer.bullets} bullet{currentPlayer.bullets === 1 ? '' : 's'} available. Choose your aim; each target costs one bullet.
                </div>
                <div className="aim-options" role="group" aria-label="Choose snakes to aim at">
                  {SHOOTABLE_SNAKE_SQUARES.map((square) => (
                    <button key={square} className="aim-option" onClick={() => setSelectedTargets([square])}
                      disabled={firing || !availableTargets.includes(square)}
                      aria-pressed={selectedTargets.length === 1 && selectedTargets[0] === square}
                      data-testid={`button-aim-${square}`}>
                      <Crosshair size={15} /> {square}<small>1 bullet</small>
                    </button>
                  ))}
                  <button className="aim-option" onClick={() => setSelectedTargets([...SHOOTABLE_SNAKE_SQUARES])}
                    disabled={firing || currentPlayer.bullets < 2 || availableTargets.length < 2}
                    aria-pressed={selectedTargets.length === 2} data-testid="button-aim-both">
                    <Crosshair size={15} /> Both<small>2 bullets</small>
                  </button>
                </div>
                {currentPlayer.bullets === 1 && <div className="fire-choice-copy">Only one bullet: aim at 98 or 99, not both.</div>}
                <div className="fire-choice-actions">
                  <button
                    className="primary-action"
                    onClick={fireAt}
                    disabled={rolling || firing || selectedTargets.length === 0}
                    data-testid="button-fire"
                  >
                    <Crosshair size={16} /> {firing ? 'Firing…' : selectedTargets.length === 2 ? 'Fire both' : 'Fire'}
                  </button>
                  <button className="secondary-action" onClick={passShot} disabled={rolling || firing} data-testid="button-pass-fire">
                    Pass this shot
                  </button>
                </div>
              </div>
            ) : (
              <div className="roll-area">
                <button className="dice-button" onClick={rollDice} disabled={rolling || !!winner || !!game.pendingChoice} aria-label="Roll the dice" data-testid="button-roll">
                  <span className={`dice-face ${rolling ? 'rolling' : ''}`} data-testid="dice-result"
                    role="img" aria-label={`Dice showing ${diceFace ?? 1}`}><DicePips value={diceFace ?? 1} /></span>
                </button>
                <div>
                  <div className="roll-copy">{rolling ? 'Rolling…' : game.lastRoll ? `Last roll · ${game.lastRoll}` : 'Ready when you are'}</div>
                  <div className="roll-hint">{rolling ? 'Fate is tumbling.' : 'Tap the die to move your piece.'}</div>
                </div>
              </div>
            )}
            {!winner && !waitingToFire && <button className="primary-action" onClick={rollDice} disabled={rolling || !!game.pendingChoice} data-testid="button-roll-turn"><Dices size={17} /> {game.pendingChoice ? 'Choose your power first' : rolling ? 'Rolling the dice…' : 'Roll the dice'}</button>}

            <div className="message-card" aria-live="polite" data-testid="game-message">
              <Sparkles className="message-icon" size={16} />
              <div className="message-text">{game.message}</div>
            </div>
            {sounds.error && <div className="sound-error" role="status">Sound effects could not play, but the game will continue.</div>}

            <details className="rules-card" data-testid="rules-drawer">
              <summary className="rules-title" data-testid="rules-drawer-toggle">A few things to know <ChevronDown size={17} className="rules-drawer-chevron" /></summary>
              <div className="rules-list" data-testid="rules-content">
                <div className="rule-line"><span className="rule-swatch" style={{ background: '#dc8540' }} /> Ladders lift you up; snakes send you sliding.</div>
                <div className="rule-line"><Dices size={13} /> A valid six earns another chance. Overshooting 100 does not.</div>
                <div className="rule-line"><Sparkles size={13} /> Rooms 14, 35, 51 and 76 let you choose a Bomb, Anti-Venom, Defuser Kit or Extra Dice.</div>
                <div className="rule-line"><Bomb size={13} /> Plant a bomb in any house, then detonate on your turn when the rival stops there. The blast sends them Home, not their inventory.</div>
                <div className="rule-line"><Flashlight size={13} color="#f0c65a" /> First arrival at 100 gives a torch and returns you Home, not a crown.</div>
                <div className="rule-line"><KeyRound size={13} color="#f0c65a" /> With your torch, land in black room 17, 44 or 67 for one key.</div>
                <div className="rule-line"><LockKeyhole size={13} /> Reach 100 without a black-room key and return Home to try again. Torch and key progress survive blasts.</div>
                <div className="rule-line"><CircleDot size={13} color="#dce6e9" /> Stop on {BULLET_PICKUP_SQUARES.join(', ')} to collect ammo, not while crossing; carry up to {MAX_BULLETS}.</div>
                <div className="rule-line"><Crosshair size={13} color="#f0c65a" /> Stop in a gun room to shoot 98, 99, or both with two bullets. Hits last for your next {SNAKE_STUN_ROLLS} rolls.</div>
                <div className="rule-line"><ShieldPlus size={13} /> Use one Anti-Venom before a bite to stay in that snake room. Keeping it means sliding down.</div>
                <div className="rule-line"><Wrench size={13} /> A Defuser Kit protects one visit to boom room 97 or removes a rival's planted bomb.</div>
                <div className="rule-line"><Dices size={13} /> Use Extra Dice before rolling to bank one additional roll. A valid six gives a separate bonus and does not spend that credit.</div>
                <div className="rule-line"><Crown size={13} color="#f0c65a" /> Return to 100 with your torch and key to unlock the crown. An exact roll is required.</div>
              </div>
            </details>
            <button className="primary-action" onClick={startNewGame} disabled={rolling || firing} data-testid="button-new-game">
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