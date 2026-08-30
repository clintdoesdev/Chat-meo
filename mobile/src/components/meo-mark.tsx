import Svg, { Circle, Defs, LinearGradient, Path, Stop } from "react-native-svg";

// Same path data and gradient stops as the web app's MeoMark (src/components/meo-mark.tsx) and
// shared-defs.tsx — already ported once this session for the Android app's launcher icon. RN SVG
// has no cross-document <defs>, so the gradient is declared locally on every instance rather than
// referenced from a shared one.
const BODY_PATH =
  "M32 6C17 6 6 16.4 6 30c0 7.8 3.8 14.5 9.9 18.9-.4 3.2-1.7 6.3-4.2 8.7-.7.7-.2 1.9.8 1.8 5.4-.5 10.2-2.6 13.8-5 1.8.3 3.7.5 5.7.5 15 0 26-10.4 26-23.9S47 6 32 6z";

export function MeoMark({ size = 32 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Defs>
        <LinearGradient id="meoGradient" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#ff7a2f" />
          <Stop offset="1" stopColor="#ff5c16" />
        </LinearGradient>
      </Defs>
      <Path d={BODY_PATH} fill="url(#meoGradient)" />
      <Circle cx={24} cy={30} r={4.4} fill="#1a0b00" />
      <Circle cx={40} cy={30} r={4.4} fill="#1a0b00" />
    </Svg>
  );
}
