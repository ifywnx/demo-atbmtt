# MEDSEAL — Demo bảo vệ tính toàn vẹn bệnh án và đơn thuốc điện tử

Website phục vụ báo cáo **An toàn và Bảo mật thông tin — Nhóm 5, lớp N02**, giảng viên **Đoàn Trung Sơn**.

**Chủ đề:** Bảo vệ tính toàn vẹn bệnh án và đơn thuốc điện tử bằng **SHA-256** và **chữ ký số RSA-PSS (RSA 2048-bit)**.

## Website demo trực tuyến

**Production (Vercel):** https://demo-atbmtt.vercel.app/

GitHub: https://github.com/ifywnx/demo-atbmtt

Website dùng HTML, CSS, JavaScript thuần, **không cần API key, database hay backend**. GitHub kết nối Vercel: push lên nhánh main sẽ tự động triển khai bản production.

### Hướng dẫn trình chiếu trên lớp

1. Trên máy chiếu, mở **https://demo-atbmtt.vercel.app/**, chọn nút **Trình chiếu** trên thanh trên cùng (hoặc F11 trong trình duyệt).
2. Chờ hệ thống hiện khóa công khai **SẴN SÀNG**.
3. Nhấn **Ký hồ sơ** trên hero (hoặc **Tạo hồ sơ & ký số** trong thẻ bệnh án). Mã SHA-256 và chữ ký RSA-PSS sẽ được tạo thật trong trình duyệt.
4. Nhấn **Xác minh**, quan sát trạng thái **toàn vẹn / hợp lệ** màu xanh.
5. Nhấn **Thử tấn công** hoặc vào kịch bản **Thay đổi liều thuốc**: chuyển từ 1 viên/lần sang 4 viên/lần.
6. Trong khu vực **Cùng một hồ sơ. Hai trạng thái.**, chỉ vào phần liều thuốc khác nhau và bấm **Xác minh ngay**. Kết quả hiện **TAMPERING DETECTED** màu đỏ.
7. Nhấn **Khôi phục bản gốc**, xác minh lại → trạng thái hợp lệ. Có thể thử thêm đổi tên thuốc hoặc giả mạo chữ ký số.
8. **Chạy tự kiểm thử** trong Nhật ký (4 tình huống crypto thật). **Xuất bằng chứng JSON** để lưu kết quả minh họa.

Các trạng thái của dashboard và bảng so sánh lấy từ kết quả của ứng dụng ký số thật, không sử dụng hash hay kết quả giả định. Bốn chặng phía trên kể lại kịch bản demo; quy trình mật mã sáu bước chi tiết nằm ở mục Quy trình bảo vệ.

### Chạy tại máy

~~~bash
git clone https://github.com/ifywnx/demo-atbmtt.git
cd demo-atbmtt
python3 -m http.server 8000
~~~

Mở http://localhost:8000. **Không dùng file://** vì Web Crypto cần môi trường an toàn (HTTPS hoặc localhost).

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
├── showcase.css # Giao diện trình chiếu và hiệu ứng chuyển động
├── showcase.js  # Dashboard tiến trình, so sánh & fullscreen
└── README.md    # Hướng dẫn chạy và thuyết trình
~~~

**Made for educational use — Nhóm 5 · N02 · 2026.**
