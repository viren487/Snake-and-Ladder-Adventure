import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Bomb, ChevronDown, CircleDot, Crosshair, Crown, Dices, KeyRound, LockKeyhole, RotateCcw, ShieldPlus, Sparkles, Trophy, Volume2, VolumeX, Wrench } from 'lucide-react';
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
  useWebShooter,
  useKnife,
  resolveDefense,
  isValidPowerState,
  type ShootableSnakeSquare,
  type GameState,
  type TurnResolution,
  type MysteryPowerType,
} from './game-engine';
import { useGameSounds } from './use-game-sounds';
import { ShotAnimation } from './ShotAnimation';
import { PowerControls } from './PowerControls';
import MysteryCompass from './MysteryCompass';
import MatchCelebration from './MatchCelebration';
import { DicePips } from './DicePips';
import { OnlinePanel } from './OnlinePanel';
import BambooReturnArt from './BambooReturnArt';
import { useOnlineGame, type PickupCelebration } from './use-online-game';
import type { OnlineAction } from '@workspace/api-client-react';
import { getMrBotAction, type MrBotAction } from './mr-bot';
import { Route, Switch } from 'wouter';
import MobileV2Page from './pages/mobile-v2';
import NotFound from './pages/not-found';

const STORAGE_KEY = 'snack-ladder-adventure-v5';
const QUEST_STORAGE_KEY = 'snack-ladder-adventure-v4';
const PREVIOUS_STORAGE_KEY = 'snack-ladder-adventure-v3';
const LEGACY_STORAGE_KEY = 'snack-ladder-adventure-v2';
const OLDEST_STORAGE_KEY = 'snack-ladder-adventure-v1';
const BOT_STORAGE_KEY = 'snack-ladder-adventure-bot-v1';
const LOCAL_MODE_STORAGE_KEY = 'snack-ladder-local-mode-v1';
const MOBILE_PROFILE_STORAGE_KEY = 'snack-ladder-mobile-profile-v1';
const MOVEMENT_STEP_DELAY_MS = 240;
const SPECIAL_MOVE_DURATION_MS = { ladder: 2200, snake: 2000, boom: 2350, web: 1450, knife: 1250 } as const;
const SPECIAL_MOVE_STYLE = {
  '--ladder-move-duration': `${SPECIAL_MOVE_DURATION_MS.ladder}ms`,
  '--snake-move-duration': `${SPECIAL_MOVE_DURATION_MS.snake}ms`,
  '--boom-move-duration': `${SPECIAL_MOVE_DURATION_MS.boom}ms`,
  '--bamboo-move-duration': '2600ms',
  '--web-move-duration': `${SPECIAL_MOVE_DURATION_MS.web}ms`,
  '--knife-move-duration': `${SPECIAL_MOVE_DURATION_MS.knife}ms`,
} as CSSProperties;
type LocalPlayMode = 'pass' | 'bot';
type WalkingPiece = {
  playerId: string;
  playerIds?: string[];
  position: number;
  effect: 'step' | 'ladder' | 'snake' | 'boom' | 'torch' | 'return' | 'bamboo' | 'web' | 'knife';
  sourcePosition?: number;
};
type Shot = { from: number; targets: ShootableSnakeSquare[] };
type PickupNotice = PickupCelebration & { id: number };

const SNAKE_ART = new URL('./realistic-snake-red.png', import.meta.url).href;

type MobileLaunchProfile = { name: string; playMode: 'bot' | 'pass' | 'online' };

function readMobileLaunchProfile(): MobileLaunchProfile | null {
  try {
    if (!Reflect.get(window, '__SNACK_LADDER_MOBILE__')) return null;
    const saved = localStorage.getItem(MOBILE_PROFILE_STORAGE_KEY);
    if (!saved) return null;
    const value: unknown = JSON.parse(saved);
    if (!value || typeof value !== 'object') return null;
    const profile = value as Partial<MobileLaunchProfile>;
    const name = typeof profile.name === 'string' ? profile.name.trim().slice(0, 24) : '';
    if (!name || (profile.playMode !== 'bot' && profile.playMode !== 'pass' && profile.playMode !== 'online')) return null;
    return { name, playMode: profile.playMode };
  } catch {
    return null;
  }
}

function applyMobilePlayerName(game: GameState) {
  const profile = readMobileLaunchProfile();
  if (profile && game.players[0]) game.players[0].name = profile.name;
  return game;
}

function readLocalPlayMode(): LocalPlayMode {
  try {
    const profile = readMobileLaunchProfile();
    if (profile) return profile.playMode === 'bot' ? 'bot' : 'pass';
    return localStorage.getItem(LOCAL_MODE_STORAGE_KEY) === 'bot' ? 'bot' : 'pass';
  } catch {
    return 'pass';
  }
}

function createLocalGame(mode: LocalPlayMode): GameState {
  const game = applyMobilePlayerName(createGame());
  if (mode === 'bot') {
    game.players[1].name = 'Mr.Bot';
    game.message = 'Player 1 is ready to face Mr.Bot. First reach 100 for a torch; the crown stays locked until you collect a black-room key and return to 100.';
  }
  return game;
}

function storageKeyForMode(mode: LocalPlayMode) {
  return mode === 'bot' ? BOT_STORAGE_KEY : STORAGE_KEY;
}

