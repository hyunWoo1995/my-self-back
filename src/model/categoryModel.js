const db = require("../../db");

exports.getCategorysInterest = async () => {
  const [rows] = await db.query(
    "select * from category where parent_id is null"
  );
  return rows;
};
