// Queue Page Module - BEES Style
// Manejo: cola de canciones, búsqueda de canciones, añadir canciones

let playerState = {
    isPlaying: false,  // false = pausado, true = reproduciendo
    currentSongId: null
};

// Muestra un toast temporal con acción "Deshacer" que ejecuta undoCallback
function showUndoNotification(message, undoCallback, timeout = 15000) {
    try {
        const id = `undo-toast-${Date.now()}`;
        const container = document.createElement('div');
        container.id = id;
        container.style.position = 'fixed';
        container.style.right = '20px';
        container.style.bottom = '20px';
        container.style.background = 'var(--page-input-bg)';
        container.style.color = 'var(--page-text)';
        container.style.padding = '12px 14px';
        container.style.borderRadius = '8px';
        container.style.boxShadow = '0 6px 18px rgba(0,0,0,0.12)';
        container.style.zIndex = 9999;
        container.style.display = 'flex';
        container.style.gap = '10px';
        container.style.alignItems = 'center';

        const msg = document.createElement('div');
        msg.style.flex = '1';
        msg.style.fontSize = '14px';
        msg.textContent = message;

        const undoBtn = document.createElement('button');
        undoBtn.className = 'bees-btn bees-btn-secondary bees-btn-small';
        undoBtn.textContent = 'Deshacer';
        undoBtn.style.cursor = 'pointer';

        container.appendChild(msg);
        container.appendChild(undoBtn);
        document.body.appendChild(container);

        const timer = setTimeout(() => {
            if (document.getElementById(id)) document.getElementById(id).remove();
        }, timeout);

        undoBtn.addEventListener('click', async () => {
            clearTimeout(timer);
            try {
                undoBtn.disabled = true;
                undoBtn.textContent = '⏳';
                await undoCallback();
            } catch (err) {
                console.error('Error en deshacer:', err);
                showNotification('Error al deshacer la aprobación.', 'error');
            } finally {
                if (document.getElementById(id)) document.getElementById(id).remove();
            }
        });
    } catch (err) {
        console.warn('showUndoNotification falló:', err);
    }
}

