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

const topicSendMeesage = ({ title = "moimmoim", subtitle, body, topic }) => {
  console.log("topic", topic);
  // FCM 메시지 보내기
  const message = {
    topic: String(topic), // 채팅방 토픽
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

const handleSubscribeTopic = ({ topic, token }) => {
  console.log("handleUnSubscribeTopic", topic, token);

  messaging
    .subscribeToTopic(token, String(topic))
    .then((response) => {
      console.log("rr");
      console.log("Successfully subscribed to topic:", response);
    })
    .catch((error) => {
      console.log("Error subscribing to topic:", error);
    });

  messaging
    .getToken(token)
    .then((response) => {
      console.log("FCM Token:", response.token);
      console.log("Subscribed Topics:", response.topics);
    })
    .catch((error) => {
      console.log("Error fetching FCM token:", error);
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

module.exports = { oneSendMessage, topicSendMeesage, handleSubscribeTopic, handleUnSubscribeTopic };
