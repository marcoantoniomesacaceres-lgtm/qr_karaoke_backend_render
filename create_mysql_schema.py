from sqlalchemy import create_engine
from database import Base
# Import all models so Base.metadata knows about them
from models import Mesa, Usuario, Cancion, Producto, Consumo, BannedNick, AdminLog, AdminApiKey, Pago, Cuenta, ConfiguracionGlobal
import settings_storage # In case there are more models or side effects

# MySQL connection string
# NOTE: Using pymysql or mysql-connector as driver. 
# Installing mysql-connector-python usually allows 'mysql+mysqlconnector://'
MYSQL_DATABASE_URL = "mysql+mysqlconnector://root:1234@localhost/mi_base_datos"

def create_schema():
    print("Connecting to MySQL...")
    engine = create_engine(MYSQL_DATABASE_URL)
    
    print("Creating tables...")
    Base.metadata.create_all(bind=engine)
    print("✅ Tables created successfully in MySQL!")

if __name__ == "__main__":
    create_schema()
