from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import models
from database import engine

# Importar los nuevos routers
from routers import auth, inventory, dashboard

# Crear tablas (si no existen)
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="MedLinkNet API")

# Configuración CORS (Permite que el Frontend hable con el Backend)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # En producción cambiar por la URL real
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Incluir las rutas
app.include_router(auth.router)
app.include_router(inventory.router)
app.include_router(dashboard.router)

@app.get("/")
def read_root():
    return {"message": "Bienvenido a la API de MedLinkNet v2.0 (Modular)"}