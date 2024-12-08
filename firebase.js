const admin = require("firebase-admin");

const serviceAccount = require("./moimmoim-c4e23-firebase-adminsdk-azqfp-daec505858.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const messaging = admin.messaging();

const oneSendMessage = ({ title = "moimmoim", subtitle, body, token }) => {
  console.log("token", token);
  const message = {
    notification: {
      title: title,
      body: body,
    },
    apns: {
      payload: {
        aps: {
          alert: {
            subtitle: subtitle,
          },
        },
      },
    },
    token: token, // 사용자의 FCM 토큰
  };

  messaging
    .send(message)
    .then((response) => {
      console.log("Successfully sent message:", response);
    })
    .catch((error) => {
      console.log("Error sending message:", error);
    });
};

const topicSendMeesage = ({ title = "moimmoim", subtitle, body, topic, sender_id }) => {
  console.log("topictopictopic", topic);
  const condition = `'room_${topic}' in topics && !('sender_${sender_id}' in topics)`;

  // console.log("condition", condition);

  // FCM 메시지 보내기
  const message = {
    // topic: `room_${topic}`, // 채팅방 토픽
    notification: {
      title: title,
      body: body,
    },
    condition,
    apns: {
      payload: {
        aps: {
          alert: {
            subtitle: subtitle,
          },
        },
      },
    },
  };

  messaging
    .send(message)
    .then((response) => {
      console.log("Successfully sent message:asd", response);
    })
    .catch((error) => {
      console.log("Error sending message:", error);
    });
};

// const sendMessage = async ({ title, subtitle, body, fcmTokens, senderId }) => {
//   // senderId에 해당하는 FCM 토큰 제거
//   const tokensToSend = fcmTokens.filter((token) => token.userId !== senderId);

//   // 메시지 생성
//   const message = {
//     notification: {
//       title: title,
//       body: body,
//     },
//     apns: {
//       payload: {
//         aps: {
//           alert: {
//             subtitle: subtitle,
//           },
//         },
//       },
//     },
//     android: {
//       notification: {
//         sound: "default", // 무음 해제
//       },
//     },
//   };

//   // 각 토큰으로 메시지 전송
//   for (const token of tokensToSend) {
//     try {
//       await admin.messaging().sendToDevice(token.fcmToken, message);
//       console.log(`Message sent to token: ${token.fcmToken}`);
//     } catch (error) {
//       console.error(`Error sending to token: ${token.fcmToken}`, error);
//     }
//   }
// };

const handleSubscribeTopic = ({ topic, token }) => {
  console.log("handleSubscribeTopic", topic, token);

  messaging
    .subscribeToTopic(token, `room_${topic}`)
    .then((response) => {
      console.log("rr");
      console.log("Successfully subscribed to topic:", response);
    })
    .catch((error) => {
      console.log("Error subscribing to topic:", error);
    });
};

const handleUnSubscribeTopic = ({ topic, token }) => {
  console.log("handleUnSubscribeTopic", topic, token);
  messaging
    .unsubscribeFromTopic(token, String(topic))
    .then((response) => {
      console.log("handleUnSubscribeTopic1", response);

      console.log("Successfully unsubscribed from topic:", response);
    })
    .catch((error) => {
      console.log("Error unsubscribing from topic:", error);
    });
};

// 사용자를 고유 토픽에 가입시키는 함수
const subscribeUserToTopic = async ({ fcmToken, users_id }) => {
  console.log("fcmfcm", fcmToken, users_id);

  const topic = `sender_${users_id}`; // 사용자 고유 토픽
  try {
    await admin.messaging().subscribeToTopic(fcmToken, topic);
    console.log(`User subscribed to topic: ${topic}`);
  } catch (error) {
    console.error(`Error subscribing user to topic ${topic}:`, error);
  }
};

module.exports = { oneSendMessage, topicSendMeesage, handleSubscribeTopic, handleUnSubscribeTopic, subscribeUserToTopic };
