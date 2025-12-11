const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');
require('dotenv').config();

const router = express.Router();

router.post('/signup', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) return res.status(400).json({ error: 'All fields required' });

  try {
    const [exists] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (exists.length) return res.status(400).json({ error: 'Email already registered' });

    const hashed = await bcrypt.hash(password, 10);
    const [result] = await db.query('INSERT INTO users (username, email, password) VALUES (?, ?, ?)', [username, email, hashed]);
    const userId = result.insertId;

    // create wallet row
    await db.query('INSERT INTO wallets (user_id, balance) VALUES (?, 0)', [userId]);

    res.status(201).json({ message: 'User created', userId });
  } catch (err) {
    console.error('signup err', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/signin', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email & password required' });

  try {
    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (!rows.length) return res.status(400).json({ error: 'User not found' });

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ userId: user.id, email: user.email }, process.env.JWT_SECRET || 'secretkey', { expiresIn: '12h' });
    res.json({ message: 'Signin successful', token, userId: user.id });
  } catch (err) {
    console.error('signin err', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
