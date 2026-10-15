# Đại Việt — city builder theo Caesar 3

Game xây thành phố kiểu Caesar 3 lấy bối cảnh Đại Việt, chạy trên web. Mô phỏng thuần TypeScript trong Web Worker, PixiJS 8 vẽ isometric 64×32 từ spritesheet, UI gửi lệnh vào sim.

Tài liệu thiết kế cơ chế (nhà, walker, chuỗi sản xuất, lũ và đê, triều đình, chỉ số) nằm trong Claude Project "Làm game".

## Chạy

```
npm install
npm run dev      # http://localhost:5173
npm test         # sim chạy headless
npm run build
npm run assets   # M6-0: sinh hình tạm vào assets/ rồi đóng gói public/sheets/ (chỉ cần khi đổi bảng công trình hoặc thay hình)
npm run maps     # M6b: sinh lại ba bản đồ màn chơi src/data/maps/*.json từ scripts/gen-maps.ts (chỉ cần khi sửa script)
npm run icons    # M6c: sinh icon PWA tạm public/icons/ (thay bằng icon vẽ thật thì bỏ)
```

Bản phát hành: **https://tatbinhlk-oss.github.io/dai-viet/** (GitHub Pages, tự dựng khi merge vào `main`). Là PWA: trình duyệt cho "Thêm vào màn hình chính" / cài như ứng dụng, chơi được offline sau lần mở đầu. Trên điện thoại: kéo một ngón dời bản đồ, chụm hai ngón zoom, chạm để đặt / xem. `?stress=1` mở thị trấn thử tải (~1.650 công trình, ~800 walker) để xem fps.

Thêm `?seed=123` vào URL để đổi bản đồ ngẫu nhiên (chơi tự do). Hộp chọn màn ở thanh trên (hoặc `?scenario=langVenSong|tranLi|sonNam|thangLong`) mở một màn chơi (bản đồ thật, mục tiêu, chiếu chỉ, giặc); màn kế mở khi thắng màn trước, phẩm hàm mang theo chuỗi màn ghi trong trình duyệt (`?rank=n` ghi đè để thử). Không có `?scenario` thì chơi tự do (không có thắng / hết hạn, vẫn có triều đình). Thêm `?demo=1` để mở màn Sơn Nam với thị trấn mẫu của test cổng M3/M4/M5 (bản đồ phẳng, ~130 nhà, đủ 6 chuỗi xưởng, tuyến đê 160 đoạn với 8 trạm giữ đê) và xem nó tự chạy; bật nút **Vùng ngập** để thấy bãi bồi chưa có đê che (xanh) và đã có đê che (lục). `?look=7,70` đưa camera tới ô (x, y), ví dụ tới tuyến đê của thị trấn mẫu.

## Cột mốc

- [x] **M1 Lưới** — grid 160×160, sông và vùng ngập, đặt đường / lều tranh / phá, camera, lịch tick 50/ngày
- [x] **M2 Walker** — roamer, hauler, BFS; ruộng → xe bò → vựa → chợ → nhà; nhà bậc 1–5; dân nhập cư
- [x] **M3 Kinh tế** — 6 chuỗi xưởng + 9 nguyên liệu, kho 8 ngăn, lao động 9 ngành + người mộ phu, thuế + lại thu thuế, lòng dân + di cư hai chiều + tội phạm, nhà bậc 6–8, cháy/sập + tuần đinh/thợ cả; UI Preact (thanh xây theo nhóm, bảng công trình, cố vấn)
- [x] **M4 Lũ đê** — mùa lũ tháng 6–9 với đỉnh 1–4, nha môn dự báo, flood-fill theo cao độ + cao đê, đoạn đê và phu đê (lao dịch từ đình), độ bền và vỡ đê, hậu quả ngập theo loại ô, phù sa và bạc màu, cống, thuyền nan; UI: lớp phủ vùng ngập, bảng Thủy lợi, an toàn đê. Thiết kế: `docs/m4-thiet-ke.md`
- [x] **M5 Triều đình** — Ân sủng, phẩm hàm và bổng lộc, tiến cống, cống nạp, chiếu chỉ 5 loại do sứ giả đem tới nha môn, lao dịch (ngành thứ 10), khoa cử, 4 tín ngưỡng với lễ hội và Tết, 4 chỉ số + sức khỏe, nhà quan lại bậc 9–10, màn chơi có mục tiêu và điều kiện thắng / cách chức; UI: bảng Nha môn, Tín ngưỡng, Chỉ số. Thiết kế: `docs/m5-thiet-ke.md`
- [ ] **M6 Phát hành** — thiết kế: `docs/m6-thiet-ke.md`
  - [x] **M6-0** khung spritesheet: hình tạm có nhãn tên sinh bằng script, đóng gói `public/sheets`, render công trình / walker / đất nền bằng Sprite, nút "Hiện tên"
  - [x] **M6a** thương mại (2 tuyến, hạn ngạch 15/25/40, lệnh mua bán, đoàn buôn và thuyền buôn), giặc giã (3 nguồn theo kịch bản, trại lính, thành đất / đá), lưu game (IndexedDB tự lưu mỗi tháng, xuất / nhập .dvsav)
  - [x] **M6b** 3 màn chơi mới (Làng ven sông → Trấn lị → Thăng Long, cộng Sơn Nam thành chuỗi 4 màn) trên bản đồ nạp từ file, chuỗi phẩm hàm thăng theo màn, đất cấp theo phẩm hàm, Quốc Tử Giám, tính cách vua, lũ riêng từng màn
  - [x] **M6c** PWA (manifest, service worker, offline), điều khiển cảm ứng, bố cục điện thoại, câu thoại walker, khung âm thanh (chưa có file), thị trấn thử tải; hình vẽ thật và âm thanh chờ nguồn (xem Ghi chú M6c)

