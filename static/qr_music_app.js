// ============================================
// CONFIGURACIÓN
// ============================================
const API_BASE_URL = '/api/v1';
const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
const WEBSOCKET_URL = `${wsProtocol}://${window.location.host}/ws/cola`;

// ============================================
// ============================================
// ESTADO DE LA APLICACIÓN
// ============================================
let state = {
    user: null,
    qrKey: null,
    tableQrCode: null,
    localId: 1,
    localNombre: '',
    mesaId: null,
    mesaNombre: '',
    usuarioNumero: 1,
    websocket: null,
    cart: [],
    currentTab: 'tab-queue'
};

// ============================================
// ELEMENTOS DEL DOM
// ============================================
const loginContainer = document.getElementById('login-container');
const dashboardView = document.getElementById('dashboard-view');
const nickInput = document.getElementById('nick-input');
const connectButton = document.getElementById('connect-button');
const errorMessage = document.getElementById('error-message');
const notificationBanner = document.getElementById('notification-banner');
const cartModal = document.getElementById('cart-modal');
const catalogList = document.getElementById('product-catalog-list');

// ============================================
// FUNCIONES DE RENDERIZADO
// ============================================

function renderQueue(queueData) {
    const nowPlayingContainer = document.getElementById('now-playing-container');
    const upcomingList = document.getElementById('upcoming-list');
    nowPlayingContainer.innerHTML = '';
    upcomingList.innerHTML = '';

    if (!queueData) return;

    let nowPlaying = null;
    let allUpcoming = [];
    

    if (Array.isArray(queueData)) {
        allUpcoming = queueData;
    } else {
        nowPlaying = queueData.now_playing;
        if (queueData.upcoming) {
            allUpcoming.push(...queueData.upcoming);
        }
        if (queueData.lazy_queue) {
            allUpcoming.push(...queueData.lazy_queue);
        }
        if (queueData.pending) {
            allUpcoming.push(...queueData.pending);
        }
    }

    if (nowPlaying) {
        nowPlayingContainer.innerHTML = createSongItemHTML(nowPlaying, false);
    } else {
        nowPlayingContainer.innerHTML = '<p>La cola está vacía. ¡Añade una canción!</p>';
    }

    // Filtrar duplicados por ID y excluir la que ya se está reproduciendo
    const uniqueUpcoming = [];
    const seenIds = new Set();
    
    if (nowPlaying && nowPlaying.id) {
        seenIds.add(nowPlaying.id);
    }

    allUpcoming.forEach(song => {
        if (song && song.id && !seenIds.has(song.id)) {
            seenIds.add(song.id);
            uniqueUpcoming.push(song);
        }
    });

    if (uniqueUpcoming.length > 0) {
        uniqueUpcoming.forEach(song => {
            upcomingList.innerHTML += createSongItemHTML(song, false);
        });
    } else if (!nowPlaying) {
        upcomingList.innerHTML = '';
    } else {
        upcomingList.innerHTML = '<li><p>No hay más canciones en la cola.</p></li>';
    }
}

function createSongItemHTML(song, isMyList) {
    const statusClass = `status-${song.estado}`;
    const canDelete = isMyList && (song.estado === 'pendiente' || song.estado === 'aprobado' || song.estado === 'pendiente_lazy');
    // Permitir mover canciones en pendiente, pendiente_lazy O aprobado
    const canMove = isMyList && (song.estado === 'pendiente' || song.estado === 'pendiente_lazy' || song.estado === 'aprobado');
    const scoreInfo = isMyList && song.estado === 'cantada' && song.puntuacion_ia ?
        `<div class="song-score">Puntaje: <strong>${song.puntuacion_ia}</strong></div>` : '';
    const deleteButton = `<button class="delete-song-btn" data-song-id="${song.id}">Eliminar</button>`;
    const moveButtons = canMove ? `
        <div class="song-move-buttons">
            <button class="move-up-btn" data-song-id="${song.id}" title="Mover hacia arriba">⬆️</button>
            <button class="move-down-btn" data-song-id="${song.id}" title="Mover hacia abajo">⬇️</button>
        </div>
    ` : '';

    return `
        <li class="song-item" id="song-${song.id}">
            <div class="song-item-info">
                <img src="https://i.ytimg.com/vi/${song.youtube_id}/mqdefault.jpg" alt="Miniatura">
                <div>
                    <div class="song-title">${song.titulo}</div>
                    ${song.usuario ? `<div class="song-user">por: ${song.usuario.nick}</div>` : ''}
                </div>
            </div>
            <div>
                ${scoreInfo}
                ${isMyList && (song.estado === 'cantada' || song.estado === 'rechazada') ? `<span class="song-status ${statusClass}">${song.estado}</span>` : ''}
                ${moveButtons}
                ${canDelete ? deleteButton : ''}
            </div>
        </li>
    `;
}

