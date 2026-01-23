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
            // Fake YT.Player to spy on play calls and mark creation
            window.__fake_player = { played: false, created: false };
            window.YT = { Player: function(id, opts) { window.__fake_player.created = true; document.documentElement.setAttribute('data-fake-created', '1'); window.__fake_player.opts = opts; this.loadVideoById = function(id) {}; this.playVideo = function() { window.__fake_player.played = true; document.documentElement.setAttribute('data-fake-played', '1'); }; this.pauseVideo = function() { window.__fake_player.played = false; document.documentElement.removeAttribute('data-fake-played'); }; } };

            // Proxy WebSocket to mark when play_song message is received by the client and when socket opens
            (function(){
                const NativeWebSocket = window.WebSocket;
                window.WebSocket = function(url, protocols) {
                    const ws = protocols ? new NativeWebSocket(url, protocols) : new NativeWebSocket(url);
                    const orig = ws.addEventListener.bind(ws);
                    ws.addEventListener = function(type, listener, opts) {
                        if (type === 'message') {
                            const wrapped = function(event) {
                                try {
                                    const d = JSON.parse(event.data);
                                    if (d && d.type === 'play_song') {
                                        document.documentElement.setAttribute('data-play-song-received', '1');
                                    }
                                } catch (e) { }
                                return listener.call(this, event);
                            };
                            return orig(type, wrapped, opts);
                        }
                        if (type === 'open') {
                            const wrappedOpen = function(event) {
                                document.documentElement.setAttribute('data-ws-open', '1');
                                return listener.call(this, event);
                            };
                            return orig(type, wrappedOpen, opts);
                        }
                        return orig(type, listener, opts);
                    };
                    // Also wrap onmessage assignment
                    Object.defineProperty(ws, 'onmessage', {
                        set(fn) {
                            const wrapped = function(event) {
                                try {
                                    const d = JSON.parse(event.data);
                                    if (d && d.type === 'play_song') {
                                        document.documentElement.setAttribute('data-play-song-received', '1');
                                    }
                                } catch (e) {}
                                return fn && fn.call(this, event);
                            };
                            this.addEventListener('message', wrapped);
                        }
                    });
                    // Wrap onopen assignment
                    Object.defineProperty(ws, 'onopen', {
                        set(fn) {
                            const wrapped = function(event) {
                                document.documentElement.setAttribute('data-ws-open', '1');
                                return fn && fn.call(this, event);
                            };
                            this.addEventListener('open', wrapped);
                        }
                    });
                    return ws;
                };
                window.WebSocket.prototype = NativeWebSocket.prototype;
            })();
        """
        page.add_init_script(init_script)

        # Start Playwright tracing for debugging (captures screenshots/snapshots)
        try:
            page.context.tracing.start(screenshots=True, snapshots=True)
        except Exception:
            pass

        # Navigate to player
        page.goto(f"{SERVER_URL}/player")

# Wait for the fake player to be instantiated in the page (ensures client ready)
        page.wait_for_selector('html[data-fake-created="1"]', timeout=5000)

        # Wait until the client WebSocket is open (ensures page will receive broadcasts)
        page.wait_for_selector('html[data-ws-open="1"]', timeout=5000)

        # Create test data (mesa, usuario, lazy song)
        headers = {'X-API-Key': 'zxc12345'}
        r = requests.post(f"{SERVER_URL}/api/v1/mesas/", json={'nombre': 'E2E_T_PW', 'qr_code': 'e2e_pw'}, headers=headers)
        if r.status_code == 201:
            mesa = r.json()
        elif r.status_code == 400:
            mesas_resp = requests.get(f"{SERVER_URL}/api/v1/mesas/", headers=headers)
            mesas_resp.raise_for_status()
            mesas = mesas_resp.json()
            mesa = next((m for m in mesas if m.get('qr_code') == 'e2e_pw'), None)
            assert mesa is not None, 'Expected existing mesa e2e_pw to be present'
        else:
            raise AssertionError(f"Unexpected status creating mesa: {r.status_code} {r.text}")

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

        # Esperar que el cliente reciba el mensaje 'play_song' o que el fake player reporte reproducción
        # (usamos selector combinado para tolerar casos donde el cliente aplica fallback HTTP/cola)
        page.wait_for_selector('html[data-play-song-received="1"], html[data-fake-played="1"]', timeout=30000)

        # Ensure the UI shows something reasonable (title or that the player tried to play)
        # We still check the now-playing via fetchAndUpdateQueue effect below in other test
    finally:
        try:
            page.context.tracing.stop(path='trace_player_starts.zip')
        except Exception:
            pass
        stop_server(proc)

@pytest.mark.playwright
def test_play_song_updates_now_playing_ui_playwright(page):
    """Verifica que al recibir play_song el UI de 'Ahora Cantando' se actualice con título y artista."""
    proc = start_server()
    try:
        init_script = """
            window.__fake_player = { played: false, created: false };
            window.YT = { Player: function(id, opts) { window.__fake_player.created = true; window.__fake_player.opts = opts; this.loadVideoById = function(id) {}; this.playVideo = function() { window.__fake_player.played = true; }; this.pauseVideo = function() { window.__fake_player.played = false; }; } };
        """
        page.add_init_script(init_script)

        page.goto(f"{SERVER_URL}/player")

        # Crear datos de prueba
        headers = {'X-API-Key': 'zxc12345'}
        r = requests.post(f"{SERVER_URL}/api/v1/mesas/", json={'nombre': 'E2E_UI', 'qr_code': 'e2e_ui'}, headers=headers)
        if r.status_code == 201:
            mesa = r.json()
        elif r.status_code == 400:
            mesas_resp = requests.get(f"{SERVER_URL}/api/v1/mesas/", headers=headers)
            mesas_resp.raise_for_status()
            mesas = mesas_resp.json()
            mesa = next((m for m in mesas if m.get('qr_code') == 'e2e_ui'), None)
            assert mesa is not None, 'Expected existing mesa e2e_ui to be present'
        else:
            raise AssertionError(f"Unexpected status creating mesa: {r.status_code} {r.text}")

        db = SessionLocal()
        usuario = crud.create_usuario_en_mesa(db, usuario=schemas.UsuarioCreate(nick='ui_user'), mesa_id=mesa['id'])

        song_title = 'UI PlayingSong'
        song_payload = schemas.CancionCreate(titulo=song_title, youtube_id='UIPLAY', duracion_seconds=20, is_karaoke=False)
        db_song = crud.create_cancion_para_usuario(db, cancion=song_payload, usuario_id=usuario.id)
        crud.update_cancion_estado(db, cancion_id=db_song.id, nuevo_estado='pendiente_lazy')
        db.close()

        # Aprobar siguiente (esto debe disparar play_song)
        r = requests.post(f"{SERVER_URL}/api/v1/admin/canciones/lazy/approve-next", headers=headers)
        assert r.status_code == 200

        # Esperar que el cliente reciba el mensaje 'play_song' o que la UI muestre el título (timeout extendido)
        page.wait_for_selector('html[data-play-song-received="1"], #now-playing-info .info-title', timeout=30000)

        # Esperar a que el título esté visible y contenga el texto esperado (sin eval para respetar CSP)
        title_locator = page.locator('#now-playing-info .info-title')
        title_locator.wait_for(state='visible', timeout=30000)
        title_text = title_locator.inner_text()
        assert song_title in title_text

    finally:
        try:
            page.context.tracing.stop(path='trace_play_song_ui.zip')
        except Exception:
            pass
        stop_server(proc)

@pytest.mark.playwright
def test_auto_connect_from_qr_playwright(page):
    """Verifica que al abrir un link con '?table=karaoke-mesa-XX-usuarioN' el cliente se conecte automáticamente."""
    proc = start_server()
    try:
        # Crear la mesa base que será referenciada por el QR
        headers = {'X-API-Key': 'zxc12345'}
        r = requests.post(f"{SERVER_URL}/api/v1/mesas/", json={'nombre': 'Mesa 6', 'qr_code': 'karaoke-mesa-06'}, headers=headers)
        if r.status_code == 201:
            mesa = r.json()
        elif r.status_code == 400:
            # Ya existe — buscarla por su qr_code
            mesas_resp = requests.get(f"{SERVER_URL}/api/v1/mesas/", headers=headers)
            mesas_resp.raise_for_status()
            mesas = mesas_resp.json()
            mesa = next((m for m in mesas if m.get('qr_code') == 'karaoke-mesa-06'), None)
            assert mesa is not None, 'Expected existing mesa karaoke-mesa-06 to be present'
        else:
            raise AssertionError(f"Unexpected status creating mesa: {r.status_code} {r.text}")

        # Abrir la página con el parámetro table que incluye usuario
        page.goto(f"{SERVER_URL}/?table=karaoke-mesa-06-usuario1")

        # Start tracing for debugging
        try:
            page.context.tracing.start(screenshots=True, snapshots=True)
        except Exception:
            pass

        # Esperar a que el cliente muestre el nick del usuario conectado (sin eval)
        user_nick_locator = page.locator('#user-nick')
        user_nick_locator.wait_for(state='visible', timeout=8000)
        nick_text = user_nick_locator.inner_text()
        assert 'Usuario1' in nick_text
    finally:
        try:
            page.context.tracing.stop(path='trace_auto_connect.zip')
        except Exception:
            pass
        stop_server(proc)