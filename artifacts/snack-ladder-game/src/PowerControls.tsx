import { useState } from 'react';
import { Bomb, Dices, List } from 'lucide-react';
import type { PowerType } from './game-engine';
import { PowerGlyph } from './PowerGlyph';
import './PowerControls.css';

export type PowerKind = PowerType;
type RivalTarget = { id: string; name: string; position: number; hasKnife: boolean };
export interface PowerControlsProps {
  position: number;
  detonationBombs: { id: string; square: number; ownerName: string }[];
  detonationDisabled: boolean;
  playerName: string;
  powers: Record<PowerKind, number>;
  pending: { kind: 'mystery' | 'snake' | 'bomb'; square: number } | null;
  bombs: { id: string; square: number; ownerName: string; owned: boolean; ready: boolean }[];
  busy: boolean;
  actionsEnabled: boolean;
  extraRollCredits: number;
  onDefense: (use: boolean) => void;
  onPlant: (square: number) => void;
  onDetonate: (id: string) => void;
  onExtraDice: () => void;
  rivals: RivalTarget[];
  onWebShoot: (targetPlayerId: string) => void;
  onKnife: (targetPlayerId: string) => void;
}

const LABELS: Record<PowerKind, string> = {
  bomb: 'Bomb', antiVenom: 'Anti-Venom', defuser: 'Defuser Kit',
  webShooter: 'Web Shooter', knife: 'Knife', extraDice: 'Extra Dice',
};
const BLURB: Record<PowerKind, string> = {
  bomb: 'Plant in your current room',
  antiVenom: 'Blocks one snake bite',
  defuser: 'Disarms one bomb',
  webShooter: 'Pull a rival 1–3 rooms ahead back three rooms',
  knife: 'Strike a rival sharing your numbered room',
  extraDice: 'Bank one extra roll',
};
const ORDER: PowerKind[] = ['bomb', 'antiVenom', 'defuser', 'webShooter', 'knife'];
function PowerSymbol({ power, size }: { power: PowerKind; size: number }) {
  if (power === 'extraDice') return <Dices size={size} />;
  return <PowerGlyph power={power} size={size + 8} />;
}

