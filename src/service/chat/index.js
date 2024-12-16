const moimModel = require("../../model/moimModel");
const userModel = require("../../model/userModel");
const { findByUser, findByUserEmail } = require("../../model/userModel");
const { decryptMessage, encryptMessage } = require("../../utils/aes");
const onesignal = require("./onesignal");
const fcm = require("../../../firebase");
const { redisClient } = require("../../utils/redis");
const moment = require("moment");

let typingUsers = [];
const typingTimers = {}; // To store timers for each user

// 모임 입장
exports.handleEnterMeeting = async ({ socket, pubClient, getAsync, setExAsync, io, smembers, getMoimDetails }, { region_code, meetings_id, users_id, type, fcmToken, afterBlur }) => {
  console.log("afterBlurafterBlur", afterBlur ? "true" : "false");

  try {
    const meetingRoom = `${region_code}:${meetings_id}`;
    socket.join(meetingRoom);
    socket.join(`${meetingRoom}:active`);
    socket.data.userId = users_id;

    // 현재 room에 접속한 사용자 목록 요청
    const usersInRoom = this.getUsersInRoom(io, meetingRoom);
    console.log("usersInRoom", usersInRoom);

    await pubClient.publish(
      "meetingRoom",
      JSON.stringify({
        room: meetingRoom,
        event: "usersInRoom",
        data: usersInRoom,
      })
    );

    const [myListCache, messagesCache, meetingListCache, meetingsUsersCache] = await Promise.all([
      getAsync(`myList:${users_id}`),
      getAsync(`messages:${region_code}:${meetings_id}`),
      getAsync(`meetingList:${region_code}`),
      // getAsync(`meetingData:${region_code}:${meetings_id}`),
      getAsync(`meetingsUsers:${region_code}:${meetings_id}`),
      // smembers(`moimData:${meetings_id}`),
      // smembers(`myMoimList:${users_id}`),
    ]);

    let meetingsUsers;

    // 모임데이터 캐싱 확인
    const moimData = moimDataCache.length > 0 ? JSON.parse(moimDataCache) : await moimModel.getMeetingData({ meetings_id });

    // 캐싱 없다면 레디스 추가
    if (moimDataCache.length < 1) {
      await pubClient.sadd(`moimData:${meetings_id}`, JSON.stringify(moimData));
    }

    // 모임 데이터 전송
    await pubClient.publish(
      "meetingRoom",
      JSON.stringify({
        room: meetingRoom,
        event: "meetingData",
        data: moimData,
      })
    );

    const myList = myListCache ? JSON.parse(myListCache) : await moimModel.getMyList({ users_id });

    if (!myListCache) {
      await setExAsync(`myList:${users_id}`, 3600, JSON.stringify(myList));
    }

    const target = myList.find((v) => v.id === meetings_id && v.users_id === users_id);

    const isApplied = target && Object.keys(target).length > 0;
    const isMember = target?.status === 1;

    if (isMember) {
      if (fcmToken) {
        fcm.handleSubscribeTopic({ token: fcmToken, topic: meetings_id });
      }

      await moimModel.modifyActiveTime({ meetings_id, users_id });

      meetingsUsers = await moimModel.getMeetingsUsers({ meetings_id });

      await setExAsync(`meetingsUsers:${region_code}:${meetings_id}`, 3600, JSON.stringify(meetingsUsers));

      await pubClient.publish(
        "message",
        JSON.stringify({
          room: socket.id,
          event: "enterRes",
          data: { CODE: "EM000", DATA: "입장" },
        })
      );
    } else if (type === 3) {
      return pubClient.publish(
        "message",
        JSON.stringify({
          room: socket.id,
          event: "enterRes",
          data: { CODE: "EM001", DATA: "입장 신청이 필요합니다." },
        })
      );
    } else if (type === 4) {
      if (isApplied) {
        return pubClient.publish(
          "message",
          JSON.stringify({
            room: socket.id,
            event: "enterRes",
            data: { CODE: "EM002", DATA: "입장 신청이 완료되었습니다." },
          })
        );
      } else {
        return pubClient.publish(
          "message",
          JSON.stringify({
            room: socket.id,
            event: "enterRes",
            data: { CODE: "EM001", DATA: "입장 신청이 필요합니다." },
          })
        );
      }
    }

    const meetingList = meetingListCache ? JSON.parse(meetingListCache) : await moimModel.getMeetingList({ region_code });

    if (!meetingListCache) {
      await setExAsync(`meetingList:${region_code}`, 3600, JSON.stringify(meetingList));
    }

    await pubClient.publish(
      "region_code",
      JSON.stringify({
        room: region_code,
        event: "list",
        data: meetingList,
      })
    );

    const messages = messagesCache ? JSON.parse(messagesCache) : await moimModel.getMessages({ meetings_id });

    const decryptMessages = handleDecryptMessages(messages.lists);

    const userJoinDate = new Date(meetingsUsers.find((v) => v.users_id === users_id).created_at);

    console.log(
      "decryptMessages",
      decryptMessages.filter((v) => moment(v.created_at).isSameOrAfter(userJoinDate))
    );

    if (messages.lists.length > 0) {
      await setExAsync(`messages:${region_code}:${meetings_id}`, 3600, JSON.stringify(messages));
    }

    if (!afterBlur) {
      await pubClient.publish(
        "message",
        JSON.stringify({
          room: socket.id,
          event: "messages",
          data: { list: decryptMessages, total: messages.total },
        })
      );
    }
    await pubClient.publish(
      "meetingRoom",
      JSON.stringify({
        room: meetingRoom,
        event: "meetingActive",
        data: meetingsUsers,
      })
    );
  } catch (err) {
    console.error("handleEnterMeeting error", err);
  }
};