## Cấu trúc

```
src/data/     bảng cân bằng JSON — chỉnh số ở đây, không sửa code
  buildings.json  giá, nhân công, ngành, địa hình, độ hấp dẫn, walker, sản xuất, cháy/sập
  houses.json     10 bậc nhà, yêu cầu từng bậc, hệ số thuế (M3 mở tới bậc 8)
  economy.json    thuế, lương, lòng dân, di cư, chu kỳ walker, kho, chợ, mùa vụ
  resources.json  19 loại hàng
  flood.json      M4: mùa lũ, xác suất đỉnh, đê (công đắp, độ bền), hậu quả ngập, độ hấp dẫn, thuyền nan
  court.json      M5: Ân sủng, phạt chiếu chỉ, binh dịch, lao dịch, tiến cống, phẩm hàm, cống nạp, khoa cử, tín ngưỡng, chỉ số, sức khỏe
  trade.json      M6a: giá mua bán, hạn ngạch, hai tuyến buôn, số giặc giã (máu, đòn, thành)
  scenarios/      màn chơi, mỗi màn một file (nạp bằng import.meta.glob): bản đồ, phẩm hàm, vốn, mục tiêu, chiếu chỉ theo năm, sự kiện,
                  tuyến buôn, giặc; M6b: order (thứ tự chuỗi), king (vua), flood.peakChances, promoteTo — lang-ven-song, tran-li, son-nam, thang-long
  maps/           M6b: bản đồ thật (160 dòng × 160 ký tự: ~ nước, 0–4 cao độ, t/T cây) + cửa ngõ, cửa sông, mép giặc, đất cấp theo phẩm hàm
src/sim/      mô phỏng — không import Pixi/DOM; tick.ts giữ lịch 50 việc/ngày (tick 26 = lũ)
  map/        grid, terrain (bản đồ ngẫu nhiên / phẳng), mapfile (M6b: nạp bản đồ từ file, đất cấp theo phẩm hàm), routing (BFS), desirability
  buildings/  defs (nạp JSON), spawn, house (bậc 1–8), industry (sản xuất, sinh walker), storage (vựa, kho, xưởng),
              dike (đoạn đê, cống: vẽ/tôn cao, đào đất, độ bền, vỡ)
  figures/    figure, movement, dialogue (M6c: câu thoại walker khi bấm), service (đi dạo, tuần đinh, thợ cả + kiểm tra đê, lại thu thuế, tội phạm),
              cartpusher (xe bò, phu kho; chọn thuyền khi đường thủy ngắn), market, migrant,
              levyWorker (phu đê), boat (thuyền nan, bến), trader (đoàn buôn, thuyền buôn), enemy (giặc, lính)
  city/       labor (+ lao dịch), sentiment (+ tội phạm, lũ, lao dịch), finance, risk (cháy/sập), population (di cư),
              court (Ân sủng, chiếu chỉ, sứ giả, cống nạp, bổng lộc, tiến cống, khoa cử, cách chức), worship (4 tín ngưỡng, lễ hội, Tết),
              ratings (Văn hiến, Thịnh vượng, Trị an), health (sức khỏe, dịch), trade (tuyến buôn, hạn ngạch, mua bán), war (giặc, lính)
  flood/      season (mùa lũ, dự báo, mực nước), floodFill (lan nước, vùng có đê che, khoảng cách tới sông),
              consequences (hậu quả ngập theo loại ô, phù sa, bạc màu)
  scenario/   demo.ts — thị trấn mẫu dùng cho test và ?demo=1; planDikeLine / legacyDike / dikeStation / buildCourtTown
              list.ts (danh sách màn từ mọi file, không kéo sim — UI dùng), loader.ts (nạp màn + bản đồ), events.ts (mưa lớn, hà đê sứ, lệnh đắp đê),
              victory.ts (thắng / thua, phong phẩm hàm, cấp thêm đất)
src/sim/save.ts  M6a: state ↔ JSON (TypedArray base64) ↔ gzip; worker lưu IndexedDB và xuất / nhập file
src/worker/   vòng lặp sim trong Worker, gửi snapshot, tự lưu mỗi tháng
src/render/   iso.ts (hằng số ô, chiếu, neo, zIndex), sheets.ts (nạp spritesheet), chunks.ts (đất nền theo chunk, công trình), figures.ts, palette.ts (màu khối dự phòng),
              app.ts (camera, chuột + cảm ứng), audio.ts (M6c: khung âm thanh)
assets/       PNG nguồn: buildings/, houses/, ground/, figures/ (hình tạm do scripts/gen-placeholders.ts sinh; thay hình thật = thả PNG cùng tên), fonts/
public/sheets/ spritesheet đã đóng gói (scripts/pack-sprites.ts): <nhóm>.png + .json, mỗi frame có anchor (0.5, 1) và footprint
scripts/      gen-placeholders.ts, pack-sprites.ts (chạy bằng tsx, vẽ bằng @napi-rs/canvas), gen-maps.ts (M6b: sinh ba bản đồ màn chơi), gen-icons.ts (M6c: icon PWA)
public/icons/ icon PWA; public/sounds/ (chưa có) — thả file âm thanh vào là phát (xem Ghi chú M6c)
src/ui/       Preact + signals: TopBar (+ hộp chọn màn), BuildBar (khóa theo phẩm hàm), InfoPanel, Advisors (+ Thủy lợi, Nha môn, Tín ngưỡng, Chỉ số), YamenPanel
src/main.ts   nối worker ↔ render ↔ ui
tests/        vitest chạy sim headless (cổng M2: tests/village, M3: tests/city, M4: tests/flood, M5: tests/court, M6b: tests/m6b; cơ chế: tests/m3, m4, m5, m6a, m6c, sprites; helpers.ts = người chơi tự động)
```

