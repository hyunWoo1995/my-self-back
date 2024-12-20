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

  async handleLikeUser({ receiver_id, sender_id }) {
    const [existingData] = await db.query("select * from like_history where receiver_id = ? and sender_id = ?", [receiver_id, sender_id]);

    if (existingData.length > 0) {
      const [rows] = await db.query("update like_history set status = ?, updated_at = ? where receiver_id = ? and sender_id = ?", [
        existingData[0].status === "active" ? "inactive" : "active",
        new Date(),
        receiver_id,
        sender_id,
      ]);

      return rows;
    } else {
      const [rows] = await db.query("insert into like_history (type, sender_id, receiver_id, status, created_at) values (?,?,?,?,?)", ["user", sender_id, receiver_id, "active", new Date()]);

      return rows;
    }
  },

  async handleAddFriend({ receiver_id, sender_id }) {
    try {
      const query = `
    SELECT * 
    FROM friend_history 
    WHERE (receiver_id = ? AND sender_id = ?)
       OR (receiver_id = ? AND sender_id = ?)
  `;

      const params = [receiver_id, sender_id, sender_id, receiver_id];

      const [existingHistory] = await db.query(query, params);

      console.log("existingHistory", existingHistory);

      if (existingHistory.length > 0 && existingHistory[0].status !== 2) {
        return { CODE: "AF001", message: "동일한 요청이 존재하거나 이미 등록된 친구입니다." };
      }

      const [rows] = await db.query("insert into friend_history (receiver_id, sender_id, status) values (?,?, 0)", [receiver_id, sender_id]);

      if (rows.affectedRows > 0) {
        return { CODE: "AF000", message: "친구 추가 성공" };
      } else {
        return { CODE: "AF001", message: "친구 추가 실패" };
      }
    } catch (err) {
      throw new Error("친구 추가 에러");
    }
  },

  async handleReplyFriend({ receiver_id, sender_id, code }) {
    try {
      const query = `
    SELECT * 
    FROM friend_history 
    WHERE (receiver_id = ? AND sender_id = ?)
       OR (receiver_id = ? AND sender_id = ?)
  `;

      const params = [receiver_id, sender_id, sender_id, receiver_id];

      const [existingHistory] = await db.query(query, params);

      console.log("existingHistory", existingHistory);

      if (existingHistory.length === 0 || existingHistory[0].status !== 0) {
        return { CODE: "RF001", message: "요청이 존재하지 않거나 이미 처리된 요청입니다." };
      }

      const { receiver_id: data_receiver_id, sender_id: data_sender_id } = existingHistory[0];

      console.log("data_receiver_id", data_receiver_id);

      const [rows] = await db.query("update friend_history set status = ?, updated_at = ? where receiver_id = ? and sender_id = ?", [code, new Date(), data_receiver_id, data_sender_id]);

      if (rows.affectedRows > 0) {
        return { CODE: "RF000", message: "친구 요청 응답에 성공했습니다." };
      } else {
        return { CODE: "RF001", message: "친구 요청 응답에 실패했습니다." };
      }
    } catch (err) {
      throw new Error("친구 응답 에러");
    }
  },

  async getFriendHistory({ users_id }) {
    try {
      const [rows] = await db.query("select * from friend_history where status = 0 and (receiver_id = ?) or (sender_id = ?)", [users_id, users_id]);

      return rows;
    } catch (err) {
      throw new Error(`친구 조회 실패: ${err}`);
    }
  },
};

module.exports = User;
