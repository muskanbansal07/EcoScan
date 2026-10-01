const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const pool = require('../db');

// GET /api/alerts
router.get('/', authenticate, async (req, res) => {
  try {
    const { severity, status = 'active', region_id } = req.query;

    let query = `
      SELECT a.alert_id, a.region_id, r.name as region_name,
             a.severity, a.status, a.message,
             c.ndvi_change, c.percent_change,
             ROUND(ABS(c.ndvi_change) * 100)::int as area_affected,
             a.created_at
      FROM alerts a
      JOIN regions r ON a.region_id = r.region_id
      LEFT JOIN change_records c ON a.change_id = c.change_id
      WHERE a.status = $1
    `;
    const params = [status];

    if (severity) {
      query += ` AND a.severity = $${params.length + 1}`;
      params.push(severity);
    }

    if (region_id) {
      query += ` AND a.region_id = $${params.length + 1}`;
      params.push(region_id);
    }

    query += ` ORDER BY a.created_at DESC`;

    const result = await pool.query(query, params);
    res.json({ alerts: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/alerts/:id
router.patch('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['active', 'acknowledged', 'dismissed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const result = await pool.query(
      `UPDATE alerts SET status = $1, updated_at = NOW() 
       WHERE alert_id = $2 RETURNING *`,
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    res.json({ alert: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;