function readGame(mode: LocalPlayMode = 'pass'): { game: GameState; error: string | null; blocked: boolean } {
  try {
    const storageKeys = mode === 'bot'
      ? [BOT_STORAGE_KEY]
      : [STORAGE_KEY, QUEST_STORAGE_KEY, PREVIOUS_STORAGE_KEY, LEGACY_STORAGE_KEY, OLDEST_STORAGE_KEY];
    for (const storageKey of storageKeys) {
      const saved = localStorage.getItem(storageKey);
      if (!saved) continue;
      const value: unknown = JSON.parse(saved);
      if (!isSavedGame(value)) throw new Error('Invalid saved round');
      const game = applyMobilePlayerName(repairLegacyGame(value));
      if (mode === 'bot') game.players[1].name = 'Mr.Bot';
      return { game, error: null, blocked: false };
    }
  } catch {
    return { game: createLocalGame(mode), error: 'The saved round could not be opened. It has not been replaced. Start a new game to save again.', blocked: true };
  }
  return { game: createLocalGame(mode), error: null, blocked: false };
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

function TorchIcon({ className, size = 24 }: { className?: string; size?: number }) {
  return <span className={`torch-icon ${className ?? ''}`} style={{ fontSize: size, width: size * 1.2, height: size * 1.2 }} aria-hidden="true">🔦</span>;
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
      <path className="gun-frame" d="M8 22.5h34l-4.4 5.1h-5.2L29.5 41q-.5 2-2.6 2h-8.2l2.6-13.1-8-2.5H9.8q-2.2 0-2.7-2.4Z" />
      <path className="gun-grip" d="m21.3 29.2 9.4.2-2.7 10.8q-.4 1.8-2.4 1.8h-7.2Z" />
      <path className="gun-grip-panel" d="m22.5 31 5.7.1-2.1 8.4h-5.3Z" />
      <path className="gun-slide" d="M5.5 12.3q0-3.5 3.7-3.5h32.5l15 4.7 4.3 2.7v7.1H39.8l-3.5 4H10.5q-3.1 0-3.7-3Z" />
      <path className="gun-slide-highlight" d="M9.5 11.3h30.8l12.4 3.8H13.1q-2.4 0-3.6 1.2Z" />
      <path className="gun-ejection-port" d="M30.1 14h7.2v5.2h-7.2z" />
      <path className="gun-muzzle" d="M57.2 13.5 61 16v7.3h-3.8Z" />
      <path className="gun-sights" d="M14 8.7V6.8h4.8v1.9m23.6.3V7.1h4.1v3.1" />
      <path className="gun-serrations" d="M11.5 13.1v9m3-8.7v9m3-8.7v9" />
      <path className="gun-trigger-guard" d="M32.7 28.6h7.2q4.3 0 3.5 4l-1.6 4.1h-3" />
      <path className="gun-trigger" d="m37.5 29.7-1 4.4" />
      <path className="gun-frame-highlight" d="M10 25.2h26.8M21 30.6l-1.6 8.1" />
      <circle className="gun-pin" cx="14.1" cy="26.2" r="1.5" />
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
      <g className="snake-sway" style={{ animationDelay: `${-((from * 173) % 4100)}ms` }}>
        <image
          className={`snake-photo snake-photo-${color}`}
          href={SNAKE_ART}
          x={-width / 2}
          y="0"
          width={width}
          height={length}
          preserveAspectRatio="none"
        />
      </g>
    </g>
  );
}

function PowerAnimation({ walking }: { walking: WalkingPiece | null }) {
  if (!walking) return null;
  const source = walking.sourcePosition === undefined ? null : centerOf(walking.sourcePosition);
  if (walking.effect === 'boom' && source) {
    const rays = Array.from({ length: 14 }, (_, index) => {
      const angle = (Math.PI * 2 * index) / 14;
      const tangentX = -Math.sin(angle) * 11;
      const tangentY = Math.cos(angle) * 11;
      const innerX = Math.cos(angle) * 40;
      const innerY = Math.sin(angle) * 40;
      const outerX = Math.cos(angle) * (index % 2 === 0 ? 152 : 125);
      const outerY = Math.sin(angle) * (index % 2 === 0 ? 152 : 125);
      return `M${innerX - tangentX} ${innerY - tangentY} L${outerX} ${outerY} L${innerX + tangentX} ${innerY + tangentY} Z`;
    });
    return (
      <svg className="power-animation-layer bomb-blast-layer" viewBox="0 0 1000 1000" aria-hidden="true">
        <g transform={`translate(${source.x} ${source.y})`} className="bomb-blast-flash">
          <circle r="188" className="bomb-blast-wave bomb-blast-wave-one" />
          <circle r="145" className="bomb-blast-wave bomb-blast-wave-two" />
          {rays.map((path, index) => <path d={path} key={`blast-ray-${index}`} className="bomb-blast-ray" />)}
          <circle r="49" className="bomb-blast-core" />
          <circle r="25" className="bomb-blast-center" />
          <text x="0" y="8" className="bomb-blast-label">BOOM</text>
        </g>
      </svg>
    );
  }
  if (!source) return null;
  if (walking.effect === 'web') {
    const target = centerOf(walking.position);
    const controlX = (source.x + target.x) / 2;
    const controlY = Math.min(source.y, target.y) - 72;
    const webPath = `M${source.x} ${source.y} Q${controlX} ${controlY} ${target.x} ${target.y}`;
    return (
      <svg className="power-animation-layer" viewBox="0 0 1000 1000" aria-hidden="true">
        <path d={webPath} pathLength="1" className="web-thread-glow" />
        <path d={webPath} pathLength="1" className="web-thread" />
        <circle cx={target.x} cy={target.y} r="32" className="web-impact-net" />
        <path d={`M${target.x - 21} ${target.y - 19}L${target.x + 21} ${target.y + 19}M${target.x + 21} ${target.y - 19}L${target.x - 21} ${target.y + 19}`} className="web-net-cross" />
      </svg>
    );
  }
  if (walking.effect === 'knife') {
    return (
      <svg className="power-animation-layer" viewBox="0 0 1000 1000" aria-hidden="true">
        <g transform={`translate(${source.x} ${source.y})`}>
          <path d="M-38 29 33-31" className="knife-cut knife-cut-one" />
          <path d="M-30-27 37 31" className="knife-cut knife-cut-two" />
          <path d="m-4-48 8 15 16 1-12 10 4 16-16-8-13 9 3-16-12-11 16-1Z" className="knife-impact" />
        </g>
      </svg>
    );
  }
  return null;
}

