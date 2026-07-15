const express = require('express');

const router = express.Router();

const pool = require('../db');

const auth = require('../middleware/authMiddleware');

router.get('/generate', auth, async (req, res) => {

  try {

    const userId = req.user.id;

    // Scoped to the logged-in user's own files via their buckets.
    // (Assumes files.bucket_id -> buckets.id -> buckets.user_id.
    //  If your `files` table already has a user_id column, you can
    //  simplify this to `WHERE user_id = $1 AND is_deleted = false`.)
    const result = await pool.query(
      `
      SELECT SUM(f.file_size) AS total
      FROM files f
      JOIN buckets b ON f.bucket_id = b.id
      WHERE b.user_id = $1
      AND f.is_deleted = false
      AND b.is_deleted = false
      `,
      [userId]
    );

    const totalBytes = Number(result.rows[0].total) || 0;

    const totalGB = totalBytes / (1024 * 1024 * 1024);

    const pricePerGB = 5;

    const totalAmount = totalGB * pricePerGB;

    res.json({

      totalStorageGB: totalGB.toFixed(2),

      totalAmount: totalAmount.toFixed(2),

      pricePerGB

    });

  } catch (err) {

    console.log(err);

    res.status(500).json({
      message: 'Error generating billing info'
    });

  }

});

module.exports = router;
