import type { ColorValue } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";

/** Ports the web app's own hand-drawn icon set (src/components/icons/index.tsx in the main repo)
 * to react-native-svg — same viewBox/path data, so the brand's icon language stays one language
 * instead of a second one invented for mobile. react-native-svg has no CSS `currentColor`
 * inheritance, so every icon takes an explicit `color` prop instead (defaulting to the design
 * system's --color-text) where the web version relied on ambient text color. */

type IconProps = {
  size?: number;
  color?: ColorValue;
};

export function ActionsSearchIcon({ size = 16, color = "#f5f5f5" }: IconProps) {
  return (
    <Svg viewBox="0 0 64 64" width={size} height={size}>
      <Path
        fill={color}
        fillRule="evenodd"
        d="M27 8a19 19 0 1 1 0 38 19 19 0 0 1 0-38Zm0 9a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z"
      />
      <Path
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={10}
        d="M41.5 41.5 54 54"
      />
    </Svg>
  );
}

export function ActionsArchiveIcon({ size = 16, color = "#f5f5f5" }: IconProps) {
  return (
    <Svg viewBox="0 0 64 64" width={size} height={size}>
      <Rect x={8} y={9} width={48} height={12} rx={4} fill={color} />
      <Path
        fill={color}
        fillRule="evenodd"
        clipRule="evenodd"
        d="M11 25h42v24a6 6 0 0 1-6 6H17a6 6 0 0 1-6-6V25Zm14.5 8a3 3 0 0 0 0 6h13a3 3 0 0 0 0-6h-13Z"
      />
    </Svg>
  );
}

export function ChannelsWhatsappIcon({ size = 16, color = "#f5f5f5" }: IconProps) {
  return (
    <Svg viewBox="0 0 64 64" width={size} height={size}>
      <Path
        fill={color}
        fillRule="evenodd"
        d="M32 5a27 27 0 0 1 0 54c-4.9 0-9.6-1.3-13.6-3.7L7.2 58.4c-1.6.4-3-1-2.6-2.6l3.1-11.2A27 27 0 0 1 32 5Zm-9.3 14.6c-1.6 1.6-2.2 3.9-1.3 6 1.8 4.8 4.7 9.3 8.4 13 3.7 3.7 8.2 6.6 13 8.4 2.1.9 4.4.3 6-1.3l2-2c1.6-1.6 1.5-4.2-.3-5.7l-3-2.4c-1.5-1.3-3.8-1.2-5.2.1l-1.8 1.7c-2.5-1-5.9-4.4-6.9-6.9l1.7-1.8c1.3-1.4 1.4-3.7.1-5.2l-2.4-3c-1.5-1.8-4.1-1.9-5.7-.3l-2 2Z"
        transform="translate(0 -1)"
      />
    </Svg>
  );
}

export function ChannelsWidgetIcon({ size = 16, color = "#f5f5f5" }: IconProps) {
  return (
    <Svg viewBox="0 0 64 64" width={size} height={size}>
      <Path
        fill={color}
        fillRule="evenodd"
        d="M14 8h36c5.5 0 10 4.5 10 10v22c0 5.5-4.5 10-10 10H14C8.5 50 4 45.5 4 40V18C4 12.5 8.5 8 14 8Zm-3 12v20a4 4 0 0 0 4 4h34a4 4 0 0 0 4-4V20H11Zm2-7a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm9 0a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"
      />
      <Path
        fill={color}
        d="M44 28c-6.6 0-12 4.6-12 10.6 0 3.4 1.7 6.4 4.4 8.3-.2 1.4-.8 2.8-1.9 3.8-.3.3-.1.9.4.8 2.4-.2 4.5-1.1 6.1-2.2.9.2 1.9.3 3 .3 6.6 0 12-4.6 12-10.8S50.6 28 44 28Z"
      />
    </Svg>
  );
}

