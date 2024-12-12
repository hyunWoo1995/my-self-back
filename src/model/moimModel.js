const db = require("../../db");
const { encryptMessage } = require("../utils/aes");
const { isAfterDate } = require("../utils/date");

// 모임 생성
exports.generateMeeting = async ({ name, region_code, maxMembers, users_id, description, type, category1, category2, date }) => {
  const [rows] = await db.query(
    "insert meetings set name = ?, region_code = ?, created_at = ?, max_members = ?, event_date = ?, creator_id = ?, description = ?, type = ?, category1= ?, category2 = ?",
    [name, region_code, new Date(), maxMembers, new Date(date), users_id, description, type, category1, category2]
  );

  return rows;
};

// 모임 조회
exports.getMeetingList = async ({ region_code }) => {
  const [rows] = await db.query(
    "select m.*, c.name as category1_name, c2.name as category2_name , COUNT(u.id) AS userCount, (select count(id) from like_history where receiver_id = m.id and status = 'active') as likeCount from meetings m left join meetings_users u on m.id = u.meetings_id join category c on m.category1 = c.id join category c2 on m.category2 = c2.id where m.region_code = ? and u.status = 1 group by m.id order by m.created_at desc",
    [region_code]
  );

  return rows;
};

// 단일 모임 조회
exports.getMeetingItem = async ({ meetings_id }) => {
  const [rows] = await db.query("select * from meetings where id = ?", [meetings_id]);

  return rows[0];
};

// 나의 모임 내역 조회
exports.getMyList = async ({ users_id }) => {
  // const [rows] = await db.query("select * from meetings_users where users_id = ?", [users_id]);

  const [rows] = await db.query(
    "select m.*, mu.users_id, mu.status, mu.last_active_time, c.name as category1_name, c2.name as category2_name, max(a.address) as address, count(mu.users_id) as userCount, (select count(id) from like_history where receiver_id = m.id and status = 'active') as likeCount from meetings_users mu join meetings m on mu.meetings_id = m.id join category c on m.category1 = c.id join category c2 on m.category2 = c2.id left join user_addresses a on a.address_code = m.region_code where users_id = ? group by mu.meetings_id",
    [users_id]
  );

  return rows;
};

// 일반 모임 입장
exports.generalMoimEnter = async ({ meetings_id, users_id }) => {
  const [rows] = await db.query("insert meetings_users set meetings_id = ?, users_id = ?, status = 1", [meetings_id, users_id]);

  return rows;
};

// 모임 입장
exports.enterMeeting = async ({ meetings_id, users_id, type, creator }) => {
  const [[{ count }]] = await db.query("select count(id) as count from meetings_users where meetings_id = ? and status = 1", [meetings_id]);

  const [[{ max_members }]] = await db.query("select max_members from meetings where id =?", [meetings_id]);

  console.log("count", count, max_members);

  if (count === max_members) {
    return { CODE: "EM002" };
  }

  const [existingData] = await db.query("SELECT * FROM meetings_users WHERE meetings_id = ? AND users_id = ?", [meetings_id, users_id]);

  // console.log("existingData", existingData[0].status);

  // const status = existingData[0].status;

  // if (status === 1) {
  //   // 재입장
  // } else if (status === 0) {
  //   // 신청 결과 중
  // } else if (status === -1) {
  //   // 퇴장했던 사람
  //   // type 3이면 입장 처리 4이면 신청
  // }

  if (existingData.length > 0) {
    const [rows] = await db.query("UPDATE meetings_users SET status = ?, last_active_time = ? WHERE meetings_id = ? AND users_id = ?", [
      type === 3 || creator ? 1 : 0,
      new Date(),
      meetings_id,
      users_id,
    ]);
    return { DATA: rows, CODE: "EM000" };
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
    "SELECT m.id, m.contents, m.created_at, m.users_id, m.meetings_id, m.users, u.nickname, m.admin, m.reply_id FROM moimmoim.messages AS m left join users u on m.users_id = u.id where meetings_id = ? ORDER BY  m.id DESC limit 0,20;",
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
exports.getMessage = async (meetings_id, id) => {
  const [rows] = await db.query("select m.*, u.nickname from messages m left join users u on m.users_id = u.id where meetings_id = ? and m.id= ?", [meetings_id, id]);

  // const [meetingsUsers] = await db.query("select * from meetings_users where meetings_id = ? and status = 1", [meetings_id]);

  const message = rows[0];

  return message;
};

// 메세지 더 받아오기
exports.getMoreMessage = async ({ meetings_id, length }) => {
  const [rows] = await db.query(
    "SELECT m.id, m.contents, m.created_at, m.users_id, m.meetings_id, m.users, u.nickname, m.admin, m.reply_id FROM messages AS m left join users u on m.users_id = u.id where meetings_id = ? ORDER BY  m.id DESC limit ?,20;",
    [meetings_id, length]
  );

  console.log("rows", rows);

  return rows;
};

// 메세지 보내기
exports.sendMessage = async (data) => {
  const [rows] = await db.query("insert messages set meetings_id = ?, created_at = ?, contents = ?, users_id = ?, users = ?, admin = ?, reply_id = ?, tag_id = ?", [
    data.meetings_id,
    new Date(),
    data.contents,
    data.users_id,
    data.users,
    data.admin || 0,
    data.reploy_id || 0,
    data.tag_id || 0,
  ]);

  return rows;
};

// 미팅 데이터 조회
exports.getMeetingData = async ({ meetings_id }) => {
  console.log("meee", meetings_id);

  const [rows] = await db.query(
    "SELECT m.*, u.nickname AS creator_name, c.name AS category1_name, c2.name AS category2_name, COUNT(mu.id) AS userCount, (select count(id) from like_history where receiver_id = ? and status = 'active') as likeCount FROM meetings m JOIN users u ON m.creator_id = u.id JOIN category c ON m.category1 = c.id JOIN category c2 ON m.category2 = c2.id LEFT JOIN meetings_users mu ON mu.meetings_id = m.id AND mu.status = 1 WHERE m.id = ? GROUP BY m.id;",
    [meetings_id, meetings_id]
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
  const [rows] = await db.query("select mu.*, u.nickname from meetings_users mu join users u on mu.users_id = u.id  where meetings_id = ?", [meetings_id]);

  return rows;
};

// 모임 좋아요
exports.handleLikeMeeting = async ({ users_id, meetings_id }) => {
  const [existingData] = await db.query("select * from like_history where receiver_id = ? and sender_id = ?", [meetings_id, users_id]);

  if (existingData.length > 0) {
    const [rows] = await db.query("update like_history set status = ?, updated_at = ? where receiver_id = ? and sender_id = ?", [
      existingData[0].status === "active" ? "inactive" : "active",
      new Date(),
      meetings_id,
      users_id,
    ]);

    return rows;
  } else {
    const [rows] = await db.query("insert into like_history (type, sender_id, receiver_id, status, created_at) values (?,?,?,?,?)", ["meeting", users_id, meetings_id, "active", new Date()]);

    return rows;
  }
};

// 모임 나가기
exports.handleLeaveMeeting = async ({ users_id, meetings_id }) => {
  const [existingData] = await db.query("select * from meetings_users where users_id = ? and meetings_id = ?", [users_id, meetings_id]);

  if (existingData.length > 0) {
    const [rows] = await db.query("update meetings_users set status = ?, updated_at = ? where users_id = ? and meetings_id = ?", [-1, new Date(), users_id, meetings_id]);
    return { DATA: rows, CODE: "LM000" };
  } else {
    return;
  }
};
