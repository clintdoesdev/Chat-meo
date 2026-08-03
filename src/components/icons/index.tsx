export type IconProps = { size?: number; className?: string };

export function ActionsCheckIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <path
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="10"
        d="M12 34l13.5 13L52 17"
      />
    </svg>
  );
}

export function ActionsCloseIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M32 10a5 5 0 0 1 5 5v12h12a5 5 0 0 1 0 10H37v12a5 5 0 0 1-10 0V37H15a5 5 0 0 1 0-10h12V15a5 5 0 0 1 5-5Z"
        transform="rotate(45 32 32)"
      />
    </svg>
  );
}

export function ActionsDownloadIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M32 6a5 5 0 0 1 5 5v14h8.2a3.2 3.2 0 0 1 2.3 5.4L34.3 44.2a3.2 3.2 0 0 1-4.6 0L16.5 30.4a3.2 3.2 0 0 1 2.3-5.4H27V11a5 5 0 0 1 5-5Z"
      />
      <rect x="8" y="50" width="48" height="8" rx="4" fill="currentColor" />
    </svg>
  );
}

export function ActionsDragHandleIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <g fill="currentColor">
        <circle cx="24" cy="15" r="5" />
        <circle cx="40" cy="15" r="5" />
        <circle cx="24" cy="32" r="5" />
        <circle cx="40" cy="32" r="5" />
        <circle cx="24" cy="49" r="5" />
        <circle cx="40" cy="49" r="5" />
      </g>
    </svg>
  );
}

export function ActionsDuplicateIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <path
        opacity="0.45"
        fill="currentColor"
        d="M17 8h20c5 0 9 4 9 9v2h-8c-7.2 0-13 5.8-13 13v14h-8c-5 0-9-4-9-9V17c0-5 4-9 9-9Z"
      />
      <rect x="21" y="21" width="35" height="35" rx="9" fill="currentColor" />
    </svg>
  );
}

export function ActionsEditIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M40.9 9.6a8 8 0 0 1 11.3 0l2.2 2.2a8 8 0 0 1 0 11.3l-4.3 4.3L36.6 13.9l4.3-4.3Z"
      />
      <path
        fill="currentColor"
        d="M32.4 18.1 46 31.6 24.5 53.1c-1.2 1.2-2.7 2-4.3 2.4l-9.6 2.3c-2.5.6-4.8-1.7-4.2-4.2l2.3-9.6c.4-1.6 1.2-3.1 2.4-4.3l21.3-21.6Z"
      />
    </svg>
  );
}

export function ActionsFilterIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M12 8h40a4 4 0 0 1 3.1 6.5L39 34.4V52a4 4 0 0 1-6 3.5l-6-3.5a4 4 0 0 1-2-3.5V34.4L8.9 14.5A4 4 0 0 1 12 8Z"
      />
    </svg>
  );
}

export function ActionsLinkIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <path
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="7"
        d="M29 19l5-5a11.3 11.3 0 0 1 16 16l-5 5M35 45l-5 5a11.3 11.3 0 0 1-16-16l5-5M26 38l12-12"
      />
    </svg>
  );
}

export function ActionsMoreIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <circle cx="13" cy="32" r="6" fill="currentColor" />
      <circle cx="32" cy="32" r="6" fill="currentColor" />
      <circle cx="51" cy="32" r="6" fill="currentColor" />
    </svg>
  );
}

export function ActionsPlusIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M32 10a5 5 0 0 1 5 5v12h12a5 5 0 0 1 0 10H37v12a5 5 0 0 1-10 0V37H15a5 5 0 0 1 0-10h12V15a5 5 0 0 1 5-5Z"
      />
    </svg>
  );
}

export function ActionsPreviewIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M32 13c14.8 0 25.2 12.4 28.3 17.1.8 1.2.8 2.6 0 3.8C57.2 38.6 46.8 51 32 51S6.8 38.6 3.7 33.9a3.4 3.4 0 0 1 0-3.8C6.8 25.4 17.2 13 32 13Zm0 10a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z"
      />
    </svg>
  );
}

export function ActionsRedoIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <g transform="scale(-1 1) translate(-64 0)">
        <path
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="8"
          d="M15 25h24a13 13 0 0 1 0 26H23"
        />
        <path
          fill="currentColor"
          d="M20.4 12.6a4 4 0 0 1 0 5.7L13.7 25l6.7 6.7a4 4 0 0 1-5.7 5.7l-9.5-9.6a4 4 0 0 1 0-5.6l9.5-9.6a4 4 0 0 1 5.7 0Z"
        />
      </g>
    </svg>
  );
}

