const multer = require("multer");

// 메모리 저장소 설정
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 파일 크기 5MB 제한
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/gif"];
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error("지원하지 않는 파일 형식입니다."), false);
    }
    cb(null, true);
  },
});

module.exports = upload;
