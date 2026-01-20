import sqlite3
import mysql.connector
from mysql.connector import Error

def migrate():
    print("Starting migration...")
    
    # 1. Connect to SQLite
    try:
        sqlite_conn = sqlite3.connect("karaoke.db")
        sqlite_cursor = sqlite_conn.cursor()
        print("Connected to SQLite.")
    except Exception as e:
        print(f"Error connecting to SQLite: {e}")
        return

    # 2. Connect to MySQL
    try:
        mysql_conn = mysql.connector.connect(
            host="localhost",
            user="root",
            password="1234",
            database="mi_base_datos"
        )
        if mysql_conn.is_connected():
            print("Connected to MySQL.")
            mysql_cursor = mysql_conn.cursor()
    except Error as e:
        print(f"Error connecting to MySQL: {e}")
        sqlite_conn.close()
        return

    # 3. Define tables in dependency order
    # mesas -> usuarios, productos, cuentas -> consumos, pagos, canciones
    tables_order = [
         "mesas",
         "productos",
         "usuarios",
         "cuentas",
         "canciones",
         "pagos",
         "consumos",
         "banned_nicks",
         "admin_logs",
         "admin_api_keys",
         "configuracion_global"
    ]

    # Disable foreign key checks temporarily to allow insertion if there are slight circular dependencies or ordering issues
    mysql_cursor.execute("SET FOREIGN_KEY_CHECKS=0;")

    for table in tables_order:
        print(f"Migrating table: {table}...")
        
        try:
            # Check if table exists in SQLite
            sqlite_cursor.execute(f"SELECT name FROM sqlite_master WHERE type='table' AND name='{table}'")
            if not sqlite_cursor.fetchone():
                print(f"Skipping {table} (not found in SQLite)")
                continue

            # Get data from SQLite
            sqlite_cursor.execute(f"SELECT * FROM {table}")
            rows = sqlite_cursor.fetchall()
            
            if not rows:
                print(f"  No rows in {table}.")
                continue

            # Get column names to build dynamic query
            col_names = [description[0] for description in sqlite_cursor.description]
            cols_str = ", ".join(col_names)
            placeholders = ", ".join(["%s"] * len(col_names))
            
            # MySQL Insert Query
            insert_query = f"INSERT INTO {table} ({cols_str}) VALUES ({placeholders})"
            
            # Execute many
            mysql_cursor.executemany(insert_query, rows)
            mysql_conn.commit()
            print(f"  Migrated {len(rows)} rows to {table}.")
            
        except Error as e:
            print(f"Error migrating {table}: {e}")
        except sqlite3.Error as e:
            print(f"SQLite error for {table}: {e}")

    # Re-enable foreign key checks
    mysql_cursor.execute("SET FOREIGN_KEY_CHECKS=1;")

    print("✅ Migración completada")

    sqlite_conn.close()
    mysql_cursor.close()
    mysql_conn.close()

if __name__ == "__main__":
    migrate()
