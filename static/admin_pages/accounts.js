// Accounts Page Module
// Manejo: cuentas de pago, comisiones, transacciones

// Variable global para almacenar las cuentas actuales
let currentAccounts = [];
// Variable global para almacenar productos (cache simple)
let availableProducts = [];
// Variable global para el carrito de pedidos
let orderCart = {};
// Variable para trackear la mesa seleccionada en el modal de QR
let currentQRTableId = null;

function formatFechaHora(dateStr) {
    if (!dateStr) return '';
    let d;
    if (typeof dateStr === 'string' && !dateStr.includes('Z') && !dateStr.match(/[+-]\d{2}:\d{2}$/)) {
        d = new Date(dateStr.replace('T', ' '));
    } else {
        d = new Date(dateStr);
    }
    return isNaN(d.getTime()) ? String(dateStr) : d.toLocaleString('es-CO');
}

function renderAccounts(accounts, accountsGrid) {
    accountsGrid.innerHTML = '';
    if (accounts.length === 0) {
        accountsGrid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-secondary);">
                <p style="font-size: 2em; margin-bottom: 10px;">📭</p>
                <p style="font-size: 1.1em; font-weight: bold;">No hay mesas registradas</p>
                <p>Crea una nueva mesa para comenzar a gestionar pedidos.</p>
            </div>
        `;
        return;
    }

    // Guardar las cuentas en la variable global para acceder a ellas después
    currentAccounts = accounts;

    accounts.forEach(acc => {
        const card = document.createElement('div');
        // Add level class for styling border
        const nivel = acc.nivel || 'bronce';
        card.className = `mesa-card card level-${nivel}`;
        card.dataset.mesaId = acc.mesa_id;

        const titulo = acc.mesa_nombre || `Mesa ${acc.mesa_id}`;
        const saldo = Number(acc.saldo_pendiente) || 0;
        const isActive = acc.activa !== false; // Asumimos activa por defecto

        // Extraer el número lógico de la mesa (si lo tiene)
        let numeroMesa = null;
        if (acc.qr_code) {
            const matchQr = acc.qr_code.match(/karaoke-mesa-(\d+)/i);
            if (matchQr && matchQr[1]) {
                numeroMesa = parseInt(matchQr[1], 10);
            }
        }
        if (!numeroMesa && acc.mesa_nombre) {
            const matchNombre = acc.mesa_nombre.match(/Mesa\s+(\d+)/i);
            if (matchNombre && matchNombre[1]) {
                numeroMesa = parseInt(matchNombre[1], 10);
            }
        }

        // Determinar clase de saldo
        let saldoClass = 'zero';
        if (saldo > 0) saldoClass = 'negative';
        else if (saldo < 0) saldoClass = 'positive';

        card.innerHTML = `
            <!-- Header con nombre y estado -->
            <div class="mesa-card-header" style="position: relative; padding-right: 30px;">
                <h3>
                    ${titulo}
                    <span class="mesa-status ${isActive ? 'active' : 'inactive'}"></span>
                </h3>
                ${isActive ? `<button class="btn-close-table" data-mesa-id="${acc.mesa_id}" style="position: absolute; top: 10px; right: 10px; background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--text-secondary); line-height: 1;" title="Cerrar Sesión de Mesa">&times;</button>` : ''}
            </div>
            
            <!-- Cuerpo con info -->
            <div class="mesa-card-body" style="padding-bottom: 2px;">
                <div class="mesa-info">
                    <div class="info-row">
                        <label>${numeroMesa ? 'Número de Mesa:' : 'Espacio / Nombre:'}</label>
                        <span>${numeroMesa ? numeroMesa : (acc.mesa_nombre || `Mesa ${acc.mesa_id}`)}</span>
                    </div>
                    <div class="info-row">
                        <label>Saldo:</label>
                        <span class="mesa-saldo-text ${saldoClass}" style="font-size: 1.35em; font-weight: bold;">$${saldo.toFixed(2)}</span>
                    </div>
                </div>
            </div>
            
            <!-- Fila única con los 3 botones de acción en iconos grandes -->
            <div class="mesa-account-summary">
                <div class="mesa-account-actions-row">
                    <button class="btn-payment mesa-action-icon-btn" data-id="${acc.mesa_id}" title="Registrar Pago">
                        💵
                    </button>
                    <button class="btn-view-details mesa-action-icon-btn" data-mesa-id="${acc.mesa_id}" title="Detalle de Pedidos">
                        🛒
                    </button>
                    <button class="btn-manage-qr mesa-action-icon-btn" data-mesa-id="${acc.mesa_id}" title="Gestionar QR">
                        📱
                    </button>
                </div>
            </div>
        `;

        accountsGrid.appendChild(card);
    });
}

function handleCardQRGenerate(mesaId) {
    // This function is no longer used for direct generation on card, 
    // but kept or refactored for the modal logic.
    // We'll use openQRModal instead.
}

// ========== ORDER CREATION MODULE ==========

function injectOrderModal() {
    if (document.getElementById('admin-create-order-modal')) return;

    const modalHtml = `
    <style>
        /* Estilos específicos para el modal de pedidos */
        .order-modal-layout {
            display: flex;
            height: 100%;
            flex-direction: row;
        }
        .order-products-col {
            flex: 2;
            display: flex;
            flex-direction: column;
            border-right: 1px solid var(--border-color, #444);
            padding: 15px;
            background: var(--page-bg, #1a1a1a);
        }
        .order-cart-col {
            flex: 1;
            display: flex;
            flex-direction: column;
            padding: 15px;
            background: var(--page-input-bg, #2a2a2a);
            min-width: 300px;
        }
        
        /* Responsividad para móviles */
        @media (max-width: 768px) {
            .order-modal-layout {
                flex-direction: column;
            }
            .order-products-col {
                flex: 1.5 !important;
                border-right: none !important;
                border-bottom: 1px solid #444;
            }
            .order-cart-col {
                flex: 1 !important;
                min-width: auto !important;
            }
            #order-modal-content {
                width: 98% !important;
                height: 95vh !important;
            }
        }
    </style>
    <div id="admin-create-order-modal" class="modal hidden">
        <div class="modal-content" id="order-modal-content" style="width: 90%; max-width: 1000px; height: 80vh; display: flex; flex-direction: column; border: 1px solid var(--border-color, #555); box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
            <div class="modal-header" id="order-modal-header" style="cursor: move;">
                <h2 id="order-modal-title">Crear Pedido</h2>
                <button id="order-modal-close-x" class="modal-close">&times;</button>
            </div>
            <div class="modal-body" style="flex: 1; overflow: hidden; padding: 0;">
                <div class="order-modal-layout">
                    <!-- Left: Product Catalog -->
                    <div class="order-products-col">
                        <input type="text" id="order-product-search" placeholder="🔍 Buscar producto..." class="form-input" style="margin-bottom: 15px;">
                        <div id="order-products-grid" style="flex: 1; overflow-y: auto; display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 10px; align-content: start;">
                            <!-- Products will be injected here -->
                        </div>
                    </div>

                    <div class="order-cart-col">
                        <input type="hidden" id="order-mesa-id">
                        <div class="form-group">
                            <label for="order-user-select" style="color: var(--text-color, #fff);">Usuario Destino</label>
                            <select id="order-user-select" class="form-select">
                                <option value="">Cargando usuarios...</option>
                            </select>
                        </div>
                        
                        <h4 style="margin-bottom: 10px; color: var(--text-color, #fff); border-bottom: 1px solid #444; padding-bottom: 5px;">Carrito</h4>
                        <div style="flex: 1; overflow-y: auto; margin-bottom: 15px;">
                            <ul id="order-cart-list" style="list-style: none; padding: 0;">
                                <!-- Cart items -->
                            </ul>
                        </div>

                        <div style="border-top: 1px solid var(--border-color, #444); padding-top: 15px;">
                            <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 1.2em; margin-bottom: 15px; color: var(--text-color, #fff);">
                                <span>Total:</span>
                                <span id="order-total-amount">$0.00</span>
                            </div>
                            <div style="display: flex; gap: 10px;">
                                <button type="button" id="order-modal-cancel" class="form-btn btn-cancel" style="flex: 1;">Cancelar</button>
                                <button type="button" id="btn-confirm-order" class="form-btn btn-confirm" style="flex: 2; background-color: var(--bees-green, #28a745);">✅ Confirmar</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Add search listener
    const searchInput = document.getElementById('order-product-search');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const filtered = availableProducts.filter(p => p.nombre.toLowerCase().includes(term));
            renderProductGrid(filtered);
        });
    }

    // Add confirm listener
    const confirmBtn = document.getElementById('btn-confirm-order');
    if (confirmBtn) {
        confirmBtn.addEventListener('click', handleOrderSubmit);
    }

    // Make draggable
    makeDraggable(document.getElementById('order-modal-content'), document.getElementById('order-modal-header'));
}

