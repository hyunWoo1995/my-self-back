const meetingModel = require("./src/model/meetingModel");

// socket.js
module.exports = (io) => {
  io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    socket.emit("message", socket.id);

    // 지역 입장
    socket.on("join", async ({ user, code }) => {
      console.log("data", user, code);
      console.log(`${user?.name}님이 ${code} 지역에 입장했습니다!!`);

      const res = await meetingModel.getMeetingList();

      socket.join(code);
      console.log(" get res", res);
      io.to(code).emit("list", res);
    });

    // 모임 생성
    socket.on("generateMeeting", async (data) => {
      const res = await meetingModel.generateMeeting({ name: data.name, region: data.region, maxMembers: data.maxMembers });

      console.log("res", res);
    });

    // 모임 입장
    socket.on("enterMeeting", async (data) => {
      const meetingRoom = `${data.region_code}-${data.meetings_id}`;
      socket.join(meetingRoom);
      console.log(`${data.meetings_id} 지역에 입장했습니다!!`);
      const messages = await meetingModel.getMessages(data.meetings_id);

      console.log("enterMeeting", data, messages);

      io.to(meetingRoom).emit("messages", messages);
    });

    // 메시지 수신 및 전파
    socket.on("chat message", (msg) => {
      io.emit("chat message", msg); // 모든 클라이언트에 메시지 전송
    });

    socket.on("sendMessage", async (msg) => {
      const meetingRoom = `A02-2`;
      socket.join(meetingRoom);

      console.log("sendMessagesendMessage", msg);

      const res = await meetingModel.sendMessage();

      console.log("res", res);

      if (res.affectedRows > 0) {
        const messages = await meetingModel.getMessages(2);
        console.log("🔥🔥", messages);
        io.to(meetingRoom).emit("messages", messages);
      }
    });

    // 클라이언트가 연결 해제 시 처리
    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
    });
  });
};
