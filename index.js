const express = require("express");
const dotenv = require("dotenv");
const bodyParser = require("body-parser");
const authJWT = require("./src/middlewares/authJwt");
const authRouter = require("./src/routes/auth");
const userRouter = require("./src/routes/user");
const configRouter = require("./src/routes/config");
const axios = require("axios");

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

// 서버 실행
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

///////////////////////////////////////////////
// 인가 코드 요청 경로
// app.get("/auth/kakao", (req, res) => {
//   console.log(111);
//   const kakaoAuthUrl = `https://kauth.kakao.com/oauth/authorize?response_type=code&client_id=${process.env.KAKAO_CLIENT_REST_ID}&redirect_uri=${process.env.KAKAO_REDIRECT_URI}`;
//   res.redirect(kakaoAuthUrl);
// });

// app.get("/oauth/return", async (req, res) => {
//   console.log(222);
//   const code = req.query.code; // 쿼리 파라미터에서 인가 코드 추출
//   console.log("code", code);

//   try {
//     // 인가 코드를 사용하여 액세스 토큰 요청
//     const tokenResponse = await axios.post(
//       "https://kauth.kakao.com/oauth/token",
//       null,
//       {
//         params: {
//           grant_type: "authorization_code",
//           client_id: process.env.KAKAO_CLIENT_REST_ID,
//           redirect_uri: process.env.KAKAO_REDIRECT_URI,
//           code: code,
//           client_secret: process.env.KAKAO_CLIENT_SECRET, // 선택 사항
//         },
//         headers: {
//           "Content-type": "application/x-www-form-urlencoded",
//         },
//       }
//     );

//     const accessToken = tokenResponse.data.access_token;
//     console.log("accessToken", accessToken);
//     const userResponse = await axios.get("https://kapi.kakao.com/v2/user/me", {
//       headers: {
//         Authorization: `Bearer ${accessToken}`,
//       },
//     });
//     const userData = userResponse.data;
//     console.log("userData", userData);

//     const user = {
//       kakaoId: userData.id,
//       email: userData.kakao_account.email,
//       nickname: userData.properties.nickname,
//     };
//     res.redirect(`${process.env.FRONTEND_URL}/login?nickname=${user.nickname}`);
//   } catch (error) {
//     console.error("토큰 발급 오류:", error);
//     res.status(500).json({ message: "토큰 발급 실패" });
//   }
// });
