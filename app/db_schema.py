import psycopg2
import os
from psycopg2.extras import Json

# Database connection parameters
DB_HOST = "reed-db.cf2o2o4wczoh.us-east-2.rds.amazonaws.com"
DB_PORT = "5432"
DB_NAME = "postgres"
DB_USER = "vtupuri_reed"
DB_PASSWORD = os.environ["POSTGRES_PASSWORD"]
print(DB_PASSWORD)
def get_db_connection():
    return psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
        connect_timeout=10
    )

def create_tables():
    conn = get_db_connection()
    cur = conn.cursor()

    # Create rooms table with more structured game state
    cur.execute("""
    CREATE TABLE IF NOT EXISTS rooms (
        id VARCHAR(255) PRIMARY KEY,
        current_round INTEGER DEFAULT 0,
        game_status VARCHAR(20) DEFAULT 'setup',
        current_turn VARCHAR(255),
        scores JSONB DEFAULT '{}',
        additional_state JSONB DEFAULT '{}'
    )
    """)

    # Create players table (unchanged)
    cur.execute("""
    CREATE TABLE IF NOT EXISTS players (
        id SERIAL PRIMARY KEY,
        room_id VARCHAR(255) REFERENCES rooms(id),
        name VARCHAR(255),
        team INTEGER,
        cards TEXT
    )
    """)

    conn.commit()
    cur.close()
    conn.close()

def print_rooms_table():
    conn = get_db_connection()
    cur = conn.cursor()

    cur.execute("SELECT * FROM rooms")
    rooms = cur.fetchall()

    if not rooms:
        print("The rooms table is empty.")
    else:
        print("Rooms Table:")
        print("------------")
        for room in rooms:
            print(f"ID: {room[0]}")
            print(f"Current Round: {room[1]}")
            print(f"Game Status: {room[2]}")
            print(f"Current Turn: {room[3]}")
            print(f"Scores: {room[4]}")
            print(f"Additional State: {room[5]}")
            print("------------")

    cur.close()
    conn.close()

def clear_rooms_table():
    conn = get_db_connection()
    cur = conn.cursor()

    # First, delete all records from the players table
    cur.execute("DELETE FROM players")
    conn.commit()

    # Then, delete all records from the rooms table
    cur.execute("DELETE FROM rooms")

    conn.commit()
    cur.close()
    conn.close()
    print("Players and rooms tables cleared successfully.")

def get_room_data(room_id):
    conn = get_db_connection()
    cur = conn.cursor()

    cur.execute("""
    SELECT id, current_round, game_status, current_turn, scores, additional_state
    FROM rooms
    WHERE id = %s
    """, (room_id,))
    
    room = cur.fetchone()

    cur.close()
    conn.close()

    if room:
        return {
            "id": room[0],
            "current_round": room[1],
            "game_status": room[2],
            "current_turn": room[3],
            "scores": room[4],
            "additional_state": room[5]
        }
    else:
        return None

if __name__ == "__main__":
    # create_tables()
    # print("Tables created successfully.")
    clear_rooms_table()  # This line is now uncommented
    print_rooms_table()
    # print(get_room_data("5d64e00a-95af-4335-ac8d-bed899d684b0"))
    # # Example usage of get_room_data
    # room_id = "example_room_id"
    # room_data = get_room_data(room_id)
    # if room_data:
    #     print(f"Room data for {room_id}:")
    #     print(room_data)
    # else:
    #     print(f"No room found with ID: {room_id}")