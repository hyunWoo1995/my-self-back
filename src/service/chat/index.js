const moimModel = require("../../model/moimModel");
const onesignal = require("./onesignal");

const handleEnterMeeting = async ({ socket, pubClient, getAsync, setExAsync }, { region_code, meetings_id, users_id, type, onesignal_id }) => {
  try {
    const meetingRoom = `${region_code}-${meetings_id}`;
    socket.join(meetingRoom);
    socket.data.userId = users_id;

    // 현재 room에 접속한 사용자 목록 요청
    const usersInRoom = getUsersInRoom(meetingRoom);

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

    // let meetingList, meetingData, messages, meetingsUsers;

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

      const meetingsUsers = await moimModel.getMeetingsUsers({ meetings_id });

      if (onesignal_id) {
        onesignal.handleOnesignalTags({ onesignal_id, meetings_id, users_id });
      }
    }
  } catch (err) {
    console.error("handleEnterMeeting error", err);
  }
};

const getUsersInRoom = (io, roomId) => {
  const clients = io.sockets.adapter.rooms.get(roomId) || new Set();

  return Array.from(clients).map((socketId) => {
    const socket = io.sockets.sockets.get(socketId);
    return socket?.data.userId || null;
  });
};