// 나의 모임 목록
exports.getMyList = async ({ socket, pubClient, getAsync, setExAsync }, { data }) => {
  console.log("dddd12345", data);

  if (!data) return;

  const myListCache = await getAsync(`myList:${data.user_id}`);

  // const myList = myListCache ? JSON.parse(myListCache) : await moimModel.getMyList({ users_id: data.user_id });
  const myList = await moimModel.getMyList({ users_id: data.user_id });

  if (!myListCache) {
    await setExAsync(`myList:${data.user_id}`, 3600, JSON.stringify(myList));
  }

  await pubClient.publish(
    "message",
    JSON.stringify({
      room: socket.id,
      event: "myList",
      data: myList,
    })
  );
};

// 지역 입장
exports.handleJoinRegion = async ({ socket, pubClient, getAsync, setExAsync }, { region_code }) => {
  socket.join(region_code);

  const meetingListcache = await getAsync(`meetingList:${region_code}`);

  let meetingList = meetingListcache ? JSON.parse(meetingListcache) : await moimModel.getMeetingList({ region_code });

  console.log("meetingListcachemeetingListcache", meetingListcache);

  if (!meetingListcache) {
    await handleActiveTimeMeeting({ meetingList, getAsync, pubClient, setExAsync, region_code });
  } else {
    await pubClient.publish(
      "region_code",
      JSON.stringify({
        room: region_code,
        event: "list",
        data: meetingList,
      })
    );
  }
};

