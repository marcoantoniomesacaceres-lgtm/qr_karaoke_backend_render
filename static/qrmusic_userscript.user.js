// ==UserScript==
// @name         My Qr Music TV Player 2
// @namespace    http://tampermonkey.net/
// @version      7.2
// @description  Integración de My Qr Music con YouTube. Soporte Multi-Local, Pantalla Completa Permanente sin Recargas, Paneles Temporizados y Reacciones.
// @author       Antigravity
// @match        https://www.youtube.com/*
// @match        https://youtube.com/*
// @include      http://localhost:*/*
// @include      http://127.0.0.1:*/*
// @include      http://192.168.*:*/*
// @include      http://172.*:*/*
// @include      http://10.*:*/*
// @include      *://*/player2*
// @include      *://*/*player2*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // 0. Evitar la ejecución del script en iframes secundarias
    if (window.self !== window.top) {
        return;
    }

    // 1. Configurar política TrustedTypes para evadir la seguridad estricta CSP de YouTube
    let policy = {
        createHTML: (s) => s
    };
    if (window.trustedTypes && window.trustedTypes.createPolicy) {
        try {
            policy = window.trustedTypes.createPolicy('qrmusic', {
                createHTML: (string) => string
            });
        } catch (e) {
            console.warn("[My Qr Music] No se pudo crear la política TrustedTypes (usando fallback):", e);
        }
    }

    try {
        console.log("%c[My Qr Music] !!! SCRIPT INICIALIZADO Y ACTIVO (v7.2 - Fullscreen Permanente & Paneles Temporizados) !!!", "color: #9d4edd; font-size: 16px; font-weight: bold;");

        // 1. Configuración de IP/Host y Sede de My Qr Music
        let qrmusicHost = localStorage.getItem("qrmusic_host") || "localhost:8000";
        let qrmusicLocalId = localStorage.getItem("qrmusic_local_id") || "";

        // Determinar dinámicamente si usar HTTPS/WSS (para producción) o HTTP/WS (para desarrollo local)
        const getHttpProto = () => {
            const hostLower = qrmusicHost.toLowerCase();
            const isLocal = hostLower.startsWith("localhost") || 
                            hostLower.startsWith("127.0.0.1") || 
                            hostLower.startsWith("192.168.") ||
                            hostLower.startsWith("172.") ||
                            hostLower.startsWith("10.");
            return isLocal ? "http" : "https";
        };

        const getWsProto = () => {
            const hostLower = qrmusicHost.toLowerCase();
            const isLocal = hostLower.startsWith("localhost") || 
                            hostLower.startsWith("127.0.0.1") || 
                            hostLower.startsWith("192.168.") ||
                            hostLower.startsWith("172.") ||
                            hostLower.startsWith("10.");
            return isLocal ? "ws" : "wss";
        };

        let ownerLogoUrl = `${getHttpProto()}://${qrmusicHost}/static/images/watermark.jpg`; // Fallback inicial
        let localLogoUrl = null;
        let localNombre = "";

        // Si estamos en la página de setup local, marcamos como instalado y sincronizamos
        const isPlayer2Page = window.location.pathname.includes('/player2') || window.location.pathname.includes('player2.html');
        if (isPlayer2Page) {
            const currentHost = window.location.host;
            if (currentHost && currentHost !== qrmusicHost) {
                qrmusicHost = currentHost;
                localStorage.setItem("qrmusic_host", currentHost);
            }
            const urlParams = new URLSearchParams(window.location.search);
            const paramLocal = urlParams.get('local') || urlParams.get('slug') || urlParams.get('local_id');
            if (paramLocal) {
                qrmusicLocalId = paramLocal;
                localStorage.setItem("qrmusic_local_id", paramLocal);
            }
            document.body.dataset.qrmusicInstalled = "true";
        }

        // Listener global de teclado (CTRL+SHIFT+H) para configurar servidor y sede directamente en YouTube
        window.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'h') {
                const input = prompt(
                    "Configure la URL o Host del servidor My Qr Music:\n" +
                    "(Ejemplos: 'localhost:8000?local=1', '192.168.1.50:8000', o 'http://miservidor.com?local=sede-norte')",
                    qrmusicLocalId ? `${qrmusicHost}?local=${qrmusicLocalId}` : qrmusicHost
                );
                if (input !== null && input.trim()) {
                    let cleanInput = input.trim();
                    let parsedHost = cleanInput;
                    let parsedLocal = null;

                    // Si es una URL completa con protocolo o query string
                    try {
                        let urlToParse = cleanInput;
                        if (!urlToParse.startsWith('http://') && !urlToParse.startsWith('https://')) {
                            urlToParse = 'http://' + urlToParse;
                        }
                        const parsed = new URL(urlToParse);
                        parsedHost = parsed.host;
                        parsedLocal = parsed.searchParams.get('local') || parsed.searchParams.get('slug') || parsed.searchParams.get('local_id');
                    } catch (e) {
                        // Fallback manual si no parsea como URL estricta
                        if (cleanInput.includes('?')) {
                            const parts = cleanInput.split('?');
                            parsedHost = parts[0].replace(/^https?:\/\//i, '').replace(/\/+$/, '');
                            const qParams = new URLSearchParams(parts[1]);
                            parsedLocal = qParams.get('local') || qParams.get('slug') || qParams.get('local_id');
                        } else {
                            parsedHost = cleanInput.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
                        }
                    }

                    if (parsedHost) {
                        localStorage.setItem("qrmusic_host", parsedHost);
                    }

                    // Si no venía parámetro en la URL, preguntarlo específicamente
                    if (parsedLocal !== null) {
                        localStorage.setItem("qrmusic_local_id", parsedLocal);
                    } else {
                        const newLocal = prompt("Configure la Sede (ID o Slug del local) para este TV:", qrmusicLocalId || "");
                        if (newLocal !== null) {
                            localStorage.setItem("qrmusic_local_id", newLocal.trim());
                        }
                    }

                    alert(`Ajustes guardados:\n• Servidor: ${localStorage.getItem("qrmusic_host")}\n• Sede: ${localStorage.getItem("qrmusic_local_id") || "General"}\nRecargando pantalla...`);
                    window.location.reload();
                }
            }
        });

        // Cargar configuraciones públicas (Logo del Dueño / Sede / Nombre de la App)
        const fetchOwnerSettings = () => {
            const proto = getHttpProto();
            let settingsUrl = `${proto}://${qrmusicHost}/api/v1/player2/settings`;
            if (qrmusicLocalId) {
                settingsUrl += `?${isNaN(qrmusicLocalId) ? 'slug=' : 'local_id='}${encodeURIComponent(qrmusicLocalId)}`;
            }
            fetch(settingsUrl)
                .then(res => res.json())
                .then(data => {
                    if (data.owner_logo) {
                        ownerLogoUrl = data.owner_logo.startsWith('http') ? data.owner_logo : `${proto}://${qrmusicHost}${data.owner_logo}`;
                        console.log("[My Qr Music] Logo corporativo / sede cargado:", ownerLogoUrl);
                    }
                    if (data.local_logo) {
                        localLogoUrl = data.local_logo.startsWith('http') ? data.local_logo : `${proto}://${qrmusicHost}${data.local_logo}`;
                    }
                    if (data.local_nombre) {
                        localNombre = data.local_nombre;
                    }

                    // Actualizar logo en la pantalla de bienvenida
                    const logoWelcome = document.getElementById('owner-logo-welcome');
                    if (logoWelcome) logoWelcome.src = localLogoUrl || ownerLogoUrl;
                    
                    // Actualizar logo en el indicador gráfico de estado
                    const logoIndicator = document.querySelector('#qrmusic-status-indicator .status-indicator-img');
                    if (logoIndicator) logoIndicator.src = localLogoUrl || ownerLogoUrl;

                    // Actualizar logo en la cortina de transición
                    const logoCurtain = document.querySelector('#qrmusic-curtain-screen .curtain-logo-img');
                    if (logoCurtain) logoCurtain.src = localLogoUrl || ownerLogoUrl;

                    // Actualizar logo del local si existe elemento
                    const localLogoEl = document.getElementById('qrmusic-local-logo');
                    if (localLogoEl && (localLogoUrl || ownerLogoUrl)) {
                        localLogoEl.src = localLogoUrl || ownerLogoUrl;
                    }
                })
                .catch(err => console.warn("[My Qr Music] Error cargando logo corporativo del dueño:", err));
        };
        fetchOwnerSettings();

        // Mapa de emojis a imágenes de Twemoji CDN (Twitter Open Source Emojis)
        const emojiImages = {
            "👏": "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f44f.png",
            "❤️": "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/2764.png",
            "💔": "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f494.png",
            "😈": "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f608.png",
            "😳": "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f633.png",
            "😢": "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f622.png",
            "🙈": "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f648.png",
            "🍻": "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f37b.png",
            "🤩": "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f929.png",
            "🔥": "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f525.png",
            "👍": "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f44d.png",
            "😀": "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f600.png"
        };

        const getEmojiImgUrl = (emoji) => {
            if (emojiImages[emoji]) {
                return emojiImages[emoji];
            }
            const cleanEmoji = emoji.replace(/\uFE0F/g, '');
            if (emojiImages[cleanEmoji]) {
                return emojiImages[cleanEmoji];
            }
            try {
                let codePoints = [];
                for (let char of cleanEmoji) {
                    const cp = char.codePointAt(0);
                    if (cp) codePoints.push(cp.toString(16));
                }
                const hex = codePoints.join('-');
                if (hex) {
                    return `https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/${hex}.png`;
                }
            } catch(e) {}
            return null;
        };

        // 2. Módulo de Reacciones (Emojis flotantes basados en imágenes)
        const setupReactions = () => {
            if (isPlayer2Page) {
                console.log("[My Qr Music SetupReactions] Omitiendo setup en página de vinculación.");
                return;
            }
            if (!document.head || !document.body) {
                console.log("[My Qr Music SetupReactions] document.head o document.body son nulos. Reintentando luego.");
                return;
            }

            try {
                // Inyectar estilos específicos de reacciones (se remueve !important de bottom en .reaction-emoji para permitir animación)
                const styleId = 'qrmusic-reaction-styles';
                if (!document.getElementById(styleId)) {
                    console.log("[My Qr Music SetupReactions] Inyectando hoja de estilos para reacciones flotantes...");
                    const style = document.createElement('style');
                    style.id = styleId;
                    const cssText = `
                        #qrmusic-reaction-container {
                            position: absolute !important;
                            top: 0 !important;
                            left: 0 !important;
                            width: 100% !important;
                            height: 100% !important;
                            pointer-events: none !important;
                            z-index: 2000000000 !important;
                            overflow: hidden !important;
                            display: block !important;
                            visibility: visible !important;
                        }
                        @-webkit-keyframes floatUp {
                            0% {
                                bottom: -120px;
                                opacity: 0;
                            }
                            15% {
                                opacity: 0.95;
                            }
                            85% {
                                opacity: 0.95;
                            }
                            100% {
                                bottom: 95%;
                                opacity: 0;
                            }
                        }
                        @keyframes floatUp {
                            0% {
                                bottom: -120px;
                                opacity: 0;
                            }
                            15% {
                                opacity: 0.95;
                            }
                            85% {
                                opacity: 0.95;
                            }
                            100% {
                                bottom: 95%;
                                opacity: 0;
                            }
                        }
                        .reaction-emoji {
                            position: absolute !important;
                            bottom: -120px; /* <--- SIN !important para permitir la animación de bottom */
                            z-index: 2000000000 !important;
                            pointer-events: none !important;
                            -webkit-animation: floatUp 5.8s ease-out forwards !important;
                            animation: floatUp 5.8s ease-out forwards !important;
                            display: block !important;
                            width: 80px !important;
                            height: 80px !important;
                        }
                    `;
                    style.appendChild(document.createTextNode(cssText));
                    document.head.appendChild(style);
                    console.log("[My Qr Music SetupReactions] Hoja de estilos inyectada con éxito.");
                }

                // Determinar el padre destino correcto: el reproductor de YouTube si existe, de lo contrario body.
                const targetParent = document.getElementById('movie_player') || document.body;
                let container = document.getElementById('qrmusic-reaction-container');

                // Si el contenedor existe pero está colocado en el padre incorrecto (por cache de SPA), recolocarlo.
                if (container && container.parentNode !== targetParent) {
                    console.log("[My Qr Music SetupReactions] Recolocando contenedor en el padre correcto (movie_player)...");
                    container.remove();
                    container = null;
                }

                // Inyectar contenedor si no existe
                if (!container) {
                    console.log("[My Qr Music SetupReactions] Creando y añadiendo contenedor #qrmusic-reaction-container...");
                    const rc = document.createElement('div');
                    rc.id = 'qrmusic-reaction-container';
                    targetParent.appendChild(rc);
                    console.log("[My Qr Music SetupReactions] Contenedor añadido con éxito a:", targetParent.id || "body");
                }
            } catch (err) {
                console.error("[My Qr Music SetupReactions] Error crítico en setupReactions:", err);
            }
        };

        // Indicador gráfico de estado en la parte superior izquierda (con versión y check/x)
        const updateStatusIndicator = (isConnected) => {
            if (isPlayer2Page) return;
            
            // Asegurar indicador gráfico en la parte superior izquierda
            let indicator = document.getElementById('qrmusic-status-indicator');
            if (!indicator) {
                indicator = document.createElement('div');
                indicator.id = 'qrmusic-status-indicator';
                indicator.innerHTML = policy.createHTML(`
                    <img class="status-indicator-img" src="${ownerLogoUrl}" />
                    <div class="status-indicator-badge"></div>
                    <div class="status-indicator-version">v6.7</div>
                `);
                document.body.appendChild(indicator);
            }

            // Manejador de click en el indicador para re-configurar el host en caliente en la Smart TV
            if (!indicator.dataset.hasClickListener) {
                indicator.dataset.hasClickListener = "true";
                indicator.style.cursor = "pointer";
                indicator.title = "Haz click aquí para configurar el servidor My Qr Music";
                indicator.addEventListener('click', () => {
                    const newHost = prompt("Introduce la dirección (host/IP) del servidor My Qr Music (ej: qr-karaoke-backend-render-pb3m.onrender.com):", qrmusicHost);
                    if (newHost !== null) {
                        const cleanHost = newHost.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
                        if (cleanHost) {
                            localStorage.setItem("qrmusic_host", cleanHost);
                            alert("Servidor actualizado a: " + cleanHost + ". Recargando página...");
                            window.location.reload();
                        }
                    }
                });
            }

            // Forzar actualización de la imagen si cambia
            const img = indicator.querySelector('.status-indicator-img');
            if (img && img.getAttribute('src') !== ownerLogoUrl) {
                img.src = ownerLogoUrl;
            }

            // Actualizar el estado del badge de conexión en la parte inferior derecha
            const badge = indicator.querySelector('.status-indicator-badge');
            if (badge) {
                if (isConnected) {
                    badge.className = 'status-indicator-badge connected';
                    badge.textContent = '✔';
                } else {
                    badge.className = 'status-indicator-badge disconnected';
                    badge.textContent = '✖';
                }
            }
        };

        // 3. Control de Estado Ocioso (espera) y determinación de vista
        let isIdleMode = false;

        const isIdle = () => {
            if (isPlayer2Page) return true;
            return isIdleMode || window.location.pathname === '/' || window.location.pathname === '/index.html' || window.location.pathname === '';
        };

        const isHomePath = () => isIdle();

        // 4. Inyectar estilos globales
        const injectStyles = () => {
            if (isPlayer2Page) return;
            const styleId = 'qrmusic-player-styles';
            if (document.getElementById(styleId)) return;
            
            const fontLink = document.createElement('link');
            fontLink.rel = 'stylesheet';
            fontLink.href = 'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&display=swap';
            document.head.appendChild(fontLink);

            const style = document.createElement('style');
            style.id = styleId;
            const cssText = `
                body, html {
                    overflow: hidden !important;
                    cursor: none !important;
                    background: #000000 !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    width: 100vw !important;
                    height: 100vh !important;
                }
                
                /* Ocultar la UI nativa de YouTube en reproducción watch */
                #masthead-container,
                #columns #secondary,
                #comments,
                ytd-watch-metadata,
                #above-the-fold,
                #bottom-row,
                ytd-video-primary-info-renderer,
                ytd-video-secondary-info-renderer,
                #ticket-shelf,
                ytd-merch-shelf-renderer,
                #chat-container,
                ytd-live-chat-frame,
                ytd-popup-container,
                .ytp-ce-element,
                .ytp-ad-overlay-container,
                .video-ads,
                .ytp-ad-module,
                .ytp-chrome-top,
                .ytp-pause-overlay,
                .ytp-pause-overlay-container,
                .ytp-cards-button,
                .ytp-show-cards-title,
                #meta,
                #info {
                    display: none !important;
                }
                #columns {
                    margin: 0 !important;
                    padding: 0 !important;
                }
                #primary {
                    padding: 0 !important;
                    margin: 0 !important;
                    max-width: 100% !important;
                    width: 100% !important;
                }
                ytd-watch-flexy {
                    padding: 0 !important;
                    margin: 0 !important;
                }
                
                /* Estirar el reproductor al 100% de la pantalla */
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
                
                /* Pantalla de Espera Personalizada de My Qr Music (Home de YouTube) */
                #qrmusic-welcome-screen {
                    position: fixed !important;
                    top: 0 !important;
                    left: 0 !important;
                    width: 100vw !important;
                    height: 100vh !important;
                    z-index: 2000000000 !important;
                    background: #0b0813 !important;
                    display: flex !important;
                    justify-content: center !important;
                    align-items: center !important;
                    font-family: 'Outfit', sans-serif !important;
                    color: #ffffff !important;
                }
                .welcome-bg-glow {
                    position: absolute;
                    width: 100%;
                    height: 100%;
                    top: 0;
                    left: 0;
                    z-index: 1;
                    background: 
                        radial-gradient(circle at 15% 25%, rgba(63, 55, 201, 0.25) 0%, transparent 45%),
                        radial-gradient(circle at 85% 75%, rgba(157, 78, 221, 0.25) 0%, transparent 45%);
                    filter: blur(80px);
                }
                .welcome-card {
                    position: relative;
                    z-index: 10;
                    background: rgba(18, 14, 34, 0.65) !important;
                    backdrop-filter: blur(16px) !important;
                    border: 1px solid rgba(157, 78, 221, 0.2) !important;
                    border-radius: 24px !important;
                    padding: 50px 60px !important;
                    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5), 0 0 30px rgba(157, 78, 221, 0.1) !important;
                    text-align: center !important;
                    max-width: 600px !important;
                }
                .welcome-title {
                    font-size: 38px !important;
                    font-weight: 800 !important;
                    margin: 0 0 15px 0 !important;
                    letter-spacing: -1px !important;
                    background: linear-gradient(135deg, #ffffff 30%, #c77dff 100%) !important;
                    -webkit-background-clip: text !important;
                    -webkit-text-fill-color: transparent !important;
                }
                .welcome-desc {
                    font-size: 16px !important;
                    color: #a0a0b0 !important;
                    line-height: 1.6 !important;
                    margin-bottom: 30px !important;
                    font-weight: 300 !important;
                }
                .welcome-footer {
                    font-size: 13px !important;
                    color: #9d4edd !important;
                    text-transform: uppercase !important;
                    letter-spacing: 2px !important;
                    font-weight: 800 !important;
                    animation: blink 2.5s infinite !important;
                }
                @keyframes blink {
                    0%, 100% { opacity: 0.4; }
                    50% { opacity: 1; }
                }
                
                /* Indicador de Click para Pantalla Completa y Unmute */
                #qrmusic-fs-hint {
                    position: fixed !important;
                    top: 20px !important;
                    left: 50% !important;
                    transform: translateX(-50%) !important;
                    background: rgba(231, 76, 60, 0.85) !important;
                    color: #fff !important;
                    padding: 10px 25px !important;
                    font-size: 13px !important;
                    font-weight: 600 !important;
                    border-radius: 30px !important;
                    z-index: 2000000000 !important;
                    font-family: 'Outfit', sans-serif !important;
                    pointer-events: none !important;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.3) !important;
                    animation: float-hint 3s infinite alternate !important;
                }
                @keyframes float-hint {
                    0% { transform: translate(-50%, 0); }
                    100% { transform: translate(-50%, -5px); }
                }
                
                /* Marca de agua / QR (Tamaño 2x para TV de 100": 220px) */
                #qrmusic-watermark {
                    position: fixed !important;
                    top: 35px !important;
                    right: 35px !important;
                    width: 220px !important;
                    height: 220px !important;
                    z-index: 2000000000 !important;
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
                    z-index: 2000000000 !important;
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
                    z-index: 2000000000 !important;
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

                /* --- BANNER DE COMUNICADOS DE LA ADMINISTRACIÓN NEÓN --- */
                #qrmusic-admin-banner {
                    position: fixed !important;
                    top: 35px !important;
                    left: 50% !important;
                    transform: translate(-50%, -35px) scale(0.85) !important;
                    background: rgba(12, 6, 24, 0.9) !important;
                    backdrop-filter: blur(15px) !important;
                    border: 2.5px solid #ff007f !important;
                    border-radius: 20px !important;
                    padding: 20px 40px !important;
                    box-shadow: 0 15px 50px rgba(0, 0, 0, 0.8), 0 0 30px #ff007f, inset 0 0 15px rgba(255, 0, 127, 0.25) !important;
                    z-index: 2000000000 !important;
                    font-family: 'Outfit', sans-serif !important;
                    color: #ffffff !important;
                    display: flex !important;
                    align-items: center !important;
                    gap: 25px !important;
                    opacity: 0 !important;
                    pointer-events: none !important;
                    transition: all 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) !important;
                    max-width: 80% !important;
                    box-sizing: border-box !important;
                }
                #qrmusic-admin-banner.show {
                    opacity: 1 !important;
                    transform: translate(-50%, 0) scale(1) !important;
                }
                .admin-banner-logo-img {
                    width: 100px !important;
                    height: 100px !important;
                    border-radius: 50% !important;
                    object-fit: cover !important;
                    filter: drop-shadow(0 0 8px #ff007f) !important;
                    flex-shrink: 0 !important;
                }
                .admin-banner-text-box {
                    display: flex !important;
                    flex-direction: column !important;
                    text-align: left !important;
                }
                .admin-banner-label {
                    font-size: 16px !important;
                    text-transform: uppercase !important;
                    letter-spacing: 3px !important;
                    color: #ff007f !important;
                    font-weight: 800 !important;
                    margin-bottom: 6px !important;
                    text-shadow: 0 0 10px rgba(255, 0, 127, 0.6) !important;
                }
                .admin-banner-message {
                    font-size: 32px !important;
                    font-weight: 800 !important;
                    text-shadow: 0 0 15px rgba(255, 255, 255, 0.5) !important;
                    line-height: 1.3 !important;
                    color: #ffffff !important;
                }

                /* --- ESTILOS DE INDICADOR DE ESTADO GRÁFICO (2x: 220px) --- */
                #qrmusic-status-indicator {
                    position: fixed !important;
                    top: 35px !important;
                    left: 35px !important;
                    width: 220px !important;
                    height: 220px !important;
                    z-index: 2000000000 !important;
                    pointer-events: none !important;
                }
                .status-indicator-img {
                    width: 220px !important;
                    height: 220px !important;
                    border-radius: 50% !important;
                    border: 4px solid rgba(157, 78, 221, 0.5) !important;
                    object-fit: cover !important;
                    box-shadow: 0 0 25px rgba(0, 0, 0, 0.6) !important;
                }
                .status-indicator-badge {
                    width: 50px !important;
                    height: 50px !important;
                    border-radius: 50% !important;
                    display: flex !important;
                    justify-content: center !important;
                    align-items: center !important;
                    color: #fff !important;
                    position: absolute !important;
                    bottom: 0 !important;
                    right: 0 !important;
                    font-size: 24px !important;
                    font-weight: bold !important;
                    border: 3.5px solid #000000 !important;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.5) !important;
                }
                .status-indicator-badge.connected {
                    background: #2ecc71 !important;
                }
                .status-indicator-badge.disconnected {
                    background: #e74c3c !important;
                }
                
                /* ETIQUETA DE VERSION EN ESQUINA SUPERIOR DERECHA DEL LOGO STATUS */
                .status-indicator-version {
                    position: absolute !important;
                    top: 0 !important;
                    right: 0 !important;
                    background: rgba(157, 78, 221, 0.95) !important;
                    color: #ffffff !important;
                    font-size: 13px !important;
                    font-weight: 800 !important;
                    padding: 4px 10px !important;
                    border-radius: 12px !important;
                    border: 2px solid #000000 !important;
                    box-shadow: 0 3px 10px rgba(0,0,0,0.5) !important;
                    letter-spacing: 1px !important;
                    font-family: 'Outfit', sans-serif !important;
                }

                /* --- ESTILOS DE PANTALLA TIPO CORTINA DE TRANSICIÓN --- */
                #qrmusic-curtain-screen {
                    position: fixed !important;
                    top: 0 !important;
                    left: 0 !important;
                    width: 100vw !important;
                    height: 100vh !important;
                    z-index: 2000000000 !important;
                    background: #0b0813 !important;
                    display: flex !important;
                    justify-content: center !important;
                    align-items: center !important;
                    font-family: 'Outfit', sans-serif !important;
                    color: #ffffff !important;
                    opacity: 0 !important;
                    pointer-events: none !important;
                    transition: opacity 0.5s ease-in-out !important;
                }
                #qrmusic-curtain-screen.show {
                    opacity: 1 !important;
                    pointer-events: auto !important;
                }
            `;
            style.appendChild(document.createTextNode(cssText));
            document.head.appendChild(style);
        };

        // 5. Inyección de elementos HTML en el DOM
        const injectUIElements = (showWelcome) => {
            if (isPlayer2Page) return;
            if (!document.body) return;

            // Inyectar el Banner de Comunicados de la Administración
            if (!document.getElementById('qrmusic-admin-banner')) {
                const banner = document.createElement('div');
                banner.id = 'qrmusic-admin-banner';
                banner.innerHTML = policy.createHTML(`
                    <img class="admin-banner-logo-img" src="${ownerLogoUrl}" />
                    <div class="admin-banner-text-box">
                        <div class="admin-banner-label">Comunicado de Administración</div>
                        <div class="admin-banner-message"></div>
                    </div>
                `);
                document.body.appendChild(banner);
            }

            // Inyectar la Cortina de Transición de Cortesía
            if (!document.getElementById('qrmusic-curtain-screen')) {
                const curtain = document.createElement('div');
                curtain.id = 'qrmusic-curtain-screen';
                curtain.innerHTML = policy.createHTML(`
                    <div class="welcome-bg-glow"></div>
                    <div class="welcome-card" style="border-color: #ff007f !important; box-shadow: 0 20px 50px rgba(0,0,0,0.6), 0 0 35px rgba(255, 0, 127, 0.25) !important;">
                        <div class="logo-badge-container" style="margin: 0 auto 25px auto; width: 20vh; height: 20vh; position: relative;">
                            <img class="curtain-logo-img" src="${ownerLogoUrl}" style="width: 20vh; height: 20vh; border-radius: 50% !important; border: 0.4vh solid #ff007f !important; object-fit: cover !important; box-shadow: 0 0 2.5vh rgba(255, 0, 127, 0.4) !important;" />
                        </div>
                        <h2 class="welcome-title" style="background: linear-gradient(135deg, #ffffff 30%, #ff007f 100%) !important; -webkit-background-clip: text !important; -webkit-text-fill-color: transparent !important;">¡Gracias por preferirnos!</h2>
                        <p class="welcome-desc" style="font-size: 20px !important; font-weight: 600 !important; color: #ffffff !important; margin-bottom: 0px !important;">
                            Estamos para servirte.
                        </p>
                    </div>
                `);
                document.body.appendChild(curtain);
            }

            if (showWelcome) {
                if (!document.getElementById('qrmusic-welcome-screen')) {
                    const welcomeScreen = document.createElement('div');
                    welcomeScreen.id = 'qrmusic-welcome-screen';
                    
                    // RENDERIZADO DEL LOGO CORPORATIVO DEL DUEÑO + CHECK SECUNDARIO ABAJO A LA DERECHA
                    welcomeScreen.innerHTML = policy.createHTML(`
                        <div class="welcome-bg-glow"></div>
                        <div class="welcome-card">
                            <div class="logo-badge-container" style="position: relative; display: inline-block; margin: 0 auto 25px auto; width: 20vh; height: 20vh;">
                                <img id="owner-logo-welcome" src="${ownerLogoUrl}" style="width: 20vh; height: 20vh; border-radius: 50% !important; border: 0.4vh solid #9d4edd !important; object-fit: cover !important; box-shadow: 0 0 2.5vh rgba(157, 78, 221, 0.4) !important;" />
                                <div class="success-badge" style="width: 5vh; height: 5vh; background: #2ecc71; border-radius: 50%; display: flex; justify-content: center; align-items: center; color: #fff; position: absolute; bottom: 0; right: 0; font-size: 2.4vh; border: 0.4vh solid #120e22; box-shadow: 0 0.5vh 1.5vh rgba(0,0,0,0.3);">✔</div>
                            </div>
                            <h2 class="welcome-title">¡Listo para Empezar!</h2>
                            <p class="welcome-desc">
                                El reproductor de TV de My Qr Music está sincronizado. Envía tus canciones desde el administrador o escanea el QR de la mesa para empezar.
                            </p>
                            <div class="welcome-footer">
                                📡 Esperando canción en cola...
                                <br><br>
                                <span id="qrmusic-btn-config" style="font-size: 16px; cursor: pointer; color: #a29bfe; text-decoration: underline; pointer-events: auto !important; z-index: 999999999 !important; display: inline-block;">⚙️ Configurar Servidor</span>
                            </div>
                        </div>
                    `);
                    document.body.appendChild(welcomeScreen);

                    // Vincular manejador al botón de configuración de la pantalla de bienvenida
                    const configBtn = document.getElementById('qrmusic-btn-config');
                    if (configBtn) {
                        configBtn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            const newHost = prompt("Introduce el host/IP del servidor My Qr Music (ej: qr-karaoke-backend-render-pb3m.onrender.com):", qrmusicHost);
                            if (newHost !== null) {
                                const cleanHost = newHost.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
                                if (cleanHost) {
                                    localStorage.setItem("qrmusic_host", cleanHost);
                                    alert("Servidor actualizado a: " + cleanHost + ". Recargando...");
                                    window.location.reload();
                                }
                            }
                        });
                    }

                    // Doble click en el fondo para atajo de emergencia
                    welcomeScreen.addEventListener('dblclick', () => {
                        const newHost = prompt("Configure la dirección del servidor My Qr Music:", qrmusicHost);
                        if (newHost !== null) {
                            const cleanHost = newHost.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
                            if (cleanHost) {
                                localStorage.setItem("qrmusic_host", cleanHost);
                                window.location.reload();
                            }
                        }
                    });
                }
                const watermark = document.getElementById('qrmusic-watermark');
                if (watermark) watermark.remove();
                const nowPlayingBox = document.getElementById('qrmusic-now-playing-box');
                if (nowPlayingBox) nowPlayingBox.remove();
                const nextSongBox = document.getElementById('qrmusic-next-song-box');
                if (nextSongBox) nextSongBox.remove();
                const statusIndicator = document.getElementById('qrmusic-status-indicator');
                if (statusIndicator) statusIndicator.remove();
            } else {
                const welcomeScreen = document.getElementById('qrmusic-welcome-screen');
                if (welcomeScreen) welcomeScreen.remove();

                // Marca de agua QR de My Qr Music (Esquina superior derecha)
                if (!document.getElementById('qrmusic-watermark')) {
                    const img = document.createElement('img');
                    img.id = 'qrmusic-watermark';
                    img.src = `${getHttpProto()}://${qrmusicHost}/static/images/watermark.jpg`;
                    document.body.appendChild(img);
                }

                // Bloque 1: Sonando Ahora (Inferior Izquierda)
                if (!document.getElementById('qrmusic-now-playing-box')) {
                    const nowBox = document.createElement('div');
                    nowBox.id = 'qrmusic-now-playing-box';
                    nowBox.innerHTML = policy.createHTML(`
                        <div class="qrmusic-box-label qrmusic-box-label-now">🎵 Sonando Ahora</div>
                        <div id="qrmusic-current-song" class="qrmusic-box-title">Cargando catálogo...</div>
                        <div id="qrmusic-current-user" class="qrmusic-box-user"></div>
                    `);
                    document.body.appendChild(nowBox);
                }

                // Bloque 2: Siguiente en Cola (Inferior Derecha)
                if (!document.getElementById('qrmusic-next-song-box')) {
                    const nextBox = document.createElement('div');
                    nextBox.id = 'qrmusic-next-song-box';
                    nextBox.innerHTML = policy.createHTML(`
                        <div class="qrmusic-box-label qrmusic-box-label-next">⏭️ Siguiente en Cola</div>
                        <div id="qrmusic-next-song" class="qrmusic-box-title">Esperando pedidos...</div>
                        <div id="qrmusic-next-user" class="qrmusic-box-user"></div>
                    `);
                    document.body.appendChild(nextBox);
                }

                // Asegurar el indicador gráfico en modo de reproducción
                updateStatusIndicator(socket && socket.readyState === WebSocket.OPEN);
            }
            
            const isFs = document.fullscreenElement || window.innerHeight === window.screen.height;
            if (!isFs) {
                if (!document.getElementById('qrmusic-fs-hint')) {
                    const hint = document.createElement('div');
                    hint.id = 'qrmusic-fs-hint';
                    hint.innerText = '🔊 Haz click en la pantalla para activar Audio y Pantalla Completa';
                    document.body.appendChild(hint);
                }
            } else {
                const fsHint = document.getElementById('qrmusic-fs-hint');
                if (fsHint) fsHint.remove();
            }
        };

        // Actualizar textos en los 2 bloques inferiores
        const updateOverlay = (current, next, currentUser = '', nextUser = '') => {
            if (isPlayer2Page) return;
            const currentEl = document.getElementById('qrmusic-current-song');
            const nextEl = document.getElementById('qrmusic-next-song');
            const currentUserEl = document.getElementById('qrmusic-current-user');
            const nextUserEl = document.getElementById('qrmusic-next-user');

            if (currentEl) currentEl.textContent = current;
            if (nextEl) nextEl.textContent = next;
            if (currentUserEl) currentUserEl.textContent = currentUser;
            if (nextUserEl) nextUserEl.textContent = nextUser;
        };

        // Control dinámico y temporizado de visibilidad para los 2 paneles inferiores:
        //  1. Primeros 10 segundos al inicio de la canción (0s a 10s)
        //  2. 10 segundos a la mitad exacta de la canción ((duracion/2 - 5s) a (duracion/2 + 5s))
        //  3. 10 segundos comenzando 20 segundos antes de terminar la canción ((duracion - 20s) a (duracion - 10s))
        //  4. Ocultos el resto del tiempo (con suave transición fade / slide)
        const updateBoxesVisibility = () => {
            if (isPlayer2Page || isHomePath()) {
                const nowBox = document.getElementById('qrmusic-now-playing-box');
                const nextBox = document.getElementById('qrmusic-next-song-box');
                if (nowBox) nowBox.classList.remove('show');
                if (nextBox) nextBox.classList.remove('show');
                return;
            }

            const video = document.querySelector('video');
            const nowBox = document.getElementById('qrmusic-now-playing-box');
            const nextBox = document.getElementById('qrmusic-next-song-box');

            if (!nowBox && !nextBox) return;

            // Si no hay video, está pausado o estamos en plena cortina/transición
            if (!video || isNaN(video.currentTime) || video.paused || window._qrmusicTransitioning || window._qrmusicCurtainActive) {
                if (nowBox) nowBox.classList.remove('show');
                if (nextBox) nextBox.classList.remove('show');
                return;
            }

            const t = video.currentTime;
            const d = video.duration;

            let shouldShow = false;

            // Condición 1: Primeros 10 segundos de la canción
            if (t <= 10.0) {
                shouldShow = true;
            } 
            // Condiciones con duración conocida
            else if (d && d > 20.0) {
                const mid = d / 2.0;
                // Condición 2: 10 segundos a la mitad de la canción (mid - 5s hasta mid + 5s)
                const isMiddle = (t >= (mid - 5.0)) && (t <= (mid + 5.0));

                // Condición 3: 10 segundos comenzando 20 segundos antes de terminar (d - 20s hasta d - 10s)
                const isNearEnd = (t >= (d - 20.0)) && (t <= (d - 10.0));

                if (isMiddle || isNearEnd) {
                    shouldShow = true;
                }
            }

            if (shouldShow) {
                if (nowBox) nowBox.classList.add('show');
                if (nextBox) nextBox.classList.add('show');
            } else {
                if (nowBox) nowBox.classList.remove('show');
                if (nextBox) nextBox.classList.remove('show');
            }
        };

        // Helper para llamar al endpoint /siguiente y forzar el inicio de reproducción
        let triggeringNext = false;
        const triggerNextSong = async () => {
            if (triggeringNext) return;
            triggeringNext = true;
            console.log(`[My Qr Music] Canciones detectadas en cola (local: ${qrmusicLocalId || 'General'}). Avanzando de manera automática...`);
            try {
                let nextUrl = `${getHttpProto()}://${qrmusicHost}/api/v1/canciones/siguiente`;
                if (qrmusicLocalId) {
                    nextUrl += `?local_id=${encodeURIComponent(qrmusicLocalId)}`;
                }
                const response = await fetch(nextUrl, { method: 'POST' });
                console.log("[My Qr Music] Respuesta avanzar automática:", response.status);
            } catch (err) {
                console.error("[My Qr Music] Error al iniciar canción automática:", err);
            } finally {
                setTimeout(() => { triggeringNext = false; }, 3000);
            }
        };

        // Helper para reactivar el volumen / quitar el mute
        const unmuteActivePlayer = () => {
            const player = document.getElementById('movie_player') || document.querySelector('.html5-video-player');
            if (player) {
                if (typeof player.isMuted === 'function' && player.isMuted()) {
                    try {
                        player.unMute();
                        player.setVolume(100);
                        console.log("[My Qr Music] Reproductor desmutado correctamente.");
                    } catch(e) {}
                }
            }
            const videos = document.querySelectorAll('video');
            videos.forEach(v => {
                if (v.muted) {
                    try { v.muted = false; } catch(e) {}
                }
            });
        };

        // 5. Conexión WebSocket para controlar la navegación y procesar comunicados/emojis
        let socket = null;
        const connectWebSocket = () => {
            let wsUrl = `${getWsProto()}://${qrmusicHost}/ws/cola`;
            if (qrmusicLocalId) {
                wsUrl += `?local=${encodeURIComponent(qrmusicLocalId)}`;
            }
            console.log(`[My Qr Music] Conectando a WebSocket: ${wsUrl}`);
            
            socket = new WebSocket(wsUrl);
            
            socket.onopen = () => {
                console.log(`[My Qr Music] WebSocket conectado correctamente (Sede: ${qrmusicLocalId || 'General'}).`);
                updateStatusIndicator(true);
            };

            socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    console.log("[My Qr Music] Mensaje WebSocket recibido:", data);
                    
                    // A. Comando para reproducir canción
                    if (data.type === 'play_song') {
                        const payload = data.payload || {};
                        const youtube_id = payload.youtube_id;
                        if (youtube_id) {
                            isIdleMode = false;
                            const player = document.getElementById('movie_player') || document.querySelector('.html5-video-player');
                            
                            // Activar transición limpia sin parpadeo (pantalla negra/espera mientras carga)
                            window._qrmusicTransitioning = true;
                            window._qrmusicCurtainActive = false; // Resetear cortina al cargar nuevo tema
                            if (window._qrmusicTransitionTimeout) clearTimeout(window._qrmusicTransitionTimeout);
                            window._qrmusicTransitionTimeout = setTimeout(() => {
                                window._qrmusicTransitioning = false;
                            }, 8000); // 8 segundos de protección

                            if (player && typeof player.loadVideoById === 'function') {
                                console.log(`[My Qr Music] 🎬 Cargando video vía SPA in-place (loadVideoById): ${youtube_id}`);
                                try {
                                    history.replaceState(null, "", "/watch?v=" + youtube_id);
                                } catch(e) {}
                                player.loadVideoById(youtube_id);
                                if (typeof player.playVideo === 'function') {
                                    try { player.playVideo(); } catch(e) {}
                                }
                                unmuteActivePlayer();
                            } else {
                                console.log(`[My Qr Music] Navegando a video vía yt-navigate Event (SPA Router): ${youtube_id}`);
                                const ytdApp = document.querySelector('ytd-app');
                                if (ytdApp) {
                                    try {
                                        ytdApp.dispatchEvent(new CustomEvent("yt-navigate", {
                                            bubbles: true,
                                            composed: true,
                                            detail: {
                                                endpoint: {
                                                    commandMetadata: {
                                                        webCommandMetadata: {
                                                            url: "/watch?v=" + youtube_id,
                                                            webPageType: "WEB_PAGE_TYPE_WATCH"
                                                        }
                                                    }
                                                }
                                            }
                                        }));
                                    } catch (e) {
                                        console.error("[My Qr Music] Error en yt-navigate event:", e);
                                        window.location.href = `https://www.youtube.com/watch?v=${youtube_id}`;
                                    }
                                } else {
                                    window.location.href = `https://www.youtube.com/watch?v=${youtube_id}`;
                                }
                            }
                        }
                    } 
                    // B. Control de reproducción
                    else if (data.type === 'pause_playback') {
                        const v = document.querySelector('video');
                        if (v) v.pause();
                    } else if (data.type === 'resume_playback') {
                        const v = document.querySelector('video');
                        if (v) v.play();
                    } else if (data.type === 'restart_song') {
                        const v = document.querySelector('video');
                        if (v) v.currentTime = 0;
                    } 
                    // C. Auto-play o Limpieza en caliente desde WebSocket (SIN RECARGA / SIN SALIR DE FULLSCREEN)
                    else if (data.type === 'queue_update') {
                        const payload = data.payload || {};
                        const nowPlaying = payload.now_playing;
                        const upcoming = payload.upcoming || [];
                        const lazy = payload.lazy_queue || [];
                        
                        if (isIdle()) {
                            if (upcoming.length > 0 || lazy.length > 0) {
                                triggerNextSong();
                            }
                        } else {
                            if (!nowPlaying && upcoming.length === 0 && lazy.length === 0) {
                                console.log("[My Qr Music] Cola vaciada. Activando pantalla de espera sin alterar pantalla completa...");
                                isIdleMode = true;
                                const v = document.querySelector('video');
                                if (v) v.pause();
                            }
                        }
                    }
                    // D. Procesamiento de Emojis/Reacciones
                    else if (data.type === 'reaction' && data.payload && data.payload.reaction) {
                        const reactionVal = data.payload.reaction;
                        console.log("[My Qr Music Reaction] Procesando reacción:", reactionVal);
                        
                        const isHome = isHomePath();
                        console.log("[My Qr Music Reaction] Estado actual - isHomePath():", isHome, 
                                    "| _qrmusicTransitioning:", window._qrmusicTransitioning, 
                                    "| _qrmusicCurtainActive:", window._qrmusicCurtainActive);

                        // REQUERIMIENTO: Solo mostrar reacciones cuando se está reproduciendo activamente un video (NO en Home/Espera/Transición)
                        if (isHome || window._qrmusicTransitioning || window._qrmusicCurtainActive) {
                            console.log("[My Qr Music Reaction] Reacción ignorada por estar en home, transición o cortina activa.");
                            return;
                        }

                        // Asegurar e inyectar de forma dinámica el contenedor si fue destruido por transiciones SPA de YouTube
                        let container = document.getElementById('qrmusic-reaction-container');
                        console.log("[My Qr Music Reaction] Contenedor existente:", !!container);
                        
                        if (!container) {
                            console.log("[My Qr Music Reaction] Contenedor no encontrado. Llamando a setupReactions()...");
                            setupReactions();
                            container = document.getElementById('qrmusic-reaction-container');
                            console.log("[My Qr Music Reaction] Contenedor tras setupReactions:", !!container);
                        }

                        if (container) {
                            try {
                                const imgUrl = getEmojiImgUrl(reactionVal);
                                if (imgUrl) {
                                    const img = document.createElement('img');
                                    img.src = imgUrl;
                                    img.className = 'reaction-emoji-img';
                                    img.style.cssText = 'width: 80px !important; height: 80px !important; object-fit: contain !important; filter: drop-shadow(3px 3px 12px rgba(0,0,0,0.8)) !important;';
                                    
                                    const el = document.createElement('div');
                                    el.className = 'reaction-emoji';
                                    const leftVal = `${Math.random() * 80 + 10}%`;
                                    el.style.left = leftVal;
                                    el.appendChild(img);
                                    
                                    console.log("[My Qr Music Reaction] Creando elemento reaction-emoji con imagen:", imgUrl, "en left:", leftVal);
                                    
                                    container.appendChild(el);
                                    console.log("[My Qr Music Reaction] Elemento añadido con éxito al contenedor.");
                                    
                                    setTimeout(() => {
                                        el.remove();
                                        console.log("[My Qr Music Reaction] Elemento removido después de timeout.");
                                    }, 6000);
                                } else {
                                    console.warn("[My Qr Music Reaction] No se pudo resolver la URL de imagen para el emoji:", reactionVal);
                                }
                            } catch(err) {
                                console.error("[My Qr Music Reaction] Error crítico creando/añadiendo emoji:", err);
                            }
                        } else {
                            console.error("[My Qr Music Reaction] ERROR: El contenedor sigue siendo NULL incluso después de setupReactions()!");
                        }
                    }
                    // E. Procesamiento de Comunicados de Administración (Banner Neón)
                    else if (data.type === 'notification' && data.payload && data.payload.mensaje) {
                        const banner = document.getElementById('qrmusic-admin-banner');
                        if (banner) {
                            const msgEl = banner.querySelector('.admin-banner-message');
                            if (msgEl) msgEl.textContent = data.payload.mensaje;
                            banner.classList.add('show');
                            
                            // Programar ocultamiento en 10 segundos
                            if (window._qrmusicBannerTimeout) clearTimeout(window._qrmusicBannerTimeout);
                            window._qrmusicBannerTimeout = setTimeout(() => {
                                banner.classList.remove('show');
                            }, 10000);
                        }
                    }
                } catch (err) {
                    console.error("[My Qr Music] Error procesando mensaje WebSocket:", err);
                }
            };

            socket.onclose = () => {
                console.log("[My Qr Music] WebSocket desconectado. Reconectando en 3 segundos...");
                updateStatusIndicator(false);
                setTimeout(connectWebSocket, 3000);
            };

            socket.onerror = (err) => {
                console.error("[My Qr Music] Error en WebSocket:", err);
                updateStatusIndicator(false);
            };
        };

        // 6. Poller para consultar la cola y actualizar la barra (y auto-reproducir si está ocioso)
        const startQueueFetcher = () => {
            setInterval(async () => {
                const isHome = isHomePath();
                try {
                    let fetchUrl = `${getHttpProto()}://${qrmusicHost}/api/v1/canciones/cola/extended`;
                    if (qrmusicLocalId) {
                        fetchUrl += `?local_id=${encodeURIComponent(qrmusicLocalId)}`;
                    }
                    const res = await fetch(fetchUrl);
                    if (res.ok) {
                        const data = await res.json();
                        
                        const upcoming = data.upcoming || [];
                        const lazy = data.lazy_queue || [];

                        // Guardar detalles de la siguiente canción para la cortina
                        let nextSongDetails = {
                            titulo: "No hay más canciones en cola",
                            usuario: "",
                            mesa: ""
                        };
                        let nextSongObj = null;
                        if (upcoming.length > 0) {
                            nextSongObj = upcoming[0];
                        } else if (lazy.length > 0) {
                            nextSongObj = lazy[0];
                        }

                        if (nextSongObj) {
                            nextSongDetails.titulo = nextSongObj.titulo || "Desconocida";
                            if (nextSongObj.usuario) {
                                let rawNick = nextSongObj.usuario.nick || "DJ";
                                let mesaName = "";
                                if (nextSongObj.usuario.mesa) {
                                    mesaName = typeof nextSongObj.usuario.mesa === 'object' ? nextSongObj.usuario.mesa.nombre : nextSongObj.usuario.mesa;
                                }

                                // Separar mesa y apodo de forma limpia
                                let cleanNick = rawNick;
                                if (mesaName && cleanNick.startsWith(mesaName + "-")) {
                                    cleanNick = cleanNick.substring(mesaName.length + 1);
                                }

                                nextSongDetails.usuario = cleanNick;
                                nextSongDetails.mesa = mesaName;
                            }
                        }
                        window._qrmusicNextSongDetails = nextSongDetails;
                        
                        if (isIdle()) {
                            if (upcoming.length > 0 || lazy.length > 0) {
                                triggerNextSong();
                            }
                            return;
                        }
                        
                        // VUELTA AL MODO ESPERA SI LA COLA SE VACÍA EN CALIENTE (SIN RECARGAR / SIN SALIR DE PANTALLA COMPLETA)
                        if (!data.now_playing && upcoming.length === 0 && lazy.length === 0) {
                            console.log("[My Qr Music] Poller detectó cola vacía. Activando pantalla de espera sin alterar pantalla completa...");
                            isIdleMode = true;
                            const v = document.querySelector('video');
                            if (v) v.pause();
                            return;
                        }

                        // Obtener títulos y datos de usuarios
                        let currentText = "Ninguna canción en reproducción";
                        let currentUserText = "";
                        if (data.now_playing) {
                            currentText = data.now_playing.titulo || "Desconocida";
                            if (data.now_playing.usuario && data.now_playing.usuario.nick) {
                                const mObj = data.now_playing.usuario.mesa;
                                const mesaStr = mObj ? ` (${typeof mObj === 'object' ? mObj.nombre : mObj})` : "";
                                currentUserText = `🎤 ${data.now_playing.usuario.nick}${mesaStr}`;
                            }
                        }

                        let nextText = "No hay más canciones en cola";
                        let nextUserText = "";
                        if (nextSongObj) {
                            nextText = nextSongObj.titulo || "Desconocida";
                            if (nextSongObj.usuario && nextSongObj.usuario.nick) {
                                const mObj = nextSongObj.usuario.mesa;
                                const mesaStr = mObj ? ` (${typeof mObj === 'object' ? mObj.nombre : mObj})` : "";
                                nextUserText = `👤 ${nextSongObj.usuario.nick}${mesaStr}`;
                            }
                        }

                        updateOverlay(currentText, nextText, currentUserText, nextUserText);
                    }
                } catch (err) {
                    // Fails silently
                }
            }, 3000);
        };

        // 7. Reportar fin de canción al servidor de forma robusta e inequívoca (DETECTOR DE FINALIZACIÓN DE ALTA FIDELIDAD)
        const setupEndedListener = () => {
            let lastReportedVideoId = null;

            setInterval(async () => {
                if (isPlayer2Page || isHomePath()) return;
                const video = document.querySelector('video');
                if (!video) return;

                // Obtener ID del video actual de la URL
                const urlParams = new URLSearchParams(window.location.search);
                const currentVideoId = urlParams.get('v');
                if (!currentVideoId) return;

                // Resetear si es un video nuevo
                if (lastReportedVideoId !== currentVideoId) {
                    video._qrmusicReported = false;
                }

                // REQUERIMIENTO: Mostrar cortina de agradecimiento exactamente 5.0 segundos antes de terminar el video
                if (video.duration > 0 && video.currentTime >= video.duration - 5.0) {
                    window._qrmusicCurtainActive = true;
                }

                // Detectar si el video llegó al final (o le faltan menos de 0.8s para terminar)
                const isFinished = video.ended || (video.duration > 0 && video.currentTime >= video.duration - 0.8);

                if (isFinished && !video._qrmusicReported) {
                    video._qrmusicReported = true;
                    lastReportedVideoId = currentVideoId;
                    console.log(`[My Qr Music] 🏁 Canción finalizada detectada (${currentVideoId}) en sede (${qrmusicLocalId || 'General'}). Solicitando siguiente...`);

                    try {
                        let nextUrl = `${getHttpProto()}://${qrmusicHost}/api/v1/canciones/siguiente`;
                        if (qrmusicLocalId) {
                            nextUrl += `?local_id=${encodeURIComponent(qrmusicLocalId)}`;
                        }
                        const response = await fetch(nextUrl, { method: 'POST' });
                        if (response.status === 204) {
                            console.log("[My Qr Music] 📭 Cola vacía (204). Activando pantalla de espera (permaneciendo en fullscreen)...");
                            isIdleMode = true;
                            const v = document.querySelector('video');
                            if (v) v.pause();
                        } else {
                            console.log("[My Qr Music] ⏭️ Siguiente canción iniciada exitosamente.");
                        }
                    } catch (err) {
                        console.error("[My Qr Music] Error al solicitar la siguiente canción:", err);
                        video._qrmusicReported = false;
                    }
                }
            }, 300);
        };

        // 8. Capturador de click para forzar pantalla completa y audio al interactuar (capturando y deteniendo propagación para evitar pausa nativa de YouTube)
        const setupFullscreenClickListener = () => {
            document.addEventListener('click', (event) => {
                if (isPlayer2Page) return; 

                // Solo interceptar clicks reales del usuario (isTrusted === true)
                // para evitar interferir con clicks programados por el script (como el fsBtn.click())
                if (event.isTrusted) {
                    console.log("[My Qr Music] Interceptando click del usuario para evitar pausa nativa de YouTube");
                    event.stopPropagation();
                    event.preventDefault();

                    unmuteActivePlayer();

                    // 1. Activar pantalla completa nativa del navegador
                    if (!document.fullscreenElement) {
                        document.documentElement.requestFullscreen().catch(err => {
                            console.debug("[My Qr Music] Pantalla completa nativa del navegador omitida o no permitida:", err.message);
                        });
                    }
                    
                    // 2. Activar pantalla completa del reproductor de YouTube
                    const player = document.getElementById('movie_player') || document.querySelector('.html5-video-player');
                    if (player && !player.classList.contains('ytp-fullscreen')) {
                        const fsBtn = document.querySelector('.ytp-fullscreen-button');
                        if (fsBtn) fsBtn.click();
                    }
                }
            }, true); // Fase de captura para ganarle la prioridad a los controladores de YouTube
        };

        // 9. Loop de inicialización principal (50ms interval)
        setInterval(() => {
            setupReactions(); // Asegurar reacciones cargadas en cualquier página (incluyendo player2.html)
            
            const isHome = isHomePath();
            
            // Si estamos en el Home (cola vacía o inicial), resetear estados de transición y cortina
            if (isHome) {
                window._qrmusicCurtainActive = false;
                window._qrmusicTransitioning = false;
            }

            // La pantalla de bienvenida solo se muestra cuando estamos físicamente en el Home ocioso
            const showWelcome = isHome;
            
            injectStyles();
            injectUIElements(showWelcome);
            
            if (!showWelcome) {
                unmuteActivePlayer();
            }

            // --- DETECTOR DE REPRODUCCIÓN EN CURSO PARA LIMPIAR LA PANTALLA DE CARGA ---
            const video = document.querySelector('video');
            if (window._qrmusicTransitioning) {
                // Si el video ya está cargado y reproduciéndose más allá de 0.5s, quitamos la pantalla de espera y la cortina
                if (video && !video.paused && video.currentTime > 0.5) {
                    console.log("[My Qr Music] Video detectado en reproducción activa. Quitante pantalla de espera.");
                    window._qrmusicTransitioning = false;
                    window._qrmusicCurtainActive = false;
                }
            }

            // --- REQUERIMIENTO: Controlar visibilidad de la cortina de transición ---
            const curtain = document.getElementById('qrmusic-curtain-screen');
            if (curtain) {
                if (window._qrmusicTransitioning || window._qrmusicCurtainActive) {
                    // Actualizar dinámicamente el mensaje de la cortina con la siguiente canción
                    const descEl = curtain.querySelector('.welcome-desc');
                    if (descEl) {
                        const details = window._qrmusicNextSongDetails || { titulo: "No hay más canciones en cola", usuario: "", mesa: "" };
                        if (details.usuario) {
                            const mesaStr = details.mesa ? details.mesa : "Mesa";
                            descEl.innerHTML = policy.createHTML(`
                                <div style="font-size: 26px; color: #a0a0b0; font-weight: 600; margin-bottom: 5px; text-transform: uppercase; letter-spacing: 2px;">Prepárate en</div>
                                <div style="font-size: 72px; font-weight: 800; background: linear-gradient(135deg, #ff007f 0%, #ff758c 100%) !important; -webkit-background-clip: text !important; -webkit-text-fill-color: transparent !important; margin-bottom: 25px; text-shadow: 0 0 40px rgba(255, 0, 127, 0.45) !important;">
                                    ${mesaStr}
                                </div>
                                <div style="font-size: 32px; font-weight: 600; color: #ffffff; margin-bottom: 20px;">
                                    <span style="color: #c77dff; font-weight: 800;">${details.usuario}</span> nos cantará:
                                </div>
                                <div style="font-size: 42px; font-weight: 800; color: #ffffff; line-height: 1.3; text-shadow: 0 0 20px rgba(255, 255, 255, 0.3) !important;">
                                    "${details.titulo}"
                                </div>
                            `);
                        } else {
                            descEl.innerHTML = policy.createHTML(`
                                <div style="font-size: 18px; color: #a0a0b0;">Estamos para servirte.</div>
                                <div style="font-size: 20px; font-weight: 600; color: #ffffff; margin-top: 15px;">No hay más canciones en cola.</div>
                            `);
                        }
                    }
                    curtain.classList.add('show');
                } else {
                    curtain.classList.remove('show');
                }
            }

            // --- CONTROL DINÁMICO DE VISIBILIDAD DE YOUTUBE ---
            if (isPlayer2Page) return; 
            const welcome = document.getElementById('qrmusic-welcome-screen');
            
            if (showWelcome) {
                // NOTA CRÍTICA: NUNCA aplicar display: none a ytd-app para no destruir el contenedor de fullscreen del navegador
                if (welcome) {
                    welcome.style.setProperty('display', 'flex', 'important');
                    // Actualizar footer si está en transición / cargando
                    if (window._qrmusicTransitioning) {
                        const footer = welcome.querySelector('.welcome-footer');
                        if (footer) footer.textContent = "⏳ Cargando siguiente canción...";
                    }
                }
            } else {
                if (welcome) {
                    welcome.style.setProperty('display', 'none', 'important');
                }
            }
            // --------------------------------------------------

            // Desactivar Autoplay nativo de YouTube para evitar que salte a videos aleatorios no solicitados
            const autoNavBtn = document.querySelector('.ytp-autonav-toggle-button');
            if (autoNavBtn && autoNavBtn.getAttribute('aria-checked') === 'true') {
                autoNavBtn.click();
            }

            if (window.location.href.includes('/watch')) {
                // Desactivar subtítulos por defecto si están activos
                const ccBtn = document.querySelector('.ytp-subtitles-button');
                if (ccBtn && ccBtn.getAttribute('aria-pressed') === 'true') {
                    ccBtn.click();
                }
            }

            // Actualizar visibilidad temporizada de los paneles "Sonando Ahora" y "Siguiente en Cola"
            updateBoxesVisibility();
        }, 50);

        // Sincronizar estado gráfico inicial
        updateStatusIndicator(false);

        // Inicializar conexiones y oyentes
        connectWebSocket();
        startQueueFetcher();
        setupEndedListener();
        setupFullscreenClickListener();

    } catch (e) {
        console.error("[My Qr Music] CRASH INICIAL:", e);
        updateStatusIndicator(false);
    }
})();
