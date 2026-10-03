type Point = { x: number; y: number };

export function ShotAnimation({
  from,
  targets,
}: {
  from: Point;
  targets: (Point & { square: number })[];
}) {
  return (
    <svg className="shot-animation-layer" viewBox="0 0 1000 1000" aria-hidden="true" data-testid="shot-animation">
      <g transform={`translate(${from.x} ${from.y})`}>
        <path className="shot-muzzle" d="m0-30 8 18 22-8-12 20 18 11-23 2 2 23-15-16-16 16 3-23-23-2 19-11-13-20 22 8Z" />
      </g>
      {targets.map((target, index) => {
        const delay = index * 0.1;
        return (
          <g key={target.square} data-testid={`shot-projectile-${target.square}`}>
            <line className="shot-tracer" x1={from.x} y1={from.y} x2={target.x} y2={target.y} style={{ animationDelay: `${delay}s` }} />
            <g transform={`translate(${from.x} ${from.y})`}>
              <circle className="shot-projectile" r="8">
                <animateMotion path={`M0 0 L${target.x - from.x} ${target.y - from.y}`} begin={`${delay}s`} dur=".42s" fill="freeze" />
              </circle>
            </g>
            <g transform={`translate(${target.x} ${target.y})`}>
              <g className="shot-impact" style={{ animationDelay: `${delay + 0.38}s` }}>
                <circle r="32" />
                <path d="m0-35 9 19 20-14-9 23 22 7-24 6 9 24-20-15-9 21-8-21-21 15 9-24-24-6 23-7-10-23 21 14Z" />
                <text y="5" textAnchor="middle">HIT!</text>
              </g>
            </g>
          </g>
        );
      })}
    </svg>
  );
}