function renderCatalog(products) {
    catalogList.innerHTML = '';
    const availableProducts = products.filter(p => p.is_active && p.stock > 0);
    const addAllBtn = document.getElementById('add-all-btn');

    if (availableProducts.length > 0) {
        availableProducts.forEach(product => {
            const productCard = document.createElement('div');
            productCard.className = 'product-card';
            const imageUrl = product.imagen_url || `https://placehold.co/300x200/FFD700/1A1A1A?text=${encodeURIComponent(product.nombre)}`;
            productCard.innerHTML = `
                <img src="${imageUrl}" alt="${product.nombre}" onerror="this.onerror=null;this.src='https://placehold.co/300x200/FFD700/1A1A1A?text=Imagen+no+disponible';">
                <div class="product-card-body">
                    <h3 class="product-card-title">${product.nombre}</h3>
                    <p class="product-card-category">${product.categoria}</p>
                    <div class="product-card-footer">
                        <span class="product-price">$${product.valor}</span>
                        <div class="add-btn-container" data-product-id="${product.id}" data-product-name="${product.nombre}" data-product-stock="${product.stock}" data-product-price="${product.valor}" data-quantity="0">
                            <button class="add-to-cart-btn">Añadir</button>
                        </div>
                    </div>
                </div>
            `;
            catalogList.appendChild(productCard);
        });
        addAllBtn.classList.add('hidden');
    } else {
        catalogList.innerHTML = '<p>No hay productos disponibles en este momento.</p>';
        addAllBtn.classList.add('hidden');
    }
}

function renderCart() {
    const cartItemsList = document.getElementById('cart-items-list');
    const cartCount = document.getElementById('cart-count');
    const confirmCartBtn = document.getElementById('confirm-cart-order-btn');
    const cartBtn = document.getElementById('cart-btn');

    const totalItems = state.cart.reduce((sum, item) => sum + item.cantidad, 0);
    cartCount.textContent = totalItems;

    if (state.cart.length === 0) {
        cartItemsList.innerHTML = '<p>Tu carrito está vacío.</p>';
        confirmCartBtn.disabled = true;
        cartBtn.classList.add('hidden');
    } else {
        cartItemsList.innerHTML = '';
        state.cart.forEach(item => {
            cartItemsList.innerHTML += `
                <div class="cart-item">
                    <span class="cart-item-name">${item.cantidad}x ${item.nombre}</span>
                    <button class="cart-remove-item-btn" data-product-id="${item.producto_id}">X</button>
                </div>
            `;
        });
        confirmCartBtn.disabled = false;
        cartBtn.classList.remove('hidden');
    }
}

function addToCart(productId, productName, stock) {
    const existingItem = state.cart.find(item => item.producto_id === productId);
    if (existingItem) {
        if (existingItem.cantidad < stock) existingItem.cantidad++;
    } else {
        state.cart.push({ producto_id: productId, cantidad: 1 });
    }
    renderCart();
}

function renderMyList(songs) {
    const myListContainer = document.getElementById('my-song-list');
    if (!myListContainer) return;

    if (!songs || songs.length === 0) {
        myListContainer.innerHTML = '<p>No tienes canciones en tu lista todavía 🎤</p>';
        return;
    }

    myListContainer.innerHTML = songs.map(song => createSongItemHTML(song, true)).join('');
}

function showNotification(message, type = 'success', duration = 3000) {
    notificationBanner.textContent = message;
    notificationBanner.classList.remove('success', 'error');
    notificationBanner.classList.add(type);
    notificationBanner.style.top = '20px';

    setTimeout(() => {
        notificationBanner.style.top = '-100px';
    }, duration);
}

// ============================================
// WEBSOCKET
// ============================================

