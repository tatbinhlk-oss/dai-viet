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

Thêm `?seed=123` vào URL để đổi bản đồ. Thêm `?demo=1` để mở thị trấn mẫu của test cổng M3/M4 (bản đồ phẳng, ~130 nhà, đủ 6 chuỗi xưởng, tuyến đê 160 đoạn với 8 trạm giữ đê) và xem nó tự chạy; bật nút **Vùng ngập** để thấy bãi bồi chưa có đê che (xanh) và đã có đê che (lục). `?look=7,70` đưa camera tới ô (x, y), ví dụ tới tuyến đê của thị trấn mẫu.

## Cột mốc

- [x] **M1 Lưới** — grid 160×160, sông và vùng ngập, đặt đường / lều tranh / phá, camera, lịch tick 50/ngày
- [x] **M2 Walker** — roamer, hauler, BFS; ruộng → xe bò → vựa → chợ → nhà; nhà bậc 1–5; dân nhập cư
- [x] **M3 Kinh tế** — 6 chuỗi xưởng + 9 nguyên liệu, kho 8 ngăn, lao động 9 ngành + người mộ phu, thuế + lại thu thuế, lòng dân + di cư hai chiều + tội phạm, nhà bậc 6–8, cháy/sập + tuần đinh/thợ cả; UI Preact (thanh xây theo nhóm, bảng công trình, cố vấn)
- [x] **M4 Lũ đê** — mùa lũ tháng 6–9 với đỉnh 1–4, nha môn dự báo, flood-fill theo cao độ + cao đê, đoạn đê và phu đê (lao dịch từ đình), độ bền và vỡ đê, hậu quả ngập theo loại ô, phù sa và bạc màu, cống, thuyền nan; UI: lớp phủ vùng ngập, bảng Thủy lợi, an toàn đê. Thiết kế: `docs/m4-thiet-ke.md`
- [ ] **M5 Triều đình** — 4 chỉ số, chiếu chỉ, tín ngưỡng, khoa cử
- [ ] **M6 Phát hành** — thương mại, giặc, 3 màn, art riêng, PWA

## Cấu trúc

```
src/data/     bảng cân bằng JSON — chỉnh số ở đây, không sửa code
  buildings.json  giá, nhân công, ngành, địa hình, độ hấp dẫn, walker, sản xuất, cháy/sập
  houses.json     10 bậc nhà, yêu cầu từng bậc, hệ số thuế (M3 mở tới bậc 8)
  economy.json    thuế, lương, lòng dân, di cư, chu kỳ walker, kho, chợ, mùa vụ
  resources.json  19 loại hàng
  flood.json      M4: mùa lũ, xác suất đỉnh, đê (công đắp, độ bền), hậu quả ngập, độ hấp dẫn, thuyền nan
src/sim/      mô phỏng — không import Pixi/DOM; tick.ts giữ lịch 50 việc/ngày (tick 26 = lũ)
  map/        grid, terrain, routing (BFS), desirability
  buildings/  defs (nạp JSON), spawn, house (bậc 1–8), industry (sản xuất, sinh walker), storage (vựa, kho, xưởng),
              dike (đoạn đê, cống: vẽ/tôn cao, đào đất, độ bền, vỡ)
  figures/    figure, movement, service (đi dạo, tuần đinh, thợ cả + kiểm tra đê, lại thu thuế, tội phạm),
              cartpusher (xe bò, phu kho; chọn thuyền khi đường thủy ngắn), market, migrant,
              levyWorker (phu đê), boat (thuyền nan, bến)
  city/       labor, sentiment (+ tội phạm, + lũ), finance, risk (cháy/sập), population (di cư)
  flood/      season (mùa lũ, dự báo, mực nước), floodFill (lan nước, vùng có đê che, khoảng cách tới sông),
              consequences (hậu quả ngập theo loại ô, phù sa, bạc màu)
  scenario/   demo.ts — thị trấn mẫu dùng cho test và ?demo=1; planDikeLine / legacyDike / dikeStation
src/worker/   vòng lặp sim trong Worker, gửi snapshot
src/render/   iso.ts (hằng số ô, chiếu, neo, zIndex), chunks.ts, figures.ts, app.ts
src/ui/       Preact + signals: TopBar (+ dòng lũ, an toàn đê), BuildBar (+ nhóm Đê điều, nút Vùng ngập), InfoPanel (+ đê, cống, ruộng), Advisors (+ Thủy lợi)
src/main.ts   nối worker ↔ render ↔ ui
tests/        vitest chạy sim headless (cổng M2: tests/village, cổng M3: tests/city, cổng M4: tests/flood, cơ chế: tests/m3, tests/m4)
```

Quy tắc cố định từ M1: kích thước ô chỉ ghi ở `render/iso.ts`; điểm neo sprite công trình là góc dưới hình thoi móng; thứ tự vẽ `(x + y) × 8 + layer`; `roundPixels`, `scaleMode: nearest`, zoom 0,5× / 1× / 2×.

## Ghi chú M3 (chỗ khác hoặc rút gọn so với tài liệu thiết kế)

