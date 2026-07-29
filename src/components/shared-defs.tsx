export function SharedDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <defs>
        <linearGradient id="meo-gradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFB27A" />
          <stop offset="0.5" stopColor="#FF8A3C" />
          <stop offset="1" stopColor="#FF5C16" />
        </linearGradient>
        <linearGradient id="meo-gradient-dark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#B03A08" />
          <stop offset="1" stopColor="#7A2604" />
        </linearGradient>
        <radialGradient id="meo-gradient-spec" cx="0.3" cy="0.22" r="0.6">
          <stop offset="0" stopColor="rgba(255,255,255,.55)" />
          <stop offset="1" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
        <linearGradient id="spark-gradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="rgba(255,110,40,.5)" />
          <stop offset="1" stopColor="rgba(255,110,40,0)" />
        </linearGradient>
      </defs>
    </svg>
  );
}