async function loadQueuePage() {
    const queueContainer = document.getElementById('queue');
    if (!queueContainer) return;

    try {
        queueContainer.innerHTML = '';

        // Encabezado
        const header = document.createElement('div');
        header.className = 'bees-header';
        header.innerHTML = `
            <div class="bees-header-icon">🎵</div>
            <div class="bees-header-content">
                <h1>Cola de Canciones</h1>
                <p>Gestión de la reproducción</p>
            </div>
        `;
        queueContainer.appendChild(header);

        // Contenedor de dos columnas
        const mainContainer = document.createElement('div');
        mainContainer.style.display = 'grid';
        mainContainer.style.gridTemplateColumns = 'repeat(auto-fit, minmax(500px, 1fr))';
        mainContainer.style.gap = '24px';
        mainContainer.style.marginBottom = '30px';

        // Tarjeta de cola
        const queueCard = document.createElement('div');
        queueCard.className = 'bees-card';

        const queueHeader = document.createElement('div');
        queueHeader.className = 'bees-card-header';
        queueHeader.innerHTML = `
            <div class="bees-card-icon">▶️</div>
            <div class="bees-card-header-content">
                <h3>Canción en reproducción</h3>
                <p>Reproductor</p>
            </div>
        `;
        queueCard.appendChild(queueHeader);

        const queueList = document.createElement('ul');
        queueList.id = 'approved-songs-list';
        queueList.style.listStyle = 'none';
        queueList.style.padding = '0';
        queueList.style.margin = '0';

        const loadingItem = document.createElement('li');
        loadingItem.innerHTML = '<div class="bees-alert bees-alert-info"><span class="bees-alert-icon">⏳</span><div>Cargando cola...</div></div>';
        queueList.appendChild(loadingItem);

        queueCard.appendChild(queueList);
        mainContainer.appendChild(queueCard);

        // Tarjeta de cola lazy (esperando turno)
        const lazyQueueCard = document.createElement('div');
        lazyQueueCard.className = 'bees-card';

        const lazyQueueHeader = document.createElement('div');
        lazyQueueHeader.className = 'bees-card-header';
        lazyQueueHeader.innerHTML = `
            <div class="bees-card-icon">🎯</div>
            <div class="bees-card-header-content">
                <h3>Cola de Canciones(Esperando Turno)</h3> 
                <p>Canciones Cargadas en la Cola</p>
            </div>
        `;
        lazyQueueCard.appendChild(lazyQueueHeader);

        const lazyQueueList = document.createElement('ul');
        lazyQueueList.id = 'lazy-songs-list';
        lazyQueueList.style.listStyle = 'none';
        lazyQueueList.style.padding = '0';
        lazyQueueList.style.margin = '0';

        const lazyLoadingItem = document.createElement('li');
        lazyLoadingItem.innerHTML = '<div class="bees-alert bees-alert-info"><span class="bees-alert-icon">⏳</span><div>Cargando cola lazy...</div></div>';
        lazyQueueList.appendChild(lazyLoadingItem);

        lazyQueueCard.appendChild(lazyQueueList);
        mainContainer.appendChild(lazyQueueCard);



        // Tarjeta de búsqueda
        const searchCard = document.createElement('div');
        searchCard.className = 'bees-card';

        const searchHeader = document.createElement('div');
        searchHeader.className = 'bees-card-header';
        searchHeader.innerHTML = `
            <div class="bees-card-icon">🔍</div>
            <div class="bees-card-header-content">
                <h3>Añadir Canción (DJ)</h3>
                <p>Busca y agrega música</p>
            </div>
        `;
        searchCard.appendChild(searchHeader);

        const searchForm = document.createElement('form');
        searchForm.id = 'admin-search-form';
        searchForm.innerHTML = `
            <div class="bees-form-group">
                <label for="admin-search-input">Buscar en YouTube</label>
                <input type="text" id="admin-search-input" placeholder="Artista, canción o URL" required>
            </div>
            <div class="bees-form-group">
                <label for="admin-target-table">Destino</label>
                <select id="admin-target-table" style="border: 2px solid var(--page-border); border-radius: 8px; padding: 12px; width: 100%; background: var(--page-input-bg); color: var(--page-text); box-sizing: border-box;">
                    <option value="">🎵 Cola General</option>
                </select>
            </div>
            <div style="display: flex; gap: 8px;">
                <button type="button" class="bees-btn bees-btn-primary bees-btn-small" id="admin-search-songs-btn" style="flex: 1; padding: 12px;">🎶 Canciones</button>
                <button type="button" class="bees-btn bees-btn-success bees-btn-small" id="admin-search-karaoke-btn" style="flex: 1; padding: 12px;">🎤 Karaoke</button>
                <button type="button" class="bees-btn bees-btn-warning bees-btn-small" id="admin-search-clear-btn" style="flex: 0.5; padding: 12px;">🗑️</button>
            </div>
        `;
        searchCard.appendChild(searchForm);

        const resultsContainer = document.createElement('div');
        resultsContainer.id = 'admin-search-results';
        resultsContainer.style.listStyle = 'none';
        resultsContainer.style.padding = '0';
        resultsContainer.style.margin = '16px 0 0 0';
        resultsContainer.style.maxHeight = '500px';
        resultsContainer.style.overflowY = 'auto';
        searchCard.appendChild(resultsContainer);

        mainContainer.appendChild(searchCard);
        queueContainer.appendChild(mainContainer);

        // Cargar datos
        await loadQueueData();
        setupQueueListeners();
    } catch (error) {
        const queueContainer = document.getElementById('queue');
        if (queueContainer) {
            queueContainer.innerHTML = `
                <div class="bees-alert bees-alert-danger">
                    <span class="bees-alert-icon">❌</span>
                    <div>Error al cargar cola: ${error.message}</div>
                </div>
            `;
        }
    }
}

