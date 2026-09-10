#!/usr/bin/env python3
"""
My Qr Music Player 2 - Native WebView Player using PyWebView.
Strategy: Native OS WebView (Edge Chromium / WebView2) in absolute fullscreen.
This completely hides URL bars, borders, and avoids YouTube's anti-bot detection.
"""

import sys
import json
import time
import threading
import urllib.request
import argparse
import logging

try:
    import webview
except ImportError:
    print("[ERROR] 'pywebview' is not installed.")
    print("[INFO] Please run: pip install pywebview websockets")
    sys.exit(1)

try:
    import websockets
except ImportError:
    print("[ERROR] 'websockets' is not installed.")
    print("[INFO] Please run: pip install websockets")
    sys.exit(1)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("MyQrMusicPlayer2")

# Parser CLI
parser = argparse.ArgumentParser(description="My Qr Music Native Player 2")
parser.add_argument("--server", default="http://localhost:8000", help="HTTP Server URL")
parser.add_argument("--ws", default="ws://localhost:8000/ws/cola", help="WebSocket Server URL")
parser.add_argument("--local", default=None, help="Local ID or Slug")
parser.add_argument("--dry-run", action="store_true", help="Test dependencies and exit")
args = parser.parse_args()

if args.dry_run:
    print("[OK] All dependencies checked. Dry-run successful.")
    sys.exit(0)

SERVER_URL = args.server.rstrip("/")
WS_URL = args.ws
LOCAL_PARAM = args.local

if LOCAL_PARAM:
    sep = "&" if "?" in WS_URL else "?"
    WS_URL += f"{sep}local={LOCAL_PARAM}"

window = None


class PlayerAPI:
    """Python API exposed to Javascript context"""
    def on_video_ended(self):
        print(f"[INFO] Video ended callback received (local={LOCAL_PARAM}). Promoting next song...")
        # Trigger next song via FastAPI endpoint
        def trigger():
            try:
                next_url = f"{SERVER_URL}/api/v1/canciones/siguiente"
                if LOCAL_PARAM:
                    next_url += f"?local_id={LOCAL_PARAM}"
                req = urllib.request.Request(
                    next_url,
                    method="POST"
                )
                with urllib.request.urlopen(req) as response:
                    res_data = response.read().decode("utf-8")
                    print(f"[INFO] Next song response: {res_data[:100]}")
            except Exception as e:
                print("[ERROR] Error promoting next song:", e)
        
        # Run in separate thread to avoid blocking JS
        threading.Thread(target=trigger, daemon=True).start()