export function ActionsSearchIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M27 8a19 19 0 1 1 0 38 19 19 0 0 1 0-38Zm0 9a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="10"
        d="M41.5 41.5 54 54"
      />
    </svg>
  );
}

export function ActionsTrashIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <rect x="24" y="5" width="16" height="7" rx="3.5" fill="currentColor" />
      <rect x="9" y="12" width="46" height="8" rx="4" fill="currentColor" />
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M13.5 24h37l-2.3 27.5A7 7 0 0 1 41.2 58H22.8a7 7 0 0 1-7-6.5L13.5 24Zm13 8a3 3 0 0 1 3 3v13a3 3 0 0 1-6 0V35a3 3 0 0 1 3-3Zm11 0a3 3 0 0 1 3 3v13a3 3 0 0 1-6 0V35a3 3 0 0 1 3-3Z"
      />
    </svg>
  );
}

export function ActionsUndoIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <path
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="8"
        d="M15 25h24a13 13 0 0 1 0 26H23"
      />
      <path
        fill="currentColor"
        d="M20.4 12.6a4 4 0 0 1 0 5.7L13.7 25l6.7 6.7a4 4 0 0 1-5.7 5.7l-9.5-9.6a4 4 0 0 1 0-5.6l9.5-9.6a4 4 0 0 1 5.7 0Z"
      />
    </svg>
  );
}

export function ActionsUploadIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M32 46a5 5 0 0 1-5-5V27h-8.2a3.2 3.2 0 0 1-2.3-5.4L29.7 7.8a3.2 3.2 0 0 1 4.6 0l13.2 13.8a3.2 3.2 0 0 1-2.3 5.4H37v14a5 5 0 0 1-5 5Z"
      />
      <rect x="8" y="50" width="48" height="8" rx="4" fill="currentColor" />
    </svg>
  );
}

export function AnimatedLiveIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <style>{`
          .ml-ring { animation: ml-pulse 1.8s cubic-bezier(.2,.6,.4,1) infinite; transform-origin: 32px 32px; }
          .ml-r2 { animation-delay: .6s; }
          @keyframes ml-pulse {
            0% { transform: scale(.45); opacity: .8; }
            100% { transform: scale(1.05); opacity: 0; }
          }
        `}</style>
      <circle cx="32" cy="32" r="9" fill="currentColor" />
      <circle
        className="ml-ring"
        cx="32"
        cy="32"
        r="26"
        fill="none"
        stroke="currentColor"
        strokeWidth="5"
      />
      <circle
        className="ml-ring ml-r2"
        cx="32"
        cy="32"
        r="26"
        fill="none"
        stroke="currentColor"
        strokeWidth="5"
      />
    </svg>
  );
}

export function AnimatedSendingIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <style>{`
          .msn-plane { animation: msn-fly 2.4s ease-in-out infinite; transform-origin: 32px 32px; }
          @keyframes msn-fly {
            0%, 100% { transform: translate(-2px, 2px) rotate(-3deg); }
            50% { transform: translate(3px, -3px) rotate(3deg); }
          }
        `}</style>
      <path
        className="msn-plane"
        fill="currentColor"
        d="M55.6 8.4c2-.8 4 1.2 3.2 3.2L42 55.3c-.9 2.2-4 2.1-4.8-.1l-5.6-16a3 3 0 0 0-1.8-1.8l-16-5.6c-2.2-.8-2.3-3.9-.1-4.8L55.6 8.4Z"
      />
    </svg>
  );
}

export function AnimatedSpinnerIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <style>{`
          .ms-arc { animation: ms-spin 0.9s linear infinite; transform-origin: 32px 32px; }
          @keyframes ms-spin { to { transform: rotate(360deg); } }
        `}</style>
      <circle
        cx="32"
        cy="32"
        r="22"
        fill="none"
        stroke="currentColor"
        strokeWidth="8"
        opacity="0.18"
      />
      <path
        className="ms-arc"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="8"
        d="M32 10a22 22 0 0 1 20.2 13.3"
      />
    </svg>
  );
}

