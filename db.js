const mysql = require("mysql2");

const pool = mysql.createConnection({
  host: "15.164.212.90",
  user: "root",
  port: "3306",
  password: "Qlalf1324!!",
  database: "moimmoim",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

module.exports = pool.promise();
