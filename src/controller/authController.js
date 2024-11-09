const jwt = require("../utils/jwt-util");
const bcrypt = require("bcryptjs");
const redisClient = require("../utils/redis");
const userModel = require("../model/userModel");
const interestModel = require("../model/interestModel");
const axios = require("axios");
const mailSand = require("../utils/nodemailer");
const dotenv = require("dotenv");
dotenv.config(); // .env가져오기

const getAuthUrl = (provider) => {
  const redirectUri = process.env[`${provider.toUpperCase()}_REDIRECT_URI`]; // 각 서비스별 리다이렉트 URI
  const clientId = process.env[`${provider.toUpperCase()}_CLIENT_ID`]; // 각 서비스별 클라이언트 ID

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
// 나이 및 성별 계산 함수
const getGender = (birthdate) => {
  if (!validateBirthdate(birthdate)) return;
  const genderIndicator = parseInt(birthdate[6], 10); // 마지막 자리 성별 판별 번호
  let gender;
  if (genderIndicator === 1 || genderIndicator === 3) {
    gender = "남성";
  } else if (genderIndicator === 2 || genderIndicator === 4) {
    gender = "여성";
  } else {
    gender = null;
  }

  return gender;
};
const getProviderConfig = (provider) => {
  const config = {
    kakao: {
      client_id: process.env.KAKAO_CLIENT_ID,
      client_secret: process.env.KAKAO_CLIENT_SECRET,
      token_url: "https://kauth.kakao.com/oauth/token",
      user_info_url: "https://kapi.kakao.com/v2/user/me",
    },
    google: {
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      token_url: "https://oauth2.googleapis.com/token",
      user_info_url: "https://www.googleapis.com/oauth2/v2/userinfo",
    },
    // apple: {
    //   client_id: process.env.APPLE_CLIENT_ID,
    //   client_secret: process.env.APPLE_CLIENT_SECRET,
    //   token_url: "https://appleid.apple.com/auth/token",
    //   user_info_url: "https://appleid.apple.com/auth/userinfo",
    // },
  };
  return config[provider];
};

const setCookie = (res, user) => {
  // access token과 refresh token을 발급.
  const accessToken = jwt.sign(user);
  const refreshToken = jwt.refresh();
  // redis에 access,refresh token두개다 등록.
  redisClient.set(
    `accessToken:${user.id}`,
    accessToken,
    "EX",
    parseInt(process.env.ACCESS_TOKEN_TIMER)
  );
  redisClient.set(
    `refreshToken:${user.id}`,
    refreshToken,
    "EX",
    parseInt(process.env.REFRESH_TOKEN_TIMER)
  );
  // 브라우저cookie에다 넣어줌.
  res.cookie("accessToken", accessToken, {
    httpOnly: true,
    maxAge: parseInt(process.env.ACCESS_TOKEN_TIMER) * 1000, // 60분
  });
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    maxAge: parseInt(process.env.REFRESH_TOKEN_TIMER) * 1000, // 7일
  });
};
// 이메일 인증 코드 가져오기
const getEmailAuthCode = async (email) => {
  return new Promise((resolve, reject) => {
    redisClient.get(`emailAuthCode:${email}`, (err, result) => {
      if (err) {
        reject(err);
      }
      resolve(result); // result에는 이메일 인증 코드가 들어있습니다
    });
  });
};
// 생년월일 유효성 체크
function validateBirthdate(birthdate) {
  // 1. 형식 확인: 7자리 숫자여야 함
  if (!/^\d{7}$/.test(birthdate)) {
    return false;
  }

  // 2. 연도, 월, 일 추출
  const year = parseInt(birthdate.slice(0, 2), 10);
  const month = parseInt(birthdate.slice(2, 4), 10);
  const day = parseInt(birthdate.slice(4, 6), 10);
  const genderIndicator = parseInt(birthdate[6], 10);

  // 3. 날짜 유효성 검사
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  // 4. 성별 코드 확인 (1, 2, 3, 4만 유효)
  if (![1, 2, 3, 4].includes(genderIndicator)) {
    return false;
  }

  return true;
}

