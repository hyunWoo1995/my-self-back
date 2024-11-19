const jwt = require("../utils/jwt-util");
const { redisClient, getRedisData } = require("../utils/redis");
const userModel = require("../model/userModel");
const dotenv = require("dotenv");
dotenv.config(); // .env가져오기

const userController = {
  async getUserMyInfo(req, res) {
    const { userId } = req;
    try {
      const userInfo = await userModel.findByUser(userId);
      if (!userInfo) {
        return res.sendError(404, '사용자 정보를 찾을 수 없습니다.');
      }
      return res.sendSuccess('User info', userInfo);
    } catch (err) {
      return res.sendError(500);
    }
  },
  async getUserList(req, res) {
    const { id } = req.query;
    console.log("id", id);
    res.json({ message: "User list1" });
  },
};

module.exports = userController;
