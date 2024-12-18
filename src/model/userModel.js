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
    const profileImageName = params.profileImageName || null;
    const ip = params.ip || null;
    const [result] = await db.query(
      `INSERT INTO users (email, password, nickname, birthdate, gender, provider, profile_image_name, ip) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [email, password, nickname, birthdate, gender, provider, profileImageName, ip]
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
    console.log("ppsdfpsdpfp", params);

    const user_id = params.user_id;
    const address_id = params.address_id;
    const [result] = await db.query(
      `INSERT INTO user_address (user_id, address_id) 
      VALUES (?, ?)`,
      [user_id, address_id]
    );
    return result.insertId;
  },

  // 이메일로 사용자 찾기
  async findByEmail(email, provider = null) {
    let query = "SELECT * FROM users WHERE email = ?";
    const params = [email];

    if (provider !== null) {
      query += " AND provider = ?";
      params.push(provider);
    }

    const [rows] = await db.query(query, params);
    return rows[0];
  },

  // 닉네임으로 사용자 찾기
  async findByNickname(nickname) {
    const [rows] = await db.query("SELECT * FROM users WHERE nickname = ?", [nickname]);
    return rows[0];
  },

  // 회원정보 가져오기
  async findByUser(id) {
    let query = `
      SELECT 
        u.id AS user_id,
        u.nickname,
        u.email,
        u.nickname,
        u.birthdate,
        u.gender,
        u.provider,
        u.like,
        u.profile_image_name,
        -- 주소 목록 서브쿼리로 생성
        (
            SELECT JSON_ARRAYAGG(
                      JSON_OBJECT(
                          'address', ua.address,
                          'address_code', ua.address_code,
                          'region_1depth_name', ua.region_1depth_name,
                          'region_2depth_name', ua.region_2depth_name,
                          'region_3depth_name', ua.region_3depth_name
                      )
                  )
            FROM address ua
            WHERE ua.user_id = u.id
        ) AS addresses,
          -- 관심사 목록 서브쿼리로 생성
        (
            SELECT JSON_ARRAYAGG(
                      JSON_OBJECT(
                          'interest_id', ui.interest_id,
                          'interest_name', c.interest
                      )
                  )
            FROM user_interests ui
            LEFT JOIN category c ON ui.interest_id = c.id
            WHERE ui.user_id = u.id
        ) AS interests
    FROM users u
    WHERE u.id = ?;
    `;
    const queryParams = [id];
    const [rows] = await db.query(query, queryParams);
    // const [rows] = await db.query("SELECT * FROM users WHERE id = ?", [id]);
    return rows[0];
  },

  // 이메일 가져오기
  async findByUserEmail(id) {
    const [rows] = await db.query("SELECT email FROM users WHERE id = ?", [id]);
    return rows[0].email;
  },

  async findByUserNickname(id) {
    const [[{ nickname }]] = await db.query("select nickname from users where id = ?", [id]);

    return nickname;
  },

  // 회원 주소정보 가져오기
  async findByUserAddresses(params) {
    const user_id = params.user_id || null;
    const address = params.address || null;

    let query = "SELECT address, address_code FROM address WHERE 1";
    const queryParams = [];

    if (user_id !== null) {
      query += " AND user_id = ?";
      queryParams.push(user_id);
    }
    if (address !== null) {
      query += " AND address = ?";
      queryParams.push(address);
    }

    const [rows] = await db.query(query, queryParams);
    return rows[0]?.address_code || null;
  },
  // 가장 높은 address_code 가져오기
  async getHighestAddressCode() {
    const [rows] = await db.query("SELECT MAX(address_code) AS max_code FROM address");
    return rows[0]?.max_code || null;
  },
};

module.exports = User;
