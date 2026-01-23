import pytest
import os, sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from fastapi.testclient import TestClient
import main, crud, websocket_manager, schemas, models
from database import SessionLocal, engine

client = TestClient(main.app)

@pytest.fixture(autouse=True)
def clean_db():
    # Aseguramos DB limpia para el test
    models.Base.metadata.drop_all(bind=engine)
    models.Base.metadata.create_all(bind=engine)
    yield


def test_approve_lazy_triggers_play(monkeypatch):
    called = {'youtube': None}

    async def fake_broadcast_play_song(youtube_id, duration_seconds=0):
        called['youtube'] = youtube_id
        return 0

    # Reemplazamos el método del manager por la versión de prueba
    monkeypatch.setattr(websocket_manager.manager, 'broadcast_play_song', fake_broadcast_play_song)

    # Headers para endpoints admin
    headers = {'X-API-Key': 'zxc12345'}

    # Crear mesa y usuario mediante API
    r = client.post('/api/v1/mesas/', json={'nombre': 'T1', 'qr_code': 't1'}, headers=headers)
    assert r.status_code == 201
    mesa = r.json()

    # Crear usuario directamente en la DB (endpoint de creación de usuarios no disponible en tests)
    db = SessionLocal()
    usuario_obj = crud.create_usuario_en_mesa(db, usuario=schemas.UsuarioCreate(nick='user1'), mesa_id=mesa['id'])
    usuario = {'id': usuario_obj.id, 'nick': usuario_obj.nick}

    # Insertar una canción en estado 'pendiente_lazy' directamente en DB
    song_payload = schemas.CancionCreate(titulo='LazySong', youtube_id='LAZY123', duracion_seconds=120, is_karaoke=False)
    db_song = crud.create_cancion_para_usuario(db, cancion=song_payload, usuario_id=usuario['id'])
    crud.update_cancion_estado(db, cancion_id=db_song.id, nuevo_estado='pendiente_lazy')
    db.close()

    # Llamar al endpoint de admin para aprobar la siguiente canción lazy
    headers = {'X-API-Key': 'zxc12345'}
    r = client.post('/api/v1/admin/canciones/lazy/approve-next', headers=headers)
    assert r.status_code == 200

    # Verificar que el broadcast_play_song fue llamado con el youtube_id correcto
    assert called['youtube'] == 'LAZY123'