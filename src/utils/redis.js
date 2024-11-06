const redis = require("redis");
const dotenv = require("dotenv");

dotenv.config(); // env환경변수 파일 가져오기

const redisClient = redis.createClient({
  url: `redis://${process.env.REDIS_USERNAME}:${process.env.REDIS_PASSWORD}@${process.env.REDIS_HOST}:${process.env.REDIS_PORT}/0`,
  // legacyMode: true, // 반드시 설정 !!
});

redisClient.on("connect", () => {
  console.info("Redis connected!");
});

redisClient.on("error", (err) => {
  console.error("Redis Client Error", err);
});
redisClient.connect().then(); // redis v4 연결 (비동기)
// const redisCli = redisClient.v4;

module.exports = redisClient;
