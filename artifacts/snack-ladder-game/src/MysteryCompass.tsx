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
  { power: 'bomb', cls: 'pc-ico-bomb', dir: 'Bomb', label: 'Bomb', blurb: 'Plant in your current room', Icon: Bomb },
  { power: 'antiVenom', cls: 'pc-ico-antiVenom', dir: 'A/V', label: 'Anti-Venom', blurb: 'Blocks one snake bite', Icon: ShieldPlus },
  { power: 'defuser', cls: 'pc-ico-defuser', dir: 'Kit', label: 'Kit', blurb: 'Disarms one bomb', Icon: Wrench },
  { power: 'webShooter', cls: 'pc-ico-webShooter', dir: 'Web', label: 'Web', blurb: 'Pull a nearby rival back three rooms', Icon: Crosshair },
  { power: 'knife', cls: 'pc-ico-knife', dir: 'Knife', label: 'Knife', blurb: 'Strike a rival sharing your room', Icon: Sword },
];

export default function MysteryCompass({ square, canChoose, busy, onChoose }: MysteryCompassProps) {
  const [sel, setSel] = useState<Power | null>(null);
  const active = DIRS.find((d) => d.power === sel);
  const readOnly = !canChoose;

  return (
    <div className="mc-card" data-testid="mystery-compass" role="group" aria-label={`Mystery room ${square} power choice`}>
      <div className="mc-heading">MYSTERY {square} · CHOOSE ONE</div>
      <div className="mc-choices">
        {DIRS.map(({ power, cls, dir, label, blurb, Icon }) => (
          <button key={power} type="button" className={`mc-btn ${cls}`} data-testid={`choose-power-${power}`}
            aria-pressed={sel === power} disabled={readOnly || busy} aria-label={`Choose ${label}`} title={blurb}
            onClick={() => setSel(power)}>
            <span className="mc-power-orb" data-testid={`mystery-power-icon-${power}`} aria-hidden="true">
              <Icon size={17} />
            </span>
            <span className="mc-label">{dir}</span>
          </button>
        ))}
      </div>
      <div className="mc-footer">
        <div className="mc-info" aria-live="polite">
          {readOnly ? 'Waiting for player' : active ? <><b>{active.label}</b> · {active.blurb}</> : 'Pick a power'}
        </div>
        <button type="button" className="mc-get" data-testid="get-mystery-power" aria-label={active ? `Get ${active.label}` : 'Choose a power first'}
          disabled={readOnly || busy || !sel}
          onClick={() => sel && onChoose(sel)}>
          GET
        </button>
      </div>
    </div>
  );
}
