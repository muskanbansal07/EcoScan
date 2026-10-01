const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const pool = require('../db');
const { sendAlertNotification } = require('../services/notificationService');

// POST /api/notifications/register — save FCM token for a user
router.post('/register', authenticate, async (req, res) => {
  try {
    const { firebase_uid } = req.user;
    const { fcm_token, region_id } = req.body;

    const userResult = await pool.query(
      'SELECT user_id FROM users WHERE firebase_uid = $1',
      [firebase_uid]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user_id = userResult.rows[0].user_id;

    await pool.query(`
      INSERT INTO alert_subscriptions (user_id, region_id, fcm_token)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id, region_id)
      DO UPDATE SET fcm_token = $3
    `, [user_id, region_id, fcm_token]);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/notifications/send-alert — trigger notifications for an alert
router.post('/send-alert', authenticate, async (req, res) => {
  try {
    const { alert_id } = req.body;

    const result = await pool.query(`
      SELECT a.*, r.name as region_name
      FROM alerts a
      JOIN regions r ON a.region_id = r.region_id
      WHERE a.alert_id = $1
    `, [alert_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    await sendAlertNotification(pool, result.rows[0]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;