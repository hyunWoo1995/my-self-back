const express = require("express");
const moimController = require("../controller/moimController");
const router = express.Router();

// 카테고리 조회
router.get("/category", moimController.getCategories);
router.post("/getMoreMessage", moimController.getMoreMessage);
router.post("/likeMeeting", moimController.handleLikeMeeting);

module.exports = router;
