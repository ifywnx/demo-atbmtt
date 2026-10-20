# MEDSEAL — Kịch bản báo cáo FINAL (Nhóm 5 · N02)

**Website:** https://demo-atbmtt.vercel.app/

**Chủ đề:** Bảo vệ tính toàn vẹn bệnh án và đơn thuốc điện tử bằng SHA-256 và chữ ký số RSA-PSS 2048-bit.

**Mục tiêu:** 4–5 phút, chứng minh ký thật → xác minh thật → sửa dữ liệu → phát hiện can thiệp → ký bản mới.

## Kiểm tra trước giờ báo cáo

- Mở link trên bằng trình duyệt Chrome hoặc Edge; đợi khóa RSA báo **SẴN SÀNG**.
- Nhấn **Chạy tự kiểm thử** trong Nhật ký: mong đợi 4/4 phép thử đạt.
- Nhấn **Trình chiếu** hoặc F11; điều chỉnh độ phóng to để chữ đủ lớn khi chiếu.
- Chuẩn bị sẵn file JSON được xuất từ Góc bác sĩ để thử trên máy B.
- Khi không có Internet, chạy thư mục nguồn trên máy: **python3 -m http.server 8000**, rồi mở **http://localhost:8000**. Không mở trực tiếp bằng file:// vì Web Crypto yêu cầu HTTPS hoặc localhost.
- Tải lại trang trước khi demo chính thức để tạo phiên mới và xóa dữ liệu bản cũ.

## Kịch bản 5 phút

### 00:00–00:30 — Nêu vấn đề

“Nếu đơn thuốc điện tử bị sửa từ 1 viên thành 4 viên mà không ai phát hiện thì rất nguy hiểm. Nhóm em sử dụng SHA-256 và RSA-PSS để xác minh nội dung còn nguyên vẹn sau khi bác sĩ ký hay không.”

### 00:30–01:30 — Demo tự động

Nhấn **Chạy demo**. Nếu cần giải thích, nhấn **Tạm dừng** giữa các cảnh:

1. Ký số hồ sơ giả lập với liều 1 viên/lần.
2. Xác minh bản gốc: hiện xanh, hash và chữ ký hợp lệ.
3. Giả lập sửa liều thành 4 viên/lần nhưng không ký lại.
4. Xác minh lần hai: hiện đỏ, nội dung đã bị can thiệp.

“Các phép tính mật mã chạy thật trong trình duyệt, không phải ảnh động giả lập kết quả.”

### 01:30–03:00 — Hai máy, hai vai trò

1. Trên máy A, nhấn **Khôi phục bản gốc**, xác minh lại.
2. Trong **Góc bác sĩ**, nhấn **Xuất hồ sơ đã ký (.json)**.
3. Chuyển file sang máy B; mở cùng website, vào **Góc dược sĩ**.
4. Nhập tệp; nhấn **Xác minh hồ sơ nhập**, xem kết quả hợp lệ.
5. Sửa ô **Liều dùng nhận được** thành 4 viên/lần rồi xác minh: báo can thiệp.
6. Đối chiếu **vân tay Public Key** trên máy B với fingerprint ở mục kỹ thuật trên máy A qua kênh đáng tin cậy.

“Dược sĩ dùng Public Key để kiểm tra chữ ký mà không cần Private Key. Chữ ký hợp lệ chưa có nghĩa danh tính bác sĩ đã được chứng nhận.”

### 03:00–04:00 — Cập nhật hợp lệ

Bác sĩ chỉnh sửa đơn thuốc có chủ đích rồi bấm **Ký phiên bản mới**. Hiển thị V1, V2 trong lịch sử và bấm **Kiểm tra V1**, **Kiểm tra V2**.

“Muốn thay đổi đúng quy trình, bác sĩ phải phát hành phiên bản được ký mới, không âm thầm sửa bản cũ.”

### 04:00–04:30 — Kết luận

“SHA-256 tạo dấu vân tay dữ liệu. RSA-PSS kiểm tra chữ ký theo Public Key. Khi nội dung bị sửa sau khi ký, phép xác minh phát hiện khác biệt. Đây là mô hình giáo dục dùng bệnh án giả lập, chưa có PKI, phân quyền bệnh viện hoặc cơ sở dữ liệu.”

## Các câu hỏi thầy có thể hỏi

**SHA-256 có mã hóa để giữ bí mật bệnh án không?**
Không. SHA-256 dùng để tạo hash, không mã hóa nội dung. Demo không có mã hóa bảo mật hồ sơ.

**RSA-PSS ký trực tiếp hash hiển thị hay nội dung?**
Web Crypto ký bytes JSON chuẩn hóa với SHA-256 được áp dụng trong RSA-PSS. Hash hiển thị được tính độc lập; không băm đôi.

**Dược sĩ biết chắc ai ký bằng cách nào?**
Với khóa công khai lấy từ file, chỉ biết chữ ký khớp khóa; muốn gắn khóa với danh tính bác sĩ thật cần chứng thư số và PKI, đồng thời đối chiếu fingerprint bằng kênh đáng tin cậy.

**Bác sĩ cố tình ký bản có dữ liệu xấu có phát hiện được không?**
Chữ ký vẫn có thể hợp lệ. Mật mã chứng minh tính toàn vẹn theo khóa, không kiểm chứng chỉ định y tế đúng hay sai. Cần thêm phân quyền, phê duyệt và kiểm toán.

**Có database, đăng nhập, khóa tồn tại vĩnh viễn không?**
Chưa. Đây là ứng dụng học thuật chạy trong trình duyệt; khóa bí mật không xuất được, lịch sử bản ký chỉ trong bộ nhớ tab.

**Mất Wi-Fi thì sao?**
Chạy thư mục repo qua localhost bằng Python; dữ liệu giả lập và mật mã vẫn hoạt động, có thể chỉ khác font Google nếu offline.
