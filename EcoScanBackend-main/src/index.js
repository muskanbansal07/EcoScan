const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();
require('./scheduler');

const app = express();

app.use(cors());
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ status: 'EcoScan API is running' });
});

app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/regions', require('./routes/regions'));
app.use('/api/ndvi', require('./routes/ndvi'));
app.use('/api/alerts', require('./routes/alerts'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/change', require('./routes/change'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