- Nhân công = 60% tổng dân (trừ quan lại) vì sim chưa có tuổi.
- Lòng dân cộng dồn như Julius nhưng có lực kéo về 60, nên một nguyên nhân xấu kéo dài đưa lòng dân về mức cân bằng thay vì tụt mãi về 0.
- Người gánh chợ một chuyến lấy mọi loại chợ đang thiếu mà nguồn đó có (tối đa 8 kiện).
- Người mộ phu thấy nhà thì công trình giữ quyền có người làm 200 ngày.
- Chưa làm: gộp 4 nhà 1×1 thành 2×2, gỗ làm vật liệu xây dựng, overlay cháy/sập, lưu game.

## Ghi chú M4 (chỗ khác hoặc rút gọn so với thiết kế phần 5)

Luật giữ đúng thiết kế: lũ tháng 6–9, đỉnh 45/35/15/5, lên 24 – giữ 16 – rút 24 ngày, dự báo đúng 70% từ tháng 4 (cần nha môn có người làm), ô ngập khi cao độ + cao đê < mực nước, đê mòn (mực − cao + 1) × 2 mỗi ngày nước chạm, ngoài mùa −1 mỗi 4 ngày, thợ cả đặt lại 100, bảng hậu quả ngập, phù sa ×1,5, bạc màu −10% mỗi 5 năm, cống đóng/mở, độ hấp dẫn theo phần 7.

- **Đoạn đê là công trình 1×1** (`BuildingType.Dike`, `Sluice`); mức cao hữu hiệu ghi thêm vào `grid.dike` cho flood-fill. Vẽ lại lên đoạn có sẵn = tôn cao thêm một mức (tối đa 4). Tiền 0 quan (lao dịch); cống 40 quan. Đường đặt được lên đoạn đê (dốc qua đê) và ngược lại, nên tuyến đê không cắt mạng đường.
- **Phu đê**: mỗi đình làng (có người làm) cử một nhóm 20 người (`flood.json → dike.gangSize`) đi bộ trên đất tới đoạn đê trong tầm 80 ô, đắp 30 ngày-người cho mức đầu (kèm đào một ô bãi bồi trống gần nhất thành đất trũng, thấp đi 1), 20 ngày-người cho mỗi mức tôn cao; xong một mức thì sang đoạn **thấp nhất** gần đó để cả tuyến lên đều. Chưa có ngành lao động "lao dịch" (M5).
- **Mực nước** là số nguyên: lên `ceil(đỉnh × ngày / 24)`, rút đối xứng, nên lũ nhỏ không ngập ô nào trên bản đồ phẳng (không có đất cao độ 0).
- **Vỡ đê** xóa đoạn đê, ô thành đất trũng (cao độ −1): vẽ lại phải cao hơn 1 mức. Vỡ đê làm cả thành −3 lòng dân trong 6 kỳ (3 tháng); nhà ngập −3 trong 6 kỳ.
- **Giếng nhiễm bẩn** (chưa có chỉ số sức khỏe): 32 ngày cấp nước kém một bậc — giếng thường không có nước, giếng gạch như giếng thường.
- **Ngập**: xưởng, kho, chợ, công trình nguyên liệu mất hết hàng và tiến độ, ngừng sản xuất và sinh walker tới khi nước rút; vựa mất 50% lương thực; nhà tụt 1 bậc ngay, 50% dân bỏ đi, lều (bậc ≤ 1) bị xóa. Walker có việc không qua đường ngập; dân di cư và phu đê lội được qua ô ngập (để cửa ngõ ven sông không bị bịt mỗi mùa lũ).
- **Phù sa** ghi ở cuối mùa lũ (ngày 1 tháng 10): ruộng ngập mùa này ×1,5 tới hết mùa lũ sau; không ngập thì cộng một năm khô.
- **Thuyền nan**: bến thuyền 1×1 kề sông (4 người làm). Xe bò vừa sinh ở cửa công trình đổi thành thuyền khi cả hai đầu có bến trong 3 ô và đường thủy < đường bộ × 0,5 (hoặc không có đường bộ); 10 tick/ô; chở đúng số kiện xe bò đang mang (1), chưa gom 2 kiện.
- **Kịch bản mẫu**: thị trấn 1.000 dân dựng tức thời không kịp đắp 160 đoạn trước lũ năm 1, nên `buildTown` có đê cũ cao 2 (`legacyDike`) rồi vẽ tôn lên cao 4 cho phu đê đắp; 8 trạm giữ đê (trại thợ, điếm canh, hai lều có sẵn dân phu, giếng) cách nhau 20 ô dọc đường chân đê. Làng M2 dùng đê cũ cao 3. Test cổng M4 (`tests/flood.test.ts`) mỗi năm vẽ vá lại tuyến đê như người chơi; thêm bài ép đại hồng thủy (mức 4) khi đê đã xong.
- Chưa làm (để M5): ngành lao dịch, sự kiện kịch bản (Thượng nguồn mưa lớn, Hà đê sứ), Hà Bá, chỉ số Thịnh vượng/Trị an.