async function loadProductsForOrder() {
    if (availableProducts.length > 0) return; // Already loaded
    try {
        const products = await apiFetch('/productos/?limit=1000'); // Get all active products
        availableProducts = products.filter(p => p.is_active && p.stock > 0);
    } catch (e) {
        console.error("Error loading products:", e);
        showNotification("Error cargando productos", "error");
    }
}

function makeDraggable(elmnt, handle) {
    if (!elmnt || !handle) return;

    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

    handle.onmousedown = dragMouseDown;
    handle.ontouchstart = dragTouchStart;

    function dragMouseDown(e) {
        e = e || window.event;
        // e.preventDefault(); // Allow clicking buttons inside header if any
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;
    }

    function dragTouchStart(e) {
        const touch = e.touches[0];
        pos3 = touch.clientX;
        pos4 = touch.clientY;
        document.ontouchend = closeDragElement;
        document.ontouchmove = elementDragTouch;
    }

    function elementDrag(e) {
        e = e || window.event;
        e.preventDefault();
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;

        elmnt.style.top = (elmnt.offsetTop - pos2) + "px";
        elmnt.style.left = (elmnt.offsetLeft - pos1) + "px";
        elmnt.style.transform = "none"; // Remove centering transform
        elmnt.style.margin = "0";
    }

    function elementDragTouch(e) {
        const touch = e.touches[0];
        pos1 = pos3 - touch.clientX;
        pos2 = pos4 - touch.clientY;
        pos3 = touch.clientX;
        pos4 = touch.clientY;

        elmnt.style.top = (elmnt.offsetTop - pos2) + "px";
        elmnt.style.left = (elmnt.offsetLeft - pos1) + "px";
        elmnt.style.transform = "none";
        elmnt.style.margin = "0";
    }

    function closeDragElement() {
        document.onmouseup = null;
        document.onmousemove = null;
        document.ontouchend = null;
        document.ontouchmove = null;
    }
}

function renderProductGrid(products) {
    const grid = document.getElementById('order-products-grid');
    if (!grid) return;
    grid.innerHTML = '';

    products.forEach(p => {
        const card = document.createElement('div');
        card.className = 'product-card-mini';
        card.style.cssText = 'background: var(--card-bg, #333); border-radius: 8px; overflow: hidden; cursor: pointer; transition: transform 0.2s; border: 1px solid var(--border-color, #444); display: flex; flex-direction: column;';
        card.onclick = () => addToCart(p);

        // Use default image if none provided
        const imgUrl = p.imagen_url ? p.imagen_url : '/static/images/default_product.png'; // Fallback path

        card.innerHTML = `
            <div style="height: 100px; background: #000; display: flex; align-items: center; justify-content: center; overflow: hidden; position: relative;">
                ${p.imagen_url ? `<img src="${p.imagen_url}" style="width: 100%; height: 100%; object-fit: cover;">` : '<span style="font-size: 2em;">🍺</span>'}
                <div style="position: absolute; bottom: 5px; right: 5px; background: var(--bees-green, #28a745); color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-weight: bold;">+</div>
            </div>
            <div style="padding: 10px; flex: 1; display: flex; flex-direction: column; justify-content: space-between;">
                <div style="font-weight: bold; font-size: 0.9em; margin-bottom: 5px; color: var(--text-color, #fff); line-height: 1.2;">${p.nombre}</div>
                <div style="color: var(--bees-yellow, #f5c518); font-weight: bold;">$${p.valor}</div>
            </div>
        `;
        grid.appendChild(card);
    });
}

function addToCart(product) {
    if (!orderCart[product.id]) {
        orderCart[product.id] = { ...product, quantity: 0 };
    }
    orderCart[product.id].quantity++;
    updateCartUI();
}

function removeFromCart(productId) {
    if (orderCart[productId]) {
        orderCart[productId].quantity--;
        if (orderCart[productId].quantity <= 0) {
            delete orderCart[productId];
        }
        updateCartUI();
    }
}

function updateCartUI() {
    const list = document.getElementById('order-cart-list');
    const totalEl = document.getElementById('order-total-amount');
    if (!list || !totalEl) return;

    list.innerHTML = '';
    let total = 0;
    const items = Object.values(orderCart);

    if (items.length === 0) {
        list.innerHTML = '<li style="color: var(--text-secondary, #888); text-align: center; padding: 20px;">Carrito vacío</li>';
    } else {
        items.forEach(item => {
            const li = document.createElement('li');
            li.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; background: rgba(255,255,255,0.05); padding: 8px; border-radius: 6px;';
            li.innerHTML = `
                <div style="flex: 1;">
                    <div style="font-weight: bold; color: var(--text-color, #fff);">${item.nombre}</div>
                    <div style="font-size: 0.85em; color: var(--text-secondary, #aaa);">$${item.valor} x ${item.quantity}</div>
                </div>
                <div style="display: flex; align-items: center; gap: 5px;">
                    <button class="btn-minus" style="width: 24px; height: 24px; border-radius: 4px; border: none; background: #555; color: white; cursor: pointer;">-</button>
                    <span style="font-weight: bold; min-width: 20px; text-align: center; color: var(--text-color, #fff);">${item.quantity}</span>
                    <button class="btn-plus" style="width: 24px; height: 24px; border-radius: 4px; border: none; background: var(--bees-yellow, #f5c518); color: black; cursor: pointer;">+</button>
                </div>
            `;

            li.querySelector('.btn-minus').onclick = (e) => { e.stopPropagation(); removeFromCart(item.id); };
            li.querySelector('.btn-plus').onclick = (e) => { e.stopPropagation(); addToCart(item); };

            list.appendChild(li);
            total += item.valor * item.quantity;
        });
    }

    totalEl.textContent = `$${total.toFixed(2)}`;
}

async function openOrderModal(mesaId) {
    const modal = document.getElementById('admin-create-order-modal');
    if (!modal) return;

    // Set mesa ID
    const mesaIdInput = document.getElementById('order-mesa-id');
    if (mesaIdInput) mesaIdInput.value = mesaId;

    // Update Title
    const modalTitle = document.getElementById('order-modal-title');
    const account = currentAccounts.find(a => a.mesa_id == mesaId);
    if (modalTitle) modalTitle.textContent = `Pedido para ${account ? (account.mesa_nombre || 'Mesa ' + mesaId) : 'Mesa ' + mesaId}`;

    // Reset Cart
    orderCart = {};
    updateCartUI();

    // Load Products and Render Grid
    await loadProductsForOrder();
    renderProductGrid(availableProducts);

    // Load Users
    const userSelect = document.getElementById('order-user-select');
    if (userSelect) {
        userSelect.innerHTML = '<option value="">Cargando...</option>';
        try {
            const users = await apiFetch(`/mesas/${mesaId}/usuarios-conectados`);
            userSelect.innerHTML = '';
            if (users.length === 0) {
                const option = document.createElement('option');
                option.value = "";
                option.textContent = "No hay usuarios conectados";
                userSelect.appendChild(option);
            } else {
                users.forEach(u => {
                    const option = document.createElement('option');
                    option.value = u.id;
                    option.textContent = `${u.nick} (Nivel ${u.nivel})`;
                    userSelect.appendChild(option);
                });
            }
        } catch (e) {
            userSelect.innerHTML = '<option value="">Error cargando usuarios</option>';
            console.error(e);
        }
    }

    modal.classList.remove('hidden');
    modal.classList.add('active');
}