Quy tắc cố định từ M1: kích thước ô chỉ ghi ở `render/iso.ts`; điểm neo sprite công trình là góc dưới hình thoi móng, anchor (0.5, 1), công trình N×N rộng đúng N×64 px; thứ tự vẽ `(x + y) × 8 + layer`; `roundPixels`, `scaleMode: nearest`, không mip-map, zoom 0,5× / 1× / 2×.

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
- **Miếu Hà Bá, đàn tế Tiên nông** không cần người làm (như giếng), vẫn cử ông từ. Văn Miếu cần phẩm hàm bậc 5 (M6b hạ xuống bậc 4 Tuyên phủ sứ), tính là "đền" cho nhà bậc 10 và Văn hiến. Chưa có Quốc Tử Giám, đền thờ thành hoàng riêng (đình giữ vai này).
- **Nhà bậc 9–10** vẫn 1×1 (chưa gộp nhà) với sức chứa 40/90; bậc 10 cần "đền" (ông từ của miếu / Văn Miếu đi qua) thay cho "2 chùa + 1 đền". Quan đi kiệu +1 độ hấp dẫn 8 ngày quanh đường đi.
- **Binh dịch**: 1 kiện vũ khí cho 10 đinh; lính về theo dòng dân nhập cư (cộng vào hạn ngạch di cư). **Thuế vật** rút từ vựa / kho rồi 4 xe đi ra cửa ngõ (chỉ để nhìn). **Nghi lễ** và **đắp đê** tự hoàn thành khi đủ công trình / đoạn đê. **Lao dịch** chưa dùng phu đê của đình (M4), chỉ khóa nhân công và cộng ngày-người.
- **Trị an**: −1 mỗi công trình bị loạn dân đốt (đếm khi loạn dân châm lửa), không tính cháy / sập tự nhiên. Trị an và Thịnh vượng khởi đầu 0 như Caesar 3 nên ngưỡng màn đầu thấp (15/15).
- **Mốc dân 25/50/75%** của mục tiêu: đạt +5, quá năm mốc trong kịch bản mà chưa đạt −2 (một lần mỗi mốc).
- **Sức khỏe**: nhà khỏe = có thầy lang + lương thực (chưa có nước sạch); dịch làm một nhà mất nửa dân.
- **Chơi tự do** (không `?scenario`): vẫn có Ân sủng, Tết, cống nạp, tín ngưỡng nhưng không có chiếu chỉ, không thắng / hết hạn; vẫn bị cách chức.
- **Cổng M5** (`tests/court.test.ts`): màn Sơn Nam trên thị trấn mẫu với người chơi tự động (thuế 11%, thi hành chiếu chỉ, lễ hội khi thần < 45, tiến cống, vá đê) thắng ở năm 6 ≈ 1.150 ngày; ở 1× (2,5 s/ngày) là ~48 phút, ở 2× là 24 phút. Vốn màn 10.000 vì thị trấn mẫu dựng sẵn tốn ~8.900.
- Để M6: giặc giã, thuyền buôn (Thịnh vượng "≥ 4 chuyến"), Quốc Tử Giám, thăng phẩm hàm theo chuỗi màn, nạp màn từ nhiều file.

