const { createClient } = require("redis");
const { promisify } = require("util"); // Import promisify
const { createAdapter } = require("@socket.io/redis-adapter");
const moimModel = require("../../model/moimModel");
const { default: axios } = require("axios");
const { decryptMessage } = require("../../utils/aes");

class ChatService {
  constructor(io) {
    this.io = io;
    this.typingUsers = [];
    this.typingTimers = {};

    this.initializeRedis();
    this.setupSocketIO();
  }

  async initializeRedis() {
    this.pubClient = createClient({
      url: `redis://${process.env.REDIS_USERNAME}:${process.env.REDIS_PASSWORD}@${process.env.REDIS_HOST}:${process.env.REDIS_PORT}/0`,
      legacyMode: true,
    });

    this.subClient = this.pubClient.duplicate();
    await Promise.all([this.pubClient.connect(), this.subClient.connect()]);

    this.getAsync = promisify(this.pubClient.get).bind(this.pubClient);
    this.setExAsync = promisify(this.pubClient.setEx).bind(this.pubClient);

    this.pubClient.on("error", (err) => console.error("Redis PubClient Error:", err));
    this.subClient.on("error", (err) => console.error("Redis SubClient Error:", err));

    this.io.adapter(createAdapter(this.pubClient, this.subClient));

    // 레디스 채널 구독
    const channels = ["message", "region_code", "meetingRoom"];
    channels.forEach((channel) => {
      this.subClient.v4.subscribe(channel, (message) => this.handleRedisMessage(channel, message));
    });
  }

  // 레디스 메세지
  handleRedisMessage(channel, message) {
    console.log("123zxczxczxc", channel);
    try {
      const parsedMessage = JSON.parse(message);
      this.io.to(parsedMessage.room).emit(parsedMessage.event, parsedMessage.data);
    } catch (error) {
      console.error(`${channel} error`, error);
    }
  }

  setupSocketIO() {
    this.io.on("connection", (socket) => {
      console.log("New client connected", socket.id);

      socket.emit("message", socket.id);

      // 나의 모임 목록 'myList'
      socket.on("userData", ({ data }) => {
        console.log("asdfmkdsf", data);
        this.handleMyListData(socket, { id: data.id });
      });
      // 지역 입장
      socket.on("join", ({ region_code }) => {
        this.handleJoinRegion(socket, { region_code });
        console.log("handleJoinRegion");
      });
      // 모임 입장
      socket.on("enterMeeting", (data) => {
        this.handleEnterMeeting(socket, data);
      });
      // 모임 생성
      socket.on("generateMeeting", (data) => this.handleGenerateMeeting(socket, data));
      // // 메세지 보내기
      // socket.on("sendMessage", (data) => this.handleSendMessage(socket, data));
      // // 메세지 입력중
      // socket.on("typing", (data) => this.handleTyping(socket, data));

      // // 소켓 연결 해제
      // socket.on("disconnect", () => this.handleDisconnect(socket));
    });
  }

  async handleMyListData(socket, { id }) {
    console.log("asdfasd", id);
    const result = await this.getAsync(`myList:${id}`);

    console.log("result", result);

    if (result) {
      this.pubClient.publish(
        "meetingRoom",
        JSON.stringify({
          room: socket.id,
          event: "myList",
          data: JSON.parse(result),
        })
      );
    } else {
      const myList = await moimModel.getMyList({ users_id: id });
      await this.setExAsync(`myList:${id}`, 3600, JSON.stringify(myList));
    }
  }

  async handleJoinRegion(socket, { region_code }) {
    console.log("data123123", region_code);
    socket.join(region_code);

    const data = await this.getAsync(`meetingList:${region_code}`);
    let result = JSON.parse(data);
    console.log("result", result);

    if (!result) {
      const data = await moimModel.getMeetingList({ region_code });

      result = await Promise.all(
        data.map(async (v) => {
          const { id } = v;
          const meetingsUserData = await this.getAsync(`meetingsUsers:${region_code}:${id}`);

          const last_active_time = JSON.parse(meetingsUserData)
            ?.map((v) => v.last_active_time)
            .sort((a, b) => new Date(b) - new Date(a))[0];

          return { ...v, last_active_time };
        })
      );

      console.log("zxczxczx", result);
      await this.setExAsync(`meetingList:${region_code}`, 3600, JSON.stringify(result));
    }

    this.pubClient.publish(
      "region_code",
      JSON.stringify({
        room: region_code,
        event: "list",
        data: result,
      })
    );
  }

