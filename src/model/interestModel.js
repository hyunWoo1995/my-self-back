const db = require("../../db");

const Interest = {
  // 이메일로 사용자 찾기
  async getInterestList() {
    const [rows] = await db.query("SELECT * FROM interests ");
    return rows; // 사용자 존재하면 첫 번째 row 반환
  },
};
module.exports = Interest;
