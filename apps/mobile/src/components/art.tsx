import Svg, { Circle, Ellipse, Path, Rect, Defs, Pattern } from 'react-native-svg';
import { View } from 'react-native';
import { colors as c } from '../design/theme';

export function PortlMark({ size = 30, color = c.forest }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 36">
      <Path
        d="M5 32V15C5 8.9 9.9 4 16 4s11 4.9 11 11v17M12 32V16a4 4 0 0 1 8 0v16"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}
export function HomeArt({ size = 230 }: { size?: number }) {
  return (
    <Svg width={size} height={size * 0.75} viewBox="0 0 280 210">
      <Circle cx="213" cy="43" r="25" fill="#DDEEAF" opacity=".95" />
      <Ellipse cx="157" cy="186" rx="116" ry="14" fill="#183E33" />
      <Path d="M56 177V53l75-26v150z" fill="#C4D3AE" />
      <Path d="M131 27l70 31v119h-70z" fill="#E8E8CB" />
      <Path d="M162 177v-58l52-20 36 19v59z" fill="#A8BE93" />
      <Path d="M214 99v78h36v-59z" fill="#DBE0BD" />
      <Path d="M102 177v-29a13 13 0 0 1 26 0v29" fill="#315A46" />
      {[0, 1, 2].flatMap((row) =>
        [0, 1].map((col) => (
          <Rect
            key={`l${row}${col}`}
            x={69 + col * 28}
            y={61 + row * 27}
            width="14"
            height="16"
            rx="2"
            fill="#49715A"
          />
        )),
      )}
      {[0, 1, 2, 3].flatMap((row) =>
        [0, 1].map((col) => (
          <Rect
            key={`r${row}${col}`}
            x={143 + col * 27}
            y={57 + row * 26}
            width="13"
            height="15"
            rx="2"
            fill="#79916E"
          />
        )),
      )}
      <Rect x="175" y="128" width="16" height="15" rx="2" fill="#527752" />
      <Rect x="224" y="130" width="13" height="15" rx="2" fill="#6F8C60" />
      <Path
        d="M36 176v-35m0 17c-26-3-25-25-11-27-12-16-2-36 11-35 19 0 26 17 15 32 18 15 8 33-15 30"
        stroke="#476C47"
        strokeWidth="4"
        fill="#87A977"
      />
      <Path
        d="M256 180v-30m0 10c-19-1-24-19-12-28-6-18 12-31 23-17 10 11 4 20 1 21 11 9 5 24-12 24"
        stroke="#698752"
        strokeWidth="3"
        fill="#B0C588"
      />
      <Path d="M91 187q36-9 64 3" fill="none" stroke="#DDEEAF" strokeWidth="2" opacity=".5" />
    </Svg>
  );
}
export function AmenityArt({
  kind,
  height = 140,
}: {
  kind: 'pool' | 'gym' | 'court' | 'clubhouse';
  height?: number;
}) {
  const bg =
    kind === 'pool'
      ? '#D8EAEC'
      : kind === 'gym'
        ? '#EEE8DD'
        : kind === 'court'
          ? '#DDE8D9'
          : '#EEE3DA';
  return (
    <View style={{ height, backgroundColor: bg, overflow: 'hidden', borderRadius: 16 }}>
      <Svg width="100%" height="100%" viewBox="0 0 330 160" preserveAspectRatio="xMidYMid slice">
        <Defs>
          <Pattern id="tiles" x="0" y="0" width="22" height="22" patternUnits="userSpaceOnUse">
            <Rect width="22" height="22" fill="#9CC9CF" />
            <Path d="M22 0H0V22" fill="none" stroke="#CEE5E6" strokeWidth="1" />
          </Pattern>
        </Defs>
        {kind === 'pool' ? (
          <>
            <Rect x="-15" y="-10" width="360" height="180" fill="#E2ECE6" />
            <Rect x="40" y="18" width="248" height="163" rx="18" fill="#FAF7E9" />
            <Rect x="49" y="27" width="230" height="154" rx="12" fill="url(#tiles)" />
            <Path
              d="M52 61q20-8 40 0t40 0t40 0t40 0t40 0M52 101q20-8 40 0t40 0t40 0t40 0t40 0"
              stroke="#D4EDEF"
              strokeWidth="3"
              fill="none"
              opacity=".8"
            />
            <Path
              d="M217 8v53m24-53v53M217 25h24m-24 15h24m-24 15h24"
              stroke="#FAFBF0"
              strokeWidth="5"
              strokeLinecap="round"
            />
            <Circle cx="119" cy="111" r="20" fill="#E2A17B" />
            <Circle cx="119" cy="111" r="10" fill="#A2CFD3" />
            <Ellipse cx="5" cy="82" rx="28" ry="60" fill="#809F79" />
            <Ellipse cx="323" cy="140" rx="23" ry="52" fill="#9EB28A" />
          </>
        ) : kind === 'court' ? (
          <>
            <Rect x="40" y="16" width="250" height="155" rx="7" fill="#6F9575" />
            <Path
              d="M57 31h215v126H57zM57 94h215M165 31v126M57 61h215M57 126h215"
              fill="none"
              stroke="#EBEFDC"
              strokeWidth="2"
            />
            <Path d="M28 93h274" stroke="#F8F5E9" strokeWidth="4" />
            <Path d="M28 90v40m274-40v40" stroke="#335C43" strokeWidth="4" />
            <Ellipse
              cx="212"
              cy="128"
              rx="13"
              ry="17"
              stroke="#EACA8C"
              strokeWidth="5"
              fill="none"
              transform="rotate(35 212 128)"
            />
            <Path d="M202 142l-13 18" stroke="#EACA8C" strokeWidth="5" />
          </>
        ) : kind === 'gym' ? (
          <>
            <Path d="M0 130h330" stroke="#D8CBBB" strokeWidth="2" />
            <Rect x="35" y="19" width="98" height="83" rx="48" fill="#D6D7B9" />
            <Path d="M85 19v83m-50-40h98" stroke="#F8F5EB" strokeWidth="4" />
            <Path d="M201 38h66v70h-66z" fill="#C5BCAC" />
            <Path
              d="M174 123h120m-105-2 8-58 49 1 18 57M197 63l10-21h32"
              fill="none"
              stroke="#535B4E"
              strokeWidth="7"
              strokeLinecap="round"
            />
            <Rect x="49" y="128" width="100" height="7" rx="3" fill="#B59379" />
            <Path
              d="M55 116h40m-40-11v22m40-22v22"
              stroke="#6B7362"
              strokeWidth="9"
              strokeLinecap="round"
            />
          </>
        ) : (
          <>
            <Rect x="129" y="5" width="92" height="118" rx="45" fill="#D6DBBF" />
            <Path d="M175 5v118M129 61h92" stroke="#F8F2E4" strokeWidth="5" />
            <Rect x="73" y="97" width="185" height="50" rx="14" fill="#BA8D71" />
            <Rect x="81" y="78" width="73" height="49" rx="12" fill="#D4AB8B" />
            <Rect x="158" y="78" width="90" height="49" rx="12" fill="#D9B699" />
            <Ellipse cx="171" cy="140" rx="53" ry="13" fill="#E7D4BD" />
            <Rect x="49" y="92" width="17" height="52" rx="3" fill="#A0A581" />
            <Ellipse cx="58" cy="73" rx="25" ry="37" fill="#81946B" />
          </>
        )}
      </Svg>
    </View>
  );
}
