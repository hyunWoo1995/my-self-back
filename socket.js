const { promisify } = require("util"); // Import promisify
const { createClient } = require("redis");
const moimModel = require("./src/model/moimModel");
const { createAdapter } = require("@socket.io/redis-adapter");
const { isAfterDate } = require("./src/utils/date");
const { findByUser } = require("./src/model/userModel");
const { encryptMessage, decryptMessage } = require("./src/utils/aes");
const { default: axios } = require("axios");
const redisService = require("./src/service/chat/redis");
const socketService = require("./src/service/chat/index");
const { handleOnesignalNotification } = require("./src/service/chat/onesignal");

let typingUsers = [];
const typingTimers = {}; // To store timers for each user

// socket.js
module.exports = async (io) => {
  const { pubClient, getAsync, setExAsync } = await redisService.initRedis(io);

  io.on("connection", (socket) => {
    socket.emit("message", socket.id);
    socket.on("userData", (data) => socketService.getMyList({ socket, pubClient, getAsync, setExAsync }, data));

    // 지역 입장
    socket.on("join", ({ user, region_code }) => socketService.handleJoinRegion({ socket, pubClient, getAsync, setExAsync }, { user, region_code }));

    // 모임 생성
    socket.on("generateMeeting", (data) => socketService.handleGenerateMeeting({ socket, io, pubClient, getAsync, setExAsync }, data));

    // 모임 입장
    socket.on("enterMeeting", (data) => {
      socketService.handleEnterMeeting({ socket, pubClient, getAsync, setExAsync, io }, data);
    });

    // 모임 유저 목록
    socket.on("getUserList", ({ meetings_id, region_code }) => {
      socketService.getUserList({ socket, pubClient, getAsync, setExAsync }, { meetings_id, region_code });
    });

    // room에서 나가기
    socket.on("exitMoim", ({ region_code, meetings_id }) => {
      const meetingRoom = `${region_code}:${meetings_id}`;
      socket.leave(meetingRoom);
      const usersInRoom = socketService.getUsersInRoom(io, meetingRoom);
      console.log("exitMoim", usersInRoom);
    });

    // 모임 입장 신청
    socket.on("joinMeeting", ({ meetings_id, fcmToken, region_code, type, users_id }) =>
      socketService.handleJoinMeeting({ socket, pubClient, getAsync, setExAsync, io }, { meetings_id, fcmToken, region_code, type, users_id })
    );
    // 메시지 수신 및 전파 (Send message to a meeting room)
    socket.on("sendMessage", ({ region_code, meetings_id, contents, users_id, tag_id }) =>
      socketService.handleSendMessage({ socket, pubClient, getAsync, setExAsync, io }, { region_code, meetings_id, contents, users_id, tag_id })
    );

    socket.on("readMessage", async ({ meetings_id, users_id }) => {
      await moimModel.modifyActiveTime({ meetings_id, users_id });
    });

    socket.on("typing", ({ region_code, meetings_id, users_id }) => socketService.handleChatTyping({ pubClient, getAsync, setExAsync }, { region_code, meetings_id, users_id }));

    socket.on("likeMoim", ({ users_id, meetings_id, region_code }) => socketService.handleLikeMoim({ socket, getAsync, setExAsync, pubClient }, { users_id, meetings_id, region_code }));

    socket.on("leaveMoim", ({ users_id, meetings_id, region_code }) => socketService.handleLeaveMoim({ socket, pubClient, getAsync, setExAsync }, { users_id, meetings_id, region_code }));

    // 클라이언트가 연결 해제 시 처리 (Handle client disconnect)
    socket.on("disconnect", () => {});
  });
};
