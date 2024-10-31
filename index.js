const express = require("express");
const dotenv = require("dotenv");
const bodyParser = require("body-parser");
const authJWT = require("./src/utils/jwt-util");
const authRouter = require("./src/routes/auth");
const userRouter = require("./src/routes/user");
const configRouter = require("./src/routes/config");

dotenv.config(); // .env가져오기

const app = express();
const PORT = process.env.PORT || 8000;

// Body Parser Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// app.use((req, res, next) => {
//   const excludedPaths = ["/auth/login", "/auth/register"]; // 제외할 경로 리스트

//   // 현재 요청 경로가 제외할 경로에 포함되는지 확인
//   if (excludedPaths.includes(req.path)) {
//     return next(); // 포함되면 authJWT를 적용하지 않고 다음 미들웨어로 이동
//   }

//   // 제외된 경로가 아닌 경우에만 authJWT 적용
//   authJWT(req, res, next);
// });

// app.use(express.json());

// 사용자 인증 라우터 등록
app.use("/auth", authRouter);
app.use("/config", configRouter);

// 사용자 라우터 등록
app.use("/user", userRouter);

// 기본 라우트
app.get("/", (req, res) => {
  res.send("Hello, JWT!");
});

// 서버 실행
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
