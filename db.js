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
    console.log("mysql err", err);
  } else {
  }
});

module.exports = pool.promise();
