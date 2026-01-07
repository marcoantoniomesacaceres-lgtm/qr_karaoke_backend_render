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
                ${isActive ? `<button class="btn-close-table" data-mesa-id="${acc.mesa_id}" style="position: absolute; top: 10px; right: 10px; background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--text-secondary); line-height: 1;" title="Desactivar Mesa">&times;</button>` : ''}
            </div>
            
            <!-- Cuerpo con info -->
            <div class="mesa-card-body">
                <div class="mesa-info">
                    <div class="info-row">
                        <label>Número de Mesa:</label>
                        <span>${acc.mesa_id}</span>
                    </div>
                    <div class="info-row">
                        <label>Saldo:</label>
                        <span class="mesa-saldo-text ${saldoClass}" style="font-size: 1.4em; font-weight: bold;">$${saldo.toFixed(2)}</span>
                    </div>
                </div>
                
                <!-- Gestión de QR (Botón en lugar de imagen directa) -->
                <div class="mesa-qr-container">
                    <button class="btn-manage-qr" data-mesa-id="${acc.mesa_id}">
                        📱 Gestionar QR
                    </button>
                </div>
            </div>
            
            <!-- Resumen de cuenta -->
            <div class="mesa-account-summary">
                <div class="mesa-account-actions-row">
                    <button class="btn-payment" data-id="${acc.mesa_id}">
                        💵 Registrar Pago
                    </button>
                    <button class="btn-view-details" data-mesa-id="${acc.mesa_id}">
                        Pedidos
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
    const button = event.target;
    if (!button.matches('.btn-payment')) return;

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

    const mesaId = parseInt(mesaIdInput?.value || 0, 10);
    const amount = parseFloat(amountInput?.value || 0);
    const metodo = methodSelect?.value || 'Efectivo';

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

            const closedDate = new Date(acc.closed_at || acc.created_at).toLocaleString();

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
        renderDetailsModal(details);
    } catch (e) {
        showNotification(e.message, 'error');
    }
}

function renderDetailsModal(details) {
    const modal = document.getElementById('account-details-modal');
    const content = document.getElementById('details-content');
    if (!modal || !content) return;

    const consumos = details.consumos || [];
    const pagos = details.pagos || [];

    content.innerHTML = `
        <div class="account-summary account-summary-box">
            <p><strong>Mesa:</strong> ${details.mesa_nombre}</p>
            <p><strong>Total Consumido:</strong> $${details.total_consumido || '0.00'}</p>
            <p><strong>Total Pagado:</strong> $${details.total_pagado || '0.00'}</p>
            <p><strong>Saldo Pendiente:</strong> $${details.saldo_pendiente || '0.00'}</p>
            <div style="margin-top: 15px;">
                <button id="btn-details-create-order" class="form-btn" style="width: 100%; background-color: var(--bees-green, #28a745); color: white;">🛒 Crear Pedido</button>
            </div>
        </div>
        <h4>Consumos</h4>
        <ul class="details-consumos-list">
            ${consumos.length ? consumos.map(c => `<li>${c.cantidad}x ${c.producto_nombre} — $${c.valor_total} <small>(${new Date(c.created_at).toLocaleString()})</small></li>`).join('') : '<li>Sin consumos</li>'}
        </ul>
            <h4>Pagos</h4>
        <ul>
            ${pagos.length ? pagos.map(p => `<li>$${p.monto} — <small>${new Date(p.created_at).toLocaleString()}</small></li>`).join('') : '<li>Sin pagos</li>'}
        </ul>
    `;
    
    // Add listener for the new button
    const btnCreateOrder = document.getElementById('btn-details-create-order');
    if (btnCreateOrder) {
        btnCreateOrder.onclick = () => {
            modal.classList.remove('active');
            modal.classList.add('hidden');
            openOrderModal(details.mesa_id);
        };
    }

    // modal.style.display = 'flex';
    modal.classList.remove('hidden');
    modal.classList.add('active');
}

