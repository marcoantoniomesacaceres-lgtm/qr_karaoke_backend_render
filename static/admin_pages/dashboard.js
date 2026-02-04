// Dashboard Page Module - BEES Style
// Manejo: resumen, últimos pedidos, acciones rápidas, reacciones

async function loadDashboardPage() {
    try {
        const dashboardContainer = document.getElementById('dashboard');
        if (!dashboardContainer) return;

        if (window.isDashboardLoading) return;
        window.isDashboardLoading = true;

        // Limpiar contenedor
        dashboardContainer.innerHTML = '';

        // Obtener datos
        const summary = await apiFetch('/admin/summary');
        const ingresos = Number(summary.ingresos_totales) || 0;
        const ganancias = Number(summary.ganancias_totales) || 0;
        const canciones = Number(summary.canciones_cantadas) || 0;
        const usuarios = Number(summary.usuarios_activos) || 0;

        // Aplicar tema si existe
        if (summary.theme) {
            document.body.dataset.theme = summary.theme;
        }

        // Crear encabezado
        const header = document.createElement('div');
        header.className = 'bees-header';
        header.innerHTML = `
            <div class="bees-header-icon">📊</div>
            <div class="bees-header-content">
                <h1>Dashboard</h1>
                <p>Resumen de actividad en tiempo real</p>
            </div>
        `;
        dashboardContainer.appendChild(header);

        // Tarjetas de métricas
        const metricsContainer = document.createElement('div');
        metricsContainer.className = 'bees-container-4col';
        metricsContainer.style.marginTop = '30px';
        metricsContainer.innerHTML = `
            <div class="metric-card">
                <div class="metric-card-icon">💰</div>
                <div class="metric-card-label">Ingresos Totales</div>
                <div class="metric-card-value">$${ingresos.toFixed(2)}</div>
            </div>
            <div class="metric-card">
                <div class="metric-card-icon">📈</div>
                <div class="metric-card-label">Ganancias</div>
                <div class="metric-card-value" style="color: var(--bees-green);">$${ganancias.toFixed(2)}</div>
            </div>
            <div class="metric-card">
                <div class="metric-card-icon">🎵</div>
                <div class="metric-card-label">Canciones</div>
                <div class="metric-card-value">${canciones}</div>
            </div>
            <div class="metric-card">
                <div class="metric-card-icon">👥</div>
                <div class="metric-card-label">Usuarios Activos</div>
                <div class="metric-card-value">${usuarios}</div>
            </div>
        `;
        dashboardContainer.appendChild(metricsContainer);

        // Acciones rápidas
        renderQuickActions(dashboardContainer);

        // Reacciones
        renderReactions(dashboardContainer);

        // Player
        renderPlayerSection(dashboardContainer);

        // Setup listeners
        setupDashboardListeners();

        // Load orders in top bar if function exists
        if (typeof loadTopOrdersBar === 'function') {
            loadTopOrdersBar();
        }
    } catch (error) {
        const dashboardContainer = document.getElementById('dashboard');
        if (dashboardContainer) {
            dashboardContainer.innerHTML = `
                <div class="bees-alert bees-alert-danger">
                    <span class="bees-alert-icon">❌</span>
                    <div>Error al cargar dashboard: ${error.message}</div>
                </div>
            `;
        }
        showNotification(`Error al cargar resumen: ${error.message}`, 'error');
    } finally {
        window.isDashboardLoading = false;
    }
}

