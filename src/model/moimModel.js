const db = require("../../db");
const { encryptMessage } = require("../utils/aes");
const { isAfterDate } = require("../utils/date");

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
    "select m.*, c.name as category1_name, c2.name as category2_name , COUNT(u.id) AS userCount from meetings m left join meetings_users u on m.id = u.meetings_id join category c on m.category1 = c.id join category c2 on m.category2 = c2.id where m.region_code = ? group by m.id order by m.created_at desc",
    [region_code]
  );

  return rows;
};

// 단일 모임 조회
exports.getMeetingItem = async ({ meetings_id }) => {
  const [rows] = await db.query("select * from meetings where id = ?", [meetings_id]);

  return rows;
};

// 나의 모임 조회
exports.getMyList = async ({ users_id }) => {
  const [rows] = await db.query("select * from meetings_users where users_id = ?", [users_id]);

  return rows;
};

// 일반 모임 입장
exports.generalMoimEnter = async ({ meetings_id, users_id }) => {
  const [rows] = await db.query("insert meetings_users set meetings_id = ?, users_id = ?, status = 1", [meetings_id, users_id]);

  return rows;
};

// 모임 입장
exports.enterMeeting = async ({ meetings_id, users_id, type, creator }) => {
  const [existingData] = await db.query("SELECT * FROM meetings_users WHERE meetings_id = ? AND users_id = ?", [meetings_id, users_id]);

  if (existingData.length > 0) {
    const [rows] = await db.query("UPDATE meetings_users SET status = ?, last_active_time = ? WHERE meetings_id = ? AND users_id = ?", [
      type === 3 || creator ? 1 : 0,
      new Date(),
      meetings_id,
      users_id,
    ]);
    return rows;
  } else {
    const [rows] = await db.query("INSERT INTO meetings_users (meetings_id, users_id, status, last_active_time) VALUES (?, ?, ?, ?)", [
      meetings_id,
      users_id,
      type === 3 || creator ? 1 : 0,
      new Date(),
    ]);
    return { DATA: rows, CODE: "EM000" };
  }

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
};

// 모임 - 유저 active time 변경
exports.modifyActiveTime = async ({ meetings_id, users_id }) => {
  const [row] = await db.query("update meetings_users set last_active_time = ? where meetings_id = ? and users_id in (?)", [new Date(), meetings_id, users_id]);

  return row;
};

//

// 메세지 전체 조회
exports.getMessages = async ({ meetings_id, length }) => {
  const [lists] = await db.query(
    "SELECT m.id, m.contents, m.created_at, m.users_id, m.meetings_id, m.users, u.nickname, m.admin FROM moimmoim.messages AS m left join users u on m.users_id = u.id where meetings_id = ? ORDER BY  m.created_at DESC limit 0,20;",
    [meetings_id]
  );

  // const [meetingsUsers] = await db.query("select * from meetings_users where meetings_id = ? and status = 1", [meetings_id]);

  // const parseList = lists.reduce((result, cur) => {
  //   // 메세지가 만들어진 시간이랑 유저들의 활동 시간을 필터
  //   const unReadCount = meetingsUsers.length - meetingsUsers.filter((v) => isAfterDate(v.last_active_time, cur.created_at)).length;
  //   result.push({ ...cur, unReadCount });

  //   return result;
  // }, []);

  const [[{ total_count }]] = await db.query(
    `
      SELECT COUNT(*) AS total_count
  FROM messages 
  WHERE meetings_id = ?;
    `,
    [meetings_id]
  );

  return { lists: lists, total: total_count };
};

// 메세지 단일 조회
exports.getMessage = async (meetings_id, id, usersInRoom) => {
  const [rows] = await db.query("select m.*, u.nickname from messages m left join users u on m.users_id = u.id where meetings_id = ? and m.id= ?", [meetings_id, id]);

  // const [meetingsUsers] = await db.query("select * from meetings_users where meetings_id = ? and status = 1", [meetings_id]);

  const message = rows[0];

  return message;
};

// 메세지 더 받아오기
exports.getMoreMessage = async ({ meetings_id, length }) => {
  const [rows] = await db.query("SELECT m.* FROM messages m WHERE m.meetings_id = ? ORDER BY m.created_at desc limit ?, 20;", [meetings_id, length]);
  return rows;
};

// 메세지 보내기
exports.sendMessage = async (data) => {
  const [rows] = await db.query("insert messages set meetings_id = ?, created_at = ?, contents = ?, users_id = ?, users = ?, admin = ?", [
    data.meetings_id,
    new Date(),
    data.contents,
    data.users_id,
    data.users,
    data.admin || 0,
  ]);

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

  // return { category1: rows.filter((v) => !v.parent_id), category2: rows.filter((v) => v.parent_id) };
  return rows;
};

// 마지막 읽은 메세지 수정
// exports.updateRead = async (data) => {
//

//   const [rows] = await db.query("update meetings_users set last_read_message = ? where meetings_id = ? and users_id = ? ", [data.id, data.meetings_id, data.users_id]);
// };

// 마지막 읽은 메세지 조회
exports.lastRead = async ({ meetings_id, users_id }) => {
  const [[{ last_read_message }]] = await db.query("select * from meetings_users where meetings_id = ? and users_id = ?", [meetings_id, users_id]);

  return last_read_message;
};

// 모임-유저 조회
exports.getMeetingsUsers = async ({ meetings_id }) => {
  const [rows] = await db.query("select * from meetings_users where meetings_id = ?", meetings_id);

  return rows;
};