const authController = {
  async requestEmail(req, res) {
    const { email } = req.body;
    try {
      const authCode = Math.floor(100000 + Math.random() * 900000).toString();

      redisClient.set(`emailAuthCode:${email}`, authCode, "EX", 60 * 3);

      const mailOptions = {
        to: email, // 받는 사람
        subject: "moimmoim 인증번호 입니다.", // 메일 제목
        html: `<h1>안녕하세요</h1><p>moimmoim인증번호는 :${authCode} 입니다</p>`, // HTML 형식으로 작성 가능
      };
      const emailInfo = await mailSand(mailOptions);
      res.send(`Email sent successfully! Response: ${emailInfo}`);
    } catch (error) {
      res.status(500).json({ message: "서버 에러가 발생했습니다." });
    }
  },
  async confirmEmail(req, res) {
    const { email, code } = req.body;
    try {
      const storedCode = await getEmailAuthCode(email);
      if (storedCode === code) {
        // 인증 성공
        await redisClient.del(`emailAuthCode:${email}`); // 인증 후 코드를 삭제
        res.status(201).json({ ok: true, message: "인증성공" });
      } else {
        res.status(201).json({ ok: false, message: "인증실패" });
      }
    } catch (error) {
      res.status(500).json({ ok: false, message: "서버 에러가 발생했습니다." });
    }
  },
  //회원 가입
  async register(req, res) {
    const {
      email,
      password,
      passwordCheck,
      nickname,
      birthdate,
      interests,
      addresses,
    } = req.body;
    try {
      const ip = req.ip || req.connection.remoteAddress;
      // 이메일 중복 확인
      const existingUser = await userModel.findByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "중복된 계정입니다." });
      }
      if (password !== passwordCheck) {
        return res.status(400).json({ message: "패스워드 일치하지 않습니다." });
      }
      const gender = getGender(birthdate);

      // 비밀번호 해시 처리
      const hashedPassword = await bcrypt.hash(password, 10);
      // 새로운 사용자 생성
      const userId = await userModel.createUser({
        email,
        hashedPassword,
        nickname,
        birthdate,
        gender,
        ip,
      });
      const resultInterest = await Promise.all(
        interests.map((item) =>
          userModel.createUserInterest({ user_id: userId, interest_id: item })
        )
      );
      const resultAddress = await Promise.all(
        addresses.map((item) =>
          userModel.createUserAddresses({
            user_id: userId,
            address: item.address,
            address_code: item.address_code,
          })
        )
      );

      res.status(201).json({ message: "회원가입 완료", userId });
    } catch (error) {
      res.status(500).json({ message: "서버 에러가 발생했습니다." });
    }
  },

  // moimmoim 회원로그인
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
      setCookie(res, user);
      res.status(200).json({ message: "로그인 되었습니다." });
    } catch (error) {
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
    const ip = req.ip || req.connection.remoteAddress;
    const { code } = req.query;
    const provider = req.params.provider; // 'kakao', 'google', 'apple' 등 서비스 이름을 URL에서 받음
    try {
      // 각 서비스별 클라이언트 ID, 비밀, 토큰 URL 등 매핑 설정
      const config = getProviderConfig(provider);
      if (!config) {
        return res.status(400).send({
          ok: false,
          message: "지원되지 않는 소셜 로그인 제공자입니다.",
        });
      }

      // 1. 인가 코드로 액세스 토큰 요청
      const params = {
        grant_type: "authorization_code",
        client_id: config.client_id,
        client_secret: config.client_secret,
        redirect_uri: process.env[`${provider.toUpperCase()}_REDIRECT_URI`],
        code: code,
      };
      const tokenResponse = await axios.post(config.token_url, null, {
        params,
        headers: { "Content-type": "application/x-www-form-urlencoded" },
      });
      const accessToken = tokenResponse.data.access_token;

      // 2. 액세스 토큰으로 사용자 정보 요청
      const userResponse = await axios.get(config.user_info_url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const userData = userResponse.data;
      const email =
        userData.email || `${provider}_${userData.id}@${provider}.com`; // 이메일이 없으면 고유 ID로 설정
      let user = await userModel.findByEmail(email);

      // 3. 기존 사용자가 없으면 회원가입 처리
      if (!user) {
        res.redirect(`${process.env.FRONTEND_URL}/sign?email=${email}`);
      } else {
        setCookie(res, user);
        res.redirect(`${process.env.FRONTEND_URL}`);
      }
      // if (!user) {
      //   const params = {
      //     email,
      //     hashedPassword: null,
      //     provider,
      //     provider_id: userData.id,
      //     ip,
      //   };
      //   if (provider === "google") {
      //     params.nickname = userData.name;
      //   } else {
      //     params.nickname = userData?.properties?.nickname || "사용자";
      //   }
      //   const insertId = await userModel.createUser(params);
      //   user = await userModel.findByUser(insertId);
      // }
      // setCookie(res, user);

      // res.redirect(`${process.env.FRONTEND_URL}/sign?email=${user.email}`);
    } catch (error) {
      res.status(500).send({
        ok: false,
        message: `${provider} 로그인 중 서버 에러가 발생했습니다.`,
      });
    }
  },

  async getInterests(req, res) {
    try {
      const interestList = await interestModel.getInterestList();
      res.status(201).json({ ok: true, message: "성공", data: interestList });
    } catch (error) {
      res.status(400).send({ ok: false, message: error.message });
    }
  },
};

module.exports = authController;
