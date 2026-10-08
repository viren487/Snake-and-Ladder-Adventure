import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

export type DetailedPower = 'bomb' | 'antiVenom' | 'defuser' | 'webShooter' | 'knife';

export function PowerGlyph({ power, size = 20 }: { power: DetailedPower; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
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
          <Path d="M3 15.5c1.1-1.9 3.7-.9 3.3.7-.3 1.1-1.9 1.2-2.5.5-.8 1.8.5 3.4 2.5 2.9" fill="none" stroke="#42a938" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M12 2.7v3.2M8.4 2.7h7.2" stroke="#6e1927" strokeWidth={2} strokeLinecap="round" />
          <Svg rotation={-45} x={-5} y={-5} width={34} height={34} viewBox="0 0 24 24}>
            <Path d="M8 5.8h8v13.7a1.2 1.2 0 0 1-1.2 1.2h-5.6A1.2 1.2 0 0 1 8 19.5z" fill="#fff7f3" stroke="#812235" strokeWidth={1.5} strokeLinejoin="round" />
            <Path d="M9.5 12.4h5v5.5h-5z" fill="#ef4057" stroke="#b51e37" strokeWidth={0.8} />
            <Path d="M9.5 11h5m-5 3h5m-5 3h5" stroke="#96243a" strokeWidth={0.8} />
            <Path d="M7.2 19.5h9.6" stroke="#812235" strokeWidth={2} />
            <Path d="M9.8 19.5v2l2.2 2 2.2-2v-2" fill="#e8f2ff" stroke="#812235" strokeWidth={1.1} />
            <Path d="M12 23.4v2.8" stroke="#b9e7ff" strokeWidth={1.6} />
          </Svg>
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
          <Path d="M2.2 4.3 18 12l-6 6.7z" fill="#dceaff" stroke="#28354a" strokeWidth={1.3} strokeLinejoin="round" />
          <Path d="m3.4 4.9 13.1 6.5m-8 1 6.8 3.1" stroke="#fff" strokeWidth={1.2} strokeLinecap="round" />
          <Path d="m13.8 16.5 4.1-4.2 3.4 3.4-4.1 4.1z" fill="#f0b94e" stroke="#573748" strokeWidth={1.2} strokeLinejoin="round" />
          <Path d="m17.1 19.1 3.5-3.5 2.1 2.1-2.4 4.2q-.6 1-1.5.4l-2-1.5q-.8-.7.3-1.7z" fill="#3c2c42" stroke="#211b2a" strokeWidth={1.3} strokeLinejoin="round" />
          <Path d="m18.3 20 2.5-2.5m-1.1 4.1 1.8-1.8" stroke="#d7bd99" strokeWidth={0.8} strokeLinecap="round" />
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
