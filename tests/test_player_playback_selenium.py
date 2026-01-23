import pytest
pytest.skip("Selenium E2E test deprecated; use Playwright tests instead", allow_module_level=True)

# Pyright/Pylance: This file uses Selenium which may not be installed in some environments.
# Disable missing-imports diagnostics for this deprecated Selenium E2E test module.
# pyright: reportMissingImports=false

import subprocess
import time
import requests
import os
import sys
import signal
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager

SERVER_PORT = 8001
SERVER_URL = f"http://127.0.0.1:{SERVER_PORT}"


def wait_for_server(timeout=10):
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
    # Start uvicorn in a subprocess
    env = os.environ.copy()
    # Use the venv Python if available
    python = sys.executable
    proc = subprocess.Popen([python, "-m", "uvicorn", "main:app", "--port", str(SERVER_PORT)], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if not wait_for_server(15):
        proc.terminate()
        raise RuntimeError("Server failed to start")
    return proc


def stop_server(proc):
    try:
        proc.send_signal(signal.SIGINT)
        proc.wait(timeout=5)
    except Exception:
        proc.kill()


def test_player_starts_playback_on_approve_lazy():
    proc = start_server()

    try:
        # Launch headless Chrome
        chrome_options = Options()
        chrome_options.add_argument("--headless=new")
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")

        driver = webdriver.Chrome(ChromeDriverManager().install(), options=chrome_options)
        try:
            # Before loading, inject a fake YT.Player implementation to spy on play calls
            driver.get(f"{SERVER_URL}/player")

            # Define a fake player API in the page context
            driver.execute_script("""
                window.__fake_player = { played: false, created: false };
                window.YT = { Player: function(id, opts) { window.__fake_player.created = true; window.__fake_player.opts = opts; this.loadVideoById = function(id) {}; this.playVideo = function() { window.__fake_player.played = true; }; this.pauseVideo = function() { window.__fake_player.played = false; }; } };
                // Simulate API ready callback if page expects onYouTubeIframeAPIReady
                if (typeof onYouTubeIframeAPIReady === 'function') { try { onYouTubeIframeAPIReady(); } catch(e) { console.error(e); } }
            """)

            # Setup: create mesa, usuario and lazy song via HTTP API
            headers = {'X-API-Key': 'zxc12345'}
            r = requests.post(f"{SERVER_URL}/api/v1/mesas/", json={'nombre': 'E2E_T1', 'qr_code': 'e2e_t1'}, headers=headers)
            assert r.status_code == 201
            mesa = r.json()

            r = requests.post(f"{SERVER_URL}/api/v1/mesas/{mesa['id']}/usuarios", json={'nick': 'e2e_user'})
            # The app may not expose this endpoint; if not available, create user directly
            if r.status_code == 404:
                # create directly in DB via internal endpoint not available; bypass
                pass

            # Create user directly via DB if needed
            from database import SessionLocal
            import crud, schemas
            db = SessionLocal()
            usuario = crud.create_usuario_en_mesa(db, schemas.UsuarioCreate(nick='e2e_user'), mesa['id'])

            # Add a lazy song by creating it and setting state
            song_payload = schemas.CancionCreate(titulo='E2E Lazy', youtube_id='E2ELZY', duracion_seconds=30, is_karaoke=False)
            db_song = crud.create_cancion_para_usuario(db, cancion=song_payload, usuario_id=usuario.id)
            crud.update_cancion_estado(db, cancion_id=db_song.id, nuevo_estado='pendiente_lazy')
            db.close()

            # Call approve-next endpoint as admin
            r = requests.post(f"{SERVER_URL}/api/v1/admin/canciones/lazy/approve-next", headers=headers)
            assert r.status_code == 200

            # Wait for the page's fake player to report it played
            deadline = time.time() + 8
            played = False
            while time.time() < deadline:
                res = driver.execute_script('return window.__fake_player && window.__fake_player.played;')
                if res:
                    played = True
                    break
                time.sleep(0.5)

            assert played, "Expected player to start playing after approve-next"
        finally:
            driver.quit()
    finally:
        stop_server(proc)
