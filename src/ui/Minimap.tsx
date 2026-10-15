// QoL: bản đồ thu nhỏ (1 px một ô) vẽ từ lưới render ~4 lần/giây; khung trắng = vùng đang nhìn; bấm để dời camera.
import { useEffect, useRef } from 'preact/hooks';
import { bridge, settings, ui } from './store';
import { GRID_SIZE, T_BUILDING, T_FLOODED, T_FLOODPLAIN, T_RESERVED, T_ROAD, T_WATER } from '../sim/map/grid';
import { BuildingType, isDike, isWall } from '../sim/state';

const GRASS = ['#6f8e3a', '#6f8e3a', '#7f9a44', '#8a944e', '#9a9460'];
function tileColor(t: number, e: number, bt: number): string {
  if (t & T_WATER) return '#3a6a9a';
  if (t & T_FLOODED) return '#5a86b0';
  if (bt) {
    if (bt === BuildingType.House) return '#d8c8a0';
    if (isDike(bt as BuildingType)) return '#b89a5a';
    if (isWall(bt as BuildingType)) return '#9a9a9a';
    return '#c08050';
  }
  if (t & T_BUILDING) return '#c08050';
  if (t & T_ROAD) return '#a0845a';
  if (t & T_RESERVED) return '#2c2a22';
  if (t & T_FLOODPLAIN) return '#9c9a5a';
  return GRASS[Math.min(4, e)];
}

export function Minimap() {
  const ref = useRef<HTMLCanvasElement>(null);
  const on = settings.value.minimap;
  useEffect(() => {
    if (!on) return;
    const cv = ref.current;
    if (!cv) return;
    const g = cv.getContext('2d')!;
    const img = g.createImageData(GRID_SIZE, GRID_SIZE);
    let hash = 0;
    const draw = () => {
      const tiles = bridge.tiles();
      if (!tiles) return;
      // chỉ vẽ lại ảnh nền khi lưới đổi (băm nhanh); khung nhìn vẽ mỗi lần
      let h = 7;
      for (let i = 0; i < tiles.terrain.length; i += 7) h = (Math.imul(h, 31) + tiles.terrain[i] + tiles.bType[i] * 131) | 0;
      if (h !== hash) {
        hash = h;
        for (let y = 0; y < GRID_SIZE; y++) for (let x = 0; x < GRID_SIZE; x++) {
          const i = y * GRID_SIZE + x;
          // ô neo ghi bType; ô khác trong móng chỉ có cờ T_BUILDING → cùng màu công trình
          const c = tileColor(tiles.terrain[i], tiles.elevation[i], tiles.bType[i]);
          const r = parseInt(c.slice(1, 3), 16), gg = parseInt(c.slice(3, 5), 16), b = parseInt(c.slice(5, 7), 16);
          // chiếu isometric thu nhỏ: px = (x − y) + 160, py = (x + y) / 2 → dùng ảnh vuông đơn giản xoay 45° sẽ khó đọc; giữ lưới vuông, trục x sang phải, y xuống
          const k = i * 4; img.data[k] = r; img.data[k + 1] = gg; img.data[k + 2] = b; img.data[k + 3] = 255;
        }
      }
      g.putImageData(img, 0, 0);
      const v = bridge.view();
      if (v) {
        g.strokeStyle = '#fff6e0'; g.lineWidth = 1;
        g.beginPath();
        v.corners.forEach(([x, y], i) => (i ? g.lineTo(x + 0.5, y + 0.5) : g.moveTo(x + 0.5, y + 0.5)));
        g.closePath(); g.stroke();
      }
    };
    draw();
    const id = setInterval(draw, 250);
    return () => clearInterval(id);
  }, [on, ui.value?.city.scenario.key]);
  if (!on) return null;
  const click = (e: MouseEvent) => {
    const cv = ref.current!;
    const r = cv.getBoundingClientRect();
    const x = Math.floor(((e.clientX - r.left) / r.width) * GRID_SIZE), y = Math.floor(((e.clientY - r.top) / r.height) * GRID_SIZE);
    bridge.lookAt(x, y);
  };
  return <canvas ref={ref} class="minimap" width={GRID_SIZE} height={GRID_SIZE} title="Bản đồ thu nhỏ — bấm để dời camera (M ẩn / hiện)" onClick={click} onMouseMove={(e) => { if (e.buttons & 1) click(e); }} />;
}
