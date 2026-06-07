const express = require('express');

const router = express.Router();

const pool = require('../db');

router.get('/generate', async (req, res) => {

  try {

    const result = await pool.query(

      `SELECT
       SUM(file_size) AS total
       FROM files
       WHERE is_deleted = FALSE`

    );

    const totalBytes =
      Number(result.rows[0].total) || 0;

    const totalGB =
      totalBytes / (1024 * 1024 * 1024);

    const pricePerGB = 5;

    const totalAmount =
      totalGB * pricePerGB;

    res.json({

      totalStorageGB:
        totalGB.toFixed(2),

      totalAmount:
        totalAmount.toFixed(2),

      pricePerGB

    });

  }

  catch (err) {

    console.log(err);

  }

});

module.exports = router;