function connectWebSocket() {
    const localParam = state.localId ? `?local=${encodeURIComponent(state.localId)}` : '';
    const wsUrl = `${WEBSOCKET_URL}${localParam}`;
    console.log(`🔌 [WS Auditoría] Conectando a: ${wsUrl}`);
    state.websocket = new WebSocket(wsUrl);

    state.websocket.onopen = () => {
        console.log(`🟢 [WS Auditoría] Conexión WebSocket establecida para sede ${state.localId || 'General'}.`);
    };

    state.websocket.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            console.log("📥 [WS Auditoría] Mensaje recibido del servidor:", data);

            if (data.type) {
                if (data.type === 'notification' || data.type === 'admin_notification') {
                    showNotification(data.payload.mensaje);
                } else if (data.type === 'product_update') {
                    fetchProducts();
                } else if (data.type === 'queue_update') {
                    renderQueue(data.payload);
                } else if (data.type === 'song_finished') {
                    fetchMyList();
                    fetchUserProfile();
                } else if (data.type === 'consumo_deleted' || data.type === 'consumo_created') {
                    fetchTableAccountStatus();
                } else if (data.type === 'reaction') {
                    const reactionPayload = data.payload;
                    if (reactionPayload && reactionPayload.reaction) {
                        const emoji = document.createElement('div');
                        emoji.className = 'reaction-emoji';
                        emoji.textContent = reactionPayload.reaction;
                        emoji.style.left = `${Math.random() * 90 + 5}%`;
                        emoji.style.setProperty('--tx', `${(Math.random() - 0.5) * 100}px`);
                        document.getElementById('reaction-container').appendChild(emoji);
                        setTimeout(() => emoji.remove(), 5000);
                    }
                } else if (data.type === 'update_account') {
                    if (state.user && state.user.mesa && data.mesa_id === state.user.mesa.id) {
                        fetchTableAccountStatus();
                    }
                } else if (data.type === 'points_decayed') {
                    fetchUserProfile();
                }
            } else {
                renderQueue(data);
            }
        } catch (err) {
            console.warn("⚠️ [WS Auditoría] Error al procesar mensaje JSON entrante:", err);
        }
    };

    state.websocket.onclose = (event) => {
        console.log(`🔴 [WS Auditoría] Conexión WebSocket cerrada. Intentando reconectar en 5 segundos...`);
        setTimeout(connectWebSocket, 5000);
    };

    state.websocket.onerror = (error) => {
        console.error('❌ [WS Auditoría] Error detectado en WebSocket:', error);
        state.websocket.close();
    };
}

// ============================================
// LÓGICA DE API Y EVENTOS
// ============================================

