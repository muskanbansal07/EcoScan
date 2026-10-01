import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

THRESHOLDS = {
    'Critical': -0.20,
    'High': -0.10,
    'Medium': -0.05,
}

def get_db_connection():
    conn_string = os.getenv('DATABASE_URL')
    if conn_string:
        return psycopg2.connect(conn_string)
    return psycopg2.connect(
        host=os.getenv('DB_HOST', 'localhost'),
        port=os.getenv('DB_PORT', '5432'),
        database=os.getenv('DB_NAME', 'ecoscan'),
        user=os.getenv('DB_USER', 'ecoscan_user'),
        password=os.getenv('DB_PASSWORD', 'ecoscan123')
    )

def get_severity(ndvi_change):
    if ndvi_change <= THRESHOLDS['Critical']:
        return 'Critical'
    elif ndvi_change <= THRESHOLDS['High']:
        return 'High'
    elif ndvi_change <= THRESHOLDS['Medium']:
        return 'Medium'
    return None

def run_alert_service():
    conn = get_db_connection()
    cursor = conn.cursor()

    print("Running alert service...")

    # Get all regions
    cursor.execute("SELECT region_id, name FROM regions")
    regions = cursor.fetchall()

    alerts_created = 0

    for region_id, name in regions:
        cursor.execute("""
            SELECT record_id, ndvi_mean, period_start, period_end
            FROM ndvi_records
            WHERE region_id = %s
            ORDER BY period_start DESC
            LIMIT 2
        """, (region_id,))

        records = cursor.fetchall()

        if len(records) < 2:
            print(f"  Skipping {name} — not enough historical data yet")
            continue

        current = records[0]
        previous = records[1]

        current_id, current_ndvi, current_start, current_end = current
        prev_id, prev_ndvi, prev_start, prev_end = previous

        ndvi_change = current_ndvi - prev_ndvi
        percent_change = (ndvi_change / prev_ndvi) * 100 if prev_ndvi else 0

        severity = get_severity(ndvi_change)

        if severity:
            cursor.execute("""
                INSERT INTO change_records
                (region_id, period1_start, period1_end, period2_start, period2_end,
                 ndvi_change, percent_change)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING change_id
            """, (
                region_id,
                prev_start, prev_end,
                current_start, current_end,
                ndvi_change, percent_change
            ))

            change_id = cursor.fetchone()[0]

            cursor.execute("""
                SELECT alert_id FROM alerts
                WHERE region_id = %s AND status = 'active'
                AND created_at > NOW() - INTERVAL '7 days'
            """, (region_id,))

            existing = cursor.fetchone()

            if not existing:
                message = f"NDVI decreased by {abs(ndvi_change):.3f} ({abs(percent_change):.1f}%) in {name}"
                cursor.execute("""
                    INSERT INTO alerts (region_id, change_id, severity, status, message)
                    VALUES (%s, %s, %s, 'active', %s)
                """, (region_id, change_id, severity, message))

                alerts_created += 1
                print(f"  🚨 {severity} alert created for {name}: NDVI change = {ndvi_change:.3f}")
            else:
                print(f"  ⏭ {name}: alert already exists")
        else:
            print(f"  ✅ {name}: no significant change (NDVI change = {ndvi_change:.3f})")

    conn.commit()
    cursor.close()
    conn.close()
    print(f"\nDone! {alerts_created} new alerts created.")

if __name__ == '__main__':
    run_alert_service()