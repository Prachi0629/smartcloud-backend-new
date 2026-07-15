const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db');

const router = express.Router();

/* ================= REGISTER ================= */

router.post('/register', async (req, res) => {

  try {

    let { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message: 'Name, email and password are required'
      });
    }

    name = String(name).trim();
    email = String(email).trim().toLowerCase();

    if (password.length < 6) {
      return res.status(400).json({
        message: 'Password must be at least 6 characters'
      });
    }

    // CHECK EXISTING USER
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email=$1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        message: 'User already exists'
      });
    }

    // HASH PASSWORD
    const hashedPassword = await bcrypt.hash(password, 10);

    // INSERT USER
    const newUser = await pool.query(
      `INSERT INTO users(name, email, password)
       VALUES ($1, $2, $3)
       RETURNING id, name, email`,
      [name, email, hashedPassword]
    );

    res.json({
      message: 'Registration Successful',
      user: newUser.rows[0]
    });

  } catch (err) {
    console.error('REGISTER ERROR:', err);
    // Never leak err.message / err.stack to the client in production
    res.status(500).json({
      message: 'Registration failed. Please try again.'
    });
  }

});

/* ================= LOGIN ================= */

router.post('/login', async (req, res) => {

  try {

    let { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: 'Email and password are required'
      });
    }

    email = String(email).trim().toLowerCase();

    // FIND USER
    const userResult = await pool.query(
      'SELECT * FROM users WHERE email=$1',
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(400).json({
        message: 'Invalid email or password'
      });
    }

    const user = userResult.rows[0];

    // CHECK PASSWORD
    const validPassword = await bcrypt.compare(
      password,
      user.password
    );

    if (!validPassword) {
      // Same message as "user not found" so attackers can't tell which
      // part was wrong (prevents email enumeration)
      return res.status(400).json({
        message: 'Invalid email or password'
      });
    }

    // CREATE TOKEN
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email
      },
      process.env.JWT_SECRET,
      {
        expiresIn: '1d'
      }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    });

  } catch (err) {
    console.error('LOGIN ERROR:', err);
    res.status(500).json({
      message: 'Server Error'
    });
  }

});

module.exports = router;
