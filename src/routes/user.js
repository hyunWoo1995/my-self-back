const express = require('express');
const router = express.Router();

// 사용자 목록을 반환하는 라우트
router.get('/', (req, res) => {
  res.json({ message: 'User list' });
});

// 사용자 등록을 위한 라우트
router.post('/', (req, res) => {
  const { username } = req.body;
  // 사용자 등록 로직 (예: 데이터베이스에 추가)
  res.status(201).json({ message: `User ${username} registered` });
});

// 사용자 정보 조회를 위한 라우트
router.get('/:id', (req, res) => {
  const userId = req.params.id;
  // 사용자 정보 조회 로직
  res.json({ message: `User details for ${userId}` });
});

module.exports = router;