function PandaToken({
  color,
  hopping,
  specialMove,
}: {
  color: "blue" | "coral" | "green" | "purple";
  hopping: boolean;
  specialMove: 'ladder' | 'snake' | 'boom' | 'bamboo' | null;
}) {
  const scarf = {blue:'#25a9df',coral:'#f06e50',green:'#36ba7b',purple:'#ad78ea'}[color];
  const scarfShade = {blue:'#0879ad',coral:'#c44839',green:'#168353',purple:'#714cba'}[color];
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
  pickupNotice,
  choicesEnabled,
  choiceBusy,
  onChoosePower,
  walking,
  aiming,
  selectedTargets,
  shot,
  firing,
  onAimTarget,
}: {
  game: GameState;
  pickupNotice: PickupNotice | null;
  choicesEnabled: boolean;
  choiceBusy: boolean;
   onChoosePower: (power: MysteryPowerType) => void;
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
    const roomLit = gate && (
      game.players.some((player) => player.hasTorch && player.position === number) ||
      (walking?.position === number && game.players.some((player) => player.id === walking.playerId && player.hasTorch))
    );
    const keyVisible = roomLit && activePlayer.hasTorch && activePlayer.crownKeyRoom === null;
    const roomDescription = !roomLit
      ? 'completely dark black room; carry a torch and land exactly here to reveal the key'
      : keyVisible
        ? 'torch-lit black room; the key is revealed; land exactly here to collect it'
        : 'black room lit by a torch';
    return (
      <div className={`board-cell ${tone} ${gate || bullet ? 'special' : ''} ${gate ? roomLit ? 'key-room-lit' : 'key-room-dark' : ''}`} key={number} data-testid={`board-square-${number}`} aria-label={`Square ${number}${gate ? `, ${roomDescription}` : ''}${bullet ? ', bullet pickup on landing' : ''}${mysteryBox ? ', mystery box' : ''}${gun ? ', gun' : ''}${boom ? ', boom trap' : ''}`}>
        <span className="cell-number" data-testid={`square-number-${number}`}>{number}</span>
        {bullet && <BulletIcon square={number} />}
        {mysteryBox && <MysteryBoxIcon square={number} />}
        {gun && <GunIcon />}
        {boom && <BoomIcon />}
        {gate && <>
          <span className="lock-caption">{!roomLit ? 'DARK ROOM' : keyVisible ? 'KEY REVEALED' : 'TORCH LIGHT'}</span>
          <KeyRound className={`locked-glyph ${keyVisible ? 'key-revealed-glyph' : 'key-dark-glyph'}`} strokeWidth={2.2} data-testid={`key-room-${number}`} />
        </>}
      </div>
    );
  }), [activePlayer, game.players, walking]);
  const pieceStyle = (position: number, playerIndex: number, bamboo: boolean) => {
    const point = bamboo ? { x: -36, y: position === 100 ? 50 : 948 }
      : position > 0 ? centerOf(position) : { x: 70, y: 948 };
    const stacked = !bamboo && game.players.some((other, index) => index !== playerIndex && other.position === position);
    const offsetX = stacked ? playerIndex % 2 === 0 ? -8 : 8 : 0;
    const offsetY = stacked ? game.players.length > 2 ? playerIndex < 2 ? -7 : 7 : playerIndex === 0 ? -5 : 5 : 0;
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
      <div className={`board-inner ${walking?.effect === 'boom' ? 'board-inner-blast' : ''}`}>
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
        <BambooReturnArt
          active={walking?.effect === 'bamboo'}
          torchVisible={!activePlayer.hasTorch && activePlayer.crownKeyRoom === null && !(walking?.effect === 'bamboo' && walking.position === 100)}
          collecting={walking?.effect === 'bamboo' && walking.position === 100}
        />
        {pickupNotice && (
          <div
            className={`pickup-notice pickup-notice-${pickupNotice.kind}`}
            key={pickupNotice.id}
            role="status"
            aria-live="polite"
            data-testid={`pickup-notice-${pickupNotice.kind}`}
          >
            <span className="pickup-notice-icon">
              {pickupNotice.kind === 'torch' ? <TorchIcon size={30} /> : <KeyRound size={29} />}
            </span>
            <span className="pickup-notice-copy">
              <strong>{pickupNotice.kind === 'torch' ? 'TORCH COLLECTED!' : 'KEY COLLECTED!'}</strong>
              <span>
                {pickupNotice.kind === 'torch'
                  ? `${pickupNotice.playerName} can now reveal a dark room.`
                  : `Room ${pickupNotice.room} key secured. Return to 100 for the crown.`}
              </span>
            </span>
            <Sparkles className="pickup-notice-sparkles" size={19} aria-hidden="true" />
          </div>
        )}
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
          aria-label={activePlayer.crownKeyRoom !== null ? '100: crown unlocked; return here to win' : !activePlayer.hasTorch ? '100: collect torch and return Home; crown locked' : '100: crown locked; collect a black-room key first'}>
          <Crown className="goal-crown-icon" />
          {activePlayer.crownKeyRoom === null && <LockKeyhole className="goal-lock-icon" data-testid="crown-lock" />}
          <span>100</span>
        </div>
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
        <PowerAnimation walking={walking} />
        {game.pendingChoice?.kind === "mystery" && <MysteryCompass
          key={game.pendingChoice.playerId + "-" + game.pendingChoice.square}
          square={game.pendingChoice.square} canChoose={choicesEnabled} busy={choiceBusy}
          onChoose={onChoosePower} />}
        {game.players.map((player, index) => {
          const isWalking = walking?.playerId === player.id || walking?.playerIds?.includes(player.id);
          const position = isWalking && walking ? walking.position : player.position;
          const stacked = game.players.some((other, otherIndex) => otherIndex !== index && other.position === position);
          const movement = isWalking && walking ? walking.effect : null;
          const hopping = movement !== null;
          return (
            <div
              key={player.id}
              className={`board-piece ${stacked ? 'stacked' : ''} ${movement && movement !== 'step' ? `board-piece-${movement}` : ''}`}
              style={pieceStyle(position, index, movement === 'bamboo')}
              data-testid={`piece-${player.id}`}
              aria-label={`${player.name} on square ${position || 'home'}`}
            >
              <PandaToken
                key={hopping ? `${movement}-${position}` : `idle-${position}`}
                color={player.color}
                hopping={hopping}
                specialMove={movement === 'ladder' || movement === 'snake' || movement === 'boom' || movement === 'bamboo' ? movement : null}
              />
              {(player.hasTorch || movement === 'bamboo') && <TorchIcon className="panda-carried-torch" size={19} />}
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

function GameScreen() {
  const [mobileProfile] = useState(readMobileLaunchProfile);
  const [playMode, setPlayMode] = useState<LocalPlayMode>(() =>
    mobileProfile ? (mobileProfile.playMode === 'bot' ? 'bot' : 'pass') : readLocalPlayMode());
  const [initialSave] = useState(() => readGame(playMode));
  const [game, setGame] = useState<GameState>(initialSave.game);
  const [saveBlocked, setSaveBlocked] = useState(initialSave.blocked);
  const [storageError, setStorageError] = useState(initialSave.error);
  const [powerError, setPowerError] = useState<string | null>(null);
  const latestGame = useRef(game);
  latestGame.current = game;
  const [rolling, setRolling] = useState(false);
  const [diceFace, setDiceFace] = useState<number | null>(game.lastRoll);
  const [walking, setWalking] = useState<WalkingPiece | null>(null);
  const [pickupNotice, setPickupNotice] = useState<PickupNotice | null>(null);
  const pickupNoticeSequence = useRef(0);
  const announcePickup = (pickup: PickupCelebration) => {
    pickupNoticeSequence.current += 1;
    setPickupNotice({ ...pickup, id: pickupNoticeSequence.current });
  };
  const [selectedTargets, setSelectedTargets] = useState<ShootableSnakeSquare[]>([]);
  const [shot, setShot] = useState<Shot | null>(null);
  const [firing, setFiring] = useState(false);
  const sounds = useGameSounds();
  const rollInFlight = useRef(false);
  const fireInFlight = useRef(false);
  const screenMounted = useRef(true);
  const online = useOnlineGame({ gameRef: latestGame, setGame, setDiceFace, setWalking,
    setShot, setRolling, setFiring, setSelectedTargets, sounds, announcePickup });
  const mrBotId = game.players[1]?.id;
  const mrBotAction = playMode === 'bot' && !online.session && !online.loadingSession && !online.pendingAdmission && mrBotId
    ? getMrBotAction(game, mrBotId)
    : null;
  const mrBotTurn = playMode === 'bot' && !online.session && !game.winnerId &&
    game.players[game.currentPlayerIndex]?.id === mrBotId;
  const mrBotIsActing = mrBotTurn || mrBotAction?.type === 'detonate';
  const humanPlayerId = game.players[0]?.id;
  const humanBombReady = playMode === 'bot' && !online.session && !!humanPlayerId && !!mrBotId &&
    game.bombs.some((bomb) => bomb.ownerId === humanPlayerId && bomb.armed &&
      game.players.some((player) => player.id === mrBotId && player.position === bomb.square && !game.winnerIds?.includes(player.id)));
  const remoteDisabled = online.loadingSession || online.busy || !!online.pendingAdmission ||
    (!!online.session && !online.canAct) || mrBotIsActing;
  useEffect(() => {
    if (game.pendingChoice?.kind === "mystery" && !rolling && !firing && window.matchMedia("(max-width: 820px)").matches) {
      scrollToGameSection('[data-testid="game-board"]');
    }
  }, [game.pendingChoice, rolling, firing]);
  const switchLocalMode = (nextMode: LocalPlayMode) => {
    if (nextMode === playMode || online.session || online.loadingSession || online.busy ||
      online.pendingAdmission || rollInFlight.current || fireInFlight.current) return;
    if (!saveBlocked) {
      try {
        localStorage.setItem(storageKeyForMode(playMode), JSON.stringify(latestGame.current));
      } catch { /* The save effect below will report storage failures for the selected mode. */ }
    }
    const loaded = readGame(nextMode);
    latestGame.current = loaded.game;
    setPlayMode(nextMode);
    setGame(loaded.game);
    setSaveBlocked(loaded.blocked);
    setStorageError(loaded.error);
    setPowerError(null);
    setDiceFace(loaded.game.lastRoll);
    setWalking(null);
    setPickupNotice(null);
    setSelectedTargets([]);
    setShot(null);
    try {
      localStorage.setItem(LOCAL_MODE_STORAGE_KEY, nextMode);
    } catch { /* Keep the chosen mode for this session even if storage is unavailable. */ }
  };
  const leaveOnline = () => {
    if (window.confirm('Leave online play? If connected, this ends the room for all players. Your local saved round will stay intact.')) void online.leave();
  };

  useEffect(() => {
    screenMounted.current = true;
    return () => { screenMounted.current = false; };
  }, []);

  useEffect(() => {
    if (!pickupNotice) return;
    const timeout = window.setTimeout(() => setPickupNotice(null), 3200);
    return () => window.clearTimeout(timeout);
  }, [pickupNotice]);

  useEffect(() => {
    if (saveBlocked || online.session || online.loadingSession) return;
    try {
      localStorage.setItem(storageKeyForMode(playMode), JSON.stringify(game));
      setStorageError(null);
    } catch {
      setStorageError('This round could not be saved in this browser. Keep this tab open to continue playing.');
    }
  }, [game, playMode, saveBlocked, online.session, online.loadingSession]);

  const currentPlayer = game.players[game.currentPlayerIndex];
  const winner = game.players.find(player => player.id === game.winnerId);
  const playerClaimedCrown = currentPlayer.id === game.winnerId || (game.winnerIds ?? []).includes(currentPlayer.id);
  const matchComplete = !!game.winnerId;
  const torchEarned = currentPlayer.hasTorch || currentPlayer.crownKeyRoom !== null || playerClaimedCrown;
  const keyEarned = currentPlayer.crownKeyRoom !== null || playerClaimedCrown;
  useEffect(() => { sounds.setCelebrating(!!game.winnerId); }, [game.winnerId, sounds.setCelebrating]);
  const waitingToFire = game.pendingFireForPlayerId === currentPlayer.id;
  const mobileTurnLabel = winner
    ? 'Match finished'
    : mrBotIsActing
      ? mrBotTurn ? "Mr.Bot's turn" : "Mr.Bot's move"
      : online.session && !online.canAct
        ? `${currentPlayer.name}'s turn`
        : 'Your turn';
  const availableTargets = SHOOTABLE_SNAKE_SQUARES.filter(
    (square) => currentPlayer.snakeStuns[square] === 0,
  );
  const fireAimPrompt = remoteDisabled
    ? `${currentPlayer.name} is choosing a target.`
    : selectedTargets.length === 2
      ? 'Both snakes selected; firing will use two bullets.'
      : selectedTargets.length === 1
        ? `Snake ${selectedTargets[0]} selected; firing will use one bullet.`
        : availableTargets.length === 0
          ? 'There are no active snakes to target.'
          : currentPlayer.bullets === 1 || availableTargets.length === 1
            ? `Tap snake ${availableTargets[0]} on the board to aim.`
            : 'Tap one or both snake heads on the board. Targeting both uses two bullets.';
  const applyPower = (command: (state: GameState) => GameState, action?: OnlineAction) => {
    if (online.session) { if (online.canAct && action) void online.action(action); return; }
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
  const applyAnimatedPower = async (command: (state: GameState) => TurnResolution, movingId?: string, action?: OnlineAction) => {
    if (online.session) { if ((online.canAct || (action?.type === "detonate" && online.canDetonate)) && action) await online.action(action); return; }
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
          setWalking({ playerId: id, position: 100, effect: 'bamboo' });
          await new Promise<void>((resolve) => window.setTimeout(resolve, reducedMotion ? 45 : 200));
          if (!screenMounted.current) return;
          if (effect === 'torch') {
            sounds.play('happy');
            announcePickup({ kind: 'torch', playerName: moved.name });
          }
          setWalking({ playerId: id, position: 0, effect: 'bamboo' });
          await new Promise<void>((resolve) => window.setTimeout(resolve, reducedMotion ? 45 : 2680));
          if (!screenMounted.current) return;
          setWalking({ playerId: id, position: 0, effect: 'step' });
          await new Promise<void>((resolve) => window.setTimeout(resolve, reducedMotion ? 45 : 300));
        } else {
          if (effect === 'boom') sounds.play('bomb');
          if (effect === 'snake' || effect === 'ladder') sounds.play(effect);
          const sourcePosition = resolution.sourcePosition
            ?? (effect === 'boom'
              ? resolution.path.at(-1) ?? before.players.find((player) => player.id === id)?.position
              : undefined);
          const playerIds = effect === 'boom'
            ? before.players.flatMap((player) => {
              const after = resolution.state.players.find((item) => item.id === player.id);
              return player.position > 0 && after?.position === 0 ? [player.id] : [];
            })
            : undefined;
          setWalking({
            playerId: id, position: moved.position, effect,
            ...(playerIds ? { playerIds } : {}),
            ...(sourcePosition === undefined ? {} : { sourcePosition }),
          });
          await new Promise<void>((resolve) => window.setTimeout(resolve, reducedMotion ? 45 : SPECIAL_MOVE_DURATION_MS[effect] + 80));
        }
        if (!screenMounted.current) return;
      }
      const beforePlayer = before.players.find((player) => player.id === id);
      if (beforePlayer) {
        sounds.playPickups(beforePlayer, moved);
        if (beforePlayer.crownKeyRoom === null && moved.crownKeyRoom !== null) {
          announcePickup({ kind: 'key', playerName: moved.name, room: moved.crownKeyRoom });
        }
      }
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
    if (remoteDisabled || firing || !waitingToFire || !availableTargets.includes(square)) return;
    setSelectedTargets((targets) => targets.includes(square)
      ? targets.filter((target) => target !== square)
      : currentPlayer.bullets === 1 ? [square] : [...targets, square]);
  };

  const fireAtTargets = async (aimedTargets: ShootableSnakeSquare[] = selectedTargets) => {
    if (online.session) {
      if (online.canAct && aimedTargets.length) await online.action({ type: 'shoot', targets: [...aimedTargets] });
      return;
    }
    const before = latestGame.current;
    const shooter = before.players[before.currentPlayerIndex];
    if (fireInFlight.current || before.pendingFireForPlayerId !== shooter.id || aimedTargets.length === 0) return;
    const targets = [...aimedTargets];
    const nextGame = shootSnakes(before, targets);
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
      setShot({ from: shooter.position, targets });
      await new Promise<void>((resolve) => window.setTimeout(resolve, reducedMotion ? 150 : 950));
      if (!screenMounted.current) return;
      latestGame.current = nextGame;
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
  const fireAt = () => { void fireAtTargets(); };

  const passShot = () => {
    if (online.session) { if (online.canAct) void online.action({ type: 'pass' }); return; }
    if (fireInFlight.current) return;
    const nextGame = passFire(latestGame.current);
    latestGame.current = nextGame;
    setGame(nextGame);
    setSelectedTargets([]);
  };

  const rollDice = async () => {
    if (online.session) { if (online.canAct) await online.action({ type: 'roll' }); return; }
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
        setWalking({ playerId: player.id, position: 100, effect: 'bamboo' });
        await new Promise<void>(resolve => window.setTimeout(resolve, reducedMotion ? 45 : 200));
        if (!screenMounted.current) return;
        if (effect === 'torch') {
          sounds.play('happy');
          announcePickup({ kind: 'torch', playerName: resolvedPlayer.name });
        }
        setWalking({ playerId: player.id, position: 0, effect: 'bamboo' });
        await new Promise<void>(resolve => window.setTimeout(resolve, reducedMotion ? 45 : 2680));
        if (!screenMounted.current) return;
        setWalking({ playerId: player.id, position: 0, effect: 'step' });
        await new Promise<void>(resolve => window.setTimeout(resolve, reducedMotion ? 45 : 300));
        if (!screenMounted.current) return;
      } else if (resolvedPlayer && (effect === 'ladder' || effect === 'snake' || effect === 'boom')) {
        if (effect === 'ladder' || effect === 'snake') sounds.play(effect);
        if (effect === 'boom') sounds.play('bomb');
        setWalking({
          playerId: player.id,
          position: resolvedPlayer.position,
          effect,
          ...(effect === 'boom' ? { sourcePosition: resolution.path.at(-1) ?? player.position } : {}),
        });
        await new Promise<void>(resolve => window.setTimeout(resolve,
          reducedMotion ? 45 : SPECIAL_MOVE_DURATION_MS[effect] + 80,
        ));
        if (!screenMounted.current) return;
      }

      if (resolvedPlayer) {
        sounds.playPickups(player, resolvedPlayer);
        if (player.crownKeyRoom === null && resolvedPlayer.crownKeyRoom !== null) {
          announcePickup({ kind: 'key', playerName: resolvedPlayer.name, room: resolvedPlayer.crownKeyRoom });
        }
      }
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
    const modeLabel = playMode === 'bot' ? 'against Mr.Bot' : 'Pass & Play';
    if (!window.confirm(`Start a new ${modeLabel} game? This replaces only this mode's saved round; the other mode's save stays intact.`)) return;
    const fresh = createLocalGame(playMode);
    setGame(fresh);
    latestGame.current = fresh;
    setSaveBlocked(false);
    setPowerError(null);
    setStorageError(null);
    setDiceFace(null);
    setSelectedTargets([]);
    setShot(null);
    setWalking(null);
    try {
      const keys = playMode === 'bot'
        ? [BOT_STORAGE_KEY]
        : [STORAGE_KEY, QUEST_STORAGE_KEY, PREVIOUS_STORAGE_KEY, LEGACY_STORAGE_KEY, OLDEST_STORAGE_KEY];
      keys.forEach((key) => localStorage.removeItem(key));
    } catch { /* Ignore unavailable storage. */ }
  };

  const performMrBotAction = (action: MrBotAction, botId: string) => {
    switch (action.type) {
      case 'roll':
        void rollDice();
        break;
      case 'choose':
        applyPower((state) => choosePower(state, action.power));
        break;
      case 'defend':
        void applyAnimatedPower((state) => resolveDefense(state, action.use));
        break;
      case 'shoot':
        setSelectedTargets(action.targets);
        void fireAtTargets(action.targets);
        break;
      case 'pass-shot':
        passShot();
        break;
      case 'extra-dice':
        applyPower(useExtraDice);
        break;
      case 'web':
        void applyAnimatedPower(
          (state) => useWebShooter(state, action.targetPlayerId),
          action.targetPlayerId,
        );
        break;
      case 'knife':
        void applyAnimatedPower(
          (state) => useKnife(state, action.targetPlayerId),
          action.targetPlayerId,
        );
        break;
      case 'plant':
        applyPower((state) => plantBomb(state, action.square));
        break;
      case 'detonate':
        void applyAnimatedPower(
          (state) => ({
            state: detonateBomb(state, action.bombId, botId),
            path: [],
            effect: 'boom',
          }),
          action.targetPlayerId,
        );
        break;
    }
  };

  useEffect(() => {
    if (playMode !== 'bot' || online.session || online.loadingSession || online.pendingAdmission || online.busy ||
      rolling || firing || rollInFlight.current || fireInFlight.current) return;
    const botId = game.players[1]?.id;
    if (!botId) return;
    const action = getMrBotAction(latestGame.current, botId);
    if (!action) return;

    const humanBombCanBeUsed = latestGame.current.bombs.some((bomb) =>
      bomb.ownerId === latestGame.current.players[0]?.id && bomb.armed &&
      latestGame.current.players[1]?.position === bomb.square,
    );
    const delay = humanBombCanBeUsed ? 2400 : 520;
    const timer = window.setTimeout(() => {
      if (playMode !== 'bot' || online.session) return;
      const currentAction = getMrBotAction(latestGame.current, botId);
      if (currentAction) performMrBotAction(currentAction, botId);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [game, playMode, online.session, online.loadingSession, online.pendingAdmission, online.busy, rolling, firing]);

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
            {online.session ? (
              <div className="top-chip" data-testid="game-mode"><i /> ONLINE · TWO DEVICES</div>
            ) : (
              <label className="top-chip game-mode-chip" data-testid="game-mode">
                <i />
                <span>LOCAL ·</span>
                <select
                  aria-label={playMode === 'bot' ? 'Local game mode, playing Mr.Bot' : 'Local game mode, Pass and Play'}
                  value={playMode}
                  disabled={online.loadingSession || online.busy || !!online.pendingAdmission || rolling || firing}
                  onChange={(event) => switchLocalMode(event.target.value as LocalPlayMode)}
                >
                  <option value="pass">Pass &amp; Play</option>
                  <option value="bot">vs. Mr.Bot</option>
                </select>
                <ChevronDown size={12} aria-hidden="true" />
              </label>
            )}
          </div>
        </header>
        <OnlinePanel room={online.room} session={online.session} pendingAdmission={!!online.pendingAdmission} resumeCode={online.session?.code ?? (online.pendingAdmission ? online.pendingAdmission.code ?? "Creating room" : undefined)}
          initiallyOpen={mobileProfile?.playMode === 'online'} initialName={mobileProfile?.name}
          busy={online.busy || rolling || firing || online.loadingSession} connected={online.connected}
          error={online.error} onCreate={online.create} onJoin={online.join}
          onLeave={leaveOnline} onRematch={() => { void online.action({ type: 'rematch' }); }}
          onRetry={() => { void online.retry(); }} />

        <div className="game-columns">
          <Board game={game} pickupNotice={pickupNotice} walking={walking} aiming={waitingToFire && !remoteDisabled} selectedTargets={selectedTargets} shot={shot} firing={firing} onAimTarget={selectTarget} choicesEnabled={!remoteDisabled} choiceBusy={rolling || firing}
            onChoosePower={(power) => applyPower((state) => choosePower(state, power), {type: "choose", power})} />
            {!!game.winnerId && <MatchCelebration players={game.players} winnerIds={game.winnerIds ?? [game.winnerId]} loserId={game.loserId ?? game.players.find((p) => p.id !== game.winnerId)!.id} />}
            {!!game.winnerId && <button type="button" className="primary-action" data-testid="celebration-music" disabled={sounds.muted} onClick={() => sounds.setCelebrating(true)}>Play celebration music</button>}
          <section className="side-panel" aria-label="Game controls and player status" data-testid="game-controls">
            <section className="quest-progress-line" data-testid="game-progress" aria-label={`${currentPlayer.name}'s Torch, Key and Crown progress`}>
              <ol className="quest-progress-items">
                <li className={`quest-progress-item ${torchEarned ? 'is-earned' : ''}`} data-testid="progress-torch" data-state={torchEarned ? 'earned' : 'pending'}>
                  <TorchIcon size={17} /><span>Torch</span>
                </li>
                <li className={`quest-progress-item ${keyEarned ? 'is-earned' : ''}`} data-testid="progress-key" data-state={keyEarned ? 'earned' : 'pending'}>
                  <KeyRound size={16} aria-hidden="true" /><span>Key</span>
                </li>
                <li className={`quest-progress-item quest-progress-crown ${playerClaimedCrown ? 'is-earned' : ''}`} data-testid="progress-crown" data-state={playerClaimedCrown ? 'earned' : 'pending'}>
                  <Crown size={16} aria-hidden="true" /><span>Crown</span>
                </li>
              </ol>
            </section>
            <div className="turn-card">
              <div className="eyebrow" data-testid="turn-number">TURN {String(game.turnNumber).padStart(2, '0')}</div>
              {winner ? (
                <>
                  <div className="turn-name" data-testid="winner-name">Match finished!</div>
                  <div className="turn-sub">The crown is yours. What a splendid climb.</div>
                </>
              ) : (
                <>
                  <div className="turn-name" data-testid="current-player">{currentPlayer.name}'s turn</div>
                  <div className="turn-sub">{mrBotIsActing
                    ? mrBotTurn ? 'Mr.Bot is thinking through a move.' : 'Mr.Bot is detonating a bomb.'
                    : game.pendingChoice ? 'Resolve your landing choice before rolling.'
                      : waitingToFire ? 'Aim carefully, or pass this shot.'
                        : 'Use a saved power, or roll the dice.'}</div>
                </>
              )}
              <div className="player-stack">
                {game.players.map((player, index) => (
                  <div className="player-entry" key={player.id}>
                  <div className={`player-line ${!winner && index === game.currentPlayerIndex ? 'active' : ''}`} data-testid={`player-status-${player.id}`}>
                    <span className="player-dot" style={{ background: {blue:'#36b8e6',coral:'#ef7653',green:'#36ba7b',purple:'#ad78ea'}[player.color] }} />
                    <span className="player-label">
                      <span className="player-name-full">{player.name}{game.winnerIds?.includes(player.id) ? ` · Winner ${game.winnerIds.indexOf(player.id)+1}` : game.loserId===player.id ? " · Last" : ""}</span>
                      <span className="player-name-compact" aria-hidden="true">{playMode === 'bot' ? index === 0 ? 'YOU' : 'BOT' : `P${index + 1}`}</span>
                    </span>
                    <span className="player-position" data-testid={`position-${player.id}`}>{player.position ? `#${player.position}` : 'HOME'}</span>
                    <span className="keys-chip" data-testid={`keys-${player.id}`} aria-label={`${player.keys} crown key`}><KeyRound size={12} /> {player.keys}/1</span>
                    <span className="ammo-chip" data-testid={`bullets-${player.id}`} aria-label={`${player.bullets} of ${MAX_BULLETS} bullets`}>
                      <CircleDot size={12} /> {player.bullets}/{MAX_BULLETS}
                    </span>
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

            <div className={`play-control-dock ${waitingToFire ? 'play-control-dock-aiming' : ''}`} data-testid="play-control-dock">
            <PowerControls
              position={currentPlayer.position}
              detonationDisabled={rolling || firing || online.loadingSession || online.busy || !!online.pendingAdmission ||
                !!winner || !!game.pendingChoice || !!waitingToFire || (!!online.session && !online.canDetonate) ||
                (mrBotTurn && !humanBombReady) || mrBotAction?.type === 'detonate'}
              detonationBombs={game.bombs.filter((bomb) => bomb.armed && game.players.some((player) => player.id !== bomb.ownerId && player.position === bomb.square && !game.winnerIds?.includes(player.id)) && (!online.session || bomb.ownerId === online.room?.yourPlayerId) && (playMode !== 'bot' || bomb.ownerId === humanPlayerId)).map((bomb) => ({...bomb, ownerName: game.players.find((player) => player.id === bomb.ownerId)!.name}))}
              playerName={currentPlayer.name}
              powers={currentPlayer.powers} pending={game.pendingChoice}
              extraRollCredits={currentPlayer.extraRollCredits}
              busy={rolling || firing || remoteDisabled} actionsEnabled={!remoteDisabled && !winner && !waitingToFire && !game.pendingChoice}
              bombs={game.bombs.map((bomb) => ({ ...bomb,
                ownerName: game.players.find((player) => player.id === bomb.ownerId)!.name,
                owned: bomb.ownerId === currentPlayer.id,
                ready: bomb.armed && game.players.some((player) => player.id !== bomb.ownerId && player.position === bomb.square),
              }))}
              onDefense={(use) => { void applyAnimatedPower((state) => resolveDefense(state, use), undefined, { type: 'defense', use }); }}
              onPlant={(square) => applyPower((state) => plantBomb(state, square), { type: 'plant', square })}
              onExtraDice={() => applyPower(useExtraDice, { type: 'extraDice' })}
              rivals={game.players.filter((rival) => rival.id !== currentPlayer.id
                && rival.id !== game.winnerId && !game.winnerIds?.includes(rival.id))
                .map((rival) => ({ id: rival.id, name: rival.name, position: rival.position, hasKnife: rival.powers.knife > 0 }))}
              onWebShoot={(targetPlayerId) => { void applyAnimatedPower(
                (state) => useWebShooter(state, targetPlayerId), targetPlayerId,
                { type: 'web', targetPlayerId },
              ); }}
              onKnife={(targetPlayerId) => { void applyAnimatedPower(
                (state) => useKnife(state, targetPlayerId), targetPlayerId,
                { type: 'knife', targetPlayerId },
              ); }}
              onDetonate={(id) => { void applyAnimatedPower(
                (state) => ({ state: detonateBomb(state, id, state.bombs.find((bomb) => bomb.id === id)!.ownerId), path: [], effect: 'boom' }),
                game.players.find((player) => player.id !== game.bombs.find((bomb) => bomb.id === id)!.ownerId && player.position === game.bombs.find((bomb) => bomb.id === id)!.square)!.id,
                { type: 'detonate', bombId: id },
              ); }}
            />
            {!game.pendingChoice && <div className="mobile-gun-status" data-testid="mobile-gun-status" role="img" aria-label={`Gun ammo: ${currentPlayer.bullets} of ${MAX_BULLETS} bullets`}>
              <GunIcon />
              <span>{currentPlayer.bullets}/{MAX_BULLETS}</span>
            </div>}
            {powerError && <div className="sound-error" role="alert">{powerError}</div>}
            {storageError && <div className="sound-error" role="alert" data-testid="storage-warning">{storageError}</div>}

            {winner ? (
              <div className="win-banner" data-testid="winner-banner"><Trophy size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Crown claimed!</div>
            ) : game.pendingChoice ? (
              <div className="mobile-choice-hint" role="status">Choose a power to continue.</div>
            ) : (
              <>
                <div className={`roll-area ${waitingToFire ? 'roll-area-aiming' : ''}`} data-testid="roll-area">
                  {waitingToFire ? (
                    <button
                      className="dice-button fire-dice-button"
                      onClick={() => void fireAt()}
                      disabled={remoteDisabled || rolling || firing || selectedTargets.length === 0}
                      aria-label={firing ? 'Firing at selected snakes' : selectedTargets.length ? `Fire at ${selectedTargets.length} selected snake${selectedTargets.length === 1 ? '' : 's'}` : 'Select a snake head to aim'}
                      title={selectedTargets.length ? 'Fire at selected snake heads' : 'Select a snake head first'}
                      data-testid="button-fire"
                    >
                      <Crosshair className="fire-slot-icon" size={24} />
                      <span className="fire-slot-label">
                        {remoteDisabled ? 'WAIT' : firing ? 'FIRING' : selectedTargets.length === 2 ? 'FIRE BOTH' : selectedTargets.length ? 'FIRE' : 'AIM'}
                      </span>
                    </button>
                  ) : (
                    <button className="dice-button" onClick={rollDice} disabled={remoteDisabled || rolling || !!winner} aria-label={rolling ? 'Dice rolling' : 'Roll dice'} title="Tap to roll" data-testid="button-roll">
                      <span className={`dice-face ${rolling ? 'rolling' : ''}`} data-testid="dice-result"
                        role="img" aria-label={`Dice showing ${diceFace ?? 1}`}><DicePips value={diceFace ?? 1} /></span>
                    </button>
                  )}
                  <div className={`roll-area-copy ${waitingToFire ? 'roll-area-aim-copy' : 'roll-area-turn-copy'}`}>
                    {waitingToFire ? (
                      <>
                        <strong>AIM AT THE HEADS</strong>
                        <span aria-live="polite" data-testid="fire-slot-target-summary">
                          {remoteDisabled
                            ? fireAimPrompt
                            : selectedTargets.length
                              ? `Locked: ${selectedTargets.map((square) => `Snake ${square}`).join(' + ')}`
                              : 'Tap one or both snake heads.'}
                        </span>
                      </>
                    ) : (
                      <span className="mobile-turn-indicator" aria-live="polite" data-testid="mobile-turn-indicator">{mobileTurnLabel}</span>
                    )}
                  </div>
                </div>
                {waitingToFire && (
                  <div className="fire-choice-card" data-testid="fire-choice">
                    <div className="fire-choice-title">
                      <span className="fire-gun-icon"><GunIcon /></span>
                      <span>Gun room · {currentPlayer.position}</span>
                      <span className="fire-ammo-count" data-testid="fire-ammo-count"><CircleDot size={12} /> {currentPlayer.bullets}/{MAX_BULLETS}</span>
                    </div>
                    <div className="fire-choice-copy" data-testid="fire-target-instruction" aria-live="polite">
                      {fireAimPrompt}
                    </div>
                    {currentPlayer.bullets === 1 && <div className="fire-choice-copy">Only one bullet: aim at 98 or 99, not both.</div>}
                    <div className="fire-choice-actions">
                      <button className="secondary-action" onClick={passShot} disabled={remoteDisabled || rolling || firing} data-testid="button-pass-fire">
                        Pass this shot
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
            </div>

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
                <div className="rule-line"><TorchIcon size={13} /> First arrival at 100 gives a torch and returns you Home, not a crown.</div>
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
            {!online.session && <button className="primary-action" onClick={startNewGame} disabled={rolling || firing || online.loadingSession || online.busy} data-testid="button-new-game">
              <RotateCcw size={15} /> New game
            </button>}
            <div className="panel-footer"><span>TURN {String(game.turnNumber).padStart(2, '0')}</span><span>YOUR TABLE, YOUR QUEST</span></div>
          </section>
        </div>
      </div>
    </main>
  );
}

function MobileV2Route() {
  return (
    <MobileV2Page>
      <GameScreen />
    </MobileV2Page>
  );
}

function App() {
  return (
    <Switch>
      <Route path="/" component={GameScreen} />
      <Route path="/mobile-v2" component={MobileV2Route} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default App;