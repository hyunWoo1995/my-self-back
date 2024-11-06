const meetingModel = require("./src/model/meetingModel");
const redisClient = require("./src/utils/redis");

// socket.js
module.exports = (io) => {
  io.on("connection", (socket) => {
    socket.emit("message", socket.id);

    // 지역 입장
    socket.on("join", async ({ user, code }) => {
      socket.join(code);
      redisClient.get(`meetingList:${code}`, async (err, result) => {
        if (result) {
          console.log("레디스!");
          io.to(code).emit("list", JSON.parse(result));
        } else {
          console.log("데이터베이스!");

          const res = await meetingModel.getMeetingList({ region_code: code });
          // 1시간 캐싱
          redisClient.setEx(`meetingList:${code}`, 3600, JSON.stringify(res));
        }
      });
    });

    // 모임 생성
    socket.on("generateMeeting", async (data) => {
      const res = await meetingModel.generateMeeting({
        name: data.name,
        region_code: data.region_code,
        maxMembers: data.maxMembers,
        users_id: data.users_id,
        description: data.description,
      });

      if (res.affectedRows > 0) {
        await meetingModel.enterMeeting({
          users_id: data.users_id,
          meetings_id: res.insertId,
        });

        const updatedMeetingList = await meetingModel.getMeetingList({
          region_code: data.region_code,
        });

        redisClient.setEx(
          `meetingList:${data.region_code}`,
          3600, // Cache expiration time (e.g., 1 hour)
          JSON.stringify(updatedMeetingList)
        );

        io.to(data.region_code).emit("list", updatedMeetingList);
      }
    });

    // 모임 입장
    socket.on("enterMeeting", async (data) => {
      const meetingRoom = `${data.region_code}-${data.meetings_id}`;
      socket.join(meetingRoom);

      const enterRes = await meetingModel.enterMeeting({ users_id: data.users_id, meetings_id: data.meetings_id });

      if (enterRes && enterRes.affectedRows > 0) {
        const lists = await meetingModel.getMeetingList({ region_code: data.region_code });
        io.to(data.region_code).emit("list", lists);
      }

      const messages = await meetingModel.getMessages(data.meetings_id);

      const meetingData = await meetingModel.getMeetingData({ meetings_id: data.meetings_id });

      io.to(meetingRoom).emit("messages", messages);
      io.to(meetingRoom).emit("meetingData", meetingData);
    });

    socket.on("sendMessage", async (data) => {
      const meetingRoom = `${data.region_code}-${data.meetings_id}`;
      // socket.join(meetingRoom);

      const res = await meetingModel.sendMessage(data);

      if (res.affectedRows > 0) {
        const message = await meetingModel.getMessage(data.meetings_id, res.insertId);

        io.to(meetingRoom).emit("receiveMessage", message);
      }
    });

    // 클라이언트가 연결 해제 시 처리
    socket.on("disconnect", () => {});
  });
};