async function performConnect(nick) {
    if (!nick) {
        errorMessage.textContent = 'Por favor, introduce un apodo.';
        return null;
    }

    connectButton.disabled = true;
    connectButton.textContent = 'Conectando...';
    errorMessage.textContent = '';

    try {
        const response = await fetch(`${API_BASE_URL}/mesas/conectar-key?key=${encodeURIComponent(state.qrKey)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nick: nick }),
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.detail || 'Ocurrió un error al conectar.');
        }
        state.user = data;
        sessionStorage.setItem('karaokeUser', JSON.stringify(state.user));
        sessionStorage.setItem('karaokeKey', state.qrKey);

        await fetchUserProfile();
        showDashboard();
        return data;
    } catch (error) {
        errorMessage.textContent = error.message;
        return null;
    } finally {
        connectButton.disabled = false;
        connectButton.textContent = 'Conectar';
    }
}

async function handleLogin(event) {
    event.preventDefault();
    const nick = nickInput.value.trim();
    await performConnect(nick);
}

async function attemptAutoConnectFromQr() {
    try {
        const match = state.tableQrCode && state.tableQrCode.match(/^karaoke-mesa-(\d+)-usuario(\d+)$/i);
        if (!match) return;
        const mesaNumRaw = match[1];
        const userNum = match[2];
        // Normalize mesa number to two digits if needed
        const mesaNum = mesaNumRaw.padStart ? mesaNumRaw.padStart(2, '0') : mesaNumRaw;
        const qrBase = `karaoke-mesa-${mesaNum}`;

        // Try to fetch mesa to get its display name; fallback to 'Mesa <n>' if not available
        let mesaNombre = null;
        try {
            const mesaResp = await fetch(`${API_BASE_URL}/mesas/${encodeURIComponent(qrBase)}`);
            if (mesaResp.ok) {
                const mesaData = await mesaResp.json();
                mesaNombre = mesaData.nombre;
            }
        } catch (e) {
            console.warn('Could not fetch mesa details for auto-connect:', e);
        }

        if (!mesaNombre) {
            mesaNombre = `Mesa ${parseInt(mesaNumRaw, 10)}`;
        }

        const nick = `${mesaNombre}-Usuario${userNum}`;
        console.log('Attempting auto-connect with nick:', nick);
        const res = await performConnect(nick);
        if (!res) {
            console.warn('Auto-connect failed for nick:', nick);
        }
    } catch (e) {
        console.error('Error in attemptAutoConnectFromQr:', e);
    }
}

function handleLogout() {
    if (confirm('¿Estás seguro de que quieres cerrar la sesión?')) {
        sessionStorage.removeItem('karaokeUser');
        // Opcional: sessionStorage.removeItem('karaokeTable'); si queremos obligar a re-escanear
        window.location.reload();
    }
}

async function handleSearch(event, karaokeMode = false) {
    event.preventDefault();
    const query = document.getElementById('search-input').value.trim();
    if (!query) return;

    const songsButton = document.getElementById('search-songs-btn');
    const karaokeButton = document.getElementById('search-karaoke-btn');
    songsButton.disabled = true;
    karaokeButton.disabled = true;

    const clickedButton = karaokeMode ? karaokeButton : songsButton;
    const originalText = clickedButton.textContent;
    clickedButton.textContent = 'Buscando...';

    const resultsContainer = document.getElementById('search-results');
    resultsContainer.innerHTML = '<p>Buscando...</p>';

    try {
        const url = `${API_BASE_URL}/youtube/public-search?q=${encodeURIComponent(query)}${karaokeMode ? '&karaoke_mode=true' : ''}`;
        const response = await fetch(url);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || `Error del servidor: ${response.status}`);
        }

        const results = await response.json();
        resultsContainer.innerHTML = '';
        if (results.length > 0) {
            results.forEach(song => {
                resultsContainer.innerHTML += `
                    <li class="song-item">
                        <div class="song-item-info">
                            <img src="${song.thumbnail}" alt="Miniatura">
                            <div>
                                <div class="song-title">${song.title}</div>
                                <div class="song-user">${Math.floor(song.duration_seconds / 60)}:${(song.duration_seconds % 60).toString().padStart(2, '0')}</div>
                            </div>
                        </div>
                        <button class="add-song-btn" data-title="${song.title}" data-youtube-id="${song.video_id}" data-duration="${song.duration_seconds}" data-is-karaoke="${karaokeMode}">Añadir</button>
                    </li>
                `;
            });
        } else {
            resultsContainer.innerHTML = '<p>No se encontraron resultados.</p>';
        }
    } catch (error) {
        resultsContainer.innerHTML = `<p class="error-msg">Error al buscar: ${error.message}</p>`;
    } finally {
        songsButton.disabled = false;
        karaokeButton.disabled = false;
        clickedButton.textContent = originalText;
    }
}

async function handleAddSong(event) {
    if (!event.target.classList.contains('add-song-btn')) return;

    const button = event.target;
    button.disabled = true;
    button.textContent = 'Añadiendo...';

    const songData = {
        titulo: button.dataset.title,
        youtube_id: button.dataset.youtubeId,
        duracion_seconds: parseInt(button.dataset.duration, 10),
        is_karaoke: button.dataset.isKaraoke === 'true'  // Convertir string a boolean
    };

    try {
        const response = await fetch(`${API_BASE_URL}/canciones/${state.user.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(songData)
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.detail || 'Error al añadir la canción.');
        }
        showNotification(`'${songData.titulo}' añadida a tu lista.`);
        fetchMyList();
    } catch (error) {
        showNotification(error.message, 'error', 5000);
    } finally {
        button.disabled = false;
        button.textContent = 'Añadir';
    }
}

async function handleAddToCart(event) {
    // Find the container (works for both button clicks and quantity button clicks)
    const container = event.target.closest('.add-btn-container');
    if (!container) return;

    const productId = container.dataset.productId;
    const productName = container.dataset.productName;
    const productStock = parseInt(container.dataset.productStock, 10);
    let currentQuantity = parseInt(container.dataset.quantity, 10);

    // Determine which button was clicked
    if (event.target.classList.contains('add-to-cart-btn')) {
        // Initial "Añadir" button clicked
        currentQuantity = 1;
        updateQuantityDisplay(container, currentQuantity);
        updateCartQuantity(productId, productName, currentQuantity);
        showNotification(`${productName} añadido al carrito.`, 'success', 1500);
    } else if (event.target.classList.contains('quantity-btn-plus')) {
        // Plus button clicked
        if (currentQuantity < productStock) {
            currentQuantity++;
            updateQuantityDisplay(container, currentQuantity);
            updateCartQuantity(productId, productName, currentQuantity);
        }
    } else if (event.target.classList.contains('quantity-btn-minus')) {
        // Minus button clicked
        currentQuantity--;
        if (currentQuantity === 0) {
            // Return to "Añadir" button state
            updateQuantityDisplay(container, 0);
            removeFromCart(productId);
        } else {
            updateQuantityDisplay(container, currentQuantity);
            updateCartQuantity(productId, productName, currentQuantity);
        }
    }
}