## Ghi chú M6-0 (khung spritesheet tạm)

- **Thay hình thật**: thả PNG cùng tên vào `assets/buildings/<khóa>.png` (khóa trong buildings.json; đống tro `ruins_1..3`), `assets/houses/house_l0..10.png`, `assets/ground/` (grass0–4, floodplain, water, road, floor, sunken, flooded, overlay_*, tree, dike0–4, dike0–4_road, sluice0–4_open/closed), `assets/figures/<loại>_<ne|se|sw|nw>_<0–3>.png` (+ `_full_` cho xe bò, phu kho, đoàn xe, thuyền; `cargo_<hàng>.png` 10×5), xóa tên file khỏi `assets/placeholders.json` (chạy lại `assets:gen` sẽ ghi đè hình tạm — khi đã có hình thật chỉ chạy `assets:pack`), rồi `npm run assets:pack`. Code không đổi; thay dần từng loại được, frame nào thiếu thì vẽ khối màu như trước.
- **Đất nền** vẽ bằng ParticleContainer theo chunk 16×16 (một texture chung là sheet ground), chỉ dựng lại chunk có ô đổi; đê và cống vẽ ở lớp đất (frame theo mức cao, có/không đường vắt qua, cống đóng/mở). Công trình và walker là Sprite trong một container sắp theo `(x + y) × 8 + layer`, nên walker đi sau nhà bị che đúng.
- **"Hiện tên"**: nhãn Pixi chỉ vẽ lên frame có hình thật (hình tạm đã có nhãn trong PNG, không vẽ đè); mặc định bật khi sheet còn hình tạm, tắt khi đã thay hết. Nhãn, nút, ô chữ không bo góc.
- Font nhãn tạm: DejaVu Sans Bold (`assets/fonts`, giấy phép Bitstream Vera cho phép phân phối). Sprite Caesar 3 không đưa vào repo; `assets/extracted/` nằm trong .gitignore.
- `tests/sprites.test.ts` kiểm mọi loại công trình / bậc nhà / đê / walker có frame, anchor (0.5, 1), rộng N×64, footprint đúng.

## Ghi chú M6a (chỗ khác hoặc rút gọn so với thiết kế)