export function AnimatedSuccessIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <style>{`
          .mck-c { animation: mck-pop 2.6s cubic-bezier(.3,1.4,.5,1) infinite; transform-origin: 32px 32px; }
          .mck-t { stroke-dasharray: 42; animation: mck-draw 2.6s ease-out infinite; }
          @keyframes mck-pop {
            0% { transform: scale(0); } 14% { transform: scale(1.08); }
            20%, 88% { transform: scale(1); } 100% { transform: scale(1); opacity: 0; }
          }
          @keyframes mck-draw {
            0%, 16% { stroke-dashoffset: 42; } 38%, 88% { stroke-dashoffset: 0; }
            100% { stroke-dashoffset: 0; opacity: 0; }
          }
        `}</style>
      <circle
        className="mck-c"
        cx="32"
        cy="32"
        r="26"
        fill="currentColor"
        opacity="0.18"
      />
      <circle
        className="mck-c"
        cx="32"
        cy="32"
        r="26"
        fill="none"
        stroke="currentColor"
        strokeWidth="5"
      />
      <path
        className="mck-t"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="7"
        d="M20.5 33.5l8 8L44 26"
      />
    </svg>
  );
}

export function AnimatedSyncIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <style>{`
          .msy-g { animation: msy-spin 1.5s cubic-bezier(.5,.15,.35,.85) infinite; transform-origin: 32px 32px; }
          @keyframes msy-spin { to { transform: rotate(360deg); } }
        `}</style>
      <g className="msy-g">
        <path
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="7"
          d="M17.15 46.85A21 21 0 1 1 46.85 46.85"
        />
        <path
          fill="currentColor"
          d="M46.85 46.85 60 44l-4.5 15.5a2.6 2.6 0 0 1-4.3 1.1l-8-8a2.6 2.6 0 0 1 1.2-4.4l2.45-.35Z"
          transform="rotate(3 47 47)"
        />
      </g>
    </svg>
  );
}

export function AnimatedTypingIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <style>{`
          .mt-dot { animation: mt-bounce 1.2s ease-in-out infinite; }
          .mt-d2 { animation-delay: .15s; }
          .mt-d3 { animation-delay: .3s; }
          @keyframes mt-bounce {
            0%, 55%, 100% { transform: translateY(0); opacity: .45; }
            25% { transform: translateY(-9px); opacity: 1; }
          }
        `}</style>
      <circle className="mt-dot" cx="14" cy="36" r="6.5" fill="currentColor" />
      <circle
        className="mt-dot mt-d2"
        cx="32"
        cy="36"
        r="6.5"
        fill="currentColor"
      />
      <circle
        className="mt-dot mt-d3"
        cx="50"
        cy="36"
        r="6.5"
        fill="currentColor"
      />
    </svg>
  );
}

export function CanvasFitViewIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M8 26v-8C8 12.5 12.5 8 18 8h8a4.5 4.5 0 0 1 0 9h-6a3 3 0 0 0-3 3v6a4.5 4.5 0 0 1-9 0Z"
      />
      <g transform="rotate(90 32 32)">
        <path
          fill="currentColor"
          d="M8 26v-8C8 12.5 12.5 8 18 8h8a4.5 4.5 0 0 1 0 9h-6a3 3 0 0 0-3 3v6a4.5 4.5 0 0 1-9 0Z"
        />
      </g>
      <g transform="rotate(180 32 32)">
        <path
          fill="currentColor"
          d="M8 26v-8C8 12.5 12.5 8 18 8h8a4.5 4.5 0 0 1 0 9h-6a3 3 0 0 0-3 3v6a4.5 4.5 0 0 1-9 0Z"
        />
      </g>
      <g transform="rotate(270 32 32)">
        <path
          fill="currentColor"
          d="M8 26v-8C8 12.5 12.5 8 18 8h8a4.5 4.5 0 0 1 0 9h-6a3 3 0 0 0-3 3v6a4.5 4.5 0 0 1-9 0Z"
        />
      </g>
    </svg>
  );
}

export function CanvasPlayIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M22 14.4c0-5 5.5-8.1 9.8-5.5l23 13.6c4.2 2.5 4.2 8.5 0 11L31.8 47C27.5 49.6 22 46.5 22 41.5V14.4Z"
      />
    </svg>
  );
}

