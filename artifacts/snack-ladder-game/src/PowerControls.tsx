import { useState } from 'react';
import { Bomb, Dices, ShieldPlus, Wrench, Gift, List } from 'lucide-react';
import './PowerControls.css';

export type PowerKind = 'bomb' | 'antiVenom' | 'defuser' | 'extraDice';
export interface PowerControlsProps {
  playerName: string;
  powers: Record<PowerKind, number>;
  pending: { kind: 'mystery' | 'snake' | 'bomb'; square: number } | null;
  bombs: { id: string; square: number; ownerName: string; owned: boolean; ready: boolean }[];
  busy: boolean;
  actionsEnabled: boolean;
  extraRollCredits: number;
  onChoose: (power: PowerKind) => void;
  onDefense: (use: boolean) => void;
  onPlant: (square: number) => void;
  onDetonate: (id: string) => void;
  onExtraDice: () => void;
}

const LABELS: Record<PowerKind, string> = { bomb: 'Bomb', antiVenom: 'Anti-Venom', defuser: 'Defuser Kit', extraDice: 'Extra Dice' };
const BLURB: Record<PowerKind, string> = {
  bomb: 'Plant on any house',
  antiVenom: 'Blocks one snake bite',
  defuser: 'Disarms one bomb',
  extraDice: 'Bank one extra roll',
};
const ORDER: PowerKind[] = ['bomb', 'antiVenom', 'defuser', 'extraDice'];
const ICONS = { bomb: Bomb, antiVenom: ShieldPlus, defuser: Wrench, extraDice: Dices };

