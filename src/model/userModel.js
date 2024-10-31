// models/userModel.js
const db = require("../../db");

const User = {
  // 사용자 생성
  async createUser(name, email, hashedPassword) {
    const [result] = await db.query(
      "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
      [name, email, hashedPassword]
    );
    console.log("result", result);
    return result.insertId;
  },

  // 이메일로 사용자 찾기
  async findByEmail(email) {
    const [rows] = await db.query("SELECT * FROM users WHERE email = ?", [
      email,
    ]);
    return rows[0]; // 사용자 존재하면 첫 번째 row 반환
  },
};

module.exports = User;
