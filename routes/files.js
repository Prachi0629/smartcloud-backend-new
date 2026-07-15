const express = require('express');

const router = express.Router();
const supabase = require('../supabase');
const multer = require('multer');

const pool = require('../db');

const auth = require('../middleware/authMiddleware');

const STORAGE_BUCKET = 'smartcloud-files';

/* ===================================== */
/* MULTER STORAGE */
/* ===================================== */

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB cap - adjust to your plan
  }
});

function isValidId(id) {
  return /^\d+$/.test(String(id));
}

/* Given a full Supabase public URL, recover the storage object path
   (e.g. "12/mybucket/169...-file.png") so we can delete it later. */
function extractStoragePath(publicUrl) {
  const marker = `/storage/v1/object/public/${STORAGE_BUCKET}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(publicUrl.slice(idx + marker.length));
}

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
      const userId = req.user.id;

      if (!isValidId(bucketId)) {
        return res.status(400).json({
          message: 'Invalid bucket id'
        });
      }

      if (!file) {
        return res.status(400).json({
          message: 'No file uploaded'
        });
      }

      // Confirm this bucket belongs to the logged-in user
      const bucketResult = await pool.query(
        `
        SELECT bucket_name
        FROM buckets
        WHERE id = $1
        AND user_id = $2
        AND is_deleted = false
        `,
        [bucketId, userId]
      );

      if (bucketResult.rows.length === 0) {
        return res.status(404).json({
          message: 'Bucket not found'
        });
      }

      const bucketName = bucketResult.rows[0].bucket_name;

      const uniqueName = Date.now() + '-' + file.originalname;

      // Storage path: <userId>/<bucketName>/<uniqueName>
      const filePath = `${userId}/${bucketName}/${uniqueName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(filePath, file.buffer, {
          contentType: file.mimetype
        });

      if (uploadError) {
        throw uploadError;
      }

      // Use the SAME path we just uploaded to when building the public URL
      const { data: publicUrlData } = supabase.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(filePath);

      const publicUrl = publicUrlData.publicUrl;

      const result = await pool.query(
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
          $1, $2, $3, $4, $5, false
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

      console.error('UPLOAD ERROR:', err);

      res.status(500).json({
        message: 'Upload failed'
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

      const { id } = req.params;
      const userId = req.user.id;

      if (!isValidId(id)) {
        return res.status(400).json({ message: 'Invalid file id' });
      }

      const result = await pool.query(
        `
        UPDATE files f
        SET is_deleted = true
        FROM buckets b
        WHERE f.id = $1
        AND f.bucket_id = b.id
        AND b.user_id = $2
        RETURNING f.id
        `,
        [id, userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          message: 'File not found'
        });
      }

      res.json({
        success: true,
        message: 'File moved to trash'
      });

    } catch (err) {

      console.log(err);

      res.status(500).json({
        message: 'Trash failed'
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

      const userId = req.user.id;

      const result = await pool.query(
        `
        SELECT f.*
        FROM files f
        JOIN buckets b ON f.bucket_id = b.id
        WHERE f.is_deleted = true
        AND b.user_id = $1
        ORDER BY f.id DESC
        `,
        [userId]
      );

      res.json(result.rows);

    } catch (err) {

      console.log(err);

      res.status(500).json({
        message: 'Error loading trash files'
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

      const { id } = req.params;
      const userId = req.user.id;

      if (!isValidId(id)) {
        return res.status(400).json({ message: 'Invalid file id' });
      }

      const result = await pool.query(
        `
        UPDATE files f
        SET is_deleted = false
        FROM buckets b
        WHERE f.id = $1
        AND f.bucket_id = b.id
        AND b.user_id = $2
        RETURNING f.id
        `,
        [id, userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          message: 'File not found'
        });
      }

      res.json({
        success: true,
        message: 'File restored'
      });

    } catch (err) {

      console.log(err);

      res.status(500).json({
        message: 'Restore failed'
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

      const { id } = req.params;
      const userId = req.user.id;

      if (!isValidId(id)) {
        return res.status(400).json({ message: 'Invalid file id' });
      }

      // Confirm ownership and grab the file_path so we can clean up storage
      const fileResult = await pool.query(
        `
        SELECT f.id, f.file_path
        FROM files f
        JOIN buckets b ON f.bucket_id = b.id
        WHERE f.id = $1
        AND b.user_id = $2
        `,
        [id, userId]
      );

      if (fileResult.rows.length === 0) {
        return res.status(404).json({
          message: 'File not found'
        });
      }

      const storagePath = extractStoragePath(
        fileResult.rows[0].file_path
      );

      // Remove the object from Supabase Storage first.
      // Don't let a storage failure block the DB cleanup below -
      // log it and continue, since a dangling DB row is worse.
      if (storagePath) {
        const { error: removeError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .remove([storagePath]);

        if (removeError) {
          console.error('STORAGE DELETE ERROR:', removeError);
        }
      }

      await pool.query(
        `
        DELETE FROM files
        WHERE id = $1
        `,
        [id]
      );

      res.json({
        success: true,
        message: 'File permanently deleted'
      });

    } catch (err) {

      console.log(err);

      res.status(500).json({
        message: 'Delete failed'
      });

    }

  }
);

module.exports = router;
