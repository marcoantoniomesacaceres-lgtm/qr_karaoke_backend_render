// Reports Page Module - BEES Style
// Manejo: generación de reportes por periodo, ventas turno, ingresos y desglose por sede

async function loadReportsPage() {
    const reportsContainer = document.getElementById('reports');
    if (!reportsContainer) return;

    try {
        reportsContainer.innerHTML = '';

        const activeLocalId = sessionStorage.getItem('active_local_id') || localStorage.getItem('selectedLocalId') || '1';
        let localNombre = `Sede #${activeLocalId}`;
        try {
            const localSelector = document.getElementById('global-local-selector') || document.getElementById('local-selector');
            if (localSelector && localSelector.selectedOptions && localSelector.selectedOptions[0]) {
                localNombre = localSelector.selectedOptions[0].text;
            }
        } catch (e) {}

        // Encabezado
        const header = document.createElement('div');
        header.className = 'bees-header';
        header.innerHTML = `
            <div class="bees-header-icon">📊</div>
            <div class="bees-header-content">
                <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
                    <h1 style="margin: 0;">Reportes</h1>
                    <span class="bees-badge bees-badge-primary" style="font-size: 0.9em; padding: 6px 12px; background: rgba(255, 215, 0, 0.15); border: 1px solid var(--bees-yellow); color: var(--bees-yellow);">
                        🏢 ${localNombre}
                    </span>
                </div>
                <p style="margin-top: 4px;">Análisis de ventas, actividad y métricas del turno</p>
            </div>
        `;
        reportsContainer.appendChild(header);

        // Tarjeta de controles de reporte
        const card = document.createElement('div');
        card.className = 'bees-card';
        card.style.marginBottom = '30px';

        const cardHeader = document.createElement('div');
        cardHeader.className = 'bees-card-header';
        cardHeader.innerHTML = `
            <div class="bees-card-icon">📈</div>
            <div class="bees-card-header-content">
                <h3>Generar Reportes</h3>
                <p>Selecciona el reporte y los filtros para la sede actual</p>
            </div>
        `;
        card.appendChild(cardHeader);

        const controlsDiv = document.createElement('div');
        controlsDiv.style.display = 'flex';
        controlsDiv.style.gap = '12px';
        controlsDiv.style.marginBottom = '24px';
        controlsDiv.style.flexWrap = 'wrap';
        controlsDiv.style.alignItems = 'center';

        const selector = document.createElement('select');
        selector.id = 'report-selector';
        selector.style.flex = '1';
        selector.style.minWidth = '240px';
        selector.style.border = '2px solid var(--page-border)';
        selector.style.borderRadius = '8px';
        selector.style.padding = '12px';
        selector.style.background = 'var(--page-input-bg)';
        selector.style.color = 'var(--page-text)';
        selector.innerHTML = `
            <option value="ventas-turno">📅 Ventas Turno (5:00 AM - Cierre)</option>
            <option value="income-by-table">📊 Ingresos por Mesa (con Horario)</option>
            <option value="total-income">💰 Ingresos Totales</option>
            <option value="top-songs">🎵 Top Canciones Más Cantadas</option>
            <option value="top-products">🥤 Top Productos Más Consumidos</option>
            <option value="songs-by-table">🎶 Canciones por Mesa</option>
            <option value="songs-by-user">👥 Canciones por Usuario</option>
            <option value="hourly-activity">⏰ Actividad por Hora</option>
            <option value="top-rejected-songs">👎 Canciones Más Rechazadas</option>
            <option value="inactive-users">😴 Usuarios Inactivos</option>
        `;
        controlsDiv.appendChild(selector);

        // Date Picker Container for Shift Sales
        const todayStr = new Date().toISOString().split('T')[0];
        const dateContainer = document.createElement('div');
        dateContainer.id = 'shift-date-container';
        dateContainer.style.display = 'flex';
        dateContainer.style.alignItems = 'center';
        dateContainer.style.gap = '8px';
        dateContainer.innerHTML = `
            <label for="shift-date-picker" style="font-size: 13px; font-weight: 600; color: var(--page-text-secondary); white-space: nowrap;">Fecha Turno:</label>
            <input type="date" id="shift-date-picker" value="${todayStr}" style="border: 2px solid var(--page-border); border-radius: 8px; padding: 10px 12px; background: var(--page-input-bg); color: var(--page-text); outline: none;">
        `;
        controlsDiv.appendChild(dateContainer);

        const generateBtn = document.createElement('button');
        generateBtn.id = 'generate-report-btn';
        generateBtn.className = 'bees-btn bees-btn-primary';
        generateBtn.textContent = '📊 Generar Reporte';
        generateBtn.style.width = 'auto';
        generateBtn.style.minWidth = '160px';
        controlsDiv.appendChild(generateBtn);

        card.appendChild(controlsDiv);

        const outputDiv = document.createElement('div');
        outputDiv.id = 'report-output';
        outputDiv.style.marginTop = '24px';
        outputDiv.innerHTML = `
            <div class="bees-alert bees-alert-info">
                <span class="bees-alert-icon">ℹ️</span>
                <div>Selecciona un reporte y haz clic en "Generar Reporte" para ver los resultados de la sede activa.</div>
            </div>
        `;
        card.appendChild(outputDiv);

        reportsContainer.appendChild(card);

        // Setup listeners
        setupReportsListeners();

        // Generar automáticamente el reporte de Ventas Turno inicial
        handleReportGeneration();
    } catch (error) {
        const reportsContainer = document.getElementById('reports');
        if (reportsContainer) {
            reportsContainer.innerHTML = `
                <div class="bees-alert bees-alert-danger">
                    <span class="bees-alert-icon">❌</span>
                    <div>Error al cargar reportes: ${error.message}</div>
                </div>
            `;
        }
    }
}

