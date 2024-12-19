const express = require("express");
const moimController = require("../controller/moimController");
const router = express.Router();
const multer = require("multer");
const path = require("path");

const storageEngine = multer.diskStorage({
  destination: (req, file, callback) => {
    callback(null, path.join(__dirname, "../public/assets/images/moim"));
  },
  filename: (req, file, callback) => {
    console.log("ffff123", file);
    callback(null, file.originalname);
  },
});

// 파일 필터링 (이미지 파일만 허용)
const fileFilter = (req, file, callback) => {
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

const upload = multer({ storage: storageEngine, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter }).single("image");

// 카테고리 조회
router.get("/category", moimController.getCategories);
router.post("/getMoreMessage", moimController.getMoreMessage);
router.get("/myMoim/:users_id", moimController.getMyMoim);
router.get("/inviteList/:users_id", moimController.getInviteList);
router.get("/like/:users_id", moimController.getLikeMoimList);

router.post("/setMoimLogo", upload, async (req, res) => {
  try {
    await moimController.setMoimLogo(req, res);
  } catch (error) {
    res.status(500).json({ error: "Upload failed", details: error.message });
  }
});

module.exports = router;
