import { useState } from 'react';
import type { MysteryPowerType } from './game-engine';
import { PowerGlyph } from './PowerGlyph';
import './MysteryCompass.css';

type Power = MysteryPowerType;
export interface MysteryCompassProps {
  square: number;
  canChoose: boolean;
  busy: boolean;
  onChoose: (power: Power) => void;
}

const DIRS: { power: Power; cls: string; label: string; blurb: string }[] = [
  { power: 'bomb', cls: 'pc-ico-bomb', label: 'Bomb', blurb: 'Plant in your current room' },
  { power: 'antiVenom', cls: 'pc-ico-antiVenom', label: 'Anti-Venom', blurb: 'Blocks one snake bite' },
  { power: 'defuser', cls: 'pc-ico-defuser', label: 'Defuser Kit', blurb: 'Disarms one bomb' },
  { power: 'webShooter', cls: 'pc-ico-webShooter', label: 'Web Shooter', blurb: 'Pull a nearby rival back three rooms' },
  { power: 'knife', cls: 'pc-ico-knife', label: 'Knife', blurb: 'Strike a rival sharing your room' },
];

export default function MysteryCompass({ square, canChoose, busy, onChoose }: MysteryCompassProps) {
  const [sel, setSel] = useState<Power | null>(null);
  const readOnly = !canChoose;

  return (
    <div className="mc-card" data-testid="mystery-compass" role="group" aria-label={`Mystery room ${square} power choice`}>
      <div className="mc-heading">MYSTERY {square} · {readOnly ? 'WAITING' : 'CHOOSE ONE'}</div>
      <div className="mc-choices">
        {DIRS.map(({ power, cls, label, blurb }) => (
          <div key={power} className={`mc-choice-slot ${sel === power ? 'selected' : ''}`}>
            <button type="button" className={`mc-btn ${cls}`} data-testid={`choose-power-${power}`}
              aria-pressed={sel === power} disabled={readOnly || busy} aria-label={`Choose ${label}`} title={blurb}
              onClick={() => setSel(power)}>
              <span className="mc-power-orb" data-testid={`mystery-power-icon-${power}`} aria-hidden="true">
                <PowerGlyph power={power} size={24} />
              </span>
              <span className="mc-label">{label}</span>
            </button>
            {sel === power && (
              <button type="button" className="mc-get" data-testid="get-mystery-power"
                aria-label={`Get ${label}. ${blurb}`} disabled={readOnly || busy}
                onClick={() => onChoose(power)}>
                GET
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
