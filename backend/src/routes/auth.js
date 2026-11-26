const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../db');
const { sign, requireAuth } = require('../middleware/auth');
const { wrap, httpError } = require('../lib/util');

const router = express.Router();
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post(
  '/register',
  wrap(async (req, res) => {
    const name = String(req.body.name || '').trim().slice(0, 80);
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const role = req.body.role === 'instructor' ? 'instructor' : 'student';

    if (!name) throw httpError(400, 'Enter your name');
    if (!EMAIL.test(email)) throw httpError(400, 'Enter a valid email address');
    if (password.length < 8) throw httpError(400, 'Use a password with at least 8 characters');

    let user;
    try {
      const result = await query(
        'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role',
        [name, email, await bcrypt.hash(password, 10), role]
      );
      user = result.rows[0];
    } catch (err) {
      if (err.code === '23505') throw httpError(409, 'An account with this email already exists');
      throw err;
    }
    res.status(201).json({ token: sign(user), user });
  })
);

router.post(
  '/login',
  wrap(async (req, res) => {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const { rows } = await query(
      'SELECT id, name, email, role, password_hash FROM users WHERE email = $1',
      [email]
    );
    const row = rows[0];
    if (!row || !(await bcrypt.compare(password, row.password_hash))) {
      throw httpError(401, 'Incorrect email or password');
    }
    const { password_hash, ...user } = row;
    res.json({ token: sign(user), user });
  })
);

router.get(
  '/me',
  requireAuth,
  wrap(async (req, res) => {
    const { rows } = await query('SELECT id, name, email, role FROM users WHERE id = $1', [req.user.id]);
    if (!rows[0]) throw httpError(401, 'Account not found. Sign in again');
    res.json({ user: rows[0] });
  })
);

module.exports = router;
