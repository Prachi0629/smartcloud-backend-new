const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db');

const router = express.Router();

/* ================= REGISTER ================= */

router.post('/register', async (req, res) => {

  try {

    const { name, email, password } = req.body;

    console.log(req.body);

    // CHECK EXISTING USER
    const existingUser = await pool.query(
      'SELECT * FROM users WHERE email=$1',
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
      `INSERT INTO users(name,email,password)
       VALUES($1,$2,$3)
       RETURNING *`,
      [name, email, hashedPassword]
    );

    res.json({
      message: 'Registration Successful',
      user: newUser.rows[0]
    });

  } catch (err) {

    console.log('REGISTER ERROR:', err);

    res.status(500).json({
      message: 'Server Error'
    });

  }

});

/* ================= LOGIN ================= */

router.post('/login', async (req, res) => {

  try {

    const { email, password } = req.body;

    // FIND USER
    const userResult = await pool.query(
      'SELECT * FROM users WHERE email=$1',
      [email]
    );

    if (userResult.rows.length === 0) {

      return res.status(400).json({
        message: 'User not found'
      });

    }

    const user = userResult.rows[0];

    // CHECK PASSWORD
    const validPassword = await bcrypt.compare(
      password,
      user.password
    );

    if (!validPassword) {

      return res.status(400).json({
        message: 'Invalid Password'
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

    console.log('LOGIN ERROR:', err);

    res.status(500).json({
      message: 'Server Error'
    });

  }

});

module.exports = router;