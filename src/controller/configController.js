const configModel = require("../model/configModel");

exports.test = async (req, res) => {
  const result = await configModel.test();

  res.status(200).json({ DATA: result });
};
