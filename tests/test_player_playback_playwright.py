import subprocess
import time
import requests
import os
import sys
import signal
import pytest
from database import SessionLocal
import crud, schemas

SERVER_PORT = 8002
SERVER_URL = f"http://127.0.0.1:{SERVER_PORT}"


def wait_for_server(timeout=15):
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            r = requests.get(f"{SERVER_URL}/salud", timeout=1)
            if r.status_code == 200:
                return True
        except Exception:
            pass
        time.sleep(0.2)
    return False


def start_server():
    python = sys.executable
    proc = subprocess.Popen([python, "-m", "uvicorn", "main:app", "--port", str(SERVER_PORT)], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if not wait_for_server(20):
        proc.terminate()
        raise RuntimeError("Server failed to start")
    return proc


def stop_server(proc):
    try:
        proc.send_signal(signal.SIGINT)
        proc.wait(timeout=5)
    except Exception:
        proc.kill()


@pytest.mark.playwright
def test_player_starts_playback_on_approve_lazy_playwright(page):
    proc = start_server()
    try:
        # Ensure page will have a fake YT.Player before any scripts run
        init_script = """
            window.__fake_player = { played: false, created: false };
            window.YT = { Player: function(id, opts) { window.__fake_player.created = true; window.__fake_player.opts = opts; this.loadVideoById = function(id) {}; this.playVideo = function() { window.__fake_player.played = true; }; this.pauseVideo = function() { window.__fake_player.played = false; }; } };
        """
        page.add_init_script(init_script)

        # Navigate to player
        page.goto(f"{SERVER_URL}/player")

        # Create test data (mesa, usuario, lazy song)
        headers = {'X-API-Key': 'zxc12345'}
        r = requests.post(f"{SERVER_URL}/api/v1/mesas/", json={'nombre': 'E2E_T_PW', 'qr_code': 'e2e_pw'}, headers=headers)
        assert r.status_code == 201
        mesa = r.json()

        # create user directly in DB
        db = SessionLocal()
        usuario = crud.create_usuario_en_mesa(db, usuario=schemas.UsuarioCreate(nick='pw_user'), mesa_id=mesa['id'])

        song_payload = schemas.CancionCreate(titulo='PW Lazy', youtube_id='PWLAZY', duracion_seconds=30, is_karaoke=False)
        db_song = crud.create_cancion_para_usuario(db, cancion=song_payload, usuario_id=usuario.id)
        crud.update_cancion_estado(db, cancion_id=db_song.id, nuevo_estado='pendiente_lazy')
        db.close()

        # Approve next lazy (admin)
        r = requests.post(f"{SERVER_URL}/api/v1/admin/canciones/lazy/approve-next", headers=headers)
        assert r.status_code == 200

        # Wait for the fake player to report started
        page.wait_for_function('window.__fake_player && window.__fake_player.played === true', timeout=8000)

        played = page.evaluate('window.__fake_player && window.__fake_player.played')
        assert played is True
    finally:
        stop_server(proc)
