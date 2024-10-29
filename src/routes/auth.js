const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const router = express.Router();
const users = {}; // 간단한 메모리 저장소

// 사용자 등록
router.post('/register', async (req, res) => {

  console.log(req.body)

  const { username, password } = req.body;
  
  // 비밀번호 해싱
  const hashedPassword = await bcrypt.hash(password, 10);
  users[username] = { password: hashedPassword };

  res.status(201).send('User registered');
});

// 사용자 로그인
router.post('/login', async (req, res) => {
  console.log('로그인')
  const { username, password } = req.body;
  const user = users[username];

  if (user && (await bcrypt.compare(password, user.password))) {
    // JWT 발급
    const token = jwt.sign({ username }, process.env.JWT_SECRET || 'secret', { expiresIn: '1h' });
    return res.json({ token });
  }

  res.status(401).send('Invalid credentials');
});

// Example route to demonstrate JWT
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  
  // For demonstration purposes, we use a static username and password
  if (username === 'user' && password === 'password') {
    const token = jwt.sign({ username }, 'your-secret-key', { expiresIn: '1h' });
    res.json({ token });
  } else {
    res.status(401).send('Invalid credentials');
  }
});

// JWT 보호 라우트 예시
router.get('/protected', (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, process.env.JWT_SECRET || 'secret', (err, user) => {
    if (err) return res.sendStatus(403);
    res.json({ message: 'Protected data', user });
  });
});

module.exports = router;
