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
  const { pubClient, getAsync, setExAsync, smembers, getMoimDetails } = await redisService.initRedis(io);

  io.on("connection", (socket) => {
    socket.emit("message", socket.id);

    // 유저 id 등록
    socket.on("register", ({ users_id }) => socketService.setRegisterUserId({ socket, getAsync, pubClient, setExAsync }, { users_id }));

    // 나의 모임 목록
    socket.on("getMyList", (data) => socketService.getMyList({ socket, pubClient, getAsync, setExAsync }, data));

    // 지역 입장
    socket.on("join", ({ user, region_code }) => {
      console.log("join");
      socketService.handleJoinRegion({ socket, pubClient, getAsync, setExAsync }, { user, region_code });
    });

    // 모임 생성
    socket.on("generateMeeting", (data) => socketService.handleGenerateMeeting({ socket, io, pubClient, getAsync, setExAsync }, data));

    // 모임 입장
    socket.on("enterMeeting", (data) => {
      console.log("dddddasdasdasd", data);

      socketService.handleEnterMeeting({ socket, pubClient, getAsync, setExAsync, io, smembers, getMoimDetails }, data);
    });

    // 모임 유저 목록
    socket.on("getUserList", ({ meetings_id, region_code }) => {
      socketService.getUserList({ socket, pubClient, getAsync, setExAsync }, { meetings_id, region_code });
    });

    // room에서 나가기 (메세지 안받음)
    socket.on("exitMoim", ({ region_code, meetings_id }) => {
      const meetingRoom = `${region_code}:${meetings_id}`;
      socket.leave(meetingRoom);
      socket.leave(`${meetingRoom}:active`);
    });

    // room에서 나가기 (메세지 받음)
    socket.on("blurMoim", ({ region_code, meetings_id }) => {
      console.log("sdfsdf", region_code, meetings_id);

      const meetingRoom = `${region_code}:${meetings_id}`;
      socket.leave(`${meetingRoom}:active`);
    });

    // 모임 입장 신청
    socket.on("joinMeeting", ({ meetings_id, fcmToken, region_code, type, users_id }) =>
      socketService.handleJoinMeeting({ socket, pubClient, getAsync, setExAsync, io, smembers }, { meetings_id, fcmToken, region_code, type, users_id })
    );
    // 메시지 수신 및 전파 (Send message to a meeting room)
    socket.on("sendMessage", ({ region_code, meetings_id, contents, users_id, tag_id, reply_id, type }) =>
      socketService.handleSendMessage({ socket, pubClient, getAsync, setExAsync, io }, { region_code, meetings_id, contents, users_id, tag_id, reply_id, type })
    );

    socket.on("readMessage", async ({ meetings_id, users_id }) => {
      await moimModel.modifyActiveTime({ meetings_id, users_id });
    });

    socket.on("typing", ({ region_code, meetings_id, users_id }) => socketService.handleChatTyping({ pubClient, getAsync, setExAsync }, { region_code, meetings_id, users_id }));

    socket.on("likeMoim", ({ users_id, meetings_id, region_code }) => socketService.handleLikeMoim({ socket, getAsync, setExAsync, pubClient }, { users_id, meetings_id, region_code }));

    socket.on("leaveMoim", ({ users_id, meetings_id, region_code }) => socketService.handleLeaveMoim({ socket, pubClient, getAsync, setExAsync }, { users_id, meetings_id, region_code }));

    socket.on("generateInviteCode", ({ users_id, meetings_id, region_code }) =>
      socketService.handleGenerateInviteCode({ socket, getAsync, pubClient, setExAsync }, { meetings_id, region_code, users_id })
    );

    socket.on("sendInviteCode", ({ region_code, users_id, meetings_id, invite_code, fcmToken }) =>
      socketService.handleSendInviteCode({ getAsync, pubClient, setExAsync, socket, io, smembers }, { invite_code, meetings_id, region_code, users_id })
    );

    socket.on("inviteUser", ({ keyword, meetings_id, region_code, users_id }) =>
      socketService.handleInviteUser({ getAsync, pubClient, setExAsync, socket }, { keyword, meetings_id, region_code, users_id })
    );

    socket.on("inviteReply", ({ receiver_id, code, meetings_id, sender_id, region_code }) => {
      socketService.handleInviteReply({ getAsync, pubClient, setExAsync, socket, io, smembers }, { code, meetings_id, receiver_id, sender_id, region_code });
    });

    socket.on("addFriend", ({ receiver_id, sender_id }) => socketService.handleAddFriend({ getAsync, pubClient, setExAsync, socket, io }, { receiver_id, sender_id }));

    socket.on("replyFriend", ({ receiver_id, sender_id, code }) => socketService.handleReplyFriend({ getAsync, pubClient, setExAsync, socket }, { receiver_id, sender_id, code }));

    socket.on("kickOut", ({ users_id, meetings_id, description, receiver_id, region_code }) =>
      socketService.handleKickOut({ getAsync, pubClient, setExAsync, socket, smembers }, { description, meetings_id, users_id, region_code, receiver_id })
    );

    // 클라이언트가 연결 해제 시 처리 (Handle client disconnect)
    socket.on("disconnect", (e) => {
      console.log("disconnect", socket.userId, e);
      if (socket.userId) {
        pubClient.del(`socket:${socket.userId}`);
      }
    });
  });
};
