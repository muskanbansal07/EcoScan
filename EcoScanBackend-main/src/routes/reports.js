const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const pool = require('../db');

// GET /api/reports — list reports for the logged in user
router.get('/', authenticate, async (req, res) => {
  try {
    const { firebase_uid } = req.user;

    const result = await pool.query(
      `SELECT r.report_id, r.title, r.type, r.format,
              r.period_start, r.period_end, r.status,
              r.file_url, r.size_mb, r.created_at,
              reg.name as region_name
       FROM reports r
       LEFT JOIN regions reg ON r.region_id = reg.region_id
       JOIN users u ON r.user_id = u.user_id
       WHERE u.firebase_uid = $1
       ORDER BY r.created_at DESC`,
      [firebase_uid]
    );

    res.json({ reports: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/reports — request a new report
router.post('/', authenticate, async (req, res) => {
  try {
    const { firebase_uid } = req.user;
    const { region_id, title, type, format, period_start, period_end } = req.body;

    // Get user from DB
    const userResult = await pool.query(
      'SELECT user_id FROM users WHERE firebase_uid = $1',
      [firebase_uid]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user_id = userResult.rows[0].user_id;

    const result = await pool.query(
      `INSERT INTO reports (user_id, region_id, title, type, format, period_start, period_end, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'generating')
       RETURNING *`,
      [user_id, region_id, title, type, format, period_start, period_end]
    );

    res.status(201).json({ report: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
