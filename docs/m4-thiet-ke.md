# M4 Lũ đê — tài liệu thiết kế cho phiên code
Trích từ tài liệu thiết kế "City builder Đại Việt" (project "Làm game"), phần 5 (Lũ và đê), các dòng liên quan ở phần 2, 3, 4, 6, 7, 8, 9, cộng ghi chú tiến độ M1–M3. Làm M4 đúng theo đây; chỗ nào phải đổi thì ghi lại lý do trong README.
## Trạng thái code hiện tại
- M1–M3 xong, 25 test xanh. Repo: tatbinhlk-oss/dai-viet. Đọc README.md trước.
- Số cân bằng nằm trong src/data/*.json; M4 thêm src/data/flood.json (thiết kế phần 8 đã định tên này).
- Lịch tick (src/sim/tick.ts) đã chừa case 26: // M4: flood.update(s) — sau nước, trước sinh walker.
- Lưới đã có elevation 0–4, cờ T_WATER, T_FLOODPLAIN (bãi bồi = ô elevation ≤ 1 nối liền sông, tính bằng flood-fill trong map/terrain.ts), và cờ T_FLOODED để dành cho M4.
- Ruộng lúa chỉ đặt trên bãi bồi; hệ số mùa vụ theo tháng nằm ở economy.json → paddySeason.
- Thợ cả (FigureType.Builder, từ Trại thợ) hiện đặt damageRisk = 0 cho công trình trong 5×5 — M4 thêm việc kiểm tra đê.
- Lao động có 9 ngành (LaborCat); thiết kế có ngành thứ 10 "lao dịch" nhưng nên để M5 (chiếu chỉ) — M4 chỉ cần phu đê lấy từ đình.
- Ghi chú M3 khác thiết kế: nhân công = 60% tổng dân; lòng dân có lực kéo về 60; người gánh chợ một chuyến lấy nhiều loại; người mộ phu giữ quyền có người làm 200 ngày; lửa +5 mỗi lần trúng 1/8 như Julius.
## Thiết kế phần 5 — Lũ và đê
Đây là cơ chế không có trong Caesar 3 và là lý do để game này tồn tại: sông vừa cho phù sa và đường thủy, vừa đe dọa nhấn chìm tất cả mỗi năm. Ghép từ đê Đỉnh Nhĩ thời Trần và cơ chế fire_risk / prefect của Julius.
Địa hình. Mỗi ô có elevation 0–4 và cờ nước. Vùng ngập tiềm năng = mọi ô đất có elevation ≤ 1 nối liền với sông. Chỉ ô bãi bồi mới đặt được ruộng lúa. Người chơi bật lớp phủ để thấy vùng ngập tô xanh nhạt.
Mùa lũ. Mỗi năm một đợt lũ từ tháng 6 đến tháng 9 âm lịch. Mực lũ đỉnh floodLevel quay vào ngày 1 tháng 6: 1 (nhỏ) 45%, 2 (vừa) 35%, 3 (lớn) 15%, 4 (đại hồng thủy) 5%. Từ tháng 4, nha môn báo "nước thượng nguồn lên" với dự báo đúng 70%, để người chơi có 2 tháng chuẩn bị. Mực nước tăng dần từ 0 lên đỉnh trong 24 ngày, giữ đỉnh 16 ngày, rút trong 24 ngày.
Đoạn đê. Công trình kéo dài như tường thành, mỗi ô một đoạn, có height 1–4 và integrity 0–100. Xây bằng lao dịch: người chơi vẽ tuyến đê, đình làng trong tầm sinh phu đê đi tới đắp; mỗi đoạn cần 1 kiện đất (lấy từ ô bãi bồi gần nhất, tạo ô đất trũng) và 30 ngày-người cho mỗi mức cao. Tôn cao đê cũ rẻ hơn đắp mới.
Tính ngập mỗi ngày trong mùa lũ. Flood-fill từ ô sông, lan sang ô láng giềng khi elevation + dikeHeight(ô) < floodLevel hiện tại. Ô được lan tới đánh cờ FLOODED. Một tuyến đê kín cao hơn mực lũ chặn toàn bộ; một lỗ hổng làm cả vùng sau đê ngập.
Vỡ đê. Mỗi ngày nước chạm đê: integrity -= (floodLevel − height + 1) × 2. Integrity ≤ 0 → đoạn đê vỡ thành ô đất trũng, nước tràn. Thợ cả đi qua đoạn đê đặt integrity = 100 → phải rải trại thợ dọc đê và có đường chạy dọc chân đê. Ngoài mùa lũ, integrity giảm 1 mỗi 4 ngày (sạt lở, mối).
Hậu quả ngập theo loại ô:
| Ô bị ngập | Hậu quả |
| Ruộng lúa | Tiến độ về 0; nước rút được cờ SILTED: tiến độ × 1,5 trong năm sau (phù sa) |
| Nhà ở | Tụt 1 bậc ngay, dân bỏ đi 50%, lòng dân −3/kỳ trong 3 tháng; lều tranh bị xóa |
| Xưởng, kho | Mất toàn bộ hàng trong kho; ngừng tới khi nước rút |
| Vựa thóc | Mất 50% lương thực (xây trên cọc) |
| Đường | Walker không đi qua; mạng đường tính lại, chuỗi cung ứng đứt |
| Đình, chùa, nha môn | Ngừng sinh walker |
| Giếng | Nhiễm bẩn: sức khỏe −20 trong 2 tháng |
Phù sa là phần thưởng. Ruộng ngoài đê (giữa đê và sông) ngập mỗi năm nhưng được phù sa; ruộng trong đê an toàn nhưng năng suất giảm 10% mỗi 5 năm không ngập (bạc màu), phục hồi khi chủ động mở cống cho nước vào. Cống là một đoạn đê đặc biệt có nút đóng/mở. Quyết định chiến lược mỗi năm: ngập có kiểm soát hay không.
Sự kiện kịch bản liên quan (có thể để M5): "Thượng nguồn mưa lớn" ép floodLevel +1 năm đó; "Triều đình lệnh đắp đê quản hạt" yêu cầu N đoạn đê cao 2 trong 2 năm, thưởng Ân sủng +10; "Hà đê sứ đến thanh tra" kiểm tra integrity trung bình, dưới 60 thì Ân sủng −5.
## Các dòng liên quan ở phần khác
- Nhà ở (phần 2): vùng ngập là điều kiện độ hấp dẫn âm mạnh (−15 trong vùng chưa có đê), nên nhà gần sông chỉ lên cao được sau khi đắp đê. Lòng dân thêm nguồn "mất mùa do lũ": −3 mỗi kỳ trong 3 tháng sau vỡ đê.
- Walker (phần 3): Phu đê — sinh từ đình làng khi có lệnh đắp đê, đi có đích, đến đoạn đê, cộng tiến độ đắp mỗi tick. Thợ cả: ngoài damage_risk = 0 còn kiểm tra đê. Thuyền nan: ô sông có bến là nút mạng đường thủy; khi hai công trình đều có bến trong 3 ô và đường thủy ngắn hơn đường bộ × 0,5, hàng đi bằng thuyền nan (chở 2 kiện, 10 tick/ô).
- Lúa nước (phần 4): ruộng nằm trong vùng ngập — tiến độ về 0 khi ô bị ngập.
- Thủy thần / Hà Bá (phần 6, để M5): phù hộ → floodLevel −1 năm đó; quở lớn → floodLevel +1, một đoạn đê integrity về 10.
- Chỉ số (phần 7): Thịnh vượng: không mất mùa do lũ +1, có nhà ngập −2. Trị an: −3 có đoạn đê vỡ. Chỉ số phụ mới An toàn đê (0–100) = integrity trung bình các đoạn đê, tô đỏ dưới 60, hiện rõ từ tháng 4 đến tháng 9.
- Độ hấp dẫn (phần 7): ô ngập (FLOODED) −15, bước 1, Δ +5, tầm 2; ô trong vùng ngập chưa có đê, mùa khô −5 (chỉ tại ô); đất trũng sau vỡ đê −5, bước 1, Δ +2, tầm 2; nhà cạnh sông có đê +10.
- Kiến trúc (phần 8): thư mục src/sim/flood/ gồm season.ts, floodFill.ts, consequences.ts; buildings/dike.ts; figures/levyWorker.ts; lệnh openSluice trong Command; flood.json cho số liệu. RNG chỉ dùng mulberry32 có seed, không Math.random.
## Phạm vi và cổng M4 (phần 9)
M4 Lũ đê: mùa lũ, flood-fill, đoạn đê và phu đê, integrity và vỡ đê, hậu quả ngập, phù sa, cống, thuyền nan.
Cổng: thành phố 1.000 dân sống 10 năm với floodLevel ngẫu nhiên mà không mất quá 20% dân — kiểm bằng test headless (Vitest), như tests/city.test.ts của M3.
Nguyên tắc chung: mỗi cột mốc kết thúc bằng một bản chơi được trên web và một test headless chạy qua cổng. Giữ test M1–M3 xanh.