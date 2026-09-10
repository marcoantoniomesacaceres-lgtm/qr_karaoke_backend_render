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
    sessionId: null,
    websocket: null,
    cart: [],
    products: [],
    selectedCategory: null,
    catalogSearchQuery: '',
    lastOrder: null,
    lastOrderTime: null,
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
const catalogCategoriesView = document.getElementById('catalog-categories-view');
const catalogProductsView = document.getElementById('catalog-products-view');
const catalogCategoryGrid = document.getElementById('catalog-category-grid');
const catalogCategoryCurrentTitle = document.getElementById('catalog-category-current-title');
const catalogBackToCategoriesBtn = document.getElementById('catalog-back-to-categories-btn');
const catalogSearchInput = document.getElementById('catalog-search-input');
const catalogSearchClearBtn = document.getElementById('catalog-search-clear-btn');
const repeatRoundContainer = document.getElementById('repeat-round-container');
const repeatRoundSummary = document.getElementById('repeat-round-summary');
const repeatRoundPrice = document.getElementById('repeat-round-price');
const repeatRoundTime = document.getElementById('repeat-round-time');
const repeatRoundBtn = document.getElementById('repeat-round-btn');
const repeatRoundModal = document.getElementById('repeat-round-modal');
const repeatRoundModalItems = document.getElementById('repeat-round-modal-items');
const repeatRoundModalTotal = document.getElementById('repeat-round-modal-total');
const confirmRepeatRoundBtn = document.getElementById('confirm-repeat-round-btn');
const editRepeatRoundInCartBtn = document.getElementById('edit-repeat-round-in-cart-btn');
const cancelRepeatRoundBtn = document.getElementById('cancel-repeat-round-btn');

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

function getCategoryIcon(categoria) {
    if (!categoria) return '🍽️';
    const catLower = categoria.toLowerCase();
    if (catLower.includes('cerveza') || catLower.includes('beer') || catLower.includes('pola')) return '🍺';
    if (catLower.includes('licor') || catLower.includes('aguardiente') || catLower.includes('ron') || catLower.includes('whisky') || catLower.includes('whiskey') || catLower.includes('tequila') || catLower.includes('vodka') || catLower.includes('botella') || catLower.includes('gin') || catLower.includes('ginebra') || catLower.includes('vino')) return '🍾';
    if (catLower.includes('coctel') || catLower.includes('cóctel') || catLower.includes('trago') || catLower.includes('shot') || catLower.includes('cocktail')) return '🍸';
    if (catLower.includes('bebida') || catLower.includes('gaseosa') || catLower.includes('soda') || catLower.includes('jugo') || catLower.includes('agua') || catLower.includes('refresco') || catLower.includes('energizante') || catLower.includes('red bull') || catLower.includes('hidratante')) return '🥤';
    if (catLower.includes('comida') || catLower.includes('hamburguesa') || catLower.includes('pizza') || catLower.includes('plato') || catLower.includes('perro') || catLower.includes('alitas') || catLower.includes('sandwich') || catLower.includes('salchipapa')) return '🍔';
    if (catLower.includes('snack') || catLower.includes('pasaboca') || catLower.includes('papas') || catLower.includes('munchies') || catLower.includes('paquete') || catLower.includes('mani') || catLower.includes('maní')) return '🍟';
    if (catLower.includes('dulce') || catLower.includes('postre') || catLower.includes('chocolat') || catLower.includes('chicle') || catLower.includes('helado')) return '🍫';
    if (catLower.includes('cafe') || catLower.includes('café') || catLower.includes('caliente') || catLower.includes('te') || catLower.includes('té') || catLower.includes('aromatica')) return '☕';
    return '🍽️';
}