export function CanvasPublishIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M32 4c9.4 5.2 14 14.6 14 25 0 3-.4 6-1.3 8.7L32 44 19.3 37.7A30.6 30.6 0 0 1 18 29C18 18.6 22.6 9.2 32 4Zm0 15a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11Z"
      />
      <path
        fill="currentColor"
        d="M17 40c-4.5 3-6.7 8.4-6.9 14.7 0 .8.7 1.4 1.5 1.3 5.4-1 10-3.3 12.6-7L17 40Zm30 0c4.5 3 6.7 8.4 6.9 14.7 0 .8-.7 1.4-1.5 1.3-5.4-1-10-3.3-12.6-7L47 40Z"
      />
      <path
        fill="currentColor"
        opacity="0.6"
        d="M32 48c2.6 2.3 3.5 6.2 3.5 9.5 0 .9-.8 1.5-1.6 1.2A11 11 0 0 1 32 58a11 11 0 0 1-1.9.7c-.8.3-1.6-.3-1.6-1.2 0-3.3.9-7.2 3.5-9.5Z"
      />
    </svg>
  );
}

export function CanvasSaveIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M45 52H20a13 13 0 0 1-2.4-25.8A17 17 0 0 1 50.9 23 12 12 0 0 1 45 52ZM30 45.4l-8.9-8.9 4.8-4.8 4.1 4.1 9.6-9.6 4.8 4.8L30 45.4Z"
      />
    </svg>
  );
}

export function CanvasZoomInIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M27 8a19 19 0 1 1 0 38 19 19 0 0 1 0-38Zm-3 9v7h-7v6h7v7h6v-7h7v-6h-7v-7h-6Z"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="10"
        d="M41.5 41.5 54 54"
      />
    </svg>
  );
}

export function CanvasZoomOutIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M27 8a19 19 0 1 1 0 38 19 19 0 0 1 0-38Zm-10 16v6h20v-6H17Z"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="10"
        d="M41.5 41.5 54 54"
      />
    </svg>
  );
}

export function ChannelsCameraIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M22 10h20c6.6 0 12 5.4 12 12v20c0 6.6-5.4 12-12 12H22c-6.6 0-12-5.4-12-12V22c0-6.6 5.4-12 12-12Zm10 10a12 12 0 1 0 0 24 12 12 0 0 0 0-24Zm0 6a6 6 0 1 1 0 12 6 6 0 0 1 0-12Zm13.5-9a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"
      />
    </svg>
  );
}

export function ChannelsWhatsappIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M32 5a27 27 0 0 1 0 54c-4.9 0-9.6-1.3-13.6-3.7L7.2 58.4c-1.6.4-3-1-2.6-2.6l3.1-11.2A27 27 0 0 1 32 5Zm-9.3 14.6c-1.6 1.6-2.2 3.9-1.3 6 1.8 4.8 4.7 9.3 8.4 13 3.7 3.7 8.2 6.6 13 8.4 2.1.9 4.4.3 6-1.3l2-2c1.6-1.6 1.5-4.2-.3-5.7l-3-2.4c-1.5-1.3-3.8-1.2-5.2.1l-1.8 1.7c-2.5-1-5.9-4.4-6.9-6.9l1.7-1.8c1.3-1.4 1.4-3.7.1-5.2l-2.4-3c-1.5-1.8-4.1-1.9-5.7-.3l-2 2Z"
        transform="translate(0 -1)"
      />
    </svg>
  );
}

export function ChannelsWidgetIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M14 8h36c5.5 0 10 4.5 10 10v22c0 5.5-4.5 10-10 10H14C8.5 50 4 45.5 4 40V18C4 12.5 8.5 8 14 8Zm-3 12v20a4 4 0 0 0 4 4h34a4 4 0 0 0 4-4V20H11Zm2-7a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm9 0a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"
      />
      <path
        fill="currentColor"
        d="M44 28c-6.6 0-12 4.6-12 10.6 0 3.4 1.7 6.4 4.4 8.3-.2 1.4-.8 2.8-1.9 3.8-.3.3-.1.9.4.8 2.4-.2 4.5-1.1 6.1-2.2.9.2 1.9.3 3 .3 6.6 0 12-4.6 12-10.8S50.6 28 44 28Z"
      />
    </svg>
  );
}

export function CommsAttachmentIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <path
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="6"
        d="M43 19 25.5 36.5a6.4 6.4 0 0 0 9 9L52 28a12.7 12.7 0 0 0-18-18L16.5 27.5a19 19 0 0 0 27 27L54 44"
      />
    </svg>
  );
}

