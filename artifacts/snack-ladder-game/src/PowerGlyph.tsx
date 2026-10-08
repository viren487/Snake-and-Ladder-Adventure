import type { SVGProps } from 'react';

export type DetailedPower = 'bomb' | 'antiVenom' | 'defuser' | 'webShooter' | 'knife';

export function PowerGlyph({
  power,
  size = 20,
  className,
  ...props
}: SVGProps<SVGSVGElement> & { power: DetailedPower; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={`power-glyph ${className ?? ''}`.trim()}
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {power === 'bomb' && (
        <g strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.4 7.4 11 5.5q.2-1.4 1.8-1.6l1.8-.2" stroke="#ffd38a" strokeWidth="1.5" />
          <path d="m14.5 2.9 1.1-1m-.1 2 1.5-.2m-2.2.9 1 1" stroke="#fff1a6" strokeWidth="1.2" />
          <path d="M9.2 7.2h5.2l.8 2.1a7.1 7.1 0 1 1-6.8.1z" fill="#292d35" stroke="#10141b" strokeWidth="1.2" />
          <path d="M6.8 11.2q5.1 2.5 10.3 0" stroke="#e9444d" strokeWidth="2" />
          <circle cx="10" cy="14.4" r="1.1" fill="#fff4d2" stroke="#fff4d2" strokeWidth=".5" />
          <circle cx="13.5" cy="14.4" r="1.1" fill="#fff4d2" stroke="#fff4d2" strokeWidth=".5" />
          <path d="m11 17.1 1 1 1-1" stroke="#fff4d2" strokeWidth="1.1" />
        </g>
      )}
      {power === 'antiVenom' && (
        <g strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 15.5c1.1-1.9 3.7-.9 3.3.7-.3 1.1-1.9 1.2-2.5.5-.8 1.8.5 3.4 2.5 2.9" fill="none" stroke="#42a938" strokeWidth="1.8" />
          <path d="M12 2.7v3.2M8.4 2.7h7.2" stroke="#6e1927" strokeWidth="2" />
          <g transform="rotate(-45 12 12)">
            <rect x="8" y="5.8" width="8" height="13.7" rx="1.2" fill="#fff7f3" stroke="#812235" strokeWidth="1.5" />
            <path d="M9.5 12.4h5v5.5h-5z" fill="#ef4057" stroke="#b51e37" strokeWidth=".8" />
            <path d="M9.5 11h5m-5 3h5m-5 3h5" stroke="#96243a" strokeWidth=".8" />
            <path d="M7.2 19.5h9.6" stroke="#812235" strokeWidth="2" />
            <path d="M9.8 19.5v2l2.2 2 2.2-2v-2" fill="#e8f2ff" stroke="#812235" strokeWidth="1.1" />
            <path d="M12 23.4v2.8" stroke="#b9e7ff" strokeWidth="1.6" />
          </g>
        </g>
      )}
      {power === 'defuser' && (
        <g strokeLinecap="round" strokeLinejoin="round">
          <circle cx="9.2" cy="15.3" r="6.1" fill="#292d35" stroke="#11151d" strokeWidth="1.5" />
          <ellipse cx="7.2" cy="13.4" rx="2.1" ry="1.2" fill="#858b92" opacity=".7" transform="rotate(-35 7.2 13.4)" />
          <path d="m10.4 8.9 2.1-2.4 2.7.2 1.5 1.5-.2 2.7-2.4 2.1-2-2z" fill="#dce9ff" stroke="#37578c" strokeWidth="1.6" />
          <path d="m13.6 12.1 6.1 6.1q1.1 1.1 0 2.2t-2.2 0l-6.1-6.1" fill="#a9c8ff" stroke="#37578c" strokeWidth="1.7" />
          <path d="m14.4 7.4 1.3 1.3-1.2 1.2" stroke="#fff" strokeWidth="1.1" />
          <path d="m9.1 8.7 1.1-2.5 2.1-.6" stroke="#c7cbd0" strokeWidth="1.5" />
        </g>
      )}
      {power === 'knife' && (
        <g strokeLinecap="round" strokeLinejoin="round">
          <path d="M2.2 4.3 18 12l-6 6.7z" fill="#dceaff" stroke="#28354a" strokeWidth="1.3" />
          <path d="m3.4 4.9 13.1 6.5m-8 1 6.8 3.1" stroke="#fff" strokeWidth="1.2" />
          <path d="m13.8 16.5 4.1-4.2 3.4 3.4-4.1 4.1z" fill="#f0b94e" stroke="#573748" strokeWidth="1.2" />
          <path d="m17.1 19.1 3.5-3.5 2.1 2.1-2.4 4.2q-.6 1-1.5.4l-2-1.5q-.8-.7.3-1.7z" fill="#3c2c42" stroke="#211b2a" strokeWidth="1.3" />
          <path d="m18.3 20 2.5-2.5m-1.1 4.1 1.8-1.8" stroke="#d7bd99" strokeWidth=".8" />
        </g>
      )}
      {power === 'webShooter' && (
        <g strokeLinecap="round" strokeLinejoin="round">
          <circle cx="10.5" cy="12" r="6.1" fill="#102c48" stroke="#8eeaff" strokeWidth="1.5" />
          <circle cx="10.5" cy="12" r="3.1" fill="#147db0" stroke="#52d8ff" strokeWidth="1" />
          <path d="M8.7 10.2 12.3 13.8m0-3.6-3.6 3.6m1.8-5v10m-5-5h10" stroke="#e6fbff" strokeWidth=".9" />
          <path d="m15.8 9.2 4.7-2m-4.2 4.7 5 .2m-5.5 2.3 4.4 2.2m-1.7-8v6.8" stroke="#69dfff" strokeWidth="1.1" />
          <circle cx="20.5" cy="7" r=".8" fill="#effdff" stroke="none" />
        </g>
      )}
    </svg>
  );
}