// 모임 생성
exports.handleGenerateMeeting = async ({ socket, io, pubClient, getAsync, setExAsync }, data) => {
  if (data.name.length < 5 || data.name.length > 40 || data.description.length < 20 || data.description.length > 500) {
    io.to(socket.id).emit("error", {
      message: "모임 제목 또는 모임 설명이 조건에 맞지 않습니다.",
      CODE: "GM001",
    });
    return;
  }

  const res = await moimModel.generateMeeting({
    name: data.name,
    region_code: data.region_code,
    maxMembers: data.maxMembers,
    users_id: data.users_id,
    description: data.description,
    type: data.type,
    category1: data.category1,
    category2: data.category2,
    date: data.date,
  });

  // 생성 성공
  if (res.affectedRows > 0) {
    const key = `moimList:${data.region_code}`;

    const meetingData = await moimModel.getMeetingData({ meetings_id: res.insertId });

    console.log("meetingDatameetingDatameetingData", meetingData);

    // await pubClient.sadd(key, res.insertId);
    // await pubClient.sadd(`moimData:${data.region_code}:${data.users_id}`, JSON.stringify(meetingData));

    // const lists = await pubClient.smembers(key);
    // console.log("lsssss", lists);

    // 만든 사람은 바로 입장 처리
    const enterRes = await moimModel.enterMeeting({
      users_id: data.users_id,
      meetings_id: res.insertId,
      type: data.type,
      creator: true,
    });

    // if (enterRes.CODE === "EM000" && !enterRes.update) {
    //   const key = `myMoimList:${data.users_id}`;
    //   await pubClient.sadd(key, res.insertId);
    // }

    const [updatemyList, updateMeetingList] = await Promise.all([
      moimModel.getMyList({ users_id: data.users_id }),
      moimModel.getMeetingList({
        region_code: data.region_code,
      }),
    ]);

    await setExAsync(`meetingList:${data.region_code}`, 3600, JSON.stringify(updateMeetingList));
    await setExAsync(`myList:${data.users_id}`, 3600, JSON.stringify(updatemyList));

    await pubClient.publish(
      "region_code",
      JSON.stringify({
        room: data.region_code,
        event: "list",
        data: updateMeetingList,
      })
    );
  }
};

// 모임 입장 신청
exports.handleJoinMeeting = async ({ socket, pubClient, getAsync, setExAsync, io }, { region_code, users_id, meetings_id, type, fcmToken }) => {
  try {
    const enterRes = await moimModel.enterMeeting({ meetings_id, users_id, type });

    console.log("enterRes", enterRes);

    if (enterRes.CODE === "EM000") {
      const key = `myMoimList:${users_id}`;
      await pubClient.sadd(key, meetings_id);

      // if (onesignal_id) {

      // const email = await findByUserEmail(users_id);
      // onesignal.handleOnesignalTags({ email, meetings_id, users_id });
      // }

      if (fcmToken) {
        fcm.handleSubscribeTopic({ token: fcmToken, topic: meetings_id });
      }

      const [meetingsUsersCache, userInfo, meetingList, meetingData] = await Promise.all([
        getAsync(`meetingsUsers:${region_code}:${meetings_id}`),
        findByUser(users_id),
        moimModel.getMeetingList({ region_code }),
        moimModel.getMeetingData({ meetings_id }),
      ]);

      const meetingsUsers = meetingsUsersCache ? JSON.parse(meetingsUsersCache) : await moimModel.getMeetingsUsers({ meetings_id });

      const res = await moimModel.sendMessage({
        meetings_id,
        contents: encryptMessage(`${userInfo?.nickname}님이 입장했습니다.`),
        users_id,
        users: meetingsUsers.map((v) => v.users_id).join(","),
        admin: 1,
      });

      const message = await moimModel.getMessage(meetings_id, res.insertId);

      const decryptMes = decryptMessage(message.contents);

      await pubClient.publish(
        "meetingRoom",
        JSON.stringify({
          room: `${region_code}:${meetings_id}`,
          event: "receiveMessage",
          data: { ...message, contents: decryptMes },
        })
      );

      const messages = await moimModel.getMessages({ meetings_id: meetings_id });
      setExAsync(`messages:${region_code}:${meetings_id}`, 3600, JSON.stringify(messages));
      setExAsync(`meetingList:${region_code}`, 3600, JSON.stringify(meetingList));
      setExAsync(`meetingData:${region_code}:${meetings_id}`, 3600, JSON.stringify(meetingData));

      await pubClient.publish(
        "meetingRoom",
        JSON.stringify({
          room: `${region_code}:${meetings_id}`,
          event: "messages",
        })
      );
    } else {
      if (enterRes.CODE === "EM002") {
        io.to(socket.id).emit("error", {
          message: "입장 인원이 가득 찼습니다.",
          CODE: "JM001",
        });
      }
    }

    const myList = await moimModel.getMyList({ users_id });

    setExAsync(`myList:${users_id}`, 3600, JSON.stringify(myList));

    await this.handleEnterMeeting({ socket, pubClient, getAsync, setExAsync, io }, { region_code, meetings_id, users_id, type });
  } catch (err) {
    console.error("handleJoinMeeting error", err);
  }
};

