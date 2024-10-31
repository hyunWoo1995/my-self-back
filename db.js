require("dotenv").config();
const mysql = require("mysql2");

const pool = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  port: process.env.DB_PORT,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

pool.connect((err) => {
  if (err) {
    console.error("데이터베이스 연결 오류:", err);
  } else {
    console.log("MySQL 데이터베이스에 성공적으로 연결되었습니다.");
  }
});

module.exports = pool.promise();
