const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const pool = require('../db');

const ZONE_MAP = {
  'Kerala': 'Southern', 'Tamil Nadu': 'Southern', 'Karnataka': 'Southern',
  'Maharashtra': 'Western', 'Gujarat': 'Western', 'Rajasthan': 'Western',
  'Madhya Pradesh': 'Central',
  'West Bengal': 'Eastern', 'Assam': 'Eastern',
  'Uttarakhand': 'Northern',
};

// GET /api/regions
router.get('/', authenticate, async (req, res) => {
  try {
    const { level } = req.query;

    let query = `
      SELECT r.region_id, r.name, r.level, r.parent_id, r.area_km2,
        n1.ndvi_mean as ndvi_mean,
        (n1.ndvi_mean - n2.ndvi_mean) as ndvi_change
      FROM regions r
      LEFT JOIN LATERAL (
        SELECT ndvi_mean FROM ndvi_records
        WHERE region_id = r.region_id
        ORDER BY period_start DESC LIMIT 1
      ) n1 ON true
      LEFT JOIN LATERAL (
        SELECT ndvi_mean FROM ndvi_records
        WHERE region_id = r.region_id
        ORDER BY period_start DESC LIMIT 1 OFFSET 1
      ) n2 ON true
    `;

    const params = [];
    if (level) {
      query += ' WHERE r.level = $1';
      params.push(level);
    }

    query += ' ORDER BY r.name';
    const result = await pool.query(query, params);

    const regions = result.rows.map(r => ({
      ...r,
      zone: ZONE_MAP[r.name] || 'Central',
      ndvi_mean: r.ndvi_mean ? parseFloat(r.ndvi_mean.toFixed(3)) : null,
      ndvi_change: r.ndvi_change ? parseFloat(r.ndvi_change.toFixed(3)) : null,
    }));

    res.json({ regions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/regions/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT region_id, name, level, parent_id, area_km2 FROM regions WHERE region_id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Region not found' });
    }

    const region = result.rows[0];
    res.json({ region: { ...region, zone: ZONE_MAP[region.name] || 'Central' } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;