# Phương án board game "Đại Việt"

Chuyển thể game city builder Đại Việt (Caesar 3 bối cảnh Đại Việt) thành board game bàn. Tài liệu này là phương án khung: chọn hướng, luật lõi, cách rút gọn từng cơ chế, thành phần, lộ trình làm và chơi thử.

## 1. Ba hướng có thể đi, chọn hướng nào

| Hướng | Mô tả | Người chơi / thời lượng | Giữ được gì từ game | Rủi ro |
|---|---|---|---|---|
| **A. Euro cạnh tranh, mỗi người một huyện ven sông** (đề xuất) | Mỗi người là một quan Tri huyện, có bảng huyện riêng, cùng chung một con sông, một triều đình, một thị trường. Đua Ân sủng và phẩm hàm. | 2–4 người, 75–100 phút, 12+ | Gần hết: nhà bậc, chuỗi xưởng, lũ – đê, chiếu chỉ, phẩm hàm, buôn bán, giặc | Nặng hơn game gia đình; cần cân bằng kỹ |
| B. Hợp tác, cả bàn xây một thành | Cùng giữ một tuyến đê, cùng trả chiếu chỉ; thua chung nếu vỡ đê hoặc bị cách chức | 1–4 người, 60 phút | Lũ – đê, chiếu chỉ, giặc | Dễ bị "một người chỉ đạo cả bàn"; mất đua phẩm hàm |
| C. Xếp ô nhẹ kiểu Carcassonne | Rút ô đặt làng, ghi điểm theo cụm nhà – chùa – đê | 2–5 người, 30–40 phút | Chỉ bề ngoài: hình ảnh, tên công trình | Mất gần hết chiều sâu của sim |

**Chọn A.** Lý do: mục tiêu của game gốc là "làm quan được thăng chức", cơ chế hay nhất là lũ và đê, cả hai hợp với trò cạnh tranh có yếu tố chung (sông chung, triều đình chung). Hướng B và C làm được sau dưới dạng biến thể luật (chế độ hợp tác) hoặc phiên bản gia đình nếu bản A chạy tốt.

## 2. Khung chơi lõi

- **Vai:** mỗi người là một quan cai một huyện ven sông Hồng. Mục tiêu: hết 8 năm (8 vòng), ai được triều đình đánh giá cao nhất thắng. Điểm cuối = 4 chỉ số của game gốc: **Ân sủng, Văn hiến, Thịnh vượng, Trị an**.
- **Thắng sớm:** ai lên phẩm hàm cao nhất (bậc 5) thì chơi hết năm đó rồi tính điểm.
- **Thua riêng:** Ân sủng về 0 thì bị giáng một bậc phẩm hàm và mất bổng lộc, không bị loại.
- **Một vòng = một năm âm lịch, 5 mùa:**

| Mùa | Việc | Từ cơ chế nào trong game |
|---|---|---|
| 1. Xuân (tháng 1–3) | Lật thẻ chiếu chỉ mới; lật thẻ sự kiện (giặc, hà đê sứ, mưa lớn, khoa cử); nhận bổng lộc theo phẩm hàm; ai muốn mở lễ hội thì trả gạo | `court.ts`, `events.ts`, lễ hội |
| 2. Hạ (tháng 4–5) | Lật thẻ dự báo lũ; **pha hành động chính**: lần lượt đặt người làm (worker placement) để xây, sản xuất, đắp đê, buôn, mộ lính, cúng tế | BuildBar, labor, dike |
| 3. Lũ (tháng 6–9) | Xác định mực lũ thật; so với cao đê từng người; ô không được che bị ngập theo bảng hậu quả | `flood/` |
| 4. Thu (tháng 10–11) | Thu hoạch và chạy chuỗi xưởng; nhà nhận hàng → lên hoặc tụt bậc; thu thuế theo bậc nhà; dân nhập cư | house, industry, finance |
| 5. Đông (tháng 12) | Nộp chiếu chỉ và cống nạp; chỉnh Ân sủng; thăng phẩm hàm; vua đổi ý (thẻ vua) | court, victory |

## 3. Chuyển thể từng cơ chế

### 3.1 Bảng huyện (bảng cá nhân)

