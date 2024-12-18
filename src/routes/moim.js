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

const upload = multer({ storage: storageEngine }).single("image");

// 카테고리 조회
router.get("/category", moimController.getCategories);
router.post("/getMoreMessage", moimController.getMoreMessage);
router.get("/myMoim/:users_id", moimController.getMyMoim);
// 라우터 설정
router.post("/setMoimLogo", upload, async (req, res) => {
  try {
    await moimController.setMoimLogo(req, res);
  } catch (error) {
    res.status(500).json({ error: "Upload failed", details: error.message });
  }
});

module.exports = router;
