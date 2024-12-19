const jwt = require("../utils/jwt-util");
const { redisClient, getRedisData } = require("../utils/redis");
const azureUtil = require("../utils/azureUtil");
const userModel = require("../model/userModel");
const dotenv = require("dotenv");
const moimModel = require("../model/moimModel");
dotenv.config(); // .env가져오기

const userController = {
  async getUserMyInfo(req, res) {
    const { userId } = req;
    try {
      const userInfo = await userModel.findByUser(userId);
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

  async handleLikeUser(req, res) {
    try {
      const { receiver_id } = req.params;
      const { sender_id } = req.body;

      const likeRes = await userModel.handleLikeUser({ receiver_id, sender_id });

      if (likeRes.affectedRows > 0) {
        res.sendSuccess(200, "수정 성공");
      } else {
        res.sendError(500, "수정 실패");
      }
    } catch (err) {
      res.sendError(500, err);
    }
  },
};

module.exports = userController;
