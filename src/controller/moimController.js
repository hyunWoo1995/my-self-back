const moimModel = require("../model/moimModel");

exports.getCategories = async (req, res) => {
  console.log("zxczxc!!!");
  const result = await moimModel.getCategories();
  console.log("res", result);

  // return { category1: rows.filter((v) => !v.parent_id), category2: rows.filter((v) => v.parent_id) };
  res.status(200).json({ DATA: { category1: result.filter((v) => !v.parent_id), category2: result.filter((v) => v.parent_id) } });
};

exports.getMoreMessage = async (req, res) => {
  console.log("getMoreMessage!!!", req.body);
  const { meetings_id, length } = req.body;

  const result = await moimModel.getMoreMessage({ meetings_id, length });

  console.log("getMoreMessage res", result);

  res.status(200).json({ DATA: { list: result } });
};
