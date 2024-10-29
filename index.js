const express = require("express");
const dotenv = require("dotenv");
const bodyParser = require("body-parser");
const jwt = require("jsonwebtoken");
const authRouter = require("./src/routes/auth");
const userRouter = require("./src/routes/user");
const configRouter = require("./src/routes/config");

dotenv.config(); // .env가져오기

const app = express();
const PORT = process.env.PORT || 8000;

// Body Parser Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.post("/user", (req, res) => {
  // body 출력
  console.log(req.body);
  res.send("ok!!!");
});

// app.use(express.json());

// 사용자 인증 라우터 등록
app.use("/auth", authRouter);
app.use("/config", configRouter);

// 사용자 라우터 등록
// app.use('/api/users', userRouter);

// 기본 라우트
app.get("/", (req, res) => {
  res.send("Hello, JWT!");
});

// 서버 실행
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
