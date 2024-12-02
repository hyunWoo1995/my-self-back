const CryptoJS = require("crypto-js");
const secretKey = process.env.CRYPTO_SECRET_KEY;

// 암호화
function encryptMessage(message) {
  const ciphertext = CryptoJS.AES.encrypt(message, secretKey).toString();
  return ciphertext;
}

// 복호화
function decryptMessage(ciphertext) {
  const bytes = CryptoJS.AES.decrypt(ciphertext, secretKey);
  const originalText = bytes.toString(CryptoJS.enc.Utf8);
  return originalText;
}

// 테스트 실행
const message = "안녕하세요, 비밀 메시지입니다!";
const encryptedMessage = encryptMessage(message);

const decryptedMessage = decryptMessage("U2FsdGVkX1/sK8UhIowDWrOsXp1JZrHYESSPwtAkMjk=");

module.exports = { encryptMessage, decryptMessage };