- **Thương mại**: hai tuyến trong `trade.json` — bộ lên miền núi (đoàn buôn tới kho, 8 kiện/chuyến, 48 ngày một chuyến; lái buôn mua muối, vải; bán quặng đồng, quặng sắt, gỗ) và sông ra biển (thuyền buôn tới bến cảng, 12 kiện, 64 ngày; mua lụa, gốm, trà; bán đồ đồng). Hương liệu, trâu, gỗ quý chưa có trong bảng hàng (không có nhà / xưởng dùng) — để M6b/M6c nếu cần. Mở tuyến tốn tiền một lần (400 / 800); hạn ngạch mỗi mặt hàng bắt đầu mức 15, đầu năm mua bán đủ 80% thì lên 25 rồi 40. Giá theo tỉ lệ Caesar 3 (lụa 215/160, gốm 180/140, gạo 28/22…). Lệnh Mua / Bán theo mặt hàng ở bảng Thương mại; lái buôn mua bán tại kho có người làm gần nhất (thuyền: kho gần bến cảng nhất theo đường bộ), hàng vào thẳng kho. Màn Sơn Nam mở được cả hai tuyến; chơi tự do cũng vậy.
- **Giặc giã**: sự kiện kịch bản `invasion` (sea / south / north, số tên), báo trước 2 tháng. Giặc là walker người ngoài: tới công trình gần nhất (không qua thành), đứng 40 tick thì đốt (thành đống tro), mỗi tên phá tối đa 3 công trình rồi rút về mép; bị thành chặn thì phá thành (thành đất 3 đòn, thành đá 8 đòn, 80 tick một đòn). Trại lính là xưởng nhận vũ khí (xe bò chở tới như nguyên liệu): mỗi kiện một lính, tối đa 4; lính đứng ở cửa trại, giặc trong tầm 30 ô thì tới đánh, đứng cạnh nhau thì cứ 10 tick đổi đòn (lính 15, giặc 10, máu 100). Không có đội hình, tường thành không có cổng (chừa lỗ hổng). Trị an đếm công trình giặc đốt (không tính lều, điếm canh). Quân "cách chức" của M5 chưa dùng cơ chế này.
- **Lưu game**: `src/sim/save.ts` chuyển state thành JSON (TypedArray mã hóa base64, Set `dirty` không lưu) rồi gzip bằng CompressionStream; worker lưu IndexedDB khe `auto` mỗi tháng game và khe `manual` khi bấm Lưu; Xuất / Nhập file `.dvsav` (gzip JSON). Sự kiện kịch bản chuyển vào state (`scenarioEvents`) để lưu được. `tests/m6a.test.ts`: lưu → nạp → chạy 1 năm cho kết quả y hệt.
- **Gộp nhà 2×2 / 3×3**: chưa làm (để M6b).

## Ghi chú M6b (chỗ khác hoặc rút gọn so với thiết kế)

- **Chuỗi màn** gồm 4 màn (tài liệu ghi 3, cộng màn Sơn Nam có sẵn): 1. Làng ven sông (Tri huyện, vốn 6.000, dân 500, vua sùng Phật, không giặc, lũ chỉ nhỏ / vừa, chỉ tuyến buôn miền núi) → 2. Trấn lị (Tri phủ, 8.000, dân 1.500, vua hiếu chiến, giặc Chiêm và cướp biển) → 3. Lộ Sơn Nam (An phủ sứ, như M5, vua trọng Nho) → 4. Thăng Long (Tuyên phủ sứ, 15.000, dân 3.000, vua trọng Nho, lũ lớn hơn 35/35/20/10, quân Bắc / Chiêm / cướp biển). Thắng màn → phong phẩm hàm ghi trong màn (`promoteTo`, ít nhất +1), màn kế mở; thắng Thăng Long → Hành khiển (bậc 5), ba bậc Thượng thư / Tư đồ / Thái úy để dành cho màn sau. Tiến độ chuỗi (phẩm hàm, màn đã thắng) ghi `localStorage`, nút ⟲ cạnh hộp chọn màn để xóa. Màn ghi thêm file vào `src/data/scenarios/` là có (nạp bằng `import.meta.glob`, `order` xếp vào chuỗi).
- **Bản đồ thật**: `src/data/maps/*.json` do `scripts/gen-maps.ts` sinh (sông, hồ, gò đồi đặt tay; cao độ nền theo khoảng cách tới sông + nhiễu tất định), sửa tay file cũng được. File ghi cao độ từng ô, cửa ngõ (dân, đoàn buôn), cửa sông (thuyền buôn, cướp biển), mép giặc từng nguồn, và `land` = đất cấp theo phẩm hàm; bãi bồi suy ra khi nạp (đất cao ≤ 1 nối sông). Chưa có cầu: sông chia bản đồ, phải xây cùng bờ với cửa ngõ. Ô 160×160 vẫn cố định.
- **Đất cấp theo phẩm hàm** ("phẩm hàm cao được cấp nhiều đất hơn"): cờ `T_RESERVED` — không xây được (đường cũng không), vẽ phủ tối, walker vẫn đi qua; lên phẩm hàm (thắng màn, chơi tiếp trên cùng bản đồ) thì mở thêm. Làng ven sông cấp ô vuông 79×83 giữa bản đồ, Trấn lị 77×89, Thăng Long cả bản đồ.
- **Phẩm hàm mở công trình** nay kiểm cả trong sim (lệnh xây bị bỏ qua), không chỉ ở nút: Quốc Tử Giám và Văn Miếu cần bậc 4 (Tuyên phủ sứ — hạ từ 5 để mở ở Thăng Long), thành đá bậc 3 (hạ từ 4 để mở từ Sơn Nam). Màn chỉ mở được tuyến buôn ghi trong kịch bản (kiểm trong sim).
- **Quốc Tử Giám** 3×3, 600 quan, 20 người làm, thầy giáo đi dạo tầm 80 phủ `academy` như trường học; tính Văn hiến cùng nhóm trường học (chung sức chứa / điểm), mở được khoa thi. Chưa có thủ thư riêng.
- **Tính cách vua** (`court.json` → `king`): sùng Phật (mỗi năm +2 Ân sủng nếu đủ 1 chùa có người làm / 500 dân, thiếu −2; chiếu chỉ lễ nghi +2), trọng Nho (1 trường học / 1.000 dân; mỗi người đỗ +1 Ân sủng; lễ nghi +1), hiếu chiến (1 trại lính có người làm / 1.000 dân; binh dịch +3). Vua không để ý khi dân dưới ngưỡng (100 / 300 / 300). Thiết kế chỉ nêu ba tính cách, số là tự đặt.
- **Lũ riêng từng màn**: `flood.peakChances` trong file màn ghi đè `flood.json` (màn đầu không có lũ lớn / đại hồng thủy).
- **Lưu game** lên phiên bản 2 (cửa sông, mép giặc, vua, đất cấp, màn kế); bản 1 vẫn nạp được (điền mặc định).
- **Cổng M6b** (`tests/m6b.test.ts`): người chơi tự động thắng Làng ven sông ở năm 4 trên thị trấn mẫu (bản đồ phẳng, dựng sẵn không tính tiền vì vốn 6.000 không đủ đặt một lúc); màn trên bản đồ thật chạy được (dân tới, lũ về). Chưa có test tự chơi trên bản đồ thật (thị trấn mẫu gắn tọa độ bản đồ phẳng).
- **Chưa làm**: gộp nhà 2×2 / 3×3, hương liệu / trâu / gỗ quý, cầu qua sông, cổng thành; "Vua" chưa đổi chiếu chỉ theo tính cách (chiếu chỉ vẫn theo file màn).

