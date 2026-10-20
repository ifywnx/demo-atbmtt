# MEDSEAL — Demo bảo vệ tính toàn vẹn bệnh án và đơn thuốc điện tử

Website phục vụ báo cáo **An toàn và Bảo mật thông tin — Nhóm 5, lớp N02**, giảng viên **Đoàn Trung Sơn**.

**Chủ đề:** Bảo vệ tính toàn vẹn bệnh án và đơn thuốc điện tử bằng **SHA-256** và **chữ ký số RSA-PSS (RSA 2048-bit)**.

## Mở demo

Website dùng HTML, CSS, JavaScript thuần, chạy trực tiếp trên trình duyệt, **không cần API key, Node.js, database hay backend**.

**GitHub Pages:** sau khi bật Pages, website có địa chỉ:

https://ifywnx.github.io/demo-atbmtt/

Nếu link chưa truy cập được, vào repository **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: main → /(root) → Save**. GitHub cần thời gian xuất bản lần đầu.

Chạy thử trên máy:

~~~bash
git clone https://github.com/ifywnx/demo-atbmtt.git
cd demo-atbmtt
python3 -m http.server 8000
~~~

Mở http://localhost:8000. **Không dùng đường dẫn file://** vì Web Crypto yêu cầu secure context (HTTPS hoặc localhost).

## Kịch bản trình bày cho giảng viên

1. **Mở website** → trình duyệt tự tạo cặp khóa RSA 2048-bit. Chờ thấy “SẴN SÀNG”.
2. **Bấm “Tạo hồ sơ & ký số”** → chuẩn hóa JSON, tính SHA-256 và tạo chữ ký RSA-PSS thật bằng khóa bí mật.
3. **Bấm “Kiểm tra tính toàn vẹn”** → hash trùng khớp, chữ ký xác minh thành công: **AN TOÀN**.
4. **Bấm “Thay đổi liều thuốc”** → đổi từ “1 viên/lần” thành “4 viên/lần” sau khi ký.
5. **Bấm “Kiểm tra tính toàn vẹn”** → SHA-256 khác bản gốc, RSA-PSS không hợp lệ: **PHÁT HIỆN CAN THIỆP**.
6. **Bấm “Khôi phục bản gốc”**, sau đó **“Kiểm tra tính toàn vẹn”** → trở lại trạng thái hợp lệ.
7. Có thể thử **“Sửa tên thuốc”** hoặc **“Giả mạo chữ ký”**. Với giả mạo chữ ký, **hash vẫn có thể khớp nhưng RSA-PSS không hợp lệ**.
8. **“Chạy tự kiểm thử”** ở phần Nhật ký kiểm tra kiểm tra 4 tình huống mật mã độc lập; **“Xuất bằng chứng JSON”** xuất thông tin phục vụ báo cáo.

### Cách trả lời câu hỏi “Bài demo thực sự hoạt động không?”

Có. Website sử dụng **Web Crypto API** của trình duyệt, không giả lập bằng chuỗi hash/ảnh cố định.

- SHA-256: crypto.subtle.digest('SHA-256', bytes)
- Tạo cặp khóa RSA-PSS 2048-bit: crypto.subtle.generateKey(...)
- Ký: crypto.subtle.sign({ name: 'RSA-PSS', saltLength: 32 }, privateKey, bytes)
- Kiểm tra: crypto.subtle.verify({ name: 'RSA-PSS', saltLength: 32 }, publicKey, signature, bytes)

**Lưu ý kỹ thuật:** RSA-PSS sử dụng SHA-256 *bên trong* thuật toán ký/xác minh thông điệp JSON chuẩn hóa. Website cũng tính mã SHA-256 của chính thông điệp đó riêng để hiển thị và đối chiếu với mã băm đã lưu. Không đưa digest vào hàm ký lần nữa.

### Dữ liệu nào được ký?

Bảy trường: mã bệnh án, ngày khám, họ tên giả lập, bác sĩ, chẩn đoán, tên thuốc, liều dùng; cộng thêm signedAt là thời điểm ký tự động. Các khóa JSON được sắp xếp từ điển; chuỗi Unicode được chuẩn hóa NFC, rồi mã hóa UTF-8. Kể cả sửa trực tiếp một trường sau ký cũng khiến phép xác minh không còn hợp lệ.

### Xuất bằng chứng

JSON bao gồm bản ghi đã ký, hash ban đầu, chữ ký Base64, **Public Key ở định dạng JWK**, bản ghi đang kiểm tra, hash hiện tại và kết quả xác minh gần nhất. **Không chứa Private Key.**

## Phạm vi bảo mật và hạn chế

- Đây là **mô hình giáo dục**, toàn bộ tên người và bệnh án đều là **dữ liệu giả lập**. Không dùng để kê thuốc hay lưu trữ hồ sơ bệnh nhân thật.
- Private Key được tạo tạm trong trình duyệt ở dạng **không thể xuất** và chỉ tồn tại trong phiên; reload sẽ tạo cặp khóa mới. Bản ghi, mã băm, chữ ký và nhật ký lưu **trong bộ nhớ tab**, không có database.
- SHA-256 và chữ ký số bảo vệ **tính toàn vẹn**, **không mã hóa hay giữ bí mật nội dung**.
- Chưa có PKI, CA, danh tính bác sĩ được chứng nhận, kiểm soát truy cập, HSM, lưu trữ bất biến, nhật ký kiểm toán chống sửa đổi hoặc quy trình ký pháp lý. Không nên xem đây là sản phẩm đáp ứng yêu cầu vận hành bệnh viện.
- Việc xác minh bằng một khóa công khai chỉ có ý nghĩa xác thực **đúng bác sĩ** nếu khóa đó được liên kết đáng tin cậy với danh tính của bác sĩ, ví dụ bằng chứng thư số phù hợp.

## Cấu trúc

~~~text
demo-atbmtt/
├── index.html   # Giao diện hồ sơ, tấn công, xác minh, log
├── styles.css   # Giao diện xanh - trắng responsive
├── app.js       # SHA-256, RSA-PSS, mô phỏng sửa đổi, xuất JSON
└── README.md    # Hướng dẫn chạy và thuyết trình
~~~

**Made for educational use — Nhóm 5 · N02 · 2026.**
