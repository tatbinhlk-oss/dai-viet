# M5 Triều đình — tài liệu thiết kế cho phiên code

Trích từ tài liệu thiết kế "City builder Đại Việt" (project "Làm game"): toàn bộ phần 6 (Triều đình) và phần 7 (Bốn chỉ số), các dòng liên quan ở phần 2, 3, 5, 8, 9, cộng tình trạng code sau M4. Làm M5 đúng theo đây; chỗ nào phải đổi thì ghi lại lý do trong README như M3, M4 đã làm.

## Trạng thái code sau M4

- M1–M4 xong. Đọc README.md (có ghi chú M3, M4) và `docs/m4-thiet-ke.md` trước.
- Số cân bằng nằm trong `src/data/*.json`. M5 nên thêm `src/data/court.json` (Ân sủng, chiếu chỉ, phẩm hàm, khoa cử, tín ngưỡng, lễ hội) và `src/data/scenarios/*.json` nếu cần.
- Lịch tick (`src/sim/tick.ts`) đã chừa chỗ: `case 0` ngày 0 có ghi "M5: Ân sủng"; `case 49` có ghi "M5: city_ratings_update (theo tháng)".
- `houses.json` đã có đủ 10 bậc (bậc 9 Tư dinh, bậc 10 Phủ đệ, yêu cầu lụa / đồ đồng, độ hấp dẫn 55 / 70) nhưng `maxLevel` đang là 8 — M5 mở lên 10. Tầng 2 (quan lại) đã được loại khỏi nhân công trong `city/labor.ts`.
- Lụa và đồ đồng đã có chuỗi xưởng từ M3; vũ khí (lò rèn) có sẵn cho binh dịch.
- Lao động có 9 ngành (`LaborCat`); ngành thứ 10 "lao dịch" để dành cho M5.
- Đã có: chùa (sư đi dạo, phủ `temple`), đình làng (lý trưởng, phủ `dinh`), nha môn (lại thu thuế), sự kiện hiển thị qua `s.events`.
- M4 để lại cho M5: ngành lao dịch, sự kiện kịch bản về lũ (Thượng nguồn mưa lớn, Triều đình lệnh đắp đê, Hà đê sứ thanh tra), Hà Bá, chỉ số Thịnh vượng / Trị an. Chưa có chỉ số Sức khỏe (giếng nhiễm bẩn ở M4 tạm tính là giảm cấp nước).
- Ghi chú M3: nhân công = 60% tổng dân; lòng dân có lực kéo về 60.

## Phần 6 — Triều đình

Người chơi là quan trấn thủ (an phủ sứ) một lộ, không phải vua. Triều đình ở Thăng Long đóng vai Caesar: nguồn nhiệm vụ, nguồn áp lực và điều kiện thắng. Vì không cố định triều đại, "vua" là một nhân vật trừu tượng với tính cách thay đổi theo kịch bản (sùng Phật, trọng Nho, hiếu chiến).

**Ân sủng (Favor)** giữ công thức Julius với tên mới:

- Tự giảm 2 điểm mỗi năm: triều đình quên người ở xa.
- Chiếu chỉ hoàn thành đúng hạn +N (ghi trong chiếu); trễ lần đầu −3 và gia hạn 24 tháng; trễ lần hai −5 và bỏ qua.
- Cống nạp hằng năm không nộp: −3 / −5 / −8 các năm liên tiếp.
- Bổng lộc tự đặt cao hơn phẩm hàm: −chênh lệch mỗi năm; thấp hơn: +1.
- Tiến cống (quà biếu) +3 / +5 / +10 lần đầu, giảm dần về 0 ở lần thứ tư, reset sau 12 tháng.
- ≤ 10: triều đình cử quan khác đến thay, kèm quân (192 ngày báo trước). Đây là "Caesar invades" nhưng đại ý là bị cách chức.

**Chiếu chỉ** thay cho "request", 5 loại:

| Loại | Ví dụ | Thi hành | Phạt khi trễ |
| --- | --- | --- | --- |
| Thuế vật | Nộp 20 kiện gạo / lụa trong 18 tháng | Rút từ kho, đoàn xe bò đi ra mép bản đồ | Ân sủng −3 |
| Binh dịch | Gửi 60 đinh tráng ra trận | Trừ dân số + vũ khí; về sau 12–24 tháng, mất 30–70% | Ân sủng −5, nặng nhất |
| Lao dịch | Đắp N đoạn đê, đào kênh, xây thành | Khóa 10–30% nhân công vào ngành lao dịch | Ân sủng −3 |
| Tiền | Nộp X quan tiền | Trừ ngân khố | Ân sủng −3 |
| Nghi lễ | Xây chùa / Văn Miếu, đón sứ thần, mở khoa thi | Hoàn thành công trình hoặc sự kiện trong hạn | Ân sủng −2 |

Chiếu chỉ do **sứ giả** đem đến nha môn (walker từ mép bản đồ), tháng xuất hiện = ngẫu nhiên 2–9 trong năm kịch bản định, như Julius. Nha môn là nơi người chơi xem chiếu chỉ đang treo, định thuế, đặt bổng lộc và tiến cống — gộp senate và forum.

