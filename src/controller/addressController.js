const addressModel = require("../model/addressModel");
const userModel = require("../model/userModel");

exports.getAddress = async (req, res) => {
  const { keyword } = req.query;
  console.log("keyword", keyword);

  const result = await addressModel.getAddress({ keyword });

  console.log("result", result);

  res.status(200).json(result);
};

// 유저 주소 저장
exports.createAddress = async (req, res) => {
  try {
    const { address_name, region_1depth_name, region_2depth_name, region_3depth_name } = req.body;

    const findAddressRes = await addressModel.findAddress({ address: address_name });
    let address_code;

    if (!findAddressRes) {
      // 가장 높은 address_code 가져오기
      const highestCode = await userModel.getHighestAddressCode();
      const newCodeNumber = highestCode ? parseInt(highestCode.replace("RC", ""), 10) + 1 : 1; // 기본값 1
      address_code = `RC${String(newCodeNumber).padStart(3, "0")}`; // "RC001" 형식 유지

      // 주소 생성
      const createAddressRes = await addressModel.createAddress({
        address: address_name,
        address_code,
        region_1depth_name,
        region_2depth_name,
        region_3depth_name,
      });

      await userModel.createUserAddress({
        user_id: req.userId,
        address_id: createAddressRes,
        prev_address_id: req.body.prev_address_id,
      });
      res.sendSuccess("주소 생성");
    } else {
      await userModel.createUserAddress({
        user_id: req.userId,
        address_id: findAddressRes.id,
        prev_address_id: req.body.prev_address_id,
      });
      res.sendSuccess("주소 생성");
    }
  } catch (err) {
    console.error("create address error", err);
    res.sendError("주소 생성 에러");
  }
};
