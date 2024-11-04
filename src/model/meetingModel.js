const db = require("../../db");

// 모임 생성
exports.generateMeeting = async () => {
  const [rows] = await db.query("insert meetings set name = ?, region_code = ?, created_at = ?, max_members = ?, event_date = ?, creator_id = ?", [
    "test",
    "A02",
    new Date(),
    10,
    new Date(2024, 12, 25),
    1,
  ]);

  return rows;
};

// 모임 조회
exports.getMeetingList = async () => {
  const [rows] = await db.query("select * from meetings where region_code = ?", ["A02"]);

  return rows;
};

// 메세지 조회
exports.getMessages = async (meetings_id) => {
  const [rows] = await db.query("select * from messages where meetings_id = ?", [meetings_id]);

  return rows;
};

// 메세지 보내기
exports.sendMessage = async (data) => {
  const [rows] = await db.query("insert messages set meetings_id = ?, created_at = ?, contents = ?, users_id = ?", [2, new Date(), "테스트 문자!", 99]);

  return rows;
};
