const { promisify } = require("util"); // Import promisify
const { createClient } = require("redis");
const moimModel = require("./src/model/moimModel");
const { createAdapter } = require("@socket.io/redis-adapter");
const { isAfterDate } = require("./src/utils/date");
const { findByUser } = require("./src/model/userModel");
const { encryptMessage, decryptMessage } = require("./src/utils/aes");
const { default: axios } = require("axios");
const socketService = require("./src/service/chat/redis");

let typingUsers = [];
const typingTimers = {}; // To store timers for each user

// socket.js
module.exports = async (io) => {
  const { pubClient, getAsync, setExAsync } = await socketService.initRedis(io);

  io.on("connection", (socket) => {
    socket.emit("message", socket.ird);

    const enterMeeting = async ({ region_code, meetings_id, users_id, type, onesignal_id }) => {
      console.log("samkmdas", region_code);
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

        let meetingList, meetingData, messages, meetingsUsers;

        // Meeting data check
        if (meetingDataCache) {
          meetingData = JSON.parse(meetingDataCache);
        } else {
          meetingData = await moimModel.getMeetingData({ meetings_id });

          await pubClient.setEx(`meetingData:${region_code}:${meetings_id}`, 3600 * 24 * 15, JSON.stringify(meetingData));
        }

        // io.to(meetingRoom).emit("meetingData", meetingData);

        await pubClient.publish(
          "meetingRoom",
          JSON.stringify({
            room: meetingRoom,
            event: "meetingData",
            data: meetingData,
          })
        );

        let myList;
        if (myListCache) {
          myList = JSON.parse(myListCache);
        } else {
          myList = await moimModel.getMyList({ users_id: users_id });
          pubClient.setEx(`myList:${users_id}`, 3600, JSON.stringify(myList));
        }

        const target = myList.find((v) => v.meetings_id === meetings_id && v.users_id === users_id);

        const isApplied = target && Object.keys(target).length > 0;
        const isMember = target?.status === 1;

        if (isMember) {
          const row = await moimModel.modifyActiveTime({ meetings_id, users_id });

          meetingsUsers = await moimModel.getMeetingsUsers({ meetings_id });

          console.log("onesignal_idonesignal_id,", onesignal_id);

          if (onesignal_id) {
            axios.get(`https://api.onesignal.com/apps/${process.env.ONESIGNAL_APP_ID}/users/by/onesignal_id/${onesignal_id}`).then((res1) => {
              console.log("onesignal res", res1.data.properties.tags, typeof res1.data.properties.tags);

              if (res1.data.properties.tags) {
                const meetings_ids = [...res1.data.properties.tags.meetings_id.split(","), meetings_id].map((v) => String(v)).filter((v, i, arr) => arr.indexOf(v) === i);

                console.log("meetings_idsmeetings_ids", meetings_ids);
                axios.patch(`https://api.onesignal.com/apps/${process.env.ONESIGNAL_APP_ID}/users/by/onesignal_id/${onesignal_id}`, {
                  properties: {
                    tags: {
                      ...res1.data.properties.tags,
                      meetings_id: meetings_ids.join(",").replaceAll(" ", ""),
                      user_id: users_id,
                    },
                  },
                });
              } else {
                axios.patch(`https://api.onesignal.com/apps/${process.env.ONESIGNAL_APP_ID}/users/by/onesignal_id/${onesignal_id}`, {
                  properties: {
                    tags: {
                      meetings_id: meetings_id,
                      user_id: users_id,
                    },
                  },
                });
              }
            });
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

        // Meeting list check
        if (meetingListCache) {
          meetingList = JSON.parse(meetingListCache);
        } else {
          meetingList = await moimModel.getMeetingList({ region_code });
          await setExAsync(`meetingList:${region_code}`, 3600, JSON.stringify(meetingList));
        }

        // io.to(region_code).emit("list", meetingList);
        pubClient.publish(
          "region_code",
          JSON.stringify({
            room: region_code,
            event: "list",
            data: meetingList,
          })
        );

        // if (meetingsUsersCache) {
        //   meetingsUsers = JSON.parse(meetingsUsersCache);
        // } else {
        //   meetingsUsers = await moimModel.getMeetingsUsers({ meetings_id });

        //   await setExAsync(`meetingsUsers:${region_code}:${meetings_id}`, 3600, JSON.stringify(meetingsUsers));
        // }

        // Messages check
        // if (messagesCache) {
        //   messages = JSON.parse(messagesCache);
        // } else {
        messages = await moimModel.getMessages({ meetings_id });

        const decryptMessages = messages.lists.map((v) => ({ ...v, contents: decryptMessage(v.contents) }));

        if (messages.lists.length > 0) {
          await setExAsync(`messages:${region_code}:${meetings_id}`, 3600, JSON.stringify(messages));
        }
        pubClient.publish(
          "meetingRoom",
          JSON.stringify({
            room: meetingRoom,
            event: "messages",
            data: { list: decryptMessages, total: messages.total, readId: null },
          })
        );

        pubClient.publish(
          "meetingRoom",
          JSON.stringify({
            room: meetingRoom,
            event: "meetingActive",
            data: meetingsUsers,
          })
        );
      } catch (error) {
        console.error("enterMeeting", err);
      }
    };

    // 나의 모임 목록
    socket.on("userData", async (data) => {
      pubClient.get(`myList:${data.id}`, async (err, result) => {
        let myList;
        if (result) {
          myList = result;
          // io.to(socket.id).emit("myList", JSON.parse(result));
        } else {
          myList = await moimModel.getMyList({ users_id: data.id });
          pubClient.setEx(`myList:${data.id}`, 3600, JSON.stringify(myList));

          // io.to(socket.id).emit("myList", res);
        }

        pubClient.publish(
          "meetingRoom",
          JSON.stringify({
            room: socket.id,
            event: "myList",
            data: JSON.parse(result),
          })
        );
      });
    });

    // 지역 입장 (Join region)
    socket.on("join", async ({ user, region_code }) => {
      console.log("user join", user, region_code);
      socket.join(region_code);

      // Check Redis cache for meeting list
      pubClient.get(`meetingList:${region_code}`, async (err, result) => {
        if (result) {
          console.log("pubClient meetingList res", result);

          const addActiveTimeResult = result.map(async (v) => {
            const { id } = v;

            return { ...v };
          });

          // io.to(region_code).emit("list", JSON.parse(result));
          pubClient.publish(
            "region_code",
            JSON.stringify({
              room: region_code,
              event: "list",
              data: JSON.parse(addActiveTimeResult),
            })
          );
        } else {
          const res = await moimModel.getMeetingList({ region_code: region_code });

          console.log("getMeetingList res", res);

          const addActiveTimeRes = await Promise.all(
            res.map(async (v) => {
              const { id } = v;
              const meetingsUserData = await getAsync(`meetingsUsers:${region_code}:${id}`);

              const max_active_time_item = JSON.parse(meetingsUserData)
                ?.map((v) => v.last_active_time)
                .sort((a, b) => new Date(b) - new Date(a))[0];

              console.log("max_active_time_item", max_active_time_item);

              return { ...v, last_active_time: max_active_time_item };
            })
          );

          console.log("addActiveTimeRes", addActiveTimeRes);

          pubClient.setEx(`meetingList:${region_code}`, 3600, JSON.stringify(addActiveTimeRes)); // Cache for 1 hour

          // io.to(region_code).emit("list", res);

          pubClient.publish(
            "region_code",
            JSON.stringify({
              room: region_code,
              event: "list",
              data: addActiveTimeRes,
            })
          );
        }
      });

      // subClient.subscribe(code);
    });

    // 모임 생성 (Generate a meeting)
    socket.on("generateMeeting", async (data) => {
      console.log("generateMeeting data", data);
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
        // if (data?.onesignal_id) {
        //   axios.get(`https://api.onesignal.com/apps/${process.env.ONESIGNAL_APP_ID}/users/by/onesignal_id/${data.onesignal_id}`).then((res1) => {
        //     console.log("onesignal res", res1.data.properties.tags, typeof res1.data.properties.tags);

        //     if (res1.data.properties.tags) {
        //       const meetings_ids = [...res1.data.properties.tags.meetings_id.split(","), res.insertId].filter((v, i, arr) => arr.indexOf(v) === i);

        //       console.log("meetings_idsmeetings_ids", meetings_ids);
        //       axios.patch(`https://api.onesignal.com/apps/${process.env.ONESIGNAL_APP_ID}/users/by/onesignal_id/${data.onesignal_id}`, {
        //         properties: {
        //           tags: {
        //             ...res1.data.properties.tags,
        //             meetings_id: meetings_ids.join(",").replaceAll(" ", ""),
        //             user_id: data.users_id,
        //           },
        //         },
        //       });
        //     } else {
        //       axios.patch(`https://api.onesignal.com/apps/${process.env.ONESIGNAL_APP_ID}/users/by/onesignal_id/${data.onesignal_id}`, {
        //         properties: {
        //           tags: {
        //             meetings_id: String(res.insertId),
        //             user_id: data.users_id,
        //           },
        //         },
        //       });
        //     }
        //   });
        // }

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

    // room에서 나가기
    socket.on("leaveMeeting", ({ region_code, meetings_id }) => {
      const meetingRoom = `${region_code}-${meetings_id}`;
      socket.leave(meetingRoom);
    });

    // 모임 입장 신청
    socket.on("joinMeeting", async ({ region_code, users_id, meetings_id, type, onesignal_id }) => {
      // if (type === 3) {
      //   await moimModel.enterMeeting({ meetings_id, users_id, type });
      // } else if (type === 4) {
      //   return io.to(region_code).emit("enterRes", { CODE: EM002, DATA: "입장 신청이 완료되었습니다." });
      // }
      try {
        const enterRes = await moimModel.enterMeeting({ meetings_id, users_id, type });

        if (enterRes.CODE === "EM000") {
          if (onesignal_id) {
            axios.get(`https://api.onesignal.com/apps/${process.env.ONESIGNAL_APP_ID}/users/by/onesignal_id/${onesignal_id}`).then((res1) => {
              console.log("onesignal res", res1.data.properties.tags, typeof res1.data.properties.tags);

              if (res1.data.properties.tags) {
                const meetings_ids = [...res1.data.properties.tags.meetings_id.split(","), meetings_id].filter((v, i, arr) => arr.indexOf(v) === i);

                console.log("meetings_idsmeetings_ids", meetings_ids);
                axios.patch(`https://api.onesignal.com/apps/${process.env.ONESIGNAL_APP_ID}/users/by/onesignal_id/${onesignal_id}`, {
                  properties: {
                    tags: {
                      ...res1.data.properties.tags,
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
            });
          }

          let meetingsUsers;
          const meetingsUsersCache = await getAsync(`meetingsUsers:${region_code}:${meetings_id}`);

          if (meetingsUsersCache) {
            meetingsUsers = JSON.parse(meetingsUsersCache);
          } else {
            meetingsUsers = await moimModel.getMeetingsUsers({ meetings_id });
          }

          const userInfo = await findByUser(users_id);

          const res = await moimModel.sendMessage({
            meetings_id,
            contents: encryptMessage(`${userInfo?.nickname}님이 입장했습니다.`),
            users_id,
            users: meetingsUsers.map((v) => v.users_id).join(","),
            admin: 1,
          });
        }

        const meetingList = await moimModel.getMeetingList({ region_code });
        const meetingData = await moimModel.getMeetingData({ meetings_id });
        const res = await moimModel.getMyList({ users_id });

        pubClient.publish(
          "region_code",
          JSON.stringify({
            room: region_code,
            event: "meetingData",
            data: meetingData,
          })
        );

        pubClient.publish(
          "region_code",
          JSON.stringify({
            room: region_code,
            event: "meetingList",
            data: meetingList,
          })
        );

        await setExAsync(`meetingList:${region_code}`, 3600, JSON.stringify(meetingList));
        pubClient.setEx(`meetingData:${region_code}:${meetings_id}`, 3600, JSON.stringify(meetingData));
        pubClient.setEx(`myList:${users_id}`, 3600, JSON.stringify(res));

        await enterMeeting({ meetings_id, users_id, region_code, type });
      } catch (err) {
        console.error("joinMeeting", err);
      }
    });

    // 모임 떠남
    // socket.on("leaveMeeting", async ({ region_code, meetings_id }) => {
    //   socket.leave(`${region_code}-${meetings_id}`);
    // });

    // 메시지 수신 및 전파 (Send message to a meeting room)
    socket.on("sendMessage", async ({ region_code, meetings_id, contents, users_id }) => {
      const meetingRoom = `${region_code}-${meetings_id}`;

      const meetingsUsers = await getAsync(`meetingsUsers:${region_code}:${meetings_id}`);

      const res = await moimModel.sendMessage({
        region_code,
        meetings_id,
        contents: encryptMessage(contents),
        users_id,
        users: JSON.parse(meetingsUsers)
          .map((v) => v.users_id)
          .join(","),
      });

      if (res.affectedRows > 0) {
        axios.post(
          "https://api.onesignal.com/notifications",
          {
            app_id: process.env.ONESIGNAL_APP_ID,
            target_channel: "push",
            headings: { en: "moimmoim", ko: "모임모임" },
            contents: { en: contents, ko: contents },
            filters: [{ field: "tag", key: "meetings_id", relation: "exists", value: meetings_id, field: "tag", key: "user_id", relation: "!=", value: users_id }],
          },
          {
            headers: {
              authorization: `Basic ${process.env.ONESIGNAL_API_KEY}`,
            },
          }
        );
        // moimModel.modifyActiveTime({ meetings_id, users_id });
        // await moimModel.modifyActiveTime({ meetings_id, users_id });

        const usersInRoom = getUsersInRoom(meetingRoom);

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

        // await moimModel.updateRead({ id: res.insertId, meetings_id: data.meetings_id, users_id: data.users_id });

        await pubClient.publish(
          "meetingRoom",
          JSON.stringify({
            room: meetingRoom,
            event: "receiveMessage",
            data: { ...message, contents: decryptMes },
          })
        );

        // io.to(meetingRoom).emit("receiveMessage", message);
        // 현재 room에 접속한 사용자 목록 요청

        const messages = await moimModel.getMessages({ meetings_id: meetings_id });

        const decryptMessages = messages.lists.map((v) => ({ ...v, contents: decryptMessage(v.contents) }));

        setExAsync(`messages:${region_code}:${meetings_id}`, 3600, JSON.stringify(messages));
      }
    });

    socket.on("readMessage", async ({ meetings_id, users_id }) => {
      await moimModel.modifyActiveTime({ meetings_id, users_id });
    });

    socket.on("typing", async ({ region_code, meetings_id, users_id }) => {
      const meetingRoom = `${region_code}-${meetings_id}`;

      // Check if user is already typing
      const userIndex = typingUsers.findIndex((v) => v.users_id === users_id);
      if (userIndex === -1) {
        // Add user if not already typing

        typingUsers.push({ users_id });
      }

      // Clear existing timer for this user
      if (typingTimers[users_id]) {
        clearTimeout(typingTimers[users_id]);
      }

      // Publish updated typing list
      await pubClient.publish(
        "meetingRoom",
        JSON.stringify({
          room: meetingRoom,
          event: "userTyping",
          data: typingUsers,
        })
      );

      // Set a timer to remove the user after 3 seconds
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
    });

    // 클라이언트가 연결 해제 시 처리 (Handle client disconnect)
    socket.on("disconnect", () => {});
  });

  // 특정 room에 접속한 사용자 목록 가져오기
  function getUsersInRoom(roomId) {
    const clients = io.sockets.adapter.rooms.get(roomId) || new Set();

    return Array.from(clients).map((socketId) => {
      const socket = io.sockets.sockets.get(socketId);
      return socket?.data.userId || null;
    });
  }
};

const modifyActiveUser = async (meetings_id, users_id) => {
  await moimModel.modifyActiveTime({ meetings_id, users_id });

  await moimModel.getMeetingsUsers({ meetings_id });

  await setExAsync(`meetingsUsers:${region_code}:${meetings_id}`, 3600, JSON.stringify(meetingsUsers));

  await pubClient.publish(
    "meetingRoom",
    JSON.stringify({
      room: meetingRoom,
      event: "meetingActive",
      data: meetingsUsers,
    })
  );
};