// 메세지 보내기
exports.handleSendMessage = async ({ socket, pubClient, getAsync, setExAsync, io }, { region_code, meetings_id, contents, users_id, reply_id, tag_id }) => {
  console.log("reply_idreply_id", reply_id, meetings_id);
  const meetingRoom = `${region_code}:${meetings_id}`;

  const meetingsUsersCache = await getAsync(`meetingsUsers:${meetingRoom}`);

  const meetingsUsers = meetingsUsersCache ? JSON.parse(meetingsUsersCache) : await moimModel.getMeetingsUsers({ meetings_id });

  console.log("eee", meetingsUsers);

  const res = await moimModel.sendMessage({
    region_code,
    meetings_id,
    contents: encryptMessage(contents),
    users_id,
    reply_id,
    users: meetingsUsers?.map((v) => v.users_id)?.join(","),
    tag_id,
  });

  // 전송 성공
  if (res.affectedRows > 0) {
    // onesignal.handleOnesignalNotification({ meetings_id, users_id, contents });
    const meetingData = await moimModel.getMeetingItem({ meetings_id });
    fcm.topicSendMeesage({ subtitle: meetingData.name, body: contents, topic: meetings_id, sender_id: users_id });

    const usersInRoom = this.getUsersInRoom(io, `${meetingRoom}:active`);

    console.log("usersInRoomusersInRoom", usersInRoom);

    if (usersInRoom) {
      await moimModel.modifyActiveTime({ meetings_id, users_id: usersInRoom });
      const meetingsUsers = await moimModel.getMeetingsUsers({ meetings_id });

      await setExAsync(`meetingsUsers:${region_code}:${meetings_id}`, 3600, JSON.stringify(meetingsUsers));

      await pubClient.publish(
        "meetingRoom",
        JSON.stringify({
          room: meetingRoom,
          event: "meetingActive",
          data: meetingsUsers,
        })
      );
    }

    const message = await moimModel.getMessage(meetings_id, res.insertId);
    const decryptMes = decryptMessage(message.contents);

    let data;

    if (message.reply_contents) {
      data = { ...message, contents: decryptMes, reply_contents: decryptMessage(message.reply_contents) };
    } else {
      data = { ...message, contents: decryptMes };
    }

    await pubClient.publish(
      "meetingRoom",
      JSON.stringify({
        room: meetingRoom,
        event: "receiveMessage",
        data,
      })
    );

    const meetingListcache = await getAsync(`meetingList:${region_code}`);

    let meetingList = meetingListcache ? JSON.parse(meetingListcache) : await moimModel.getMeetingList({ region_code });
    await handleActiveTimeMeeting({ pubClient, getAsync, meetingList, region_code, setExAsync, meetings_id });

    const messages = await moimModel.getMessages({ meetings_id: meetings_id });

    setExAsync(`messages:${region_code}:${meetings_id}`, 3600, JSON.stringify(messages));
  }
};

