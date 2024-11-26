// models/userModel.js
const db = require("../../db");

const User = {
  // 사용자 생성
  async createUser(params) {
    const email = params.email;
    const password = params.hashedPassword || null;
    const nickname = params.nickname || null;
    const birthdate = params.birthdate || null;
    const gender = params.gender || null;
    const provider = params.provider || null;
    const provider_id = params.provider_id || null;
    const ip = params.ip || null;
    const [result] = await db.query(
      `INSERT INTO users (email, password, nickname, birthdate, gender, provider, provider_id, ip) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [email, password, nickname, birthdate, gender, provider, provider_id, ip]
    );
    return result.insertId;
  },
  async createUserInterest(params) {
    const user_id = params.user_id;
    const interest_id = params.interest_id;

    const [result] = await db.query(
      `INSERT INTO user_interests (user_id, interest_id) 
      VALUES (?, ?)`,
      [user_id, interest_id]
    );
    return result.insertId;
  },
  async createUserAddresses(params) {
    const user_id = params.user_id;
    const address = params.address;
    const address_code = params.address_code;

    const [result] = await db.query(
      `INSERT INTO user_addresses (user_id, address, address_code) 
      VALUES (?, ?, ?)`,
      [user_id, address, address_code]
    );
    return result.insertId;
  },

  // 이메일로 사용자 찾기
  async findByEmail(email) {
    const [rows] = await db.query("SELECT * FROM users WHERE email = ?", [
      email,
    ]);
    return rows[0]; // 사용자 존재하면 첫 번째 row 반환
  },

  // 닉네임으로 사용자 찾기
  async findByNickName(nickname) {
    const [rows] = await db.query("SELECT * FROM users WHERE nickname = ?", [
      nickname,
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
