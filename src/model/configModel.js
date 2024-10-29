const db = require("../../db");

exports.test = async () => {
  const [rows] = await db.query("select * from config");

  return rows;
};