function updateQuantityDisplay(container, quantity) {
    container.dataset.quantity = quantity;

    if (quantity === 0) {
        // Show "Añadir" button
        container.innerHTML = '<button class="add-to-cart-btn">Añadir</button>';
    } else {
        // Show quantity counter
        container.innerHTML = `
            <div class="quantity-counter">
                <button class="quantity-btn quantity-btn-minus">−</button>
                <span class="quantity-display">${quantity}</span>
                <button class="quantity-btn quantity-btn-plus">+</button>
            </div>
        `;
    }
}

function updateCartQuantity(productId, productName, quantity) {
    const existingItem = state.cart.find(item => item.producto_id === productId);
    if (existingItem) {
        existingItem.cantidad = quantity;
    } else {
        state.cart.push({ producto_id: productId, nombre: productName, cantidad: quantity });
    }
    renderCart();
}

function removeFromCart(productId) {
    state.cart = state.cart.filter(item => item.producto_id !== productId);
    renderCart();
}

async function handleAddAllToCart() {
    const products = document.querySelectorAll('.add-to-cart-btn');
    let count = 0;
    products.forEach(btn => {
        const productId = btn.dataset.productId;
        const productName = btn.dataset.productName;
        const productStock = parseInt(btn.dataset.productStock, 10);
        addToCart(productId, productName, productStock);
        count++;
    });
    showNotification(`${count} productos añadidos al carrito.`, 'success', 2000);
}

