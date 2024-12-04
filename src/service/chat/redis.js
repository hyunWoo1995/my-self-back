const { promisify } = require("util"); // Import promisify
const { createClient } = require("redis");
const { createAdapter } = require("@socket.io/redis-adapter");

const initRedis = async (io) => {
  const pubClient = createClient({
    url: `redis://${process.env.REDIS_USERNAME}:${process.env.REDIS_PASSWORD}@${process.env.REDIS_HOST}:${process.env.REDIS_PORT}/0`,
    legacyMode: true, // 반드시 설정 !!
  });

  const getAsync = promisify(pubClient.get).bind(pubClient);
  const setExAsync = promisify(pubClient.setEx).bind(pubClient);

  const subClient = createClient({
    url: `redis://${process.env.REDIS_USERNAME}:${process.env.REDIS_PASSWORD}@${process.env.REDIS_HOST}:${process.env.REDIS_PORT}/0`,
    legacyMode: true, // 반드시 설정 !!
  });

  await Promise.all([pubClient.connect(), subClient.connect()]).catch((err) => {
    console.error("Error connecting Redis clients:", err);
    process.exit(1);
  });

  pubClient.on("error", (err) => {
    console.error("Redis PubClient Error:", err);
  });

  subClient.on("error", (err) => {
    console.error("Redis SubClient Error:", err);
  });

  io.adapter(createAdapter(pubClient.duplicate(), subClient.duplicate()));

  // 레디스 채널 구독
  const channels = ["message", "region_code", "meetingRoom"];
  channels.forEach((channel) => {
    subClient.v4.subscribe(channel, (message) => handleRedisMessage(io, channel, message));
  });

  return { pubClient, getAsync, setExAsync };
};

const handleRedisMessage = (io, channel, message) => {
  console.log("123zxczxczxc", channel);
  try {
    const parsedMessage = JSON.parse(message);
    io.to(parsedMessage.room).emit(parsedMessage.event, parsedMessage.data);
  } catch (error) {
    console.error(`${channel} error`, error);
  }
};

module.exports = { initRedis };