function setupReportsListeners() {
    const generateBtn = document.getElementById('generate-report-btn');
    if (generateBtn) {
        generateBtn.addEventListener('click', handleReportGeneration);
    }

    const selector = document.getElementById('report-selector');
    const dateContainer = document.getElementById('shift-date-container');
    if (selector && dateContainer) {
        selector.addEventListener('change', () => {
            if (selector.value === 'ventas-turno') {
                dateContainer.style.display = 'flex';
            } else {
                dateContainer.style.display = 'none';
            }
        });
    }
}

async function handleReportGeneration() {
    const selector = document.getElementById('report-selector');
    const outputDiv = document.getElementById('report-output');
    if (!selector || !outputDiv) return;

    const reportType = selector.value;
    if (!reportType) {
        showNotification('Selecciona un tipo de reporte', 'warning');
        return;
    }

    outputDiv.innerHTML = '<div class="bees-alert bees-alert-info"><span class="bees-alert-icon">⏳</span><div>Generando reporte de la sede...</div></div>';

    try {
        const localId = sessionStorage.getItem('active_local_id') || localStorage.getItem('selectedLocalId') || '1';
        let url = `/admin/reports/${reportType}?local_id=${localId}`;

        if (reportType === 'ventas-turno') {
            const datePicker = document.getElementById('shift-date-picker');
            if (datePicker && datePicker.value) {
                url += `&fecha=${datePicker.value}`;
            }
        }

        const data = await apiFetch(url);
        renderReport(reportType, data, outputDiv);
    } catch (error) {
        outputDiv.innerHTML = `
            <div class="bees-alert bees-alert-danger">
                <span class="bees-alert-icon">❌</span>
                <div>Error generando reporte: ${error.message}</div>
            </div>
        `;
    }
}

function renderReport(type, data, container) {
    container.innerHTML = '';

    if (type === 'ventas-turno') {
        renderVentasTurnoReport(data, container);
        return;
    }

    const titles = {
        'top-songs': '🎵 Top Canciones Más Cantadas',
        'top-products': '🥤 Top Productos Más Consumidos',
        'total-income': '💰 Ingresos Totales',
        'income-by-table': '📊 Ingresos por Mesa',
        'songs-by-table': '🎶 Canciones por Mesa',
        'songs-by-user': '👥 Canciones por Usuario',
        'hourly-activity': '⏰ Actividad por Hora',
        'top-rejected-songs': '👎 Canciones Más Rechazadas',
        'inactive-users': '😴 Usuarios Inactivos'
    };

    const title = document.createElement('h3');
    title.style.marginTop = '0';
    title.style.marginBottom = '16px';
    title.textContent = titles[type] || 'Reporte';
    container.appendChild(title);

    // Renderizar tabla o métricas
    if (Array.isArray(data) && data.length > 0) {
        renderReportTable(data, type, container);
    } else if (typeof data === 'object' && data && data.ingresos_totales !== undefined) {
        renderReportMetrics(data, container);
    } else {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'bees-alert bees-alert-warning';
        emptyDiv.innerHTML = '<span class="bees-alert-icon">📭</span><div>No hay datos disponibles para este reporte en la sede actual.</div>';
        container.appendChild(emptyDiv);
    }
}

