import { useState } from 'react';
import { Bomb, Crosshair, ShieldPlus, Sword, Wrench } from 'lucide-react';
import type { MysteryPowerType } from './game-engine';
import './MysteryCompass.css';

type Power = MysteryPowerType;
export interface MysteryCompassProps {
  square: number;
  canChoose: boolean;
  busy: boolean;
  onChoose: (power: Power) => void;
}

const DIRS: { power: Power; cls: string; dir: string; label: string; blurb: string; Icon: typeof Bomb }[] = [
  { power: 'bomb', cls: 'mc-n', dir: 'N', label: 'Bomb', blurb: 'Plant in your current room', Icon: Bomb },
  { power: 'antiVenom', cls: 'mc-e', dir: 'E', label: 'Anti-Venom', blurb: 'Blocks one snake bite', Icon: ShieldPlus },
  { power: 'defuser', cls: 'mc-s', dir: 'S', label: 'Defuser Kit', blurb: 'Disarms one bomb', Icon: Wrench },
  { power: 'webShooter', cls: 'mc-w', dir: 'W', label: 'Web Shooter', blurb: 'Pull a nearby rival back three rooms', Icon: Crosshair },
  { power: 'knife', cls: 'mc-center-choice', dir: 'C', label: 'Knife', blurb: 'Strike a rival sharing your room', Icon: Sword },
];

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Absolute overlay: render inside the board's positioned square container (.board-grid / .board-inner). */
export default function MysteryCompass({ square, canChoose, busy, onChoose }: MysteryCompassProps) {
  const [sel, setSel] = useState<Power | null>(null);
  const rb = Math.floor((square - 1) / 10);
  const i = (square - 1) % 10;
  const col = rb % 2 === 0 ? i : 9 - i;
  const cx = col * 10 + 5;
  const cy = (9 - rb) * 10 + 5;
  const W = 72, H = 66;
  const left = clamp(cx - W / 2, 2, 98 - W);
  const top = clamp(cy - H / 2, 2, 98 - H);
  const active = DIRS.find((d) => d.power === sel);
  const readOnly = !canChoose;

  return (
    <>
      <div className="mc-halo" style={{ left: `${cx}%`, top: `${cy}%` }} aria-hidden="true" />
      <div className="mc-card" data-testid="mystery-compass" role="group" aria-label={`Mystery room ${square} power choice`}
        style={{ left: `${left}%`, top: `clamp(4%, ${top}%, calc(100% - max(${H}%, 260px) - 4%))`, width: `${W}%`, height: `max(${H}%, 260px)` }}>
        <div className="mc-wrap">
          <div className="mc-rose">
            <div className="mc-heading">Mystery room {square} · Choose one</div>
            {DIRS.map(({ power, cls, dir, label, Icon }) => (
              <button key={power} type="button" className={`mc-btn ${cls}`} data-testid={`choose-power-${power}`}
                aria-pressed={sel === power} disabled={readOnly || busy} aria-label={`${dir}: ${label}`}
                onClick={() => setSel(power)}>
                <Icon size={18} aria-hidden="true" />
                <span>{label}</span>
              </button>
            ))}
          </div>
          <div className="mc-info" aria-live="polite">
            {readOnly ? 'Spectating: the player is choosing a power.' : active ? <><b>{active.label}</b> — {active.blurb}</> : 'Select a power to see what it does.'}
          </div>
          <button type="button" className="mc-get" data-testid="get-mystery-power" disabled={readOnly || busy || !sel}
            onClick={() => sel && onChoose(sel)}>
            {sel ? `Get ${active?.label}` : 'Get'}
          </button>
        </div>
      </div>
    </>
  );
}