- Lưới **6×6 ô**, cạnh dưới là sông. Mỗi ô in sẵn cao độ 0–2 như bản đồ game: hàng sát sông là **bãi bồi** (cao độ 0, ruộng ở đây cho thêm phù sa nhưng ngập trước), hàng giữa cao độ 1, hàng xa sông cao độ 2 (an toàn, nhưng ruộng ít thóc hơn).
- 4 bản đồ bảng huyện khác nhau (mượn 4 màn Làng ven sông, Trấn lị, Sơn Nam, Thăng Long): khác vị trí mỏ, cửa sông, mép giặc, để bàn không đối xứng.
- Công trình là **ô bìa đặt lên lưới**: 1×1 (lều, giếng, điếm canh, miếu) và 2×2 (ruộng, xưởng, đình, chùa, trại lính). Giới hạn đất buộc người chơi chọn như trong game.
- **Độ hấp dẫn** rút thành luật kề cạnh: chùa / đình / ao sen cộng cho nhà kề; lò gốm, lò rèn, chuồng lợn, mỏ trừ cho nhà kề. Nhà cần "độ hấp dẫn ≥ N" để lên bậc cao.

### 3.2 Nhà và dân (10 bậc → 5 bậc)

Mỗi nhà là một ô có **thẻ bậc lật / chồng**:

| Bậc | Tên | Cần (cộng dồn) | Sức chứa (dân) | Thuế |
|---|---|---|---|---|
| 1 | Lều tranh | — | 1 | 0 |
| 2 | Nhà tranh | giếng kề + 1 loại lương thực | 2 | 1 |
| 3 | Nhà gỗ lợp ngói | đình hoặc chùa trong tầm + gốm | 3 | 2 |
| 4 | Nhà ngói năm gian | trường học + 2 loại lương thực + muối hoặc vải | 4 | 3 |
| 5 | Tư dinh | lụa + rối nước hoặc Văn Miếu + độ hấp dẫn cao | 6 | 5 |

Dân = tổng sức chứa nhà đang đầy = số người làm được đặt ở pha Hạ. Đây là mạch chính như game: muốn nhiều nhân công thì phải nuôi nhà, muốn nuôi nhà thì cần hàng, muốn hàng thì cần nhân công.

### 3.3 Chuỗi sản xuất (19 hàng → 8 hàng)

Hàng là **cube gỗ** đựng trên kho của bảng huyện (kho 8 ngăn → tối đa 8 cube mỗi loại, tràn thì bỏ, giữ đúng áp lực kho của game).

| Chuỗi | Công trình | Hàng | Dùng để |
|---|---|---|---|
| Lúa | Ruộng lúa (bãi bồi ×2 nếu có phù sa) | Gạo | nuôi nhà, chiếu chỉ, lễ hội, cống |
| Cá | Bến cá (phải kề sông) | Cá | lương thực thứ 2 |
| Gốm | Bãi đất sét → Lò gốm | Gốm | nhà bậc 3, bán |
| Vải | Ruộng bông → Khung cửi | Vải | nhà bậc 4, bán |
| Lụa | Nương dâu → Xưởng lụa | Lụa | nhà bậc 5, chiếu chỉ, bán đắt |
| Muối | Ruộng muối | Muối | nhà bậc 4, bán cho tuyến núi |
| Vũ khí | Mỏ sắt → Lò rèn | Vũ khí | mộ lính, chiếu chỉ binh dịch |
| Đất | đào ở ô bãi bồi (ô thành trũng) | Đất | đắp đê |

Bỏ: thịt lợn, rau, chè, đồng, gỗ xây (gộp vào tiền). Có thể trả lại ở bản mở rộng.

### 3.4 Lũ và đê (cơ chế đặc trưng, giữ nguyên tinh thần)

