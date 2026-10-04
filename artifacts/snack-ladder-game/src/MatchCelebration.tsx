import './MatchCelebration.css';

export type CelebrationPlayer = { id: string; name: string; color: string };
type Props = { players: CelebrationPlayer[]; winnerIds: string[]; loserId: string | null };

const ORD = ['1st', '2nd', '3rd', '4th'];
const SCARF: Record<string, [string, string]> = { blue: ['#25a9df', '#0879ad'], coral: ['#f06e50', '#c44839'], green:['#36ba7b','#168353'], purple:['#ad78ea','#714cba'] };

function Panda({ color, sad }: { color: string; sad: boolean }) {
  const [scarf, shade] = SCARF[color] ?? [color, color];
  return (
    <svg className="celebration-svg" viewBox="0 0 52 62" aria-hidden="true">
      <ellipse cx="26" cy="57" rx="14" ry="3" fill="#10151b" opacity=".4" />
      <ellipse cx="26" cy="47" rx="15" ry="11" fill={scarf} stroke="#473523" strokeWidth="1.5" />
      <path d="M13 44q13 8 26 0v6q-13 9-26 0Z" fill={shade} />
      <circle cx="12" cy="17" r="8" fill="#24252a" />
      <circle cx="40" cy="17" r="8" fill="#24252a" />
      <circle cx="12" cy="17" r="3.2" fill="#efb7ad" />
      <circle cx="40" cy="17" r="3.2" fill="#efb7ad" />
      <path d="M8 28c0-12 7-20 18-20s18 8 18 20c0 11-7 18-18 18S8 39 8 28Z" fill="#fff7e8" stroke="#55412f" strokeWidth="1.5" />
      <ellipse cx="17" cy="26" rx="5.6" ry="7.3" fill="#28282b" transform="rotate(18 17 26)" />
      <ellipse cx="35" cy="26" rx="5.6" ry="7.3" fill="#28282b" transform="rotate(-18 35 26)" />
      <circle cx="18.4" cy="25.8" r={sad ? 2.8 : 2.3} fill="#fffdf5" />
      <circle cx="33.6" cy="25.8" r={sad ? 2.8 : 2.3} fill="#fffdf5" />
      <circle cx="18.8" cy={sad ? 27 : 26} r="1.3" fill="#18191c" />
      <circle cx="33.2" cy={sad ? 27 : 26} r="1.3" fill="#18191c" />
      <ellipse cx="26" cy="34" rx="8.2" ry="5.7" fill="#fffdf5" stroke="#dfd5c5" strokeWidth=".7" />
      <path d="M23 32q3-2 6 0-1.5 3.2-3 3.2T23 32Z" fill="#352724" />
      {sad ? (
        <path d="M22 40q4-3 8 0" fill="none" stroke="#43312a" strokeWidth="1.3" strokeLinecap="round" />
      ) : (
        <path d="M22 37q4 5 8 0Z" fill="#a8453b" stroke="#43312a" strokeWidth="1" strokeLinejoin="round" />
      )}
      <circle cx="12" cy="35" r="2" fill="#ee9989" opacity=".65" />
      <circle cx="40" cy="35" r="2" fill="#ee9989" opacity=".65" />
      {sad && (
        <>
          <path d="M13 19l9 3M39 19l-9 3" stroke="#3b3028" strokeWidth="1.4" strokeLinecap="round" />
          <path className="celebration-tear" d="M18 30q-3 5 0 6 3-1 0-6Z" fill="#7fd3f5" stroke="#2d87b3" strokeWidth=".6" />
          <path className="celebration-tear celebration-tear-b" d="M34 30q-3 5 0 6 3-1 0-6Z" fill="#7fd3f5" stroke="#2d87b3" strokeWidth=".6" />
        </>
      )}
      {!sad && (
        <g fill="#fff7e8" stroke="#55412f" strokeWidth="1.2">
          <ellipse className="celebration-arm" cx="6" cy="42" rx="4" ry="7" transform="rotate(25 6 42)" />
          <ellipse className="celebration-arm celebration-arm-b" cx="46" cy="42" rx="4" ry="7" transform="rotate(-25 46 42)" />
        </g>
      )}
    </svg>
  );
}

export function MatchCelebration({ players, winnerIds, loserId }: Props) {
  const winners = winnerIds.map((id) => players.find((p) => p.id === id)).filter((p): p is CelebrationPlayer => !!p);
  const loser = players.find((p) => p.id === loserId);
  const cast = loser ? [...winners.map((p, i) => ({ p, sad: false, label: `${ORD[i]} · Winner` })), { p: loser, sad: true, label: `${ORD[winners.length] ?? 'Last'} · Last place` }]
    : winners.map((p, i) => ({ p, sad: false, label: `${ORD[i]} · Winner` }));
  const summary = `${winners.map((w) => w.name).join(' and ')} won. ${loser ? `${loser.name} finished last and is crying.` : ''}`;
  return (
    <section className="celebration-root" role="status" aria-label="Match finished" data-testid="match-celebration">
      <h2 className="celebration-title">Match over!</h2>
      <p className="celebration-sr">{summary}</p>
      <ol className="celebration-row">
        {cast.map(({ p, sad, label }, i) => (
          <li key={p.id} className={`celebration-card ${sad ? 'celebration-loser' : 'celebration-winner'}`} style={{ ['--i' as string]: i }} data-testid={`celebration-${p.id}`}>
            <div className="celebration-panda"><Panda color={p.color} sad={sad} /></div>
            <strong className="celebration-name">{p.name}</strong>
            <span className="celebration-label">{label}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export default MatchCelebration;