async function handleOrderSubmit(event) {
    if (event) event.preventDefault();

    const userSelect = document.getElementById('order-user-select');
    const usuarioId = userSelect ? userSelect.value : null;

    if (!usuarioId) {
        showNotification("Debe seleccionar un usuario.", "error");
        return;
    }

    const items = Object.values(orderCart);
    if (items.length === 0) {
        showNotification("El carrito está vacío.", "error");
        return;
    }

    try {
        // Send items one by one (using the admin endpoint)
        for (const item of items) {
            const payload = {
                producto_id: item.id,
                cantidad: item.quantity
            };
            await apiFetch(`/consumos/${usuarioId}`, {
                method: 'POST',
                body: JSON.stringify(payload)
            });
        }

        showNotification("Pedido creado exitosamente.", "success");

        // Close modal
        const modal = document.getElementById('admin-create-order-modal');
        if (modal) {
            modal.classList.remove('active');
            modal.classList.add('hidden');
        }

        // Refresh accounts to show new balance
        await loadAccountsPage();

    } catch (e) {
        showNotification(e.message || "Error creando el pedido", "error");
    }
}

async function loadAccountsPage() {
    const accountsGrid = document.getElementById('accounts-grid');
    try {
        // Usar el endpoint de administracion que devuelve el estado de cuenta por mesa
        const accounts = await apiFetch('/admin/reports/table-payment-status');

        // Ordenar las cuentas numéricamente por nombre de mesa (1, 2, 3... 10)
        if (Array.isArray(accounts)) {
            accounts.sort((a, b) => {
                const nameA = (a.mesa_nombre || `Mesa ${a.mesa_id}`).toString();
                const nameB = (b.mesa_nombre || `Mesa ${b.mesa_id}`).toString();
                return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
            });
        }

        renderAccounts(accounts, accountsGrid);
    } catch (error) {
        // Mostrar mensaje graceful si el endpoint no existe o el método no está permitido
        const msg = (error.message && (error.message.includes('404') || error.message.includes('405') || error.message.includes('endpoint') || error.message.includes('Method Not Allowed')))
            ? 'Módulo de cuentas no disponible en el servidor backend. Por favor contacta al administrador.'
            : error.message || 'Error cargando cuentas.';
        accountsGrid.innerHTML = `<p style="color: var(--error-color);">${msg}</p>`;
    }
}


function handlePaymentModal(event) {
    const button = event.target.closest('.btn-payment');
    if (!button) return;

    const accountId = button.dataset.id;
    const modal = document.getElementById('payment-modal');
    if (!modal) return;

    const paymentInput = modal.querySelector('#payment-amount');
    // Store the mesa_id in the hidden input
    const mesaIdInput = modal.querySelector('#payment-mesa-id');

    if (paymentInput) paymentInput.value = '';
    if (mesaIdInput) mesaIdInput.value = accountId;

    // modal.style.display = 'flex';
    modal.classList.remove('hidden');
    modal.classList.add('active');
}

async function handlePaymentSubmit(event) {
    event.preventDefault();
    const form = event.target;

    // Get values from form inputs
    const mesaIdInput = form.querySelector('#payment-mesa-id');
    const amountInput = form.querySelector('#payment-amount');
    const methodSelect = form.querySelector('#payment-method');

    const mesaId = parseInt((mesaIdInput && mesaIdInput.value) || 0, 10);
    const amount = parseFloat((amountInput && amountInput.value) || 0);
    const metodo = (methodSelect && methodSelect.value) || 'Efectivo';

    if (!amount || amount <= 0) {
        showNotification('Por favor ingresa un monto válido.', 'error');
        return;
    }

    if (!mesaId) {
        showNotification('Error: Mesa no identificada.', 'error');
        return;
    }

    // Buscar la cuenta actual para obtener el saldo pendiente
    const currentAccount = currentAccounts.find(acc => acc.mesa_id === mesaId);
    const saldoPendiente = currentAccount ? (currentAccount.saldo_pendiente || 0) : 0;

    // VALIDACIÓN DE SOBREPAGO
    if (amount > saldoPendiente && saldoPendiente >= 0) {
        // Mostrar modal de confirmación de sobrepago
        showOverpaymentConfirmation(mesaId, amount, metodo, saldoPendiente);
        return;
    }

    // Si no hay sobrepago, proceder normalmente
    await processPayment(mesaId, amount, metodo);
}

function showOverpaymentConfirmation(mesaId, amount, metodo, saldoPendiente) {
    const overpaymentModal = document.getElementById('confirm-overpayment-modal');
    const overpaymentMessage = document.getElementById('overpayment-message');

    if (!overpaymentModal) return;

    const exceso = (amount - saldoPendiente).toFixed(2);
    overpaymentMessage.innerHTML = `
        El monto ingresado <strong>($${amount})</strong> es mayor que la deuda actual <strong>($${saldoPendiente})</strong>.<br>
        Exceso: <strong style="color: var(--warning-color);">$${exceso}</strong><br><br>
        ¿Deseas registrarlo como un pago adelantado?
    `;

    // overpaymentModal.style.display = 'flex';
    overpaymentModal.classList.remove('hidden');
    overpaymentModal.classList.add('active');

    // Configurar los botones de confirmación
    const confirmBtn = document.getElementById('confirm-overpayment-btn');
    const cancelBtn = document.getElementById('cancel-overpayment-btn');

    // Remover listeners anteriores (si existen)
    const newConfirmBtn = confirmBtn.cloneNode(true);
    const newCancelBtn = cancelBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

    // Agregar nuevos listeners
    newConfirmBtn.addEventListener('click', async () => {
        overpaymentModal.classList.remove('active');
        overpaymentModal.classList.add('hidden');
        await processPayment(mesaId, amount, metodo);
    });

    newCancelBtn.addEventListener('click', () => {
        overpaymentModal.classList.remove('active');
        overpaymentModal.classList.add('hidden');
        showNotification('Pago cancelado. Por favor ingresa un monto correcto.', 'info');
    });
}

