const jwt = require("../utils/jwt-util");
const { redisClient, getRedisData } = require("../utils/redis");
const azureUtil = require("../utils/azureUtil");
const userModel = require("../model/userModel");
const dotenv = require("dotenv");
dotenv.config(); // .env가져오기

const userController = {
  async getUserMyInfo(req, res) {
    console.log("req", req.body);
    const { userId } = req;
    console.log("userId", userId);
    try {
      const userInfo = await userModel.findByUser(userId);
      console.log("userInfo", userInfo);
      if (!userInfo) {
        return res.sendError(404, "사용자 정보를 찾을 수 없습니다.");
      }

      const containerName = "profile";
      // SAS URL 생성
      const sasUrl = azureUtil.downloadSasUrl(containerName, userInfo.profile_image_name);
      userInfo.profile_image_url = sasUrl;
      return res.sendSuccess("User info", userInfo);
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
