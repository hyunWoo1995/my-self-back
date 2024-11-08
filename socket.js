const { createClient } = require("redis");
const meetingModel = require("./src/model/meetingModel");
const { createAdapter } = require("@socket.io/redis-adapter");

// socket.js
module.exports = async (io) => {
  const pubClient = createClient({
    url: `redis://${process.env.REDIS_USERNAME}:${process.env.REDIS_PASSWORD}@${process.env.REDIS_HOST}:${process.env.REDIS_PORT}/0`,
    legacyMode: true, // 반드시 설정 !!
  });
  const subClient = pubClient.duplicate();

  Promise.all([pubClient.connect(), subClient.connect()]);

  pubClient.on("error", (err) => {
    console.error("pubClient Error", err);
  });

  io.adapter(createAdapter(pubClient, subClient));

  // Subscribe to Redis channels for region updates
  // subClient.on("message", (channel, message) => {
  //   console.log("ccccc", channel, message);
  //   try {
  //     const parsedMessage = JSON.parse(message);
  //     console.log("channel", channel, parsedMessage);

  //     // Check message type and emit to clients
  //     if (parsedMessage.type === "listUpdate") {
  //       io.to(channel).emit("list", parsedMessage.data);
  //     } else if (parsedMessage.type === "newMessage") {
  //       io.to(channel).emit("receiveMessage", parsedMessage.data);
  //     }
  //   } catch (error) {
  //     console.error(`Error parsing message from channel ${channel}:`, error);
  //   }
  // });

  io.on("connection", (socket) => {
    socket.emit("message", socket.id);

    // 지역 입장 (Join region)
    socket.on("join", async ({ user, region_code }) => {
      socket.join(region_code);

      // Check Redis cache for meeting list
      pubClient.get(`meetingList:${region_code}`, async (err, result) => {
        if (result) {
          console.log("레디스!");
          io.to(region_code).emit("list", JSON.parse(result));
        } else {
          console.log("데이터베이스!");

          const res = await meetingModel.getMeetingList({ region_code: region_code });
          pubClient.setEx(`meetingList:${region_code}`, 3600, JSON.stringify(res)); // Cache for 1 hour

          io.to(region_code).emit("list", res);
        }
      });

      // subClient.subscribe(code);
    });

    // 모임 생성 (Generate a meeting)
    socket.on("generateMeeting", async (data) => {
      const res = await meetingModel.generateMeeting({
        name: data.name,
        region_code: data.region_code,
        maxMembers: data.maxMembers,
        users_id: data.users_id,
        description: data.description,
      });

      if (res.affectedRows > 0) {
        // Add the user to the new meeting
        await meetingModel.enterMeeting({
          users_id: data.users_id,
          meetings_id: res.insertId,
          creator: true,
        });

        const updatedMeetingList = await meetingModel.getMeetingList({
          region_code: data.region_code,
        });

        pubClient.setEx(`meetingList:${data.region_code}`, 3600, JSON.stringify(updatedMeetingList));

        io.to(data.region_code).emit("list", updatedMeetingList);
        // pubClient.publish(data.region_code, JSON.stringify({ type: "listUpdate", data: updatedMeetingList }));
      }
    });

    // 모임 입장 (Enter a meeting)
    socket.on("enterMeeting", async (data) => {
      const enterRes = await meetingModel.enterMeeting({
        users_id: data.users_id,
        meetings_id: data.meetings_id,
      });


      if (enterRes.CODE !== "EM000") {
        return io.to(data.region_code).emit("enterRes", enterRes);
      }

      const meetingRoom = `${data.region_code}-${data.meetings_id}`;

      socket.join(meetingRoom);

      if (enterRes && enterRes.CODE === "EM000") {
        const lists = await meetingModel.getMeetingList({ region_code: data.region_code });
        pubClient.setEx(`meetingList:${data.region_code}`, 3600, JSON.stringify(lists));
        io.to(data.region_code).emit("list", lists);
      }

      pubClient.get(`messages:${data.region_code}:${data.meetings_id}`, async (err, result) => {
        if (result) {
          console.log("레디스!");
          io.to(meetingRoom).emit("messages", JSON.parse(result));
        } else {
          console.log("데이터베이스!");

          const messages = await meetingModel.getMessages(data.meetings_id);
          io.to(meetingRoom).emit("messages", messages);

          pubClient.setEx(`messages:${data.region_code}:${data.meetings_id}`, 3600, JSON.stringify(messages)); // Cache for 1 hour
        }
      });
      // const messages = await meetingModel.getMessages(data.meetings_id);

      const meetingData = await meetingModel.getMeetingData({ meetings_id: data.meetings_id });

      // io.to(meetingRoom).emit("messages", messages);
      io.to(meetingRoom).emit("meetingData", meetingData);
    });

    // 메시지 수신 및 전파 (Send message to a meeting room)
    socket.on("sendMessage", async (data) => {
      const meetingRoom = `${data.region_code}-${data.meetings_id}`;

      const res = await meetingModel.sendMessage(data);

      if (res.affectedRows > 0) {
        const message = await meetingModel.getMessage(data.meetings_id, res.insertId);

        io.to(meetingRoom).emit("receiveMessage", message);
        const messages = await meetingModel.getMessages(data.meetings_id);

        pubClient.setEx(`messages:${data.region_code}:${data.meetings_id}`, 3600, JSON.stringify(messages)); // Cache for 1 hour

        // pubClient.publish(meetingRoom, JSON.stringify({ type: "newMessage", data: message }));
      }
    });

    // 클라이언트가 연결 해제 시 처리 (Handle client disconnect)
    socket.on("disconnect", () => {
      console.log("disconnect", socket.id);
    });
  });
};