## Ghi chú M6c (PWA, điện thoại, phát hành)

- **Hình vẽ và âm thanh thật chưa có nguồn** (Bình quyết sau: thuê vẽ, mua asset có giấy phép, hay tự vẽ). Năm điểm kỹ thuật về hình giữ nguyên từ M1; thay hình = thả PNG vào `assets/` rồi `npm run assets:pack` (Ghi chú M6-0). Âm thanh: `src/render/audio.ts` phát file `public/sounds/<khóa>.ogg` (hoặc `.mp3`) nếu có, thiếu thì im lặng — khóa: `click` (đặt công trình), `raze`, `flood` (lũ về), `fire`, `invasion`, `win`, `lose`, `edict` (chiếu chỉ tới), `festival` (lễ hội, Tết), `ambient` (nền lặp). Tiếng theo sự kiện đoán từ dòng chữ sự kiện của sim (`soundForEvent`). Nút 🔊 / 🔇 ở thanh trên, nhớ trong `localStorage`; trình duyệt chỉ cho phát sau cử chỉ đầu tiên.
- **PWA**: `vite-plugin-pwa` (manifest `Đại Việt`, `display: fullscreen`, `orientation: landscape`, icon tạm do `scripts/gen-icons.ts` vẽ), service worker workbox precache mọi file build + spritesheet (~1,1 MB), `registerType: autoUpdate` (có bản mới thì lần mở sau tự cập nhật). `base` theo `GITHUB_PAGES` nên start_url / scope là `/dai-viet/` trên Pages.
- **Cảm ứng** (`render/app.ts`, pointer events với `pointerType === 'touch'`, canvas `touch-action: none`): một ngón kéo = dời bản đồ (không vẽ đường liên tục như kéo chuột trái); hai ngón = dời theo điểm giữa + chụm zoom (mỗi lần khoảng cách gấp √2 đổi một mức 0,5× / 1× / 2×); chạm nhanh (< 0,5 s, < 10 px) = đặt / xem tại ô. Chuột giữ nguyên.
- **Bố cục hẹp** áp dụng khi rộng ≤ 700 px *hoặc cao ≤ 520 px* (điện thoại nằm ngang): các hàng nút cuộn ngang thay vì xuống dòng, ẩn fps, bảng nằm dưới. Đã kiểm bằng Chromium giả lập iPhone 13 (ảnh chụp, chạm, kéo, chụm); chưa kiểm trên máy thật.
- **Câu thoại walker**: công cụ Xem bấm vào ô có walker (ô có công trình thì ưu tiên công trình) → thẻ tên + câu thoại theo trạng thái (`sim/figures/dialogue.ts`): xe bò / phu kho / thuyền nói đang chở gì tới đâu hay vì sao đứng chờ, dân đến / bỏ đi nói lý do, lái buôn nói tuyến, giặc, lính… Snapshot mang `selectedFigure`.
- **Hiệu năng**: `tests/m6c.test.ts` dựng thị trấn thử tải (thị trấn mẫu + dải phố, 1.657 công trình, tới ~830 walker, 4.000 dân): sim ≈ 0,9 ms/tick trên máy test (ngân sách 50 ms ở 1×, 16 ms ở 3×). FPS vẽ phải xem trên máy thật (`?stress=1`); Chromium headless không GPU ở máy test chỉ 14–18 fps nên không kết luận được.
- **Kéo vẽ đường / đê / cống / thành** (`render/line.ts`) kiểu Caesar 3: bấm giữ chuột trái ở điểm đầu, kéo thì hiện mờ đoạn từ điểm đầu tới con trỏ — đi thẳng theo trục lệch nhiều hơn rồi gấp khúc đúng một lần — thả chuột mới xây (một gói lệnh `cmds`, một snapshot), Esc để bỏ. Không còn đặt liên tục theo vệt chuột với các loại này (công trình 1×1 khác như lều, giếng vẫn đặt theo vệt kéo). Trên cảm ứng, một ngón kéo vẫn là dời bản đồ nên đường / đê đặt từng ô bằng chạm.
- **Phát hành**: GitHub Pages như đã chốt; chưa có itch.io / tên miền riêng.

