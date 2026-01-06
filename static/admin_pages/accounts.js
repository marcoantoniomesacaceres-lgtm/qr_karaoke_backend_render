// Accounts Page Module
// Manejo: cuentas de pago, comisiones, transacciones

// Variable global para almacenar las cuentas actuales
let currentAccounts = [];
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
            <div class="mesa-card-header">
                <h3>
                    ${titulo}
                    <span class="mesa-status ${isActive ? 'active' : 'inactive'}"></span>
                </h3>
            </div>
            
            <!-- Cuerpo con info -->
            <div class="mesa-card-body">
                <div class="mesa-info">
                    <div class="info-row">
                        <label>Número de Mesa:</label>
                        <span>${acc.mesa_id}</span>
                    </div>
                    <!-- user logic moved to modal -->
                    <div class="info-row">
                        <label>Estado:</label>
                        <span class="mesa-status-text ${isActive ? 'active' : 'inactive'}">
                            ${isActive ? '✓ Activa' : '✗ Inactiva'}
                        </span>
                    </div>
                </div>
                
                <!-- Gestión de QR (Botón en lugar de imagen directa) -->
                <div class="mesa-qr-container">
                    <button class="btn-manage-qr" data-mesa-id="${acc.mesa_id}">
                        📱 Gestionar QR
                    </button>
                </div>
            </div>
            
            <!-- Botones de acción -->
            <div class="mesa-actions">
                <button class="btn-activate" data-mesa-id="${acc.mesa_id}" ${isActive ? 'disabled' : ''}>
                    ✅ Activar
                </button>
                <button class="btn-deactivate" data-mesa-id="${acc.mesa_id}" ${!isActive ? 'disabled' : ''}>
                    ⏸️ Desactivar
                </button>
            </div>
            
            <!-- Resumen de cuenta -->
            <div class="mesa-account-summary">
                <div class="mesa-saldo ${saldoClass}">
                    Saldo: $${saldo.toFixed(2)}
                </div>
                <div class="mesa-account-actions-row">
                    <button class="btn-payment" data-id="${acc.mesa_id}">
                        💵 Registrar Pago
                    </button>
                    <button class="btn-view-details" data-mesa-id="${acc.mesa_id}">
                        Ver Detalles
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
        const modal = document.getElementById('account-details-modal');
        const content = document.getElementById('details-content');
        if (!modal || !content) return;

        const consumos = details.consumos || [];
        const pagos = details.pagos || [];

        content.innerHTML = `
            <div class="account-summary account-summary-box">
                <p><strong>Mesa:</strong> ${details.mesa_nombre}</p>
                <p><strong>Total Consumido:</strong> $${details.total_consumido}</p>
                <p><strong>Total Pagado:</strong> $${details.total_pagado}</p>
                <p><strong>Saldo Pendiente:</strong> $${details.saldo_pendiente}</p>
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
        // modal.style.display = 'flex';
        modal.classList.remove('hidden');
        modal.classList.add('active');

    } catch (e) {
        showNotification(e.message, 'error');
    }
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

        // Activate Button
        if (target.matches('.btn-activate') || target.closest('.btn-activate')) {
            const btn = target.matches('.btn-activate') ? target : target.closest('.btn-activate');
            const mesaId = btn.dataset.mesaId;
            await updateMesaStatus(mesaId, 'activate');
        }

        // Deactivate Button
        if (target.matches('.btn-deactivate') || target.closest('.btn-deactivate')) {
            const btn = target.matches('.btn-deactivate') ? target : target.closest('.btn-deactivate');
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

            if (account) {
                if (account.cuenta_id) {
                    try {
                        await showAccountDetails(account.cuenta_id);
                    } catch (err) {
                        console.error("Error showing details:", err);
                        showNotification("Error al mostrar detalles: " + err.message, "error");
                    }
                } else {
                    console.warn(`[DEBUG] Account found for Mesa ${mesaId} but no cuenta_id`);
                    showNotification('No hay detalles de cuenta activa para esta mesa.', 'info');
                }
            } else {
                console.warn(`[DEBUG] No active account found in local state for Mesa ${mesaId}`);
                showNotification('No se encontró información de la cuenta localmente.', 'error');
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
