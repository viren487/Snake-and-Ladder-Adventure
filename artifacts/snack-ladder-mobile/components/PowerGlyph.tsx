import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

export type DetailedPower = 'bomb' | 'antiVenom' | 'defuser' | 'webShooter' | 'knife';

const BADGE_COLORS: Record<DetailedPower, { fill: string; stroke: string }> = {
  bomb: { fill: '#772c36', stroke: '#ffab8e' },
  antiVenom: { fill: '#24683a', stroke: '#a8f6a1' },
  defuser: { fill: '#2b4479', stroke: '#a9c5ff' },
  webShooter: { fill: '#164a68', stroke: '#80e8ff' },
  knife: { fill: '#573876', stroke: '#dfb4ff' },
};

export function PowerGlyph({ power, size = 20 }: { power: DetailedPower; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      <Circle cx={12} cy={12} r={11.2} fill={BADGE_COLORS[power].fill} stroke={BADGE_COLORS[power].stroke} strokeWidth={1.1} />
      {power === 'bomb' && (
        <>
          <Path d="M10.4 7.4 11 5.5q.2-1.4 1.8-1.6l1.8-.2" stroke="#ffd38a" strokeWidth={1.5} strokeLinecap="round" />
          <Path d="m14.5 2.9 1.1-1m-.1 2 1.5-.2m-2.2.9 1 1" stroke="#fff1a6" strokeWidth={1.2} strokeLinecap="round" />
          <Path d="M9.2 7.2h5.2l.8 2.1a7.1 7.1 0 1 1-6.8.1z" fill="#292d35" stroke="#10141b" strokeWidth={1.2} strokeLinejoin="round" />
          <Path d="M6.8 11.2q5.1 2.5 10.3 0" stroke="#e9444d" strokeWidth={2} strokeLinecap="round" />
          <Circle cx={10} cy={14.4} r={1.1} fill="#fff4d2" />
          <Circle cx={13.5} cy={14.4} r={1.1} fill="#fff4d2" />
          <Path d="m11 17.1 1 1 1-1" stroke="#fff4d2" strokeWidth={1.1} strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {power === 'antiVenom' && (
        <>
          <Path d="M4.6 15.7c-1.3-1.8.1-3.4 1.7-2.7 1.2.5-.1 2.1-1.4 1.8-1.4-.3-1.7 1.4-.5 2.4" fill="none" stroke="#c6fa91" strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="m7.1 15.9 7.8-7.8 3.1 3.1-7.8 7.8H7.1z" fill="#fff4f2" stroke="#a9132d" strokeWidth={1.6} strokeLinejoin="round" />
          <Path d="m9.5 15.2 4.4-4.4 2.3 2.3-4.4 4.4H9.5z" fill="#ef4057" stroke="#b81935" strokeWidth={1} />
          <Path d="m12.7 10.3 3.1 3.1m-1-7.3 4.1 4.1m-2.2-6 5.3 5.3m-10.4 9.5-3.2 3.2m-2.5-2.4 4.8-4.8" stroke="#86162b" strokeWidth={1.7} strokeLinecap="round" />
          <Path d="m6.2 18.8 1.4 1.4-2 2-1.4-1.4z" fill="#ef4057" stroke="#86162b" strokeWidth={1} />
          <Path d="m14.2 8.8 1.4 1.4m-3.1.2 1.4 1.4" stroke="#fff" strokeWidth={0.9} strokeLinecap="round" />
        </>
      )}
      {power === 'defuser' && (
        <>
          <Circle cx={9.2} cy={15.3} r={6.1} fill="#292d35" stroke="#11151d" strokeWidth={1.5} />
          <Path d="M10.4 8.9 12.5 6.5l2.7.2 1.5 1.5-.2 2.7-2.4 2.1-2-2z" fill="#dce9ff" stroke="#37578c" strokeWidth={1.6} strokeLinejoin="round" />
          <Path d="m13.6 12.1 6.1 6.1q1.1 1.1 0 2.2t-2.2 0l-6.1-6.1" fill="#a9c8ff" stroke="#37578c" strokeWidth={1.7} strokeLinejoin="round" />
          <Path d="m14.4 7.4 1.3 1.3-1.2 1.2m-5.4-1.2 1.1-2.5 2.1-.6" stroke="#fff" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {power === 'knife' && (
        <>
          <Path d="m7.7 16.2 10.6-12q1.4-1.6 2.7-.3t-.3 2.7l-12 10.6z" fill="#f4f8ff" stroke="#41315a" strokeWidth={1.5} strokeLinejoin="round" />
          <Path d="m8.7 15.2 9.7-9.7" stroke="#9caec8" strokeWidth={1.2} strokeLinecap="round" />
          <Path d="m5.8 14.3 4 4-4.3 4.3q-.8.8-1.6 0l-2.4-2.4q-.8-.8 0-1.6z" fill="#512b42" stroke="#261d2b" strokeWidth={1.5} strokeLinejoin="round" />
          <Path d="m7.9 13.2 3.7 3.7" stroke="#d8b37b" strokeWidth={2} strokeLinecap="round" />
        </>
      )}
      {power === 'webShooter' && (
        <>
          <Circle cx={10.5} cy={12} r={6.1} fill="#102c48" stroke="#8eeaff" strokeWidth={1.5} />
          <Circle cx={10.5} cy={12} r={3.1} fill="#147db0" stroke="#52d8ff" strokeWidth={1} />
          <Path d="M8.7 10.2 12.3 13.8m0-3.6-3.6 3.6m1.8-5v10m-5-5h10" stroke="#e6fbff" strokeWidth={0.9} strokeLinecap="round" />
          <Path d="m15.8 9.2 4.7-2m-4.2 4.7 5 .2m-5.5 2.3 4.4 2.2m-1.7-8v6.8" stroke="#69dfff" strokeWidth={1.1} strokeLinecap="round" />
          <Circle cx={20.5} cy={7} r={0.8} fill="#effdff" />
        </>
      )}
    </Svg>
  );
}
