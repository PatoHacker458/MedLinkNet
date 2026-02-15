import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

POSTGRES_USER = os.getenv("POSTGRES_USER", "admin")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD") # Sin default, o usa uno dummy si prefieres no romper local
POSTGRES_DB = os.getenv("POSTGRES_DB", "hospital_inventory")
DB_HOST = os.getenv("DB_HOST", "db") # 'db' es el nombre del servicio en Docker
DB_PORT = os.getenv("DB_PORT", "5432")

# 2. Construimos la URL. Si falta el password, avisamos (útil para debug)
if not POSTGRES_PASSWORD:
    # OJO: Esto es solo para que no falle si lo corres local sin configurar nada, 
    # pero lo ideal es que falle si no hay password.
    # Para tu entorno actual, usa la que definimos en el docker-compose:
    POSTGRES_PASSWORD = "secure_password_dev" 

SQLALCHEMY_DATABASE_URL = f"postgresql://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{DB_HOST}:{DB_PORT}/{POSTGRES_DB}"

engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()