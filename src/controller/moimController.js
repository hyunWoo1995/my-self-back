const moimModel = require("../model/moimModel");

exports.getCategories = async (req, res) => {
  try {
    const result = await moimModel.getCategories();

    return res.sendSuccess("요청 성공", { category1: result.filter((v) => !v.parent_id), category2: result.filter((v) => v.parent_id) });
  } catch (err) {
    return res.sendError(500, "요청 실패.");
  }
};

exports.getMoreMessage = async (req, res) => {
  const { meetings_id, length } = req.body;

  const result = await moimModel.getMoreMessage({ meetings_id, length });

  res.status(200).json({ DATA: { list: result } });
};
