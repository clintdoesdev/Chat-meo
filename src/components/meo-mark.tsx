type MeoMarkProps = {
  size?: number;
  excited?: boolean;
  className?: string;
};

export function MeoMark({ size = 32, excited = false, className }: MeoMarkProps) {
  const eyeClass = `meo-eye${excited ? " is-excited" : ""}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="Meo"
      className={className}
    >
      {/* offset shadow duplicate, for depth */}
      <g transform="translate(3.5,5)">
        <rect x="8" y="8" width="48" height="40" rx="17" fill="url(#meo-gradient-dark)" />
        <path d="M17 44 L12 58 L28 47 Z" fill="url(#meo-gradient-dark)" />
        <path d="M47 44 L52 58 L36 47 Z" fill="url(#meo-gradient-dark)" />
      </g>

      <rect x="8" y="8" width="48" height="40" rx="17" fill="url(#meo-gradient)" />
      <path d="M17 44 L12 58 L28 47 Z" fill="url(#meo-gradient)" />
      <path d="M47 44 L52 58 L36 47 Z" fill="url(#meo-gradient)" />

      {/* specular highlight */}
      <rect x="8" y="8" width="48" height="40" rx="17" fill="url(#meo-gradient-spec)" />

      <circle className={eyeClass} cx="24" cy="28" r="3.8" fill="#1A0B00" />
      <circle
        className={eyeClass}
        cx="40"
        cy="28"
        r="3.8"
        fill="#1A0B00"
        style={{ animationDelay: "0.08s" }}
      />
    </svg>
  );
}
