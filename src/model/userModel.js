// models/userModel.js
const db = require("../../db");

const User = {
  // 사용자 생성
  async createUser(params) {
    const [result] = await db.query(
      "INSERT INTO users (name, email, password, nickname) VALUES (?, ?, ?, ?)",
      [params.name, params.email, params.hashedPassword, params.nickname]
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

  // 회원정보 가져오기
  async findByUser(id) {
    const [rows] = await db.query("SELECT * FROM users WHERE id = ?", [id]);
    return rows[0]; // 사용자 존재하면 첫 번째 row 반환
  },
};

module.exports = User;
