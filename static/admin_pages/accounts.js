// Accounts Page Module
// Manejo: cuentas de pago, comisiones, transacciones

// Variable global para almacenar las cuentas actuales
let currentAccounts = [];

function renderAccounts(accounts, accountsGrid) {
    accountsGrid.innerHTML = '';
    if (accounts.length === 0) {
        accountsGrid.innerHTML = '<p>No hay mesas ni estados de cuenta disponibles.</p>';
        return;
    }

    // Guardar las cuentas en la variable global para acceder a ellas después
    currentAccounts = accounts;

    accounts.forEach(acc => {
        const card = document.createElement('div');
        card.className = 'account-card card';

        const titulo = acc.mesa_nombre || `Mesa ${acc.mesa_id}`;
        const deuda = acc.saldo_pendiente || 0;
        const consumos = Array.isArray(acc.consumos) ? acc.consumos : [];
        const pagos = Array.isArray(acc.pagos) ? acc.pagos : [];

        card.innerHTML = `
            <div class="account-header">
                <h3>${titulo}</h3>
                <span class="commission-badge">Saldo: $${deuda}</span>
            </div>
            <div class="account-details">
                <div class="account-summary">
                    <div>Total consumido: $${acc.total_consumido || 0}</div>
                    <div>Total pagado: $${acc.total_pagado || 0}</div>
                    <div class="saldo-pendiente ${deuda > 0 ? 'saldo-debe' : 'saldo-ok'}">Pendiente: $${deuda}</div>
                </div>
                <div class="details-section">
                    <strong>Consumos:</strong>
                    <ul>
                        ${consumos.map(c => `<li>${c.cantidad}x ${c.producto_nombre} — $${c.valor_total} (${new Date(c.created_at).toLocaleString()})</li>`).join('')}
                    </ul>
                    <strong>Pagos:</strong>
                    <ul>
                        ${pagos.map(p => `<li>$${p.monto} — ${new Date(p.created_at).toLocaleString()}</li>`).join('')}
                    </ul>
                </div>
            </div>
            <div class="account-actions">
                <button class="btn-payment" data-id="${acc.mesa_id}" data-saldo="${deuda}">Registrar Pago</button>
                <button class="btn-close-session" data-id="${acc.mesa_id}" style="background-color: var(--error-color);">Cerrar Sesión</button>
                <button class="btn-prev-accounts" data-id="${acc.mesa_id}" style="background-color: var(--background-dark);">Cuentas Anteriores</button>
            </div>
        `;

        accountsGrid.appendChild(card);
    });
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

    modal.style.display = 'flex';
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

    overpaymentModal.style.display = 'flex';

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
        overpaymentModal.style.display = 'none';
        await processPayment(mesaId, amount, metodo);
    });

    newCancelBtn.addEventListener('click', () => {
        overpaymentModal.style.display = 'none';
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
        if (modal) modal.style.display = 'none';

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
            item.style.padding = '10px';
            item.style.borderBottom = '1px solid #444';
            item.style.display = 'flex';
            item.style.justifyContent = 'space-between';
            item.style.alignItems = 'center';

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
    modal.style.display = 'flex';
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
            <div class="account-summary" style="margin-bottom: 20px; padding: 10px; background: rgba(255,255,255,0.05); border-radius: 8px;">
                <p><strong>Mesa:</strong> ${details.mesa_nombre}</p>
                <p><strong>Total Consumido:</strong> $${details.total_consumido}</p>
                <p><strong>Total Pagado:</strong> $${details.total_pagado}</p>
                <p><strong>Saldo Pendiente:</strong> $${details.saldo_pendiente}</p>
            </div>
            <h4>Consumos</h4>
            <ul style="margin-bottom: 20px;">
                ${consumos.length ? consumos.map(c => `<li>${c.cantidad}x ${c.producto_nombre} — $${c.valor_total} <small>(${new Date(c.created_at).toLocaleString()})</small></li>`).join('') : '<li>Sin consumos</li>'}
            </ul>
             <h4>Pagos</h4>
            <ul>
                ${pagos.length ? pagos.map(p => `<li>$${p.monto} — <small>${new Date(p.created_at).toLocaleString()}</small></li>`).join('') : '<li>Sin pagos</li>'}
            </ul>
        `;
        modal.style.display = 'flex';

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
        // Llamar al endpoint para crear una nueva mesa
        const payload = { nombre: nombreMesa };
        const result = await apiFetch('/admin/mesas', {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        showNotification(`Mesa "${nombreMesa}" creada exitosamente.`, 'success');

        // Cerrar el modal
        const modal = document.getElementById('create-mesa-modal');
        if (modal) modal.style.display = 'none';

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
            if (createMesaModal) createMesaModal.style.display = 'flex';
        });
    }

    if (createMesaForm) {
        createMesaForm.addEventListener('submit', handleCreateMesaSubmit);
    }

    if (closeCreateMesaBtn) {
        closeCreateMesaBtn.addEventListener('click', () => {
            if (createMesaModal) createMesaModal.style.display = 'none';
        });
    }

    if (createMesaModal) {
        createMesaModal.addEventListener('click', (e) => {
            if (e.target === createMesaModal) createMesaModal.style.display = 'none';
        });
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
            if (paymentModal) paymentModal.style.display = 'none';
        });
    }
    if (paymentModal) {
        paymentModal.addEventListener('click', (e) => {
            if (e.target === paymentModal) paymentModal.style.display = 'none';
        });
    }

    if (overpaymentModal) {
        overpaymentModal.addEventListener('click', (e) => {
            if (e.target === overpaymentModal) {
                overpaymentModal.style.display = 'none';
                showNotification('Pago cancelado.', 'info');
            }
        });
    }

    // Listeners for new modals
    if (closeHistoryBtn) closeHistoryBtn.onclick = () => { if (historyModal) historyModal.style.display = 'none'; };
    if (historyModal) historyModal.onclick = (e) => { if (e.target === historyModal) historyModal.style.display = 'none'; };

    if (closeDetailsBtn) closeDetailsBtn.onclick = () => { if (detailsModal) detailsModal.style.display = 'none'; };
    if (detailsModal) detailsModal.onclick = (e) => { if (e.target === detailsModal) detailsModal.style.display = 'none'; };

    // Setup create mesa modal
    setupCreateMesaModal();

    // Setup integrated tables management (from tables.js functionality)
    setupIntegratedTablesListeners();
}

// Integrated Tables Management Functions
function setupIntegratedTablesListeners() {
    // QR Generator Form
    const qrForm = document.getElementById('qr-generator-form');
    if (qrForm) {
        qrForm.addEventListener('submit', handleGenerateQR);
    }

    // Management Buttons
    const btnActivate = document.getElementById('btn-activate');
    const btnDeactivate = document.getElementById('btn-deactivate');
    const btnDelete = document.getElementById('btn-delete');
    const btnCreate = document.getElementById('btn-create');

    if (btnActivate) btnActivate.addEventListener('click', () => handleTableAction('activate'));
    if (btnDeactivate) btnDeactivate.addEventListener('click', () => handleTableAction('deactivate'));
    if (btnDelete) btnDelete.addEventListener('click', () => handleTableAction('delete'));
    if (btnCreate) btnCreate.addEventListener('click', handleCreateTableDirect);
}

function handleGenerateQR(event) {
    event.preventDefault();

    const tableNumInput = document.getElementById('qr-table-number');
    const userSelect = document.getElementById('qr-user-select');
    const resultArea = document.getElementById('qr-result');

    if (!tableNumInput.value) {
        showNotification('Por favor ingresa un número de mesa', 'error');
        return;
    }

    const tableNum = tableNumInput.value.toString().padStart(2, '0');
    const userNum = userSelect.value;

    // Construct QR Code string
    const qrCode = `karaoke-mesa-${tableNum}-usuario${userNum}`;
    const tableName = `Mesa ${parseInt(tableNum)}`;
    const userNick = `${tableName}-Usuario${userNum}`;

    // Generate URL
    const appBaseUrl = window.location.origin;
    const appUrl = `${appBaseUrl}/?table=${encodeURIComponent(qrCode)}`;
    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(appUrl)}`;

    resultArea.innerHTML = `
        <div class="qr-container" style="animation: fadeIn 0.5s;">
            <img src="${qrImageUrl}" alt="QR Code" class="qr-image" style="border: 2px solid #333; padding: 8px; border-radius: 8px; max-width: 100%;">
            <h4 style="margin: 8px 0 4px 0; font-size: 0.9em;">${userNick}</h4>
            <p style="font-family: monospace; background: #f0f0f0; padding: 4px; border-radius: 4px; font-size: 0.75em; word-break: break-all;">${qrCode}</p>
            <a href="${qrImageUrl}" download="qr-${qrCode}.png" class="btn-primary" style="display: inline-block; margin-top: 8px; text-decoration: none; font-size: 0.85em; padding: 6px 12px;">
                ⬇️ Descargar QR
            </a>
        </div>
    `;
}

async function findTableByNumber(number) {
    try {
        const tables = await apiFetch('/mesas/');
        const targetQR = `karaoke-mesa-${number.toString().padStart(2, '0')}`;

        const found = tables.find(t => {
            if (t.qr_code === targetQR) return true;
            if (t.qr_code.startsWith(targetQR) && !t.qr_code.includes('usuario')) return true;
            return false;
        });

        return found;
    } catch (error) {
        console.error("Error fetching tables:", error);
        return null;
    }
}

async function handleTableAction(action) {
    const tableNumInput = document.getElementById('manage-table-number');
    const statusDiv = document.getElementById('management-status');

    if (!tableNumInput.value) {
        showNotification('Por favor ingresa un número de mesa para gestionar', 'error');
        return;
    }

    const tableNum = tableNumInput.value.toString().padStart(2, '0');
    statusDiv.innerHTML = '<p>Buscando mesa...</p>';

    try {
        const table = await findTableByNumber(tableNum);

        if (!table) {
            statusDiv.innerHTML = `<p style="color: var(--error-color);">❌ No se encontró la Mesa ${parseInt(tableNum)}.</p>`;
            if (action !== 'create') {
                showNotification(`La Mesa ${parseInt(tableNum)} no existe. Créala primero.`, 'warning');
            }
            return;
        }

        let endpoint;
        let method = 'POST';
        let successMsg;

        if (action === 'activate') {
            endpoint = `/admin/tables/${table.id}/activate`;
            successMsg = `✅ Mesa ${parseInt(tableNum)} activada correctamente.`;
        } else if (action === 'deactivate') {
            endpoint = `/admin/tables/${table.id}/deactivate`;
            successMsg = `⏸️ Mesa ${parseInt(tableNum)} desactivada.`;
        } else if (action === 'delete') {
            if (!confirm(`¿Estás seguro de ELIMINAR la Mesa ${parseInt(tableNum)}? Esta acción es irreversible.`)) {
                statusDiv.innerHTML = '';
                return;
            }
            endpoint = `/admin/tables/${table.id}`;
            method = 'DELETE';
            successMsg = `🗑️ Mesa ${parseInt(tableNum)} eliminada del sistema.`;
        }

        await apiFetch(endpoint, { method: method });
        statusDiv.innerHTML = `<p style="color: var(--success-color); font-weight: bold;">${successMsg}</p>`;
        showNotification(successMsg, 'success');

        // Reload accounts page to reflect changes
        setTimeout(() => loadAccountsPage(), 500);

    } catch (error) {
        statusDiv.innerHTML = `<p style="color: var(--error-color);">Error: ${error.message}</p>`;
    }
}

async function handleCreateTableDirect() {
    const tableNumInput = document.getElementById('manage-table-number');
    const statusDiv = document.getElementById('management-status');

    if (!tableNumInput.value) {
        showNotification('Ingresa un número para crear la mesa', 'error');
        return;
    }

    const tableNum = parseInt(tableNumInput.value);
    const qrCode = `karaoke-mesa-${tableNum.toString().padStart(2, '0')}`;
    const nombre = `Mesa ${tableNum}`;

    try {
        // Check if exists first
        const existing = await findTableByNumber(tableNum);
        if (existing) {
            statusDiv.innerHTML = `<p style="color: var(--warning-color);">⚠️ La Mesa ${tableNum} ya existe.</p>`;
            return;
        }

        const payload = {
            nombre: nombre,
            qr_code: qrCode
        };

        await apiFetch('/mesas/', { method: 'POST', body: JSON.stringify(payload) });
        statusDiv.innerHTML = `<p style="color: var(--success-color);">✅ Mesa ${tableNum} creada exitosamente.</p>`;
        showNotification(`Mesa ${tableNum} creada.`, 'success');

        // Reload accounts page to show new table
        setTimeout(() => loadAccountsPage(), 500);

    } catch (error) {
        statusDiv.innerHTML = `<p style="color: var(--error-color);">Error al crear: ${error.message}</p>`;
    }
}

