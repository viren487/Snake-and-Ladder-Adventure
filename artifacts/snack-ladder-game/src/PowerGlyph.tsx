import type { SVGProps } from 'react';

export type DetailedPower = 'antiVenom' | 'defuser' | 'knife';

export function PowerGlyph({
  power,
  size = 20,
  ...props
}: SVGProps<SVGSVGElement> & { power: DetailedPower; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {power === 'antiVenom' && (
        <g strokeLinecap="round" strokeLinejoin="round">
          <path d="m7.1 15.9 7.8-7.8 3.1 3.1-7.8 7.8H7.1z" fill="#fff4f2" stroke="#a9132d" strokeWidth="1.6" />
          <path d="m9.5 15.2 4.4-4.4 2.3 2.3-4.4 4.4H9.5z" fill="#ef4057" stroke="#b81935" strokeWidth="1" />
          <path d="m12.7 10.3 3.1 3.1m-1-7.3 4.1 4.1m-2.2-6 5.3 5.3m-10.4 9.5-3.2 3.2m-2.5-2.4 4.8-4.8" stroke="#86162b" strokeWidth="1.7" />
          <path d="m6.2 18.8 1.4 1.4-2 2-1.4-1.4z" fill="#ef4057" stroke="#86162b" strokeWidth="1" />
          <path d="m14.2 8.8 1.4 1.4m-3.1.2 1.4 1.4" stroke="#fff" strokeWidth=".9" />
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
          <path d="m7.7 16.2 10.6-12q1.4-1.6 2.7-.3t-.3 2.7l-12 10.6z" fill="#f4f8ff" stroke="#41315a" strokeWidth="1.5" />
          <path d="m8.7 15.2 9.7-9.7" stroke="#9caec8" strokeWidth="1.2" />
          <path d="m5.8 14.3 4 4-4.3 4.3q-.8.8-1.6 0l-2.4-2.4q-.8-.8 0-1.6z" fill="#512b42" stroke="#261d2b" strokeWidth="1.5" />
          <path d="m7.9 13.2 3.7 3.7" stroke="#d8b37b" strokeWidth="2" />
          <path d="m3 19.5 2.1 2.1m.3-4.6 1.6 1.6" stroke="#d9a5a5" strokeWidth=".8" />
        </g>
      )}
    </svg>
  );
}