- **Bộ thẻ lũ 20 thẻ**: 9 nhỏ (mực 1), 7 vừa (2), 3 lớn (3), 1 đại hồng thủy (4). Đúng tỉ lệ 45/35/15/5 của `flood.json`.
- **Dự báo 70%:** đầu pha Hạ lật thẻ trên cùng làm dự báo. Tới pha Lũ, tung xúc xắc: 1–4 dự báo đúng, 5–6 lật thẻ kế làm mực thật. Người chơi thấy dự báo rồi mới quyết đắp đê bao nhiêu, đúng cảm giác nha môn báo trước.
- **Đê** là một dãy ô dọc cạnh sông trên bảng huyện; mỗi đoạn có **cao 0–4** bằng đĩa chồng. Đắp mức đầu tốn 1 đất + 1 người làm, tôn cao thêm mỗi mức 1 người làm.
- **Luật ngập:** ô có cao độ + cao đê che nó < mực lũ thì bị ngập. Hậu quả rút từ bảng hậu quả của game: nhà tụt 1 bậc và mất nửa dân, vựa mất nửa gạo, ruộng mất vụ **nhưng** nhận thẻ phù sa (vụ sau ×2). Lều bị xóa.
- **Độ bền đê:** mỗi năm nước chạm đê thì đặt 1 token mòn; đê 3 token mòn thì vỡ khi lũ ≥ cao đê. Trại thợ (công trình) gỡ token mòn. Giữ đúng "đê để lâu không tu thì vỡ".
- **Đê quốc gia (chung cả bàn):** một tuyến đê trên bảng chung do chiếu chỉ lao dịch yêu cầu. Mỗi năm có chiếu chỉ đắp đê, mọi người góp người làm; góp không đủ thì mực lũ năm đó +1 cho **cả bàn**. Đây là bài toán của chung: góp thì mất nhân công, không góp thì hại cả làng xóm lẫn mình.

### 3.5 Triều đình

- **Ân sủng:** thước 0–20 trên bảng chung, mỗi người một marker, bắt đầu 10. Mỗi năm −1 (yearlyDecay). Hoàn thành chiếu chỉ +reward; trễ −penalty; không nộp cống −3.
- **Chiếu chỉ:** bộ thẻ 6 loại như game: *hàng* (nộp N cube), *tiền*, *lễ nghi* (có chùa / trường), *đắp đê* (góp N người làm vào đê quốc gia), *binh dịch* (gửi N lính, mất 1–2 năm mới về, tung xúc xắc hao binh), *lao dịch* (khóa N người làm một năm). Mỗi chiếu chỉ có hạn 1–2 năm, đặt marker năm trên thẻ. Chiếu chỉ là **chung cho cả bàn**: ai cũng phải nộp, ai nộp trước nhận thêm +1 (thưởng người tận tụy).
- **Phẩm hàm:** 5 bậc Tri huyện → Tri phủ → An phủ sứ → Hành khiển → Thượng thư, lên bậc khi Ân sủng chạm ngưỡng 12 / 14 / 16 / 18 và đủ dân. Lên bậc: **bổng lộc** mỗi năm cao hơn và **mở công trình** (Trường học, Thủy đình, Văn Miếu, Quốc Tử Giám, Tàu voi) như BuildBar khóa theo phẩm hàm.
- **Cống nạp:** mỗi năm nộp tiền theo dân (bảng `tribute.byPopulation` rút thành 0 / 2 / 4 / 6 quan).
- **Vua:** 3 thẻ vua (sùng Phật, trọng Nho, hiếu chiến) rút 1 lúc mở bàn: đổi thưởng chiếu chỉ loại đó, và đầu mỗi năm kiểm tra công trình (chùa / trường / trại lính) theo dân: đủ +2, thiếu −2. Đổi vua giữa ván qua thẻ sự kiện "Vua băng hà" (M7 vua đổi chiếu chỉ).
- **Khoa cử:** sự kiện 3 năm một lần: ai có trường học có người làm thì tung xúc xắc theo số nhà bậc ≥ 4, mỗi người đỗ +1 Ân sủng, +2 Văn hiến; 1 người đỗ về làng thành Tư dinh miễn phí.

### 3.6 Tín ngưỡng, lòng dân, lễ hội (rút gọn mạnh)

- 4 vị thần rút thành **2 token thần giận** (Hà Bá: lũ; Thành hoàng: tội phạm, cháy). Mỗi năm không có miếu / đình có người làm thì nhận 1 token; 3 token thì quở (ngập thêm 1 ô, hoặc cháy 1 công trình). Lễ hội (trả 2 gạo ở pha Xuân) gỡ hết token và +1 lòng dân.
- **Lòng dân** thước 0–10 trên bảng huyện: lao dịch, thuế cao, ngập, thiếu lương thực trừ; lễ hội, đủ ăn cộng. Lòng dân quyết **nhập cư**: cuối pha Thu, dân từ bể chung đi vào huyện có lòng dân cao nhất trước. Lòng dân ≤ 2: 1 nhà tụt bậc (dân bỏ đi) và sinh tội phạm (mất 1 cube kho) nếu không có điếm canh.