export function CommsSendIcon({ size = 16, color = "#f5f5f5" }: IconProps) {
  return (
    <Svg viewBox="0 0 64 64" width={size} height={size}>
      <Path
        fill={color}
        d="M55.6 8.4c2-.8 4 1.2 3.2 3.2L42 55.3c-.9 2.2-4 2.1-4.8-.1l-5.6-16a3 3 0 0 0-1.8-1.8l-16-5.6c-2.2-.8-2.3-3.9-.1-4.8L55.6 8.4Z"
      />
    </Svg>
  );
}

export function NavDashboardIcon({ size = 16, color = "#f5f5f5" }: IconProps) {
  return (
    <Svg viewBox="0 0 64 64" width={size} height={size}>
      <Rect x={8} y={8} width={21} height={26} rx={7} fill={color} />
      <Rect x={35} y={8} width={21} height={16} rx={7} fill={color} />
      <Rect x={35} y={30} width={21} height={26} rx={7} fill={color} />
      <Rect x={8} y={40} width={21} height={16} rx={7} fill={color} />
    </Svg>
  );
}

export function NavFlowsIcon({ size = 16, color = "#f5f5f5" }: IconProps) {
  return (
    <Svg viewBox="0 0 64 64" width={size} height={size}>
      <Path
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={5}
        d="M21 32h6c9 0 6-17 15-17h4M27 32c9 0 6 17 15 17h4"
      />
      <Circle cx={14} cy={32} r={8} fill={color} />
      <Rect x={43} y={7} width={16} height={16} rx={6} fill={color} />
      <Rect x={43} y={41} width={16} height={16} rx={6} fill={color} />
    </Svg>
  );
}

export function NavInboxIcon({ size = 16, color = "#f5f5f5" }: IconProps) {
  return (
    <Svg viewBox="0 0 64 64" width={size} height={size}>
      <Path
        fill={color}
        fillRule="evenodd"
        d="M18 8h28c5.5 0 10 4.5 10 10v28c0 5.5-4.5 10-10 10H18C12.5 56 8 51.5 8 46V18C8 12.5 12.5 8 18 8Zm-10 27h13.2c1.5 0 2.8.8 3.5 2.1 1.4 2.6 4.2 4.4 7.3 4.4s5.9-1.8 7.3-4.4c.7-1.3 2-2.1 3.5-2.1H56v6H44.6c-2.3 3.9-6.6 6.5-11.4 6.5s-9.1-2.6-11.4-6.5H8v-6Z"
      />
    </Svg>
  );
}

export function NavSettingsIcon({ size = 16, color = "#f5f5f5" }: IconProps) {
  return (
    <Svg viewBox="0 0 64 64" width={size} height={size}>
      <Rect x={29} y={3} width={6} height={12} rx={3} fill={color} />
      <Rect x={29} y={49} width={6} height={12} rx={3} fill={color} />
      <Rect x={29} y={3} width={6} height={12} rx={3} fill={color} transform="rotate(90 32 32)" />
      <Rect x={29} y={49} width={6} height={12} rx={3} fill={color} transform="rotate(90 32 32)" />
      <Rect x={29} y={3} width={6} height={12} rx={3} fill={color} transform="rotate(45 32 32)" />
      <Rect x={29} y={49} width={6} height={12} rx={3} fill={color} transform="rotate(45 32 32)" />
      <Rect x={29} y={3} width={6} height={12} rx={3} fill={color} transform="rotate(-45 32 32)" />
      <Rect x={29} y={49} width={6} height={12} rx={3} fill={color} transform="rotate(-45 32 32)" />
      <Path
        fill={color}
        fillRule="evenodd"
        d="M32 13a19 19 0 1 1 0 38 19 19 0 0 1 0-38Zm0 12a7 7 0 1 0 0 14 7 7 0 0 0 0-14Z"
      />
    </Svg>
  );
}

/** Not in the web icon set. The web app can show a saved contact's real name, but a WhatsApp
 * conversation's visitorId is always just the customer's raw phone number — Avatar falls back to
 * this generic contact silhouette instead of slicing that number into fake "initials" for it. */