  async handleGenerateMeeting(socket, data) {
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

    // 모임 생성 성공 시
    if (res.affectedRows > 0) {
      if (data.onesignal_id) {
        const tags = await this.getOnesignalUserTags(data.onesignal_id);

        console.log("tags", tags);

        if (tags) {
          const meetings_ids = [...tags.meetings_id.split(","), res.insertId].filter((v, i, arr) => arr.indexOf(v) === i);

          await this.patchOnesignalTags(res.insertId, data.users_id, data.onesignal_id, tags, meetings_ids);
        } else {
          await this.patchOnesignalTags(res.insertId, data.users_id, data.onesignal_id);
        }
      }
    }

    await moimModel.enterMeeting({
      users_id: data.users_id,
      meetings_id: res.insertId,
      type: data.type,
      creator: true,
    });

    const updatedMeetingList = await moimModel.getMeetingList({
      region_code: data.region_code,
    });

    await this.setExAsync(`meetingList:${data.region_code}`, 3600, JSON.stringify(updatedMeetingList));

    const updatemyList = await moimModel.getMyList({ users_id: data.users_id });

    await this.setExAsync(`myList:${data.users_id}`, 3600, JSON.stringify(updatemyList));

    this.pubClient.publish(
      "region_code",
      JSON.stringify({
        room: data.region_code,
        event: "list",
        data: updatedMeetingList,
      })
    );
  }

