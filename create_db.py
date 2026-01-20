import mysql.connector
from mysql.connector import Error

def create_database():
    try:
        connection = mysql.connector.connect(
            host="localhost",
            user="root",
            password="1234"
        )
        if connection.is_connected():
            cursor = connection.cursor()
            cursor.execute("CREATE DATABASE IF NOT EXISTS mi_base_datos")
            print("✅ Database 'mi_base_datos' created or already exists.")
            cursor.close()
            connection.close()
    except Error as e:
        print(f"Error while connecting to MySQL: {e}")

if __name__ == "__main__":
    create_database()
