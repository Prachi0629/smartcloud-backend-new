const express = require('express');

const router = express.Router();
const supabase = require('../supabase');
const multer = require('multer');

const pool = require('../db');

const auth =
  require('../middleware/authMiddleware');

/* ===================================== */
/* MULTER STORAGE */
/* ===================================== */

const upload = multer({
  storage: multer.memoryStorage()
});

/* ===================================== */
/* UPLOAD FILE */
/* ===================================== */

router.post(
  '/upload/:bucketId',
  auth,
  upload.single('file'),
  async (req, res) => {
    try {

      const bucketId = req.params.bucketId;

      const file = req.file;

      if (!file) {
        return res.status(400).json({
          message: 'No file uploaded'
        });
      }

      const uniqueName =
        Date.now() +
        '-' +
        file.originalname;

      const { data, error } =
        await supabase.storage
          .from('smartcloud-files')
          .upload(
            uniqueName,
            file.buffer,
            {
              contentType:
                file.mimetype
            }
          );

      if (error) {
        throw error;
      }

      const {
        data: publicUrlData
      } = supabase.storage
        .from('smartcloud-files')
        .getPublicUrl(uniqueName);

      const publicUrl =
        publicUrlData.publicUrl;

      const result =
        await pool.query(
          `
          INSERT INTO files
          (
            bucket_id,
            file_name,
            file_path,
            file_size,
            file_type,
            is_deleted
          )
          VALUES
          (
            $1,
            $2,
            $3,
            $4,
            $5,
            false
          )
          RETURNING *
          `,
          [
            bucketId,
            file.originalname,
            publicUrl,
            file.size,
            file.mimetype
          ]
        );

      res.json(result.rows[0]);

    } catch (err) {

      console.error(
        'UPLOAD ERROR:',
        err
      );

      res.status(500).json({
        error: err.message
      });

    }
  }
);

/* ===================================== */
/* MOVE FILE TO TRASH */
/* ===================================== */

router.put(
  '/trash/:id',
  auth,
  async (req, res) => {

    try {

      await pool.query(
        `
        UPDATE files
        SET is_deleted = true
        WHERE id = $1
        `,
        [req.params.id]
      );

      res.json({
        success: true,
        message:
          'File moved to trash'
      });

    } catch (err) {

      console.log(err);

      res.status(500).json({
        message:
          'Trash failed'
      });

    }

  }
);

/* ===================================== */
/* GET TRASH FILES */
/* ===================================== */

router.get(
  '/trash/all',
  auth,
  async (req, res) => {

    try {

      const result =
        await pool.query(`
          SELECT *
          FROM files
          WHERE is_deleted = true
          ORDER BY id DESC
        `);

      res.json(result.rows);

    } catch (err) {

      console.log(err);

      res.status(500).json({
        message:
          'Error loading trash files'
      });

    }

  }
);

/* ===================================== */
/* RESTORE FILE */
/* ===================================== */

router.put(
  '/restore/:id',
  auth,
  async (req, res) => {

    try {

      await pool.query(
        `
        UPDATE files
        SET is_deleted = false
        WHERE id = $1
        `,
        [req.params.id]
      );

      res.json({
        success: true,
        message:
          'File restored'
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

/* ===================================== */
/* DELETE FILE PERMANENTLY */
/* ===================================== */

router.delete(
  '/permanent/:id',
  auth,
  async (req, res) => {

    try {

      await pool.query(
        `
        DELETE FROM files
        WHERE id = $1
        `,
        [req.params.id]
      );

      res.json({
        success: true,
        message:
          'File permanently deleted'
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

module.exports = router;
