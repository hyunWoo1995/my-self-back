const express = require("express");
const moimController = require("../controller/moimController");
const router = express.Router();
const multer = require("multer");
const upload = multer();

// 카테고리 조회
router.get("/category", moimController.getCategories);
router.post("/getMoreMessage", moimController.getMoreMessage);
// 라우터 설정
router.post("/setMoimLogo", upload.single("file"), async (req, res) => {
  try {
    await moimController.setMoimLogo(req, res);
  } catch (error) {
    res.status(500).json({ error: "Upload failed", details: error.message });
  }
});

module.exports = router;