export function CommsBellIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M32 4a4.5 4.5 0 0 1 4.5 4.5v1.6A17 17 0 0 1 49 26.5V36l4.2 7a3.2 3.2 0 0 1-2.7 4.9H13.5a3.2 3.2 0 0 1-2.7-4.9L15 36v-9.5A17 17 0 0 1 27.5 10.1V8.5A4.5 4.5 0 0 1 32 4Z"
      />
      <path fill="currentColor" d="M25 51h14a7 7 0 0 1-14 0Z" />
    </svg>
  );
}

export function CommsHelpIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M32 6a26 26 0 1 1 0 52 26 26 0 0 1 0-52Zm.2 11.5c-4 0-7.5 1-10 3.7l4.6 4.6c1.3-1.4 3.1-2.3 5.2-2.3 2.3 0 3.7 1.1 3.7 3 0 1.4-.9 2.3-2.9 3.8-2.5 1.8-4.5 3.8-4.5 7.8v1.4h7v-.6c0-2.2.9-3.1 3-4.7 2.4-1.8 4.4-3.8 4.4-7.5 0-5.3-4.4-9.2-10.5-9.2Zm-.4 25.9a4.2 4.2 0 1 0 0 8.4 4.2 4.2 0 0 0 0-8.4Z"
      />
    </svg>
  );
}

export function CommsLogoutIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M18 6h15a4.5 4.5 0 0 1 0 9H21a2 2 0 0 0-2 2v30a2 2 0 0 0 2 2h12a4.5 4.5 0 0 1 0 9H18c-5.5 0-10-4.5-10-10V16C8 10.5 12.5 6 18 6Z"
      />
      <path
        fill="currentColor"
        d="M41.9 18.6a3.5 3.5 0 0 1 5 0l11 11.1a3.5 3.5 0 0 1 0 4.9L46.8 45.7a3.5 3.5 0 1 1-5-4.9l5-5.1H28a3.7 3.7 0 0 1 0-7.4h18.9l-5-5.1a3.5 3.5 0 0 1 0-4.9Z"
        transform="translate(0 -0.3)"
      />
    </svg>
  );
}

export function CommsSendIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M55.6 8.4c2-.8 4 1.2 3.2 3.2L42 55.3c-.9 2.2-4 2.1-4.8-.1l-5.6-16a3 3 0 0 0-1.8-1.8l-16-5.6c-2.2-.8-2.3-3.9-.1-4.8L55.6 8.4Z"
      />
    </svg>
  );
}

export function CommsUserIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <circle cx="32" cy="19" r="12" fill="currentColor" />
      <path
        fill="currentColor"
        d="M8 54c0-13 10.7-20 24-20s24 7 24 20a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4Z"
      />
    </svg>
  );
}

export function NavAnalyticsIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <rect x="9" y="34" width="12" height="22" rx="5" fill="currentColor" />
      <rect x="26" y="20" width="12" height="36" rx="5" fill="currentColor" />
      <rect x="43" y="8" width="12" height="48" rx="5" fill="currentColor" />
    </svg>
  );
}

export function NavApiKeyIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <g transform="rotate(-45 32 32)">
        <path
          fill="currentColor"
          fillRule="evenodd"
          d="M17 32a11 11 0 1 1 22 0 11 11 0 0 1-22 0Zm11-4.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9Z"
          transform="translate(-8 0)"
        />
        <rect
          x="29"
          y="28.5"
          width="30"
          height="7"
          rx="3.5"
          fill="currentColor"
        />
        <rect x="44" y="33" width="6" height="10" rx="3" fill="currentColor" />
        <rect x="54" y="33" width="6" height="12" rx="3" fill="currentColor" />
      </g>
    </svg>
  );
}

export function NavBillingIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M14 12h36c5.5 0 10 4.5 10 10v20c0 5.5-4.5 10-10 10H14C8.5 52 4 47.5 4 42V22c0-5.5 4.5-10 10-10ZM4 20h56v8H4v-8Zm8 20a3 3 0 0 1 3-3h10a3 3 0 0 1 0 6H15a3 3 0 0 1-3-3Z"
      />
    </svg>
  );
}