async function processPayment(mesaId, amount, metodo) {
    try {
        // Registrar el pago usando el endpoint admin POST /api/v1/admin/pagos
        const payload = { mesa_id: mesaId, monto: amount, metodo_pago: metodo };
        const result = await apiFetch('/admin/pagos', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        showNotification(`Pago de $${amount} registrado exitosamente.`, 'success');

        // Close payment modal
        const modal = document.getElementById('payment-modal');
        if (modal) {
            modal.classList.remove('active');
            modal.classList.add('hidden');
        }

        // Reload accounts page
        await loadAccountsPage();
    } catch (error) {
        showNotification(error.message || 'Error al registrar el pago', 'error');
    }
}

async function handleDeleteAccount(event) {
    const button = event.target;
    if (!button.matches('.btn-delete')) return;

    const accountId = button.dataset.id;
    // No existe endpoint para eliminar cuentas de pago en el backend actual.
    showNotification('Eliminar cuentas no está soportado por el backend.', 'error');
}

async function handleCloseSession(event) {
    const button = event.target;
    if (!button.matches('.btn-close-session')) return;
    const mesaId = button.dataset.id;
    if (!confirm('¿Estás seguro de cerrar la sesión de esta mesa? Se eliminarán todas las canciones en cola y se desactivará la mesa.')) return;

    try {
        await apiFetch(`/admin/tables/${mesaId}/close-session`, { method: 'POST' });
        showNotification('Sesión cerrada exitosamente.', 'success');
        await loadAccountsPage();
    } catch (e) {
        showNotification(e.message || 'Error closing session', 'error');
    }
}

async function handlePreviousAccounts(event) {
    const button = event.target;
    if (!button.matches('.btn-prev-accounts')) return;
    const mesaId = button.dataset.id;

    try {
        const history = await apiFetch(`/admin/tables/${mesaId}/previous-accounts`);
        showHistoryModal(history);
    } catch (e) {
        showNotification(e.message || 'Error fetching history', 'error');
    }
}

function showHistoryModal(history) {
    const modal = document.getElementById('account-history-modal');
    const list = document.getElementById('history-list');
    if (!modal || !list) return;

    list.innerHTML = '';
    if (!history || history.length === 0) {
        list.innerHTML = '<p>No hay cuentas anteriores registradas.</p>';
    } else {
        history.forEach(acc => {
            const item = document.createElement('div');
            item.className = 'history-item';
            item.className = 'history-item';

            const closedDate = formatFechaHora(acc.closed_at || acc.created_at);

            const info = document.createElement('span');
            info.textContent = `Cuenta #${acc.id} - Cerrada: ${closedDate}`;

            const btn = document.createElement('button');
            btn.className = 'form-btn small';
            btn.textContent = 'Ver Detalle';
            btn.onclick = () => showAccountDetails(acc.id);

            item.appendChild(info);
            item.appendChild(btn);
            list.appendChild(item);
        });
    }
    // modal.style.display = 'flex';
    modal.classList.remove('hidden');
    modal.classList.add('active');
}

async function showAccountDetails(cuentaId) {
    try {
        const details = await apiFetch(`/admin/accounts/${cuentaId}`);
        await renderDetailsModal(details);
    } catch (e) {
        showNotification(e.message, 'error');
    }
}

async function renderDetailsModal(details) {
    const modal = document.getElementById('account-details-modal');
    const content = document.getElementById('details-content');
    if (!modal || !content) return;

    const mesaId = details.mesa_id;
    const consumos = details.consumos || [];
    const pagos = details.pagos || [];
    // Parsear los valores numéricos correctamente (pueden venir como Decimal serializado, número o string)
    const totalConsumido = Number(details.total_consumido != null ? details.total_consumido : 0).toLocaleString('es-CO', { minimumFractionDigits: 2 });
    const totalPagado = Number(details.total_pagado != null ? details.total_pagado : 0).toLocaleString('es-CO', { minimumFractionDigits: 2 });
    const saldoRaw = details.saldo_pendiente !== undefined ? details.saldo_pendiente : (details.saldo != null ? details.saldo : 0);
    const saldoPendiente = Number(saldoRaw != null ? saldoRaw : 0).toLocaleString('es-CO', { minimumFractionDigits: 2 });

    content.innerHTML = `
        <div class="details-modal-grid" style="display: flex; gap: 18px; flex-wrap: wrap; width: 100%; box-sizing: border-box; align-items: flex-start;">
            <!-- COLUMNA IZQUIERDA: Resumen, Pagos, Consumos -->
            <div style="flex: 1 1 45%; min-width: 290px; display: flex; flex-direction: column; gap: 14px; box-sizing: border-box;">
                
                <!-- 1. Resumen Card -->
                <div style="background: rgba(0,0,0,0.25); padding: 16px; border-radius: 10px; border: 1px solid var(--border-color, #444);">
                    <h4 style="margin-top: 0; margin-bottom: 12px; color: var(--bees-yellow, #fdb913); border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 6px; font-size: 1.05rem;">
                        📊 Resumen de Cuenta
                    </h4>
                    <div style="display: flex; flex-direction: column; gap: 6px; font-size: 0.95rem;">
                        <p style="margin: 0; display: flex; justify-content: space-between;">
                            <strong style="color: #ccc;">Mesa / Espacio:</strong>
                            <span style="font-weight: bold; color: #fff;">${details.mesa_nombre || `Mesa ${details.mesa_id}`}</span>
                        </p>
                        <p style="margin: 0; display: flex; justify-content: space-between;">
                            <strong style="color: #ccc;">Total Consumido:</strong>
                            <span style="font-weight: bold; color: #ff9800;">$${totalConsumido}</span>
                        </p>
                        <p style="margin: 0; display: flex; justify-content: space-between;">
                            <strong style="color: #ccc;">Total Pagado:</strong>
                            <span style="font-weight: bold; color: #4caf50;">$${totalPagado}</span>
                        </p>
                        <p style="margin: 4px 0 0 0; display: flex; justify-content: space-between; font-size: 1.05rem; font-weight: bold; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 8px;">
                            <span>Saldo Pendiente:</span>
                            <span style="color: ${Number(saldoRaw) > 0 ? '#ef4444' : '#22c55e'};">$${saldoPendiente}</span>
                        </p>
                    </div>
                </div>

                <!-- 2. Pagos Card (Abajo del Resumen) -->
                <div style="background: rgba(0,0,0,0.25); padding: 16px; border-radius: 10px; border: 1px solid var(--border-color, #444);">
                    <h4 style="margin-top: 0; margin-bottom: 10px; color: var(--bees-yellow, #fdb913); border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 6px; display: flex; justify-content: space-between; align-items: center; font-size: 1.05rem;">
                        <span>💳 Pagos Realizados</span>
                        <span style="font-size: 0.8rem; background: rgba(76, 175, 80, 0.2); color: #4caf50; padding: 2px 8px; border-radius: 10px; font-weight: normal;">${pagos.length}</span>
                    </h4>
                    <ul style="list-style: none; padding: 0; margin: 0; max-height: 160px; overflow-y: auto;">
                        ${pagos.length ? pagos.map(p => `
                            <li style="padding: 8px; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between; align-items: center; font-size: 0.9rem;">
                                <div style="color: #aaa; font-size: 0.85em;">${formatFechaHora(p.created_at)} <span style="color: var(--bees-yellow, #fdb913); font-size: 0.85em; font-weight: 600; margin-left: 4px;">• ${p.metodo_pago || p.metodo || 'Efectivo'}</span></div>
                                <span style="font-weight: bold; color: #4caf50;">$${Number(p.monto).toLocaleString('es-CO', { minimumFractionDigits: 2 })}</span>
                            </li>
                        `).join('') : '<li style="text-align: center; color: #777; padding: 12px; font-size: 0.9rem;">Sin pagos registrados</li>'}
                    </ul>
                </div>

                <!-- 3. Consumos Card (Abajo de Pagos) -->
                <div style="background: rgba(0,0,0,0.25); padding: 16px; border-radius: 10px; border: 1px solid var(--border-color, #444);">
                    <h4 style="margin-top: 0; margin-bottom: 10px; color: var(--bees-yellow, #fdb913); border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 6px; display: flex; justify-content: space-between; align-items: center; font-size: 1.05rem;">
                        <span>🍽️ Consumos de la Mesa</span>
                        <span style="font-size: 0.8rem; background: rgba(255, 152, 0, 0.2); color: #ff9800; padding: 2px 8px; border-radius: 10px; font-weight: normal;">${consumos.length}</span>
                    </h4>
                    <ul class="details-consumos-list" style="list-style: none; padding: 0; margin: 0; max-height: 220px; overflow-y: auto;">
                        ${consumos.length ? consumos.map(c => `
                            <li style="padding: 8px 6px; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between; align-items: center; gap: 8px; font-size: 0.9rem;">
                                <div style="flex: 1; min-width: 0;">
                                    <span style="font-weight: bold; color: #f5f5f5;">${c.cantidad}x</span> 
                                    <span style="color: #ddd;">${c.producto_nombre || `Producto #${c.producto_id}`}</span>
                                    <div style="font-size: 0.78em; color: #888; margin-top: 2px;">${formatFechaHora(c.created_at)}</div>
                                </div>
                                <span style="font-weight: bold; color: #ff9800; min-width: 60px; text-align: right;">$${Number(c.valor_total).toLocaleString('es-CO', { minimumFractionDigits: 2 })}</span>
                                ${c.id ? `
                                <div style="display: flex; gap: 4px; margin-left: 4px;">
                                    <button class="btn-edit-consumo" data-consumo-id="${c.id}" data-mesa-id="${details.mesa_id}" data-qty="${c.cantidad}" data-nombre="${c.producto_nombre || 'Producto'}" title="Editar cantidad" style="background: rgba(253, 185, 19, 0.15); border: 1px solid rgba(253, 185, 19, 0.4); color: #fdb913; cursor: pointer; border-radius: 4px; padding: 3px 6px; font-size: 0.85em;">✏️</button>
                                    <button class="btn-delete-consumo" data-consumo-id="${c.id}" data-mesa-id="${details.mesa_id}" data-nombre="${c.producto_nombre || 'Producto'}" title="Eliminar producto" style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.4); color: #ef4444; cursor: pointer; border-radius: 4px; padding: 3px 6px; font-size: 0.85em;">❌</button>
                                </div>
                                ` : ''}
                            </li>
                        `).join('') : '<li style="text-align: center; color: #777; padding: 12px; font-size: 0.9rem;">Sin consumos registrados</li>'}
                    </ul>
                </div>
            </div>

            <!-- COLUMNA DERECHA: Panel de Pedido -->
            <div style="flex: 1 1 50%; min-width: 320px; background: rgba(0,0,0,0.25); padding: 16px; border-radius: 10px; border: 1px solid var(--border-color, #444); display: flex; flex-direction: column; gap: 12px; box-sizing: border-box;">
                <h4 style="margin-top: 0; margin-bottom: 4px; color: var(--bees-yellow, #fdb913); border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 6px; font-size: 1.05rem;">
                    🛒 Tomar Pedido para la Mesa
                </h4>

                <!-- Buscador de productos -->
                <div>
                    <input type="text" id="details-product-search" placeholder="🔍 Buscar producto..." class="form-input" style="width: 100%; box-sizing: border-box; padding: 8px 12px; border-radius: 6px; background: rgba(0,0,0,0.3); border: 1px solid #555; color: #fff; font-size: 0.9rem;">
                </div>

                <!-- Catálogo de productos interactivo -->
                <div style="font-size: 0.85rem; color: #aaa; margin-bottom: -6px;">Toca un producto para agregarlo:</div>
                <div id="details-products-grid" style="display: flex; flex-direction: column; gap: 4px; max-height: 180px; min-height: 100px; overflow-y: auto; padding-right: 4px; background: rgba(0,0,0,0.2); border-radius: 6px; padding: 6px; border: 1px solid rgba(255,255,255,0.05);">
                    <div style="text-align: center; padding: 15px; color: #888;">Cargando productos...</div>
                </div>

                <!-- Carrito actual -->
                <div style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 10px;">
                    <div style="font-size: 0.85rem; font-weight: bold; color: #ccc; margin-bottom: 6px;">📋 Items seleccionados:</div>
                    <div style="background: rgba(0,0,0,0.2); border-radius: 6px; padding: 6px; overflow-y: auto; max-height: 140px; border: 1px solid rgba(255,255,255,0.05);">
                        <ul id="details-cart-list" style="list-style: none; padding: 0; margin: 0;">
                            <li style="text-align: center; color: #777; font-size: 0.85em; padding: 10px;">Carrito vacío (selecciona productos arriba)</li>
                        </ul>
                    </div>
                </div>

                <!-- Total del Pedido -->
                <div style="display: flex; justify-content: space-between; align-items: center; font-weight: bold; font-size: 1.05rem; color: white; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 8px;">
                    <span>Total del Pedido:</span>
                    <span id="details-total-amount" style="color: var(--bees-yellow, #fdb913); font-size: 1.15rem;">$0.00</span>
                </div>

                <!-- Botón Hacer Pedido -->
                <button id="btn-details-confirm-order" class="form-btn" style="background-color: var(--bees-green, #28a745); color: white; width: 100%; padding: 12px; font-weight: bold; font-size: 1rem; border-radius: 8px; border: none; cursor: pointer; transition: background-color 0.2s; box-shadow: 0 2px 6px rgba(0,0,0,0.3);">
                    🛒 Hacer Pedido
                </button>
            </div>
        </div>
    `;

    // Reset local order cart
    orderCart = {};
    updateDetailsCartUI();

    // Bind search input
    const searchInput = document.getElementById('details-product-search');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const filtered = availableProducts.filter(p => p.nombre.toLowerCase().includes(term));
            renderDetailsProductGrid(filtered);
        });
    }

    // Bind confirm button
    const confirmBtn = document.getElementById('btn-details-confirm-order');
    if (confirmBtn) {
        confirmBtn.addEventListener('click', () => handleDetailsOrderSubmit(mesaId));
    }

    // Load products and populate grid
    await loadProductsForOrder();
    renderDetailsProductGrid(availableProducts);

    modal.classList.remove('hidden');
    modal.classList.add('active');
}