// 채팅 타이핑
exports.handleChatTyping = async ({ socket, pubClient, getAsync, setExasync }, { region_code, meetings_id, users_id }) => {
  const meetingRoom = `${region_code}:${meetings_id}`;

  const nickname = await userModel.findByUserNickname(users_id);

  const userIndex = typingUsers.findIndex((v) => v.users_id === users_id);

  if (userIndex === -1) {
    typingUsers.push({ users_id, nickname });
    await pubClient.publish(
      "meetingRoom",
      JSON.stringify({
        room: meetingRoom,
        event: "userTyping",
        data: typingUsers,
      })
    );
  }

  if (typingTimers[users_id]) clearTimeout(typingTimers[users_id]);

  typingTimers[users_id] = setTimeout(async () => {
    typingUsers = typingUsers.filter((v) => v.users_id !== users_id);
    delete typingTimers[users_id]; // Clean up timer reference

    await pubClient.publish(
      "meetingRoom",
      JSON.stringify({
        room: meetingRoom,
        event: "userTyping",
        data: typingUsers,
      })
    );
  }, 1000);
};

// 모임 접속 유저 확인
exports.getUsersInRoom = (io, roomId) => {
  const clients = io.sockets.adapter.rooms.get(roomId) || new Set();

  return Array.from(clients).map((socketId) => {
    const socket = io.sockets.sockets.get(socketId);
    return socket?.data.userId || null;
  });
};

// 모임 유저 확인
exports.getUserList = async ({ socket, pubClient, getAsync, setExAsync }, { meetings_id, region_code }) => {
  const meetingRoom = `${region_code}:${meetings_id}`;

  const meetingsUsersCache = await getAsync(`meetingsUsers:${meetingRoom}`);

  const meetingsUsers = meetingsUsersCache ? JSON.parse(meetingsUsersCache) : await moimModel.getMeetingsUsers({ meetings_id });

  if (!meetingsUsersCache) {
    await setExAsync(`meetingsUsers:${meetingRoom}`, 3600, JSON.stringify(meetingsUsers));
  }

  await pubClient.publish(
    "meetingRoom",
    JSON.stringify({
      room: meetingRoom,
      event: "userList",
      data: meetingsUsers,
    })
  );
};

// 좋아요
exports.handleLikeMoim = async ({ socket, pubClient, getAsync, setExAsync }, { users_id, meetings_id, region_code }) => {
  const result = await moimModel.handleLikeMeeting({ users_id, meetings_id });
  const meetingRoom = `${region_code}:${meetings_id}`;

  console.log("rrr", result);

  if (result.affectedRows > 0) {
    // const meetingListcache = await getAsync(`meetingList:${region_code}`);

    // let meetingList = meetingListcache ? JSON.parse(meetingListcache) : await moimModel.getMeetingList({ region_code });
    let meetingList = await moimModel.getMeetingList({ region_code });

    await setExAsync(`meetingList:${region_code}`, 3600, JSON.stringify(meetingList));

    const meetingData = await moimModel.getMeetingData({ meetings_id });

    await setExAsync(`meetingData:${region_code}:${meetings_id}`, 3600 * 24 * 15, JSON.stringify(meetingData));

    pubClient.publish(
      "region_code",
      JSON.stringify({
        room: region_code,
        event: "list",
        data: meetingList,
      })
    );
    await pubClient.publish(
      "meetingRoom",
      JSON.stringify({
        room: meetingRoom,
        event: "meetingData",
        data: meetingData,
      })
    );
  }
};

