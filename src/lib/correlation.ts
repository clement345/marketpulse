/** Pearson correlation of daily log returns, aligned by calendar date. */
export function dailyReturns(bars: { time: number; close: number }[]): Map<string, number> {
  const byDay = new Map<string, number>();
  for (const b of bars) byDay.set(new Date(b.time * 1000).toISOString().slice(0, 10), b.close);
  const days = [...byDay.keys()].sort();
  const out = new Map<string, number>();
  for (let i = 1; i < days.length; i++) {
    const a = byDay.get(days[i - 1])!, b = byDay.get(days[i])!;
    if (a > 0 && b > 0) out.set(days[i], Math.log(b / a));
  }
  return out;
}

export function pearson(x: number[], y: number[]): number | null {
  const n = x.length;
  if (n < 10 || n !== y.length) return null;
  const mx = x.reduce((s, v) => s + v, 0) / n, my = y.reduce((s, v) => s + v, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { const dx = x[i] - mx, dy = y[i] - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; }
  if (!sxx || !syy) return null;
  return sxy / Math.sqrt(sxx * syy);
}

export function correlationMatrix(series: Record<string, Map<string, number>>): { symbols: string[]; matrix: (number | null)[][]; n: number[][] } {
  const symbols = Object.keys(series);
  const matrix: (number | null)[][] = [], n: number[][] = [];
  for (const a of symbols) {
    const row: (number | null)[] = [], nrow: number[] = [];
    for (const b of symbols) {
      const xs: number[] = [], ys: number[] = [];
      for (const [d, v] of series[a]) { const w = series[b].get(d); if (w !== undefined) { xs.push(v); ys.push(w); } }
      row.push(a === b ? 1 : pearson(xs, ys));
      nrow.push(xs.length);
    }
    matrix.push(row); n.push(nrow);
  }
  return { symbols, matrix, n };
}
