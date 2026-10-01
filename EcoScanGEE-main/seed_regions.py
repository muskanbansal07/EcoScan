import psycopg2
import json
import os
from dotenv import load_dotenv

load_dotenv()

def get_db_connection():
    return psycopg2.connect(
        host=os.getenv('DB_HOST', 'localhost'),
        port=os.getenv('DB_PORT', '5432'),
        database=os.getenv('DB_NAME', 'ecoscan'),
        user=os.getenv('DB_USER', 'ecoscan_user'),
        password=os.getenv('DB_PASSWORD', 'ecoscan123')
    )

# Indian states with approximate bounding box centers and boundaries
regions = [
    {
        'name': 'Kerala',
        'level': 'state',
        'area_km2': 38852,
        'coordinates': [
            [[76.7, 8.0], [77.6, 8.0], [77.6, 12.8], [76.7, 12.8], [76.7, 8.0]]
        ]
    },
    {
        'name': 'Rajasthan',
        'level': 'state',
        'area_km2': 342239,
        'coordinates': [
            [[69.5, 23.0], [78.0, 23.0], [78.0, 30.2], [69.5, 30.2], [69.5, 23.0]]
        ]
    },
    {
        'name': 'Madhya Pradesh',
        'level': 'state',
        'area_km2': 308252,
        'coordinates': [
            [[74.0, 21.0], [82.8, 21.0], [82.8, 26.9], [74.0, 26.9], [74.0, 21.0]]
        ]
    },
    {
        'name': 'Maharashtra',
        'level': 'state',
        'area_km2': 307713,
        'coordinates': [
            [[72.6, 15.6], [80.9, 15.6], [80.9, 22.0], [72.6, 22.0], [72.6, 15.6]]
        ]
    },
    {
        'name': 'Karnataka',
        'level': 'state',
        'area_km2': 191791,
        'coordinates': [
            [[74.0, 11.5], [78.5, 11.5], [78.5, 18.5], [74.0, 18.5], [74.0, 11.5]]
        ]
    },
    {
        'name': 'Assam',
        'level': 'state',
        'area_km2': 78438,
        'coordinates': [
            [[89.7, 24.0], [96.0, 24.0], [96.0, 28.0], [89.7, 28.0], [89.7, 24.0]]
        ]
    },
    {
        'name': 'West Bengal',
        'level': 'state',
        'area_km2': 88752,
        'coordinates': [
            [[85.8, 21.5], [89.9, 21.5], [89.9, 27.5], [85.8, 27.5], [85.8, 21.5]]
        ]
    },
    {
        'name': 'Uttarakhand',
        'level': 'state',
        'area_km2': 53483,
        'coordinates': [
            [[77.5, 29.0], [81.0, 29.0], [81.0, 31.5], [77.5, 31.5], [77.5, 29.0]]
        ]
    },
    {
        'name': 'Tamil Nadu',
        'level': 'state',
        'area_km2': 130058,
        'coordinates': [
            [[76.2, 8.0], [80.3, 8.0], [80.3, 13.5], [76.2, 13.5], [76.2, 8.0]]
        ]
    },
    {
        'name': 'Gujarat',
        'level': 'state',
        'area_km2': 196024,
        'coordinates': [
            [[68.0, 20.0], [74.5, 20.0], [74.5, 24.7], [68.0, 24.7], [68.0, 20.0]]
        ]
    },
]

def seed():
    conn = get_db_connection()
    cursor = conn.cursor()

    print("Seeding regions...")

    for region in regions:
        geojson = json.dumps({
            'type': 'MultiPolygon',
            'coordinates': [region['coordinates']]
        })

        cursor.execute("""
            INSERT INTO regions (name, level, area_km2, boundary)
            VALUES (%s, %s, %s, ST_SetSRID(ST_GeomFromGeoJSON(%s), 4326))
            ON CONFLICT DO NOTHING
        """, (
            region['name'],
            region['level'],
            region['area_km2'],
            geojson
        ))

        print(f"  ✅ Inserted {region['name']}")

    conn.commit()
    cursor.close()
    conn.close()
    print("\nDone seeding regions!")

if __name__ == '__main__':
    seed()