async function loadQueueData() {
    try {
        // Cargar cola extendida con lazy queue
        // Cargar cola extendida con lazy queue
        let queueData = await apiFetch('/canciones/cola/extended');

        // Si no hay canción aprobada pero sí hay en la cola lazy, solicitar que se apruebe la siguiente
        if ((!queueData.now_playing || queueData.now_playing === null) && queueData.lazy_queue && queueData.lazy_queue.length > 0) {
            try {
                const approved = await apiFetch('/admin/canciones/lazy/approve-next', { method: 'POST' });
                if (approved && approved.titulo) {
                    // Mostrar toast con opción de deshacer
                    showUndoNotification(`Se aprobó automáticamente: ${approved.titulo}`, async () => {
                        // Llamar endpoint para revertir la aprobación
                        await apiFetch(`/admin/canciones/${approved.id}/revert-approve`, { method: 'POST' });
                        showNotification('Aprobación revertida.', 'info');
                        // Recargar la cola en pantalla
                        await loadQueueData();
                    });
                } else {
                    showUndoNotification('Se aprobó automáticamente la siguiente canción lazy.', async () => {
                        // Si no conocemos el id, recargamos la cola y confiamos en el admin para revertir manualmente
                        await loadQueueData();
                    });
                }
                // Recargar la cola luego de aprobar la siguiente lazy
                queueData = await apiFetch('/canciones/cola/extended');
            } catch (approveErr) {
                console.warn('No se pudo aprobar la siguiente canción lazy automáticamente:', approveErr);
                showNotification('No se pudo aprobar automáticamente la siguiente canción lazy.', 'error');
            }
        }
        currentQueueData = queueData;

        const approvedSongsList = document.getElementById('approved-songs-list');
        if (approvedSongsList) {
            renderApprovedSongs(queueData, approvedSongsList);
        }

        // Cargar cola lazy
        const lazySongsList = document.getElementById('lazy-songs-list');
        if (lazySongsList) {
            renderLazySongs(queueData.lazy_queue || [], lazySongsList);
        }


    } catch (error) {
        console.error('Error loading queue:', error);
        showNotification(`Error al cargar cola: ${error.message}`, 'error');
    }

    try {
        // Cargar mesas
        const tables = await apiFetch('/mesas/');
        const targetTableSelect = document.getElementById('admin-target-table');
        if (targetTableSelect) {
            targetTableSelect.innerHTML = '<option value="">🎵 Cola General</option>';
            const activeTables = tables.filter(t => t.is_active);
            activeTables.forEach(table => {
                targetTableSelect.innerHTML += `<option value="${table.id}">🏠 ${table.nombre}</option>`;
            });
        }
    } catch (error) {
        console.error('Error loading tables:', error);
    }
}