export function NavBotsIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <circle cx="32" cy="9" r="4" fill="currentColor" />
      <rect x="29.5" y="11" width="5" height="8" rx="2.5" fill="currentColor" />
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M21 19h22c6.1 0 11 4.9 11 11v13c0 6.1-4.9 11-11 11H21c-6.1 0-11-4.9-11-11V30c0-6.1 4.9-11 11-11Zm3.5 22a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm15 0a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z"
      />
    </svg>
  );
}

export function NavDashboardIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <rect x="8" y="8" width="21" height="26" rx="7" fill="currentColor" />
      <rect x="35" y="8" width="21" height="16" rx="7" fill="currentColor" />
      <rect x="35" y="30" width="21" height="26" rx="7" fill="currentColor" />
      <rect x="8" y="40" width="21" height="16" rx="7" fill="currentColor" />
    </svg>
  );
}

export function NavFlowsIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <path
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="5"
        d="M21 32h6c9 0 6-17 15-17h4M27 32c9 0 6 17 15 17h4"
      />
      <circle cx="14" cy="32" r="8" fill="currentColor" />
      <rect x="43" y="7" width="16" height="16" rx="6" fill="currentColor" />
      <rect x="43" y="41" width="16" height="16" rx="6" fill="currentColor" />
    </svg>
  );
}

export function NavInboxIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M18 8h28c5.5 0 10 4.5 10 10v28c0 5.5-4.5 10-10 10H18C12.5 56 8 51.5 8 46V18C8 12.5 12.5 8 18 8Zm-10 27h13.2c1.5 0 2.8.8 3.5 2.1 1.4 2.6 4.2 4.4 7.3 4.4s5.9-1.8 7.3-4.4c.7-1.3 2-2.1 3.5-2.1H56v6H44.6c-2.3 3.9-6.6 6.5-11.4 6.5s-9.1-2.6-11.4-6.5H8v-6Z"
      />
    </svg>
  );
}

export function NavSettingsIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <g fill="currentColor">
        <rect x="29" y="3" width="6" height="12" rx="3" />
        <rect x="29" y="49" width="6" height="12" rx="3" />
        <rect
          x="29"
          y="3"
          width="6"
          height="12"
          rx="3"
          transform="rotate(90 32 32)"
        />
        <rect
          x="29"
          y="49"
          width="6"
          height="12"
          rx="3"
          transform="rotate(90 32 32)"
        />
        <rect
          x="29"
          y="3"
          width="6"
          height="12"
          rx="3"
          transform="rotate(45 32 32)"
        />
        <rect
          x="29"
          y="49"
          width="6"
          height="12"
          rx="3"
          transform="rotate(45 32 32)"
        />
        <rect
          x="29"
          y="3"
          width="6"
          height="12"
          rx="3"
          transform="rotate(-45 32 32)"
        />
        <rect
          x="29"
          y="49"
          width="6"
          height="12"
          rx="3"
          transform="rotate(-45 32 32)"
        />
      </g>
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M32 13a19 19 0 1 1 0 38 19 19 0 0 1 0-38Zm0 12a7 7 0 1 0 0 14 7 7 0 0 0 0-14Z"
      />
    </svg>
  );
}

export function NavTeamIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <g opacity="0.45" fill="currentColor">
        <circle cx="45" cy="19" r="8" />
        <path d="M34 52c0-9 4.6-14 11-14s11 5 11 14a3 3 0 0 1-3 3H37a3 3 0 0 1-3-3Z" />
      </g>
      <circle cx="24" cy="21" r="10" fill="currentColor" />
      <path
        fill="currentColor"
        d="M6 53c0-11 8-17 18-17s18 6 18 17a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4Z"
      />
    </svg>
  );
}

export function NodesActionIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinejoin="round"
        d="M36.5 7 15 35h11.5L22 57 49 28H36l4-21h-3.5Z"
      />
    </svg>
  );
}

export function NodesAiIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M27 8c2.2 13.4 6.6 17.8 20 20-13.4 2.2-17.8 6.6-20 20-2.2-13.4-6.6-17.8-20-20 13.4-2.2 17.8-6.6 20-20Z"
      />
      <path
        fill="currentColor"
        opacity="0.6"
        d="M50 38c1 6.1 3 8.1 9 9-6 1-8 3-9 9-1-6-3-8-9-9 6-.9 8-2.9 9-9Z"
      />
    </svg>
  );
}

export function NodesConditionIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <rect
        x="13"
        y="13"
        width="38"
        height="38"
        rx="9"
        transform="rotate(45 32 32)"
        fill="currentColor"
      />
    </svg>
  );
}

