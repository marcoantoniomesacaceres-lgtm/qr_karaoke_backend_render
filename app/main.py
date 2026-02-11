# app/main.py
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.responses import Response, FileResponse
from fastapi.staticfiles import StaticFiles
import os
from dotenv import load_dotenv
import logging

# ===============================
# CARGA DE VARIABLES DE ENTORNO
# ===============================
load_dotenv()

print("YOUTUBE_API_KEY cargada:", os.getenv("YOUTUBE_API_KEY"))

# ===============================
# BASE DE DATOS
# ===============================
from app.core.database import engine, SessionLocal
from app.models import base as models

models.Base.metadata.create_all(bind=engine)

# Imports actualizados
from app.crud import base as crud
from app.schemas import base as schemas
from app.core import websocket_manager
from app.services import thumbnails
from app.api.v1 import (
    mesas,
    canciones,
    youtube,
    consumos,
    usuarios,
    admin,
    productos,
    admin_settings,
    admin_extra
)

# ===============================
# LOGGING
# ===============================
log_formatter = logging.Formatter(
    '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# Crear carpeta logs si no existe
os.makedirs("logs", exist_ok=True)

file_handler = logging.FileHandler(
    "logs/karaoke_debug.log", mode='a', encoding='utf-8'
)
file_handler.setFormatter(log_formatter)

console_handler = logging.StreamHandler()
console_handler.setFormatter(log_formatter)

logging.basicConfig(
    level=logging.INFO,
    handlers=[file_handler, console_handler]
)

logger = logging.getLogger(__name__)

# ===============================
# APP FASTAPI with lifespan
# ===============================
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    db = SessionLocal()
    try:
        crud.get_or_create_dj_user(db)
        yield
    finally:
        db.close()

app = FastAPI(title="Karaoke 'LA CANTA QUE RANA'", lifespan=lifespan)

# ===============================
# ✅ HEALTH CHECK PARA RENDER
# ===============================
@app.get("/salud", include_in_schema=False)
def health_check():
    return {"status": "ok"}

# ===============================
# MIDDLEWARE
# ===============================
@app.middleware("http")
async def add_referrer_policy_header(request: Request, call_next):
    response: Response = await call_next(request)
    response.headers["Referrer-Policy"] = "origin"
    return response

# ===============================
# FRONTEND
# ===============================
@app.get("/", response_class=FileResponse, include_in_schema=False)
async def read_index():
    return FileResponse(os.path.join("static", "index.html"))

@app.get("/bees", response_class=FileResponse, include_in_schema=False)
async def read_bees_index():
    return FileResponse(os.path.join("static", "index_bees.html"))

@app.get("/admin", response_class=FileResponse, include_in_schema=False)
async def read_admin_index():
    return FileResponse(os.path.join("static", "admin.html"))

@app.get("/admin/dashboard", response_class=FileResponse, include_in_schema=False)
async def read_admin_dashboard():
    return FileResponse(os.path.join("static", "admin_dashboard_bees.html"))

@app.get("/player", response_class=FileResponse, include_in_schema=False)
async def read_player():
    return FileResponse(os.path.join("static", "player.html"))

# ===============================
# WEBSOCKET
# ===============================
@app.websocket("/ws/cola")
async def websocket_endpoint(websocket: WebSocket):
    await websocket_manager.manager.connect(websocket)
    await websocket_manager.manager.broadcast_queue_update()
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        websocket_manager.manager.disconnect(websocket)

# ===============================
# ROUTERS API
# ===============================
app.include_router(mesas.router, prefix="/api/v1/mesas", tags=["Mesas"])
app.include_router(canciones.router, prefix="/api/v1/canciones", tags=["Canciones"])
app.include_router(youtube.router, prefix="/api/v1/youtube", tags=["YouTube"])
app.include_router(consumos.router, prefix="/api/v1/consumos", tags=["Consumos"])
app.include_router(usuarios.router, prefix="/api/v1/usuarios", tags=["Usuarios"])
app.include_router(admin.router, prefix="/api/v1/admin", tags=["Administración"])
app.include_router(admin.public_router, prefix="/api/v1", tags=["Público"])
app.include_router(productos.router, prefix="/api/v1/productos", tags=["Productos"])
# app.include_router(broadcast.router, prefix="/api/v1/broadcast", tags=["Broadcast"])  # Módulo broadcast no encontrado
app.include_router(thumbnails.router)
app.include_router(admin_settings.router)
app.include_router(admin_extra.router)

# ===============================
# STATIC FILES
# ===============================
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    return FileResponse(os.path.join("static", "favicon.ico"))