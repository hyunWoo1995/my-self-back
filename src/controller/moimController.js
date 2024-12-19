const moimModel = require("../model/moimModel");
const { decryptMessage } = require("../utils/aes");
const redisService = require("../service/chat/redis");
const { io } = require("../../index");
const { uploadFile, ensureContainerExists, downloadSasUrl, getBlobMetadata } = require("../utils/azureUtil");
const sharp = require("sharp");
const moment = require("moment");

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
  try {
    const { meetings_id, length } = req.body;
    const { userId } = req;

    const result = await moimModel.getMoreMessage({ meetings_id, length });

    const meetingsUsers = await moimModel.getMeetingsUsers({ meetings_id });

    const userJoinDate = new Date(meetingsUsers.find((v) => v.users_id === userId).created_at);

    const decryptMessages = result.map((v) => ({ ...v, contents: decryptMessage(v.contents) }));

    res.status(200).json({
      DATA: {
        list: decryptMessages.filter((v) => moment(v.created_at).isSameOrAfter(userJoinDate)),
        end: Math.ceil(decryptMessages.filter((v) => moment(v.created_at).isSameOrAfter(userJoinDate)).length / 20) < 2,
      },
    });
  } catch (err) {
    console.error("getMoreMsg error", err);
  }
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

exports.setMoimLogo = async (req, res) => {
  console.log(req.file, req.body.meetings_id);
  const {
    file,
    body: { meetings_id },
  } = req;

  // 애저를 이용한 업로드
  // const containerName = `moimlogo-${meetings_id}`;

  // await ensureContainerExists(containerName);

  // try {
  //   // 이미지 최적화
  //   const optimizedBuffer = await sharp(req.file.buffer)
  //     .resize(500, 500, { fit: "inside" }) // 최대 500x500 크기로 조정
  //     .jpeg({ quality: 80 }) // JPEG 형식, 80% 품질
  //     .toBuffer();

  //   console.log("optimizedBuffer", optimizedBuffer);

  //   // blob meta 데이터 조회

  //   // 파일 업로드
  //   const uploadRes = await uploadFile(containerName, optimizedBuffer, req.file.originalname);
  //   const blobMetaData = await getBlobMetadata(containerName, uploadRes.blobName);

  //   console.log("blobMetaData", blobMetaData.clientRequestId);

  //   // const sasUrl = downloadSasUrl(containerName, uploadRes.blobName);

  //   // DB 업데이트
  //   const editRes = await moimModel.editMeeting({ meetings_id, logo: uploadRes.url });

  //   console.log("editRes", editRes);

  //   if (editRes.affectedRows > 0) {
  //     res.sendSuccess("성공");
  //   } else {
  //     res.sendError(500, "실패");
  //   }
  // } catch (error) {
  //   console.error(error);
  //   res.sendError("이미지 업로드 실패");
  // }

  // 서버 자체 업로드

  console.log("ffff", file, file?.filename);
  try {
    const editRes = await moimModel.editMeeting({ meetings_id, logo: file ? `assets/images/moim/${file.filename}` : "" });

    res.sendSuccess("모임 수정 성공", { CODE: "EM000" });
  } catch (error) {
    console.error(error);
    res.sendError("모임 수정 실패");
  }
};

exports.getMyMoim = async (req, res) => {
  try {
    const { users_id } = req.params;

    const listRes = await moimModel.getMyList({ users_id });

    console.log("listRes", listRes);

    res.sendSuccess("", listRes);
  } catch (err) {
    res.sendError(500, "조회 실패");
  }
};

// 초대 목록
exports.getInviteList = async (req, res) => {
  try {
    const { users_id, meetings_id } = req.params;

    const listRes = await moimModel.getInviteList({ users_id, meetings_id });

    res.sendSuccess("모임 조회", listRes);
  } catch (err) {
    res.sendError("초대 목록 조회 실패");
  }
};