## Ghi chú QoL (tiện ích theo Caesar 3, sau M6c)

- **Lớp phủ thông tin** (`src/sim/overlay.ts`, hộp "Lớp phủ" ở thanh xây): Có vấn đề, Vùng ngập (M4), Nước, Lương thực, Cháy, Sập, Tội phạm, Độ hấp dẫn, Thuế, Tín ngưỡng, Học hành, Y tế, Giải trí. Sim tính một byte mỗi ô cho chế độ đang bật và gửi kèm snapshot (0 không tô; 1–100 đỏ, 101–200 lục, 201 vàng = công trình cung cấp); render tô ô trắng tint theo giá trị trong một lớp ParticleContainer riêng mỗi chunk (chỉ dựng lại chunk có giá trị đổi) và làm mờ công trình (alpha 0,3) để thấy màu ô. Vùng ngập vẫn tô theo cờ địa hình như M4.
- **Đặt công trình**: khung đặt tô lục khi đặt được, đỏ khi không (`src/sim/buildings/placement.ts` — kiểm địa hình ngay trên lưới render, cùng quy tắc với sim, test tương đương); dòng trạng thái ghi tên, giá và lý do (dưới nước, đã có công trình, phải kề sông, không đủ tiền, cần phẩm hàm…); lệnh bị từ chối thì worker báo lý do. Lều, vườn, ao sen và Phá kéo theo vùng chữ nhật (như Caesar 3), các công trình khác mỗi lần bấm đặt một cái (bỏ kiểu đặt theo vệt chuột). Phá ≥ 1 công trình từ 150 quan thì hỏi lại. **Hoàn tác** (nút hoặc Ctrl+Z) bỏ các công trình / đường của lần xây gần nhất trong cùng ngày game và trả tiền (`src/sim/undo.ts`); nhà đã có dân thì giữ; phá không hoàn tác được.
- **Màn giới thiệu nhiệm vụ** (`Briefing` trong `App.tsx`): vào màn (`?scenario=`) thì sim dừng và hiện tên màn, phẩm hàm, tính cách vua, mô tả (từ file màn), bảng mục tiêu hiện / cần, hạn năm; bấm Bắt đầu mới chạy. Nút **Nhiệm vụ** ở thanh trên mở lại. Chơi tự do và `?demo` không có.
- **Cố vấn tổng quan** (bảng "Tổng quan", `src/sim/city/overview.ts`): bảng mục tiêu, danh sách vấn đề đỏ / vàng (ngân khố âm, sắp bị cách chức, Ân sủng thấp, chiếu chỉ sắp hết hạn, giặc sắp tới, lòng dân thấp, thất nghiệp, thiếu nhân công theo ngành, nhà đói / không lương thực / không nước, công trình có vấn đề, đê yếu / chưa đắp / nhà trên bãi bồi chưa có đê che trong mùa lũ, vỡ đê, thần giận) mỗi mục có nút → tới chỗ, và 12 tin mới nhất.
- **Sự kiện có vị trí**: `logEvent(s, text, at)` (`src/sim/log.ts`) thay mọi `events.push`; `eventAt` song song với `events`, cắt bớt cùng nhau, bản lưu cũ điền −1. Cháy, sập, vỡ đê, dịch, trộm / loạn dân, giặc tới / đốt / phá thành ghi ô; danh sách sự kiện ở Dân tình, Nha môn, Tổng quan có nút → đưa camera tới.
- **Bản đồ thu nhỏ** (`src/render/minimap.ts`): vẽ trong Pixi (sprite HUD từ canvas 2D 160×160, 1 px một ô; lưới vuông, trục x sang phải, y xuống), cập nhật ~4 lần/giây (chỉ vẽ lại nền khi lưới đổi), khung trắng là vùng đang nhìn, bấm / kéo (chuột hoặc chạm) để dời camera; phím M ẩn / hiện; màn hẹp thu còn 96 px. Lúc đầu làm bằng `<canvas>` DOM đè lên canvas WebGL thì Chromium bỏ vẽ một vùng của canvas game (ô trống góc trên phải), nên chuyển vào Pixi.
- **Phím tắt** (`src/ui/hotkeys.ts`, bảng Cài đặt liệt kê): mũi tên / WASD dời bản đồ, P tạm dừng, + − tốc độ, 1…9 lớp phủ và 0 tắt, M bản đồ thu nhỏ, N hiện tên, R / H / X / Q công cụ đường / lều / phá / xem, T bảng Tổng quan, Ctrl+Z hoàn tác, Esc bỏ đoạn đang kéo và đóng bảng, F1 Cài đặt. Space vẫn là giữ để kéo bản đồ. Không bắt phím khi đang gõ vào ô nhập.
- **Cài đặt** (bảng "Cài đặt", ghi `localStorage`): âm lượng (GainNode chung), bật / tắt tiếng, cỡ chữ giao diện (biến CSS `--ui-scale`), bản đồ thu nhỏ, hiện tên công trình.
- **Lưu / Nạp nhiều khe** (`src/ui/SavesPanel.tsx`, nút Lưu / Nạp hoặc phím L): khe Tự lưu (mỗi tháng game), Lưu nhanh (F5 / F9), 8 khe đặt tên; mỗi khe ghi màn, năm tháng, dân, giờ lưu (chỉ mục JSON trong IndexedDB khóa `index`); Xuất / Nhập file `.dvsav` nằm trong hộp này.
- **Kho "Dọn hết"** (chính sách thứ tư, chỉ kho): phu kho chở từng kiện sang kho / vựa khác còn nhận, kho không nhận thêm mặt hàng đó (`StorePolicy.Empty`).
- **Tạm đóng cửa** (nút trong bảng Xem với công trình có người làm): không tính vào nhu cầu nhân công, người làm về 0, không chạy, không bị coi là có vấn đề; vẫn cháy / sập; mở lại thì nhận người như thường (`setMothball`).
- **Biểu đồ theo tháng** (`src/ui/Spark.tsx`): sim ghi dân, ngân khố, Ân sủng mỗi đầu tháng (tối đa 240 tháng, lưu trong state) — hiện ở Dân tình, Tài chính, Nha môn.
- **Hướng dẫn màn đầu** (`src/sim/scenario/tutorial.ts`): 9 bước (đường, lều, giếng, đình, ruộng + vựa + chợ, điếm canh + trại thợ, đê, chùa + nha môn, dân lên bậc) tự đánh dấu xong theo trạng thái; hiện ở màn nhiệm vụ và Tổng quan, chỉ với màn có `order` 1.
- **Vùng phục vụ**: chọn giếng / giếng gạch thì vẽ ô vuông tầm cấp nước quanh móng (`setRange`); walker đi dạo theo đường nên không vẽ tầm.
- **Công trình có vấn đề** (`buildingProblem`): đang ngập, đói (nhà), không kề đường, không có nhà ở gần để mộ phu, không có / thiếu người làm, hết nguyên liệu, sắp cháy / sập. Vẽ biểu tượng ⚠ đỏ trên công trình (snapshot gửi danh sách ô neo), bảng Xem ghi lý do, lớp phủ "Có vấn đề" tô đỏ. Nhà, đê, thành, đống tro không tính (trừ ngập / đói).
