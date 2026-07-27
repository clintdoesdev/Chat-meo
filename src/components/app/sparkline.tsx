type SparklineProps = {
  values: number[];
  className?: string;
};

const WIDTH = 100;
const HEIGHT = 30;
const PADDING = 3;

export function Sparkline({ values, className }: SparklineProps) {
  const max = Math.max(...values, 1);
  const stepX = values.length > 1 ? WIDTH / (values.length - 1) : WIDTH;

  const points = values.map((value, index) => {
    const x = values.length > 1 ? index * stepX : WIDTH / 2;
    const y = HEIGHT - PADDING - (value / max) * (HEIGHT - PADDING * 2);
    return [x, y] as const;
  });

  const linePath = points
    .map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(" ");
  const areaPath = `${linePath} L${WIDTH} ${HEIGHT} L0 ${HEIGHT} Z`;

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="none"
      className={className}
      aria-hidden="true"
    >
      <path d={areaPath} fill="url(#spark-gradient)" />
      <path d={linePath} stroke="#FF6E28" strokeWidth="2" fill="none" />
    </svg>
  );
}
