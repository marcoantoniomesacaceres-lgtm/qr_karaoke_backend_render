from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.responses import Response, FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from typing import Optional
import os
import logging
from dotenv import load_dotenv

# ===============================
# CARGA DE VARIABLES DE ENTORNO
# ===============================
load_dotenv()

# ===============================
# LOGGING
# ===============================
from app.core.logging_config import setup_logging
setup_logging()

# ===============================
# BASE DE DATOS
# ===============================
from app.db.database import engine, SessionLocal
from app.db.models import Base  # importa TODOS los modelos

Base.metadata.create_all(bind=engine)

from app.db import crud
from app.services import broadcast, thumbnails, websocket_manager
from app.routers import mesas, canciones, youtube, consumos, usuarios, admin, productos
from app.routers.admin_settings import router as settings_router
from app.routers.admin_extra import router as admin_extra_router
from app.routers import auth_saas, locales, player2
from app.services.song_credits_background import start_credits_background_task

logger = logging.getLogger(__name__)

# ===============================
# APP FASTAPI with lifespan
# ===============================
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Setup inicial en lifespan (reemplaza @app.on_event startup)
    db = SessionLocal()
    try:
        # Ejecutar alteraciones de base de datos seguras para stock_seguridad y local_id
        from sqlalchemy import text
        try:
            db.execute(text("ALTER TABLE productos ADD COLUMN stock_seguridad INTEGER DEFAULT 0"))
            db.commit()
        except Exception:
            db.rollback()
            
        try:
            db.execute(text("ALTER TABLE productos ADD COLUMN local_id INTEGER REFERENCES locales(id)"))
            db.commit()
        except Exception:
            db.rollback()

        try:
            db.execute(text("ALTER TABLE locales ADD COLUMN telefono VARCHAR(50) NULL"))
            db.commit()
        except Exception:
            db.rollback()

        try:
            db.execute(text("ALTER TABLE locales ADD COLUMN hora_cierre VARCHAR(10) DEFAULT '03:00'"))
            db.commit()
        except Exception:
            db.rollback()

        try:
            db.execute(text("ALTER TABLE usuarios_empleado_locales ADD COLUMN modulos_permitidos TEXT NULL"))
            db.commit()
        except Exception:
            db.rollback()

        crud.get_or_create_dj_user(db)
        # Iniciar tarea de background para decrementar créditos
        start_credits_background_task()
        yield
    finally:
        db.close()

app = FastAPI(title="My Qr Music", lifespan=lifespan)

# ===============================
# CORS MIDDLEWARE
# ===============================
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
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
@app.get("/", include_in_schema=False)
async def root_redirect():
    return RedirectResponse(url="/admin")

@app.get("/user", response_class=FileResponse, include_in_schema=False)
async def read_user_app():
    return FileResponse(os.path.join("static", "user.html"))

@app.get("/admin", response_class=FileResponse, include_in_schema=False)
async def read_admin_index():
    return FileResponse(os.path.join("static", "admin.html"))

@app.get("/admin/dashboard", response_class=FileResponse, include_in_schema=False)
async def read_admin_dashboard():
    return FileResponse(os.path.join("static", "admin_dashboard_bees.html"))

@app.get("/player", include_in_schema=False)
@app.get("/player/", include_in_schema=False)
async def read_player():
    return RedirectResponse(url="/api/v1/player2/")

@app.get("/terminos", response_class=FileResponse, include_in_schema=False)
@app.get("/terminos/", response_class=FileResponse, include_in_schema=False)
async def read_terminos():
    return FileResponse(os.path.join("static", "terminos.html"))

@app.get("/privacidad", response_class=FileResponse, include_in_schema=False)
@app.get("/privacidad/", response_class=FileResponse, include_in_schema=False)
async def read_privacidad():
    return FileResponse(os.path.join("static", "privacidad.html"))


# ===============================
# WEBSOCKET
# ===============================
# WEBSOCKET
# ===============================
@app.websocket("/ws/cola")
async def websocket_endpoint(
    websocket: WebSocket,
    local_id: Optional[int] = None,
    local: Optional[str] = None
):
    resolved_local_id = local_id
    if resolved_local_id is None and local:
        try:
            resolved_local_id = int(local)
        except ValueError:
            # Query by slug
            db = SessionLocal()
            try:
                from app.db.models.local import Local
                loc = db.query(Local).filter(Local.slug == local).first()
                if loc:
                    resolved_local_id = loc.id
            finally:
                db.close()

    await websocket_manager.manager.connect(websocket, local_id=resolved_local_id)
    await websocket_manager.manager.broadcast_queue_update(local_id=resolved_local_id)
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
app.include_router(broadcast.router, prefix="/api/v1/broadcast", tags=["Broadcast"])
app.include_router(thumbnails.router)
app.include_router(settings_router)
app.include_router(admin_extra_router)
app.include_router(auth_saas.router, prefix="/api/v1/saas/auth", tags=["SaaS Auth"])
app.include_router(locales.router, prefix="/api/v1/saas/locales", tags=["SaaS Locales"])
app.include_router(player2.router, prefix="/api/v1/player2", tags=["Player2"])

# ===============================
# STATIC FILES
# ===============================
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/player2", include_in_schema=False)
@app.get("/player2/", include_in_schema=False)
async def redirect_player2():
    return RedirectResponse(url="/api/v1/player2/")

@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    return FileResponse(os.path.join("static", "favicon.ico"))