def on_loaded():
    """Injected when page loads. Sets up styles, watermark, bottom overlay, and ad blockers."""
    js_code = """
        (function() {
            console.log("[PLAYER 2] Initializing My Qr Music WebView daemon...");

            // CSS injection compatible with YouTube's strict TrustedHTML policy.
            const injectStyles = () => {
                const styleId = 'qrmusic-player-styles';
                let style = document.getElementById(styleId);
                if (!style && document.head) {
                    // Import modern typography from Google Fonts
                    const fontLink = document.createElement('link');
                    fontLink.rel = 'stylesheet';
                    fontLink.href = 'https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;800&display=swap';
                    document.head.appendChild(fontLink);

                    style = document.createElement('style');
                    style.id = styleId;
                    const cssText = `
                        body, html {
                            overflow: hidden !important;
                            cursor: none !important;
                            background: #000000 !important;
                            width: 100vw !important;
                            height: 100vh !important;
                            margin: 0 !important;
                            padding: 0 !important;
                        }
                        /* Force the active player and video elements to cover the entire viewport */
                        #movie_player, 
                        .html5-video-player, 
                        .html5-main-video {
                            position: fixed !important;
                            top: 0 !important;
                            left: 0 !important;
                            width: 100vw !important;
                            height: 100vh !important;
                            z-index: 9999999 !important;
                            background: #000000 !important;
                        }
                        /* Hide navigation, sidebars, banner ads, and layout containers */
                        #masthead-container,
                        #columns #secondary,
                        #comments,
                        .ytp-cards-button,
                        .ytp-show-cards-title,
                        #meta,
                        #info,
                        ytd-merch-shelf-renderer,
                        #chat-container,
                        ytd-live-chat-frame,
                        ytd-popup-container,
                        .ytp-ce-element,
                        .ytp-ad-overlay-container,
                        .ytp-ad-overlay-image,
                        .ytp-ad-overlay-close-container,
                        .ytp-ad-overlay-slot,
                        .ytp-ad-message-container,
                        .ytp-ad-text-overlay,
                        .video-ads,
                        .ytp-ad-module {
                            display: none !important;
                        }
                        /* Style for the translucent glowing watermark logo */
                        #qrmusic-watermark {
                            position: fixed !important;
                            top: 25px !important;
                            right: 25px !important;
                            width: 110px !important;
                            height: 110px !important;
                            z-index: 1000000000 !important;
                            opacity: 1 !important;
                            pointer-events: none !important;
                            border-radius: 50% !important;
                            border: 4px solid rgba(157, 78, 221, 0.5) !important;
                            box-shadow: 0 0 35px rgba(128, 0, 128, 0.5) !important;
                        }
                        /* BLOQUE IZQUIERDO: SONANDO AHORA (Alineado a la izquierda) */
                        #qrmusic-now-playing-box {
                            position: fixed !important;
                            bottom: 35px !important;
                            left: 40px !important;
                            max-width: 46vw !important;
                            min-width: 380px !important;
                            z-index: 1000000000 !important;
                            background: rgba(10, 8, 24, 0.88) !important;
                            backdrop-filter: blur(16px) !important;
                            border: 2.5px solid rgba(157, 78, 221, 0.5) !important;
                            border-radius: 22px !important;
                            padding: 18px 28px !important;
                            box-shadow: 0 15px 50px rgba(0, 0, 0, 0.75), 0 0 30px rgba(157, 78, 221, 0.25) !important;
                            color: #ffffff !important;
                            font-family: 'Outfit', sans-serif !important;
                            pointer-events: none !important;
                            box-sizing: border-box !important;
                            display: flex !important;
                            flex-direction: column !important;
                            text-align: left !important;
                            opacity: 0 !important;
                            transform: translateY(35px) scale(0.96) !important;
                            transition: opacity 0.8s cubic-bezier(0.2, 0.8, 0.2, 1), transform 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) !important;
                        }

                        #qrmusic-now-playing-box.show {
                            opacity: 1 !important;
                            transform: translateY(0) scale(1) !important;
                        }

                        /* BLOQUE DERECHO: SIGUIENTE EN COLA (Alineado a la derecha) */
                        #qrmusic-next-song-box {
                            position: fixed !important;
                            bottom: 35px !important;
                            right: 40px !important;
                            max-width: 46vw !important;
                            min-width: 380px !important;
                            z-index: 1000000000 !important;
                            background: rgba(10, 8, 24, 0.88) !important;
                            backdrop-filter: blur(16px) !important;
                            border: 2.5px solid rgba(76, 201, 240, 0.5) !important;
                            border-radius: 22px !important;
                            padding: 18px 28px !important;
                            box-shadow: 0 15px 50px rgba(0, 0, 0, 0.75), 0 0 30px rgba(76, 201, 240, 0.25) !important;
                            color: #ffffff !important;
                            font-family: 'Outfit', sans-serif !important;
                            pointer-events: none !important;
                            box-sizing: border-box !important;
                            display: flex !important;
                            flex-direction: column !important;
                            text-align: right !important;
                            opacity: 0 !important;
                            transform: translateY(35px) scale(0.96) !important;
                            transition: opacity 0.8s cubic-bezier(0.2, 0.8, 0.2, 1), transform 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) !important;
                        }

                        #qrmusic-next-song-box.show {
                            opacity: 1 !important;
                            transform: translateY(0) scale(1) !important;
                        }

                        /* Tipografía Duplicada (2x) para Pantalla Gigante (100") */
                        .qrmusic-box-label {
                            font-size: 20px !important;
                            text-transform: uppercase !important;
                            letter-spacing: 3px !important;
                            font-weight: 800 !important;
                            margin-bottom: 4px !important;
                        }
                        .qrmusic-box-label-now {
                            color: #c77dff !important;
                            text-align: left !important;
                        }
                        .qrmusic-box-label-next {
                            color: #4cc9f0 !important;
                            text-align: right !important;
                        }
                        .qrmusic-box-title {
                            font-size: 32px !important;
                            font-weight: 800 !important;
                            color: #ffffff !important;
                            text-overflow: ellipsis !important;
                            overflow: hidden !important;
                            white-space: nowrap !important;
                            line-height: 1.25 !important;
                        }
                        .qrmusic-box-user {
                            font-size: 22px !important;
                            font-weight: 600 !important;
                            color: #a29bfe !important;
                            margin-top: 4px !important;
                            text-overflow: ellipsis !important;
                            overflow: hidden !important;
                            white-space: nowrap !important;
                        }
                    `;
                    style.appendChild(document.createTextNode(cssText));
                    document.head.appendChild(style);
                }
            };

            // Watermark element injection
            const injectWatermark = () => {
                const watermarkId = 'qrmusic-watermark';
                let img = document.getElementById(watermarkId);
                if (!img && document.body) {
                    img = document.createElement('img');
                    img.id = watermarkId;
                    img.src = '{{SERVER_URL}}/static/images/watermark.jpg';
                    document.body.appendChild(img);
                }
            };

            // Bottom 2 boxes element injection
            const injectBottomBoxes = () => {
                if (!document.getElementById('qrmusic-now-playing-box') && document.body) {
                    const nowBox = document.createElement('div');
                    nowBox.id = 'qrmusic-now-playing-box';
                    nowBox.innerHTML = `
                        <div class="qrmusic-box-label qrmusic-box-label-now">🎵 Sonando Ahora</div>
                        <div id="qrmusic-current-song" class="qrmusic-box-title">Cargando catálogo...</div>
                        <div id="qrmusic-current-user" class="qrmusic-box-user"></div>
                    `;
                    document.body.appendChild(nowBox);
                }

                if (!document.getElementById('qrmusic-next-song-box') && document.body) {
                    const nextBox = document.createElement('div');
                    nextBox.id = 'qrmusic-next-song-box';
                    nextBox.innerHTML = `
                        <div class="qrmusic-box-label qrmusic-box-label-next">⏭️ Siguiente en Cola</div>
                        <div id="qrmusic-next-song" class="qrmusic-box-title">Esperando pedidos...</div>
                        <div id="qrmusic-next-user" class="qrmusic-box-user"></div>
                    `;
                    document.body.appendChild(nextBox);
                }
            };

            // Expose global updater function to window context
            window.updateOverlay = (data) => {
                const currentEl = document.getElementById('qrmusic-current-song');
                const nextEl = document.getElementById('qrmusic-next-song');
                const currentUserEl = document.getElementById('qrmusic-current-user');
                const nextUserEl = document.getElementById('qrmusic-next-user');
                if (currentEl && data.current) currentEl.textContent = data.current;
                if (nextEl && data.next) nextEl.textContent = data.next;
            };

            // Ad Evasion & Fullscreen monitor loop (50ms interval)
            setInterval(() => {
                if (document.head) injectStyles();
                if (document.body) {
                    injectWatermark();
                    injectBottomBoxes();
                }

                const player = document.getElementById('movie_player') || document.querySelector('.html5-video-player');
                const adActive = isAdActive();
                const videos = document.querySelectorAll('video');

                // Helper to check for active ads (DOM & Player API)
                function isAdActive() {
                    if (player) {
                        if (player.classList.contains('ad-showing') || player.classList.contains('ad-interrupting')) {
                            return true;
                        }
                        if (typeof player.getAdState === 'function' && player.getAdState() > 0) {
                            return true;
                        }
                    }
                    if (document.querySelector('.ad-showing, .ad-interrupting, .ytp-ad-player-overlay, .ytp-ad-player-overlay-layout')) {
                        return true;
                    }
                    const videoAds = document.querySelector('.video-ads, .ytp-ad-module');
                    if (videoAds && videoAds.children.length > 0) {
                        return true;
                    }
                    if (document.querySelector('[class*="ytp-ad-skip-button"], [class*="ytp-skip-ad-button"]')) {
                        return true;
                    }
                    return false;
                }

                if (adActive) {
                    console.log("[PLAYER 2] Ad active, bypassing...");
                    
                    // 1. Skip via Player API
                    if (player && typeof player.skipAd === 'function') {
                        try { player.skipAd(); } catch(e) {}
                    }

                    // 2. Click skip buttons
                    const skipSelectors = ['.ytp-ad-skip-button', '.ytp-skip-ad-button', '.ytp-ad-survey-skip-button'];
                    for (const s of skipSelectors) {
                        const btn = document.querySelector(s);
                        if (btn) {
                            try {
                                btn.click();
                                btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                            } catch(e) {}
                        }
                    }

                    // 3. Fast-forward ALL video elements (handles ads in secondary elements)
                    videos.forEach(v => {
                        try {
                            v.muted = true;
                            v.playbackRate = 16;
                            // Safe seek to end of the video
                            if (isFinite(v.duration) && v.duration > 0) {
                                if (v.currentTime < v.duration - 0.2) {
                                    v.currentTime = v.duration - 0.1;
                                }
                            } else {
                                v.currentTime = 9999;
                            }
                        } catch(err) {
                            // Safe catch if range error is thrown
                        }
                    });
                } else {
                    // Restore normal speed on all active videos
                    videos.forEach(v => {
                        if (v.playbackRate > 2) {
                            v.playbackRate = 1;
                            v.muted = false;
                        }
                    });
                }

                // Keep video playing (Autoplay guard)
                const playBtn = document.querySelector('.ytp-play-button');
                if (playBtn && playBtn.getAttribute('aria-label') === 'Reproducir') {
                    playBtn.click();
                }

                // Hook Ended Event on all video elements
                videos.forEach(v => {
                    if (!v._hasQrEndedListener) {
                        v._hasQrEndedListener = true;
                        v.addEventListener('ended', () => {
                            console.log("[PLAYER 2] Video tag ended. Notifying Python...");
                            window.pywebview.api.on_video_ended();
                        });
                    }
                });

                // Update box visibility timed
                const v = document.querySelector('video');
                const nowBox = document.getElementById('qrmusic-now-playing-box');
                const nextBox = document.getElementById('qrmusic-next-song-box');
                if (nowBox && nextBox) {
                    if (!v || isNaN(v.currentTime) || v.paused) {
                        nowBox.classList.remove('show');
                        nextBox.classList.remove('show');
                    } else {
                        const t = v.currentTime;
                        const d = v.duration;
                        let show = (t <= 10.0);
                        if (d && d > 20.0) {
                            const mid = d / 2.0;
                            if ((t >= (mid - 5.0) && t <= (mid + 5.0)) || (t >= (d - 20.0) && t <= (d - 10.0))) {
                                show = true;
                            }
                        }
                        if (show) {
                            nowBox.classList.add('show');
                            nextBox.classList.add('show');
                        } else {
                            nowBox.classList.remove('show');
                            nextBox.classList.remove('show');
                        }
                    }
                }
            }, 50);
        })();
    """
    try:
        window.evaluate_js(js_code.replace("{{SERVER_URL}}", SERVER_URL))
    except Exception as e:
        print("[WARNING] Could not inject JS daemon:", e)


