const db = require("../../db");

// 모임 생성
exports.generateMeeting = async ({ name, region_code, maxMembers, users_id, description }) => {
  const [rows] = await db.query("insert meetings set name = ?, region_code = ?, created_at = ?, max_members = ?, event_date = ?, creator_id = ?, description = ?, type = 4", [
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
    "select m.*, COUNT(u.id) AS userCount from meetings m left join meetings_users u on m.id = u.meetings_id where m.region_code = ? and u.status = 1 group by m.id order by m.created_at desc",
    [region_code]
  );

  return rows;
};

// 모임 입장
exports.enterMeeting = async (data) => {
  // 신청 목록에 있는지 확인
  const [meetingUserData] = await db.query("SELECT * FROM meetings_users where meetings_id = ? and users_id = ?;", [data.meetings_id, data.users_id]);

  // 신청 목록 없음
  if (meetingUserData?.length === 0) {
    if (data?.creator) {
      const [rows] = await db.query("insert meetings_users set meetings_id = ?, users_id = ?, status = 1", [data.meetings_id, data.users_id]);
      return { DATA: rows, CODE: "EM000" };
    }
    // 비밀 모임인지 확인
    const [meetingTypeData] = await db.query("select type from meetings where id = ?", [data.meetings_id]);
    console.log("meetingTypeData", meetingTypeData);
    // 일반:3, 비밀:4
    if (meetingTypeData[0].type === 4) {
      const [rows] = await db.query("insert meetings_users set meetings_id = ?, users_id = ?, status = 0", [data.meetings_id, data.users_id]);

      return { DATA: "입장 신청되었습니다.", CODE: "EM001" };
    } else {
      const [rows] = await db.query("insert meetings_users set meetings_id = ?, users_id = ?, status = 1", [data.meetings_id, data.users_id]);
      return { CODE: "EM000" };
    }
  }

  // 들어온 적 있는지 확인
  console.log("meetingUserDatameetingUserData", meetingUserData);
  const isEntered = !!(meetingUserData[0]?.status === 1);

  console.log("isEntered", isEntered);

  if (isEntered) {
    return { CODE: "EM000" };
  } else {
    return { DATA: "입장 신청되었습니다.", CODE: "EM001" };
  }
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
  const [rows] = await db.query(
    "SELECT m.*, u.nickname AS creator_name, (SELECT COUNT(*) FROM meetings_users mu WHERE mu.meetings_id = m.id and mu.status = 1) AS userCount FROM meetings m JOIN users u ON m.creator_id = u.id WHERE m.id = ?",
    [data.meetings_id]
  );

  return rows[0];
};
