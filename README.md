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

Thêm `?seed=123` vào URL để đổi bản đồ. `?scenario=sonNam` chơi màn Sơn Nam (mục tiêu, chiếu chỉ) trên bản đồ ngẫu nhiên; không có thì chơi tự do (không có thắng / hết hạn, vẫn có triều đình). Thêm `?demo=1` để mở màn Sơn Nam với thị trấn mẫu của test cổng M3/M4/M5 (bản đồ phẳng, ~130 nhà, đủ 6 chuỗi xưởng, tuyến đê 160 đoạn với 8 trạm giữ đê) và xem nó tự chạy; bật nút **Vùng ngập** để thấy bãi bồi chưa có đê che (xanh) và đã có đê che (lục). `?look=7,70` đưa camera tới ô (x, y), ví dụ tới tuyến đê của thị trấn mẫu.

## Cột mốc

- [x] **M1 Lưới** — grid 160×160, sông và vùng ngập, đặt đường / lều tranh / phá, camera, lịch tick 50/ngày
- [x] **M2 Walker** — roamer, hauler, BFS; ruộng → xe bò → vựa → chợ → nhà; nhà bậc 1–5; dân nhập cư
- [x] **M3 Kinh tế** — 6 chuỗi xưởng + 9 nguyên liệu, kho 8 ngăn, lao động 9 ngành + người mộ phu, thuế + lại thu thuế, lòng dân + di cư hai chiều + tội phạm, nhà bậc 6–8, cháy/sập + tuần đinh/thợ cả; UI Preact (thanh xây theo nhóm, bảng công trình, cố vấn)
- [x] **M4 Lũ đê** — mùa lũ tháng 6–9 với đỉnh 1–4, nha môn dự báo, flood-fill theo cao độ + cao đê, đoạn đê và phu đê (lao dịch từ đình), độ bền và vỡ đê, hậu quả ngập theo loại ô, phù sa và bạc màu, cống, thuyền nan; UI: lớp phủ vùng ngập, bảng Thủy lợi, an toàn đê. Thiết kế: `docs/m4-thiet-ke.md`
- [x] **M5 Triều đình** — Ân sủng, phẩm hàm và bổng lộc, tiến cống, cống nạp, chiếu chỉ 5 loại do sứ giả đem tới nha môn, lao dịch (ngành thứ 10), khoa cử, 4 tín ngưỡng với lễ hội và Tết, 4 chỉ số + sức khỏe, nhà quan lại bậc 9–10, màn chơi có mục tiêu và điều kiện thắng / cách chức; UI: bảng Nha môn, Tín ngưỡng, Chỉ số. Thiết kế: `docs/m5-thiet-ke.md`
- [ ] **M6 Phát hành** — thương mại, giặc, 3 màn, art riêng, PWA

## Cấu trúc

