const dotenv = require("dotenv");
const { promisify } = require("util");
const jwt = require("jsonwebtoken");
const redisClient = require("./redis");

dotenv.config(); // .env가져오기

const accessTokenSecret = process.env.ACCESS_TOKEN_SECRET;
const refreshTokenSecret = process.env.REFRESH_TOKEN_SECRET;

const algorithmType = "HS256";
const accessTokenTime = "1h";
const refreshTokenTime = "7d";
module.exports = {
  sign: (user) => {
    const payload = {
      id: user.id,
    };
    return jwt.sign(payload, accessTokenSecret, {
      algorithm: algorithmType, // 암호화 알고리즘
      expiresIn: accessTokenTime, // 유효기간
    });
  },
  verify: (token) => {
    // access token 검증
    let decoded = null;
    try {
      decoded = jwt.verify(token, accessTokenSecret);
      return {
        ok: true,
        id: decoded.id,
        role: decoded.role,
      };
    } catch (err) {
      return {
        ok: false,
        message: err.message,
      };
    }
  },
  refresh: () => {
    // refresh token 발급
    return jwt.sign({}, refreshTokenSecret, {
      // refresh token은 payload 없이 발급
      algorithm: algorithmType,
      expiresIn: refreshTokenTime,
    });
  },
  refreshVerify: async (token, userId) => {
    // refresh token 검증
    /* redis 모듈은 기본적으로 promise를 반환하지 않으므로,
       promisify를 이용하여 promise를 반환하게 해줍니다.*/
    const getAsync = promisify(redisClient.get).bind(redisClient);

    try {
      const data = await getAsync(userId); // refresh token 가져오기
      if (token === data) {
        try {
          jwt.verify(token, refreshTokenSecret);
          return true;
        } catch (err) {
          return false;
        }
      } else {
        return false;
      }
    } catch (err) {
      return false;
    }
  },
};