async function loadRecentOrders(container) {
    try {
        const pedidos = await apiFetch('/admin/recent-consumos?limit=25');


        // Remove existing orders card if present (idempotency)
        const existingCard = document.getElementById('recent-orders-card');
        if (existingCard) {
            existingCard.remove();
        }

        // Crear tarjeta de pedidos
        const ordersCard = document.createElement('div');
        ordersCard.id = 'recent-orders-card';
        ordersCard.className = 'bees-card';
        ordersCard.style.marginTop = '0';

        const ordersHeader = document.createElement('div');
        ordersHeader.className = 'bees-card-header';
        ordersHeader.innerHTML = `
            <div class="bees-card-icon">📦</div>
            <div class="bees-card-header-content">
                <h3>Últimos Pedidos</h3>
                <p>Pedidos pendientes por despachar</p>
            </div>
        `;
        ordersCard.appendChild(ordersHeader);

        const listEl = document.createElement('ul');
        listEl.id = 'recent-orders-list';
        listEl.style.listStyle = 'none';
        listEl.style.padding = '0';
        listEl.style.margin = '0';

        if (!pedidos || pedidos.length === 0) {
            const emptyItem = document.createElement('li');
            emptyItem.innerHTML = `
                <div class="bees-alert bees-alert-info">
                    <span class="bees-alert-icon">ℹ️</span>
                    <div>No hay pedidos recientes</div>
                </div>
            `;
            listEl.appendChild(emptyItem);
        } else {
            const pedidosPorMesa = pedidos.reduce((acc, pedido) => {
                const mesaNombre = pedido.mesa_nombre || 'Pedidos sin mesa';
                if (!acc[mesaNombre]) {
                    acc[mesaNombre] = {
                        items: [],
                        ultimaFecha: new Date(0),
                        nicks: new Set()
                    };
                }
                acc[mesaNombre].items.push(pedido);
                acc[mesaNombre].nicks.add(pedido.usuario_nick);
                if (new Date(pedido.created_at) > acc[mesaNombre].ultimaFecha) {
                    acc[mesaNombre].ultimaFecha = new Date(pedido.created_at);
                }
                return acc;
            }, {});

            Object.keys(pedidosPorMesa)
                .sort((a, b) => pedidosPorMesa[b].ultimaFecha - pedidosPorMesa[a].ultimaFecha)
                .forEach(mesaNombre => {
                    const grupo = pedidosPorMesa[mesaNombre];
                    const li = document.createElement('li');
                    li.style.marginBottom = '16px';

                    const itemsHtml = grupo.items
                        .map(item => `<li style="margin-bottom: 4px;">
                            <span class="bees-badge bees-badge-info">${item.cantidad}x</span>
                            ${item.producto_nombre}
                        </li>`)
                        .join('');
                    const allConsumoIds = grupo.items.map(item => item.id).join(',');

                    li.innerHTML = `
                        <div style="background: var(--page-input-bg); border-radius: 12px; padding: 16px; border-left: 4px solid var(--bees-yellow);">
                            <div style="font-weight: 600; color: var(--page-text); margin-bottom: 8px;">
                                🔔 ${mesaNombre} pidió:
                            </div>
                            <ul style="list-style: none; padding-left: 0; margin: 8px 0 12px 0; color: var(--page-text-secondary);">
                                ${itemsHtml}
                            </ul>
                            <div style="font-size: 12px; color: var(--page-text-secondary); margin-bottom: 12px;">
                                Por: <strong>${[...grupo.nicks].join(', ')}</strong> — ${grupo.ultimaFecha.toLocaleTimeString()}
                            </div>
                            <div style="display: flex; gap: 8px;">
                                <button class="bees-btn bees-btn-success bees-btn-small btn-despachado" data-ids="${allConsumoIds}" title="Marcar todo como despachado">
                                    ✅ Despachado
                                </button>
                                <button class="bees-btn bees-btn-danger bees-btn-small btn-no-despachado" data-ids="${allConsumoIds}" title="Cancelar todo el pedido">
                                    ❌ Cancelar
                                </button>
                            </div>
                        </div>
                    `;
                    listEl.appendChild(li);
                });
        }

        ordersCard.appendChild(listEl);
        container.appendChild(ordersCard);

        // Setup listeners for the orders list directly here
        listEl.addEventListener('click', async (e) => {
            const btnDespachado = e.target.closest('.btn-despachado');
            const btnNoDespachado = e.target.closest('.btn-no-despachado');

            let consumoIds;
            let endpoint;
            let confirmMessage;
            let successMessage;
            let isDeleteAction = false;

            if (btnDespachado) {
                consumoIds = (btnDespachado.dataset.ids || '').split(',').filter(id => id);
                endpoint = `/admin/consumos/{consumo_id}/mark-despachado`;
                confirmMessage = '¿Confirmas que este pedido ha sido despachado?';
                successMessage = 'Pedido marcado como despachado.';
                isDeleteAction = false;
            } else if (btnNoDespachado) {
                consumoIds = (btnNoDespachado.dataset.ids || '').split(',').filter(id => id);
                endpoint = `/admin/consumos/{consumo_id}`;
                confirmMessage = '¿Estás seguro de que quieres CANCELAR este pedido?';
                successMessage = 'Pedido cancelado.';
                isDeleteAction = true;
            } else {
                return;
            }

            if (!consumoIds || consumoIds.length === 0) return;
            if (!confirm(confirmMessage)) return;

            try {
                for (const id of consumoIds) {
                    const finalEndpoint = endpoint.replace('{consumo_id}', id);
                    await apiFetch(finalEndpoint, { method: isDeleteAction ? 'DELETE' : 'POST' });
                }

                showNotification(successMessage, 'success');
                // Refresh orders in the current container
                loadRecentOrders(container);
            } catch (error) {
                console.error("Error procesando consumos:", error);
                showNotification("Error procesando consumos", "error");
            }
        });

    } catch (error) {
        const errorCard = document.createElement('div');
        errorCard.className = 'bees-card';
        errorCard.innerHTML = `
            <div class="bees-alert bees-alert-danger">
                <span class="bees-alert-icon">❌</span>
                <div>Error cargando pedidos: ${error.message}</div>
            </div>
        `;
        container.appendChild(errorCard);
    }
}



