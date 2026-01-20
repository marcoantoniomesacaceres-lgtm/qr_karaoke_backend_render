import sqlite3

DB_FILE = "karaoke.db"

def add_is_karaoke_column():
    """
    Agrega la columna 'is_karaoke' a la tabla 'canciones'.
    Default: TRUE (para mantener compatibilidad con canciones existentes)
    """
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    try:
        # Verificar si la columna ya existe
        cursor.execute("PRAGMA table_info(canciones)")
        columns = [column[1] for column in cursor.fetchall()]
        
        if 'is_karaoke' in columns:
            print("La columna 'is_karaoke' ya existe en la tabla 'canciones'.")
        else:
            # Agregar la columna con valor default TRUE
            cursor.execute("""
                ALTER TABLE canciones 
                ADD COLUMN is_karaoke BOOLEAN DEFAULT 1
            """)
            conn.commit()
            print("Columna 'is_karaoke' agregada exitosamente a la tabla 'canciones'.")
            print("   - Valor default: TRUE (1)")
            print("   - Todas las canciones existentes se consideraran como karaoke")
        
    except sqlite3.Error as e:
        print(f"Error al agregar la columna: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    print("Iniciando migracion: Agregar columna 'is_karaoke' a tabla 'canciones'")
    add_is_karaoke_column()
    print("Migracion completada.")