export function PowerControls({ playerName, powers, pending, bombs, busy, actionsEnabled, extraRollCredits, onChoose, onDefense, onPlant, onDetonate, onExtraDice }: PowerControlsProps) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [plantOpen, setPlantOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [info, setInfo] = useState<PowerKind | null>(null);
  const inventoryOk = !busy && actionsEnabled && !pending;
  const canPlant = inventoryOk && powers.bomb > 0;

  const plant = () => {
    const text = value.trim();
    const square = Number(text);
    if (!/^\d+$/.test(text) || square < 1 || square > 100) return setError('Enter a house from 1 to 100.');
    if (bombs.some((b) => b.square === square)) return setError(`House ${square} already holds a bomb.`);
    setError('');
    onPlant(square);
    setValue('');
    setPlantOpen(false);
  };

  const defenseKind = pending?.kind === 'snake' ? 'antiVenom' : 'defuser';
  const hasDefense = pending && pending.kind !== 'mystery' ? powers[defenseKind] > 0 : false;
  const readyBombs = bombs.filter((b) => b.owned && b.ready);
  const otherBombs = bombs.filter((b) => !(b.owned && b.ready));

  return (
    <section className="pc" data-testid="power-controls" aria-label={`${playerName}'s powers`}>
      <div className="pc-copy" style={{ fontSize: 10 }}>{playerName} · Powers</div>
      {pending?.kind === 'mystery' && (
        <div role="group" aria-label="Choose one mystery power">
          <div className="pc-title"><Gift size={18} /> Mystery box on {pending.square}: pick one</div>
          <div className="pc-grid" style={{ marginTop: 8 }}>
            {ORDER.map((p) => (
              <button key={p} type="button" className="pc-btn" disabled={busy} onClick={() => onChoose(p)}
                data-testid={`choose-power-${p}`} aria-label={`Choose ${LABELS[p]}`}>
                {LABELS[p]}<small>{BLURB[p]}</small>
              </button>
            ))}
          </div>
        </div>
      )}

      {pending && pending.kind !== 'mystery' && (
        <div role="group" aria-label={pending.kind === 'snake' ? 'Snake bite defense' : 'Bomb defense'}>
          <div className="pc-title">
            {pending.kind === 'snake' ? <ShieldPlus size={18} /> : <Wrench size={18} />}
            {pending.kind === 'snake' ? `Snake bite on ${pending.square}` : `Bomb on ${pending.square}`}
          </div>
          <p className="pc-copy">
            {pending.kind === 'snake'
              ? 'Spend one Anti-Venom to avoid this bite, or slide down.'
              : pending.square === 97
                ? 'Permanent boom trap. Defuse it, or decline and return Home.'
                : 'Rival bomb. Defuse it, or decline and stay in danger.'}
          </p>
          <div className="pc-grid" style={{ marginTop: 6 }}>
            <button type="button" className="pc-btn gold" disabled={busy || !hasDefense} onClick={() => onDefense(true)}
              data-testid="use-defense" aria-label={pending.kind === 'snake' ? 'Use Anti-Venom' : 'Use Defuser Kit'}>
              {pending.kind === 'snake' ? 'Use Anti-Venom' : 'Use Defuser'}
            </button>
            <button type="button" className="pc-btn" disabled={busy} onClick={() => onDefense(false)}
              data-testid="decline-defense" aria-label={pending.kind === 'snake' ? 'Decline and slide' : 'Decline defuse'}>
              {pending.kind === 'snake' ? 'Slide down' : pending.square === 97 ? 'Decline, go Home' : 'Decline'}
            </button>
          </div>
        </div>
      )}

      <div className="pc-bar" role="group" aria-label="Power stash">
        {ORDER.map((p) => {
          const Icon = ICONS[p];
          const label = `${LABELS[p]}: ${powers[p]}`;
          const badge = <span className={`pc-badge ${powers[p] ? '' : 'zero'}`} data-testid={`power-count-${p}`} aria-label={`${LABELS[p]} count`}>{powers[p]}</span>;
          if (p === 'bomb') return (
            <button key={p} type="button" className="pc-ico" data-testid="power-toggle-bomb" title={`${label}. Plant a bomb`}
              aria-label={`${label}. Plant a bomb`} aria-expanded={plantOpen}
              disabled={busy || (!plantOpen && !canPlant)} onClick={() => setPlantOpen((o) => !o)}>
              <Icon size={20} />{badge}
            </button>
          );
          if (p === 'extraDice') return (
            <button key={p} type="button" className={`pc-ico ${extraRollCredits > 0 ? 'on' : ''}`} data-testid="use-extra-dice"
              title={`${label}. Use Extra Dice: bank one extra roll`} aria-label={`Use Extra Dice, ${powers[p]} left`}
              disabled={!inventoryOk || powers[p] < 1} onClick={onExtraDice}>
              <Icon size={20} />{badge}
            </button>
          );
          return (
            <button key={p} type="button" className="pc-ico" title={`${label}. ${BLURB[p]}; used from a hazard prompt`}
              aria-label={`${label}. Used from a hazard prompt`} aria-pressed={info === p}
              onClick={() => setInfo((c) => (c === p ? null : p))}>
              <Icon size={20} />{badge}
            </button>
          );
        })}
        {extraRollCredits > 0 && (
          <span className="pc-credit" data-testid="extra-roll-credits" aria-live="polite" aria-label={`Armed extra rolls: ${extraRollCredits}`}>+{extraRollCredits} roll</span>
        )}
        {readyBombs.map((b) => (
          <button key={b.id} type="button" className="pc-chip" disabled={busy || !actionsEnabled} onClick={() => onDetonate(b.id)}
            data-testid={`detonate-bomb-${b.id}`} aria-label={`Detonate bomb on house ${b.square}`} title={`Detonate bomb on house ${b.square}`}>
            <Bomb size={15} /> Boom {b.square}
          </button>
        ))}
        {otherBombs.length > 0 && (
          <button type="button" className="pc-ico" aria-expanded={listOpen} aria-label={`Planted bombs: ${otherBombs.length}`}
            title="Planted bombs" onClick={() => setListOpen((o) => !o)}>
            <List size={18} />
          </button>
        )}
      </div>

      {info && <p className="pc-copy" role="status">{LABELS[info]}: {BLURB[info]}. Used only from a hazard prompt when you land on one.</p>}

      {plantOpen && (
        <div>
          <div className="pc-row">
            <input id="pc-bomb-square" className="pc-input" inputMode="numeric" pattern="[0-9]*" maxLength={3} value={value}
              placeholder="House 1-100" data-testid="bomb-square-input" aria-label="Bomb house number" aria-invalid={!!error}
              disabled={!canPlant}
              onChange={(e) => { setValue(e.target.value.replace(/\D/g, '')); setError(''); }}
              onKeyDown={(e) => { if (e.key === 'Enter' && canPlant) plant(); }} />
            <button type="button" className="pc-btn gold" disabled={!canPlant || !value} onClick={plant}
              data-testid="plant-bomb" aria-label="Plant bomb">Plant</button>
          </div>
          {error && <p className="pc-error" role="alert">{error}</p>}
        </div>
      )}

      {listOpen && otherBombs.length > 0 && (
        <ul className="pc-list">
          {otherBombs.map((b) => (
            <li key={b.id} data-testid={`bomb-row-${b.id}`}>
              House {b.square} · {b.owned ? 'yours, waiting for rival' : b.ownerName}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default PowerControls;
