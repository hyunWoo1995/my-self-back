// models/userModel.js
const db = require("../../db");

const User = {
  // 사용자 생성
  async createUser(params) {
    const email = params.email;
    const password = params.hashedPassword || null;
    const nickname = params.nickname || null;
    const provider = params.provider || null;
    const provider_id = params.provider_id || null;
    const ip = params.ip || null;
    const [result] = await db.query(
      `INSERT INTO users (email, password, nickname, provider, provider_id, ip) 
      VALUES (?, ?, ?, ?, ?, ?)`,
      [email, password, nickname, provider, provider_id, ip]
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