function renderDetailsProductGrid(products) {
    const grid = document.getElementById('details-products-grid');
    if (!grid) return;
    grid.innerHTML = '';

    if (products.length === 0) {
        grid.innerHTML = '<div style="text-align: center; padding: 15px; color: #888; font-size: 0.85rem;">No se encontraron productos.</div>';
        return;
    }

    products.forEach(p => {
        const row = document.createElement('div');
        row.style.cssText = 'display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.05); padding: 7px 10px; cursor: pointer; transition: background 0.15s; border-radius: 5px;';
        row.onmouseover = () => row.style.background = 'rgba(255,255,255,0.12)';
        row.onmouseout = () => row.style.background = 'rgba(255,255,255,0.06)';

        row.innerHTML = `
            <div style="font-weight: 500; color: #f0f0f0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-right: 8px; font-size: 0.9rem;">${p.nombre}</div>
            <div style="color: var(--bees-yellow, #f5c518); font-weight: bold; min-width: 60px; text-align: right; font-size: 0.9rem;">$${Number(p.valor).toLocaleString('es-CO', { minimumFractionDigits: 2 })}</div>
        `;

        row.onclick = () => {
            if (!orderCart[p.id]) {
                orderCart[p.id] = { ...p, quantity: 0 };
            }
            orderCart[p.id].quantity++;
            updateDetailsCartUI();
        };
        grid.appendChild(row);
    });
}

function updateDetailsCartUI() {
    const list = document.getElementById('details-cart-list');
    const totalEl = document.getElementById('details-total-amount');
    if (!list || !totalEl) return;

    list.innerHTML = '';
    let total = 0;
    const items = Object.values(orderCart);

    if (items.length === 0) {
        list.innerHTML = '<li style="text-align: center; color: #777; font-size: 0.85em; padding: 10px;">Carrito vacío (selecciona productos arriba)</li>';
    } else {
        items.forEach(item => {
            const li = document.createElement('li');
            li.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; font-size: 0.9rem; background: rgba(255,255,255,0.04); padding: 6px 8px; border-radius: 5px; border-bottom: 1px solid rgba(255,255,255,0.05);';
            li.innerHTML = `
                <div style="flex: 1; min-width: 0; margin-right: 8px;">
                    <div style="font-weight: bold; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${item.nombre}</div>
                    <div style="font-size: 0.8em; color: #aaa;">$${Number(item.valor).toLocaleString('es-CO', { minimumFractionDigits: 2 })} c/u</div>
                </div>
                <div style="display: flex; align-items: center; gap: 6px;">
                    <button class="btn-cart-minus" style="width: 22px; height: 22px; border-radius: 4px; border: none; background: #555; color: white; cursor: pointer; font-weight: bold; font-size: 0.85rem; line-height: 1;">-</button>
                    <span style="font-weight: bold; min-width: 18px; text-align: center; color: #fff;">${item.quantity}</span>
                    <button class="btn-cart-plus" style="width: 22px; height: 22px; border-radius: 4px; border: none; background: var(--bees-yellow, #fdb913); color: #000; cursor: pointer; font-weight: bold; font-size: 0.85rem; line-height: 1;">+</button>
                    <button class="btn-cart-delete" style="background: none; border: none; color: #ef4444; cursor: pointer; font-size: 1.1rem; margin-left: 2px; padding: 0;" title="Quitar">❌</button>
                </div>
            `;
            li.querySelector('.btn-cart-minus').onclick = () => {
                orderCart[item.id].quantity--;
                if (orderCart[item.id].quantity <= 0) delete orderCart[item.id];
                updateDetailsCartUI();
            };
            li.querySelector('.btn-cart-plus').onclick = () => {
                orderCart[item.id].quantity++;
                updateDetailsCartUI();
            };
            li.querySelector('.btn-cart-delete').onclick = () => {
                delete orderCart[item.id];
                updateDetailsCartUI();
            };
            list.appendChild(li);
            total += Number(item.valor) * item.quantity;
        });
    }
    totalEl.textContent = `$${total.toLocaleString('es-CO', { minimumFractionDigits: 2 })}`;
}