async function handleCreateMesaSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const numeroInput = form.querySelector('#mesa-numero');
    const nombreInput = form.querySelector('#mesa-nombre');

    const numeroMesa = numeroInput?.value || '';
    let nombreMesa = nombreInput?.value || '';

    if (!numeroMesa || numeroMesa.trim() === '') {
        showNotification('Por favor ingresa un número para la mesa.', 'error');
        return;
    }

    // Si no hay nombre personalizado, usar el número como nombre
    if (!nombreMesa || nombreMesa.trim() === '') {
        nombreMesa = `Mesa ${numeroMesa}`;
    } else {
        nombreMesa = nombreMesa.trim();
    }

    try {
        // Generar el código QR basado en el número de mesa
        const qrCode = `karaoke-mesa-${numeroMesa.toString().padStart(2, '0')}`;

        const payload = {
            nombre: nombreMesa,
            qr_code: qrCode
        };
        const result = await apiFetch('/mesas/', {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        showNotification(`Mesa "${nombreMesa}" creada exitosamente.`, 'success');

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

function setupQRModal() {
    const qrModal = document.getElementById('qr-management-modal');
    const closeBtn = document.getElementById('qr-modal-close');
    const closeXBtn = document.getElementById('qr-modal-close-x');
    const userSelect = document.getElementById('qr-modal-user-select');

    if (closeBtn) closeBtn.onclick = () => closeQRModal();
    if (closeXBtn) closeXBtn.onclick = () => closeQRModal();
    if (qrModal) qrModal.onclick = (e) => { if (e.target === qrModal) closeQRModal(); };

    if (userSelect) {
        userSelect.addEventListener('change', () => {
            if (currentQRTableId) {
                updateQRForTable(currentQRTableId, userSelect.value);
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

function openQRModal(mesaId) {
    const qrModal = document.getElementById('qr-management-modal');
    const userSelect = document.getElementById('qr-modal-user-select');
    const modalTitle = document.getElementById('qr-modal-title');

    if (!qrModal) return;

    currentQRTableId = mesaId;

    // Find mesa name
    const account = currentAccounts.find(a => a.mesa_id == mesaId);
    if (account) {
        modalTitle.textContent = `Gestionar QR - ${account.mesa_nombre || 'Mesa ' + mesaId}`;
    } else {
        modalTitle.textContent = `Gestionar QR - Mesa ${mesaId}`;
    }

    // Reset user select to 1
    if (userSelect) userSelect.value = "1";

    // Generate initial QR for User 1
    updateQRForTable(mesaId, "1");

    qrModal.classList.remove('hidden');
    qrModal.classList.add('active');
}

function updateQRForTable(mesaId, userNum) {
    const img = document.getElementById('qr-modal-img');
    const urlText = document.getElementById('qr-modal-url');
    const downloadBtn = document.getElementById('qr-modal-download-btn');

    const tableNum = mesaId.toString().padStart(2, '0');
    // Construct QR Code string
    const qrCode = `karaoke-mesa-${tableNum}-usuario${userNum}`;

    // Generate URL
    const appBaseUrl = window.location.origin;
    const appUrl = `${appBaseUrl}/?table=${encodeURIComponent(qrCode)}`;
    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(appUrl)}`;

    if (img) img.src = qrImageUrl;
    if (urlText) urlText.textContent = appUrl;

    if (downloadBtn) {
        downloadBtn.href = qrImageUrl;
        downloadBtn.download = `mesa-${mesaId}-usuario${userNum}.png`;
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
    const closeDetailsBtn = document.getElementById('details-modal-close');

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

    if (closeDetailsBtn) closeDetailsBtn.onclick = () => { if (detailsModal) { detailsModal.classList.remove('active'); detailsModal.classList.add('hidden'); } };
    if (detailsModal) detailsModal.onclick = (e) => { if (e.target === detailsModal) { detailsModal.classList.remove('active'); detailsModal.classList.add('hidden'); } };

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

        // Close Table Button (X) - Replaces Deactivate
        if (target.matches('.btn-close-table') || target.closest('.btn-close-table')) {
            const btn = target.matches('.btn-close-table') ? target : target.closest('.btn-close-table');
            const mesaId = btn.dataset.mesaId;
            
            // Check for outstanding balance before deactivating
            const account = currentAccounts.find(a => a.mesa_id == mesaId);
            if (account && Number(account.saldo_pendiente) > 0) {
                showNotification(`⚠️ No se puede desactivar la Mesa ${mesaId} porque tiene una deuda pendiente de $${account.saldo_pendiente}. Por favor registre el pago primero.`, 'error');
                return;
            }
            await updateMesaStatus(mesaId, 'deactivate');
        }

        // View Details Button
        if (target.matches('.btn-view-details') || target.closest('.btn-view-details')) {
            const btn = target.matches('.btn-view-details') ? target : target.closest('.btn-view-details');
            const mesaId = btn.dataset.mesaId;

            console.log(`[DEBUG] View Details clicked for Mesa ${mesaId}`);

            const account = currentAccounts.find(a => a.mesa_id == mesaId);

            if (account && account.cuenta_id) {
                try {
                    await showAccountDetails(account.cuenta_id);
                } catch (err) {
                    console.error("Error showing details:", err);
                    showNotification("Error al mostrar detalles: " + err.message, "error");
                }
            } else {
                // Show empty details if no account or no cuenta_id
                const emptyDetails = {
                    mesa_id: mesaId,
                    mesa_nombre: account ? (account.mesa_nombre || `Mesa ${mesaId}`) : `Mesa ${mesaId}`,
                    total_consumido: "0.00",
                    total_pagado: "0.00",
                    saldo_pendiente: "0.00",
                    consumos: [],
                    pagos: []
                };
                renderDetailsModal(emptyDetails);
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
