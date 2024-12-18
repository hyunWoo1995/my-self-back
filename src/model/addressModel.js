const db = require("../../db");

exports.getAddress = async ({ keyword }) => {
  console.log("keywordkeyword", keyword);
  const [rows] = await db.query("select * from address where address like ?", [`%${keyword}%`]);

  return rows;
};

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
