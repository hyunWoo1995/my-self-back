const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);

const dotenv = require("dotenv");
const bodyParser = require("body-parser");
const authJWT = require("./src/utils/jwt-util");
const authRouter = require("./src/routes/auth");
const userRouter = require("./src/routes/user");
const configRouter = require("./src/routes/config");
const socketIo = require("socket.io");
const setupSocket = require("./socket");
const path = require("path");

dotenv.config(); // .env가져오기

const io = socketIo(server);
const PORT = process.env.PORT || 8000;
const publicDirectoryPath = path.join(__dirname, "./public");

app.use(express.static(publicDirectoryPath));

// 클라이언트와 소켓 연결 처리
// io.on("connection", (socket) => {
//   console.log("A user connected:", socket.id);

//   // 메시지 수신 및 전파
//   socket.on("chat message", (msg) => {
//     io.emit("chat message", msg); // 모든 클라이언트에 메시지 전송
//   });

//   // 클라이언트가 연결 해제 시 처리
//   socket.on("disconnect", () => {
//     console.log("User disconnected:", socket.id);
//   });
// });

// 소켓 설정 초기화
setupSocket(io);

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
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
