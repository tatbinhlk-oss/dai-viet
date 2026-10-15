// QoL: biểu đồ nhỏ (sparkline) SVG cho lịch sử theo tháng — dân, ngân khố, Ân sủng.
export function Spark({ values, color = '#f0d890', height = 36, zero = false }: { values: number[]; color?: string; height?: number; zero?: boolean }) {
  if (values.length < 2) return <p class="muted">Chưa đủ số liệu (ghi mỗi tháng).</p>;
  const w = 300;
  let min = Math.min(...values), max = Math.max(...values);
  if (zero) { min = Math.min(0, min); max = Math.max(0, max); }
  if (max === min) max = min + 1;
  const px = (i: number) => (i / (values.length - 1)) * (w - 2) + 1;
  const py = (v: number) => height - 1 - ((v - min) / (max - min)) * (height - 2);
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(' ');
  const last = values[values.length - 1], first = values[0];
  return (
    <div class="spark">
      <svg viewBox={`0 0 ${w} ${height}`} width="100%" height={height} preserveAspectRatio="none">
        {zero && min < 0 && <line x1={0} x2={w} y1={py(0)} y2={py(0)} stroke="#7a6540" stroke-width={1} />}
        <path d={d} fill="none" stroke={color} stroke-width={1.5} />
      </svg>
      <div class="muted">{values.length} tháng · đầu {Math.round(first).toLocaleString('vi-VN')} → nay {Math.round(last).toLocaleString('vi-VN')} · thấp {Math.round(Math.min(...values)).toLocaleString('vi-VN')} · cao {Math.round(Math.max(...values)).toLocaleString('vi-VN')}</div>
    </div>
  );
}
