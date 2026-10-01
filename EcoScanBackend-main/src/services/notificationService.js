const admin = require('firebase-admin');

const sendNotification = async (fcmToken, title, body, data = {}) => {
  try {
    const message = {
      token: fcmToken,
      notification: { title, body },
      data,
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'ecoscan_alerts',
        },
      },
    };

    const response = await admin.messaging().send(message);
    console.log(`Notification sent: ${response}`);
    return response;
  } catch (err) {
    console.error(`Failed to send notification:`, err.message);
    return null;
  }
};

const sendAlertNotification = async (pool, alert) => {
  try {
    const severityColumn = `severity_${alert.severity.toLowerCase()}`;
    
    const result = await pool.query(`
      SELECT s.fcm_token, u.display_name
      FROM alert_subscriptions s
      JOIN users u ON s.user_id = u.user_id
      WHERE s.region_id = $1
      AND s.fcm_token IS NOT NULL
    `, [alert.region_id]);

    if (result.rows.length === 0) {
      console.log('No subscribed users for this alert');
      return;
    }

    const title = `${alert.severity} Alert - ${alert.region_name}`;
    const body = alert.message;
    const data = {
      alert_id: String(alert.alert_id),
      region_id: String(alert.region_id),
      severity: alert.severity,
    };

    for (const { fcm_token, display_name } of result.rows) {
      await sendNotification(fcm_token, title, body, data);
      console.log(`  Notified ${display_name}`);
    }

  } catch (err) {
    console.error('Error sending alert notifications:', err);
  }
};

module.exports = { sendNotification, sendAlertNotification };