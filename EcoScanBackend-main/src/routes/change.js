const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const pool = require('../db');

// GET /api/change/:region_id
router.get('/:region_id', authenticate, async (req, res) => {
  try {
    const { region_id } = req.params;
    const { period1_start, period1_end, period2_start, period2_end } = req.query;

    if (!period1_start || !period1_end || !period2_start || !period2_end) {
      return res.status(400).json({ error: 'Missing required query parameters' });
    }

    // Get NDVI for period 1
    const period1Result = await pool.query(`
      SELECT AVG(ndvi_mean) as ndvi_mean
      FROM ndvi_records
      WHERE region_id = $1
      AND period_start >= $2 AND period_end <= $3
    `, [region_id, period1_start, period1_end]);

    // Get NDVI for period 2
    const period2Result = await pool.query(`
      SELECT AVG(ndvi_mean) as ndvi_mean
      FROM ndvi_records
      WHERE region_id = $1
      AND period_start >= $2 AND period_end <= $3
    `, [region_id, period2_start, period2_end]);

    const ndvi_old = parseFloat(period1Result.rows[0]?.ndvi_mean);
    const ndvi_new = parseFloat(period2Result.rows[0]?.ndvi_mean);

    if (!ndvi_old || !ndvi_new) {
      return res.status(404).json({
        error: {
          code: 'NDVI_NOT_FOUND',
          message: 'No NDVI data available for this region and date range'
        }
      });
    }

    const absolute_change = ndvi_new - ndvi_old;
    const percent_change = ((absolute_change / ndvi_old) * 100).toFixed(1);

    // Categorize change
    let category;
    if (absolute_change < -0.20) category = 'severe_decrease';
    else if (absolute_change < -0.05) category = 'moderate_decrease';
    else if (absolute_change <= 0.05) category = 'no_change';
    else if (absolute_change <= 0.20) category = 'moderate_increase';
    else category = 'severe_increase';

    const alert_triggered = category === 'severe_decrease';

    res.json({
      ndvi_old: parseFloat(ndvi_old.toFixed(3)),
      ndvi_new: parseFloat(ndvi_new.toFixed(3)),
      absolute_change: parseFloat(absolute_change.toFixed(3)),
      percent_change: parseFloat(percent_change),
      category,
      alert_triggered,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;