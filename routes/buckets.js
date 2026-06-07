const express = require('express');

const router = express.Router();

const pool = require('../db');

const auth =
  require('../middleware/authMiddleware');

/* ============================= */
/* GET ACTIVE BUCKETS */
/* ============================= */

router.get(
  '/all',
  auth,
  async (req, res) => {

    try {

      const bucketResult =
        await pool.query(`
          SELECT *
          FROM buckets
          WHERE is_deleted = false
          ORDER BY id DESC
        `);

      const buckets =
        bucketResult.rows;

      for (let bucket of buckets) {

        const filesResult =
          await pool.query(
            `
            SELECT *
            FROM files
            WHERE bucket_id = $1
            AND is_deleted = false
            ORDER BY id DESC
            `,
            [bucket.id]
          );

        bucket.files =
          filesResult.rows;

      }

      res.json(buckets);

    } catch (err) {

      console.log(err);

      res.status(500).json({
        message:
          'Error loading buckets'
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

      let { bucket_name } =
        req.body;

      /* CLEAN TEXT */

      bucket_name =
        bucket_name.trim();

      if (!bucket_name) {

        return res.status(400).json({
          message:
            'Bucket name required'
        });

      }

      /* CHECK DUPLICATE */

      const existing =
        await pool.query(
          `
          SELECT *
          FROM buckets
          WHERE TRIM(
            LOWER(bucket_name)
          ) =
          TRIM(
            LOWER($1)
          )
          `,
          [bucket_name]
        );

      if (
        existing.rows.length > 0
      ) {

        return res.status(400).json({
          message:
            'Bucket already exists'
        });

      }

      /* INSERT */

      const result =
        await pool.query(
          `
          INSERT INTO buckets
          (
            bucket_name
          )

          VALUES ($1)

          RETURNING *
          `,
          [bucket_name]
        );

      res.json(
        result.rows[0]
      );

    } catch (err) {

      console.log(err);

      res.status(500).json({
        message:
          'Bucket creation failed'
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

      await pool.query(
        `
        UPDATE buckets
        SET is_deleted = true
        WHERE id = $1
        `,
        [req.params.id]
      );

      res.json({
        success: true
      });

    } catch (err) {

      console.log(err);

      res.status(500).json({
        message:
          'Delete failed'
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

      const result =
        await pool.query(`
          SELECT *
          FROM buckets
          WHERE is_deleted = true
          ORDER BY id DESC
        `);

      res.json(result.rows);

    } catch (err) {

      console.log(err);

      res.status(500).json({
        message:
          'Error loading trash'
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

      const id =
        req.params.id;

      await pool.query(
        `
        UPDATE buckets
        SET is_deleted = false
        WHERE id = $1
        `,
        [id]
      );

      await pool.query(
        `
        UPDATE files
        SET is_deleted = false
        WHERE bucket_id = $1
        `,
        [id]
      );

      res.json({
        success: true
      });

    } catch (err) {

      console.log(err);

      res.status(500).json({
        message:
          'Restore failed'
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

      await pool.query(
        `
        DELETE FROM files
        WHERE bucket_id = $1
        `,
        [req.params.id]
      );

      await pool.query(
        `
        DELETE FROM buckets
        WHERE id = $1
        `,
        [req.params.id]
      );

      res.json({
        success: true
      });

    } catch (err) {

      console.log(err);

      res.status(500).json({
        message:
          'Permanent delete failed'
      });

    }

  }
);




module.exports = router;