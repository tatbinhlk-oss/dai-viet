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

Thêm `?seed=123` vào URL để đổi bản đồ. Thêm `?demo=1` để mở thị trấn mẫu của test cổng M3 (bản đồ phẳng, ~130 nhà, đủ 6 chuỗi xưởng) và xem nó tự chạy.

## Cột mốc

- [x] **M1 Lưới** — grid 160×160, sông và vùng ngập, đặt đường / lều tranh / phá, camera, lịch tick 50/ngày
- [x] **M2 Walker** — roamer, hauler, BFS; ruộng → xe bò → vựa → chợ → nhà; nhà bậc 1–5; dân nhập cư
- [x] **M3 Kinh tế** — 6 chuỗi xưởng + 9 nguyên liệu, kho 8 ngăn, lao động 9 ngành + người mộ phu, thuế + lại thu thuế, lòng dân + di cư hai chiều + tội phạm, nhà bậc 6–8, cháy/sập + tuần đinh/thợ cả; UI Preact (thanh xây theo nhóm, bảng công trình, cố vấn)
- [ ] **M4 Lũ đê** — mùa lũ, đê, vỡ đê, phù sa, cống
- [ ] **M5 Triều đình** — 4 chỉ số, chiếu chỉ, tín ngưỡng, khoa cử
- [ ] **M6 Phát hành** — thương mại, giặc, 3 màn, art riêng, PWA

## Cấu trúc

```
src/data/     bảng cân bằng JSON — chỉnh số ở đây, không sửa code
  buildings.json  giá, nhân công, ngành, địa hình, độ hấp dẫn, walker, sản xuất, cháy/sập
  houses.json     10 bậc nhà, yêu cầu từng bậc, hệ số thuế (M3 mở tới bậc 8)
  economy.json    thuế, lương, lòng dân, di cư, chu kỳ walker, kho, chợ, mùa vụ
  resources.json  19 loại hàng
src/sim/      mô phỏng — không import Pixi/DOM; tick.ts giữ lịch 50 việc/ngày
  map/        grid, terrain, routing (BFS), desirability
  buildings/  defs (nạp JSON), spawn, house (bậc 1–8), industry (sản xuất, sinh walker), storage (vựa, kho, xưởng)
  figures/    figure, movement, service (đi dạo, tuần đinh, thợ cả, lại thu thuế, tội phạm),
              cartpusher (xe bò, phu kho), market (người gánh chợ, bà bán chợ), migrant
  city/       labor, sentiment (+ tội phạm), finance, risk (cháy/sập), population (di cư)
  scenario/   demo.ts — thị trấn mẫu dùng cho test và ?demo=1
src/worker/   vòng lặp sim trong Worker, gửi snapshot
src/render/   iso.ts (hằng số ô, chiếu, neo, zIndex), chunks.ts, figures.ts, app.ts
src/ui/       Preact + signals: TopBar, BuildBar, InfoPanel, Advisors
src/main.ts   nối worker ↔ render ↔ ui
tests/        vitest chạy sim headless (cổng M2: tests/village, cổng M3: tests/city, cơ chế: tests/m3)
```

Quy tắc cố định từ M1: kích thước ô chỉ ghi ở `render/iso.ts`; điểm neo sprite công trình là góc dưới hình thoi móng; thứ tự vẽ `(x + y) × 8 + layer`; `roundPixels`, `scaleMode: nearest`, zoom 0,5× / 1× / 2×.

## Ghi chú M3 (chỗ khác hoặc rút gọn so với tài liệu thiết kế)

- Nhân công = 60% tổng dân (trừ quan lại) vì sim chưa có tuổi.
- Lòng dân cộng dồn như Julius nhưng có lực kéo về 60, nên một nguyên nhân xấu kéo dài đưa lòng dân về mức cân bằng thay vì tụt mãi về 0.
- Người gánh chợ một chuyến lấy mọi loại chợ đang thiếu mà nguồn đó có (tối đa 8 kiện).
- Người mộ phu thấy nhà thì công trình giữ quyền có người làm 200 ngày.
- Chưa làm: gộp 4 nhà 1×1 thành 2×2, gỗ làm vật liệu xây dựng, overlay cháy/sập/nước, lưu game.