function renderQuickActions(dashboardContainer) {
    const card = document.createElement('div');
    card.className = 'bees-card';
    card.style.marginTop = '30px';

    const header = document.createElement('div');
    header.className = 'bees-card-header';
    header.innerHTML = `
        <div class="bees-card-icon">⚡</div>
        <div class="bees-card-header-content">
            <h3>Acciones Rápidas</h3>
            <p>Control del sistema en tiempo real</p>
        </div>
    `;
    card.appendChild(header);

    const container = document.createElement('div');
    container.style.display = 'grid';
    container.style.gridTemplateColumns = 'repeat(auto-fit, minmax(250px, 1fr))';
    container.style.gap = '16px';

    // Mensaje global
    const broadcastSection = document.createElement('div');
    broadcastSection.style.background = 'var(--page-input-bg)';
    broadcastSection.style.padding = '16px';
    broadcastSection.style.borderRadius = '12px';
    broadcastSection.innerHTML = `
        <label class="bees-form-group">
            <label style="font-weight: 600; margin-bottom: 8px; display: block;">Enviar Mensaje Global</label>
            <input type="text" id="broadcast-message-input" placeholder="Ej: ¡Oferta en cervezas!" style="border: 2px solid var(--page-border); border-radius: 8px; padding: 12px; width: 100%; background: var(--page-card-bg); color: var(--page-text); box-sizing: border-box;">
            <button class="bees-btn bees-btn-info bees-btn-small" id="broadcast-btn" style="margin-top: 8px;">📢 Enviar</button>
        </label>
    `;
    container.appendChild(broadcastSection);

    card.appendChild(container);
    dashboardContainer.appendChild(card);
}

