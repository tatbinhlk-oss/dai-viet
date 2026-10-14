# M6 Phát hành — tài liệu thiết kế cho phiên code
Trích từ tài liệu thiết kế "City builder Đại Việt" (project "Làm game"): các dòng về thương mại (phần 4), giặc giã (phần 6), render / UI / lưu game / hiệu năng (phần 8), lộ trình (phần 9), cộng những việc M3–M5 để lại. Làm đúng theo đây; chỗ nào phải đổi thì ghi lý do trong README như các mốc trước.
M6 lớn hơn các mốc trước và có phần không phải code (hình vẽ, âm thanh). Chia thành các đợt, mỗi đợt một phiên và một pull request, tất cả merge vào main:
- M6-0 — Khung spritesheet tạm có nhãn tên (làm TRƯỚC TIÊN, Bình đã chốt)
- M6a — Thương mại, giặc, lưu game (code thuần)
- M6b — 3 màn chơi và chuỗi phẩm hàm
- M6c — Hình vẽ, âm thanh, PWA, điện thoại, phát hành
## Trạng thái code sau M5
- M1–M5 xong trên main, 61 test xanh, build không lỗi. Đọc README (có ghi chú M3, M4, M5), docs/m4-thiet-ke.md, docs/m5-thiet-ke.md trước.
- Số cân bằng trong src/data/*.json (buildings, houses, economy, resources, flood, court) và src/data/scenarios/son-nam.json (màn duy nhất hiện có, nạp bằng ?scenario).
- Hình hiện tại là khối màu vẽ bằng Graphics (placeholder), chưa có spritesheet.
- Việc các mốc trước để lại cho M6:
- Từ M3: gộp 4 nhà 1×1 thành 2×2, gỗ làm vật liệu xây dựng, overlay cháy / sập, lưu game.
- Từ M5: giặc giã; thuyền buôn (Thịnh vượng "≥ 4 chuyến cập bến"); Quốc Tử Giám; thăng phẩm hàm theo chuỗi màn; nạp màn từ nhiều file. Nhà bậc 9–10 vẫn 1×1 (sức chứa 40 / 90), bậc 10 đang dùng "đền" thay cho "2 chùa + 1 đền".
- Từ M4: thuyền nan chở 1 kiện (thiết kế ghi 2), lao dịch chưa dùng phu đê của đình.
## M6-0 — Khung spritesheet tạm có nhãn tên (làm trước tiên)
Mục tiêu: chuyển cách vẽ hiện tại (khối màu vẽ thẳng bằng Graphics trong render/chunks.ts, render/figures.ts) sang spritesheet, để sau này chỉ thay file PNG là có hình thật, không sửa code game. Hình tạm vẫn là khối màu, nhưng mỗi công trình phải đọc được tên.
Hình tạm sinh tự động (scripts/gen-placeholders.ts, chạy bằng Node, không cần người vẽ):
- Mỗi loại công trình một PNG trong assets/buildings/<khóa>.png (khóa = tên trong buildings.json, ví dụ dinh.png, kiln.png); nhà theo bậc assets/houses/house_l1.png … house_l10.png; đất nền assets/ground/ (cỏ theo cao độ, bãi bồi, nước, đường, ô ngập, đất trũng, đê theo cao 1–4, cống); walker assets/figures/<loại>_<hướng>_<khung>.png (4 hướng × 4 khung); xe bò / phu kho / thuyền có bản rỗng và đầy, thùng hàng tô màu theo loại hàng.
- Khối có kích thước đúng: rộng N×64 px cho móng N×N, cao tùy loại; mặt trái, mặt phải, mái tô màu như bảng màu hiện có trong chunks.ts (giữ cùng màu để người chơi quen mắt).
- Nhãn tên công trình ở giữa khối: chữ nhỏ (khoảng 9–11 px, font pixel hoặc sans đậm, có viền tối 1 px để đọc được trên mọi màu mái), ghi tên tiếng Việt ngắn lấy từ buildings.json / houses.json (ví dụ "Đình", "Lò gốm", "Vựa", "Nhà ba gian"). Nhãn nằm giữa mặt mái, căn giữa theo chiều ngang. Tên dài thì viết tắt hoặc xuống 2 dòng; công trình 1×1 chỉ cần 1–2 chữ (ví dụ "Giếng", "Điếm", "Lều 1"). Nhà ghi kèm bậc ("Nhà 5").
- Nhãn vẽ thẳng vào PNG tạm (khi thay hình thật thì nhãn tự biến mất). Thêm nút bật/tắt "Hiện tên" trong UI vẽ nhãn bằng chữ Pixi đè lên công trình, để vẫn đọc được tên sau khi đã có hình thật (mặc định tắt khi có hình thật, bật khi còn hình tạm).
- Không dùng khung bo góc ở bất kỳ đâu (nhãn, ô chữ, nút) — Bình không muốn kiểu bo góc.
Đóng gói (scripts/pack-sprites.ts, đúng điểm kỹ thuật số 5 đã chốt từ M1): gom assets/**.png thành public/sheets/*.png + JSON. Mỗi frame ghi anchor = (0.5, 1) tính theo góc dưới hình thoi móng và footprint (N). Ví dụ: { "frame": "dinh", "w": 128, "h": 82, "anchor": [0.5, 1], "footprint": 2 }. scaleMode: 'nearest', không mip-map.
Render: công trình và walker chuyển sang Sprite lấy từ spritesheet, đặt tại điểm neo, zIndex = (x + y) × 8 + layer như đã chốt. Nếu thiếu frame nào thì vẽ khối màu như cũ (không crash). Giữ 60 fps trên bản đồ 160×160.
Thay hình thật về sau: thả PNG cùng tên vào assets/, chạy lại pack-sprites — code không đổi. Có thể thay dần từng loại. Sprite Caesar 3 KHÔNG đưa vào repo (repo công khai); nếu muốn xem thử bằng hình C3 thì làm bộ đọc file đồ họa từ bản cài trên máy, thư mục trích ra nằm trong .gitignore.
Kiểm: test đảm bảo mọi loại công trình / bậc nhà / loại walker đều có frame trong spritesheet và anchor đúng (0.5, 1); ảnh chụp bản demo (?demo=1) đọc được tên công trình.
## M6a — Thương mại, giặc, lưu game
Thương mại (phần 4). Hai tuyến:
- Tuyến bộ lên miền núi: đổi muối, vải lấy đồng, sắt, gỗ quý, trâu. Đoàn buôn (ngựa thồ) đi từ mép bản đồ tới kho, mua bán 8 kiện mỗi chuyến.
- Tuyến sông xuống Vân Đồn / Hội Thống ra biển: bán lụa, gốm, trà cho thuyền Tống, Chiêm, Java; mua hương liệu, đồ đồng. Thuyền buôn đi từ mép bản đồ tới bến cảng, 12 kiện mỗi chuyến.
- Hạn ngạch mỗi năm mỗi mặt hàng 0 → 15 → 25 → 40 kiện như Julius.
- Giá tham khảo theo tỉ lệ bảng Caesar 3 (lụa ≈ rượu 215 / 160, gốm 180 / 140, gạo 28 / 22), chỉnh sau khi chơi thử. Để trong src/data/trade.json.
- Kho đã có chính sách Nhận / Không nhận / Đi lấy; thêm lệnh mua / bán theo mặt hàng (như bảng thương mại C3) ở nha môn hoặc cố vấn.
- Nối vào Thịnh vượng: thuyền buôn cập bến ≥ 4 chuyến / năm +1.
- Walker: "Đoàn buôn (ngựa thồ) / thuyền buôn (Chiêm, Tống, Java) — mép bản đồ, bến cảng — người ngoài — mua bán 8 / 12 kiện" (bảng walker phần 3).
Giặc giã (phần 6). Giữ invasion của Julius với ba nguồn theo kịch bản: cướp biển từ cửa sông, quân Chiêm từ nam, quân phương Bắc từ bắc. Có trại lính, thành đất, thành đá, cần vũ khí từ lò rèn (đã có chuỗi vũ khí từ M3). Chiến đấu để nguyên cơ chế đơn giản của Caesar 3, không đầu tư thêm. Walker "giặc" là người ngoài, đi từ mép bản đồ tới công trình gần nhất (phần 3). Trị an đã có số hạng công trình bị phá. Cách chức ở M5 ("triều đình cử quan khác đến thay, kèm quân") có thể dùng chung cơ chế quân này.
Lưu game (phần 8). State sim chuyển thành một object JSON + các TypedArray, nén bằng CompressionStream gzip, lưu IndexedDB; tự lưu mỗi tháng game như Julius. Xuất / nhập file .dvsav để chia sẻ. RNG mulberry32 có seed nằm trong state, nên nạp lại chạy tiếp y hệt. Nên có test: lưu → nạp → chạy N năm cho kết quả giống hệt không lưu.
Gộp nhà 2×2 / 3×3 (nếu kịp): bốn nhà 1×1 cùng bậc gộp thành 2×2 (bậc 7–8 có sức chứa 96 / 112 khi 2×2, bậc 9 cần 2×2, bậc 10 cần 3×3 — bảng nhà phần 2).
## M6b — 3 màn chơi và chuỗi phẩm hàm
- 3 màn kịch bản: làng ven sông → trấn lị → Thăng Long. Mỗi màn là một file trong src/data/scenarios/, có bản đồ (hoặc tham số sinh bản đồ), vốn, mục tiêu dân số + ngưỡng 4 chỉ số, chiếu chỉ theo năm, sự kiện (lũ, giặc), tính cách "vua" (sùng Phật, trọng Nho, hiếu chiến — phần 6).
- Phẩm hàm thăng theo màn như campaign Caesar 3: 9 bậc từ Tri huyện đến Thái úy, bổng lộc {0, 2, 5, 8, 12, 20, 30, 40, 60}. Phẩm hàm cao mở khóa công trình (Quốc Tử Giám, thành đá) và cấp nhiều đất hơn.
- Quốc Tử Giám (phẩm hàm cao): thầy giáo / thủ thư đi dạo, phủ academy; tính vào Văn hiến như trường học.
- Bản đồ thật thay cho bản đồ sinh ngẫu nhiên: cần trình nạp bản đồ từ file (cao độ, sông, cửa ngõ, cửa sông, mép giặc vào).
- Màn đầu nên dạy dần: làng ven sông, chưa có giặc, lũ nhỏ.
## M6c — Hình vẽ, âm thanh, PWA, điện thoại, phát hành
Hình vẽ — năm điểm kỹ thuật đã chốt từ M1 (không đổi):
- Hằng số duy nhất TILE_W = 64, TILE_H = 32 trong render/iso.ts.
- Phép chiếu screenX = (x − y) × 32, screenY = (x + y) × 16; làm tròn pixel (roundPixels).
- Điểm neo sprite = góc dưới cùng hình thoi móng, anchor = (0.5, 1); công trình N×N có sprite rộng đúng N×64 px.
- Thứ tự vẽ zIndex = (x + y) × 8 + layer (đất → nước / ngập → công trình → walker → overlay).
- Spritesheet đóng gói bằng script riêng (scripts/pack-sprites.ts từ assets/ → public/sheets/), mỗi frame ghi anchor và footprint trong JSON; scaleMode: 'nearest', không mip-map, zoom 0,5× / 1× / 2×.
- Walker: 4 hướng × 4 khung đi bộ; xe bò có sprite "đầy" và "rỗng" với icon loại hàng trên thùng (phần 3).
- Sprite Caesar 3 chỉ được dùng nội bộ, không được phát hành. Bản công khai phải dùng hình vẽ riêng (hoặc asset có giấy phép cho phép dùng thương mại / phát hành).
- Khi người chơi bấm vào walker: hiện câu thoại theo trạng thái (đang chở gì, đi đâu, vì sao đứng chờ) như Caesar 3.
PWA và điện thoại: vite-plugin-pwa (manifest, service worker, chơi offline). Điều khiển cảm ứng: kéo một ngón dời bản đồ, chụm hai ngón zoom, chạm để đặt. Giao diện đã có bố cục hẹp cho màn < 700 px; cần kiểm lại trên điện thoại thật.
Hiệu năng mục tiêu (phần 8): bản đồ 160×160, 1.500 công trình, 800 walker, 60 fps trên laptop đồ họa tích hợp, 30 fps trên điện thoại tầm trung.
Cổng M6 (phần 9): link công khai — dùng GitHub Pages hiện có, đã chốt.
## Việc cần Bình quyết trước hoặc trong M6
Mấy điểm này không phải việc code, phiên code nên hỏi lại chứ không tự quyết:
- Tên game — tài liệu thiết kế ghi là việc cần quyết từ trước M1, đến giờ vẫn đang dùng "Đại Việt".
- Lịch: hiển thị âm lịch hay chỉ "tháng 1–12" (hiện UI ghi tháng Giêng … Chạp).
- Nguồn hình vẽ và âm thanh: thuê họa sĩ, mua asset pack có giấy phép, hay tự vẽ. Claude dựng được khung (script đóng gói spritesheet, hình tạm đúng kích thước và điểm neo), nhưng hình đẹp để phát hành nên do người vẽ.
- Phát hành ở đâu — Đã chốt: giữ trên GitHub Pages (tatbinhlk-oss.github.io/dai-viet) trước; itch.io / tên miền riêng tính sau.
## Nguyên tắc chung
Mỗi đợt kết thúc bằng một bản chơi được trên web và test headless xanh; giữ test M1–M5 xanh. Làm trên nhánh rồi tạo pull request và merge vào main khi xong, để trang web cập nhật.