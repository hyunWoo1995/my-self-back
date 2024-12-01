const express = require("express");
const authController = require("../controller/authController");
const router = express.Router();
const upload = require("../middlewares/upload")

// 사용자 등록
router.post("/register", upload.single("profileImage"), authController.register);
// 로그인
router.post("/login", authController.login);

router.get("/confirmNickname", authController.confirmNickname);

router.post("/refreshToken", authController.refreshToken);

router.post("/requestEmail", authController.requestEmail);
router.post("/confirmEmail", authController.confirmEmail);

router.get("/interests", authController.getInterests);

// 소셜 로그인
router.get("/:provider", authController.socialUrl);
router.get("/:provider/callback", authController.socialLogin);

module.exports = router;