### 3.7 Thương mại

- Bảng chung có 2 tuyến như `trade.json`: **Tuyến núi** (mua muối, vải; bán quặng) và **Vân Đồn** (mua lụa, gốm; bán hàng quý). Mở tuyến tốn tiền (cả bàn dùng chung sau khi ai đó mở, người mở được giảm giá).
- Mỗi hàng có **thước hạn ngạch 0 → 15 → 25 → 40** quy thành 1 / 2 / 3 cube mỗi năm cho cả bàn, giá rớt dần theo cube đã bán trong năm. Ai bán trước được giá tốt: tương tác trực tiếp.

### 3.8 Giặc và quân đội

- Thẻ sự kiện giặc: ghi hướng (núi / biển / nam) và sức 2–5. Mỗi người bị giặc nếu bảng huyện có mép giặc hướng đó. Sức phòng = lính (trại lính, mỗi lính 1 vũ khí) + thành đất / đá + chòi canh (báo sớm: được đặt thêm 1 lính trước khi đánh). Thiếu → giặc cướp 1 cube kho rồi đốt 1 công trình (bài toán cướp kho trước như M8).
- Binh dịch gửi lính cho vua: lính rời bảng 1–2 năm, trở về theo xúc xắc (mất 30–70%). Lính ở nhà thì không có tiền từ vua.

## 4. Thành phần dự kiến (bản 4 người)

| Thành phần | Số lượng | Ghi chú |
|---|---|---|
| Bảng chung | 1 | thước Ân sủng, 5 bậc phẩm hàm, đê quốc gia, 2 tuyến buôn, lịch 8 năm với 5 mùa, chỗ để thẻ chiếu chỉ và sự kiện |
| Bảng huyện | 4 (2 mặt = 8 bản đồ) | lưới 6×6 có cao độ, dãy đê, kho 8 ngăn, thước lòng dân |
| Ô công trình | ~140 | bìa dày, 1×1 và 2×2, in giá và nhân công; chia 7 nhóm màu như BuildBar |
| Thẻ bậc nhà | 4 × 12 | nhà bậc 1–5 dạng thẻ nhỏ chồng |
| Cube hàng | 8 loại × 20 | gỗ màu |
| Người làm (meeple) | 4 × 15 | thêm 8 meeple lính màu khác, 4 voi |
| Đĩa đê | 60 | chồng 1–4 |
| Thẻ lũ | 20 | 9 / 7 / 3 / 1 |
| Thẻ chiếu chỉ | 36 | 6 loại × 6 |
| Thẻ sự kiện | 30 | giặc, hà đê sứ, mưa lớn, khoa cử, dịch, vua băng hà |
| Thẻ vua | 3 | |
| Token | ~100 | phù sa, mòn đê, ngập, thần giận, cháy |
| Tiền quan | ~120 | xu bìa 1 / 5 / 10 |
| Xúc xắc | 2 | 1 lũ, 1 chiến |
| Sách luật + sách màn chơi | 1 | màn chơi = kịch bản 4 màn của game, mỗi màn một bộ chiếu chỉ cố định |

Ước lượng thời lượng: 15 phút dạy, 80–100 phút chơi 4 người, 60 phút 2 người.

## 5. Vì sao người chơi tương tác

1. **Sông chung, lũ chung:** cùng một thẻ lũ cho cả bàn, nhưng ai đắp đê cao hơn thì sống. Đê quốc gia bắt mọi người góp.
2. **Triều đình chung:** chiếu chỉ ai cũng phải trả, Ân sủng là cuộc đua, vua có tính cách thiên vị kiểu chơi.
3. **Chợ chung:** hạn ngạch giới hạn, bán trước được giá.
4. **Dân chung:** nhập cư đi về nơi lòng dân cao, nên bỏ bê dân là mất người cho hàng xóm.
5. **Giặc theo hướng:** tuyến bảng huyện ai cũng có một mép giặc, ai lơ là mất kho.

Không có đánh nhau trực tiếp giữa người chơi: đúng tinh thần quan lại cùng triều, cạnh tranh bằng thành tích.

## 6. Lộ trình làm

