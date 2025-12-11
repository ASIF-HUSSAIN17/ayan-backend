const jwt = require('jsonwebtoken');
require('dotenv').config();

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1].trim() : null;
  if (!token) return res.status(401).json({ error: 'No token provided' });

  const secret = process.env.JWT_SECRET;
  if (!secret) return res.status(500).json({ error: 'Server misconfiguration' });

  jwt.verify(token, secret, (err, payload) => {
    // console.log(token)
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = payload;
    next();
  });
};

module.exports = { authenticateToken };