**Lao dịch là ngành lao động thứ 10** (phần 4): khi có chiếu chỉ, lao dịch được rút trước khỏi tổng nhân công theo tỉ lệ chiếu chỉ ghi, các ngành khác chia phần còn lại. Người chơi không chỉnh được ưu tiên này, chỉ quyết định đi nhanh hay chậm. Lòng dân: −1 mỗi kỳ khi > 20% nhân công đang đắp đê / xây thành theo lệnh triều đình (phần 2).

**Phẩm hàm** thay cho rank: thăng theo màn (như campaign Caesar 3), 9 bậc từ Tri huyện đến Thái úy; bổng lộc mỗi tháng theo bảng {0, 2, 5, 8, 12, 20, 30, 40, 60}. Phẩm hàm cao mở khóa công trình (Quốc Tử Giám, thành đá) và cấp nhiều đất hơn.

**Cống nạp hằng năm** giữ công thức tribute Julius: 25% lãi hoặc mức cố định theo dân số, không nộp khi ngân khố âm.

**Khoa cử** thay cho hippodrome: 3 năm một lần nếu có trường học, số người đỗ = học trò được phủ ÷ 200. Mỗi người đỗ cho Ân sủng +1, Văn hiến +2 và có xác suất 1/4 trở về thành nhà quan lại bậc 9 nếu có đất trống đủ hấp dẫn.

**Thần linh → tín ngưỡng.** 4 đối tượng thờ, dùng chung cơ chế tâm trạng ±1/ngày và "sét" 20 / 50 của Julius: tâm trạng tiến về mục tiêu = bao phủ đền + (12 − số tháng từ lễ hội gần nhất); đối tượng nhiều đền nhất +50, ít nhất −25; giận tích "sét", đủ 20 thì quở nhỏ, 50 thì quở lớn.

| Đối tượng | Công trình | Phù hộ (≥ 100) | Quở nhỏ (sét 20) | Quở lớn (sét 50) |
| --- | --- | --- | --- | --- |
| Thành hoàng làng | Đình | Lòng dân +25 | Trộm cắp tăng | Loạn dân ở 3 nhà thấp nhất |
| Phật | Chùa | Sức khỏe +10, 6 tháng | Thầy lang nghỉ 1 tháng | Dịch bệnh |
| Thủy thần (Hà Bá) | Miếu ven sông | floodLevel −1 năm đó | Thuyền chìm | floodLevel +1, một đoạn đê integrity về 10 |
| Tiên nông / Thần lúa | Đàn tế ngoài đồng | Ruộng đầy tiến độ ngay | Ruộng về 0, 4 ngày không tăng | 48 ngày không tăng |

Lễ hội làng (nhỏ / vừa / lớn) giá `dân/20+10`, `dân/10+20`, `dân/5+40` và reset bộ đếm tháng-từ-lễ của đối tượng được chọn. **Tết Nguyên đán** là lễ bắt buộc tháng 1: tự động trừ tiền, +7 lòng dân, không chọn được.

**Giặc giã** (để M6): giữ invasion của Julius với ba nguồn theo kịch bản: cướp biển từ cửa sông, quân Chiêm từ nam, quân phương Bắc từ bắc. Chiến đấu để nguyên cơ chế đơn giản của Caesar 3.

**Sự kiện kịch bản về lũ** (M4 để lại): "Thượng nguồn mưa lớn" ép floodLevel +1 năm đó; "Triều đình lệnh đắp đê quản hạt" (như Đỉnh Nhĩ 1248) yêu cầu N đoạn đê cao 2 trong 2 năm, thưởng Ân sủng +10; "Hà đê sứ đến thanh tra" kiểm tra integrity trung bình, dưới 60 thì Ân sủng −5.

## Phần 7 — Bốn chỉ số thành phố

Giữ đúng 4 chỉ số và nhịp cập nhật của Julius (Văn hiến theo tháng, ba cái còn lại theo năm). Mục tiêu màn chơi = ngưỡng cho mỗi chỉ số + dân số, kiểm tra mỗi tick như `city_victory_check`.

| Chỉ số | Tương đương C3 | Cách tính | Ghi chú |
| --- | --- | --- | --- |
| **Văn hiến** | Culture | Tổng điểm bao phủ 5 loại: đình (30 điểm ở 100%, bậc 22/14/9/3 như religion C3), chùa + đền (25), lớp học (15), trường học (20), sân diễn chèo / rối (10). Cộng +2 mỗi người đỗ khoa cử còn sống, tối đa 100 | Bao phủ = sức chứa × số công trình ÷ dân, như culture.c |
| **Thịnh vượng** | Prosperity | Mỗi năm: thất nghiệp < 5% +1, ≥ 15% −1; có lãi +5, lỗ −1; ≥ 2 loại lương thực +1; > 30% dân ở lều −1; > 10% ở nhà quan +1; không nộp cống −1; không mất mùa do lũ +1, có nhà ngập −2; thuyền buôn cập bến ≥ 4 chuyến +1 | Trần = trung bình giá trị thịnh vượng của các bậc nhà (thang 5…100 như C3) |
| **Trị an** | Peace | +2 (năm yên < 2) hoặc +5; −1 mỗi công trình bị phá (tối đa 12, không tính lều, điếm canh); −1 có trộm; −5 có loạn dân; −3 có đoạn đê vỡ | Vỡ đê tính vào Trị an vì sử ghi nó là thất bại của quan trấn thủ |
| **Ân sủng** | Favor | Như phần 6: −2/năm, chiếu chỉ, cống nạp, bổng lộc, tiến cống, khoa cử +1/người đỗ, mốc 25/50/75% mục tiêu +5 hoặc −2 | ≤ 10 bị cách chức |

