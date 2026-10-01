const cron = require('node-cron');
const { execSync } = require('child_process');
const path = require('path');

const GEE_PATH = path.join(__dirname, '../../EcoScanGEE');

// Run NDVI processor on the 1st of every month at midnight
cron.schedule('0 0 1 * *', () => {
  console.log('Running monthly NDVI processor...');
  try {
    execSync(`cd ${GEE_PATH} && source .venv/bin/activate && python3 ndvi_processor.py`, {
      stdio: 'inherit',
      shell: '/bin/zsh'
    });
    console.log('NDVI processor completed');

    // Run alert service after processor
    execSync(`cd ${GEE_PATH} && source .venv/bin/activate && python3 alert_service.py`, {
      stdio: 'inherit',
      shell: '/bin/zsh'
    });
    console.log('Alert service completed');
  } catch (err) {
    console.error('Scheduler error:', err.message);
  }
});

console.log('Scheduler started — NDVI processor runs on 1st of every month');

module.exports = cron;