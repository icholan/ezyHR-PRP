import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

def test_sync_connection():
    url = os.getenv("DATABASE_URL")
    print(f"Testing sync connection (psycopg2) to: {url.split('@')[-1] if url else 'None'}")
    if not url:
        print("DATABASE_URL not set")
        return

    try:
        conn = psycopg2.connect(url)
        print("Sync Connection Successful!")
        conn.close()
    except Exception as e:
        print(f"Sync Connection Failed: {e}")

if __name__ == "__main__":
    test_sync_connection()
