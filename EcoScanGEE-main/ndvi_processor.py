import ee
import psycopg2
import os
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv()

# Initialize GEE
ee.Initialize(project='ecoscanmobile')

# Database connection
def get_db_connection():
    return psycopg2.connect(
        host=os.getenv('DB_HOST', 'localhost'),
        port=os.getenv('DB_PORT', '5432'),
        database=os.getenv('DB_NAME', 'ecoscan'),
        user=os.getenv('DB_USER', 'ecoscan_user'),
        password=os.getenv('DB_PASSWORD', 'ecoscan123')
    )

# Compute NDVI for a region and time period
def compute_ndvi(geometry, start_date, end_date):
    # Load Sentinel-2 imagery
    s2 = (ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
          .filterBounds(geometry)
          .filterDate(start_date, end_date)
          .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20)))

    def add_ndvi(image):
        ndvi = image.normalizedDifference(['B8', 'B4']).rename('NDVI')
        return image.addBands(ndvi)

    # Create monthly composite
    collection_with_ndvi = s2.map(add_ndvi)
    composite = collection_with_ndvi.select('NDVI').median()

    # Compute stats
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

# Process all regions in the database
def process_regions(composite_type='monthly'):
    conn = get_db_connection()
    cursor = conn.cursor()

    # Get all regions from DB
    cursor.execute("SELECT region_id, name, ST_AsGeoJSON(boundary) FROM regions WHERE boundary IS NOT NULL")
    regions = cursor.fetchall()

    if not regions:
        print("No regions with boundaries found in database. Seed regions first.")
        cursor.close()
        conn.close()
        return

    # Set date range (last month)
    end_date = datetime.now()
    start_date = end_date - timedelta(days=30)

    for region_id, name, boundary_geojson in regions:
        print(f"Processing {name}...")

        try:
            geometry = ee.Geometry(eval(boundary_geojson))
            stats = compute_ndvi(
                geometry,
                start_date.strftime('%Y-%m-%d'),
                end_date.strftime('%Y-%m-%d')
            )

            ndvi_mean = stats.get('NDVI_mean')
            ndvi_min = stats.get('NDVI_min')
            ndvi_max = stats.get('NDVI_max')
            ndvi_std = stats.get('NDVI_stdDev')

            if ndvi_mean is None:
                print(f"  No data for {name} (possibly cloud cover)")
                continue

            # Store in database
            cursor.execute("""
                INSERT INTO ndvi_records 
                (region_id, period_start, period_end, ndvi_mean, ndvi_min, ndvi_max, ndvi_std, composite_type)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                region_id,
                start_date.date(),
                end_date.date(),
                ndvi_mean,
                ndvi_min,
                ndvi_max,
                ndvi_std,
                composite_type
            ))

            conn.commit()
            print(f"  ✅ {name}: NDVI mean = {ndvi_mean:.3f}")

        except Exception as e:
            print(f"  ❌ Error processing {name}: {e}")
            conn.rollback()

    cursor.close()
    conn.close()
    print("\nDone processing all regions!")

if __name__ == '__main__':
    process_regions()