```
src/data/     bảng cân bằng JSON — chỉnh số ở đây, không sửa code
  buildings.json  giá, nhân công, ngành, địa hình, độ hấp dẫn, walker, sản xuất, cháy/sập
  houses.json     10 bậc nhà, yêu cầu từng bậc, hệ số thuế (M3 mở tới bậc 8)
  economy.json    thuế, lương, lòng dân, di cư, chu kỳ walker, kho, chợ, mùa vụ
  resources.json  19 loại hàng
  flood.json      M4: mùa lũ, xác suất đỉnh, đê (công đắp, độ bền), hậu quả ngập, độ hấp dẫn, thuyền nan
  court.json      M5: Ân sủng, phạt chiếu chỉ, binh dịch, lao dịch, tiến cống, phẩm hàm, cống nạp, khoa cử, tín ngưỡng, chỉ số, sức khỏe
  scenarios/      M5: màn chơi (son-nam.json): phẩm hàm, vốn, mục tiêu, chiếu chỉ theo năm, sự kiện
src/sim/      mô phỏng — không import Pixi/DOM; tick.ts giữ lịch 50 việc/ngày (tick 26 = lũ)
  map/        grid, terrain, routing (BFS), desirability
  buildings/  defs (nạp JSON), spawn, house (bậc 1–8), industry (sản xuất, sinh walker), storage (vựa, kho, xưởng),
              dike (đoạn đê, cống: vẽ/tôn cao, đào đất, độ bền, vỡ)
  figures/    figure, movement, service (đi dạo, tuần đinh, thợ cả + kiểm tra đê, lại thu thuế, tội phạm),
              cartpusher (xe bò, phu kho; chọn thuyền khi đường thủy ngắn), market, migrant,
              levyWorker (phu đê), boat (thuyền nan, bến)
  city/       labor (+ lao dịch), sentiment (+ tội phạm, lũ, lao dịch), finance, risk (cháy/sập), population (di cư),
              court (Ân sủng, chiếu chỉ, sứ giả, cống nạp, bổng lộc, tiến cống, khoa cử, cách chức), worship (4 tín ngưỡng, lễ hội, Tết),
              ratings (Văn hiến, Thịnh vượng, Trị an), health (sức khỏe, dịch)
  flood/      season (mùa lũ, dự báo, mực nước), floodFill (lan nước, vùng có đê che, khoảng cách tới sông),
              consequences (hậu quả ngập theo loại ô, phù sa, bạc màu)
  scenario/   demo.ts — thị trấn mẫu dùng cho test và ?demo=1; planDikeLine / legacyDike / dikeStation / buildCourtTown
              loader.ts (nạp màn), events.ts (mưa lớn, hà đê sứ, lệnh đắp đê), victory.ts (thắng / thua)
src/worker/   vòng lặp sim trong Worker, gửi snapshot
src/render/   iso.ts (hằng số ô, chiếu, neo, zIndex), chunks.ts, figures.ts, app.ts
src/ui/       Preact + signals: TopBar, BuildBar (khóa theo phẩm hàm), InfoPanel, Advisors (+ Thủy lợi, Nha môn, Tín ngưỡng, Chỉ số), YamenPanel
src/main.ts   nối worker ↔ render ↔ ui
tests/        vitest chạy sim headless (cổng M2: tests/village, M3: tests/city, M4: tests/flood, M5: tests/court; cơ chế: tests/m3, m4, m5)
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
- M5 đã làm tiếp: ngành lao dịch, sự kiện kịch bản (Thượng nguồn mưa lớn, Hà đê sứ, lệnh đắp đê), Hà Bá (Thủy thần), chỉ số Thịnh vượng/Trị an.

## Ghi chú M5 (chỗ khác hoặc rút gọn so với thiết kế phần 6–7)

Giữ đúng thiết kế: Ân sủng −2/năm, chiếu chỉ trễ lần đầu phạt theo loại (−3/−5/−3/−3/−2) và gia hạn 24 tháng, lần hai phạt thêm −2 rồi bỏ; cống nạp theo dân hoặc 25% lãi, không nộp khi ngân khố âm (−3/−5/−8); bổng lộc so phẩm hàm; tiến cống +3/+5/+10 giảm về 0 ở lần thứ tư trong 12 tháng; ≤ 10 bị thay sau 192 ngày; sứ giả tới nha môn tháng 2–9; lao dịch khóa 10/20/30% nhân công, lòng dân −1 khi > 20%; khoa cử 3 năm một lần, đỗ = học trò ÷ 200, +1 Ân sủng, +2 Văn hiến, 1/4 về làm quan bậc 9; 4 tín ngưỡng với bảng phù hộ / quở; lễ hội giá dân/20+10, dân/10+20, dân/5+40; Tết +7; Văn hiến 30/25/15/20/10 theo bao phủ; Thịnh vượng và Trị an theo năm với các số hạng trong bảng; sức khỏe ±2/tháng, dịch khi < 40.

- **Bao phủ đền** (mục tiêu tâm trạng thần) tính như religion coverage của Julius: số đền có người làm × 500 ÷ dân, không tính ông từ đi tới đâu — miếu ven sông không bao giờ đi tới khu dân cư được. Thần không để ý thành dưới 100 dân (tâm trạng giữ 50).
- **Sét giận**: mỗi tháng tâm trạng < 50 cộng 1 sét (< 35: 2, < 20: 3), ≥ 50 bớt 1; 20 quở nhỏ (một lần mỗi lần vượt), 50 quở lớn rồi về 0; ≥ 100 phù hộ rồi về 50. Tết không đặt lại bộ đếm lễ của thần nào.
- **Miếu Hà Bá, đàn tế Tiên nông** không cần người làm (như giếng), vẫn cử ông từ. Văn Miếu cần phẩm hàm Tuyên phủ sứ (5), tính là "đền" cho nhà bậc 10 và Văn hiến. Chưa có Quốc Tử Giám, đền thờ thành hoàng riêng (đình giữ vai này).
- **Nhà bậc 9–10** vẫn 1×1 (chưa gộp nhà) với sức chứa 40/90; bậc 10 cần "đền" (ông từ của miếu / Văn Miếu đi qua) thay cho "2 chùa + 1 đền". Quan đi kiệu +1 độ hấp dẫn 8 ngày quanh đường đi.
- **Binh dịch**: 1 kiện vũ khí cho 10 đinh; lính về theo dòng dân nhập cư (cộng vào hạn ngạch di cư). **Thuế vật** rút từ vựa / kho rồi 4 xe đi ra cửa ngõ (chỉ để nhìn). **Nghi lễ** và **đắp đê** tự hoàn thành khi đủ công trình / đoạn đê. **Lao dịch** chưa dùng phu đê của đình (M4), chỉ khóa nhân công và cộng ngày-người.
- **Trị an**: −1 mỗi công trình bị loạn dân đốt (đếm khi loạn dân châm lửa), không tính cháy / sập tự nhiên. Trị an và Thịnh vượng khởi đầu 0 như Caesar 3 nên ngưỡng màn đầu thấp (15/15).
- **Mốc dân 25/50/75%** của mục tiêu: đạt +5, quá năm mốc trong kịch bản mà chưa đạt −2 (một lần mỗi mốc).
- **Sức khỏe**: nhà khỏe = có thầy lang + lương thực (chưa có nước sạch); dịch làm một nhà mất nửa dân.
- **Chơi tự do** (không `?scenario`): vẫn có Ân sủng, Tết, cống nạp, tín ngưỡng nhưng không có chiếu chỉ, không thắng / hết hạn; vẫn bị cách chức.
- **Cổng M5** (`tests/court.test.ts`): màn Sơn Nam trên thị trấn mẫu với người chơi tự động (thuế 11%, thi hành chiếu chỉ, lễ hội khi thần < 45, tiến cống, vá đê) thắng ở năm 6 ≈ 1.150 ngày; ở 1× (2,5 s/ngày) là ~48 phút, ở 2× là 24 phút. Vốn màn 10.000 vì thị trấn mẫu dựng sẵn tốn ~8.900.
- Để M6: giặc giã, thuyền buôn (Thịnh vượng "≥ 4 chuyến"), Quốc Tử Giám, thăng phẩm hàm theo chuỗi màn, nạp màn từ nhiều file.
