const moimModel = require("../../model/moimModel");
const { findByUser } = require("../../model/userModel");
const { decryptMessage, encryptMessage } = require("../../utils/aes");
const onesignal = require("./onesignal");

let typingUsers = [];
const typingTimers = {}; // To store timers for each user

// 모임 입장
exports.handleEnterMeeting = async ({ socket, pubClient, getAsync, setExAsync, io }, { region_code, meetings_id, users_id, type, onesignal_id }) => {
  try {
    const meetingRoom = `${region_code}:${meetings_id}`;
    socket.join(meetingRoom);
    socket.data.userId = users_id;

    // 현재 room에 접속한 사용자 목록 요청
    const usersInRoom = this.getUsersInRoom(io, meetingRoom);

    await pubClient.publish(
      "meetingRoom",
      JSON.stringify({
        room: meetingRoom,
        event: "usersInRoom",
        data: usersInRoom,
      })
    );

    const [myListCache, messagesCache, meetingListCache, meetingDataCache, meetingsUsersCache] = await Promise.all([
      getAsync(`myList:${users_id}`),
      getAsync(`messages:${region_code}:${meetings_id}`),
      getAsync(`meetingList:${region_code}`),
      getAsync(`meetingData:${region_code}:${meetings_id}`),
      getAsync(`meetingsUsers:${region_code}:${meetings_id}`),
    ]);

    let meetingsUsers;

    const meetingData = meetingDataCache ? JSON.parse(meetingDataCache) : await moimModel.getMeetingData({ meetings_id });
    if (!meetingDataCache) {
      await setExAsync(`meetingData:${region_code}:${meetings_id}`, 3600 * 24 * 15, JSON.stringify(meetingData));
    }

    await pubClient.publish(
      "meetingRoom",
      JSON.stringify({
        room: meetingRoom,
        event: "meetingData",
        data: meetingData,
      })
    );

    const myList = myListCache ? JSON.parse(myListCache) : await moimModel.getMyList({ users_id });

    if (!myListCache) {
      await setExAsync(`myList:${users_id}`, 3600, JSON.stringify(myList));
    }

    const target = myList.find((v) => v.meetings_id === meetings_id && v.users_id === users_id);

    const isApplied = target && Object.keys(target).length > 0;
    const isMember = target?.status === 1;

    if (isMember) {
      await moimModel.modifyActiveTime({ meetings_id, users_id });

      meetingsUsers = await moimModel.getMeetingsUsers({ meetings_id });

      if (onesignal_id) {
        onesignal.handleOnesignalTags({ onesignal_id, meetings_id, users_id });
      }

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

    console.log("messages", messages);

    const decryptMessages = handleDecryptMessages(messages.lists);

    if (messages.lists.length > 0) {
      await setExAsync(`messages:${region_code}:${meetings_id}`, 3600, JSON.stringify(messages));
    }

    await pubClient.publish(
      "meetingRoom",
      JSON.stringify({
        room: meetingRoom,
        event: "messages",
        data: { list: decryptMessages, total: messages.total },
      })
    );

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
  console.log("dddd", data);

  const myListCache = await getAsync(`myList:${data.id}`);

  const myList = myListCache ? JSON.parse(myListCache) : await moimModel.getMyList({ users_id: data.id });

  if (!myListCache) {
    await setExAsync(`myList:${data.id}`, 3600, JSON.stringify(myList));
  }

  await pubClient.publish(
    "meetingRoom",
    JSON.stringify({
      room: socket.id,
      event: "myList",
      data: myList,
    })
  );
};

// 지역 입장
exports.handleJoinRegion = async ({ socket, pubClient, getAsync, setExAsync }, { user, region_code }) => {
  socket.join(region_code);

  const meetingListcache = await getAsync(`meetingList:${region_code}`);

  let meetingList = meetingListcache ? JSON.parse(meetingListcache) : await moimModel.getMeetingList({ region_code });

  console.log("meetingListcachemeetingListcache", meetingListcache);

  if (!meetingListcache) {
    // const addActiveTimeList = await Promise.all(
    //   meetingList.map(async (v) => {
    //     const { id } = v;

    //     const meetingsUserData = await getAsync(`meetingsUsers:${region_code}:${id}`);

    //     const max_active_time_item = JSON.parse(meetingsUserData)
    //       ?.map((v) => v.last_active_time)
    //       .sort((a, b) => new Date(b) - new Date(a))[0];

    //     return { ...v, last_active_time: max_active_time_item };
    //   })
    // );

    // console.log("addActiveTimeList", addActiveTimeList);
    // await setExAsync(`meetingList:${region_code}`, 3600, JSON.stringify(addActiveTimeList));
    handleActiveTimeMeeting({ meetingList, getAsync, pubClient, setExAsync, region_code, meetings_id });
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
exports.handleGenerateMeeting = async ({ socket, pubClient, getAsync, setExAsync }, data) => {
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

  // 생성 성공
  if (res.affectedRows > 0) {
    // if (data.onesignal_id) {
    //   onesignal.handleOnesignalTags();
    // }

    await moimModel.enterMeeting({
      users_id: data.users_id,
      meetings_id: res.insertId,
      type: data.type,
      creator: true,
    });

    const [updatemyList, updateMeetingList] = await Promise.all([
      moimModel.getMyList({ users_id: data.users_id }),
      moimModel.getMeetingList({
        region_code: data.region_code,
      }),
    ]);

    console.log("updateMeetingList", updateMeetingList);

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
exports.handleJoinMeeting = async ({ socket, pubClient, getAsync, setExAsync, io }, { region_code, users_id, meetings_id, type, onesignal_id }) => {
  try {
    const enterRes = await moimModel.enterMeeting({ meetings_id, users_id, type });

    if (enterRes.CODE === "EM000") {
      if (onesignal_id) {
        onesignal.handleOnesignalTags({ onesignal_id, meetings_id, users_id });
      }

      const [meetingsUsersCache, userInfo, meetingList, meetingData] = await Promise.all([
        getAsync(`meetingsUsers:${region_code}:${meetings_id}`),
        findByUser(users_id),
        moimModel.getMeetingList({ region_code }),
        moimModel.getMeetingData({ meetings_id }),
      ]);

      const meetingsUsers = meetingsUsersCache ? JSON.parse(meetingsUsersCache) : await moimModel.getMeetingsUsers({ meetings_id });

      moimModel.sendMessage({
        meetings_id,
        contents: encryptMessage(`${userInfo?.nickname}님이 입장했습니다.`),
        users_id,
        users: meetingsUsers.map((v) => v.users_id).join(","),
        admin: 1,
      });

      setExAsync(`meetingList:${region_code}`, 3600, JSON.stringify(meetingList));
      setExAsync(`meetingData:${region_code}:${meetings_id}`, 3600, JSON.stringify(meetingData));
    }

    const myList = await moimModel.getMyList({ users_id });

    setExAsync(`myList:${users_id}`, 3600, JSON.stringify(myList));

    await this.handleEnterMeeting({ socket, pubClient, getAsync, setExAsync, io }, { region_code, meetings_id, users_id, type, onesignal_id });
  } catch (err) {
    console.error("handleJoinMeeting error", err);
  }
};

// 메세지 보내기
exports.handleSendMessage = async ({ socket, pubClient, getAsync, setExAsync, io }, { region_code, meetings_id, contents, users_id }) => {
  const meetingRoom = `${region_code}:${meetings_id}`;

  const meetingsUsers = await getAsync(`meetingsUsers:${meetingRoom}`);

  const res = await moimModel.sendMessage({
    region_code,
    meetings_id,
    contents: encryptMessage(contents),
    users_id,
    users: JSON.parse(meetingsUsers)
      .map((v) => v.users_id)
      .join(","),
  });

  // 전송 성공
  if (res.affectedRows > 0) {
    onesignal.handleOnesignalNotification({ meetings_id, users_id, contents });

    const usersInRoom = this.getUsersInRoom(io, meetingRoom);

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

    const message = await moimModel.getMessage(meetings_id, res.insertId, usersInRoom);

    const decryptMes = decryptMessage(message.contents);

    await pubClient.publish(
      "meetingRoom",
      JSON.stringify({
        room: meetingRoom,
        event: "receiveMessage",
        data: { ...message, contents: decryptMes },
      })
    );

    const meetingListcache = await getAsync(`meetingList:${region_code}`);

    let meetingList = meetingListcache ? JSON.parse(meetingListcache) : await moimModel.getMeetingList({ region_code });
    handleActiveTimeMeeting({ pubClient, getAsync, meetingList, region_code, setExAsync, meetings_id });

    const messages = await moimModel.getMessages({ meetings_id: meetings_id });

    setExAsync(`messages:${region_code}:${meetings_id}`, 3600, JSON.stringify(messages));
  }
};

// 채팅 타이핑
exports.handleChatTyping = async ({ socket, pubClient, getAsync, setExasync }, { region_code, meetings_id, users_id }) => {
  const meetingRoom = `${region_code}:${meetings_id}`;

  const userIndex = typingUsers.findIndex((v) => v.users_id === users_id);

  if (userIndex === -1) {
    typingUsers.push({ users_id });
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

exports.getUsersInRoom = (io, roomId) => {
  const clients = io.sockets.adapter.rooms.get(roomId) || new Set();

  return Array.from(clients).map((socketId) => {
    const socket = io.sockets.sockets.get(socketId);
    return socket?.data.userId || null;
  });
};

const handleDecryptMessages = (data) => {
  console.log("data", data);
  return data.map((v) => ({ ...v, contents: decryptMessage(v.contents) }));
};

const handleActiveTimeMeeting = async ({ pubClient, getAsync, setExAsync, meetingList, region_code, meetings_id }) => {
  const meetingsUserData = await getAsync(`meetingsUsers:${region_code}:${meetings_id}`);

  const addActiveTimeList = meetingList.map((v) => {
    if (v.id === meetings_id) {
      const max_active_time_item = JSON.parse(meetingsUserData)
        ?.map((v) => v.last_active_time)
        .sort((a, b) => new Date(b) - new Date(a))[0];

      return { ...v, last_active_time: max_active_time_item };
    } else {
      return v;
    }
  });

  // return addActiveTimeList;

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
