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

  async createUserAddress(params) {
    try {
      const user_id = params.user_id;
      const address_id = params.address_id;
      const prev_address_id = params.prev_address_id;

      const [exsistingData] = await db.query("select * from user_address where address_id = ? and user_id = ?", [address_id, user_id]);

      if (exsistingData.length > 0) {
        throw new Error("이미 존재하는 데이터입니다.");
      }

      const query = prev_address_id
        ? `update user_address set address_id = ? where address_id = ? and user_id = ?`
        : `INSERT INTO user_address (user_id, address_id) 
      VALUES (?, ?)`;

      if (prev_address_id) {
        const [result] = await db.query(query, [address_id, prev_address_id, user_id]);
        return result.insertId;
      } else {
        const [result] = await db.query(query, [user_id, address_id]);
        return result.insertId;
      }
    } catch (err) {
      console.error("err", err);
    }
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
    u.birthdate,
    u.gender,
    u.provider,
    u.like,
    u.profile_image_name,
    -- 주소 목록 서브쿼리로 생성 (중복 제거)
    (
        SELECT JSON_ARRAYAGG(
                  JSON_OBJECT(
                      'id', distinct_addresses.id,
                      'address', distinct_addresses.address,
                      'address_code', distinct_addresses.address_code,
                      'region_1depth_name', distinct_addresses.region_1depth_name,
                      'region_2depth_name', distinct_addresses.region_2depth_name,
                      'region_3depth_name', distinct_addresses.region_3depth_name
                  )
              )
        FROM (
            SELECT DISTINCT a.id, a.address, a.address_code, a.region_1depth_name, a.region_2depth_name, a.region_3depth_name
            FROM address a
            JOIN user_address ua ON ua.address_id = a.id
            WHERE ua.user_id = u.id
        ) AS distinct_addresses
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
    try {
      const [rows] = await db.query(query, queryParams);
      return rows[0];
    } catch (err) {
      console.error("errr", err);
    }
    // const [rows] = await db.query("SELECT * FROM users WHERE id = ?", [id]);
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

  // 주소정보 가져오기
  async findAddress(params) {
    // const user_id = params.user_id || null;
    const address = params.address || null;

    let query = "SELECT address, address_code FROM address WHERE 1";
    const queryParams = [];

    // if (user_id !== null) {
    //   query += " AND user_id = ?";
    //   queryParams.push(user_id);
    // }
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
