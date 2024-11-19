const { promisify } = require("util"); // Import promisify
const { createClient } = require("redis");
const moimModel = require("./src/model/moimModel");
const { createAdapter } = require("@socket.io/redis-adapter");

// socket.js
module.exports = async (io) => {
  const pubClient = createClient({
    url: `redis://${process.env.REDIS_USERNAME}:${process.env.REDIS_PASSWORD}@${process.env.REDIS_HOST}:${process.env.REDIS_PORT}/0`,
    legacyMode: true, // 반드시 설정 !!
  });

  const getAsync = promisify(pubClient.get).bind(pubClient); // Promisify `get`
  const setExAsync = promisify(pubClient.setEx).bind(pubClient); // Promisify `setEx`

  const subClient = pubClient.duplicate();

  Promise.all([pubClient.connect(), subClient.connect()]);

  pubClient.on("error", (err) => {
    console.error("pubClient Error", err);
  });

  // getAsync(`accessToken:1`, (err, result) => {
  //   console.log("result", result);
  // });

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
    const enterMeeting = async ({ region_code, meetings_id, users_id, type }) => {
      const meetingRoom = `${region_code}-${meetings_id}`;
      socket.join(meetingRoom);

      try {
        const [myListCache, messagesCache, meetingListCache, meetingDataCache] = await Promise.all([
          getAsync(`myList:${users_id}`),
          getAsync(`messages:${region_code}:${meetings_id}`),
          getAsync(`meetingList:${region_code}`),
          getAsync(`meetingData:${region_code}:${meetings_id}`),
        ]);

        let meetingList, meetingData, messages;

        // Meeting data check
        if (meetingDataCache) {
          meetingData = JSON.parse(meetingDataCache);
          console.log("Redis cache used for meeting data");
        } else {
          meetingData = await moimModel.getMeetingData({ meetings_id });
          setExAsync(`meetingData:${region_code}:${meetings_id}`, 3600, JSON.stringify(meetingData));
          console.log("Database used for meeting data");
        }

        io.to(meetingRoom).emit("meetingData", meetingData);

        // Check user's meeting list cache
        if (myListCache) {
          const myList = JSON.parse(myListCache);
          const target = myList.find((v) => v.meetings_id === meetings_id && v.users_id === users_id);
          console.log("target", myList, target);
          const isApplied = target && Object.keys(target).length > 0;
          const isMember = target?.status === 1;

          console.log("isAppliedisApplied", isApplied, type);
          if (isMember) {
            // socket.join(meetingRoom);

            // io.to(region_code).emit('enterRes')

            await moimModel.modifyActiveTime({ meetings_id, users_id });
            io.to(region_code).emit("enterRes", { CODE: "EM000", DATA: "입장" });
          } else if (type === 3) {
            return io.to(region_code).emit("enterRes", { CODE: "EM001", DATA: "입장 신청이 필요합니다." });
          } else if (type === 4) {
            if (isApplied) {
              return io.to(region_code).emit("enterRes", { CODE: "EM002", DATA: "입장 신청이 완료되었습니다." });
            } else {
              console.log("enterResenterResenterRes");
              return io.to(region_code).emit("enterRes", { CODE: "EM001", DATA: "입장 신청이 필요합니다." });
            }
          }
        }

        // Meeting list check
        if (meetingListCache) {
          meetingList = JSON.parse(meetingListCache);
        } else {
          meetingList = await moimModel.getMeetingList({ region_code });
          await setExAsync(`meetingList:${region_code}`, 3600, JSON.stringify(meetingList));
        }
        io.to(region_code).emit("list", meetingList);

        // Messages check
        if (messagesCache) {
          // messages = JSON.parse(messagesCache);
          messages = await moimModel.getMessages({ meetings_id });
          // console.log("messagesmessages", messages);
          console.log("Redis cache used for messages", messages);
        } else {
          messages = await moimModel.getMessages({ meetings_id });
          console.log("messagesmessages", messages);
          if (messages.lists.length > 0) {
            await setExAsync(`messages:${region_code}:${meetings_id}`, 3600, JSON.stringify(messages));
          }
          console.log("Database used for messages");
        }
        io.to(meetingRoom).emit("messages", { list: messages.lists, total: messages.total, readId: null });

        // io.to(meetingRoom).emit("meetingData", meetingData);
      } catch (error) {
        console.error("Error in enterMeeting:", error);
      }
    };

    console.log("connection", socket.id);
    socket.emit("message", socket.id);
    const id = 1;
    // 나의 모임 목록
    socket.on("userData", async (data) => {
      console.log("dd", data);

      pubClient.get(`myList:${data.id}`, async (err, result) => {
        if (result) {
          console.log("mylist redis!!");
          io.to(socket.id).emit("myList", JSON.parse(result));
        } else {
          const res = await moimModel.getMyList({ users_id: data.id });
          pubClient.setEx(`myList:${data.id}`, 3600, JSON.stringify(res));

          io.to(socket.id).emit("myList", res);
        }
      });
    });

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

          const res = await moimModel.getMeetingList({ region_code: region_code });
          pubClient.setEx(`meetingList:${region_code}`, 3600, JSON.stringify(res)); // Cache for 1 hour

          io.to(region_code).emit("list", res);
        }
      });

      // subClient.subscribe(code);
    });

    // 모임 생성 (Generate a meeting)
    socket.on("generateMeeting", async (data) => {
      const res = await moimModel.generateMeeting({
        name: data.name,
        region_code: data.region_code,
        maxMembers: data.maxMembers,
        users_id: data.users_id,
        description: data.description,
        type: data.type,
        category1: data.category1,
        category2: data.category2,
      });

      if (res.affectedRows > 0) {
        // Add the user to the new meeting
        await moimModel.enterMeeting({
          users_id: data.users_id,
          meetings_id: res.insertId,
          type: data.type,
          creator: true,
        });

        const updatedMeetingList = await moimModel.getMeetingList({
          region_code: data.region_code,
        });

        pubClient.setEx(`meetingList:${data.region_code}`, 3600, JSON.stringify(updatedMeetingList));

        const updatemyList = await moimModel.getMyList({ users_id: data.users_id });

        await setExAsync(`myList:${data.users_id}`, 3600, JSON.stringify(updatemyList));
        io.to(data.region_code).emit("list", updatedMeetingList);
        // pubClient.publish(data.region_code, JSON.stringify({ type: "listUpdate", data: updatedMeetingList }));
      }
    });

    // 모임 입장 (Enter a meeting)
    socket.on("enterMeeting", enterMeeting);

    // 모임 입장 신청
    socket.on("joinMeeting", async ({ region_code, users_id, meetings_id, type }) => {
      // if (type === 3) {
      //   await moimModel.enterMeeting({ meetings_id, users_id, type });
      // } else if (type === 4) {
      //   return io.to(region_code).emit("enterRes", { CODE: EM002, DATA: "입장 신청이 완료되었습니다." });
      // }
      await moimModel.enterMeeting({ meetings_id, users_id, type });

      const res = await moimModel.getMyList({ users_id });
      pubClient.setEx(`myList:${users_id}`, 3600, JSON.stringify(res));

      enterMeeting({ meetings_id, users_id, region_code, type });
    });

    // 모임 떠남
    socket.on("leaveMeeting", async ({ region_code, meetings_id }) => {
      socket.leave(`${region_code}-${meetings_id}`);
    });

    // 메시지 수신 및 전파 (Send message to a meeting room)
    socket.on("sendMessage", async ({ region_code, meetings_id, contents, users_id }) => {
      const meetingRoom = `${region_code}-${meetings_id}`;

      const res = await moimModel.sendMessage({ region_code, meetings_id, contents, users_id });

      if (res.affectedRows > 0) {
        await moimModel.modifyActiveTime({ meetings_id, users_id });
        const message = await moimModel.getMessage(meetings_id, res.insertId);
        console.log("message", message);
        // await moimModel.updateRead({ id: res.insertId, meetings_id: data.meetings_id, users_id: data.users_id });

        io.to(meetingRoom).emit("receiveMessage", message);

        const messages = await moimModel.getMessages({ meetings_id: meetings_id });

        setExAsync(`messages:${region_code}:${meetings_id}`, 3600, JSON.stringify(messages));
      }
    });

    // socket.on("readMessage", async (data) => {
    //   await moimModel.updateRead(data);
    // });

    // 클라이언트가 연결 해제 시 처리 (Handle client disconnect)
    socket.on("disconnect", () => {
      console.log("disconnect", socket.id);
    });
  });
};
