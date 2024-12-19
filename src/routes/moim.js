const express = require("express");
const moimController = require("../controller/moimController");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const sharp = require("sharp");
const fs = require("fs");

const moimStorage = multer.diskStorage({
  destination: (req, file, callback) => {
    callback(null, path.join(__dirname, "../public/assets/images/moim"));
  },
  filename: (req, file, callback) => {
    console.log("ffff123", file);
    callback(null, file.originalname);
  },
});

const chatStorage = multer.diskStorage({
  destination: (req, file, callback) => {
    callback(null, path.join(__dirname, "../public/assets/images/chat"));
  },
  filename: (req, file, callback) => {
    callback(null, file.originalname);
  },
});

// 파일 필터링 (이미지 파일만 허용)
const moimFileFilter = (req, file, callback) => {
  const allowedTypes = /jpeg|jpg|png/;
  const extName = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimeType = allowedTypes.test(file.mimetype);

  console.log("extName", extName);
  if (extName && mimeType) {
    callback(null, true);
  } else {
    callback(new Error("Only images are allowed!"), false);
  }
};

const chatFileFilter = (req, file, callback) => {
  const allowedTypes = /jpeg|jpg|png/;
  const extName = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimeType = allowedTypes.test(file.mimetype);

  console.log("extName", extName);
  if (extName && mimeType) {
    callback(null, true);
  } else {
    callback(new Error("Only images are allowed!"), false);
  }
};

const upload = multer({ storage: moimStorage, limits: { fileSize: 5 * 1024 * 1024 }, moimFileFilter }).single("image");

// Multer 업로드 설정
const chatUpload = multer({
  storage: chatStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 최대 파일 크기: 5MB
  fileFilter: chatFileFilter,
}).single("image");

// 카테고리 조회
router.get("/category", moimController.getCategories);
router.post("/getMoreMessage", moimController.getMoreMessage);
router.get("/myMoim/:users_id", moimController.getMyMoim);
router.get("/inviteList/:users_id", moimController.getInviteList);
router.get("/like/:users_id", moimController.getLikeMoimList);
router.post("/edit/:meetings_id", moimController.editMoim);
router.post("/setMoimLogo", upload, async (req, res) => {
  try {
    await moimController.setMoimLogo(req, res);
  } catch (error) {
    res.status(500).json({ error: "Upload failed", details: error.message });
  }
});

// 채팅 이미지 업로드 및 최적화
router.post("/chat/image", chatUpload, async (req, res) => {
  console.log("sdfsdf", req.file.path);

  try {
    const originalPath = req.file.path; // 원본 파일 경로
    const optimizedPath = path.join(__dirname, "../public/assets/images/chat/optimized-" + req.file.filename);

    // Sharp를 이용해 이미지 최적화
    await sharp(originalPath)
      .resize(300) // 너비 300px로 리사이즈
      .jpeg({ quality: 80 }) // 품질 80%로 압축
      .toFile(optimizedPath);

    // 원본 이미지 삭제
    fs.unlinkSync(originalPath);

    // 최적화된 이미지의 URL 반환
    const fileUrl = `/assets/images/chat/optimized-${req.file.filename}`;
    res.status(200).json({ url: fileUrl });
  } catch (error) {
    console.error("Image processing error:", error);
    res.status(500).json({ error: "Image processing failed", details: error.message });
  }
});

module.exports = router;
