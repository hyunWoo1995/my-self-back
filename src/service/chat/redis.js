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
  const smembers = promisify(pubClient.sMembers).bind(pubClient);

  async function getMoimDetails(pubClient, userId) {
    const setKey = `myMoimList:${userId}`; // 나의 모임 리스트 키
    const moimIds = await smembers(setKey); // 모임 ID 리스트 가져오기

    console.log("sdf123", moimIds);
    if (!moimIds.length) return []; // 모임이 없으면 빈 배열 반환

    const multi = pubClient.multi();

    // 각 모임 ID에 해당하는 데이터를 가져오는 명령 추가

    moimIds.forEach((id) => multi.sMembers(`moimData:${String(id)}`));
    console.log("vvv132", multi);

    const results = await multi.exec();

    console.log("resultsresultsresultsresults", results);

    // JSON 형식으로 저장된 데이터를 파싱하여 배열 반환
    return results?.map((data) => (data ? JSON.parse(data) : null)).filter(Boolean);
  }

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

  return { pubClient, getAsync, setExAsync, smembers, getMoimDetails };
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
