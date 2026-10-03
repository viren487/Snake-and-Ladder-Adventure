const PIPS: Record<number, [number, number][]> = {
  1: [[36, 36]],
  2: [[18, 18], [54, 54]],
  3: [[18, 18], [36, 36], [54, 54]],
  4: [[18, 18], [54, 18], [18, 54], [54, 54]],
  5: [[18, 18], [54, 18], [36, 36], [18, 54], [54, 54]],
  6: [[18, 18], [54, 18], [18, 36], [54, 36], [18, 54], [54, 54]],
};

export function DicePips({ value }: { value: number }) {
  return <svg className="dice-pips" viewBox="0 0 72 72" aria-hidden="true">
    {PIPS[value].map(([x, y], index) =>
      <circle key={index} cx={x} cy={y} r="5.5" fill="currentColor" data-testid="dice-pip" />)}
  </svg>;
}