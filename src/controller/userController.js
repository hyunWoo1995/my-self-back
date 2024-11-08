const bcrypt = require("bcryptjs");
const userModel = require("../model/userModel");

const userController = {
  async getUserList(req, res) {
    // const { email, password } = req.body;
    res.json({ message: "User list1" });
  },
};

module.exports = userController;
