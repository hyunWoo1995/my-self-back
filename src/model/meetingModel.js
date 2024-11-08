const db = require("../../db");

// 모임 생성
exports.generateMeeting = async ({ name, region_code, maxMembers, users_id, description }) => {
  const [rows] = await db.query("insert meetings set name = ?, region_code = ?, created_at = ?, max_members = ?, event_date = ?, creator_id = ?, description = ?", [
    name,
    region_code,
    new Date(),
    maxMembers,
    new Date(2024, 12, 25),
    users_id,
    description,
  ]);

  return rows;
};

// 모임 조회
exports.getMeetingList = async ({ region_code }) => {
  const [rows] = await db.query(
    "select m.*, COUNT(u.id) AS userCount from meetings m left join meetings_users u on m.id = u.meetings_id where m.region_code = ? group by m.id order by m.created_at desc",
    [region_code]
  );

  return rows;
};

// 모임 입장
exports.enterMeeting = async (data) => {
  const [isEntered] = await db.query("SELECT * FROM meetings_users where meetings_id = ? and users_id = ?;", [data.meetings_id, data.users_id]);

  if (isEntered.filter((v) => v.users_id === data.users_id).length > 0) {
    return;
  }
  const [rows] = await db.query("insert meetings_users set meetings_id = ?, users_id = ?", [data.meetings_id, data.users_id]);

  // if (rows.affectedRows > 0) {
  // }

  return rows;
};

// 메세지 전체 조회
exports.getMessages = async (meetings_id) => {
  const [rows] = await db.query("select * from messages where meetings_id = ?", [meetings_id]);

  return rows;
};

// 메세지 단일 조회
exports.getMessage = async (meetings_id, id) => {
  const [rows] = await db.query("select * from messages where meetings_id = ? and id= ?", [meetings_id, id]);

  return rows[0];
};

// 메세지 보내기
exports.sendMessage = async (data) => {
  const [rows] = await db.query("insert messages set meetings_id = ?, created_at = ?, contents = ?, users_id = ?", [data.meetings_id, new Date(), data.contents, data.users_id]);

  return rows;
};

// 미팅 데이터 조회
exports.getMeetingData = async (data) => {
  const [rows] = await db.query("select m.*, u.nickname as creator_name from meetings m join users u on m.creator_id = u.id where m.id = ?", data.meetings_id);

  return rows[0];
};
