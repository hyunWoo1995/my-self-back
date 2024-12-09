const addressModel = require("../model/addressModel");

exports.getAddress = async (req, res) => {
  const { keyword } = req.query;
  console.log("keyword", keyword);

  const result = await addressModel.getAddress({ keyword });

  console.log("result", result);

  res.status(200).json(result);
};