def start_websocket_thread():
    """Start the websocket connection in a separate asyncio event loop"""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    loop.run_until_complete(websocket_loop())


async def websocket_loop():
    while True:
        try:
            print(f"[INFO] Connecting to WebSocket: {WS_URL}")
            async with websockets.connect(WS_URL) as ws:
                print("[INFO] WebSocket connected successfully.")
                async for message in ws:
                    try:
                        data = json.loads(message)
                        if data.get("type") == "play_song":
                            payload = data.get("payload") or {}
                            youtube_id = payload.get("youtube_id")
                            if youtube_id:
                                url = f"https://www.youtube.com/watch?v={youtube_id}"
                                print(f"[INFO] Playing video: {url}")
                                window.load_url(url)

                        elif data.get("type") == "pause_playback":
                            print("[INFO] Pause command")
                            window.evaluate_js("document.querySelector('video')?.pause()")

                        elif data.get("type") == "resume_playback":
                            print("[INFO] Resume command")
                            window.evaluate_js("document.querySelector('video')?.play()")

                        elif data.get("type") == "restart_song":
                            print("[INFO] Restart command")
                            window.evaluate_js("const v = document.querySelector('video'); if (v) v.currentTime = 0;")
                    except Exception as parse_err:
                        print("[ERROR] WebSocket parse error:", parse_err)
        except Exception as ws_err:
            print("[WARNING] WebSocket disconnected, retrying in 3 seconds...", ws_err)
            await asyncio.sleep(3)


