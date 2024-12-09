const db = require("../../db");

exports.getAddress = async ({ keyword }) => {
  console.log("keywordkeyword", keyword);
  const [rows] = await db.query("select * from user_addresses where address like ?", [`%${keyword}%`]);

  return rows;
};