export function PowerControls({ position, detonationBombs, detonationDisabled, playerName, powers, pending, bombs, busy, actionsEnabled, extraRollCredits, onDefense, onPlant, onDetonate, onExtraDice, rivals, onWebShoot, onKnife }: PowerControlsProps) {
  const [plantOpen, setPlantOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [info, setInfo] = useState<PowerKind | null>(null);
  const [targetPower, setTargetPower] = useState<'webShooter' | 'knife' | null>(null);
  const inventoryOk = !busy && actionsEnabled && !pending;
  const canPlant = inventoryOk && powers.bomb > 0 && position >= 1 && position <= 100 && !bombs.some((bomb) => bomb.square === position);
  const visibleOrder: PowerKind[] = powers.extraDice > 0 ? [...ORDER, 'extraDice'] : ORDER;
  const availableTargets = targetPower === 'webShooter'
    ? rivals.filter((rival) => rival.position > position && rival.position - position <= 3)
    : targetPower === 'knife'
      ? rivals.filter((rival) => position > 0 && rival.position === position)
      : [];

  const plant = () => {
    if (!canPlant) return;
    onPlant(position);
    setPlantOpen(false);
  };
  const defenseKind = pending?.kind === 'snake' ? 'antiVenom' : 'defuser';
  const hasDefense = pending && pending.kind !== 'mystery' ? powers[defenseKind] > 0 : false;
  const readyBombs = detonationBombs;
  const otherBombs = bombs.filter((b) => !(b.owned && b.ready));

  return (
    <section className={`pc ${pending && pending.kind !== 'mystery' ? 'pc-awaiting-defense' : ''}`} data-testid="power-controls" aria-label={`${playerName}'s powers`}>
      <div className="pc-copy" style={{ fontSize: 10 }}>{playerName} · Powers</div>
      {pending && pending.kind !== 'mystery' && (
        <div role="group" aria-label={pending.kind === 'snake' ? 'Snake bite defense' : 'Bomb defense'}>
          <div className="pc-title">
            <PowerGlyph power={pending.kind === 'snake' ? 'antiVenom' : 'defuser'} size={28} />
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
        {visibleOrder.map((p) => {
          const label = `${LABELS[p]}: ${powers[p]}`;
          const badge = <span className={`pc-badge ${powers[p] ? '' : 'zero'}`} data-testid={`power-count-${p}`} aria-label={`${LABELS[p]} count`}>{powers[p]}</span>;
          if (p === 'bomb') return (
            <button key={p} type="button" className="pc-ico pc-ico-bomb" data-testid="power-toggle-bomb" title={`${label}. Plant a bomb`}
              aria-label={`${label}. Plant a bomb`} aria-expanded={plantOpen}
              disabled={busy || (!plantOpen && !canPlant)} onClick={() => { setTargetPower(null); setPlantOpen((o) => !o); }}>
              <PowerSymbol power={p} size={20} />{badge}
            </button>
          );
          if (p === 'extraDice') return (
            <button key={p} type="button" className={`pc-ico pc-ico-extraDice ${extraRollCredits > 0 ? 'on' : ''}`} data-testid="use-extra-dice"
              title={`${label}. Use Extra Dice: bank one extra roll`} aria-label={`Use Extra Dice, ${powers[p]} left`}
              disabled={!inventoryOk || powers[p] < 1} onClick={onExtraDice}>
              <PowerSymbol power={p} size={20} />{badge}
            </button>
          );
          if (p === 'webShooter' || p === 'knife') return (
            <button key={p} type="button" className={`pc-ico pc-ico-${p}`} data-testid={`power-toggle-${p}`}
              title={`${label}: ${BLURB[p]}`} aria-label={`${label}: ${powers[p]} available`}
              aria-expanded={targetPower === p} disabled={!inventoryOk || powers[p] < 1}
              onClick={() => { setInfo(null); setTargetPower((active) => active === p ? null : p); }}>
              <PowerSymbol power={p} size={20} />{badge}
            </button>
          );
          return (
            <button key={p} type="button" className={`pc-ico pc-ico-${p}`} title={`${label}. ${BLURB[p]}; used from a hazard prompt`}
              aria-label={`${label}. Used from a hazard prompt`} aria-pressed={info === p}
              onClick={() => { setTargetPower(null); setInfo((c) => (c === p ? null : p)); }}>
              <PowerSymbol power={p} size={20} />{badge}
            </button>
          );
        })}
        {extraRollCredits > 0 && (
          <span className="pc-credit" data-testid="extra-roll-credits" aria-live="polite" aria-label={`Armed extra rolls: ${extraRollCredits}`}>+{extraRollCredits} roll</span>
        )}
        {readyBombs.map((b) => (
          <button key={b.id} type="button" className="pc-chip" disabled={detonationDisabled} onClick={() => onDetonate(b.id)}
            data-testid={`detonate-bomb-${b.id}`} aria-label={`${b.ownerName}: Use bomb in room ${b.square}`} title={`Detonate bomb on house ${b.square}`}>
            <Bomb size={15} /> {b.ownerName}: Use bomb · {b.square}
          </button>
        ))}
        {otherBombs.length > 0 && (
            <button type="button" className="pc-ico pc-ico-list" aria-expanded={listOpen} aria-label={`Planted bombs: ${otherBombs.length}`}
            title="Planted bombs" onClick={() => setListOpen((o) => !o)}>
            <List size={18} />
          </button>
        )}
      </div>

      {targetPower && (
        <div className="pc-weapon-list" role="group" aria-label={`Choose a rival for ${LABELS[targetPower]}`} data-testid={`${targetPower}-targets`}>
          <p className="pc-copy">{targetPower === 'webShooter' ? BLURB.webShooter : BLURB.knife}</p>
          {availableTargets.length === 0 ? (
            <p className="pc-copy" role="status">
              {targetPower === 'webShooter' ? 'No rival is one to three rooms ahead.' : 'No rival is in your numbered room.'}
            </p>
          ) : availableTargets.map((rival) => (
            <button key={rival.id} type="button" className="pc-target" disabled={!inventoryOk}
              data-testid={`use-${targetPower}-${rival.id}`}
              aria-label={targetPower === 'webShooter'
                ? `Use Web Shooter on ${rival.name}, room ${rival.position}; pull them back three rooms`
                : `Use Knife on ${rival.name}${rival.hasKnife ? '; their Knife blocks the hit and neither charge is spent' : '; send them Home'}`}
              onClick={() => {
                setTargetPower(null);
                if (targetPower === 'webShooter') onWebShoot(rival.id);
                else onKnife(rival.id);
              }}>
              <span className="pc-target-name">{rival.name} · #{rival.position}</span>
              <span className={rival.hasKnife && targetPower === 'knife' ? 'pc-target-blocked' : 'pc-target-effect'}>
                {targetPower === 'webShooter' ? 'Pull back 3' : rival.hasKnife ? 'Knife blocks · no charge spent' : 'Send Home'}
              </span>
            </button>
          ))}
        </div>
      )}

      {info && <p className="pc-copy" role="status">{LABELS[info]}: {BLURB[info]}. Used only from a hazard prompt when you land on one.</p>}

      {plantOpen && (<div className="pc-row">
        <span className="pc-copy">Current room: {position || "Home"}</span>
        <button type="button" className="pc-btn gold" disabled={!canPlant} onClick={plant}
          data-testid="plant-bomb" aria-label={`Plant bomb in room ${position}`}>Plant here · {position}</button>
      </div>)}

      {listOpen && otherBombs.length > 0 && (
        <ul className="pc-list">
          {otherBombs.map((b) => (
            <li key={b.id} data-testid={`bomb-row-${b.id}`}>
              House {b.square} · {b.owned ? b.ready ? 'yours, ready to detonate' : 'yours, waiting for rival' : b.ownerName}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default PowerControls;
