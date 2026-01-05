
# Script de limpieza
import sys
import os

# Agregar directorio padre al path para importar modulos
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal
import models

def clear_mesas():
    db = SessionLocal()
    try:
        # Eliminar todas las mesas
        # Primero eliminamos usuarios para evitar problemas de FK si no hay cascade
        db.query(models.Usuario).delete()
        
        # Eliminar mesas
        num_mesas = db.query(models.Mesa).delete()
        
        db.commit()
        print(f"Base de datos limpiada. {num_mesas} mesas eliminadas.")
    except Exception as e:
        print(f"Error limpiando base de datos: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    clear_mesas()