**Chỉ số phụ trên bảng điều khiển** (không phải mục tiêu thắng):

- **Lòng dân** (0–100) — đã có từ M3, kèm nguyên nhân âm lớn nhất. M5 thêm nguyên nhân "lao dịch".
- **Sức khỏe** (0–100): `nhà khỏe ÷ tổng × 100`, nhà khỏe = có thầy lang + lương thực; tiến ±2 mỗi tháng. Dịch khi < 40 và `rand(64) ≤ 40 − health`, cộng thêm +15 xác suất trong 2 tháng sau khi có giếng ngập. (Nối lại với giếng nhiễm bẩn của M4 và phù hộ / quở của Phật.)
- **An toàn đê** — đã có từ M4.
- Thất nghiệp %, ngân khố, lương thực còn (tháng) như C3.

## Các dòng liên quan ở phần khác

- **Nhà ở (phần 2), ba tầng xã hội:** Thường dân (bậc 1–5) là nguồn lao động chính và lính khi có chiến. Thị dân (6–8) vẫn làm việc nhưng đóng thuế cao hơn. Quan lại (9–10) không lao động, không đóng thuế thân, nhưng mỗi nhà quan lại cộng điểm Văn hiến và cần để nhận một số chiếu chỉ.
  - Bậc 9 Tư dinh: 40 người (2×2), cần lụa, trường học (Nho học), rối nước, độ hấp dẫn ≥ 55, thuế × 9.
  - Bậc 10 Phủ đệ: 90 người (3×3), cần đồ đồng, 2 chùa + 1 đền (Văn Miếu hoặc đền thờ thành hoàng), độ hấp dẫn ≥ 70, thuế × 14.
  - Lưu ý: nhà 2×2 / 3×3 cần cơ chế gộp nhà (M3 chưa làm). Nếu chưa gộp được, ghi rõ cách thay thế trong README.
- **Walker (phần 3):**
  - Sứ giả triều đình — người ngoài, từ mép bản đồ đến nha môn giao chiếu chỉ.
  - Ông từ — từ đền, đi dạo, phủ dịch vụ đền.
  - Thầy giáo / thủ thư — từ trường học / Quốc Tử Giám, phủ `academy`.
  - Phường rối nước — từ thủy đình, phủ giải trí (bậc 9 cần rối nước).
  - Quan đi kiệu — từ tư dinh / phủ đệ, đi dạo 128 tick, chỉ để nhìn, +1 độ hấp dẫn tạm thời quanh đường đi.
  - Lý trưởng (đã có) — thêm việc gom lao dịch khi có lệnh.
- **Độ hấp dẫn (phần 7):** Văn Miếu / đền lớn +14, bước 2, Δ −2, tầm 6.
- **Kiến trúc (phần 8):** `src/sim/city/` thêm `ratings.ts`, `health.ts`, `court.ts` (Ân sủng, chiếu chỉ), `worship.ts`; `src/sim/scenario/` thêm `loader.ts`, `events.ts`, `victory.ts`; UI thêm `YamenPanel.tsx` (bảng nha môn). Lệnh mới trong Command: `sendGift`, `dispatchEdict`, đặt bổng lộc, tổ chức lễ hội. RNG chỉ dùng `mulberry32` có seed.

## Phạm vi và cổng M5 (phần 9)

**M5 Triều đình:** 4 chỉ số, nha môn, chiếu chỉ và sứ giả, 4 tín ngưỡng và lễ hội, khoa cử, nhà quan lại bậc 9–10, điều kiện thắng.

**Cổng:** một màn chơi thắng được trong 45 phút. Gợi ý kiểm: một test headless chạy kịch bản mẫu có mục tiêu (dân số + ngưỡng 4 chỉ số) và người chơi tự động làm các thao tác cơ bản (đáp chiếu chỉ, tổ chức lễ hội), đạt điều kiện thắng trong số năm game tương ứng 45 phút ở tốc độ thường (1× = 2,5 giây/ngày → 45 phút ≈ 1.080 ngày ≈ 5,6 năm game; ở tốc độ nhanh hơn thì nhiều năm hơn).

Nguyên tắc chung: mỗi cột mốc kết thúc bằng một bản chơi được trên web và một test headless qua cổng. Giữ test M1–M4 xanh.
