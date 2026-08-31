import { StyleSheet, Text, View } from "react-native";
import Svg, { Polyline } from "react-native-svg";
import type { Trend } from "@/lib/api/types";
import { colors, radius, spacing } from "@/theme/tokens";
import { fontFamily } from "@/theme/fonts";

/** Mobile counterpart to the web Overview page's StatCard (src/components/app/stat-card.tsx) —
 * same fields (label, value, trend arrow/percent, 7-day sparkline, optional caption), rendered
 * with react-native-svg instead of the web's own inline-SVG Sparkline component. */
export function StatCard({
  label,
  value,
  trend,
  spark,
  compact = false,
  caption,
}: {
  label: string;
  value: string;
  trend: Trend | null;
  spark: number[];
  compact?: boolean;
  caption?: string;
}) {
  return (
    <View style={[styles.card, compact && styles.cardCompact]}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.valueRow}>
        <Text style={[styles.value, compact && styles.valueCompact]}>{value}</Text>
        {trend && (
          <Text style={[styles.trend, { color: trend.direction === "up" ? colors.ok : colors.bad }]}>
            {trend.direction === "up" ? "▲" : "▼"} {trend.percent}%
          </Text>
        )}
      </View>
      {spark.length > 0 && <Sparkline values={spark} />}
      {caption && <Text style={styles.caption}>{caption}</Text>}
    </View>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const width = 100;
  const height = 28;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const step = values.length > 1 ? width / (values.length - 1) : 0;
  const points = values
    .map((v, i) => `${i * step},${height - ((v - min) / range) * height}`)
    .join(" ");

  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} style={styles.sparkline}>
      <Polyline points={points} fill="none" stroke={colors.orange2} strokeWidth={2} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: "45%",
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    padding: spacing.lg,
  },
  cardCompact: {
    padding: spacing.md,
  },
  label: {
    color: colors.muted,
    fontFamily: fontFamily.regular,
    fontSize: 11.5,
  },
  valueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: spacing.xs,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  value: {
    color: colors.text,
    fontFamily: fontFamily.bold,
    fontSize: 22,
  },
  valueCompact: {
    fontSize: 17,
  },
  trend: {
    fontFamily: fontFamily.semiBold,
    fontSize: 11,
  },
  sparkline: {
    marginTop: spacing.xs,
  },
  caption: {
    color: colors.muted,
    fontFamily: fontFamily.regular,
    fontSize: 10.5,
    marginTop: spacing.xs,
  },
});
