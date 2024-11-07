const jwt = require("../utils/jwt-util");
const bcrypt = require("bcryptjs");
const redisClient = require("../utils/redis");
const userModel = require("../model/userModel");
const axios = require("axios");

const getAuthUrl = (provider) => {
  const redirectUri = process.env[`${provider.toUpperCase()}_REDIRECT_URI`]; // 각 서비스별 리다이렉트 URI
  const clientId = process.env[`${provider.toUpperCase()}_CLIENT_REST_ID`]; // 각 서비스별 클라이언트 ID

  let authUrl = "";

  switch (provider) {
    case "kakao":
      authUrl = `https://kauth.kakao.com/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}`;
      break;
    case "google":
      authUrl = `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&scope=openid%20email%20profile`;
      break;
    case "apple":
      authUrl = `https://appleid.apple.com/auth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&scope=email`;
      break;
    // 다른 소셜 로그인 서비스 추가 가능
    default:
      throw new Error("지원되지 않는 소셜 로그인 제공자입니다.");
  }

  return authUrl;
};

const authController = {
  //회원 가입
  async register(req, res) {
    const { email, name, password, nickname } = req.body;
    try {
      // 이메일 중복 확인
      const existingUser = await userModel.findByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "중복된 계정입니다." });
      }
      // 비밀번호 해시 처리
      const hashedPassword = await bcrypt.hash(password, 10);
      // 새로운 사용자 생성
      const userId = await userModel.createUser(
        name,
        email,
        hashedPassword,
        nickname
      );
      res.status(201).json({ message: "회원가입 완료", userId });
    } catch (error) {
      console.error("Error:", error);
      res.status(500).json({ message: "서버 에러가 발생했습니다." });
    }
  },
  async login(req, res) {
    const { email, password } = req.body;
    try {
      // 1. 사용자가 존재하는지 이메일로 찾기
      const user = await userModel.findByEmail(email);
      if (!user) {
        return res.status(401).send({
          ok: false,
          message: "계정 정보가 틀렸습니다. 확인바랍니다.",
        });
      }
      // 2. 비밀번호 확인
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).send({
          ok: false,
          message: "계정 정보가 틀렸습니다. 확인바랍니다.",
        });
      }
      // access token과 refresh token을 발급합니다.
      const accessToken = jwt.sign(user);
      const refreshToken = jwt.refresh();
      // 발급한 refresh token을 redis에 key를 user의 id로 하여 저장합니다.
      redisClient.set(toString(user.id), refreshToken);

      // redisClient.get(toString(user.id), (err, value) => {
      //   console.log("value", value); // 123
      // });
      res.cookie("accessToken", accessToken, {
        httpOnly: true,
        maxAge: 60 * 60 * 1000, // 60분 jwt-util.js에 설정값이랑 맞춰야됨...변수 같이쓸수있으면 같이쓰는걸로.
      });
      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7일
      });
      // res.status(200).json({ message: "로그인 되었습니다." });
      res.status(200).send({
        ok: true,
        data: {
          accessToken,
          refreshToken,
        },
      });
    } catch (error) {
      console.error("로그인 중 에러 발생:", error);
      res.status(500).send({
        ok: false,
        message: "서버 에러가 발생했습니다.",
      });
    }
  },

  // 소셜로그인 팝업.
  async socialUrl(req, res) {
    const provider = req.params.provider; // 'kakao', 'google', 'apple' 등 서비스 이름을 URL에서 받음
    try {
      const authUrl = getAuthUrl(provider); // 동적으로 로그인 URL 생성
      res.redirect(authUrl);
    } catch (error) {
      res.status(400).send({ ok: false, message: error.message });
    }
  },

  // 소셜로그인 팝업후 리다이렉트 url
  async socialLogin(req, res) {
    const { code } = req.query;
    const provider = req.params.provider; // 'kakao', 'google', 'apple' 등 서비스 이름을 URL에서 받음
    try {
      // 각 서비스별 클라이언트 ID, 비밀, 토큰 URL 등 매핑 설정
      const providerConfig = {
        kakao: {
          client_id: process.env.KAKAO_CLIENT_REST_ID,
          client_secret: process.env.KAKAO_CLIENT_SECRET,
          token_url: "https://kauth.kakao.com/oauth/token",
          user_info_url: "https://kapi.kakao.com/v2/user/me",
        },
        // google: {
        //   client_id: process.env.GOOGLE_CLIENT_ID,
        //   client_secret: process.env.GOOGLE_CLIENT_SECRET,
        //   token_url: "https://oauth2.googleapis.com/token",
        //   user_info_url: "https://www.googleapis.com/oauth2/v2/userinfo",
        // },
        // apple: {
        //   client_id: process.env.APPLE_CLIENT_ID,
        //   client_secret: process.env.APPLE_CLIENT_SECRET,
        //   token_url: "https://appleid.apple.com/auth/token",
        //   user_info_url: "https://appleid.apple.com/auth/userinfo",
        // },
      };
      const config = providerConfig[provider];
      if (!config) {
        return res.status(400).send({
          ok: false,
          message: "지원되지 않는 소셜 로그인 제공자입니다.",
        });
      }

      // 1. 인가 코드로 액세스 토큰 요청
      console.log("################");
      const params = {
        grant_type: "authorization_code",
        client_id: config.client_id,
        client_secret: config.client_secret,
        redirect_uri: process.env[`${provider.toUpperCase()}_REDIRECT_URI`],
        code: code,
      };
      console.log("params", params);
      const tokenResponse = await axios.post(config.token_url, null, {
        params,
        headers: { "Content-type": "application/x-www-form-urlencoded" },
      });
      const accessToken = tokenResponse.data.access_token;
      console.log("accessToken", accessToken);

      // 2. 액세스 토큰으로 사용자 정보 요청
      const userResponse = await axios.get(config.user_info_url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const userData = userResponse.data;
      console.log("userData", userData);
      const email =
        userData.email || `${provider}_${userData.id}@${provider}.com`; // 이메일이 없으면 고유 ID로 설정
      console.log("email", email);
      let user = await userModel.findByEmail(email);
      console.log("user", user);

      // 3. 기존 사용자가 없으면 회원가입 처리
      if (!user) {
        const params = {
          email,
          hashedPassword: null,
          [`${provider}Id`]: userData.id,
          nickname: userData.name || userData.nickname || "사용자",
        };
        user = await userModel.createUser(params);
      }

      // 4. JWT 토큰 발급 및 Redis에 저장
      const newAccessToken = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
        expiresIn: "1h",
      });
      const newRefreshToken = jwt.sign(
        { id: user.id },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
      );
      redisClient.set(String(user.id), newRefreshToken);
      res.status(200).send({
        ok: true,
        data: { accessToken: newAccessToken, refreshToken: newRefreshToken },
      });
    } catch (error) {
      console.error(`${provider} 로그인 에러:`, error);
      res.status(500).send({
        ok: false,
        message: `${provider} 로그인 중 서버 에러가 발생했습니다.`,
      });
    }
  },
};

module.exports = authController;