function renderReactions(dashboardContainer) {
    const card = document.createElement('div');
    card.className = 'bees-card';
    card.style.marginTop = '30px';

    const header = document.createElement('div');
    header.className = 'bees-card-header';
    header.innerHTML = `
        <div class="bees-card-icon">😊</div>
        <div class="bees-card-header-content">
            <h3>Enviar Reacción</h3>
            <p>Comparte emociones con todos en tiempo real</p>
        </div>
    `;
    card.appendChild(header);

    const buttonsContainer = document.createElement('div');
    buttonsContainer.id = 'reaction-buttons';
    buttonsContainer.style.display = 'grid';
    buttonsContainer.style.gridTemplateColumns = 'repeat(3, 1fr)';
    buttonsContainer.style.gap = '15px';
    buttonsContainer.style.justifyContent = 'center';
    buttonsContainer.style.maxWidth = '400px';
    buttonsContainer.style.margin = '0 auto';

    const reactions = [
        { emoji: '👏', title: '¡Aplausos!' },
        { emoji: '❤️', title: '¡Me encanta!' },
        { emoji: '💔', title: '¡Corazón roto!' },
        { emoji: <span style={{ color: '#5B2D8B' }}>😈</span>, title: '¡Diablillo!' },
        { emoji: '😳', title: '¡Sonrojado!' },
        { emoji: '😢', title: '¡Triste!' },
        { emoji: '🙈', title: '¡No miro!' },
        { emoji: '🍻', title: '¡Salud!' },
        { emoji: '🤩', title: '¡Increíble!' },
        { emoji: '🔥', title: '¡Fuego!' },
        { emoji: '👍', title: '¡Me gusta!' },
        { emoji: '😀', title: '¡Feliz!' }
    ];

    reactions.forEach(reaction => {
        const btn = document.createElement('button');
        btn.className = 'bees-btn bees-btn-secondary';
        btn.textContent = reaction.emoji;
        btn.title = reaction.title;
        btn.style.fontSize = '32px';
        btn.style.width = '100%';
        btn.style.padding = '20px';
        btn.style.border = '2px solid #FFD700';
        btn.style.borderRadius = '12px';
        btn.style.backgroundColor = '#ffffff';
        btn.style.cursor = 'pointer';
        btn.style.transition = 'all 0.2s ease';
        btn.addEventListener('mouseenter', () => {
            btn.style.transform = 'scale(1.05)';
            btn.style.boxShadow = '0 4px 12px rgba(255, 215, 0, 0.3)';
        });
        btn.addEventListener('mouseleave', () => {
            btn.style.transform = 'scale(1)';
            btn.style.boxShadow = 'none';
        });
        buttonsContainer.appendChild(btn);
    });

    card.appendChild(buttonsContainer);
    dashboardContainer.appendChild(card);
}

function renderPlayerSection(dashboardContainer) {
    const card = document.createElement('div');
    card.className = 'bees-card';
    card.style.marginTop = '30px';

    const header = document.createElement('div');
    header.className = 'bees-card-header';
    header.innerHTML = `
        <div class="bees-card-icon">🎤</div>
        <div class="bees-card-header-content">
            <h3>Player</h3>
            <p>Gestión del karaoke</p>
        </div>
    `;
    card.appendChild(header);

    const btn = document.createElement('button');
    btn.id = 'open-player-dashboard-main';
    btn.className = 'bees-btn bees-btn-primary';
    btn.innerHTML = '🎤 Abrir Dashboard Player';
    card.appendChild(btn);
    dashboardContainer.appendChild(card);
}

// Setup event listeners for dashboard
function setupDashboardListeners() {
    // Mensaje broadcast
    const broadcastBtn = document.getElementById('broadcast-btn');
    if (broadcastBtn) {
        broadcastBtn.addEventListener('click', handleBroadcast);
    }

    // Reacciones
    const reactionBtns = document.getElementById('reaction-buttons');
    if (reactionBtns) {
        reactionBtns.addEventListener('click', handleSendReaction);
    }

    // Player
    const openPlayerBtn = document.getElementById('open-player-dashboard-main');
    if (openPlayerBtn) {
        openPlayerBtn.addEventListener('click', () => {
            window.open('/player', '_blank');
        });
    }
}