async function handlePlaceOrder() {
    if (state.cart.length === 0) return;

    const confirmBtn = document.getElementById('confirm-cart-order-btn');
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Enviando...';

    const cartPayload = { items: state.cart };

    try {
        const response = await fetch(`${API_BASE_URL}/consumos/pedir/carrito/${state.user.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cartPayload)
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || 'Error al procesar el pedido.');

        showNotification('¡Pedido realizado con éxito!', 'success');
        state.cart = [];
        renderCart();

        // Reset all product buttons in the catalog
        const addBtnContainers = document.querySelectorAll('.add-btn-container');
        addBtnContainers.forEach(container => {
            updateQuantityDisplay(container, 0);
        });

        cartModal.style.display = 'none';
        fetchUserProfile();
        fetchTableAccountStatus();
    } catch (error) {
        showNotification(`Error: ${error.message}`, 'error', 5000);
    } finally {
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Hacer Pedido';
    }
}

async function handleDeleteSong(event) {
    if (!event.target.classList.contains('delete-song-btn')) return;
    if (!confirm('¿Seguro que quieres eliminar esta canción de tu lista?')) return;

    const button = event.target;
    const songId = button.dataset.songId;
    button.disabled = true;

    try {
        const response = await fetch(`${API_BASE_URL}/canciones/${songId}?usuario_id=${state.user.id}`, {
            method: 'DELETE',
        });
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.detail || 'No se pudo eliminar la canción.');
        }
        showNotification('Canción eliminada.');
        fetchMyList();
    } catch (error) {
        console.error('Error al eliminar canción:', error);
        showNotification(error.message, 'error', 4000);
    } finally {
        button.disabled = false;
    }
}

async function handleMoveSongUp(event) {
    if (!event.target.classList.contains('move-up-btn')) return;

    const button = event.target;
    const songId = button.dataset.songId;
    button.disabled = true;

    try {
        const response = await fetch(
            `${API_BASE_URL}/canciones/${songId}/mover-arriba?usuario_id=${state.user.id}`,
            { method: 'POST' }
        );
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.detail || 'No se pudo mover la canción.');
        }
        showNotification('Canción movida hacia arriba.');
        fetchMyList();
    } catch (error) {
        console.error('Error al mover canción:', error);
        showNotification(error.message, 'error', 4000);
    } finally {
        button.disabled = false;
    }
}

async function handleMoveSongDown(event) {
    if (!event.target.classList.contains('move-down-btn')) return;

    const button = event.target;
    const songId = button.dataset.songId;
    button.disabled = true;

    try {
        const response = await fetch(
            `${API_BASE_URL}/canciones/${songId}/mover-abajo?usuario_id=${state.user.id}`,
            { method: 'POST' }
        );
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.detail || 'No se pudo mover la canción.');
        }
        showNotification('Canción movida hacia abajo.');
        fetchMyList();
    } catch (error) {
        console.error('Error al mover canción:', error);
        showNotification(error.message, 'error', 4000);
    } finally {
        button.disabled = false;
    }
}

async function fetchProducts() {
    catalogList.innerHTML = '<p>Cargando catálogo...</p>';
    const localId = state.localId || (state.user && state.user.local_id) || (state.user && state.user.mesa && state.user.mesa.local_id) || 1;
    const response = await fetch(`${API_BASE_URL}/productos/?local_id=${localId}`);
    const products = await response.json();
    renderCatalog(products);
}

async function fetchTableAccountStatus() {
    const mesaId = (state.user && state.user.mesa && state.user.mesa.id) || state.mesaId;
    if (!mesaId) {
        console.warn("User or table information is missing, cannot fetch account status.");
        const container = document.getElementById('my-account-content');
        container.innerHTML = '<p class="error-msg">No se pudo cargar el estado de cuenta. Información de mesa no disponible.</p>';
        return;
    }

    const container = document.getElementById('my-account-content');
    container.innerHTML = '<p>Cargando estado de cuenta...</p>';

    try {
        const response = await fetch(`${API_BASE_URL}/mesas/${mesaId}/payment-status`);

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || 'No se pudo cargar la cuenta.');
        }
        const data = await response.json();

        const saldoPendienteNum = parseFloat(data.saldo_pendiente);
        const totalConsumidoNum = parseFloat(data.total_consumido);
        const totalPagadoNum = parseFloat(data.total_pagado);
        const saldoClass = saldoPendienteNum > 0 ? 'saldo-debe' : 'saldo-ok';

        container.innerHTML = `
        <div id="mi-consumo">
            <h3>Cuenta de Mesa: ${data.mesa_nombre}</h3>
            <div class="account-summary">
                <p>Total Consumido: <strong id="total-consumido">$${totalConsumidoNum.toFixed(2)}</strong></p>
                <p>Total Pagado: <strong id="total-pagado" style="color: var(--bees-green);">$${totalPagadoNum.toFixed(2)}</strong></p>
                <p>Saldo: <strong id="saldo" class="saldo-pendiente ${saldoClass}">$${saldoPendienteNum.toFixed(2)}</strong></p>
            </div>

            <details style="margin-top: 20px;">
                <summary style="cursor:pointer; color: var(--bees-yellow-dark); font-weight: bold;">Ver Detalles de Consumos y Pagos</summary>
                <div style="margin-top: 10px; display: grid; grid-template-columns: 1fr; gap: 15px;">
                    <div class="details-section">
                        <h4>Consumos</h4>
                        <ul id="lista-consumos" class="item-list">
                            ${data.consumos.length > 0 ? data.consumos.map(c => `
                                <li style="font-size:0.9em; padding: 4px 0;">${c.cantidad}x ${c.producto_nombre} - $${parseFloat(c.valor_total).toFixed(2)} <span style="color: #999; font-size: 0.9em;">(${new Date(c.created_at).toLocaleTimeString()})</span></li>
                            `).join('') : '<li>No hay consumos registrados.</li>'}
                        </ul>
                    </div>
                    <div class="details-section">
                        <h4>Pagos</h4>
                        <ul id="lista-pagos" class="item-list">
                            ${data.pagos.length > 0 ? data.pagos.map(p => `
                                <li style="font-size:0.9em; padding: 4px 0;">$${parseFloat(p.monto).toFixed(2)} (${p.metodo_pago}) - <span style="color: #999; font-size: 0.9em;">${new Date(p.created_at).toLocaleTimeString()}</span></li>
                            `).join('') : '<li>No hay pagos registrados.</li>'}
                        </ul>
                    </div>
                </div>
            </details>
        </div>
        `;
    } catch (error) {
        container.innerHTML = `<p class="error-msg">${error.message}</p>`;
    }
}

async function fetchQueue() {
    try {
        const localId = state.localId || (state.user && state.user.local_id) || 1;
        console.log(`📡 [WS Auditoría] Cargando cola de canciones vía HTTP para local ${localId}...`);
        const response = await fetch(`${API_BASE_URL}/canciones/cola/extended?local_id=${localId}`);
        if (!response.ok) {
            throw new Error(`Error ${response.status} al obtener la cola.`);
        }
        const queueData = await response.json();
        console.log("📥 [WS Auditoría] Cola de canciones recibida vía HTTP:", queueData);
        renderQueue(queueData);
    } catch (error) {
        console.error("❌ [WS Auditoría] Error al obtener la cola:", error);
    }
}

async function fetchMyList() {
    if (!state.user) return;

    const myListContainer = document.getElementById('my-song-list');
    if (!myListContainer) return;

    myListContainer.innerHTML = '<p>Cargando tu lista...</p>';

    try {
        const response = await fetch(`${API_BASE_URL}/canciones/${state.user.id}/lista`);
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || 'No se pudo obtener la lista.');
        }

        const songs = await response.json();
        renderMyList(songs);
    } catch (error) {
        console.error('Error al obtener mi lista:', error);
        myListContainer.innerHTML = `<p class="error-msg">${error.message}</p>`;
    }
}

async function fetchUserProfile() {
    try {
        const response = await fetch(`${API_BASE_URL}/usuarios/${state.user.id}`);
        if (!response.ok) {
            throw new Error(`Error ${response.status} al obtener el perfil.`);
        }
        const profile = await response.json();
        state.user = profile;

        if (!state.user.mesa || !state.user.mesa.id) {
            state.user.mesa = {
                id: state.mesaId,
                nombre: state.mesaNombre,
                local_id: state.localId
            };
        }

        sessionStorage.setItem('karaokeUser', JSON.stringify(state.user));
        updateProfileCard();
    } catch (error) {
        console.error('Error al actualizar el perfil:', error);
    }
}

function updateProfileCard() {
    document.getElementById('user-nick').textContent = state.user.nick;
    document.getElementById('user-points').textContent = state.user.puntos;
    const levelEl = document.getElementById('user-level');
    levelEl.textContent = state.user.nivel.charAt(0).toUpperCase() + state.user.nivel.slice(1);
}

function showDashboard() {
    const tableBadge = state.localNombre && state.mesaNombre
        ? `${state.localNombre} • ${state.mesaNombre}`
        : (state.mesaNombre || state.tableQrCode || 'Mesa');
    document.getElementById('table-name').textContent = tableBadge;
    updateProfileCard();

    loginContainer.classList.add('hidden');
    dashboardView.classList.remove('hidden');

    connectWebSocket();
    renderCart();
    fetchMyList();
    fetchQueue();
}

function handleTabClick(event) {
    const clickedTab = event.target.closest('.nav-item');
    if (!clickedTab) return;

    document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    clickedTab.classList.add('active');
    const activeTabId = clickedTab.dataset.tab;
    document.getElementById(activeTabId).classList.add('active');
    state.currentTab = activeTabId;

    // Mostrar/ocultar buscador solo en tab-search
    const searchContainer = document.querySelector('.search-container');
    if (activeTabId === 'tab-search') {
        searchContainer.classList.add('active');
    } else {
        searchContainer.classList.remove('active');
    }

    // Cargar contenido según la pestaña
    switch (activeTabId) {
        case 'tab-queue':
            fetchQueue();
            break;
        case 'tab-my-list':
            fetchMyList();
            break;
        case 'tab-catalog':
            fetchProducts();
            break;
        case 'tab-my-account':
            fetchTableAccountStatus();
            break;
    }
}

async function handleSendReaction(event) {
    const reactionBtn = event.target.closest('.reaction-btn');
    if (!reactionBtn) return;

    const reaction = reactionBtn.dataset.emoji;
    const payload = {
        reaction: reaction,
        local_id: state.localId || (state.user && state.user.local_id) || 1,
        sender: state.user ? state.user.nick : "Anónimo"
    };
    try {
        await fetch(`${API_BASE_URL}/broadcast/reaction`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        showNotification('¡Reacción enviada!', 'success', 1500);
    } catch (error) {
        console.error("Error enviando reacción:", error);
    }
}

function getQueryParam(param) {
    return new URLSearchParams(window.location.search).get(param);
}

// ============================================
// INICIALIZACIÓN
// ============================================
window.addEventListener('DOMContentLoaded', async () => {
    state.qrKey = getQueryParam('key') || getQueryParam('table');
    if (!state.qrKey) {
        document.getElementById('welcome-message').textContent = 'Error: Por favor escanea el código QR oficial de tu mesa.';
        if (connectButton) connectButton.disabled = true;
        return;
    }

    // Resolver la clave QR encriptada
    try {
        const resolveResp = await fetch(`${API_BASE_URL}/mesas/resolve-key?key=${encodeURIComponent(state.qrKey)}`);
        if (resolveResp.ok) {
            const data = await resolveResp.json();
            state.localId = data.local_id;
            state.localNombre = data.local_nombre;
            state.mesaId = data.mesa_id;
            state.mesaNombre = data.mesa_nombre;
            state.usuarioNumero = data.usuario_numero;
            state.tableQrCode = data.mesa_nombre;

            const welcomeEl = document.getElementById('welcome-message');
            if (welcomeEl) {
                welcomeEl.textContent = `📍 ${data.local_nombre} • ${data.mesa_nombre} (Usuario ${data.usuario_numero})`;
            }
            if (nickInput && !nickInput.value) {
                nickInput.placeholder = `Ej: Cantante ${data.usuario_numero}`;
            }
        } else {
            const err = await resolveResp.json();
            document.getElementById('welcome-message').textContent = err.detail || 'Código QR inválido o expirado.';
            if (connectButton) connectButton.disabled = true;
            return;
        }
    } catch (e) {
        console.error("Error resolviendo clave QR:", e);
    }

    const storedUser = sessionStorage.getItem('karaokeUser');
    const storedKey = sessionStorage.getItem('karaokeKey');

    if (storedUser && storedKey === state.qrKey) {
        state.user = JSON.parse(storedUser);
        fetchUserProfile();
        showDashboard();
    } else {
        // Si no hay sesión almacenada para esta mesa, intentar auto-conexión si el QR incluye '-usuarioN'
        // COMENTADO: El usuario quiere que siempre se pida el alias manualmente
        // attemptAutoConnectFromQr();
    }

    // Event Listeners
    if (connectButton) connectButton.addEventListener('click', handleLogin);

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);

    const bottomNav = document.querySelector('.bottom-nav');
    if (bottomNav) bottomNav.addEventListener('click', handleTabClick);

    const searchSongsBtn = document.getElementById('search-songs-btn');
    if (searchSongsBtn) searchSongsBtn.addEventListener('click', (e) => handleSearch(e, false));

    const searchKaraokeBtn = document.getElementById('search-karaoke-btn');
    if (searchKaraokeBtn) searchKaraokeBtn.addEventListener('click', (e) => handleSearch(e, true));

    const searchResults = document.getElementById('search-results');
    if (searchResults) searchResults.addEventListener('click', handleAddSong);

    if (catalogList) catalogList.addEventListener('click', handleAddToCart);

    const addAllBtn = document.getElementById('add-all-btn');
    if (addAllBtn) addAllBtn.addEventListener('click', handleAddAllToCart);

    const reactionButtons = document.getElementById('reaction-buttons');
    if (reactionButtons) reactionButtons.addEventListener('click', handleSendReaction);

    const cartBtn = document.getElementById('cart-btn');
    if (cartBtn) {
        cartBtn.addEventListener('click', () => {
            if (cartModal) cartModal.style.display = 'flex';
            renderCart();
        });
    }

    const cancelCartBtn = document.getElementById('cancel-cart-btn');
    if (cancelCartBtn) cancelCartBtn.addEventListener('click', () => cartModal.style.display = 'none');

    const confirmCartOrderBtn = document.getElementById('confirm-cart-order-btn');
    if (confirmCartOrderBtn) confirmCartOrderBtn.addEventListener('click', handlePlaceOrder);

    const cartItemsList = document.getElementById('cart-items-list');
    if (cartItemsList) {
        cartItemsList.addEventListener('click', (e) => {
            if (e.target.classList.contains('cart-remove-item-btn')) {
                const productId = e.target.dataset.productId;
                state.cart = state.cart.filter(item => item.producto_id !== productId);
                renderCart();
                showNotification('Producto eliminado del carrito.', 'success', 1500);
            }
        });
    }

    const mySongList = document.getElementById('my-song-list');
    if (mySongList) {
        mySongList.addEventListener('click', handleDeleteSong);
        mySongList.addEventListener('click', handleMoveSongUp);
        mySongList.addEventListener('click', handleMoveSongDown);
    }
});