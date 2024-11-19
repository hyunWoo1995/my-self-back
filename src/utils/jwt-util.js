const dotenv = require("dotenv");
const { promisify } = require("util");
const jwt = require("jsonwebtoken");
const {redisClient} = require("./redis");

dotenv.config(); // .env가져오기

const accessTokenSecret = process.env.ACCESS_TOKEN_SECRET;
const refreshTokenSecret = process.env.REFRESH_TOKEN_SECRET;

const algorithmType = "HS256";
const accessTokenTime = "1h";
const refreshTokenTime = "7d";
module.exports = {
  sign: (user) => {
    const payload = {
      userId: user.id,
    };
    const accessToken = jwt.sign(payload, accessTokenSecret, {
      algorithm: algorithmType, // 암호화 알고리즘
      expiresIn: accessTokenTime, // 유효기간
    });
    redisClient.set(
      `accessToken:${user.id}`,
      accessToken,
      "EX",
      10
      // parseInt(process.env.ACCESS_TOKEN_TIMER)
    );
    return accessToken;
  },
  verify: (token) => {
    // access token 검증
    let decoded = null;
    try {
      decoded = jwt.verify(token, accessTokenSecret);
      return { ok: true, ...decoded };
    } catch (err) {
      return {
        ok: false,
        message: err.message,
      };
    }
  },
  refresh: (user) => {
    // refresh token 발급
    const payload = {
      userId: user.id,
    };
    const refreshToken = jwt.sign(payload, refreshTokenSecret, {
      algorithm: algorithmType,
      expiresIn: refreshTokenTime,
    });
    redisClient.set(
      `refreshToken:${user.id}`,
      refreshToken,
      "EX",
      parseInt(process.env.REFRESH_TOKEN_TIMER)
    );
    return refreshToken;
  },
  refreshVerify: async (token) => {
    
    let decoded = null;
    try {
      decoded = jwt.verify(token, refreshTokenSecret);
      return { ok: true, ...decoded };
    } catch (err) {
      return {
        ok: false,
        message: err.message,
      };
    }
  },
};