function renderCategories(products) {
    if (!catalogCategoryGrid) return;
    catalogCategoryGrid.innerHTML = '';

    const availableProducts = (products || []).filter(p => p.is_active && p.stock > 0);

    if (availableProducts.length === 0) {
        catalogCategoryGrid.innerHTML = '<p class="empty-catalog-msg" style="grid-column: 1 / -1; text-align: center; color: #718096; padding: 24px;">No hay productos disponibles en este momento.</p>';
        return;
    }

    const categoryMap = {};
    availableProducts.forEach(p => {
        const cat = (p.categoria || 'Varios').trim();
        if (!categoryMap[cat]) {
            categoryMap[cat] = {
                nombre: cat,
                count: 0
            };
        }
        categoryMap[cat].count++;
    });

    const categories = Object.values(categoryMap).sort((a, b) => a.nombre.localeCompare(b.nombre));

    categories.forEach(cat => {
        const icon = getCategoryIcon(cat.nombre);
        const card = document.createElement('div');
        card.className = 'category-card';
        card.dataset.category = cat.nombre;
        card.innerHTML = `
            <div class="category-icon">${icon}</div>
            <div class="category-name">${cat.nombre}</div>
            <span class="category-count">${cat.count} ${cat.count === 1 ? 'producto' : 'productos'}</span>
        `;
        catalogCategoryGrid.appendChild(card);
    });
}

function showAllCategories() {
    state.selectedCategory = null;
    state.catalogSearchQuery = '';
    if (catalogSearchInput) catalogSearchInput.value = '';
    if (catalogSearchClearBtn) catalogSearchClearBtn.classList.add('hidden');
    if (catalogCategoriesView) catalogCategoriesView.classList.remove('hidden');
    if (catalogProductsView) catalogProductsView.classList.add('hidden');
}

function showCategoryProducts(categoryName) {
    state.selectedCategory = categoryName;
    state.catalogSearchQuery = '';
    if (catalogSearchInput) catalogSearchInput.value = '';
    if (catalogSearchClearBtn) catalogSearchClearBtn.classList.add('hidden');

    if (catalogCategoriesView) catalogCategoriesView.classList.add('hidden');
    if (catalogProductsView) catalogProductsView.classList.remove('hidden');

    const icon = getCategoryIcon(categoryName);
    if (catalogCategoryCurrentTitle) {
        catalogCategoryCurrentTitle.textContent = `${icon} ${categoryName}`;
    }

    const filtered = (state.products || []).filter(p => p.is_active && p.stock > 0 && ((p.categoria || 'Varios').trim().toLowerCase() === categoryName.trim().toLowerCase()));
    renderProductCards(filtered);
}

function handleCatalogSearch(query) {
    const q = (query || '').trim().toLowerCase();
    state.catalogSearchQuery = q;

    if (!q) {
        if (catalogSearchClearBtn) catalogSearchClearBtn.classList.add('hidden');
        if (state.selectedCategory) {
            showCategoryProducts(state.selectedCategory);
        } else {
            showAllCategories();
        }
        return;
    }

    if (catalogSearchClearBtn) catalogSearchClearBtn.classList.remove('hidden');
    if (catalogCategoriesView) catalogCategoriesView.classList.add('hidden');
    if (catalogProductsView) catalogProductsView.classList.remove('hidden');

    if (catalogCategoryCurrentTitle) {
        catalogCategoryCurrentTitle.textContent = `🔍 Resultados para "${query.trim()}"`;
    }

    const filtered = (state.products || []).filter(p => {
        if (!p.is_active || p.stock <= 0) return false;
        const nombre = (p.nombre || '').toLowerCase();
        const categoria = (p.categoria || '').toLowerCase();
        const descripcion = (p.descripcion || '').toLowerCase();
        return nombre.includes(q) || categoria.includes(q) || descripcion.includes(q);
    });

    renderProductCards(filtered);
}

function renderProductCards(products) {
    if (!catalogList) return;
    catalogList.innerHTML = '';

    if (!products || products.length === 0) {
        catalogList.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; color: #718096; padding: 24px;">No se encontraron productos disponibles.</p>';
        return;
    }

    products.forEach(product => {
        const productCard = document.createElement('div');
        productCard.className = 'product-card';
        const imageUrl = product.imagen_url || `https://placehold.co/300x200/FFD700/1A1A1A?text=${encodeURIComponent(product.nombre)}`;
        const cartItem = state.cart.find(item => String(item.producto_id) === String(product.id));
        const currentQty = cartItem ? cartItem.cantidad : 0;

        productCard.innerHTML = `
            <img src="${imageUrl}" alt="${product.nombre}" onerror="this.onerror=null;this.src='https://placehold.co/300x200/FFD700/1A1A1A?text=Imagen+no+disponible';">
            <div class="product-card-body">
                <h3 class="product-card-title">${product.nombre}</h3>
                <p class="product-card-category">${product.categoria || ''}</p>
                <div class="product-card-footer">
                    <span class="product-price">$${parseFloat(product.valor).toFixed(2)}</span>
                    <div class="add-btn-container" data-product-id="${product.id}" data-product-name="${product.nombre}" data-product-stock="${product.stock}" data-product-price="${product.valor}" data-quantity="${currentQty}">
                        ${currentQty > 0 ? `
                            <div class="quantity-counter">
                                <button class="quantity-btn quantity-btn-minus">−</button>
                                <span class="quantity-display">${currentQty}</span>
                                <button class="quantity-btn quantity-btn-plus">+</button>
                            </div>
                        ` : `
                            <button class="add-to-cart-btn">Añadir</button>
                        `}
                    </div>
                </div>
            </div>
        `;
        catalogList.appendChild(productCard);
    });
}

