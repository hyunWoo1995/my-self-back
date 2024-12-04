const messageTemplate = {
  app_id: process.env.ONESIGNAL_APP_ID,
  target_channel: "push",
  headings: { en: "moimmoim", ko: "모임모임" },
};

// 태그 추가
const { default: axios } = require("axios");
const { getMeetingItem } = require("../../model/moimModel");

exports.handleOnesignalTags = async ({ onesignal_id, meetings_id, users_id }) => {
  const res = await axios.get(`https://api.onesignal.com/apps/${process.env.ONESIGNAL_APP_ID}/users/by/onesignal_id/${onesignal_id}`);

  const { tags } = res.data.properties;

  if (tags) {
    const meetings_ids = [...tags.meetings_id.split(","), meetings_id].map((v) => String(v)).filter((v, i, arr) => arr.indexOf(v) === i);

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
          meetings_id: meetings_id,
          user_id: users_id,
        },
      },
    });
  }
};

exports.handleOnesignalNotification = async ({ meetings_id, users_id, contents }) => {
  const meetingData = await getMeetingItem({ meetings_id });

  axios.post(
    "https://api.onesignal.com/notifications",
    {
      ...messageTemplate,
      contents: { en: contents || "", ko: contents || "" },
      subtitle: { en: meetingData.name, ko: meetingData.name },
      filters: [{ field: "tag", key: "meetings_id", relation: "exists", value: meetings_id, field: "tag", key: "user_id", relation: "!=", value: users_id }],
    },
    {
      headers: {
        authorization: `Basic ${process.env.ONESIGNAL_API_KEY}`,
      },
    }
  );
};