function renderApprovedSongs(songs, listElement) {
    if (!listElement) return;

    let item = null;
    let isPlaying = false;
    
    if (Array.isArray(songs)) {
        if (songs.length > 0) {
            item = songs[0];
            songs.now_playing = item;
            isPlaying = !!(item.estado && item.estado === 'reproduciendo');
        }
    } else if (songs && typeof songs === 'object' && songs.now_playing !== undefined) {
        if (songs.now_playing) {
            item = songs.now_playing;
            isPlaying = true;
        } else if (songs.upcoming && Array.isArray(songs.upcoming) && songs.upcoming.length > 0) {
            item = songs.upcoming[0];
            isPlaying = false;
        }
    }

    // Garantizar que la canción "Siguiente" aparezca en la lista de abajo si hay alguien cantando
    if (songs && songs.now_playing && songs.upcoming && songs.upcoming.length > 0) {
        const nextSong = songs.upcoming[0];
        if (songs.lazy_queue && !songs.lazy_queue.find(s => s.id === nextSong.id)) {
            songs.lazy_queue.unshift(nextSong);
        }
    }

    listElement.innerHTML = '';

    if (!item) {
        const emptyItem = document.createElement('li');
        emptyItem.className = 'queue-item-container';
        emptyItem.innerHTML = '<div class="bees-alert bees-alert-info"><span class="bees-alert-icon">ℹ️</span><div>La cola de canciones está vacía.</div></div>';
        listElement.appendChild(emptyItem);
        return;
    }

    const song = item;
    const li = document.createElement('li');
    li.className = 'queue-item-container';

    let userNick = 'Anónimo';
    let mesaText = 'General';
    if (song.usuario) {
        if (song.usuario.nick) userNick = song.usuario.nick;
        if (song.usuario.mesa && song.usuario.mesa.nombre) {
            mesaText = song.usuario.mesa.nombre;
        } else if (song.usuario.mesa_id) {
            mesaText = `Mesa ${song.usuario.mesa_id}`;
        }
    } else if (song.mesa_nombre) {
        mesaText = song.mesa_nombre;
    } else if (song.mesa_id) {
        mesaText = `Mesa ${song.mesa_id}`;
    }

    const isPaused = !playerState.isPlaying;
    const playIcon = `<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`;
    const pauseIcon = `<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;
    const restartIcon = `<svg viewBox="0 0 24 24"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>`;
    const nextIcon = `<svg viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>`;

    const middleAction = isPlaying ? 'pause-resume-toggle' : 'play-song';
    const middleTitle = isPlaying ? (isPaused ? 'Reanudar' : 'Pausar') : 'Reproducir Ahora';
    const middleIcon = isPlaying ? (isPaused ? playIcon : pauseIcon) : playIcon;

    li.innerHTML = `
        <div class="queue-song-card queue-song-card-active">
            <div class="queue-turn-ribbon queue-turn-ribbon-active">
                <span class="queue-turn-number">▶️</span>
            </div>
            <div class="queue-song-main">
                <div class="queue-song-header">
                    <img class="queue-song-thumb" src="https://i.ytimg.com/vi/${song.youtube_id}/mqdefault.jpg" alt="Miniatura" onerror="this.onerror=null;this.src='https://placehold.co/120x90/1A1A1A/FFD700?text=Song';">
                    <div class="queue-song-info">
                        <div class="queue-song-title" title="${song.titulo}">${song.titulo}</div>
                        <div class="queue-song-meta">
                            <span class="queue-song-requester">👤 <strong>${userNick}</strong></span>
                            <span class="bees-badge ${isPlaying ? 'bees-badge-success' : 'bees-badge-warning'}" style="font-size:0.75em; padding:2px 8px;">${isPlaying ? '▶️ En Reproducción' : '⏸️ Listo para sonar'}</span>
                        </div>
                    </div>
                    <div class="queue-table-box" title="Mesa de origen">
                        <div class="queue-table-icon">🏠</div>
                        <div class="queue-table-text">${mesaText}</div>
                    </div>
                </div>
                <div class="admin-player-controls" style="margin-top: 6px;">
                    <button class="player-btn" data-id="${song.id}" data-action="restart" title="Reiniciar">${restartIcon}</button>
                    <button class="player-btn player-btn-large" data-id="${song.id}" data-action="${middleAction}" title="${middleTitle}">${middleIcon}</button>
                    <button class="player-btn" data-id="${song.id}" data-action="play-next" title="Siguiente">${nextIcon}</button>
                </div>
            </div>
        </div>
    `;

    listElement.appendChild(li);
}

function renderLazySongs(songs, listElement) {
    if (!listElement) return;
    listElement.innerHTML = '';

    if (!songs || songs.length === 0) {
        const emptyItem = document.createElement('li');
        emptyItem.className = 'queue-item-container';
        emptyItem.innerHTML = '<div class="bees-alert bees-alert-info"><span class="bees-alert-icon">✅</span><div>No hay canciones en la cola de espera.</div></div>';
        listElement.appendChild(emptyItem);
        return;
    }

    const lazyCount = Array.isArray(songs) ? songs.length : 0;

    songs.forEach((song, index) => {
        const li = document.createElement('li');
        li.className = 'queue-item-container';
        li.id = `lazy-song-${song.id}`;

        let userNick = 'Anónimo';
        let mesaText = 'General';

        if (song.usuario) {
            if (song.usuario.nick) userNick = song.usuario.nick;
            if (song.usuario.mesa && song.usuario.mesa.nombre) {
                mesaText = song.usuario.mesa.nombre;
            } else if (song.usuario.mesa_id) {
                mesaText = `Mesa ${song.usuario.mesa_id}`;
            }
        } else if (song.mesa_nombre) {
            mesaText = song.mesa_nombre;
        } else if (song.mesa_id) {
            mesaText = `Mesa ${song.mesa_id}`;
        }

        const isFirst = index === 0;
        const isLast = index === lazyCount - 1;

        li.innerHTML = `
            <div class="queue-song-card">
                <!-- Cinta vertical izquierda con el número de turno grande -->
                <div class="queue-turn-ribbon">
                    <span class="queue-turn-number">${index + 1}</span>
                </div>

                <!-- Contenido principal de la canción -->
                <div class="queue-song-main">
                    <div class="queue-song-header">
                        <img class="queue-song-thumb" src="https://i.ytimg.com/vi/${song.youtube_id}/mqdefault.jpg" alt="Miniatura" onerror="this.onerror=null;this.src='https://placehold.co/120x90/1A1A1A/FFD700?text=Song';">
                        
                        <div class="queue-song-info">
                            <div class="queue-song-title" title="${song.titulo}">${song.titulo}</div>
                            <div class="queue-song-meta">
                                <span class="queue-song-requester">👤 <strong>${userNick}</strong></span>
                                ${isFirst ? '<span class="bees-badge bees-badge-success" style="font-size:0.75em; padding:2px 8px;">🎯 Siguiente en sonar</span>' : ''}
                            </div>
                        </div>

                        <!-- Cuadro a la derecha con número de mesa grande -->
                        <div class="queue-table-box" title="Mesa de origen">
                            <div class="queue-table-icon">🏠</div>
                            <div class="queue-table-text">${mesaText}</div>
                        </div>
                    </div>

                    <!-- Panel de botones de acción con iconos -->
                    <div class="queue-actions-panel">
                        <button class="queue-action-btn queue-btn-top" data-id="${song.id}" data-action="move-lazy-top" title="Subir al tope (primero)" ${isFirst ? 'disabled' : ''}>
                            ⏫
                        </button>
                        <button class="queue-action-btn queue-btn-up" data-id="${song.id}" data-action="move-lazy-up" title="Subir una posición" ${isFirst ? 'disabled' : ''}>
                            ⬆️
                        </button>
                        <button class="queue-action-btn queue-btn-down" data-id="${song.id}" data-action="move-lazy-down" title="Bajar una posición" ${isLast ? 'disabled' : ''}>
                            ⬇️
                        </button>
                        <button class="queue-action-btn queue-btn-bottom" data-id="${song.id}" data-action="move-lazy-bottom" title="Bajar al final (último)" ${isLast ? 'disabled' : ''}>
                            ⏬
                        </button>
                        <button class="queue-action-btn queue-btn-delete" data-id="${song.id}" data-action="remove-lazy" title="Eliminar de la cola">
                            🗑️
                        </button>
                    </div>
                </div>
            </div>
        `;
        listElement.appendChild(li);
    });
}



async function handleAdminSearch(event, karaokeMode = false) {
    event.preventDefault();
    const query = document.getElementById('admin-search-input').value.trim();
    if (!query) {
        showNotification('Escribe algo para buscar', 'error');
        return;
    }

    const songsButton = document.getElementById('admin-search-songs-btn');
    const karaokeButton = document.getElementById('admin-search-karaoke-btn');
    songsButton.disabled = true;
    karaokeButton.disabled = true;

    const resultsContainer = document.getElementById('admin-search-results');

    try {
        // Limpiar resultados anteriores al iniciar nueva búsqueda
        if (resultsContainer) {
            resultsContainer.innerHTML = '';
        }

        const url = `/youtube/search?q=${encodeURIComponent(query)}${karaokeMode ? '&karaoke_mode=true' : ''}`;
        const results = await apiFetch(url);

        if (results.length > 0) {
            results.forEach(song => {
                const resultItem = document.createElement('li');
                resultItem.style.marginBottom = '12px';
                resultItem.innerHTML = `
                    <div style="background: var(--page-input-bg); border-radius: 12px; padding: 12px; border-left: 4px solid var(--bees-blue); display: flex; gap: 8px; align-items: center;">
                        <img src="${song.thumbnail}" alt="Miniatura" style="width: 50px; height: 40px; border-radius: 6px; object-fit: cover; flex-shrink: 0;">
                        <div style="flex: 1; min-width: 0;">
                            <div style="font-weight: 600; color: var(--page-text); font-size: 13px; word-break: break-word;">${song.title}</div>
                            <div style="color: var(--page-text-muted); font-size: 11px;">⏱️ ${Math.floor(song.duration_seconds / 60)}:${(song.duration_seconds % 60).toString().padStart(2, '0')}</div>
                        </div>
                        <button class="bees-btn bees-btn-primary admin-add-song-btn" data-title="${song.title}" data-youtube-id="${song.video_id}" data-duration="${song.duration_seconds}" data-is-karaoke="${karaokeMode}" style="flex-shrink: 0; padding: 4px 8px; font-size: 11px; white-space: nowrap; max-width: 85px; min-width: 70px;">➕ Añadir</button>
                    </div>
                `;
                resultsContainer.appendChild(resultItem);
            });
        } else {
            const noResults = document.createElement('li');
            noResults.innerHTML = '<div class="bees-alert bees-alert-warning"><span class="bees-alert-icon">🔍</span><div>No se encontraron resultados</div></div>';
            resultsContainer.appendChild(noResults);
        }
    } catch (error) {
        const errorItem = document.createElement('li');
        errorItem.innerHTML = `<div class="bees-alert bees-alert-danger"><span class="bees-alert-icon">❌</span><div>Error: ${error.message}</div></div>`;
        if (resultsContainer) {
            resultsContainer.appendChild(errorItem);
        }
        console.error('Error en búsqueda:', error);
    } finally {
        if (songsButton) songsButton.disabled = false;
        if (karaokeButton) karaokeButton.disabled = false;
    }
}

async function handleAdminAddSong(event) {
    const button = event.target.closest('.admin-add-song-btn');
    if (!button) return;

    button.disabled = true;
    button.textContent = '⏳ Añadiendo...';

    const songData = {
        titulo: button.dataset.title,
        youtube_id: button.dataset.youtubeId,
        duracion_seconds: parseInt(button.dataset.duration, 10),
        is_karaoke: button.dataset.isKaraoke === 'true'  // Convertir string a boolean
    };

    const targetTableId = document.getElementById('admin-target-table').value;
    let endpoint;

    if (targetTableId) {
        endpoint = `/admin/mesas/${targetTableId}/add-song`;
    } else {
        endpoint = '/canciones/admin/add';
    }

    try {
        await apiFetch(endpoint, {
            method: 'POST',
            body: JSON.stringify(songData)
        });

        const targetName = targetTableId ? 'la mesa' : 'la cola general';
        showNotification(`✅ '${songData.titulo}' añadida a ${targetName}`, 'success');

        // NO limpiar la lista de búsqueda - mantenerla para agregar más canciones
        // document.getElementById('admin-search-results').innerHTML = '';
        // document.getElementById('admin-search-input').value = '';

        // Recargar la cola
        await reloadApprovedQueue();

    } catch (error) {
        showNotification(error.message, 'error');
    } finally {
        button.disabled = false;
        button.textContent = '➕ Añadir';
    }
}

async function reloadApprovedQueue() {
    try {
        const queueData = await apiFetch(`/canciones/cola/extended?_=${Date.now()}`);
        currentQueueData = queueData;

        const approvedSongsList = document.getElementById('approved-songs-list');
        if (approvedSongsList) {
            renderApprovedSongs(queueData, approvedSongsList);
        }

        const lazySongsList = document.getElementById('lazy-songs-list');
        if (lazySongsList) {
            renderLazySongs(queueData.lazy_queue || [], lazySongsList);
        }


    } catch (error) {
        console.error('Error al recargar cola:', error);
    }
}

async function handleQueueActions(event) {
    const button = event.target.closest('button[data-action]');
    if (!button) return;

    const songId = button.dataset.id;
    const action = button.dataset.action;

    if (!action) return;

    button.disabled = true;
    const originalText = button.textContent;
    let shouldReloadQueue = false;

    try {
        if (action === 'play-song') {
            // Enviar orden de reproducir al player
            try {
                await apiFetch(`/canciones/${songId}/play`, { method: 'POST' });
                showNotification('▶️ Reproduciendo en player', 'success');
            } catch (error) {
                showNotification(`Error al reproducir: ${error.message}`, 'error');
            }

        } else if (action === 'remove') {
            if (!confirm('¿Eliminar esta canción?')) {
                button.disabled = false;
                return;
            }
            await apiFetch(`/canciones/${songId}/rechazar`, { method: 'POST' });
            showNotification('❌ Canción eliminada', 'info');
            shouldReloadQueue = true;

        } else if (action === 'restart') {
            try {
                await apiFetch(`/admin/canciones/restart`, { method: 'POST' });
                showNotification('🔄 Canción reiniciada', 'info');
            } catch (e) {
                showNotification('Función no disponible', 'warning');
            }

        } else if (action === 'play-next') {
            if (!confirm('¿Pasar a la siguiente canción?')) {
                button.disabled = false;
                return;
            }
            try {
                // Endpoint para avanzar cola
                await apiFetch('/canciones/siguiente', { method: 'POST' });
                showNotification('⏭️ Cambiando a la siguiente canción...', 'success');
                // No necesitamos reload manual si el websocket hace su trabajo,
                // pero por seguridad podemos activarlo o esperar el broadcast.
            } catch (error) {
                showNotification(`Error al cambiar de canción: ${error.message}`, 'error');
            }

        } else if (action === 'pause-resume-toggle') {
            await handlePauseResume();

        } else if (action === 'move-up') {
            // Mover canción aprobada hacia arriba
            try {
                await apiFetch(`/admin/canciones/${songId}/move-up`, { method: 'POST' });
                showNotification('⬆️ Canción movida hacia arriba', 'info');
                shouldReloadQueue = true;
            } catch (error) {
                showNotification(`Error al mover: ${error.message}`, 'error');
            }

        } else if (action === 'move-down') {
            // Mover canción aprobada hacia abajo
            try {
                await apiFetch(`/admin/canciones/${songId}/move-down`, { method: 'POST' });
                showNotification('⬇️ Canción movida hacia abajo', 'info');
                shouldReloadQueue = true;
            } catch (error) {
                showNotification(`Error al mover: ${error.message}`, 'error');
            }

        } else if (action === 'move-lazy-top') {
            // Mover canción lazy al tope
            try {
                await apiFetch(`/admin/canciones/lazy/${songId}/move-top`, { method: 'POST' });
                showNotification('⏫ Canción movida al tope de la cola', 'info');
                shouldReloadQueue = true;
            } catch (error) {
                showNotification(`Error al mover: ${error.message}`, 'error');
            }

        } else if (action === 'move-lazy-bottom') {
            // Mover canción lazy al final
            try {
                await apiFetch(`/admin/canciones/lazy/${songId}/move-bottom`, { method: 'POST' });
                showNotification('⏬ Canción movida al final de la cola', 'info');
                shouldReloadQueue = true;
            } catch (error) {
                showNotification(`Error al mover: ${error.message}`, 'error');
            }

        } else if (action === 'move-lazy-up') {
            // Mover canción lazy hacia arriba
            try {
                await apiFetch(`/admin/canciones/lazy/${songId}/move-up`, { method: 'POST' });
                showNotification('⬆️ Canción movida hacia arriba en cola', 'info');
                shouldReloadQueue = true;
            } catch (error) {
                showNotification(`Error al mover: ${error.message}`, 'error');
            }

        } else if (action === 'move-lazy-down') {
            // Mover canción lazy hacia abajo
            try {
                await apiFetch(`/admin/canciones/lazy/${songId}/move-down`, { method: 'POST' });
                showNotification('⬇️ Canción movida hacia abajo en cola', 'info');
                shouldReloadQueue = true;
            } catch (error) {
                showNotification(`Error al mover: ${error.message}`, 'error');
            }

        } else if (action === 'remove-lazy') {
            // Eliminar una canción lazy
            if (!confirm('¿Eliminar esta canción de la cola?')) {
                button.disabled = false;
                return;
            }
            try {
                await apiFetch(`/canciones/${songId}/rechazar`, { method: 'POST' });
                showNotification('🗑️ Canción eliminada de la cola', 'info');
                shouldReloadQueue = true;
            } catch (error) {
                showNotification(`Error: ${error.message}`, 'error');
            }

        }

        if (shouldReloadQueue) {
            await reloadApprovedQueue();
        }

    } catch (error) {
        showNotification(`Error: ${error.message}`, 'error');
    } finally {
        button.disabled = false;
        button.textContent = originalText;
    }
}

async function handlePauseResume() {
    const pauseBtn = document.querySelector('button[data-action="pause-resume-toggle"]');
    const originalText = pauseBtn ? pauseBtn.innerHTML : '';

    try {
        // 1. Determine Intent based on current local state
        const isCurrentlyPlaying = playerState.isPlaying;
        const newIsPlaying = !isCurrentlyPlaying;

        // 2. Optimistic UI Update
        playerState.isPlaying = newIsPlaying; // Toggle state immediately
        if (pauseBtn) {
            const playIcon = `<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`;
            const pauseIcon = `<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;
            pauseBtn.innerHTML = newIsPlaying ? pauseIcon : playIcon;
            pauseBtn.title = newIsPlaying ? 'Pausar' : 'Reanudar';
        }

        // 3. API Call
        const endpoint = isCurrentlyPlaying ? '/admin/player/pause' : '/admin/player/resume';
        await apiFetch(endpoint, { method: 'POST' });

        showNotification(newIsPlaying ? '▶️ Reproducción reanudada' : '⏸️ Reproducción pausada', 'info');

        // 4. Reload Queue (Updates UI fully and ensures sync)
        await reloadApprovedQueue();

    } catch (error) {
        console.error('Error toggling pause/resume:', error);

        // Revert on error
        playerState.isPlaying = !playerState.isPlaying;
        if (pauseBtn) {
            pauseBtn.innerHTML = originalText;
        }
        showNotification(`Error: ${error.message}`, 'error');
    }
}

function setupQueueListeners() {
    const songsBtn = document.getElementById('admin-search-songs-btn');
    const karaokeBtn = document.getElementById('admin-search-karaoke-btn');
    const clearBtn = document.getElementById('admin-search-clear-btn');
    const resultsContainer = document.getElementById('admin-search-results');
    const searchInput = document.getElementById('admin-search-input');
    const songsList = document.getElementById('approved-songs-list');
    const lazySongsList = document.getElementById('lazy-songs-list');

    if (songsBtn) {
        songsBtn.addEventListener('click', (e) => handleAdminSearch(e, false));
    }
    if (karaokeBtn) {
        karaokeBtn.addEventListener('click', (e) => handleAdminSearch(e, true));
    }
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            resultsContainer.innerHTML = '';
            searchInput.value = '';
            searchInput.focus();
        });
    }
    if (resultsContainer) {
        resultsContainer.addEventListener('click', handleAdminAddSong);
    }
    if (songsList) {
        songsList.addEventListener('click', handleQueueActions);
    }
    // Agregar listener para los botones de la cola lazy (Esperando Turno)
    if (lazySongsList) {
        lazySongsList.addEventListener('click', handleQueueActions);
    }
}