function renderVentasTurnoReport(data, container) {
    if (!data) {
        container.innerHTML = '<div class="bees-alert bees-alert-warning"><span class="bees-alert-icon">📭</span><div>No se recibieron datos del turno.</div></div>';
        return;
    }

    // Cabecera informativa del turno
    const infoBox = document.createElement('div');
    infoBox.style.background = 'rgba(255, 255, 255, 0.04)';
    infoBox.style.border = '1px solid var(--page-border)';
    infoBox.style.borderRadius = '12px';
    infoBox.style.padding = '16px';
    infoBox.style.marginBottom = '24px';
    infoBox.style.display = 'flex';
    infoBox.style.justifyContent = 'space-between';
    infoBox.style.alignItems = 'center';
    infoBox.style.flexWrap = 'wrap';
    infoBox.style.gap = '12px';

    infoBox.innerHTML = `
        <div>
            <div style="font-size: 1.2em; font-weight: 700; color: #fff;">
                🏢 ${data.local_nombre || ('Sede #' + data.local_id)}
            </div>
            <div style="font-size: 0.9em; color: var(--page-text-secondary); margin-top: 4px;">
                📅 Turno del día: <strong>${data.fecha}</strong>
            </div>
        </div>
        <div style="display: flex; gap: 8px; align-items: center; background: rgba(0, 0, 0, 0.3); padding: 8px 14px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.1);">
            <span style="font-size: 1.1em;">⏰</span>
            <div style="font-size: 0.9em;">
                Ventana del Turno: <strong style="color: var(--bees-yellow);">${data.hora_inicio_turno} ➔ ${data.hora_fin_turno}</strong>
            </div>
        </div>
    `;
    container.appendChild(infoBox);

    // Tarjetas KPI de resumen financiero
    const kpiGrid = document.createElement('div');
    kpiGrid.style.display = 'grid';
    kpiGrid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(200px, 1fr))';
    kpiGrid.style.gap = '16px';
    kpiGrid.style.marginBottom = '28px';

    const kpis = [
        { label: 'Total Ventas', value: `$${parseFloat(data.total_ventas || 0).toLocaleString('es-CO', { minimumFractionDigits: 2 })}`, color: 'var(--bees-yellow)', icon: '💰' },
        { label: 'Total Recaudado', value: `$${parseFloat(data.total_pagado || 0).toLocaleString('es-CO', { minimumFractionDigits: 2 })}`, color: '#10b981', icon: '💵' },
        { label: 'Total Consumo Interno', value: `$${parseFloat(data.total_consumo_interno || 0).toLocaleString('es-CO', { minimumFractionDigits: 2 })}`, color: '#a855f7', icon: '🏢' },
        { 
            label: 'Saldo Pendiente', 
            value: `$${parseFloat(data.saldo_pendiente || 0).toLocaleString('es-CO', { minimumFractionDigits: 2 })}`, 
            color: data.saldo_pendiente > 0 ? '#ef4444' : '#10b981', 
            icon: data.saldo_pendiente > 0 ? '⚠️' : '✅' 
        },
        { label: 'Pedidos / Canciones', value: `${data.total_pedidos || 0} pedidos / ${data.total_canciones || 0} canciones`, color: '#60a5fa', icon: '📋' }
    ];

    kpis.forEach(kpi => {
        const card = document.createElement('div');
        card.style.background = 'var(--page-input-bg)';
        card.style.padding = '16px';
        card.style.borderRadius = '12px';
        card.style.border = '1px solid var(--page-border)';
        card.style.borderLeft = `4px solid ${kpi.color}`;

        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span style="font-size: 12px; font-weight: 600; color: var(--page-text-secondary); text-transform: uppercase;">${kpi.label}</span>
                <span style="font-size: 1.2em;">${kpi.icon}</span>
            </div>
            <div style="font-size: 22px; font-weight: 700; color: ${kpi.color};">${kpi.value}</div>
        `;
        kpiGrid.appendChild(card);
    });
    container.appendChild(kpiGrid);

    // 1. Desglose de Métodos de Pago
    if (data.metodos_pago && data.metodos_pago.length > 0) {
        const paySection = document.createElement('div');
        paySection.style.marginBottom = '28px';
        paySection.innerHTML = `<h4 style="margin: 0 0 12px 0; color: #fff; font-size: 1.1em;">💳 Métodos de Pago</h4>`;

        const payTable = document.createElement('table');
        payTable.className = 'bees-table';
        payTable.innerHTML = `
            <thead>
                <tr>
                    <th>Método de Pago</th>
                    <th>Transacciones</th>
                    <th>Total Recaudado</th>
                </tr>
            </thead>
            <tbody>
                ${data.metodos_pago.map(mp => `
                    <tr>
                        <td><strong>${mp.metodo}</strong></td>
                        <td>${mp.transacciones}</td>
                        <td style="color: #10b981; font-weight: 700;">$${parseFloat(mp.total || 0).toLocaleString('es-CO', { minimumFractionDigits: 2 })}</td>
                    </tr>
                `).join('')}
            </tbody>
        `;
        paySection.appendChild(payTable);
        container.appendChild(paySection);
    }

    // 2. Desglose por Mesas con ventana horaria HH:MM - HH:MM
    const mesasSection = document.createElement('div');
    mesasSection.style.marginBottom = '28px';
    mesasSection.innerHTML = `<h4 style="margin: 0 0 12px 0; color: #fff; font-size: 1.1em;">🪑 Actividad y Ventas por Mesa</h4>`;

    if (data.mesas && data.mesas.length > 0) {
        const mesaTable = document.createElement('table');
        mesaTable.className = 'bees-table';
        mesaTable.innerHTML = `
            <thead>
                <tr>
                    <th>Mesa</th>
                    <th>Horario Actividad (Apertura - Cierre)</th>
                    <th>Pedidos</th>
                    <th>Total Consumido</th>
                    <th>Total Pagado</th>
                    <th>Saldo</th>
                </tr>
            </thead>
            <tbody>
                ${data.mesas.map(m => `
                    <tr>
                        <td><strong>${m.mesa_nombre}</strong></td>
                        <td>
                            <span class="bees-badge" style="background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.15); color: #fff; font-size: 0.9em; padding: 4px 8px;">
                                ⏱️ ${m.horario || 'N/A'}
                            </span>
                        </td>
                        <td>${m.num_consumos}</td>
                        <td><strong>$${parseFloat(m.total_consumido || 0).toLocaleString('es-CO', { minimumFractionDigits: 2 })}</strong></td>
                        <td style="color: #10b981;">$${parseFloat(m.total_pagado || 0).toLocaleString('es-CO', { minimumFractionDigits: 2 })}</td>
                        <td style="color: ${m.saldo > 0 ? '#ef4444' : '#10b981'}; font-weight: 700;">
                            $${parseFloat(m.saldo || 0).toLocaleString('es-CO', { minimumFractionDigits: 2 })}
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        `;
        mesasSection.appendChild(mesaTable);
    } else {
        mesasSection.innerHTML += `<div class="bees-alert bees-alert-info">No se registraron consumos en mesas durante este turno.</div>`;
    }
    container.appendChild(mesasSection);

    // 3. Top Productos Vendidos
    if (data.top_productos && data.top_productos.length > 0) {
        const prodSection = document.createElement('div');
        prodSection.style.marginBottom = '20px';
        prodSection.innerHTML = `<h4 style="margin: 0 0 12px 0; color: #fff; font-size: 1.1em;">🏆 Productos Más Vendidos del Turno</h4>`;

        const prodTable = document.createElement('table');
        prodTable.className = 'bees-table';
        prodTable.innerHTML = `
            <thead>
                <tr>
                    <th>#</th>
                    <th>Producto</th>
                    <th>Cantidad</th>
                    <th>Total Recaudado</th>
                </tr>
            </thead>
            <tbody>
                ${data.top_productos.map((p, idx) => `
                    <tr>
                        <td>#${idx + 1}</td>
                        <td><strong>${p.nombre}</strong></td>
                        <td><span class="bees-badge bees-badge-primary" style="font-size: 0.95em;">${p.cantidad}</span></td>
                        <td style="color: var(--bees-yellow); font-weight: 700;">$${parseFloat(p.total_recaudado || 0).toLocaleString('es-CO', { minimumFractionDigits: 2 })}</td>
                    </tr>
                `).join('')}
            </tbody>
        `;
        prodSection.appendChild(prodTable);
        container.appendChild(prodSection);
    }
}

function renderReportTable(data, type, container) {
    const table = document.createElement('table');
    table.className = 'bees-table';

    let headers = [];
    if (type.includes('songs-by-user')) {
        headers = ['Usuario', 'Canciones Cantadas'];
    } else if (type.includes('songs-by-table')) {
        headers = ['Mesa', 'Canciones'];
    } else if (type.includes('income') && type.includes('table')) {
        headers = ['Mesa', 'Horario (Apertura - Cierre)', 'Ingresos Totales'];
    } else if (type.includes('hourly')) {
        headers = ['Hora', 'Canciones Cantadas'];
    } else if (type.includes('inactive')) {
        headers = ['Usuario', 'Mesa', 'Estado'];
    } else if (type.includes('products')) {
        headers = ['Posición', 'Producto', 'Cantidad'];
    } else if (type.includes('songs')) {
        headers = ['Posición', 'Canción', 'Cantidad'];
    }

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    headers.forEach(header => {
        const th = document.createElement('th');
        th.textContent = header;
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    data.slice(0, 30).forEach((row, index) => {
        const tr = document.createElement('tr');
        if (type.includes('songs-by-table')) {
            tr.innerHTML = `
                <td><strong>${row.mesa_nombre}</strong></td>
                <td><strong>${row.canciones_cantadas}</strong></td>
            `;
        } else if (type.includes('income') && type.includes('table')) {
            tr.innerHTML = `
                <td><strong>${row.mesa_nombre}</strong></td>
                <td>
                    <span class="bees-badge" style="background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.15); color: #fff; font-size: 0.9em; padding: 4px 8px;">
                        ⏱️ ${row.horario || 'N/A'}
                    </span>
                </td>
                <td style="color: var(--bees-yellow); font-weight: 700;">$${parseFloat(row.ingresos_totales || 0).toLocaleString('es-CO', { minimumFractionDigits: 2 })}</td>
            `;
        } else if (type.includes('songs-by-user') || (type.includes('user') && type.includes('rejected'))) {
            tr.innerHTML = `
                <td><strong>${row.nick}</strong></td>
                <td><strong>${row.canciones_cantadas || row.canciones_rechazadas || row.cantidad}</strong></td>
            `;
        } else if (type.includes('hourly')) {
            tr.innerHTML = `
                <td>${row.hora}:00</td>
                <td><strong>${row.canciones_cantadas || row.cantidad}</strong></td>
            `;
        } else if (type.includes('inactive')) {
            tr.innerHTML = `
                <td><strong>${row.nick}</strong></td>
                <td>${row.mesa_nombre || 'N/A'}</td>
                <td><span class="bees-badge bees-badge-warning">Sin consumo</span></td>
            `;
        } else if (type.includes('songs') || type.includes('products')) {
            const cantidad = row.cantidad || row.cantidad_total || row.veces_cantada || row.veces_rechazada || row.count;
            tr.innerHTML = `
                <td>#${index + 1}</td>
                <td><strong>${row.nombre || row.titulo}</strong></td>
                <td><span class="bees-badge bees-badge-primary">${cantidad}</span></td>
            `;
        }
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    container.appendChild(table);

    if (data.length > 30) {
        const moreInfo = document.createElement('p');
        moreInfo.style.fontSize = '12px';
        moreInfo.style.color = 'var(--page-text-secondary)';
        moreInfo.textContent = `Mostrando 30 de ${data.length} registros`;
        container.appendChild(moreInfo);
    }
}

function renderReportMetrics(data, container) {
    const metricsDiv = document.createElement('div');
    metricsDiv.style.display = 'grid';
    metricsDiv.style.gridTemplateColumns = 'repeat(auto-fit, minmax(200px, 1fr))';
    metricsDiv.style.gap = '16px';

    Object.entries(data).forEach(([key, value]) => {
        const card = document.createElement('div');
        card.style.background = 'var(--page-input-bg)';
        card.style.padding = '16px';
        card.style.borderRadius = '12px';
        card.style.textAlign = 'center';
        card.style.border = '1px solid var(--page-border)';
        card.style.borderLeft = '4px solid var(--bees-yellow)';

        const label = document.createElement('div');
        label.style.fontSize = '12px';
        label.style.fontWeight = '600';
        label.style.color = 'var(--page-text-secondary)';
        label.style.textTransform = 'uppercase';
        label.style.marginBottom = '8px';
        label.textContent = key.replace(/_/g, ' ');

        const valueDiv = document.createElement('div');
        valueDiv.style.fontSize = '24px';
        valueDiv.style.fontWeight = '700';
        valueDiv.style.color = 'var(--bees-yellow)';
        valueDiv.textContent = typeof value === 'number' && (key.includes('ingreso') || key.includes('total'))
            ? `$${parseFloat(value).toLocaleString('es-CO', { minimumFractionDigits: 2 })}`
            : value;

        card.appendChild(label);
        card.appendChild(valueDiv);
        metricsDiv.appendChild(card);
    });

    container.appendChild(metricsDiv);
}
