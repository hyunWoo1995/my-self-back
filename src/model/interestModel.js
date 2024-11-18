const db = require("../../db");

const Interest = {
  // 관심사 리스트
  async getInterestList() {
    const [rows] = await db.query("SELECT * FROM interests ");
    return rows;
  },
};
module.exports = Interest;
