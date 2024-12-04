// 태그 추가

const handleOnesignalTags = async ({ onesignal_id, meetings_id, users_id }) => {
  const res = axios.get(`https://api.onesignal.com/apps/${process.env.ONESIGNAL_APP_ID}/users/by/onesignal_id/${onesignal_id}`);

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

module.exports = { handleOnesignalTags };
