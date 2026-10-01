const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const pool = require('../db');

// GET /api/ndvi/trend — national NDVI trend for dashboard chart
router.get('/trend', authenticate, async (req, res) => {
  try {
    const { months = 7 } = req.query;

    const result = await pool.query(`
      SELECT 
        period_start,
        AVG(ndvi_mean) as avg_ndvi
      FROM ndvi_records
      GROUP BY period_start
      ORDER BY period_start DESC
      LIMIT $1
    `, [parseInt(months)]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: 'NDVI_NOT_FOUND',
          message: 'No NDVI trend data available'
        }
      });
    }

    // Reverse to get chronological order
    const rows = result.rows.reverse();

    const labels = rows.map(r => {
      const date = new Date(r.period_start);
      return date.toLocaleString('default', { month: 'short' });
    });

    const values = rows.map(r => parseFloat(parseFloat(r.avg_ndvi).toFixed(3)));

    res.json({ labels, values });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/ndvi/:region_id
router.get('/:region_id', authenticate, async (req, res) => {
  try {
    const { region_id } = req.params;
    const { start_date, end_date, composite_type } = req.query;

    let query = `
      SELECT ndvi_mean, period_start, period_end, composite_type
      FROM ndvi_records
      WHERE region_id = $1
    `;
    const params = [region_id];

    if (start_date) {
      query += ` AND period_start >= $${params.length + 1}`;
      params.push(start_date);
    }
    if (end_date) {
      query += ` AND period_end <= $${params.length + 1}`;
      params.push(end_date);
    }
    if (composite_type) {
      query += ` AND composite_type = $${params.length + 1}`;
      params.push(composite_type);
    }

    query += ' ORDER BY period_start ASC';

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: 'NDVI_NOT_FOUND',
          message: 'No NDVI data available for this region and date range'
        }
      });
    }

    // Format response as labels + values for the chart
    const labels = result.rows.map(r => {
      const date = new Date(r.period_start);
      return date.toLocaleString('default', { month: 'short' });
    });
    const values = result.rows.map(r => parseFloat(r.ndvi_mean.toFixed(3)));

    res.json({ labels, values, ndvi_records: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/ndvi/:region_id/latest
router.get('/:region_id/latest', authenticate, async (req, res) => {
  try {
    const { region_id } = req.params;
    const result = await pool.query(
      `SELECT * FROM ndvi_records 
       WHERE region_id = $1 
       ORDER BY period_start DESC LIMIT 1`,
      [region_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: 'NDVI_NOT_FOUND',
          message: 'No NDVI data available for this region and date range'
        }
      });
    }

    res.json({ ndvi: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;