function renderCatalog(products) {
    state.products = products || [];
    renderCategories(state.products);
    updateRepeatRoundUI();
    if (state.catalogSearchQuery) {
        handleCatalogSearch(state.catalogSearchQuery);
    } else if (state.selectedCategory) {
        showCategoryProducts(state.selectedCategory);
    } else {
        showAllCategories();
    }
}

function extractLastRoundFromConsumos(consumos) {
    if (!consumos || consumos.length === 0) return null;
    const validConsumos = consumos.filter(c => c && !c.is_cancelled);
    if (validConsumos.length === 0) return null;

    const sorted = [...validConsumos].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const latestTime = new Date(sorted[0].created_at).getTime();

    const latestBatch = sorted.filter(c => Math.abs(new Date(c.created_at).getTime() - latestTime) <= 15000);

    return {
        items: latestBatch.map(c => ({
            producto_id: c.producto_id,
            nombre: c.producto_nombre || 'Producto',
            cantidad: c.cantidad || 1,
            valor_total: parseFloat(c.valor_total) || 0
        })),
        time: sorted[0].created_at
    };
}

function updateRepeatRoundUI(roundData = null) {
    if (!repeatRoundContainer) return;

    if (!roundData) {
        if (state.lastOrder && state.lastOrder.length > 0) {
            roundData = {
                items: state.lastOrder,
                time: state.lastOrderTime || new Date()
            };
        } else {
            const storageKey = 'karaokeLastOrder_' + (state.sessionId || (state.user && state.user.id) || 'default');
            const saved = localStorage.getItem(storageKey);
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    if (parsed && parsed.items && parsed.items.length > 0) {
                        roundData = parsed;
                        state.lastOrder = parsed.items;
                        state.lastOrderTime = parsed.time;
                    }
                } catch (e) {
                    console.warn('Error parsing saved last order', e);
                }
            }
        }
    }

    if (!roundData || !roundData.items || roundData.items.length === 0) {
        repeatRoundContainer.classList.add('hidden');
        return;
    }

    let total = 0;
    const summaryBadges = roundData.items.map(item => {
        let itemTotal = item.valor_total;
        if (!itemTotal) {
            const prod = state.products ? state.products.find(p => String(p.id) === String(item.producto_id)) : null;
            const unitPrice = prod ? parseFloat(prod.valor) : 0;
            itemTotal = unitPrice * (item.cantidad || 1);
        }
        total += itemTotal;
        return `<span class="repeat-round-items-badge"><strong>${item.cantidad}x</strong> ${item.nombre}</span>`;
    }).join(' ');

    if (repeatRoundSummary) repeatRoundSummary.innerHTML = summaryBadges;
    if (repeatRoundPrice) repeatRoundPrice.textContent = `Total: $${total.toFixed(2)}`;

    if (repeatRoundTime && roundData.time) {
        try {
            const dateObj = new Date(roundData.time);
            const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            repeatRoundTime.textContent = `Último pedido a las ${timeStr}`;
        } catch (e) {
            repeatRoundTime.textContent = 'Pedido anterior';
        }
    }

    repeatRoundContainer.classList.remove('hidden');
}

