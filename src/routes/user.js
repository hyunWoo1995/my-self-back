const express = require("express");
const userController = require("../controller/userController");
const router = express.Router();

// 사용자 목록을 반환하는 라우트
router.get("/", userController.getUserList);

// 사용자 등록을 위한 라우트
router.post("/", (req, res) => {
  const { username } = req.body;
  // 사용자 등록 로직 (예: 데이터베이스에 추가)
  res.status(201).json({ message: `User ${username} registered` });
});

router.get("/myInfo", userController.getUserMyInfo);
router.post("/like/:receiver_id", userController.handleLikeUser);
router.get("/friendHistory/:users_id", userController.getFriendHistory);

module.exports = router;