export function NodesLogicIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <rect x="9" y="7" width="46" height="50" rx="9" fill="none" stroke="currentColor" strokeWidth="4.5" />
      <path
        d="M18 22h20M18 32h28M18 42h16"
        fill="none"
        stroke="currentColor"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function NodesDelayIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M32 6a26 26 0 1 1 0 52 26 26 0 0 1 0-52Zm-2.8 11v17.8H43v-5.6H34.8V17h-5.6Z"
      />
    </svg>
  );
}

export function NodesEndIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <rect x="11" y="6" width="7" height="52" rx="3.5" fill="currentColor" />
      <path
        fill="currentColor"
        d="M22 10h27.5a3 3 0 0 1 2.4 4.8L45.5 23l6.4 8.2a3 3 0 0 1-2.4 4.8H22V10Z"
      />
    </svg>
  );
}

export function NodesHandoffIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <path
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="6"
        d="M13 36v-6a19 19 0 0 1 38 0v6M51 44v3a9 9 0 0 1-9 9h-6"
      />
      <rect x="7" y="32" width="11" height="17" rx="5.5" fill="currentColor" />
      <rect x="46" y="32" width="11" height="17" rx="5.5" fill="currentColor" />
      <circle cx="34" cy="56" r="4" fill="currentColor" />
    </svg>
  );
}

export function NodesMessageIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M32 6C17 6 6 16.4 6 30c0 7.8 3.8 14.5 9.9 18.9-.4 3.2-1.7 6.3-4.2 8.7-.7.7-.2 1.9.8 1.8 5.4-.5 10.2-2.6 13.8-5 1.8.3 3.7.5 5.7.5 15 0 26-10.4 26-23.9S47 6 32 6Z"
      />
    </svg>
  );
}

export function NodesQuestionIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M32 6C17 6 6 16.4 6 30c0 7.8 3.8 14.5 9.9 18.9-.4 3.2-1.7 6.3-4.2 8.7-.7.7-.2 1.9.8 1.8 5.4-.5 10.2-2.6 13.8-5 1.8.3 3.7.5 5.7.5 15 0 26-10.4 26-23.9S47 6 32 6Z M32 17.5c6.3 0 10.7 3.8 10.7 9.1 0 3.7-2 5.7-4.4 7.5-2.1 1.6-3 2.5-3 4.7v.7h-7v-1.5c0-4 2-6 4.5-7.8 2-1.5 2.9-2.4 2.9-3.8 0-1.9-1.4-3-3.7-3-2.1 0-3.9.9-5.2 2.3l-4.6-4.6c2.5-2.7 6-3.6 9.8-3.6Zm-.2 26.5a4.2 4.2 0 1 1 0 8.4 4.2 4.2 0 0 1 0-8.4Z"
      />
    </svg>
  );
}

export function StatusErrorIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M32 6a26 26 0 1 1 0 52 26 26 0 0 1 0-52Zm-8.5 12.6-4.9 4.9 8.5 8.5-8.5 8.5 4.9 4.9 8.5-8.5 8.5 8.5 4.9-4.9-8.5-8.5 8.5-8.5-4.9-4.9-8.5 8.5-8.5-8.5Z"
      />
    </svg>
  );
}

export function StatusInfoIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M32 6a26 26 0 1 1 0 52 26 26 0 0 1 0-52Zm0 11a4.3 4.3 0 1 0 0 8.6A4.3 4.3 0 0 0 32 17Zm-3 12.5v17.7a3 3 0 1 0 6 0V29.5h-6Z"
      />
    </svg>
  );
}

export function StatusSuccessIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M32 6a26 26 0 1 1 0 52 26 26 0 0 1 0-52ZM28.9 43.9 44.6 28.2l-5-4.9-10.7 10.6-4.6-4.6-4.9 5 9.5 9.6Z"
      />
    </svg>
  );
}

export function StatusWarningIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M25.9 9.5c2.7-4.7 9.5-4.7 12.2 0l21 36.4c2.7 4.7-.7 10.6-6.1 10.6H11c-5.4 0-8.8-5.9-6.1-10.6l21-36.4ZM32 22a3.8 3.8 0 0 0-3.8 4l.8 10.4a3 3 0 0 0 6 0l.8-10.4a3.8 3.8 0 0 0-3.8-4Zm0 21a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"
      />
    </svg>
  );
}