async function handleBroadcast() {
    const input = document.getElementById('broadcast-message-input');
    const message = input ? input.value.trim() : '';

    if (!message) {
        showNotification('El mensaje no puede estar vacío.', 'error');
        return;
    }

    try {
        await apiFetch('/admin/broadcast-message', {
            method: 'POST',
            body: JSON.stringify({ mensaje: message })
        });
        showNotification('Mensaje enviado a todos.', 'success');
        if (input) input.value = '';
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

async function handleResetNight() {
    if (!confirm('⚠️ ACCIÓN DESTRUCTIVA\n\n¿Estás seguro de reiniciar la noche?\nSe borrarán: mesas, usuarios, canciones y consumos.')) {
        return;
    }

    try {
        await apiFetch('/admin/reset-night', { method: 'POST' });
        showNotification('Sistema reiniciado.', 'info');
        setTimeout(() => loadDashboardPage(), 300);
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

async function handleSendReaction(event) {
    const btn = event.target.closest('#reaction-buttons button');
    if (!btn) return;

    const reaction = btn.textContent.trim();

    try {
        await fetch(`${API_BASE_URL}/broadcast/reaction`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                reaction: reaction,
                sender: "Admin"
            })
        });
        showNotification(`Reacción enviada: ${reaction}`, 'success');
    } catch (error) {
        console.error("Error enviando reacción:", error);
        showNotification('Error enviando reacción', 'error');
    }
}

async function openOrdersModal() {
    let modal = document.getElementById('orders-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'orders-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.8);
            z-index: 9999;
            display: flex;
            justify-content: center;
            align-items: center;
            backdrop-filter: blur(5px);
        `;

        const content = document.createElement('div');
        content.className = 'bees-card';
        content.style.cssText = `
            width: 90%;
            max-width: 800px;
            max-height: 90vh;
            overflow-y: auto;
            background: var(--page-card-bg);
            padding: 0;
            border-radius: 16px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.5);
            position: relative;
        `;

        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '&times;';
        closeBtn.style.cssText = `
            position: absolute;
            top: 15px;
            right: 20px;
            background: none;
            border: none;
            color: var(--page-text);
            font-size: 32px;
            cursor: pointer;
            z-index: 10;
            line-height: 1;
        `;
        closeBtn.onclick = () => modal.style.display = 'none';

        const body = document.createElement('div');
        body.id = 'orders-modal-body';
        body.style.padding = '20px';

        content.appendChild(closeBtn);
        content.appendChild(body);
        modal.appendChild(content);
        document.body.appendChild(modal);

        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.style.display = 'none';
        });
    }

    modal.style.display = 'flex';
    const body = document.getElementById('orders-modal-body');
    body.innerHTML = '<div style="text-align:center; padding: 40px;"><div class="spinner"></div><p style="margin-top:10px; color:var(--page-text-secondary);">Cargando pedidos...</p></div>';

    await loadRecentOrders(body);
}
window.openOrdersModal = openOrdersModal;

// --- Navegación desde Barra Superior ---

function initTopBarListener() {
    // Evitar múltiples listeners si el script se carga varias veces
    if (window.hasInitializedTopBarListener) return;
    window.hasInitializedTopBarListener = true;

    document.body.addEventListener('click', (e) => {
        // 1. Selectores específicos (clases conocidas)
        const specificTrigger = e.target.closest('.top-bar-pending-orders, .pending-orders-icon, .pending-orders, [data-action="open-orders"]');

        // 2. Detección heurística para botones de mesas en la barra superior
        // Busca elementos dentro de la barra de navegación que parezcan notificaciones de mesas
        // Se añade .top-bar para capturar clics directos en la barra si contiene texto relevante
        const navbarTrigger = e.target.closest('.navbar .nav-item, header .item, .top-bar, .top-bar > div, .navbar-nav li, a.nav-link');

        const looksLikeTableOrder = navbarTrigger && (
            (navbarTrigger.textContent && (
                navbarTrigger.textContent.toLowerCase().includes('mesa') ||
                navbarTrigger.textContent.toLowerCase().includes('vip') ||
                navbarTrigger.textContent.toLowerCase().includes('toscana') ||
                navbarTrigger.textContent.toLowerCase().includes('pedidos')
            )) ||
            navbarTrigger.querySelector('.badge')
        );

        if (specificTrigger || (navbarTrigger && looksLikeTableOrder)) {
            e.preventDefault();
            e.stopPropagation();
            openOrdersModal();
        }
    });
}

// Inicializar listener inmediatamente si el DOM ya está listo, o esperar al evento
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTopBarListener);
} else {
    initTopBarListener();
}
