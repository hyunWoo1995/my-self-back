const jwt = require("../utils/jwt-util");
const { redisClient, getRedisData } = require("../utils/redis");
const userModel = require("../model/userModel");
const dotenv = require("dotenv");
dotenv.config(); // .env가져오기

const userController = {
  async getUserMyInfo(req, res) {
    const token = req.headers.authorization?.split(" ")[1];
    try {
      // JWT 토큰을 검증하고 사용자 정보 추출
      const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
      const { userId } = decoded;
      const accessToken = await getRedisData(`accessToken:${userId}`);

      if (token !== accessToken) {
        return res.status(400).json({ message: "본인 토큰값이 아닙니다." });
      }
      const userInfo = await userModel.findByUser(userId);
      if (!userInfo) {
        return res.status(404).json({ message: "사용자 정보를 찾을 수 없습니다." });
      }
      return res.status(200).json({ ok: true, message: "User info", data: userInfo });
    } catch (err) {
      return res.status(401).json({ message: "유효하지 않은 토큰입니다." });
    }
  },
  async getUserList(req, res) {
    const { id } = req.query;
    console.log("id", id);
    res.json({ message: "User list1" });
  },
};

module.exports = userController;