  async handleEnterMeeting(socket, { region_code, meetings_id, users_id, type, onesignal_id }) {
    try {
      const meetingRoom = `${region_code}:${meetings_id}`;
      socket.join(meetingRoom);
      socket.data.userId = users_id;

      const usersInRoom = this.getUsersInRoom(meetingRoom);

      await this.pubClient.publish(
        "meetingRoom",
        JSON.stringify({
          room: meetingRoom,
          event: "usersInRoom",
          data: usersInRoom,
        })
      );

      const [myListCache, messagesCache, meetingListCache, meetingDataCache, meetingsUsersCache] = await Promise.all([
        this.getAsync(`myList:${users_id}`),
        this.getAsync(`messages:${region_code}:${meetings_id}`),
        this.getAsync(`meetingList:${region_code}`),
        this.getAsync(`meetingData:${region_code}:${meetings_id}`),
        this.getAsync(`meetingsUsers:${region_code}:${meetings_id}`),
      ]);

      let meetingList, meetingData, messages, meetingsUsers, myList;

      if (meetingDataCache) {
        meetingData = JSON.parse(meetingDataCache);
      } else {
        meetingData = await moimModel.getMeetingData({ meetings_id });

        await this.setExAsync(`meetingData:${region_code}:${meetings_id}`, 3600, JSON.stringify(meetingData));
      }

      await this.pubClient.publish(
        "meetingRoom",
        JSON.stringify({
          room: meetingRoom,
          event: "meetingData",
          data: meetingData,
        })
      );

      if (myListCache) {
        myList = JSON.parse(myListCache);
      } else {
        myList = await moimModel.getMyList({ users_id: users_id });
        this.setExAsync(`myList:${users_id}`, 3600, JSON.stringify(myList));
      }

      const target = myList.find((v) => v.meetings_id === meetings_id && v.users_id === users_id);

      const isApplied = target && Object.keys(target).length > 0;
      const isMember = target?.status === 1;

      if (isMember) {
        const row = await moimModel.modifyActiveTime({ meetings_id, users_id });

        meetingsUsers = await moimModel.getMeetingsUsers({ meetings_id });
        if (onesignal_id) {
          const tags = await this.getOnesignalUserTags(onesignal_id);

          console.log("tags", tags);

          if (tags) {
            const meetings_ids = [...tags.meetings_id.split(","), meetings_id].filter((v, i, arr) => arr.indexOf(v) === i);

            await this.patchOnesignalTags(meetings_id, users_id, onesignal_id, tags, meetings_ids);
          } else {
            await this.patchOnesignalTags(meetings_id, users_id, onesignal_id);
          }
        }

        await this.setExAsync(`meetingsUsers:${region_code}:${meetings_id}`, 3600, JSON.stringify(meetingsUsers));

        await this.pubClient.publish(
          "message",
          JSON.stringify({
            room: socket.id,
            event: "enterRes",
            data: { CODE: "EM000", DATA: "입장" },
          })
        );
      } else if (type === 3) {
        return this.pubClient.publish(
          "message",
          JSON.stringify({
            room: socket.id,
            event: "enterRes",
            data: { CODE: "EM001", DATA: "입장 신청이 필요합니다." },
          })
        );
      } else if (type === 4) {
        if (isApplied) {
          return this.pubClient.publish(
            "message",
            JSON.stringify({
              room: socket.id,
              event: "enterRes",
              data: { CODE: "EM002", DATA: "입장 신청이 완료되었습니다." },
            })
          );
        } else {
          return this.pubClient.publish(
            "message",
            JSON.stringify({
              room: socket.id,
              event: "enterRes",
              data: { CODE: "EM001", DATA: "입장 신청이 필요합니다." },
            })
          );
        }
      }

      // Meeting list check
      if (meetingListCache) {
        meetingList = JSON.parse(meetingListCache);
      } else {
        meetingList = await moimModel.getMeetingList({ region_code });
        await this.setExAsync(`meetingList:${region_code}`, 3600, JSON.stringify(meetingList));
      }

      this.pubClient.publish(
        "region_code",
        JSON.stringify({
          room: region_code,
          event: "list",
          data: meetingList,
        })
      );

      messages = await moimModel.getMessages({ meetings_id });

      const decryptMessages = messages.lists.map((v) => ({ ...v, contents: decryptMessage(v.contents) }));

      if (messages.lists.length > 0) {
        await this.setExAsync(`messages:${region_code}:${meetings_id}`, 3600, JSON.stringify(messages));
      }

      this.pubClient.publish(
        "meetingRoom",
        JSON.stringify({
          room: meetingRoom,
          event: "messages",
          data: { list: decryptMessages, total: messages.total, readId: null },
        })
      );

      this.pubClient.publish(
        "meetingRoom",
        JSON.stringify({
          room: meetingRoom,
          event: "meetingActive",
          data: meetingsUsers,
        })
      );

      console.log("cache", myListCache);
    } catch (error) {
      console.error("입장 에러", error);
    }
  }

  async getOnesignalUserTags(onesignal_id) {
    const res = await axios.get(`https://api.onesignal.com/apps/${process.env.ONESIGNAL_APP_ID}/users/by/onesignal_id/${onesignal_id}`);

    if (!res) return;

    return res.data.properties.tags;
  }

  async patchOnesignalTags(meetings_id, users_id, onesignal_id, tags, meetings_ids) {
    if (tags && meetings_ids) {
      axios.patch(`https://api.onesignal.com/apps/${process.env.ONESIGNAL_APP_ID}/users/by/onesignal_id/${onesignal_id}`, {
        properties: {
          tags: {
            ...tags,
            meetings_id: meetings_ids.join(",").replaceAll(" ", ""),
            user_id: users_id,
          },
        },
      });
    } else {
      axios.patch(`https://api.onesignal.com/apps/${process.env.ONESIGNAL_APP_ID}/users/by/onesignal_id/${onesignal_id}`, {
        properties: {
          tags: {
            meetings_id: String(meetings_id),
            user_id: users_id,
          },
        },
      });
    }
  }

  async getUsersInRoom(regionCodeAndMeetingsId) {
    const clients = this.io.sockets.adapter.rooms.get(regionCodeAndMeetingsId) || new Set();

    return Array.from(clients).map((socketId) => {
      const socket = this.io.sockets.sockets.get(socketId);
      return socket?.data.userId || null;
    });
  }
}

module.exports = (io) => {
  new ChatService(io);
};