export function ActionsContactIcon({ size = 16, color = "#f5f5f5" }: IconProps) {
  return (
    <Svg viewBox="0 0 64 64" width={size} height={size}>
      <Circle cx={32} cy={22} r={12} fill={color} />
      <Path fill={color} d="M10 56c0-13 10-21 22-21s22 8 22 21a2 2 0 0 1-2 2H12a2 2 0 0 1-2-2Z" />
    </Svg>
  );
}

/** Not in the web icon set. Attachment-type markers for message bubbles and previews — replaces
 * 📷/📄/🎥/🎤 emoji, which read as inconsistent placeholder glyphs next to this app's own icon
 * language everywhere else in the UI (message text itself still uses real emoji freely; these are
 * only for the app-drawn "this is a photo/document/video/audio" indicator around it). */
export function AttachmentPhotoIcon({ size = 16, color = "#f5f5f5" }: IconProps) {
  return (
    <Svg viewBox="0 0 64 64" width={size} height={size}>
      <Rect x={6} y={12} width={52} height={40} rx={7} fill="none" stroke={color} strokeWidth={5} />
      <Circle cx={22} cy={26} r={5} fill={color} />
      <Path fill={color} d="m14 46 13-14 9 9 8-10 12 15Z" />
    </Svg>
  );
}

export function AttachmentDocumentIcon({ size = 16, color = "#f5f5f5" }: IconProps) {
  return (
    <Svg viewBox="0 0 64 64" width={size} height={size}>
      <Path
        fill="none"
        stroke={color}
        strokeWidth={5}
        strokeLinejoin="round"
        d="M16 6h22l10 10v42a2 2 0 0 1-2 2H16a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z"
      />
      <Path fill="none" stroke={color} strokeWidth={5} strokeLinejoin="round" d="M38 6v10h10" />
      <Path fill="none" stroke={color} strokeWidth={5} strokeLinecap="round" d="M22 34h20M22 44h20" />
    </Svg>
  );
}

export function AttachmentVideoIcon({ size = 16, color = "#f5f5f5" }: IconProps) {
  return (
    <Svg viewBox="0 0 64 64" width={size} height={size}>
      <Rect x={6} y={16} width={38} height={32} rx={7} fill="none" stroke={color} strokeWidth={5} />
      <Path fill={color} d="M50 26 60 19v26l-10-7Z" />
    </Svg>
  );
}

export function AttachmentAudioIcon({ size = 16, color = "#f5f5f5" }: IconProps) {
  return (
    <Svg viewBox="0 0 64 64" width={size} height={size}>
      <Rect x={24} y={6} width={16} height={32} rx={8} fill={color} />
      <Path
        fill="none"
        stroke={color}
        strokeWidth={5}
        strokeLinecap="round"
        d="M14 30a18 18 0 0 0 36 0M32 48v10"
      />
    </Svg>
  );
}

/** Not in the web icon set (the web password field uses an inline SVG, see sign-in-card.tsx) —
 * mobile's own version of the same show/hide-password toggle. */
export function ActionsEyeIcon({ size = 16, color = "#f5f5f5" }: IconProps) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size}>
      <Path
        fill="none"
        stroke={color}
        strokeWidth={1.6}
        d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z"
      />
      <Circle cx={12} cy={12} r={2.6} fill="none" stroke={color} strokeWidth={1.6} />
    </Svg>
  );
}

export function ActionsEyeOffIcon({ size = 16, color = "#f5f5f5" }: IconProps) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size}>
      <Path
        fill="none"
        stroke={color}
        strokeWidth={1.6}
        d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z"
      />
      <Circle cx={12} cy={12} r={2.6} fill="none" stroke={color} strokeWidth={1.6} />
      <Path fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" d="M4 4l16 16" />
    </Svg>
  );
}

/** Not in the web icon set — the web app has no back button (browser chrome handles that), but
 * mobile screens need one. Drawn in the same minimal stroke style as the rest of this set rather
 * than reaching for a generic icon-library glyph. */
export function NavBackIcon({ size = 16, color = "#f5f5f5" }: IconProps) {
  return (
    <Svg viewBox="0 0 64 64" width={size} height={size}>
      <Path
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={7}
        d="M38 12 18 32l20 20"
      />
    </Svg>
  );
}
