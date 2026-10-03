import './BambooReturnArt.css';

const TOP = 50;
const BOTTOM = 948;
const X = 24;
const nodes = Array.from({ length: 10 }, (_, i) => TOP + 40 + i * ((BOTTOM - TOP - 80) / 9));
const halfW = (y: number) => 9 + ((y - TOP) / (BOTTOM - TOP)) * 7;
const leaf = (x: number, y: number, a: number, s: number, k: string) => (
  <path key={k} transform={`translate(${x} ${y}) rotate(${a}) scale(${s})`} d="M0 0C10 -6 30 -6 46 0C30 6 10 6 0 0Z" fill="url(#bm-leaf)" stroke="#2f5a22" strokeWidth=".8" />
);

export default function BambooReturnArt({ active }: { active: boolean }) {
  const path = `M${X - 9} ${TOP} L${X + 9} ${TOP} L${X + 16} ${BOTTOM} L${X - 16} ${BOTTOM}Z`;
  return (
    <svg className={`bamboo-return-art ${active ? 'is-active' : ''}`} viewBox="0 0 100 1000" preserveAspectRatio="none"
      role="img" aria-label="Bamboo path from 100 to Home" data-testid="bamboo-return-path" aria-hidden={false}>
      <defs>
        <linearGradient id="bm-stalk" x1="0" x2="1">
          <stop offset="0" stopColor="#4d6b1f" /><stop offset=".3" stopColor="#a7bf4a" />
          <stop offset=".55" stopColor="#7d9a2e" /><stop offset="1" stopColor="#3a5217" />
        </linearGradient>
        <linearGradient id="bm-node" x1="0" x2="1">
          <stop offset="0" stopColor="#5c4a1c" /><stop offset=".4" stopColor="#c2a64f" /><stop offset="1" stopColor="#4a3a14" />
        </linearGradient>
        <linearGradient id="bm-leaf" x1="0" x2="1">
          <stop offset="0" stopColor="#4f8a2f" /><stop offset="1" stopColor="#9bc34a" />
        </linearGradient>
      </defs>
      <g transform="translate(40 0)">
      <path className="bamboo-glow" d={path} fill="none" stroke="#f6d86a" strokeWidth="9" strokeLinejoin="round" opacity="0" />
      <path d={path} fill="url(#bm-stalk)" stroke="#33481a" strokeWidth="1.5" />
      <path d={`M${X - 3} ${TOP + 6} L${X - 4} ${BOTTOM - 6}`} stroke="#e4efa6" strokeWidth="2" opacity=".45" strokeLinecap="round" />
      {nodes.map((y, i) => {
        const w = halfW(y) + 3;
        return (
          <g key={i}>
            <rect x={X - w} y={y - 4} width={w * 2} height={8} rx={4} fill="url(#bm-node)" stroke="#3b2d0e" strokeWidth=".8" />
            <path d={`M${X - w + 2} ${y - 1.5}H${X + w - 2}`} stroke="#f2e2a0" strokeWidth="1" opacity=".5" />
            {i % 3 === 1 && <path d={`M${X + w - 2} ${y} q10 -10 22 -8`} stroke="#4a7a2a" strokeWidth="2.5" fill="none" strokeLinecap="round" />}
          </g>
        );
      })}
      <g className="bamboo-leaves">
        {[[-30, .9], [-10, 1], [15, .9], [38, .8], [200, .8], [165, .9]].map(([a, s], i) => leaf(X + 6, TOP + 64 + (i % 2) * 6, a, s, `t${i}`))}
        {[[-20, .8], [20, .8], [160, .7]].map(([a, s], i) => leaf(X + 12, nodes[4] + 2, a, s, `m${i}`))}
        {[[-15, .8], [25, .8], [170, .7]].map(([a, s], i) => leaf(X + 14, nodes[7] + 2, a, s, `l${i}`))}
      </g>
      </g>
    </svg>
  );
}
