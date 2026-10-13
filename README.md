# Đại Việt — city builder theo Caesar 3

Game xây thành phố kiểu Caesar 3 lấy bối cảnh Đại Việt, chạy trên web. Mô phỏng thuần TypeScript trong Web Worker, PixiJS 8 vẽ isometric 64×32, UI gửi lệnh vào sim.

Tài liệu thiết kế cơ chế (nhà, walker, chuỗi sản xuất, lũ và đê, triều đình, chỉ số) nằm trong Claude Project "Làm game".

## Chạy

```
npm install
npm run dev      # http://localhost:5173
npm test         # sim chạy headless
npm run build
```

Thêm `?seed=123` vào URL để đổi bản đồ.

## Cột mốc

- [x] **M1 Lưới** — grid 160×160, sông và vùng ngập, đặt đường / lều tranh / phá, camera, lịch tick 50/ngày
- [x] **M2 Walker** — roamer, hauler, BFS; ruộng → xe bò → vựa → chợ → nhà; nhà bậc 1–5; dân nhập cư
- [ ] **M3 Kinh tế** — xưởng, kho, lao động, thuế, sentiment, nhà bậc 6–8
- [ ] **M4 Lũ đê** — mùa lũ, đê, vỡ đê, phù sa, cống
- [ ] **M5 Triều đình** — 4 chỉ số, chiếu chỉ, tín ngưỡng, khoa cử
- [ ] **M6 Phát hành** — thương mại, giặc, 3 màn, art riêng, PWA

## Cấu trúc

```
src/sim/      mô phỏng — không import Pixi/DOM; tick.ts giữ lịch 50 việc/ngày
  map/        grid, terrain, routing (BFS), desirability
  buildings/  defs (bảng số), spawn, house (bậc 1–5), industry (ruộng, vựa, chợ, sinh walker)
  figures/    figure (pool), movement (walk/roam), behaviors (roamer, xe bò, người gánh chợ, dân nhập cư)
  city/       population (di cư)
src/worker/   vòng lặp sim trong Worker, gửi snapshot
src/render/   iso.ts (hằng số ô, chiếu, neo, zIndex), chunks.ts, app.ts
src/main.ts   nối worker ↔ render ↔ ui
tests/        vitest chạy sim headless
```

Quy tắc cố định từ M1: kích thước ô chỉ ghi ở `render/iso.ts`; điểm neo sprite công trình là góc dưới hình thoi móng; thứ tự vẽ `(x + y) × 8 + layer`; `roundPixels`, `scaleMode: nearest`, zoom 0,5× / 1× / 2×.
