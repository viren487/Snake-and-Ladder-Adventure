import { useState } from 'react';
import { Bomb, Crosshair } from 'lucide-react';
import './_group.css';
import './tray-preview.css';

const powers = [
  { key: 'bomb', name: 'Bomb', detail: 'Plant in your current room', Icon: Bomb },
  { key: 'antiVenom', name: 'Anti-Venom', detail: 'Blocks one snake bite' },
  { key: 'defuser', name: 'Defuser Kit', detail: 'Disarms one bomb' },
  { key: 'webShooter', name: 'Web Shooter', detail: 'Pull a rival back three rooms', Icon: Crosshair },
  { key: 'knife', name: 'Knife', detail: 'Strikes a rival in your room' },
];

function PowerArt({ power, Icon }: { power: string; Icon?: typeof Bomb }) {
  if (Icon) return <Icon size={19} />;
  if (power === 'antiVenom') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 16 8-8 3 3-8 8H7z" fill="#fff4f2" stroke="#a9132d" strokeWidth="1.7" strokeLinejoin="round" /><path d="m10 15 4-4 2 2-4 4z" fill="#ef4057" stroke="#b81935" /><path d="m14 8 4 4m-2-6 4 4m-12 8-3 3m-2-2 5-5" stroke="#86162b" strokeWidth="1.8" strokeLinecap="round" /><path d="m5 19 1 1-2 2-1-1z" fill="#ef4057" stroke="#86162b" /></svg>;
  }
  if (power === 'defuser') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="15" r="6" fill="#292d35" stroke="#11151d" strokeWidth="1.5" /><path d="m10 9 2-3 3 1 1 2-1 3-2 2-2-2z" fill="#dce9ff" stroke="#37578c" strokeWidth="1.6" strokeLinejoin="round" /><path d="m14 12 6 6q1 1 0 2t-2 0l-6-6" fill="#a9c8ff" stroke="#37578c" strokeWidth="1.7" strokeLinejoin="round" /></svg>;
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 16 10-12q2-2 3 0t-1 3L8 18z" fill="#f4f8ff" stroke="#41315a" strokeWidth="1.5" strokeLinejoin="round" /><path d="m6 14 4 4-4 4q-1 1-2 0l-2-2q-1-1 0-2z" fill="#512b42" stroke="#261d2b" strokeWidth="1.5" strokeLinejoin="round" /><path d="m8 13 4 4" stroke="#d8b37b" strokeWidth="2" strokeLinecap="round" /></svg>;
}

export function ClearLabels() {
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
        <section className="clear-tray" aria-label="Mystery power chooser, expanded for readability">
          <div className="clear-title">MYSTERY 14 · CHOOSE ONE</div>
          <div className="clear-options">
            {powers.map(({ key, name, Icon }) => (
              <button
                type="button"
                key={key}
                className={`clear-option power-${key}`}
                aria-label={`Choose ${name}`}
                aria-pressed={selected === key}
                onClick={() => setSelected(key)}
              >
                <PowerArt power={key} Icon={Icon} />
                <span>{name}</span>
              </button>
            ))}
          </div>
          <div className="clear-footer">
            <div className="clear-description" aria-live="polite">
              {active ? <><strong>{active.name}</strong> · {active.detail}</> : 'Tap a power, then Get'}
            </div>
            <button type="button" className="clear-get" disabled={!active}>GET</button>
          </div>
        </section>
      </div>
    </main>
  );
}
