const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const swaggerNodeRunner = require("swagger-node-runner");
const SwaggerUi = require("swagger-ui-express");
const dotenv = require("dotenv");
const bodyParser = require("body-parser");
const authJWT = require("./src/middlewares/authJwt");
const authRouter = require("./src/routes/auth");
const userRouter = require("./src/routes/user");
const configRouter = require("./src/routes/config");
const socketIo = require("socket.io");
const setupSocket = require("./socket");
const path = require("path");
const axios = require("axios");

dotenv.config(); // .env가져오기

const io = socketIo(server);
const PORT = process.env.PORT || 80;
const publicDirectoryPath = path.join(__dirname, "./public");

app.use(express.static(publicDirectoryPath));

// 소켓 설정 초기화
setupSocket(io);

// Body Parser Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// 토큰 체크하기!
app.use((req, res, next) => {
  // 제외할 경로 리스트
  const excludedPaths = [];
  const excludedPrefixes = ["/auth"]; // auth로 시작하는 경로 전체
  console.log("req.path", req.path);

  const isExcludedPath = excludedPaths.includes(req.path);
  const isExcludedPrefix = excludedPrefixes.some((prefix) =>
    req.path.startsWith(prefix)
  );

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

// 기본 라우트
app.get("/", (req, res) => {
  res.send("Hello, JWT!");
});

const config = {
  appRoot: __dirname,
  swagger: "src/swagger/swagger.yaml",
};

swaggerNodeRunner.create(config, function (err, swaggerRunner) {
  if (err) throw err;

  app.use("/docs", SwaggerUi.serve, SwaggerUi.setup(require("yamljs").load(config.swagger)));

  const swaggerExpress = swaggerRunner.expressMiddleware();
  swaggerExpress.register(app);

  app.use(express.static("public"));

  app.use("/a", function (req, res, next) {
    const value = "'sdfasdfasdfasasdf'";
    res.send(
      `<head><title>MoimMoim</title><link rel="stylesheet" href="https://uicdn.toast.com/editor/latest/toastui-editor-viewer.min.css" /></head><body><script src="https://uicdn.toast.com/editor/latest/toastui-editor-viewer.js"></script><div id="viewer"/><script>new toastui.Editor({el: document.querySelector("#viewer"),initialValue: ${value}});</script></body>`
    );
  });

  // let port = 8085;
  // if (swaggerExpress.runner.swagger.host.split(":")[1] !== undefined) {
  //   port = swaggerExpress.runner.swagger.host.split(":")[1];
  // }

  server.listen(80, function () {
    console.log(`api listening on http://${swaggerExpress.runner.swagger.host}/docs`);
  });
});
