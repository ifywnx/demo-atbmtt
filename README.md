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

## Tính năng mở rộng cho demo trước lớp (2026)

### 1. Ký hồ sơ trên máy bác sĩ, kiểm tra trên máy dược sĩ

1. Máy **A** mở https://demo-atbmtt.vercel.app/, chờ khóa RSA sẵn sàng, chọn **Tạo hồ sơ & ký số**.
2. Tại **Góc bác sĩ**, chọn **Xuất hồ sơ đã ký (.json)**. File chứa hồ sơ, SHA-256, chữ ký RSA-PSS 2048-bit và **chỉ Public Key JWK**, tuyệt đối không chứa Private Key.
3. Chuyển tệp JSON sang máy **B**. Máy B mở đúng website (không cần cùng khóa, tài khoản hoặc phiên trình duyệt).
4. Tại **Góc dược sĩ**, chọn tệp JSON rồi bấm **Xác minh hồ sơ nhập**.
5. Khi tệp nguyên vẹn, kết quả **HỢP LỆ · TOÀN VẸN**. Sửa trường **Liều dùng nhận được** thành "4 viên/lần" rồi xác minh lần nữa, hệ thống báo **PHÁT HIỆN CAN THIỆP**.

**Tại sao kiểm chứng được bằng máy khác?** Dược sĩ chỉ cần bản ghi đã ký, chữ ký RSA-PSS và Public Key. Web Crypto tự băm lại dữ liệu chuẩn hóa rồi xác minh chữ ký công khai. Khóa bí mật không cần và không được gửi sang máy B.

**Giới hạn quan trọng:** Public Key gửi cùng file chưa chứng minh khóa thuộc một bác sĩ cụ thể. Muốn xác thực danh tính người ký cần thiết lập tin cậy bên ngoài, ví dụ chứng thư số và PKI. Người nhận phải xác nhận Public Key qua kênh tin cậy. Đây là demo tính toàn vẹn, **không phải chữ ký y tế có giá trị pháp lý**.

### 2. Demo tự động có tạm dừng

Ở đầu trang, sử dụng **Chạy demo** để xem bốn cảnh diễn ra với các phép mật mã thật:

1. Tạo bản ghi mẫu và ký RSA-PSS.
2. Xác minh bản ghi nguyên gốc thành công.
3. Thay liều thuốc từ 1 lên 4 viên/lần (không cập nhật chữ ký).
4. Xác minh lần hai để phát hiện thay đổi.

**Tạm dừng / Tiếp tục** tạm dừng giữa các cảnh; **Dừng** kết thúc chuỗi và có thể chạy lại. Không tự giả mạo trạng thái đã xác minh, mỗi bước đợi Web Crypto trả kết quả thật.

### 3. Lịch sử phiên bản ký lại

Trong mục **Cập nhật hợp lệ và ký lại**: sửa thuốc hoặc liều dùng trên form ở trên, bấm **Ký phiên bản mới**. Phiên bản V1, V2, V3... có chữ ký RSA-PSS và SHA-256 riêng, cùng nút **Kiểm tra Vn** để kiểm tra bản lưu.

Lịch sử chỉ nằm trong bộ nhớ tab, mất khi tải lại. Các chữ ký riêng chứng minh nội dung từng bản, nhưng lịch sử chưa có cơ sở dữ liệu và log chống sửa đổi.

## Bản FINAL dành cho buổi trình chiếu

- **Website chính thức:** https://demo-atbmtt.vercel.app/
- **Hướng dẫn thuyết trình 5 phút + câu hỏi phản biện:** [PRESENTER_GUIDE.md](./PRESENTER_GUIDE.md)
- **Tự kiểm thử mật mã trong website:** Nhấn **Chạy tự kiểm thử** tại Nhật ký (mong đợi 4/4).
- **Kiểm thử giao thức trên Node.js 20+:** chạy **node tests/crypto-smoke.mjs** ở thư mục repo (7 tình huống SHA-256/RSA-PSS).
- **Fingerprint của dược sĩ:** Có thể so với fingerprint SHA-256/SPKI ở máy bác sĩ qua kênh tin cậy; fingerprint khớp không tự chứng nhận danh tính người ký.
- **Trước giờ báo cáo:** tải lại web để bắt đầu phiên mới, chạy tự kiểm thử, chạy demo tự động một lượt, thử xuất/nhập JSON trên hai cửa sổ.

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
├── advanced.css # Giao diện 2 vai trò, tự động & phiên bản
├── advanced.js  # Xác minh độc lập giữa 2 máy, phiên bản & playback
├── favicon.svg  # Biểu tượng thương hiệu MEDSEAL
├── tests/
│   └── crypto-smoke.mjs # 7 tình huống kiểm thử mật mã
├── PRESENTER_GUIDE.md  # Kịch bản thuyết trình 5 phút
└── README.md    # Hướng dẫn chạy và thuyết trình
~~~

**Made for educational use — Nhóm 5 · N02 · 2026.**
