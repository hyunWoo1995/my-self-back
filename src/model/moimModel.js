const db = require("../../db");

// 모임 생성
exports.generateMeeting = async ({ name, region_code, maxMembers, users_id, description, type, category1, category2 }) => {
  const [rows] = await db.query(
    "insert meetings set name = ?, region_code = ?, created_at = ?, max_members = ?, event_date = ?, creator_id = ?, description = ?, type = ?, category1= ?, category2 = ?",
    [name, region_code, new Date(), maxMembers, new Date(2024, 12, 25), users_id, description, type, category1, category2]
  );

  return rows;
};

// 모임 조회
exports.getMeetingList = async ({ region_code }) => {
  const [rows] = await db.query(
    "select m.*, c.name as category1_name, c2.name as category2_name , COUNT(u.id) AS userCount from meetings m left join meetings_users u on m.id = u.meetings_id join category c on m.category1 = c.id join category c2 on m.category2 = c2.id where m.region_code = ? and u.status = 1 group by m.id order by m.created_at desc",
    [region_code]
  );

  return rows;
};

// 나의 모임 조회
exports.getMyList = async ({ users_id }) => {
  const [rows] = await db.query("select * from meetings_users where users_id = ?", [users_id]);

  return rows;
};

// 일반 모임 입장
exports.generalMoimEnter = async ({ meetings_id, users_id }) => {
  const [rows] = await db.query("insert meetings_users set meetings_id = ?, users_id = ?, status = 1", [data.meetings_id, data.users_id]);

  return rows;
};

// 모임 입장
exports.enterMeeting = async ({ meetings_id, users_id, type, creator }) => {
  // try {
  //   // 모임 유저 목록에 있는지 확인
  //   const [meetingUserData] = await db.query("SELECT * FROM meetings_users where meetings_id = ? and users_id = ?;", [data.meetings_id, data.users_id]);

  //   // 모임 유저 목록 없음
  //   if (meetingUserData?.length === 0) {
  //     if (data?.creator) {
  //       const [rows] = await db.query("insert meetings_users set meetings_id = ?, users_id = ?, status = 1", [data.meetings_id, data.users_id]);
  //       return { DATA: rows, CODE: "EM000" };
  //     }
  //     // 비밀 모임인지 확인
  //     const [meetingTypeData] = await db.query("select type from meetings where id = ?", [data.meetings_id]);
  //     console.log("meetingTypeData", meetingTypeData);
  //     // 일반:3, 비밀:4
  //     if (meetingTypeData[0].type === 4) {
  //       const [rows] = await db.query("insert meetings_users set meetings_id = ?, users_id = ?, status = 0", [data.meetings_id, data.users_id]);

  //       return { DATA: "입장 신청되었습니다.", CODE: "EM001" };
  //     } else {
  //       const [rows] = await db.query("insert meetings_users set meetings_id = ?, users_id = ?, status = 1", [data.meetings_id, data.users_id]);
  //       return { CODE: "EM000" };
  //     }
  //   }

  //   // 들어온 적 있는지 확인
  //   console.log("meetingUserDatameetingUserData", meetingUserData);
  //   const isEntered = !!(meetingUserData[0]?.status === 1);

  //   console.log("isEntered", isEntered);

  //   if (isEntered) {
  //     return { CODE: "EM000" };
  //   } else {
  //     return { DATA: "입장 신청되었습니다.", CODE: "EM001" };
  //   }
  // } catch (err) {
  //   console.error("entermeeting err", err);
  // }

  const [existingData] = await db.query("select * from meetings_users where meetings_id = ?, users_id = ?", [meetings_id, users_id]);

  const [rows] = await db.query(`${existingData ? "update" : "insert"} meetings_users set meetings_id = ?, users_id = ?, status = ?`, [meetings_id, users_id, type === 3 || creator ? 1 : 0]);

  // if (existingData) {
  //   const [rows] = await db.query("update meetings_users set meetings_id = ?, users_id = ?, status = ?", [meetings_id, users_id, type === 3 || creator ? 1 : 0]);
  // } else {
  //   const [rows] = await db.query("insert meetings_users set meetings_id = ?, users_id = ?, status = ?", [meetings_id, users_id, type === 3 || creator ? 1 : 0]);
  // }

  // if (type === 3 || creator) {
  //   const [rows] = await db.query("insert meetings_users set meetings_id = ?, users_id = ?, status = 1", [meetings_id, users_id]);
  //   return rows;
  // } else {
  //   const [rows] = await db.query("insert meetings_users set meetings_id = ?, users_id = ?, status = 0", [meetings_id, users_id]);
  //   return rows;
  // }
  return rows;
};

//

// 메세지 전체 조회
exports.getMessages = async (meetings_id) => {
  const [rows] = await db.query(
    "SELECT m.*, COALESCE((SELECT COUNT(mu.users_id) FROM meetings_users mu WHERE mu.meetings_id = m.meetings_id AND (mu.last_read_message IS NULL OR mu.last_read_message < m.id)), 0) AS unread_count FROM messages m WHERE m.meetings_id = ? ORDER BY m.created_at desc limit 20;",
    [meetings_id]
  );
  return rows;
};

// 메세지 단일 조회
exports.getMessage = async (meetings_id, id) => {
  const [rows] = await db.query("select * from messages where meetings_id = ? and id= ?", [meetings_id, id]);

  return rows[0];
};

// 메세지 더 받아오기
exports.getMoreMessage = async ({ meetings_id, length }) => {
  const [rows] = await db.query(
    "SELECT m.*, COALESCE((SELECT COUNT(mu.users_id) FROM meetings_users mu WHERE mu.meetings_id = m.meetings_id AND (mu.last_read_message IS NULL OR mu.last_read_message < m.id)), 0) AS unread_count FROM messages m WHERE m.meetings_id = ? ORDER BY m.created_at desc limit ?, 20;",
    [meetings_id, length]
  );
  return rows;
};

// 메세지 보내기
exports.sendMessage = async (data) => {
  const [rows] = await db.query("insert messages set meetings_id = ?, created_at = ?, contents = ?, users_id = ?", [data.meetings_id, new Date(), data.contents, data.users_id]);

  return rows;
};

// 미팅 데이터 조회
exports.getMeetingData = async (data) => {
  const [rows] = await db.query(
    "SELECT m.*, u.nickname AS creator_name, c.name AS category1_name, c2.name AS category2_name, COUNT(mu.id) AS userCount FROM meetings m JOIN users u ON m.creator_id = u.id JOIN category c ON m.category1 = c.id JOIN category c2 ON m.category2 = c2.id LEFT JOIN meetings_users mu ON mu.meetings_id = m.id AND mu.status = 1 WHERE m.id = ? GROUP BY m.id;",
    [data.meetings_id]
  );

  return rows[0];
};

// 카테고리 조회
exports.getCategories = async () => {
  const [rows] = await db.query("select * from category");

  console.log("rows", rows);

  // return { category1: rows.filter((v) => !v.parent_id), category2: rows.filter((v) => v.parent_id) };
  return rows;
};

// 마지막 읽은 메세지 수정
// exports.updateRead = async (data) => {
//   console.log("data", data);

//   const [rows] = await db.query("update meetings_users set last_read_message = ? where meetings_id = ? and users_id = ? ", [data.id, data.meetings_id, data.users_id]);
// };

// 마지막 읽은 메세지 조회
exports.lastRead = async ({ meetings_id, users_id }) => {
  const [[{ last_read_message }]] = await db.query("select * from meetings_users where meetings_id = ? and users_id = ?", [meetings_id, users_id]);

  return last_read_message;
};