async function handleDetailsOrderSubmit(mesaId) {
    const confirmBtn = document.getElementById('btn-details-confirm-order');
    const items = Object.values(orderCart);
    if (items.length === 0) {
        showNotification("El carrito está vacío. Agrega al menos un producto.", "error");
        return;
    }

    const total = items.reduce((sum, item) => sum + (parseFloat(item.valor) * item.quantity), 0);
    const mesaAccount = currentAccounts.find(a => a.mesa_id == mesaId);
    const mesaLabel = mesaAccount ? (mesaAccount.mesa_nombre || `Mesa ${mesaId}`) : `Mesa ${mesaId}`;

    let msg = `¿Confirmar pedido para ${mesaLabel}?\n\n`;
    items.forEach(item => {
        msg += `• ${item.quantity}x ${item.nombre} ($${(parseFloat(item.valor) * item.quantity).toLocaleString('es-CO', { minimumFractionDigits: 2 })})\n`;
    });
    msg += `\nTotal: $${total.toLocaleString('es-CO', { minimumFractionDigits: 2 })}`;

    if (!confirm(msg)) return;

    if (confirmBtn) {
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Enviando pedido...';
    }

    try {
        const payload = {
            items: items.map(item => ({
                producto_id: item.id,
                cantidad: item.quantity
            }))
        };

        await apiFetch(`/admin/tables/${mesaId}/pedidos`, {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        showNotification("Pedido creado exitosamente.", "success");
        orderCart = {};
        updateDetailsCartUI();
        await reloadAccountDetails(mesaId);
    } catch (e) {
        showNotification(e.message || "Error al crear el pedido", "error");
    } finally {
        if (confirmBtn) {
            confirmBtn.disabled = false;
            confirmBtn.textContent = '🛒 Hacer Pedido';
        }
    }
}


async function handleCreateMesaSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const numeroInput = form.querySelector('#mesa-numero');
    const nombreInput = form.querySelector('#mesa-nombre');

    const numeroMesa = (numeroInput && numeroInput.value ? numeroInput.value.trim() : '');
    const nombreMesa = (nombreInput && nombreInput.value ? nombreInput.value.trim() : '');

    // Validar que al menos uno de los dos campos tenga valor
    if (!numeroMesa && !nombreMesa) {
        showNotification('Por favor ingresa un número o un nombre para la mesa.', 'error');
        return;
    }

    let finalNombre = '';
    let qrCode = '';

    if (numeroMesa && nombreMesa) {
        finalNombre = `${nombreMesa} (Mesa ${numeroMesa})`;
        qrCode = `karaoke-mesa-${numeroMesa}`;
    } else if (numeroMesa) {
        finalNombre = `Mesa ${numeroMesa}`;
        qrCode = `karaoke-mesa-${numeroMesa}`;
    } else {
        finalNombre = nombreMesa;
        const safeSlug = nombreMesa.toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
        qrCode = `karaoke-mesa-${safeSlug || 'espacio'}`;
    }

    try {
        const activeLocalId = sessionStorage.getItem('active_local_id');
        const payload = {
            nombre: finalNombre,
            qr_code: qrCode,
            local_id: activeLocalId ? parseInt(activeLocalId, 10) : null
        };
        const result = await apiFetch('/mesas/', {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        showNotification(`Mesa "${finalNombre}" creada exitosamente.`, 'success');

        // Cerrar el modal
        const modal = document.getElementById('create-mesa-modal');
        if (modal) {
            modal.classList.remove('active');
            modal.classList.add('hidden');
        }

        // Limpiar el formulario
        numeroInput.value = '';
        nombreInput.value = '';

        // Recargar la página de cuentas
        await loadAccountsPage();
    } catch (error) {
        showNotification(error.message || 'Error al crear la mesa', 'error');
    }
}

function setupCreateMesaModal() {
    const createMesaBtn = document.getElementById('btn-create-mesa');
    const createMesaModal = document.getElementById('create-mesa-modal');
    const createMesaForm = document.getElementById('create-mesa-form');
    const closeCreateMesaBtn = document.getElementById('create-mesa-modal-close');

    if (createMesaBtn) {
        createMesaBtn.addEventListener('click', () => {
            if (createMesaModal) {
                createMesaModal.classList.remove('hidden');
                createMesaModal.classList.add('active');
            }
        });
    }

    if (createMesaForm) {
        createMesaForm.addEventListener('submit', handleCreateMesaSubmit);
    }

    if (closeCreateMesaBtn) {
        closeCreateMesaBtn.addEventListener('click', () => {
            if (createMesaModal) {
                createMesaModal.classList.remove('active');
                createMesaModal.classList.add('hidden');
            }
        });
    }

    if (createMesaModal) {
        createMesaModal.addEventListener('click', (e) => {
            if (e.target === createMesaModal) {
                createMesaModal.classList.remove('active');
                createMesaModal.classList.add('hidden');
            }
        });
    }
}

// Setup QR Modal Listeners
function setupQRModal() {
    const qrModal = document.getElementById('qr-management-modal');
    const closeBtn = document.getElementById('qr-modal-close');
    const closeXBtn = document.getElementById('qr-modal-close-x');
    const userSelect = document.getElementById('qr-modal-user-select');
    const addUserBtn = document.getElementById('qr-modal-add-user');
    const removeUserBtn = document.getElementById('qr-modal-remove-user');

    if (closeBtn) closeBtn.onclick = () => closeQRModal();
    if (closeXBtn) closeXBtn.onclick = () => closeQRModal();
    if (qrModal) qrModal.onclick = (e) => { if (e.target === qrModal) closeQRModal(); };

    if (userSelect) {
        userSelect.addEventListener('change', () => {
            if (currentQRTableId) {
                updateQRForTable(currentQRTableId, userSelect.value);
                // Enable/Disable remove button based on selection
                if (removeUserBtn) {
                    // Prevent removing the last user or User 1 if desired, though logic below handles removal properly.
                    // For now, always enable unless it's the only one? No, user requested X next to QR.
                    // Let's enable it always if a valid user is selected.
                    removeUserBtn.disabled = !userSelect.value;
                }
            }
        });
    }

    if (addUserBtn && userSelect) {
        addUserBtn.addEventListener('click', () => {
            // Find max current ID
            let maxId = 0;
            for (let opt of userSelect.options) {
                const val = parseInt(opt.value, 10);
                if (!isNaN(val) && val > maxId) maxId = val;
            }
            const newId = maxId + 1;

            if (newId > 100) {
                showNotification('Límite de usuarios alcanzado (100).', 'warning');
                return;
            }

            const option = document.createElement('option');
            option.value = newId.toString();
            option.textContent = `Usuario ${newId}`;
            userSelect.appendChild(option);

            // Select the new user
            userSelect.value = newId.toString();

            // Trigger update
            if (currentQRTableId) {
                updateQRForTable(currentQRTableId, newId.toString());
            }

            // Enable remove button
            if (removeUserBtn) removeUserBtn.disabled = false;
        });
    }

    if (removeUserBtn && userSelect) {
        removeUserBtn.addEventListener('click', () => {
            const selectedVal = userSelect.value;
            if (!selectedVal) return;

            // Confirm? Maybe not needed for quick action, but safer.
            // if (!confirm(`¿Eliminar Usuario ${selectedVal}?`)) return;

            const selectedIndex = userSelect.selectedIndex;
            userSelect.remove(selectedIndex);

            // Select another user if available
            if (userSelect.options.length > 0) {
                // Try to select previous, or first
                const newIndex = Math.max(0, selectedIndex - 1);
                userSelect.selectedIndex = newIndex;
                updateQRForTable(currentQRTableId, userSelect.value);
                removeUserBtn.disabled = false;
            } else {
                // Empty state - Should we recreate User 1? Or just clear QR?
                // The requirements say "disable", so maybe just clear QR
                const img = document.getElementById('qr-modal-img');
                const urlText = document.getElementById('qr-modal-url');
                if (img) img.src = '';
                if (urlText) urlText.textContent = 'Sin usuario seleccionado';
                removeUserBtn.disabled = true;
            }
        });
    }
}

function closeQRModal() {
    const qrModal = document.getElementById('qr-management-modal');
    if (qrModal) {
        qrModal.classList.remove('active');
        qrModal.classList.add('hidden');
    }
    currentQRTableId = null;
}

async function openQRModal(mesaId) {
    const qrModal = document.getElementById('qr-management-modal');
    const userSelect = document.getElementById('qr-modal-user-select');
    const modalTitle = document.getElementById('qr-modal-title');
    const removeUserBtn = document.getElementById('qr-modal-remove-user');

    if (!qrModal) return;

    currentQRTableId = mesaId;

    // Find mesa name
    const account = currentAccounts.find(a => a.mesa_id == mesaId);
    let mesaName = account ? (account.mesa_nombre || 'Mesa ' + mesaId) : 'Mesa ' + mesaId;
    if (modalTitle) modalTitle.textContent = `Gestionar QR - ${mesaName}`;

    // Reset dropdown and fetch connected users
    if (userSelect) {
        userSelect.innerHTML = ''; // Clear existing
        try {
            // Fetch connected users to get real names
            const connectedUsers = await apiFetch(`/mesas/${mesaId}/usuarios-conectados`);

            // We need to reconstruct the "Slots". 
            // Since the backend might not persist "Slot 1 = Pedro", we have to infer or just list them.
            // Strategy: List connected users FIRST with their real names.
            // Then check if we need to add "Usuario X" placeholder for the max ID found + 1?
            // Actually, the user wants "Usuario 1 (Pedro)". This implies a mapping.
            // If the backend doesn't store "Usuario 1" was assigned to "Pedro", we can't reproduce it perfectly on reload.
            // Assumption: We will list connected users as "Usuario X (Nick)". 
            // If there are NO connected users, we default to "Usuario 1 (Principal)".

            let maxId = 0;

            if (connectedUsers && connectedUsers.length > 0) {
                // Sort by ID or creation if possible, else just map
                connectedUsers.forEach((u, index) => {
                    // If user object has a slot ID, use it. If not, use index + 1?
                    // Backend user object: { id, nick, ... }
                    // We don't have a stored 'slot' in the standard User model usually.
                    // We will assign them slots 1..N based on this list.
                    const slotId = index + 1;
                    const option = document.createElement('option');
                    option.value = slotId.toString();
                    option.textContent = `Usuario ${slotId} (${u.nick})`;
                    userSelect.appendChild(option);
                    maxId = slotId;
                });

                // If we want to ensure at least one "Open" slot or if the user wants to add more.
                // We leave it as is, user can click (+) to add new slots.
            } else {
                // Default clean state
                const option = document.createElement('option');
                option.value = "1";
                option.textContent = "Usuario 1 (Principal)";
                userSelect.appendChild(option);
                maxId = 1;
            }
        } catch (e) {
            console.warn("Error fetching connected users, falling back to default", e);
            const option = document.createElement('option');
            option.value = "1";
            option.textContent = "Usuario 1 (Principal)";
            userSelect.appendChild(option);
        }

        // Select the first one
        if (userSelect.options.length > 0) {
            userSelect.selectedIndex = 0;
            updateQRForTable(mesaId, userSelect.value);
            if (removeUserBtn) removeUserBtn.disabled = false;
        } else {
            if (removeUserBtn) removeUserBtn.disabled = true;
        }
    }

    qrModal.classList.remove('hidden');
    qrModal.classList.add('active');
}

async function updateQRForTable(mesaId, userNum) {
    const img = document.getElementById('qr-modal-img');
    const urlText = document.getElementById('qr-modal-url');

    let localId = null;
    if (typeof currentAccounts !== 'undefined') {
        const account = currentAccounts.find(a => a.mesa_id == mesaId);
        if (account && account.local_id) {
            localId = account.local_id;
        }
    }
    if (!localId && localStorage.getItem('selectedLocalId')) {
        localId = parseInt(localStorage.getItem('selectedLocalId'));
    }
    if (!localId) localId = 1;

    try {
        const res = await apiFetch(`/mesas/generate-qr-key?mesa_id=${mesaId}&local_id=${localId}&user_num=${userNum}`);
        if (res && res.key) {
            const appBaseUrl = window.location.origin;
            const appUrl = `${appBaseUrl}/user?key=${encodeURIComponent(res.key)}`;
            const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(appUrl)}`;

            if (img) img.src = qrImageUrl;
            if (urlText) urlText.textContent = appUrl;
        }
    } catch (e) {
        console.error("Error generando QR key:", e);
    }
}


function setupAccountsListeners() {
    const accountsGrid = document.getElementById('accounts-grid');
    const paymentModal = document.getElementById('payment-modal');
    const paymentForm = document.getElementById('payment-form');
    const closePaymentModalBtn = document.getElementById('payment-modal-close');
    const overpaymentModal = document.getElementById('confirm-overpayment-modal');

    // New modals
    const historyModal = document.getElementById('account-history-modal');
    const detailsModal = document.getElementById('account-details-modal');
    const closeHistoryBtn = document.getElementById('history-modal-close');
    const closeDetailsXBtn = document.getElementById('details-modal-close-x');

    if (accountsGrid) {
        accountsGrid.addEventListener('click', handlePaymentModal);
        accountsGrid.addEventListener('click', handleDeleteAccount);
        accountsGrid.addEventListener('click', handleCloseSession);
        accountsGrid.addEventListener('click', handlePreviousAccounts);
    }
    // Attach submit listener to the form, not the button
    if (paymentForm) paymentForm.addEventListener('submit', handlePaymentSubmit);

    if (closePaymentModalBtn) {
        closePaymentModalBtn.addEventListener('click', () => {
            if (paymentModal) {
                paymentModal.classList.remove('active');
                paymentModal.classList.add('hidden');
            }
        });
    }
    if (paymentModal) {
        paymentModal.addEventListener('click', (e) => {
            if (e.target === paymentModal) {
                paymentModal.classList.remove('active');
                paymentModal.classList.add('hidden');
            }
        });
    }

    if (overpaymentModal) {
        overpaymentModal.addEventListener('click', (e) => {
            if (e.target === overpaymentModal) {
                overpaymentModal.classList.remove('active');
                overpaymentModal.classList.add('hidden');
                showNotification('Pago cancelado.', 'info');
            }
        });
    }

    // Listeners for new modals
    if (closeHistoryBtn) closeHistoryBtn.onclick = () => { if (historyModal) { historyModal.classList.remove('active'); historyModal.classList.add('hidden'); } };
    if (historyModal) historyModal.onclick = (e) => { if (e.target === historyModal) { historyModal.classList.remove('active'); historyModal.classList.add('hidden'); } };

    if (closeDetailsXBtn) closeDetailsXBtn.onclick = () => { if (detailsModal) { detailsModal.classList.remove('active'); detailsModal.classList.add('hidden'); } };
    if (detailsModal) {
        detailsModal.onclick = (e) => { if (e.target === detailsModal) { detailsModal.classList.remove('active'); detailsModal.classList.add('hidden'); } };

        // Event delegation for edit and delete buttons inside detailsModal
        detailsModal.addEventListener('click', async (e) => {
            const editBtn = e.target.closest('.btn-edit-consumo');
            if (editBtn) {
                const consumoId = editBtn.dataset.consumoId;
                const mesaId = editBtn.dataset.mesaId;
                const currentQty = parseInt(editBtn.dataset.qty, 10) || 1;
                const prodNombre = editBtn.dataset.nombre || 'este producto';

                const newQtyStr = prompt(`Ingresa la nueva cantidad para "${prodNombre}":`, currentQty);
                if (newQtyStr === null) return;
                const newQty = parseInt(newQtyStr, 10);
                if (isNaN(newQty) || newQty <= 0) {
                    showNotification('Por favor ingresa una cantidad válida mayor a 0.', 'error');
                    return;
                }
                if (newQty === currentQty) return;

                try {
                    await apiFetch(`/admin/consumos/${consumoId}`, {
                        method: 'PUT',
                        body: JSON.stringify({ cantidad: newQty })
                    });
                    showNotification(`Cantidad de "${prodNombre}" actualizada a ${newQty}.`, 'success');
                    await reloadAccountDetails(mesaId);
                } catch (err) {
                    console.error('Error updating consumo:', err);
                    showNotification(err.message || 'Error al actualizar la cantidad.', 'error');
                }
                return;
            }

            const deleteBtn = e.target.closest('.btn-delete-consumo');
            if (deleteBtn) {
                const consumoId = deleteBtn.dataset.consumoId;
                const mesaId = deleteBtn.dataset.mesaId;
                const prodNombre = deleteBtn.dataset.nombre || 'este producto';

                if (!confirm(`¿Estás seguro de eliminar "${prodNombre}" del pedido?\nSe reintegrará el inventario/stock y se actualizará la cuenta de la mesa.`)) {
                    return;
                }

                try {
                    await apiFetch(`/admin/consumos/${consumoId}`, {
                        method: 'DELETE'
                    });
                    showNotification(`"${prodNombre}" eliminado del pedido exitosamente.`, 'success');
                    await reloadAccountDetails(mesaId);
                } catch (err) {
                    console.error('Error deleting consumo:', err);
                    showNotification(err.message || 'Error al eliminar el producto.', 'error');
                }
                return;
            }
        });
    }

    // Setup Order Modal
    injectOrderModal();
    const orderModal = document.getElementById('admin-create-order-modal');
    const closeOrderX = document.getElementById('order-modal-close-x');
    const cancelOrderBtn = document.getElementById('order-modal-cancel');


    const closeOrderModal = () => {
        if (orderModal) {
            orderModal.classList.remove('active');
            orderModal.classList.add('hidden');
        }
    };

    if (closeOrderX) closeOrderX.onclick = closeOrderModal;
    if (cancelOrderBtn) cancelOrderBtn.onclick = closeOrderModal;
    if (orderModal) orderModal.onclick = (e) => { if (e.target === orderModal) closeOrderModal(); };

    // Setup create mesa modal
    setupCreateMesaModal();

    // Setup QR modal
    setupQRModal();

    // Setup mesa card listeners (delegated)
    setupMesaCardListeners();
}

async function reloadAccountDetails(mesaId) {
    try {
        await loadAccountsPage();
        const updatedAccount = currentAccounts.find(a => a.mesa_id == mesaId);
        if (updatedAccount) {
            const details = {
                mesa_id: updatedAccount.mesa_id,
                mesa_nombre: updatedAccount.mesa_nombre || `Mesa ${updatedAccount.mesa_id}`,
                total_consumido: updatedAccount.total_consumido,
                total_pagado: updatedAccount.total_pagado,
                saldo_pendiente: updatedAccount.saldo_pendiente,
                consumos: updatedAccount.consumos || [],
                pagos: updatedAccount.pagos || []
            };
            await renderDetailsModal(details);
        } else {
            const detailsModal = document.getElementById('account-details-modal');
            if (detailsModal) {
                detailsModal.classList.remove('active');
                detailsModal.classList.add('hidden');
            }
        }
    } catch (e) {
        console.error("Error refreshing account details:", e);
    }
}

// ========== MESA CARD LISTENERS & HANDLERS ==========

function setupMesaCardListeners() {
    const accountsGrid = document.getElementById('accounts-grid');
    if (!accountsGrid) return;

    // Use event delegation for better performance
    accountsGrid.addEventListener('click', async (e) => {
        const target = e.target;

        // NEW: Manage QR Button
        if (target.matches('.btn-manage-qr') || target.closest('.btn-manage-qr')) {
            const btn = target.matches('.btn-manage-qr') ? target : target.closest('.btn-manage-qr');
            const mesaId = btn.dataset.mesaId;
            openQRModal(mesaId);
        }

        // Create Order Button
        if (target.matches('.btn-create-order') || target.closest('.btn-create-order')) {
            const btn = target.matches('.btn-create-order') ? target : target.closest('.btn-create-order');
            const mesaId = btn.dataset.mesaId;
            openOrderModal(mesaId);
        }

        // Activate Button
        if (target.matches('.btn-activate') || target.closest('.btn-activate')) {
            const btn = target.matches('.btn-activate') ? target : target.closest('.btn-activate');
            const mesaId = btn.dataset.mesaId;
            await updateMesaStatus(mesaId, 'activate');
        }

        // Close Table Session Button (X)
        if (target.matches('.btn-close-table') || target.closest('.btn-close-table')) {
            const btn = target.matches('.btn-close-table') ? target : target.closest('.btn-close-table');
            const mesaId = btn.dataset.mesaId;

            // Check for outstanding balance before closing session
            const account = currentAccounts.find(a => a.mesa_id == mesaId);
            if (account && Number(account.saldo_pendiente) > 0) {
                showNotification(`⚠️ No se puede cerrar la sesión de la Mesa ${mesaId} porque tiene una deuda pendiente de $${Number(account.saldo_pendiente).toLocaleString('es-CO', { minimumFractionDigits: 2 })}. Por favor registre el pago primero.`, 'error');
                return;
            }

            if (!confirm(`¿Estás seguro de CERRAR la sesión de la Mesa ${mesaId}?\nEsta acción desconectará a los clientes, invalidará el QR y dejará la mesa lista para iniciar desde cero en una próxima sesión.`)) {
                return;
            }

            try {
                await apiFetch(`/admin/tables/${mesaId}/close-session`, { method: 'POST' });
                showNotification(`Sesión de Mesa ${mesaId} cerrada exitosamente.`, 'success');
                await loadAccountsPage();
            } catch (error) {
                console.error(`Error closing session for table ${mesaId}:`, error);
                showNotification(error.message || `Error al cerrar la sesión de la mesa`, 'error');
            }
        }

        // View Details Button
        if (target.matches('.btn-view-details') || target.closest('.btn-view-details')) {
            const btn = target.matches('.btn-view-details') ? target : target.closest('.btn-view-details');
            const mesaId = parseInt(btn.dataset.mesaId, 10);

            console.log(`[DEBUG] View Details clicked for Mesa ${mesaId}`);

            const account = currentAccounts.find(a => a.mesa_id == mesaId);

            if (account) {
                // Usar directamente los datos que ya tenemos en memoria para evitar
                // una segunda llamada API que puede fallar o devolver datos incorrectos.
                // Construir el objeto de detalles a partir de currentAccounts.
                const details = {
                    mesa_id: account.mesa_id,
                    mesa_nombre: account.mesa_nombre || `Mesa ${account.mesa_id}`,
                    total_consumido: account.total_consumido,
                    total_pagado: account.total_pagado,
                    saldo_pendiente: account.saldo_pendiente,
                    consumos: account.consumos || [],
                    pagos: account.pagos || []
                };
                await renderDetailsModal(details);
            } else {
                // Si por alguna razón no está en currentAccounts, intentar por API
                try {
                    await showAccountDetails(mesaId);
                } catch (err) {
                    console.error("Error showing details:", err);
                    showNotification("Error al mostrar detalles: " + err.message, "error");
                }
            }
        }
    });
}

async function updateMesaStatus(mesaId, action) {
    if (!confirm(`¿Estás seguro de ${action === 'activate' ? 'ACTIVAR' : 'DESACTIVAR'} la Mesa ${mesaId}?`)) {
        return;
    }

    try {
        const endpoint = `/admin/tables/${mesaId}/${action}`;
        await apiFetch(endpoint, { method: 'POST' });

        showNotification(`Mesa ${mesaId} ${action === 'activate' ? 'activada' : 'desactivada'} exitosamente.`, 'success');

        // Reload to update UI state
        await loadAccountsPage();
    } catch (error) {
        console.error(`Error ${action} table:`, error);
        showNotification(error.message || `Error al ${action} la mesa`, 'error');
    }
}