function openRepeatRoundModal() {
    if (!state.lastOrder || state.lastOrder.length === 0) {
        showNotification('No hay un pedido anterior registrado todavía.', 'error', 3000);
        return;
    }

    if (!repeatRoundModal) return;

    let total = 0;
    repeatRoundModalItems.innerHTML = state.lastOrder.map(item => {
        let itemTotal = item.valor_total;
        if (!itemTotal) {
            const prod = state.products ? state.products.find(p => String(p.id) === String(item.producto_id)) : null;
            const unitPrice = prod ? parseFloat(prod.valor) : 0;
            itemTotal = unitPrice * (item.cantidad || 1);
        }
        total += itemTotal;
        return `
            <div class="cart-item" style="justify-content: space-between;">
                <span class="cart-item-name"><strong>${item.cantidad}x</strong> ${item.nombre}</span>
                <span style="font-weight: 600; color: #4a5568;">$${itemTotal.toFixed(2)}</span>
            </div>
        `;
    }).join('');

    if (repeatRoundModalTotal) {
        repeatRoundModalTotal.innerHTML = `Total de la Ronda: <span style="color: var(--bees-black);">$${total.toFixed(2)}</span>`;
    }

    repeatRoundModal.style.display = 'flex';
}

async function handleConfirmRepeatRound() {
    if (!state.lastOrder || state.lastOrder.length === 0) return;

    const btn = document.getElementById('confirm-repeat-round-btn');
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Enviando ronda...';
    }

    const payload = {
        items: state.lastOrder.map(i => ({
            producto_id: i.producto_id,
            cantidad: i.cantidad
        }))
    };

    try {
        const response = await fetch(`${API_BASE_URL}/consumos/pedir/carrito/${state.user.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || 'Error al pedir la ronda.');

        showNotification('¡Ronda pedida con éxito! 🍻', 'success', 3500);

        state.lastOrderTime = new Date();
        const storageKey = 'karaokeLastOrder_' + (state.sessionId || (state.user && state.user.id) || 'default');
        localStorage.setItem(storageKey, JSON.stringify({ items: state.lastOrder, time: state.lastOrderTime }));

        if (repeatRoundModal) repeatRoundModal.style.display = 'none';

        updateRepeatRoundUI();
        fetchUserProfile();
        fetchTableAccountStatus();
    } catch (error) {
        showNotification(`Error: ${error.message}`, 'error', 5000);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = '🍻 Confirmar Esta Ronda';
        }
    }
}

function handleEditRepeatRoundInCart() {
    if (!state.lastOrder || state.lastOrder.length === 0) return;

    state.cart = JSON.parse(JSON.stringify(state.lastOrder.map(i => ({
        producto_id: i.producto_id,
        nombre: i.nombre,
        cantidad: i.cantidad
    }))));

    renderCart();

    const addBtnContainers = document.querySelectorAll('.add-btn-container');
    addBtnContainers.forEach(container => {
        const pId = container.dataset.productId;
        const item = state.cart.find(c => String(c.producto_id) === String(pId));
        updateQuantityDisplay(container, item ? item.cantidad : 0);
    });

    if (repeatRoundModal) repeatRoundModal.style.display = 'none';
    if (cartModal) cartModal.style.display = 'flex';
    showNotification('Ronda cargada en tu carrito. Puedes ajustarla aquí.', 'success', 2500);
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
    const existingItem = state.cart.find(item => String(item.producto_id) === String(productId));
    if (existingItem) {
        if (existingItem.cantidad < stock) existingItem.cantidad++;
    } else {
        state.cart.push({ producto_id: productId, nombre: productName, cantidad: 1 });
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
                } else if (data.type === 'table_session_closed') {
                    const currentMesaId = (state.user && state.user.mesa && state.user.mesa.id) || (state.user && state.user.mesa_id) || state.mesaId;
                    if (currentMesaId && Number(data.mesa_id) === Number(currentMesaId)) {
                        handleTableSessionClosed(data.mensaje);
                    }
                }
            } else {
                renderQueue(data);
            }
        } catch (err) {
            console.warn("⚠️ [WS Auditoría] Error al procesar mensaje JSON entrante:", err);
        }
    };

    state.websocket.onclose = (event) => {
        if (state.sessionClosed) {
            console.log(`🔴 [WS Auditoría] Sesión de mesa finalizada. No se reintentará conexión.`);
            return;
        }
        console.log(`🔴 [WS Auditoría] Conexión WebSocket cerrada. Intentando reconectar en 5 segundos...`);
        setTimeout(connectWebSocket, 5000);
    };

    state.websocket.onerror = (error) => {
        console.error('❌ [WS Auditoría] Error detectado en WebSocket:', error);
        state.websocket.close();
    };
}

function handleTableSessionClosed(mensaje) {
    state.sessionClosed = true;
    sessionStorage.removeItem('karaokeUser');
    sessionStorage.removeItem('karaokeKey');
    sessionStorage.removeItem('karaokeSessionId');
    state.user = null;

    if (state.websocket) {
        state.websocket.onclose = null;
        state.websocket.close();
    }

    const loginContainer = document.getElementById('login-container');
    const dashboardView = document.getElementById('dashboard-view');
    if (loginContainer) loginContainer.style.display = 'none';
    if (dashboardView) {
        dashboardView.style.display = 'none';
        dashboardView.classList.add('hidden');
    }

    let farewellOverlay = document.getElementById('farewell-session-screen');
    if (!farewellOverlay) {
        farewellOverlay = document.createElement('div');
        farewellOverlay.id = 'farewell-session-screen';
        document.body.appendChild(farewellOverlay);
    }
    farewellOverlay.innerHTML = `
        <div style="position: fixed; inset: 0; background: linear-gradient(135deg, #111118 0%, #1f1f2e 100%); z-index: 999999; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 25px; text-align: center; color: white; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
            <div style="font-size: 4rem; margin-bottom: 20px;">🎉</div>
            <h2 style="color: #fdb913; font-size: 1.6rem; font-weight: 700; margin-bottom: 12px;">¡Muchas gracias por acompañarnos!</h2>
            <p style="color: #f0f0f0; font-size: 1.15rem; font-weight: 500; max-width: 420px; line-height: 1.5; margin-bottom: 25px;">
                ${mensaje || 'Muchas gracias por acompañarnos, este QR ya no funciona.'}
            </p>
            <div style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 12px; padding: 15px 20px; max-width: 380px;">
                <p style="margin: 0; font-size: 0.9em; color: #aaa; line-height: 1.4;">
                    Esperamos que hayas disfrutado la experiencia. La sesión de esta mesa ha concluido y el código QR ha quedado inhabilitado.
                </p>
            </div>
        </div>
    `;
    farewellOverlay.style.display = 'block';
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
        if (state.sessionId) {
            sessionStorage.setItem('karaokeSessionId', state.sessionId);
        }

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
        sessionStorage.removeItem('karaokeKey');
        sessionStorage.removeItem('karaokeSessionId');
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
    state.cart = state.cart.filter(item => String(item.producto_id) !== String(productId));
    renderCart();
    const container = document.querySelector(`.add-btn-container[data-product-id="${productId}"]`);
    if (container) {
        updateQuantityDisplay(container, 0);
    }
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

        // Guardar como última ronda
        state.lastOrder = JSON.parse(JSON.stringify(state.cart));
        state.lastOrderTime = new Date();
        const storageKey = 'karaokeLastOrder_' + (state.sessionId || (state.user && state.user.id) || 'default');
        localStorage.setItem(storageKey, JSON.stringify({ items: state.lastOrder, time: state.lastOrderTime }));

        state.cart = [];
        renderCart();

        // Reset all product buttons in the catalog
        const addBtnContainers = document.querySelectorAll('.add-btn-container');
        addBtnContainers.forEach(container => {
            updateQuantityDisplay(container, 0);
        });

        cartModal.style.display = 'none';
        updateRepeatRoundUI();
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
    const button = event.target.closest('.delete-song-btn');
    if (!button) return;

    const songId = button.dataset.songId;
    if (!confirm('¿Estás seguro de que quieres eliminar esta canción de tu lista?')) return;

    button.disabled = true;

    try {
        const response = await fetch(`${API_BASE_URL}/canciones/${songId}?usuario_id=${state.user.id}`, {
            method: 'DELETE',
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.detail || 'No se pudo eliminar la canción.');
        }

        showNotification('Canción eliminada con éxito.');
        fetchMyList();
    } catch (error) {
        console.error('Error al eliminar canción:', error);
        showNotification(error.message, 'error', 4000);
    } finally {
        button.disabled = false;
    }
}

async function handleMoveSongUp(event) {
    const button = event.target.closest('.move-up-btn');
    if (!button) return;

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
    const button = event.target.closest('.move-down-btn');
    if (!button) return;

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
    if (catalogCategoryGrid && (!state.products || state.products.length === 0)) {
        catalogCategoryGrid.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; color: #718096; padding: 20px;">Cargando catálogo...</p>';
    }
    const localId = state.localId || (state.user && state.user.local_id) || (state.user && state.user.mesa && state.user.mesa.local_id) || 1;
    try {
        const response = await fetch(`${API_BASE_URL}/productos/?local_id=${localId}`);
        if (!response.ok) throw new Error('Error al obtener productos.');
        const products = await response.json();
        renderCatalog(products);
    } catch (error) {
        console.error('Error al cargar productos:', error);
        if (catalogCategoryGrid) {
            catalogCategoryGrid.innerHTML = '<p class="error-msg" style="grid-column: 1 / -1; text-align: center;">No se pudo cargar el catálogo de productos.</p>';
        }
    }
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

        // Extraer última ronda de consumos si no está en memoria
        if (data.consumos && data.consumos.length > 0) {
            const extracted = extractLastRoundFromConsumos(data.consumos);
            if (extracted && (!state.lastOrder || state.lastOrder.length === 0)) {
                state.lastOrder = extracted.items;
                state.lastOrderTime = extracted.time;
                const storageKey = 'karaokeLastOrder_' + (state.sessionId || (state.user && state.user.id) || 'default');
                localStorage.setItem(storageKey, JSON.stringify({ items: state.lastOrder, time: state.lastOrderTime }));
            }
        }
        updateRepeatRoundUI();

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
            state.sessionId = data.session_id || null;
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
            handleTableSessionClosed(err.detail || 'Esta sesión de mesa ya ha finalizado. Por favor escanea el código QR actual de la mesa.');
            return;
        }
    } catch (e) {
        console.error("Error resolviendo clave QR:", e);
    }

    const storedUser = sessionStorage.getItem('karaokeUser');
    const storedKey = sessionStorage.getItem('karaokeKey');
    const storedSessionId = sessionStorage.getItem('karaokeSessionId');

    // Verificar si el usuario guardado corresponde a la sesión activa actual de la mesa
    if (storedUser && storedKey === state.qrKey && (!storedSessionId || !state.sessionId || storedSessionId === state.sessionId)) {
        state.user = JSON.parse(storedUser);
        if (state.sessionId) {
            sessionStorage.setItem('karaokeSessionId', state.sessionId);
        }
        fetchUserProfile();
        showDashboard();
    } else {
        // Si la sesión guardada era de una sesión anterior de la mesa, limpiar sesión
        sessionStorage.removeItem('karaokeUser');
        sessionStorage.removeItem('karaokeKey');
        if (state.sessionId) {
            sessionStorage.setItem('karaokeSessionId', state.sessionId);
        }
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

    if (catalogCategoryGrid) {
        catalogCategoryGrid.addEventListener('click', (e) => {
            const card = e.target.closest('.category-card');
            if (card && card.dataset.category) {
                showCategoryProducts(card.dataset.category);
            }
        });
    }

    if (catalogBackToCategoriesBtn) {
        catalogBackToCategoriesBtn.addEventListener('click', () => {
            showAllCategories();
        });
    }

    if (catalogSearchInput) {
        catalogSearchInput.addEventListener('input', (e) => {
            handleCatalogSearch(e.target.value);
        });
    }

    if (catalogSearchClearBtn) {
        catalogSearchClearBtn.addEventListener('click', () => {
            if (catalogSearchInput) catalogSearchInput.value = '';
            handleCatalogSearch('');
        });
    }

    if (repeatRoundBtn) {
        repeatRoundBtn.addEventListener('click', openRepeatRoundModal);
    }

    if (confirmRepeatRoundBtn) {
        confirmRepeatRoundBtn.addEventListener('click', handleConfirmRepeatRound);
    }

    if (editRepeatRoundInCartBtn) {
        editRepeatRoundInCartBtn.addEventListener('click', handleEditRepeatRoundInCart);
    }

    if (cancelRepeatRoundBtn) {
        cancelRepeatRoundBtn.addEventListener('click', () => {
            if (repeatRoundModal) repeatRoundModal.style.display = 'none';
        });
    }

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
                removeFromCart(productId);
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