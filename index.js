const express = require("express");
const app = express();
const responseHelper = require("./src/middlewares/responseHelper");
const http = require("http");
const server = http.createServer(app);
const swaggerUi = require("swagger-ui-express");
const YAML = require("yamljs");

const dotenv = require("dotenv");
const bodyParser = require("body-parser");
const authJWT = require("./src/middlewares/authJwt");
const authRouter = require("./src/routes/auth");
const userRouter = require("./src/routes/user");
const moimRouter = require("./src/routes/moim");
const configRouter = require("./src/routes/config");
const socketIo = require("socket.io");
const setupSocket = require("./socket");
const path = require("path");
const axios = require("axios");
const cors = require("cors");

dotenv.config(); // .env가져오기

// 응답 헬퍼 미들웨어 추가
app.use(responseHelper);

const io = socketIo(server);
const PORT = process.env.PORT || 80;
const publicDirectoryPath = path.join(__dirname, "./public");

app.use(express.static(publicDirectoryPath));

// 소켓 설정 초기화
setupSocket(io);

// Body Parser Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Swagger YAML 파일 경로 설정 및 미들웨어 추가
const swaggerDocument = YAML.load("./src/swagger/swagger.yaml");
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.use(
  cors({
    origin: "http://localhost:3000", // 모든 도메인 허용
    methods: ["GET", "POST", "PUT", "DELETE"], // 허용할 HTTP 메서드
    allowedHeaders: ["Content-Type", "Authorization"], // 허용할 헤더
    credentials: true, // 쿠키 포함 등의 옵션을 허용할 경우(origin을 *처리했을경우 쿠키설정 안먹음.)
  })
);

// 토큰 체크하기!
app.use((req, res, next) => {
  // 제외할 경로 리스트
  const excludedPaths = [];
  const excludedPrefixes = ["/auth", "/moim"]; // auth로 시작하는 경로 전체
  console.log("req.path", req.path);

  const isExcludedPath = excludedPaths.includes(req.path);
  const isExcludedPrefix = excludedPrefixes.some((prefix) => req.path.startsWith(prefix));

  // 현재 요청 경로가 제외할 경로에 포함되는지 확인
  if (isExcludedPath || isExcludedPrefix) {
    return next(); // 포함되면 authJWT를 적용하지 않고 다음 미들웨어로 이동
  }
  // 제외된 경로가 아닌 경우에만 authJWT 적용
  authJWT(req, res, next);
});

app.use(express.json());

// 사용자 인증 라우터 등록
app.use("/auth", authRouter);
app.use("/config", configRouter);

// 사용자 라우터 등록
app.use("/user", userRouter);
app.use("/moim", moimRouter);

// 기본 라우트
app.get("/", (req, res) => {
  res.send("Hello, JWT!");
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Swagger docs available on http://localhost:${PORT}/api-docs`);
});
