const express = require("express");
const authController = require("../controller/authController");
const router = express.Router();

// 사용자 등록
router.post("/register", authController.register);
// 로그인
router.post("/login", authController.login);

module.exports = router;