| Giai đoạn | Thời gian | Việc | Đầu ra |
|---|---|---|---|
| 0. Chốt khung | 1 tuần | Chốt mục 2–3 ở trên; viết luật nháp 4–6 trang; vẽ bảng bằng tay | Luật v0.1 |
| 1. Mô phỏng số | 1–2 tuần | Viết script nhỏ (TypeScript, tái dùng `src/data/*.json` và `rng.ts`) chạy Monte-Carlo: kinh tế 8 năm, xác suất ngập theo cao đê, tốc độ lên phẩm hàm. Chỉnh giá công trình, thuế, thưởng chiếu chỉ trước khi in | Bảng số cân bằng v1 |
| 2. Prototype giấy | 2 tuần | In bảng A3, ô bìa cắt tay, cube mua sẵn. Chơi nội bộ 5–8 ván, ghi lại số ván mỗi lỗi | Luật v0.5 |
| 3. Chơi thử ở quán | 6–8 tuần | Đưa ra 3 quán Board Game Master (Space, Station, Cashflow) tối thứ 3–5 với nhóm khách quen; phiếu phản hồi 10 câu; mỗi 2 tuần ra bản mới. Mục tiêu: 30+ ván, 3 vòng chỉnh | Luật v1.0, dữ liệu playtest |
| 4. Mỹ thuật | 4–6 tuần | Vẽ ô công trình (tận dụng danh sách và hình đang làm cho `assets/` của game, cùng một họa sĩ thì hai bản đồng bộ), bảng, thẻ; dàn trang sách luật | File in |
| 5. Bản in thử | 3–4 tuần | In 5–10 bộ ở xưởng trong nước (bìa, cube, meeple mua rời). Kiểm tra chất liệu, màu, kích thước hộp | 5–10 bộ |
| 6. Phát hành | tùy | Bán tại 3 quán và online; cân nhắc đặt trước; bản print-and-play miễn phí làm quảng bá cho cả game web | |

Chốt thứ tự ưu tiên khi chỉnh luật: (1) lũ – đê phải là khoảnh khắc đáng nhớ nhất ván, (2) nhà lên bậc phải thấy rõ từng năm, (3) chiếu chỉ gây khó nhưng không bế tắc, (4) 4 người không quá 100 phút.

## 7. Tận dụng từ game web

- **Số cân bằng:** `buildings.json`, `houses.json`, `flood.json`, `court.json`, `trade.json` là điểm xuất phát của mọi bảng số ở trên; đã chơi thử trên web nên giá tương đối đã hợp lý.
- **Tên và hình:** 53 công trình, 19 hàng, 10 bậc nhà, 9 phẩm hàm đã có tên tiếng Việt thống nhất; hình thật đang làm cho spritesheet có thể vẽ lại góc nhìn từ trên cho ô bìa.
- **Kịch bản:** 4 màn (Làng ven sông, Trấn lị, Sơn Nam, Thăng Long) với bộ chiếu chỉ theo năm thành 4 "màn chơi" in sẵn trong sách màn, chơi chuỗi thì mang phẩm hàm sang.
- **Mô phỏng:** sim headless chạy bằng `npm test` có thể dùng để kiểm chứng tỉ lệ (ví dụ bao nhiêu % năm đê cao 2 là đủ) trước khi cố định luật bàn.
- **Quảng bá chéo:** QR trên hộp dẫn tới bản web; trong game web có màn "Bản bàn".

## 8. Câu hỏi mở cần quyết sớm

1. Đặt người làm (worker placement, như Agricola) hay chọn hành động theo thẻ (như Puerto Rico)? Đề xuất worker placement vì "nhân công" là tài nguyên trung tâm của game gốc.
2. Có giữ 4 vị thần đầy đủ (thêm chiều sâu, thêm 15 phút) hay rút còn 2 token như mục 3.6? Đề xuất rút, để dành cho bản mở rộng.
3. Số năm: 8 năm có đủ để lên Thượng thư không? Trả lời bằng mô phỏng ở giai đoạn 1.
4. Độ hấp dẫn: luật kề cạnh đơn giản hay có thước "độ hấp dẫn" từng nhà? Đề xuất kề cạnh, thử ở prototype giấy.
5. Mục tiêu thương mại hóa: bán rộng (cần nhà phát hành, in 1.000+) hay bản nhỏ 100–300 bộ cho khách quán? Quyết định này đổi ngân sách mỹ thuật và vật liệu.
