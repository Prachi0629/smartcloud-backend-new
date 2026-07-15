const express = require('express');

const router = express.Router();

const pool = require('../db');

const auth = require('../middleware/authMiddleware');

/* Small helper: reject anything that isn't a plain integer id */
function isValidId(id) {
  return /^\d+$/.test(String(id));
}

/* ============================= */
/* GET ACTIVE BUCKETS */
/* ============================= */

router.get(
  '/all',
  auth,
  async (req, res) => {

    try {

      const userId = req.user.id;

      const bucketResult = await pool.query(
        `
        SELECT *
        FROM buckets
        WHERE user_id = $1
        AND is_deleted = false
        ORDER BY id DESC
        `,
        [userId]
      );

      const buckets = bucketResult.rows;

      for (let bucket of buckets) {

        const filesResult = await pool.query(
          `
          SELECT *
          FROM files
          WHERE bucket_id = $1
          AND is_deleted = false
          ORDER BY id DESC
          `,
          [bucket.id]
        );

        bucket.files = filesResult.rows;

      }

      res.json(buckets);

    } catch (err) {

      console.log(err);

      res.status(500).json({
        message: 'Error loading buckets'
      });

    }

  }
);

/* ============================= */
/* CREATE BUCKET */
/* ============================= */

router.post(
  '/create',
  auth,
  async (req, res) => {

    try {

      let { bucket_name } = req.body;

      if (!bucket_name || typeof bucket_name !== 'string') {
        return res.status(400).json({
          message: 'Bucket name required'
        });
      }

      /* CLEAN TEXT */
      bucket_name = bucket_name.trim();

      if (!bucket_name) {
        return res.status(400).json({
          message: 'Bucket name required'
        });
      }

      const userId = req.user.id;

      /* CHECK DUPLICATE */
      const existing = await pool.query(
        `
        SELECT id
        FROM buckets
        WHERE user_id = $1
        AND LOWER(TRIM(bucket_name)) = LOWER(TRIM($2))
        AND is_deleted = false
        `,
        [userId, bucket_name]
      );

      if (existing.rows.length > 0) {
        return res.status(400).json({
          message: 'Bucket already exists'
        });
      }

      /* INSERT */
      const result = await pool.query(
        `
        INSERT INTO buckets (user_id, bucket_name, is_deleted)
        VALUES ($1, $2, false)
        RETURNING *
        `,
        [userId, bucket_name]
      );

      res.json(result.rows[0]);

    } catch (err) {

      console.log(err);

      res.status(500).json({
        message: 'Bucket creation failed'
      });

    }

  }
);

/* ============================= */
/* MOVE BUCKET TO TRASH */
/* ============================= */

router.delete(
  '/delete/:id',
  auth,
  async (req, res) => {

    try {

      const { id } = req.params;
      const userId = req.user.id;

      if (!isValidId(id)) {
        return res.status(400).json({ message: 'Invalid bucket id' });
      }

      const result = await pool.query(
        `
        UPDATE buckets
        SET is_deleted = true
        WHERE id = $1
        AND user_id = $2
        RETURNING id
        `,
        [id, userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          message: 'Bucket not found'
        });
      }

      res.json({ success: true });

    } catch (err) {

      console.log(err);

      res.status(500).json({
        message: 'Delete failed'
      });

    }

  }
);

/* ============================= */
/* GET TRASH BUCKETS */
/* ============================= */

router.get(
  '/trash/all',
  auth,
  async (req, res) => {

    try {

      const userId = req.user.id;

      const result = await pool.query(
        `
        SELECT *
        FROM buckets
        WHERE user_id = $1
        AND is_deleted = true
        ORDER BY id DESC
        `,
        [userId]
      );

      res.json(result.rows);

    } catch (err) {

      console.log(err);

      res.status(500).json({
        message: 'Error loading trash'
      });

    }

  }
);

/* ============================= */
/* RESTORE BUCKET */
/* ============================= */

router.put(
  '/restore/:id',
  auth,
  async (req, res) => {

    try {

      const { id } = req.params;
      const userId = req.user.id;

      if (!isValidId(id)) {
        return res.status(400).json({ message: 'Invalid bucket id' });
      }

      const bucketResult = await pool.query(
        `
        UPDATE buckets
        SET is_deleted = false
        WHERE id = $1
        AND user_id = $2
        RETURNING id
        `,
        [id, userId]
      );

      if (bucketResult.rows.length === 0) {
        return res.status(404).json({
          message: 'Bucket not found'
        });
      }

      await pool.query(
        `
        UPDATE files
        SET is_deleted = false
        WHERE bucket_id = $1
        `,
        [id]
      );

      res.json({ success: true });

    } catch (err) {

      console.log(err);

      res.status(500).json({
        message: 'Restore failed'
      });

    }

  }
);

/* ============================= */
/* DELETE BUCKET PERMANENTLY */
/* ============================= */

router.delete(
  '/permanent/:id',
  auth,
  async (req, res) => {

    try {

      const { id } = req.params;
      const userId = req.user.id;

      if (!isValidId(id)) {
        return res.status(400).json({ message: 'Invalid bucket id' });
      }

      /* Confirm ownership before touching anything */
      const ownedBucket = await pool.query(
        `
        SELECT id
        FROM buckets
        WHERE id = $1
        AND user_id = $2
        `,
        [id, userId]
      );

      if (ownedBucket.rows.length === 0) {
        return res.status(404).json({
          message: 'Bucket not found'
        });
      }

      await pool.query(
        `
        DELETE FROM files
        WHERE bucket_id = $1
        `,
        [id]
      );

      await pool.query(
        `
        DELETE FROM buckets
        WHERE id = $1
        `,
        [id]
      );

      res.json({ success: true });

    } catch (err) {

      console.log(err);

      res.status(500).json({
        message: 'Permanent delete failed'
      });

    }

  }
);

module.exports = router;