// 모임 나가기
exports.handleLeaveMoim = async ({ socket, pubClient, getAsync, setExAsync }, { users_id, meetings_id, region_code }) => {
  const meetingRoom = `${region_code}:${meetings_id}`;
  // meetings_users 테이블 상태 변경
  const res = await moimModel.handleLeaveMeeting({ users_id, meetings_id });

  const userInfo = await findByUser(users_id);
  const meetingsUsersCache = await getAsync(`meetingsUsers:${region_code}:${meetings_id}`);
  const meetingsUsers = meetingsUsersCache ? JSON.parse(meetingsUsersCache) : await moimModel.getMeetingsUsers({ meetings_id });

  if (res.CODE === "LM000") {
    const key = `myMoimList:${users_id}`;
    // await pubClient.sadd(key, meetings_id);
    await pubClient.srem(key, meetings_id);

    const res = await moimModel.sendMessage({
      meetings_id,
      contents: encryptMessage(`${userInfo?.nickname}님이 방을 나갔습니다.`),
      users_id,
      users: meetingsUsers.map((v) => v.users_id).join(","),
      admin: 1,
    });

    console.log("rrrr", res);

    const message = await moimModel.getMessage(meetings_id, res.insertId);

    const decryptMes = decryptMessage(message.contents);

    pubClient.publish(
      "meetingRoom",
      JSON.stringify({
        room: `${region_code}:${meetings_id}`,
        event: "receiveMessage",
        data: { ...message, contents: decryptMes },
      })
    );
  }

  const [meetingList, meetingData, myList] = await Promise.all([moimModel.getMeetingList({ region_code }), moimModel.getMeetingData({ meetings_id }), moimModel.getMyList({ users_id })]);

  pubClient.publish(
    "region_code",
    JSON.stringify({
      room: region_code,
      event: "list",
      data: meetingList,
    })
  );

  pubClient.publish(
    "meetingRoom",
    JSON.stringify({
      room: meetingRoom,
      event: "meetingData",
      data: meetingData,
    })
  );

  pubClient.publish(
    "message",
    JSON.stringify({
      room: socket.id,
      event: "myList",
      data: myList,
    })
  );

  setExAsync(`meetingList:${region_code}`, 3600, JSON.stringify(meetingList));
  setExAsync(`meetingData:${region_code}:${meetings_id}`, 3600 * 24 * 15, JSON.stringify(meetingData));
  setExAsync(`myList:${users_id}`, 3600, JSON.stringify(myList));
};

const handleDecryptMessages = (data) => {
  console.log("data", data);
  return data.map((v) => {
    if (v.reply_contents) {
      return { ...v, contents: decryptMessage(v.contents), reply_contents: decryptMessage(v.reply_contents) };
    } else {
      return { ...v, contents: decryptMessage(v.contents) };
    }
  });
};

const handleActiveTimeMeeting = async ({ pubClient, getAsync, setExAsync, meetingList, region_code, meetings_id }) => {
  console.log("handleActiveTimeMeeting", region_code, meetings_id, typeof meetings_id);

  let addActiveTimeList;

  if (meetings_id) {
    const meetingsUserData = await getAsync(`meetingsUsers:${region_code}:${meetings_id}`);

    addActiveTimeList = meetingList.map((v) => {
      if (v.id == meetings_id) {
        const max_active_time_item = JSON.parse(meetingsUserData)
          ?.map((v) => v.last_active_time)
          .sort((a, b) => new Date(b) - new Date(a))[0];

        return { ...v, last_active_time: max_active_time_item };
      } else {
        return v;
      }
    });
  } else {
    addActiveTimeList = await Promise.all(
      meetingList.map(async (v) => {
        const { id } = v;
        console.log("id", id);
        const meetingsUserData = await getAsync(`meetingsUsers:${region_code}:${id}`);

        const max_active_time_item = JSON.parse(meetingsUserData)
          ?.map((v) => v.last_active_time)
          .sort((a, b) => new Date(b) - new Date(a))[0];

        return { ...v, last_active_time: max_active_time_item };
      })
    );
  }

  await setExAsync(`meetingList:${region_code}`, 3600, JSON.stringify(addActiveTimeList));

  await pubClient.publish(
    "region_code",
    JSON.stringify({
      room: region_code,
      event: "list",
      data: addActiveTimeList,
    })
  );
};

// module.exports = { handleEnterMeeting, getMyList };
