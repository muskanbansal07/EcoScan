import ee
import psycopg2
import os
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

ee.Initialize(project='ecoscanmobile')

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

def compute_ndvi(geometry, start_date, end_date):
    s2 = (ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
          .filterBounds(geometry)
          .filterDate(start_date, end_date)
          .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20)))

    def add_ndvi(image):
        ndvi = image.normalizedDifference(['B8', 'B4']).rename('NDVI')
        return image.addBands(ndvi)

    collection_with_ndvi = s2.map(add_ndvi)
    composite = collection_with_ndvi.select('NDVI').median()

    stats = composite.reduceRegion(
        reducer=ee.Reducer.mean()
            .combine(ee.Reducer.min(), sharedInputs=True)
            .combine(ee.Reducer.max(), sharedInputs=True)
            .combine(ee.Reducer.stdDev(), sharedInputs=True),
        geometry=geometry,
        scale=1000,
        maxPixels=1e9
    )

    return stats.getInfo()

def process_bulk():
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT region_id, name, ST_AsGeoJSON(boundary) FROM regions WHERE boundary IS NOT NULL")
    regions = cursor.fetchall()

    # Define all months to process
    periods = [
        ('2025-10-01', '2025-11-01'),
        ('2025-11-01', '2025-12-01'),
        ('2025-12-01', '2026-01-01'),
        ('2026-01-01', '2026-02-01'),
        ('2026-02-01', '2026-03-02'),
    ]

    for start_date, end_date in periods:
        print(f"\nProcessing period: {start_date} to {end_date}")

        for region_id, name, boundary_geojson in regions:
            try:
                geometry = ee.Geometry(eval(boundary_geojson))
                stats = compute_ndvi(geometry, start_date, end_date)

                ndvi_mean = stats.get('NDVI_mean')
                ndvi_min = stats.get('NDVI_min')
                ndvi_max = stats.get('NDVI_max')
                ndvi_std = stats.get('NDVI_stdDev')

                if ndvi_mean is None:
                    print(f"  No data for {name}")
                    continue

                # Check if record already exists
                cursor.execute("""
                    SELECT record_id FROM ndvi_records
                    WHERE region_id = %s AND period_start = %s
                """, (region_id, start_date))

                if cursor.fetchone():
                    print(f"  ⏭ {name}: already exists")
                    continue

                cursor.execute("""
                    INSERT INTO ndvi_records
                    (region_id, period_start, period_end, ndvi_mean, ndvi_min, ndvi_max, ndvi_std, composite_type)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    region_id, start_date, end_date,
                    ndvi_mean, ndvi_min, ndvi_max, ndvi_std,
                    'monthly'
                ))

                conn.commit()
                print(f"  ✅ {name}: NDVI mean = {ndvi_mean:.3f}")

            except Exception as e:
                print(f"  ❌ Error processing {name}: {e}")
                conn.rollback()

    cursor.close()
    conn.close()
    print("\nDone processing all historical periods!")

if __name__ == '__main__':
    process_bulk()
