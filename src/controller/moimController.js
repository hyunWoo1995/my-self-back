const moimModel = require("../model/moimModel");
const { decryptMessage } = require("../utils/aes");
const redisService = require("../service/chat/redis");
const { io } = require("../../index");

exports.getCategories = async (req, res) => {
  try {
    const result = await moimModel.getCategories();
    console.log("rrr", result);

    return res.sendSuccess("요청 성공", { category1: result.filter((v) => !v.parent_id), category2: result.filter((v) => v.parent_id) });
  } catch (err) {
    return res.sendError(500, "요청 실패.");
  }
};

exports.getMoreMessage = async (req, res) => {
  const { meetings_id, length } = req.body;

  const result = await moimModel.getMoreMessage({ meetings_id, length });

  const decryptMessages = result.map((v) => ({ ...v, contents: decryptMessage(v.contents) }));

  res.status(200).json({ DATA: { list: decryptMessages } });
};

exports.handleLikeMeeting = async (req, res) => {
  const { meetings_id, users_id } = req.body;

  const result = await moimModel.handleLikeMeeting({ users_id, meetings_id });

  if (result.affectedRows > 0) {
    console.log("io", io);
    // const { pubClient, getAsync, setExAsync } = await redisService.initRedis(io);

    // const meetingListcache = await getAsync(`meetingList:${region_code}`);

    // let meetingList = meetingListcache ? JSON.parse(meetingListcache) : await moimModel.getMeetingList({ region_code });

    // await pubClient.publish(
    //   "region_code",
    //   JSON.stringify({
    //     room: region_code,
    //     event: "list",
    //     data: meetingList,
    //   })
    // );

    res.sendSuccess("성공");
  } else {
    res.sendError("실패");
  }
};
