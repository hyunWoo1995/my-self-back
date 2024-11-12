const redis = require("redis");
const dotenv = require("dotenv");

dotenv.config(); // env환경변수 파일 가져오기

const redisClient = redis.createClient({
  url: `redis://${process.env.REDIS_USERNAME}:${process.env.REDIS_PASSWORD}@${process.env.REDIS_HOST}:${process.env.REDIS_PORT}/0`,
  legacyMode: true, // 반드시 설정 !!
});

redisClient.on("connect", () => {
  console.info("Redis connected!");
});

redisClient.on("error", (err) => {
  console.error("Redis Client Error", err);
});
redisClient.connect().then(); // redis v4 연결 (비동기)
// const redisCli = redisClient.v4;

// Redis에서 값 가져오기 (Promise 방식)
async function getRedisData(key) {
  return new Promise((resolve, reject) => {
    redisClient.get(key, (err, reply) => {
      if (err) {
        reject(err);
      } else {
        resolve(reply); // 값이 없으면 null이 반환됨
      }
    });
  });
}

module.exports = { redisClient, getRedisData };
