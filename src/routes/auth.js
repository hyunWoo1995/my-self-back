const express = require("express");
const authController = require("../controller/authController");
const router = express.Router();

// 사용자 등록
router.post("/register", authController.register);
// 로그인
router.post("/login", authController.login);
// 소셜 로그인
router.get("/:provider", authController.socialUrl);
router.get("/:provider/callback", authController.socialLogin);

module.exports = router;
