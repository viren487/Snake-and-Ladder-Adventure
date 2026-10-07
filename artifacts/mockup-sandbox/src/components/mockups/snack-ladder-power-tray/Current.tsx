import { useState } from 'react';
import { Bomb, Crosshair, ShieldPlus, Sword, Wrench } from 'lucide-react';
import './_group.css';
import './tray-preview.css';

const powers = [
  { key: 'bomb', name: 'Bomb', detail: 'Plant in your current room', Icon: Bomb },
  { key: 'antiVenom', name: 'A/V', detail: 'Blocks one snake bite', Icon: ShieldPlus },
  { key: 'defuser', name: 'Kit', detail: 'Disarms one bomb', Icon: Wrench },
  { key: 'webShooter', name: 'Web', detail: 'Pull a nearby rival back three rooms', Icon: Crosshair },
  { key: 'knife', name: 'Knife', detail: 'Strike a rival sharing your room', Icon: Sword },
];

export function Current() {
  const [selected, setSelected] = useState<string | null>(null);
  const active = powers.find((power) => power.key === selected);
  const squares = Array.from({ length: 100 }, (_, index) => {
    const row = Math.floor(index / 10);
    const column = index % 10;
    return row % 2 === 0 ? row * 10 + column + 1 : (row + 1) * 10 - column;
  });
  return (
    <main className="tray-preview">
      <div className="preview-board" aria-label="Snake and ladder board preview">
        <div className="preview-cells">
          {squares.map((square) => <div className="preview-cell" key={square}>{square}</div>)}
        </div>
        <section className="mc-card" aria-label="Current mystery power chooser">
          <div className="mc-heading">MYSTERY 14 · CHOOSE ONE</div>
          <div className="mc-choices">
            {powers.map(({ key, name, Icon }) => (
              <button
                type="button"
                key={key}
                className={`mc-btn pc-ico-${key}`}
                aria-pressed={selected === key}
                onClick={() => setSelected(key)}
              >
                <span className={`mc-power-orb pc-ico-${key}`} aria-hidden="true"><Icon size={17} /></span>
                <span className="mc-label">{name}</span>
              </button>
            ))}
          </div>
          <div className="mc-footer">
            <div className="mc-info" aria-live="polite">
              {active ? <><b>{active.name}</b> · {active.detail}</> : 'Pick a power'}
            </div>
            <button type="button" className="mc-get" disabled={!active}>GET</button>
          </div>
        </section>
      </div>
    </main>
  );
}
