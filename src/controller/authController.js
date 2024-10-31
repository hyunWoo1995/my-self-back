const jwt = require("../utils/jwt-util");
const bcrypt = require("bcryptjs");
const redisClient = require("../utils/redis");
const userModel = require("../model/userModel");

const authController = {
  //회원 가입
  async register(req, res) {
    const { email, name, password } = req.body;
    try {
      // 이메일 중복 확인
      const existingUser = await userModel.findByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "중복된 계정입니다." });
      }
      // 비밀번호 해시 처리
      const hashedPassword = await bcrypt.hash(password, 10);
      // 새로운 사용자 생성
      const userId = await userModel.createUser(name, email, hashedPassword);
      res.status(201).json({ message: "회원가입 완료", userId });
    } catch (error) {
      console.error("Error:", error);
      res.status(500).json({ message: "서버 에러가 발생했습니다." });
    }
  },
  async login(req, res) {
    const { email, password } = req.body;
    try {
      // 1. 사용자가 존재하는지 이메일로 찾기
      const user = await userModel.findByEmail(email);
      if (!user) {
        return res.status(401).send({
          ok: false,
          message: "계정 정보가 틀렸습니다. 확인바랍니다.",
        });
      }
      // 2. 비밀번호 확인
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).send({
          ok: false,
          message: "계정 정보가 틀렸습니다. 확인바랍니다.",
        });
      }
      // access token과 refresh token을 발급합니다.
      const accessToken = jwt.sign(user);
      const refreshToken = jwt.refresh();
      // 발급한 refresh token을 redis에 key를 user의 id로 하여 저장합니다.
      redisClient.set(toString(user.id), refreshToken);

      // redisClient.get(toString(user.id), (err, value) => {
      //   console.log("value", value); // 123
      // });
      res.status(200).send({
        ok: true,
        data: {
          accessToken,
          refreshToken,
        },
      });
    } catch (error) {
      console.error("로그인 중 에러 발생:", error);
      res.status(500).send({
        ok: false,
        message: "서버 에러가 발생했습니다.",
      });
    }
  },
};
module.exports = authController;
