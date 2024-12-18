const db = require("../../db");

exports.getAddress = async ({ keyword }) => {
  console.log("keywordkeyword", keyword);
  const [rows] = await db.query("select * from address where address like ?", [`%${keyword}%`]);

  return rows;
};

// 주소 생성
exports.createAddress = async (params) => {
  const address = params.address;
  const address_code = params.address_code;
  const region_1depth_name = params.region_1depth_name;
  const region_2depth_name = params.region_2depth_name;
  const region_3depth_name = params.region_3depth_name;
  console.log("params", params);
  const [result] = await db.query(
    `INSERT INTO address ( address, address_code,region_1depth_name,region_2depth_name,region_3depth_name) 
      VALUES (?, ?, ?, ?, ?)`,
    [address, address_code, region_1depth_name, region_2depth_name, region_3depth_name]
  );
  return result.insertId;
};

// 주소정보 가져오기
exports.findAddress = async ({ address }) => {
  // const user_id = params.user_id || null;

  let query = "SELECT id,address, address_code FROM address WHERE 1";
  const queryParams = [];

  // if (user_id !== null) {
  //   query += " AND user_id = ?";
  //   queryParams.push(user_id);
  // }
  if (address !== null) {
    query += " AND address = ?";
    queryParams.push(address);
  }

  const [rows] = await db.query(query, queryParams);
  return rows[0] || null;
};
