const pool = require('../index');

const createTables = async () => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // 1. Regions
    await client.query(`
      CREATE TABLE IF NOT EXISTS regions (
        region_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        level VARCHAR(50) NOT NULL CHECK (level IN ('national', 'state', 'district')),
        parent_id UUID REFERENCES regions(region_id),
        boundary GEOMETRY(MULTIPOLYGON, 4326),
        area_km2 FLOAT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // 2. NDVI Records
    await client.query(`
      CREATE TABLE IF NOT EXISTS ndvi_records (
        record_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        region_id UUID REFERENCES regions(region_id),
        period_start DATE NOT NULL,
        period_end DATE NOT NULL,
        ndvi_mean FLOAT,
        ndvi_min FLOAT,
        ndvi_max FLOAT,
        ndvi_std FLOAT,
        composite_type VARCHAR(20) CHECK (composite_type IN ('daily', 'weekly', 'monthly', 'yearly')),
        cloud_coverage FLOAT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // 3. Change Records
    await client.query(`
      CREATE TABLE IF NOT EXISTS change_records (
        change_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        region_id UUID REFERENCES regions(region_id),
        period1_start DATE,
        period1_end DATE,
        period2_start DATE,
        period2_end DATE,
        ndvi_change FLOAT,
        percent_change FLOAT,
        area_affected_km2 FLOAT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // 4. Alerts
    await client.query(`
      CREATE TABLE IF NOT EXISTS alerts (
        alert_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        region_id UUID REFERENCES regions(region_id),
        change_id UUID REFERENCES change_records(change_id),
        severity VARCHAR(20) CHECK (severity IN ('Critical', 'High', 'Medium', 'Informational')),
        status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'dismissed')),
        message TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // 5. Users
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        firebase_uid VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        display_name VARCHAR(255),
        role VARCHAR(20) DEFAULT 'user',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // 6. Alert Subscriptions
    await client.query(`
      CREATE TABLE IF NOT EXISTS alert_subscriptions (
        subscription_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(user_id),
        region_id UUID REFERENCES regions(region_id),
        severity_critical BOOLEAN DEFAULT true,
        severity_high BOOLEAN DEFAULT true,
        severity_medium BOOLEAN DEFAULT false,
        severity_informational BOOLEAN DEFAULT false,
        fcm_token TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // 7. Reports
    await client.query(`
      CREATE TABLE IF NOT EXISTS reports (
        report_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(user_id),
        region_id UUID REFERENCES regions(region_id),
        title VARCHAR(255),
        type VARCHAR(50),
        format VARCHAR(10) CHECK (format IN ('PDF', 'XLS')),
        period_start DATE,
        period_end DATE,
        status VARCHAR(20) DEFAULT 'generating' CHECK (status IN ('generating', 'ready', 'failed')),
        file_url TEXT,
        size_mb FLOAT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // 8. Audit Logs
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(user_id),
        action VARCHAR(255),
        entity_type VARCHAR(50),
        entity_id UUID,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query('COMMIT');
    console.log('✅ All tables created successfully');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err);
  } finally {
    client.release();
    pool.end();
  }
};

createTables();