def start_queue_fetcher():
    """Fetch queue status from backend every 3 seconds to keep overlay updated"""
    while True:
        try:
            req = urllib.request.Request(f"{SERVER_URL}/api/v1/canciones/cola/extended")
            with urllib.request.urlopen(req) as response:
                data = json.loads(response.read().decode("utf-8"))
                
                # Current song text
                current_text = "Ninguna canción en reproducción"
                now_playing = data.get("now_playing")
                if now_playing:
                    current_text = f"{now_playing.get('titulo')} - {now_playing.get('artista')}"
                    if now_playing.get('usuario_nick'):
                        current_text += f" (Pedida por: {now_playing.get('usuario_nick')})"
                
                # Next song text
                next_text = "No hay más canciones en cola"
                upcoming = data.get("upcoming", [])
                lazy = data.get("lazy_queue", [])
                if upcoming:
                    next_text = f"{upcoming[0].get('titulo')} - {upcoming[0].get('artista')}"
                elif lazy:
                    next_text = f"{lazy[0].get('titulo')} - {lazy[0].get('artista')}"
                
                overlay_data = {
                    "current": current_text,
                    "next": next_text
                }
                
                # Safely update variables in WebView JS context
                if window:
                    js_call = f"if (window.updateOverlay) {{ window.updateOverlay({json.dumps(overlay_data)}); }}"
                    window.evaluate_js(js_call)
        except Exception as e:
            # Silent warning to prevent terminal cluttering
            pass
        time.sleep(3)


if __name__ == "__main__":
    print("[INFO] Initializing PyWebView Window...")
    
    # 1. Create the native GUI window in full screen
    window = webview.create_window(
        title="My Qr Music Native Player 2",
        url="https://www.youtube.com",
        js_api=PlayerAPI(),
        fullscreen=True,
    )

    # 2. Hook loaded event
    window.events.loaded += on_loaded

    # 3. Start WebSocket listener thread in background
    threading.Thread(target=start_websocket_thread, daemon=True).start()

    # 4. Start the background queue status poller
    threading.Thread(target=start_queue_fetcher, daemon=True).start()

    # 5. Start the native GUI window loop (blocks the main thread)
    webview.start()
    print("[INFO] Player closed.")
