const nodemailer = require("nodemailer");
const dotenv = require("dotenv");
dotenv.config(); // .env가져오기

// 이메일 전송을 위한 transporter 설정
const transporter = nodemailer.createTransport({
  service: "gmail", // 사용할 이메일 서비스
  auth: {
    user: process.env.MAIL_USER, // 보내는 이메일 주소
    pass: process.env.MAIL_PASS, // 이메일 비밀번호 (또는 앱 비밀번호)
  },
});

const mailSand = async ({
  from = process.env.MAIL_USER,
  to,
  subject,
  text,
  html,
}) => {
  try {
    // 메일 옵션 설정
    const mailOptions = {
      from, // 보내는 사람
      to,
      subject,
      text,
      html,
    };

    const { response } = await transporter.sendMail(mailOptions);
    console.log("response", response);
    return response;
  } catch (err) {
    throw new Error(err);
  }
};

module.exports = mailSand;
