const { getRedisData } = require("../utils/redis");
const userModel = require("../model/userModel");

const userController = {
  async getUserInfo(req, res) {
    const { id } = req.params;
    const token = req.headers.authorization?.split(" ")[1];

    const accessToken = await getRedisData(`accessToken:${id}`);

    if (token !== accessToken)
      return res.status(400).json({ message: "본인 토큰값이 아닙니다." });

    const userInfo = await userModel.findByUser(id);
    res.status(201).json({ ok: true, message: "User info", data: userInfo });
  },
  async getUserList(req, res) {
    const { id } = req.query;
    console.log("id", id);
    res.json({ message: "User list1" });
  },
};

module.exports = userController;
