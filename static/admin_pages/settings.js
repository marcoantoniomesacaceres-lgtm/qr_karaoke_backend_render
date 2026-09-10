// Settings Page Module - BEES Style
// Manejo: configuración de cierre nocturno, claves API, parámetros generales

async function loadSettingsPage() {
    const settingsContainer = document.getElementById('settings');
    if (!settingsContainer) return;

    try {
        // Carga la configuración desde el backend
        let settings = {
            closing_hour: 3,
            closing_minute: 0,
            app_name: 'QR Karaoke',
            theme: 'dark',
            enable_notifications: true
        };

        try {
            const response = await apiFetch('/admin/settings');
            if (response) settings = { ...settings, ...response };
        } catch (e) {
            console.warn('Settings endpoint not available, using defaults:', e.message);
        }

        // Aplicar tema cargado
        document.body.dataset.theme = settings.theme;

        renderSettings(settings, settingsContainer);
    } catch (error) {
        const settingsContainer = document.getElementById('settings');
        if (settingsContainer) {
            settingsContainer.innerHTML = `<div class="settings-message error">
                <span class="settings-message-icon">❌</span>
                <div>${error.message}</div>
            </div>`;
        }
    }
}

function renderSettings(settings, container) {
    container.innerHTML = '';

    // Encabezado
    const header = document.createElement('div');
    header.className = 'settings-header';
    header.innerHTML = `
        <div class="settings-header-icon">⚙️</div>
        <div class="settings-header-content">
            <h1>Configuración</h1>
            <p>Personaliza tu experiencia en QR Karaoke</p>
        </div>
    `;
    container.appendChild(header);

    // Contenedor de tarjetas
    const cardsContainer = document.createElement('div');
    cardsContainer.className = 'settings-container';

    // ============= TARJETA 1: INFORMACIÓN GENERAL =============
    const generalCard = document.createElement('div');
    generalCard.className = 'settings-card';
    generalCard.innerHTML = `
        <div class="settings-card-header">
            <div class="settings-card-icon">📱</div>
            <div class="settings-card-header-content">
                <h3>Información General</h3>
                <p>Nombre y personalización</p>
            </div>
        </div>
        <form id="general-settings-form">
            <div class="bees-form-group">
                <label for="app-name">Nombre de la Aplicación</label>
                <input type="text" id="app-name" name="app_name" value="${settings.app_name || 'QR Karaoke'}" placeholder="Ej: QR Karaoke">
            </div>
            <button type="submit" class="bees-btn bees-btn-primary">
                💾 Guardar Cambios
            </button>
        </form>
    `;
    cardsContainer.appendChild(generalCard);

    // ============= TARJETA: LOGO CORPORATIVO =============
    const logoCard = document.createElement('div');
    logoCard.className = 'settings-card';
    logoCard.innerHTML = `
        <div class="settings-card-header">
            <div class="settings-card-icon">🏢</div>
            <div class="settings-card-header-content">
                <h3>Imagen Corporativa (Logo)</h3>
                <p>Personaliza la pantalla de espera de tu TV</p>
            </div>
        </div>
        <form id="logo-settings-form" enctype="multipart/form-data">
            <div class="logo-preview-container" style="margin-bottom: 20px; text-align: center;">
                <img id="logo-preview-img" src="${settings.owner_logo || '/static/images/watermark.jpg'}" style="width: 120px !important; height: 120px !important; border-radius: 50% !important; border: 2.5px solid var(--primary, #9d4edd) !important; object-fit: cover !important; box-shadow: 0 0 15px rgba(157,78,221,0.3) !important;" />
            </div>
            <div class="bees-form-group">
                <label for="owner-logo-file" class="bees-label">Subir nueva imagen (PNG, JPG, WEBP)</label>
                <input type="file" id="owner-logo-file" name="file" accept="image/*" class="bees-input" style="padding: 8px !important;">
            </div>
            <button type="submit" class="bees-btn bees-btn-primary" style="margin-top: 15px !important;">
                📤 Subir Logo
            </button>
        </form>
    `;
    cardsContainer.appendChild(logoCard);

    // ============= TARJETA 2: TEMA =============
    const themeCard = document.createElement('div');
    themeCard.className = 'settings-card';
    const currentTheme = settings.theme || 'dark';
    themeCard.innerHTML = `
        <div class="settings-card-header">
            <div class="settings-card-icon">🎨</div>
            <div class="settings-card-header-content">
                <h3>Tema Visual</h3>
                <p>Elige tu preferencia</p>
            </div>
        </div>
        <form id="theme-settings-form">
            <div class="theme-options">
                <label class="theme-option ${currentTheme === 'dark' ? 'active' : ''}">
                    <input type="radio" name="theme" value="dark" ${currentTheme === 'dark' ? 'checked' : ''} style="display:none;">
                    <div class="theme-option-icon">🌙</div>
                    <div class="theme-option-label">Oscuro</div>
                </label>
                <label class="theme-option ${currentTheme === 'light' ? 'active' : ''}">
                    <input type="radio" name="theme" value="light" ${currentTheme === 'light' ? 'checked' : ''} style="display:none;">
                    <div class="theme-option-icon">☀️</div>
                    <div class="theme-option-label">Claro</div>
                </label>
                <label class="theme-option ${currentTheme === 'auto' ? 'active' : ''}">
                    <input type="radio" name="theme" value="auto" ${currentTheme === 'auto' ? 'checked' : ''} style="display:none;">
                    <div class="theme-option-icon">🔄</div>
                    <div class="theme-option-label">Auto</div>
                </label>
            </div>
            <button type="submit" class="bees-btn bees-btn-primary">
                💾 Aplicar Tema
            </button>
        </form>
    `;
    cardsContainer.appendChild(themeCard);

    // ============= TARJETA 3: NOTIFICACIONES =============
    const notificationsCard = document.createElement('div');
    notificationsCard.className = 'settings-card';
    notificationsCard.innerHTML = `
        <div class="settings-card-header">
            <div class="settings-card-icon">🔔</div>
            <div class="settings-card-header-content">
                <h3>Notificaciones</h3>
                <p>Controla alertas</p>
            </div>
        </div>
        <form id="notifications-settings-form">
            <div class="notification-item">
                <div class="notification-item-icon">📢</div>
                <div class="notification-item-content">
                    <p class="notification-item-title">Notificaciones Generales</p>
                    <p class="notification-item-desc">Recibe alertas importantes del sistema</p>
                </div>
                <input type="checkbox" class="bees-checkbox" id="enable-notifications" name="enable_notifications" ${settings.enable_notifications !== false ? 'checked' : ''}>
            </div>
            <div class="notification-item">
                <div class="notification-item-icon">🔔</div>
                <div class="notification-item-content">
                    <p class="notification-item-title">Sonido de Pedidos</p>
                    <p class="notification-item-desc">Reproducir sonido al recibir nuevos pedidos</p>
                </div>
                <input type="checkbox" class="bees-checkbox" id="enable-sound" name="enable_sound" ${localStorage.getItem('adminSoundEnabled') !== 'false' ? 'checked' : ''}>
            </div>
            <button type="submit" class="bees-btn bees-btn-primary">
                💾 Guardar Preferencias
            </button>
        </form>
    `;
    cardsContainer.appendChild(notificationsCard);

    // ============= TARJETA: SEDES Y HORAS DE CIERRE (MULTI-LOCAL CRUD) =============
    const localesCard = document.createElement('div');
    localesCard.className = 'settings-card';
    localesCard.style.gridColumn = '1 / -1';
    localesCard.innerHTML = `
        <div class="settings-card-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
            <div style="display: flex; align-items: center; gap: 12px;">
                <div class="settings-card-icon">🏢</div>
                <div class="settings-card-header-content">
                    <h3>Sedes y Horarios de Cierre</h3>
                    <p>Administra las sucursales del negocio y la hora de cierre independiente de cada local</p>
                </div>
            </div>
            <button type="button" class="bees-btn bees-btn-primary" onclick="openCreateLocalModal()" style="font-size: 13px; font-weight: 600; padding: 8px 16px;">
                ➕ Nueva Sede
            </button>
        </div>
        <div style="overflow-x: auto; margin-top: 15px;">
            <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
                <thead>
                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.1); color: var(--page-text-secondary);">
                        <th style="padding: 10px 6px;">Nombre de Sede</th>
                        <th style="padding: 10px 6px;">URL (Slug)</th>
                        <th style="padding: 10px 6px;">Dirección / Contacto</th>
                        <th style="padding: 10px 6px; text-align: center;">🌙 Hora Cierre</th>
                        <th style="padding: 10px 6px; text-align: center;">Estado</th>
                        <th style="padding: 10px 6px; text-align: right;">Acciones</th>
                    </tr>
                </thead>
                <tbody id="locales-table-tbody">
                    <tr><td colspan="6" style="text-align: center; color: var(--page-text-secondary); padding: 25px;">Cargando sedes...</td></tr>
                </tbody>
            </table>
        </div>
    `;
    cardsContainer.appendChild(localesCard);

    // Inyectar modal de locales si no existe
    if (!document.getElementById('local-crud-modal')) {
        const localModal = document.createElement('div');
        localModal.id = 'local-crud-modal';
        localModal.className = 'modal-overlay';
        localModal.innerHTML = `
            <div class="card modal-card-medium" style="background: #18142a; border: 1px solid #6c5ce7; border-radius: 12px; padding: 24px; max-width: 500px; width: 90%;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                    <h3 id="local-modal-title" style="color: #fff; margin: 0; font-size: 1.2em;">🏢 Nueva Sede</h3>
                    <button type="button" onclick="closeLocalModal()" style="background: none; border: none; color: #a29bfe; font-size: 24px; cursor: pointer;">&times;</button>
                </div>
                <form id="local-crud-form">
                    <input type="hidden" id="local-id-field" value="">
                    <div class="bees-form-group" style="margin-bottom: 12px;">
                        <label style="color: #a29bfe; font-size: 13px; font-weight: 600;">Nombre del Establecimiento</label>
                        <input type="text" id="local-nombre" required placeholder="Ej: My Qr Music Bar - Sede Norte" style="width: 100%; background: #1e1738; color: #fff; border: 1px solid rgba(255,255,255,0.2); padding: 10px; border-radius: 8px;">
                    </div>
                    <div class="bees-form-group" style="margin-bottom: 12px;">
                        <label style="color: #a29bfe; font-size: 13px; font-weight: 600;">Identificador URL (Slug)</label>
                        <input type="text" id="local-slug" required placeholder="ej: sede-norte" style="width: 100%; background: #1e1738; color: #fff; border: 1px solid rgba(255,255,255,0.2); padding: 10px; border-radius: 8px;">
                        <small style="color: var(--page-text-secondary); display: block; margin-top: 4px; font-size: 11px;">Solo minúsculas, números y guiones. Se usará para acceder al karaoke.</small>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
                        <div class="bees-form-group">
                            <label style="color: #a29bfe; font-size: 13px; font-weight: 600;">Dirección</label>
                            <input type="text" id="local-direccion" placeholder="Ej: Calle 10 # 40-20" style="width: 100%; background: #1e1738; color: #fff; border: 1px solid rgba(255,255,255,0.2); padding: 10px; border-radius: 8px;">
                        </div>
                        <div class="bees-form-group">
                            <label style="color: #a29bfe; font-size: 13px; font-weight: 600;">Teléfono / Contacto</label>
                            <input type="text" id="local-telefono" placeholder="Ej: 300 123 4567" style="width: 100%; background: #1e1738; color: #fff; border: 1px solid rgba(255,255,255,0.2); padding: 10px; border-radius: 8px;">
                        </div>
                    </div>
                    <div class="bees-form-group" style="margin-bottom: 16px;">
                        <label style="color: #a29bfe; font-size: 13px; font-weight: 600;">🌙 Hora de Cierre Nocturno</label>
                        <input type="time" id="local-hora-cierre" value="03:00" required style="width: 100%; background: #1e1738; color: #fff; border: 1px solid rgba(255,255,255,0.2); padding: 10px; border-radius: 8px;">
                        <small style="color: var(--page-text-secondary); display: block; margin-top: 4px; font-size: 11px;">Hora en que finaliza la atención y se pausa la adición de canciones para esta sede.</small>
                    </div>
                    <div style="display: flex; gap: 12px;">
                        <button type="submit" class="bees-btn bees-btn-primary" style="flex: 1;">💾 Guardar Sede</button>
                        <button type="button" class="bees-btn bees-btn-secondary" onclick="closeLocalModal()">Cancelar</button>
                    </div>
                </form>
            </div>
        `;
        document.body.appendChild(localModal);
    }

    setTimeout(loadLocalesSettingsList, 100);

    // ============= TARJETA 5: CONFIGURACIÓN COLA LAZY =============
    const lazyQueueCard = document.createElement('div');
    lazyQueueCard.className = 'settings-card';
    lazyQueueCard.innerHTML = `
        <div class="settings-card-header">
            <div class="settings-card-icon">🎵</div>
            <div class="settings-card-header-content">
                <h3>Fórmula de Entrada a Cola Lazy</h3>
                <p>Gestiona cómo los usuarios agregan canciones</p>
            </div>
        </div>
        <div style="padding: 16px; background: rgba(76, 175, 80, 0.1); border-radius: 8px; border-left: 4px solid var(--bees-green); margin-bottom: 16px;">
            <p style="margin: 0; font-size: 12px; color: #2e7d32;">
                <strong>ℹ️ Información:</strong> Estos parámetros controlan cómo los usuarios pueden agregar canciones después de hacer una compra.
            </p>
        </div>
        <form id="lazy-queue-form">
            <div class="bees-form-group">
                <label for="credit-multiplier">
                    Multiplicador de Créditos
                    <span style="font-size: 11px; color: var(--settings-text-secondary);">x Monto Gastado</span>
                </label>
                <div style="display: flex; gap: 12px; align-items: center;">
                    <input type="number" id="credit-multiplier" name="credit_multiplier" min="0.1" max="10" step="0.1" value="1.0" style="flex: 1;">
                    <span style="font-size: 14px; font-weight: bold; min-width: 60px;" id="credit-multiplier-display">1.0x</span>
                </div>
                <p style="margin: 8px 0 0 0; font-size: 12px; color: var(--settings-text-secondary);">
                    Ej: 1.0 = $100 → 100 créditos | 1.5 = $100 → 150 créditos
                </p>
            </div>

            <div class="bees-form-group">
                <label for="decay-rate">
                    Tasa de Decaimiento
                    <span style="font-size: 11px; color: var(--settings-text-secondary);">Créditos/Minuto</span>
                </label>
                <div style="display: flex; gap: 12px; align-items: center;">
                    <input type="number" id="decay-rate" name="decay_rate" min="0" step="10" value="100" style="flex: 1;">
                    <span style="font-size: 14px; font-weight: bold; min-width: 100px;" id="decay-rate-display">100/min</span>
                </div>
                <p style="margin: 8px 0 0 0; font-size: 12px; color: var(--settings-text-secondary);">
                    Créditos que se pierden cada minuto (0 = sin decaimiento)
                </p>
            </div>

            <div style="margin-top: 16px; padding-top: 16px; border-top: 2px solid var(--settings-border);">
                <h4 style="margin: 0 0 12px 0; color: var(--settings-text);">Modos Especiales</h4>
                
                <label style="display: flex; align-items: center; gap: 12px; padding: 12px; background: rgba(255, 193, 7, 0.1); border-radius: 8px; border-left: 4px solid #FFC107; cursor: pointer; margin-bottom: 12px;">
                    <input type="checkbox" id="allow-unrestricted" name="allow_unrestricted" class="bees-checkbox" style="margin: 0;">
                    <div>
                        <strong>🔓 Modo Sin Restricciones</strong>
                        <p style="margin: 4px 0 0 0; font-size: 12px; color: var(--settings-text-secondary);">
                            Permite que los usuarios agreguen canciones sin límite de créditos
                        </p>
                    </div>
                </label>
            </div>

            <div class="bees-form-group">
                <label for="max-concurrent">Máximo de Canciones Concurrentes por Usuario</label>
                <input type="number" id="max-concurrent" name="max_concurrent_songs" min="1" max="50" value="10">
                <p style="margin: 8px 0 0 0; font-size: 12px; color: var(--settings-text-secondary);">
                    Límite de canciones que puede tener un usuario en la cola simultáneamente
                </p>
            </div>

            <button type="submit" class="bees-btn bees-btn-primary" style="width: 100%; margin-top: 16px; padding: 12px;">
                💾 Guardar Configuración
            </button>
        </form>
    `;
    cardsContainer.appendChild(lazyQueueCard);

    // ============= TARJETA: REPRODUCTOR NATIVO (PLAYER 2) =============
    const player2Card = document.createElement('div');
    player2Card.className = 'settings-card';
    player2Card.innerHTML = `
        <div class="settings-card-header">
            <div class="settings-card-icon">📺</div>
            <div class="settings-card-header-content">
                <h3>Reproductor Nativo (Player 2)</h3>
                <p>Control del reproductor Chromium local con bloqueador de publicidad</p>
            </div>
        </div>
        <div style="margin-top: 15px; display: flex; flex-direction: column; gap: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.05); padding: 10px 15px; border-radius: 8px;">
                <span style="font-size: 14px; color: var(--page-text-secondary);">Estado del reproductor local:</span>
                <strong id="player2-status-text" style="color: var(--bees-red);">🔴 Inactivo</strong>
            </div>
            <div style="display: flex; gap: 10px;">
                <button type="button" id="btn-launch-player2" class="bees-btn bees-btn-success" style="flex: 1; padding: 12px;">🟢 Iniciar</button>
                <button type="button" id="btn-kill-player2" class="bees-btn bees-btn-danger" style="flex: 1; padding: 12px;">🔴 Detener</button>
            </div>
            <div style="font-size: 12px; color: var(--page-text-secondary); line-height: 1.4;">
                💡 <em>Nota: Esta acción ejecuta Chromium de forma local en la máquina que aloja el servidor. Si estás en la nube, ejecuta <strong>python launch_player2.py --server TU_URL_SERVER --ws TU_URL_WS</strong> localmente en el PC del bar.</em>
            </div>
        </div>
    `;
    cardsContainer.appendChild(player2Card);
    
    // Check status immediately
    setTimeout(checkPlayer2Status, 100);

    // ============= TARJETA: EQUIPO Y COLABORADORES (MULTI-SEDE) =============
    const employeesCard = document.createElement('div');
    employeesCard.className = 'settings-card';
    employeesCard.style.gridColumn = '1 / -1';
    employeesCard.innerHTML = `
        <div class="settings-card-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
            <div style="display: flex; align-items: center; gap: 12px;">
                <div class="settings-card-icon">👥</div>
                <div class="settings-card-header-content">
                    <h3>Equipo y Permisos</h3>
                    <p>Administra colaboradores, roles y módulos permitidos por sede</p>
                </div>
            </div>
            <button type="button" class="bees-btn bees-btn-primary" onclick="openCreateEmployeeModal()" style="font-size: 13px; font-weight: 600; padding: 8px 16px;">
                ➕ Agregar Empleado
            </button>
        </div>
        <div style="overflow-x: auto; margin-top: 15px;">
            <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
                <thead>
                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.1); color: var(--page-text-secondary);">
                        <th style="padding: 10px 6px;">Nombre</th>
                        <th style="padding: 10px 6px;">Correo</th>
                        <th style="padding: 10px 6px;">Rol</th>
                        <th style="padding: 10px 6px;">Módulos Autorizados</th>
                        <th style="padding: 10px 6px; text-align: center;">Estado</th>
                        <th style="padding: 10px 6px; text-align: right;">Acciones</th>
                    </tr>
                </thead>
                <tbody id="employees-table-tbody">
                    <tr><td colspan="6" style="text-align: center; color: var(--page-text-secondary); padding: 25px;">Cargando colaboradores...</td></tr>
                </tbody>
            </table>
        </div>
    `;
    cardsContainer.appendChild(employeesCard);

    // Inyectar modal de colaboradores si no existe
    if (!document.getElementById('employee-crud-modal')) {
        const empModal = document.createElement('div');
        empModal.id = 'employee-crud-modal';
        empModal.className = 'modal-overlay';
        empModal.innerHTML = `
            <div class="card modal-card-medium" style="background: #18142a; border: 1px solid #6c5ce7; border-radius: 12px; padding: 24px; max-width: 520px; width: 90%;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                    <h3 id="employee-modal-title" style="color: #fff; margin: 0; font-size: 1.2em;">👤 Agregar Colaborador</h3>
                    <button type="button" onclick="closeEmployeeModal()" style="background: none; border: none; color: #a29bfe; font-size: 24px; cursor: pointer;">&times;</button>
                </div>
                <form id="employee-crud-form">
                    <input type="hidden" id="employee-id-field" value="">
                    <div class="bees-form-group" style="margin-bottom: 12px;">
                        <label style="color: #a29bfe; font-size: 13px; font-weight: 600;">Nombre Completo</label>
                        <input type="text" id="employee-nombre" required placeholder="Ej: Carlos Gómez" style="width: 100%; background: #1e1738; color: #fff; border: 1px solid rgba(255,255,255,0.2); padding: 10px; border-radius: 8px;">
                    </div>
                    <div class="bees-form-group" style="margin-bottom: 12px;">
                        <label style="color: #a29bfe; font-size: 13px; font-weight: 600;">Correo Electrónico</label>
                        <input type="email" id="employee-email" required placeholder="carlos@local.com" style="width: 100%; background: #1e1738; color: #fff; border: 1px solid rgba(255,255,255,0.2); padding: 10px; border-radius: 8px;">
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
                        <div class="bees-form-group">
                            <label style="color: #a29bfe; font-size: 13px; font-weight: 600;">Rol</label>
                            <select id="employee-rol" required style="width: 100%; background: #1e1738; color: #fff; border: 1px solid rgba(255,255,255,0.2); padding: 10px; border-radius: 8px;">
                                <option value="admin">Administrador de Sede</option>
                                <option value="cajero">Cajero / Barra</option>
                                <option value="mesero">Mesero / Sala</option>
                                <option value="dj">DJ / Karaoke</option>
                            </select>
                        </div>
                        <div class="bees-form-group">
                            <label style="color: #a29bfe; font-size: 13px; font-weight: 600;">Sede Asignada</label>
                            <select id="employee-local-id" required style="width: 100%; background: #1e1738; color: #fff; border: 1px solid rgba(255,255,255,0.2); padding: 10px; border-radius: 8px;">
                                <option value="">Selecciona sede...</option>
                            </select>
                        </div>
                    </div>
                    <div class="bees-form-group" style="margin-bottom: 14px;">
                        <label style="color: #a29bfe; font-size: 13px; font-weight: 600;" id="employee-password-label">Contraseña</label>
                        <input type="password" id="employee-password" placeholder="••••••••" style="width: 100%; background: #1e1738; color: #fff; border: 1px solid rgba(255,255,255,0.2); padding: 10px; border-radius: 8px;">
                        <small id="employee-password-help" style="color: var(--page-text-secondary); display: none; margin-top: 4px;">Deja en blanco si no deseas cambiar la contraseña.</small>
                    </div>
                    <div class="bees-form-group" style="margin-bottom: 16px;">
                        <label style="color: #a29bfe; font-size: 13px; font-weight: 600; display: block; margin-bottom: 8px;">Módulos Autorizados</label>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; background: rgba(0,0,0,0.2); padding: 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.08);">
                            <label style="display: flex; align-items: center; gap: 8px; font-size: 12px; cursor: pointer; color: #fff;">
                                <input type="checkbox" name="emp_module" value="dashboard" checked> 📊 Dashboard
                            </label>
                            <label style="display: flex; align-items: center; gap: 8px; font-size: 12px; cursor: pointer; color: #fff;">
                                <input type="checkbox" name="emp_module" value="accounts" checked> 🪑 Mesas y Cuentas
                            </label>
                            <label style="display: flex; align-items: center; gap: 8px; font-size: 12px; cursor: pointer; color: #fff;">
                                <input type="checkbox" name="emp_module" value="inventory" checked> 📦 Inventario
                            </label>
                            <label style="display: flex; align-items: center; gap: 8px; font-size: 12px; cursor: pointer; color: #fff;">
                                <input type="checkbox" name="emp_module" value="queue" checked> 🎵 Cola Karaoke
                            </label>
                            <label style="display: flex; align-items: center; gap: 8px; font-size: 12px; cursor: pointer; color: #fff;">
                                <input type="checkbox" name="emp_module" value="reports"> 📈 Reportes
                            </label>
                            <label style="display: flex; align-items: center; gap: 8px; font-size: 12px; cursor: pointer; color: #fff;">
                                <input type="checkbox" name="emp_module" value="settings"> ⚙️ Configuración
                            </label>
                        </div>
                    </div>
                    <div style="display: flex; gap: 12px;">
                        <button type="submit" class="bees-btn bees-btn-primary" style="flex: 1;">💾 Guardar Colaborador</button>
                        <button type="button" class="bees-btn bees-btn-secondary" onclick="closeEmployeeModal()">Cancelar</button>
                    </div>
                </form>
            </div>
        `;
        document.body.appendChild(empModal);
    }

    setTimeout(loadEmployeesList, 150);

    // ============= TARJETA 7: HERRAMIENTAS DE DIAGNÓSTICO =============
    const debugCard = document.createElement('div');
    debugCard.className = 'settings-card';
    debugCard.innerHTML = `
        <div class="settings-card-header">
            <div class="settings-card-icon">🔍</div>
            <div class="settings-card-header-content">
                <h3>Herramientas de Diagnóstico</h3>
                <p>Verificar estado real de la cola y sincronización</p>
            </div>
        </div>
        <button class="bees-btn bees-btn-success" onclick="if(window.queueValidator) { window.queueValidator.toggleDebugPanel() } else { alert('Herramienta de debug no cargada') }" style="width: 100%; margin-top: 10px; padding: 12px;">🔍 DEBUG COLA</button>
    `;
    cardsContainer.appendChild(debugCard);

    // ============= TARJETA 8: ZONA PELIGROSA =============
    const dangerCard = document.createElement('div');
    dangerCard.className = 'settings-card';
    dangerCard.style.borderLeft = '4px solid var(--bees-red)';
    dangerCard.style.background = 'rgba(255, 68, 68, 0.05)';
    dangerCard.innerHTML = `
        <div class="settings-card-header">
            <div class="settings-card-icon" style="color: var(--bees-red);">⚠️</div>
            <div class="settings-card-header-content">
                <h3 style="color: var(--bees-red);">Zona Peligrosa</h3>
                <p>Acciones que afectan toda la aplicación</p>
            </div>
        </div>
        <div style="padding: 12px; background: rgba(255, 68, 68, 0.1); border-radius: 8px; border-left: 4px solid var(--bees-red); margin-bottom: 16px;">
            <strong style="color: var(--bees-red);">⚠️ Advertencia:</strong> Estas acciones no se pueden deshacer fácilmente.
        </div>
        <button class="bees-btn bees-btn-danger" id="reset-night-btn" style="width: 100%; padding: 12px;">🔄 Reiniciar Noche</button>
    `;
    cardsContainer.appendChild(dangerCard);

    container.appendChild(cardsContainer);

    // Configurar listeners después de renderizar
    setupSettingsListeners();
}

async function handleClosingTimeUpdate(event, form) {
    event.preventDefault();
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    data.closing_hour = parseInt(data.closing_hour, 10);
    data.closing_minute = parseInt(data.closing_minute, 10);

    try {
        let success = false;
        try {
            await apiFetch('/admin/settings/closing-time', {
                method: 'POST',
                body: JSON.stringify(data)
            });
            success = true;
        } catch (e) {
            // Fallback
            const fallbackData = {
                hora_cierre: `${String(data.closing_hour).padStart(2, '0')}:${String(data.closing_minute).padStart(2, '0')}`
            };
            await apiFetch('/admin/set-closing-time', {
                method: 'POST',
                body: JSON.stringify(fallbackData)
            });
            success = true;
        }

        if (success) {
            // Actualizar display
            const display = document.getElementById('closing-time-display');
            if (display) {
                display.textContent = `${String(data.closing_hour).padStart(2, '0')}:${String(data.closing_minute).padStart(2, '0')}`;
            }
            showNotification(`✅ Hora de cierre actualizada a ${String(data.closing_hour).padStart(2, '0')}:${String(data.closing_minute).padStart(2, '0')}`, 'success');
        }
    } catch (error) {
        showNotification(`❌ ${error.message}`, 'error');
    }
}

async function handleThemeChange(event, form) {
    event.preventDefault();
    const formData = new FormData(form);
    const theme = formData.get('theme');

    try {
        const data = {
            app_name: 'QR Karaoke',
            theme: theme,
            enable_notifications: true
        };

        await apiFetch('/admin/settings/general', {
            method: 'POST',
            body: JSON.stringify(data)
        });

        // Aplicar tema
        document.body.dataset.theme = theme;

        // Actualizar botones visuales
        document.querySelectorAll('.theme-option').forEach(option => {
            option.classList.remove('active');
        });
        form.querySelector(`input[value="${theme}"]`).parentElement.classList.add('active');

        showNotification(`✅ Tema cambiado a ${theme === 'dark' ? 'Oscuro 🌙' : theme === 'light' ? 'Claro ☀️' : 'Auto 🔄'}`, 'success');
    } catch (error) {
        showNotification(`❌ ${error.message}`, 'error');
    }
}

async function handleNotificationsChange(event, form) {
    event.preventDefault();
    const enableNotifications = document.getElementById('enable-notifications').checked;
    const enableSound = document.getElementById('enable-sound').checked;

    try {
        // Guardar preferencia de sonido localmente
        localStorage.setItem('adminSoundEnabled', enableSound);

        const data = {
            app_name: 'QR Karaoke',
            theme: document.body.dataset.theme || 'dark',
            enable_notifications: enableNotifications
        };

        await apiFetch('/admin/settings/general', {
            method: 'POST',
            body: JSON.stringify(data)
        });

        showNotification(`✅ Preferencias actualizadas.`, 'success');
    } catch (error) {
        showNotification(`❌ ${error.message}`, 'error');
    }
}

async function handleGeneralSettingsUpdate(event, form) {
    event.preventDefault();
    const formData = new FormData(form);
    const data = {
        app_name: formData.get('app_name'),
        theme: 'dark', // Mantener tema actual, solo cambiar nombre
        enable_notifications: true // Mantener notificaciones actuales
    };

    try {
        await apiFetch('/admin/settings/general', {
            method: 'POST',
            body: JSON.stringify(data)
        });
        showNotification(`✅ Configuración actualizada. Nombre: "${data.app_name}"`, 'success');
    } catch (error) {
        showNotification(`❌ ${error.message}`, 'error');
    }
}

async function handleLogoUpload(event, form) {
    event.preventDefault();
    const fileInput = document.getElementById('owner-logo-file');
    if (!fileInput || fileInput.files.length === 0) {
        showNotification('❌ Por favor, selecciona un archivo.', 'error');
        return;
    }
    
    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    
    try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        const headers = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        
        const response = await fetch('/api/v1/admin/settings/logo', {
            method: 'POST',
            headers: headers,
            body: formData
        });
        
        const result = await response.json();
        if (response.ok && result.status === 'success') {
            showNotification('✅ Logo corporativo subido exitosamente.', 'success');
            const preview = document.getElementById('logo-preview-img');
            if (preview) {
                preview.src = result.owner_logo + '?t=' + Date.now();
            }
        } else {
            showNotification(`❌ ${result.message || 'Error al subir el logo'}`, 'error');
        }
    } catch (error) {
        showNotification(`❌ Error: ${error.message}`, 'error');
    }
}



async function loadLazyQueueConfig() {
    try {
        const config = await apiFetch('/admin/settings/lazy-queue');

        // Cargar valores en el formulario
        const creditMultiplierInput = document.getElementById('credit-multiplier');
        const decayRateInput = document.getElementById('decay-rate');
        const unrestricted = document.getElementById('allow-unrestricted');
        const maxConcurrentInput = document.getElementById('max-concurrent');

        if (creditMultiplierInput) {
            creditMultiplierInput.value = (config.credit_multiplier || 1.0).toFixed(1);
            const display = document.getElementById('credit-multiplier-display');
            if (display) display.textContent = (config.credit_multiplier || 1.0).toFixed(1) + 'x';
        }

        if (decayRateInput) {
            decayRateInput.value = config.decay_rate || 100;
            const display = document.getElementById('decay-rate-display');
            if (display) display.textContent = (config.decay_rate || 100) + '/min';
        }

        if (unrestricted) {
            unrestricted.checked = config.allow_unrestricted || false;
        }

        if (maxConcurrentInput) {
            maxConcurrentInput.value = config.max_concurrent_songs || 10;
        }
    } catch (error) {
        console.log('No se pudo cargar configuración de cola lazy:', error.message);
    }
}

async function handleLazyQueueUpdate(event, form) {
    event.preventDefault();
    const formData = new FormData(form);
    const data = {
        credit_multiplier: parseFloat(formData.get('credit_multiplier')) || 1.0,
        decay_rate: parseInt(formData.get('decay_rate')) || 100,
        allow_unrestricted: formData.get('allow_unrestricted') === 'on',
        max_concurrent_songs: parseInt(formData.get('max_concurrent_songs')) || 10
    };

    try {
        const result = await apiFetch('/admin/settings/lazy-queue', {
            method: 'POST',
            body: JSON.stringify(data)
        });

        showNotification('✅ Configuración de cola lazy actualizada correctamente.', 'success');
    } catch (error) {
        showNotification(`❌ Error: ${error.message}`, 'error');
    }
}

function setupSettingsListeners() {
    const closingTimeForm = document.getElementById('closing-time-form');
    const createApiKeyForm = document.getElementById('create-api-key-form');
    const generalSettingsForm = document.getElementById('general-settings-form');
    const themeSettingsForm = document.getElementById('theme-settings-form');
    const notificationsSettingsForm = document.getElementById('notifications-settings-form');
    const resetNightBtn = document.getElementById('reset-night-btn');

    // Closing time form
    if (closingTimeForm && !closingTimeForm.dataset.listenerAttached) {
        closingTimeForm.addEventListener('submit', (e) => handleClosingTimeUpdate(e, e.target));
        closingTimeForm.dataset.listenerAttached = '1';
    }

    // API key form
    if (createApiKeyForm && !createApiKeyForm.dataset.listenerAttached) {
        createApiKeyForm.addEventListener('submit', (e) => handleCreateApiKey(e, e.target));
        createApiKeyForm.dataset.listenerAttached = '1';
    }

    // General settings form
    if (generalSettingsForm && !generalSettingsForm.dataset.listenerAttached) {
        generalSettingsForm.addEventListener('submit', (e) => handleGeneralSettingsUpdate(e, e.target));
        generalSettingsForm.dataset.listenerAttached = '1';
    }

    // Logo settings form
    const logoSettingsForm = document.getElementById('logo-settings-form');
    if (logoSettingsForm && !logoSettingsForm.dataset.listenerAttached) {
        logoSettingsForm.addEventListener('submit', (e) => handleLogoUpload(e, e.target));
        logoSettingsForm.dataset.listenerAttached = '1';
    }

    // Theme form
    if (themeSettingsForm && !themeSettingsForm.dataset.listenerAttached) {
        themeSettingsForm.addEventListener('submit', (e) => handleThemeChange(e, e.target));
        // Permitir cambio al hacer click en radio buttons
        themeSettingsForm.querySelectorAll('input[name="theme"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                e.target.closest('form').dispatchEvent(new Event('submit'));
            });
        });
        themeSettingsForm.dataset.listenerAttached = '1';
    }

    // Notifications form
    if (notificationsSettingsForm && !notificationsSettingsForm.dataset.listenerAttached) {
        notificationsSettingsForm.addEventListener('submit', (e) => handleNotificationsChange(e, e.target));
        // Cambio rápido al hacer click en checkbox
        const notificationCheckbox = document.getElementById('enable-notifications');
        const soundCheckbox = document.getElementById('enable-sound');

        if (notificationCheckbox) {
            notificationCheckbox.addEventListener('change', (e) => {
                e.target.closest('form').dispatchEvent(new Event('submit'));
            });
        }
        if (soundCheckbox) {
            soundCheckbox.addEventListener('change', (e) => {
                e.target.closest('form').dispatchEvent(new Event('submit'));
            });
        }
        notificationsSettingsForm.dataset.listenerAttached = '1';
    }

    // Reset night button
    if (resetNightBtn) {
        resetNightBtn.addEventListener('click', handleResetNight);
    }

    // Lazy Queue form
    const lazyQueueForm = document.getElementById('lazy-queue-form');
    if (lazyQueueForm && !lazyQueueForm.dataset.listenerAttached) {
        lazyQueueForm.addEventListener('submit', (e) => handleLazyQueueUpdate(e, e.target));

        // Listeners para actualización en tiempo real de los displays
        const creditMultiplierInput = document.getElementById('credit-multiplier');
        const decayRateInput = document.getElementById('decay-rate');
        const unrestricted = document.getElementById('allow-unrestricted');

        if (creditMultiplierInput) {
            creditMultiplierInput.addEventListener('input', (e) => {
                const display = document.getElementById('credit-multiplier-display');
                if (display) {
                    display.textContent = parseFloat(e.target.value).toFixed(1) + 'x';
                }
            });
        }

        if (decayRateInput) {
            decayRateInput.addEventListener('input', (e) => {
                const display = document.getElementById('decay-rate-display');
                if (display) {
                    display.textContent = e.target.value + '/min';
                }
            });
        }

        lazyQueueForm.dataset.listenerAttached = '1';
    }

    // Load current lazy queue configuration
    loadLazyQueueConfig();

    // Player 2 controls listeners
    const btnLaunch = document.getElementById('btn-launch-player2');
    const btnKill = document.getElementById('btn-kill-player2');
    
    if (btnLaunch && !btnLaunch.dataset.listenerAttached) {
        btnLaunch.addEventListener('click', handleLaunchPlayer2);
        btnLaunch.dataset.listenerAttached = '1';
    }
    
    if (btnKill && !btnKill.dataset.listenerAttached) {
        btnKill.addEventListener('click', handleKillPlayer2);
        btnKill.dataset.listenerAttached = '1';
    }

    const empForm = document.getElementById('employee-crud-form');
    if (empForm && !empForm.dataset.listenerAttached) {
        empForm.addEventListener('submit', handleSaveEmployee);
        empForm.dataset.listenerAttached = '1';
    }

    const localForm = document.getElementById('local-crud-form');
    if (localForm && !localForm.dataset.listenerAttached) {
        localForm.addEventListener('submit', handleSaveLocal);
        localForm.dataset.listenerAttached = '1';
    }
}

async function handleResetNight() {
    if (!confirm('⚠️ ACCIÓN DESTRUCTIVA\n\n¿Estás seguro de reiniciar la noche?\nSe borrarán: mesas, usuarios, canciones y consumos.')) {
        return;
    }

    try {
        await apiFetch('/admin/reset-night', { method: 'POST' });
        showNotification('✅ Sistema reiniciado correctamente.', 'success');
        setTimeout(() => loadSettingsPage(), 300);
    } catch (error) {
        showNotification(`❌ ${error.message}`, 'error');
    }
}

async function checkPlayer2Status() {
    const statusText = document.getElementById('player2-status-text');
    if (!statusText) return;
    try {
        const response = await apiFetch('/player2/status');
        if (response && response.running) {
            statusText.textContent = '🟢 Activo (Kiosko)';
            statusText.style.color = 'var(--bees-green, #2ecc71)';
        } else {
            statusText.textContent = '🔴 Inactivo';
            statusText.style.color = 'var(--bees-red, #e74c3c)';
        }
    } catch (e) {
        console.warn('Player2 status endpoint error:', e);
    }
}

async function handleLaunchPlayer2() {
    try {
        const response = await apiFetch('/player2/launch', { method: 'POST' });
        showNotification(response.message || '🟢 Reproductor nativo iniciado.', 'success');
        setTimeout(checkPlayer2Status, 1000);
    } catch (error) {
        showNotification(`❌ ${error.message}`, 'error');
    }
}

async function handleKillPlayer2() {
    try {
        const response = await apiFetch('/player2/kill', { method: 'POST' });
        showNotification(response.message || '🔴 Reproductor nativo detenido.', 'info');
        setTimeout(checkPlayer2Status, 500);
    } catch (error) {
        showNotification(`❌ ${error.message}`, 'error');
    }
}

// ==========================================
// GESTIÓN DE COLABORADORES / EMPLEADOS
// ==========================================

let allEmployees = [];

async function loadEmployeesList() {
    const tbody = document.getElementById('employees-table-tbody');
    if (!tbody) return;

    const activeLocalId = parseInt(sessionStorage.getItem('active_local_id'), 10);
    if (!activeLocalId) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--page-text-secondary); padding: 20px;">Selecciona una sede activa para ver sus colaboradores.</td></tr>';
        return;
    }

    try {
        const employees = await apiFetch(`/saas/locales/${activeLocalId}/employees`);
        allEmployees = employees || [];
        renderEmployeesList(allEmployees);
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--bees-red); padding: 20px;">Error al cargar colaboradores: ${err.message}</td></tr>`;
    }
}

function renderEmployeesList(employees) {
    const tbody = document.getElementById('employees-table-tbody');
    if (!tbody) return;

    tbody.innerHTML = '';
    if (!employees || employees.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--page-text-secondary); padding: 20px;">No hay colaboradores registrados en esta sede.</td></tr>';
        return;
    }

    const roleBadges = {
        'admin': '<span class="bees-badge bees-badge-primary">👑 Admin Sede</span>',
        'cajero': '<span class="bees-badge bees-badge-success">💵 Cajero</span>',
        'mesero': '<span class="bees-badge bees-badge-info">🍽️ Mesero</span>',
        'dj': '<span class="bees-badge bees-badge-warning">🎧 DJ / Karaoke</span>'
    };

    const moduleIcons = {
        'dashboard': '📊 Dashboard',
        'accounts': '🪑 Mesas',
        'inventory': '📦 Inventario',
        'queue': '🎵 Cola',
        'reports': '📈 Reportes',
        'settings': '⚙️ Ajustes',
        'tables': '🪑 Mesas'
    };

    employees.forEach(emp => {
        const roleHtml = roleBadges[emp.rol] || `<span class="bees-badge bees-badge-secondary">${emp.rol}</span>`;
        const statusHtml = emp.is_active
            ? '<span class="bees-badge bees-badge-success">✓ Activo</span>'
            : '<span class="bees-badge bees-badge-danger">✗ Inactivo</span>';

        const modulesList = emp.modulos_permitidos || [];
        const modulesHtml = modulesList.length > 0
            ? modulesList.map(m => `<span style="display: inline-block; background: rgba(108,92,231,0.2); color: #a29bfe; border: 1px solid rgba(108,92,231,0.4); padding: 2px 6px; border-radius: 4px; font-size: 11px; margin: 2px;">${moduleIcons[m] || m}</span>`).join(' ')
            : '<span style="color: var(--page-text-secondary); font-size: 11px;">Ninguno</span>';

        const row = document.createElement('tr');
        row.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
        row.innerHTML = `
            <td style="padding: 10px 6px; font-weight: 600; color: #fff;">${emp.nombre}</td>
            <td style="padding: 10px 6px; color: var(--page-text-secondary);">${emp.email}</td>
            <td style="padding: 10px 6px;">${roleHtml}</td>
            <td style="padding: 10px 6px; max-width: 250px;">${modulesHtml}</td>
            <td style="padding: 10px 6px; text-align: center;">${statusHtml}</td>
            <td style="padding: 10px 6px; text-align: right; white-space: nowrap;">
                <button type="button" class="bees-btn bees-btn-secondary" style="width: 32px; height: 32px; padding: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 6px; margin-right: 4px; font-size: 14px;" onclick="openEditEmployeeModal(${emp.id})" title="Editar Colaborador">✏️</button>
                <button type="button" class="bees-btn bees-btn-danger" style="width: 32px; height: 32px; padding: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 6px; font-size: 14px;" onclick="handleDeleteEmployee(${emp.id})" title="Eliminar Colaborador">🗑️</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

async function populateLocalDropdownInEmployeeModal(selectedLocalId = null) {
    const localSelect = document.getElementById('employee-local-id');
    if (!localSelect) return;

    localSelect.innerHTML = '<option value="">Cargando sedes...</option>';
    try {
        const locales = await apiFetch('/saas/locales');
        localSelect.innerHTML = '<option value="">Selecciona sede...</option>';
        if (locales) {
            locales.forEach(loc => {
                const opt = document.createElement('option');
                opt.value = loc.id;
                opt.textContent = loc.nombre;
                if (selectedLocalId && loc.id == selectedLocalId) opt.selected = true;
                localSelect.appendChild(opt);
            });
        }
    } catch(e) {
        localSelect.innerHTML = '<option value="">Error al cargar sedes</option>';
    }
}

function openCreateEmployeeModal() {
    const modal = document.getElementById('employee-crud-modal');
    if (!modal) return;

    const activeLocalId = parseInt(sessionStorage.getItem('active_local_id'), 10);
    document.getElementById('employee-modal-title').textContent = '👤 Agregar Colaborador';
    document.getElementById('employee-id-field').value = '';
    document.getElementById('employee-nombre').value = '';
    document.getElementById('employee-email').value = '';
    document.getElementById('employee-email').disabled = false;
    document.getElementById('employee-password').value = '';
    document.getElementById('employee-password').required = true;
    document.getElementById('employee-password-help').style.display = 'none';
    document.getElementById('employee-rol').value = 'mesero';

    populateLocalDropdownInEmployeeModal(activeLocalId);

    const defaultModules = ['accounts', 'tables', 'queue'];
    document.querySelectorAll('input[name="emp_module"]').forEach(cb => {
        cb.checked = defaultModules.includes(cb.value);
    });

    modal.classList.add('active');
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
}

function openEditEmployeeModal(employeeId) {
    const modal = document.getElementById('employee-crud-modal');
    if (!modal) return;

    const emp = allEmployees.find(e => e.id == employeeId);
    if (!emp) return;

    document.getElementById('employee-modal-title').textContent = '✏️ Editar Colaborador';
    document.getElementById('employee-id-field').value = emp.id;
    document.getElementById('employee-nombre').value = emp.nombre;
    document.getElementById('employee-email').value = emp.email;
    document.getElementById('employee-email').disabled = true;
    document.getElementById('employee-password').value = '';
    document.getElementById('employee-password').required = false;
    document.getElementById('employee-password-help').style.display = 'block';
    document.getElementById('employee-rol').value = emp.rol || 'mesero';

    populateLocalDropdownInEmployeeModal(emp.local_id);

    const allowed = emp.modulos_permitidos || [];
    document.querySelectorAll('input[name="emp_module"]').forEach(cb => {
        cb.checked = allowed.includes(cb.value);
    });

    modal.classList.add('active');
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
}

function closeEmployeeModal() {
    const modal = document.getElementById('employee-crud-modal');
    if (modal) {
        modal.classList.remove('active');
        modal.classList.add('hidden');
        modal.style.display = 'none';
    }
}

async function handleSaveEmployee(e) {
    e.preventDefault();
    const empId = document.getElementById('employee-id-field').value;
    const nombre = document.getElementById('employee-nombre').value.trim();
    const email = document.getElementById('employee-email').value.trim();
    const password = document.getElementById('employee-password').value;
    const rol = document.getElementById('employee-rol').value;
    const localId = parseInt(document.getElementById('employee-local-id').value, 10);

    const selectedModules = [];
    document.querySelectorAll('input[name="emp_module"]:checked').forEach(cb => {
        selectedModules.push(cb.value);
    });

    if (!localId) {
        showNotification('Por favor asigna una sede al empleado.', 'error');
        return;
    }

    try {
        if (!empId) {
            // Create
            if (!password) {
                showNotification('La contraseña es obligatoria.', 'error');
                return;
            }
            const payload = {
                nombre,
                email,
                password,
                rol,
                local_id: localId,
                modulos_permitidos: selectedModules
            };
            await apiFetch(`/saas/locales/${localId}/employees`, {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            showNotification('✅ Colaborador creado exitosamente.', 'success');
        } else {
            // Update
            const payload = {
                nombre,
                rol,
                local_id: localId,
                modulos_permitidos: selectedModules
            };
            if (password) payload.password = password;

            await apiFetch(`/saas/locales/${localId}/employees/${empId}`, {
                method: 'PUT',
                body: JSON.stringify(payload)
            });
            showNotification('✅ Colaborador actualizado.', 'success');
        }

        closeEmployeeModal();
        loadEmployeesList();
    } catch (err) {
        showNotification(`Error: ${err.message}`, 'error');
    }
}

async function handleDeleteEmployee(employeeId) {
    const activeLocalId = parseInt(sessionStorage.getItem('active_local_id'), 10);
    if (!confirm('¿Estás seguro de eliminar a este colaborador? Ya no podrá acceder al panel.')) {
        return;
    }

    try {
        await apiFetch(`/saas/locales/${activeLocalId}/employees/${employeeId}`, {
            method: 'DELETE'
        });
        showNotification('✅ Colaborador eliminado.', 'success');
        loadEmployeesList();
    } catch (err) {
        showNotification(`Error al eliminar: ${err.message}`, 'error');
    }
}

// ==========================================
// GESTIÓN DE SEDES / LOCALES (MULTI-LOCAL CRUD)
// ==========================================

let allLocalesSettings = [];

async function loadLocalesSettingsList() {
    const tbody = document.getElementById('locales-table-tbody');
    if (!tbody) return;

    try {
        const locales = await apiFetch('/saas/locales');
        allLocalesSettings = locales || [];
        renderLocalesSettingsList(allLocalesSettings);
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--bees-red); padding: 20px;">Error al cargar sedes: ${err.message}</td></tr>`;
    }
}

function renderLocalesSettingsList(locales) {
    const tbody = document.getElementById('locales-table-tbody');
    if (!tbody) return;

    tbody.innerHTML = '';
    if (!locales || locales.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--page-text-secondary); padding: 20px;">No hay sedes registradas.</td></tr>';
        return;
    }

    const currentActiveLocalId = sessionStorage.getItem('active_local_id');

    locales.forEach(loc => {
        const isCurrent = String(loc.id) === String(currentActiveLocalId);
        const currentBadge = isCurrent
            ? '<span class="bees-badge bees-badge-primary" style="margin-left: 8px; font-size: 11px;">📍 Sede Activa</span>'
            : '';

        const statusHtml = loc.is_active
            ? '<span class="bees-badge bees-badge-success">✓ Activa</span>'
            : '<span class="bees-badge bees-badge-danger">✗ Inactiva</span>';

        const contactInfo = [loc.direccion, loc.telefono].filter(Boolean).join(' • ') || '<span style="color: var(--page-text-secondary); font-size: 11px;">Sin datos</span>';
        const horaCierre = loc.hora_cierre || '03:00';

        const switchBtn = !isCurrent
            ? `<button type="button" class="bees-btn bees-btn-primary" style="width: 32px; height: 32px; padding: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 6px; margin-right: 4px; font-size: 14px;" onclick="handleSwitchActiveLocal(${loc.id}, '${loc.nombre}')" title="Conmutar a esta sede">🔄</button>`
            : '';

        const row = document.createElement('tr');
        row.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
        row.innerHTML = `
            <td style="padding: 10px 6px; font-weight: 600; color: #fff;">
                ${loc.nombre} ${currentBadge}
            </td>
            <td style="padding: 10px 6px; font-family: monospace; color: #a29bfe;">${loc.slug}</td>
            <td style="padding: 10px 6px; color: var(--page-text-secondary); font-size: 12px;">${contactInfo}</td>
            <td style="padding: 10px 6px; text-align: center; font-weight: 600; color: #ffd32a;">
                🌙 ${horaCierre}
            </td>
            <td style="padding: 10px 6px; text-align: center;">${statusHtml}</td>
            <td style="padding: 10px 6px; text-align: right; white-space: nowrap;">
                ${switchBtn}
                <button type="button" class="bees-btn bees-btn-secondary" style="width: 32px; height: 32px; padding: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 6px; margin-right: 4px; font-size: 14px;" onclick="openEditLocalModal(${loc.id})" title="Editar Sede">✏️</button>
                <button type="button" class="bees-btn bees-btn-danger" style="width: 32px; height: 32px; padding: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 6px; font-size: 14px;" onclick="handleDeleteLocal(${loc.id})" title="Eliminar Sede">🗑️</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function openCreateLocalModal() {
    const modal = document.getElementById('local-crud-modal');
    if (!modal) return;

    document.getElementById('local-modal-title').textContent = '🏢 Nueva Sede';
    document.getElementById('local-id-field').value = '';
    document.getElementById('local-nombre').value = '';
    document.getElementById('local-slug').value = '';
    document.getElementById('local-slug').disabled = false;
    document.getElementById('local-direccion').value = '';
    document.getElementById('local-telefono').value = '';
    document.getElementById('local-hora-cierre').value = '03:00';

    modal.classList.add('active');
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
}

function openEditLocalModal(localId) {
    const modal = document.getElementById('local-crud-modal');
    if (!modal) return;

    const loc = allLocalesSettings.find(l => l.id == localId);
    if (!loc) return;

    document.getElementById('local-modal-title').textContent = '✏️ Editar Sede';
    document.getElementById('local-id-field').value = loc.id;
    document.getElementById('local-nombre').value = loc.nombre;
    document.getElementById('local-slug').value = loc.slug;
    document.getElementById('local-slug').disabled = false;
    document.getElementById('local-direccion').value = loc.direccion || '';
    document.getElementById('local-telefono').value = loc.telefono || '';
    document.getElementById('local-hora-cierre').value = loc.hora_cierre || '03:00';

    modal.classList.add('active');
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
}

function closeLocalModal() {
    const modal = document.getElementById('local-crud-modal');
    if (modal) {
        modal.classList.remove('active');
        modal.classList.add('hidden');
        modal.style.display = 'none';
    }
}

async function handleSaveLocal(e) {
    e.preventDefault();
    const localId = document.getElementById('local-id-field').value;
    const nombre = document.getElementById('local-nombre').value.trim();
    const slug = document.getElementById('local-slug').value.trim().toLowerCase();
    const direccion = document.getElementById('local-direccion').value.trim();
    const telefono = document.getElementById('local-telefono').value.trim();
    const hora_cierre = document.getElementById('local-hora-cierre').value;

    if (!nombre || !slug) {
        showNotification('El nombre y el slug son obligatorios.', 'error');
        return;
    }

    try {
        if (!localId) {
            // Create
            const payload = {
                nombre,
                slug,
                direccion: direccion || null,
                telefono: telefono || null,
                hora_cierre: hora_cierre || "03:00"
            };
            await apiFetch('/saas/locales', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            showNotification('✅ Sede creada exitosamente.', 'success');
        } else {
            // Update
            const payload = {
                nombre,
                slug,
                direccion: direccion || null,
                telefono: telefono || null,
                hora_cierre: hora_cierre || "03:00"
            };
            try {
                await apiFetch(`/saas/locales/${localId}`, {
                    method: 'PUT',
                    body: JSON.stringify(payload)
                });
            } catch (putErr) {
                if (putErr.message && (putErr.message.includes('405') || putErr.message.includes('Method Not Allowed'))) {
                    await apiFetch(`/saas/locales/${localId}/update`, {
                        method: 'POST',
                        body: JSON.stringify(payload)
                    });
                } else {
                    throw putErr;
                }
            }
            showNotification('✅ Sede actualizada exitosamente.', 'success');
        }

        closeLocalModal();
        loadLocalesSettingsList();

        // Actualizar el selector global de la barra superior si existe
        if (typeof setupOwnerLocalSelector === 'function') {
            setupOwnerLocalSelector();
        }
    } catch (err) {
        showNotification(`Error: ${err.message}`, 'error');
    }
}

async function handleDeleteLocal(localId) {
    if (!confirm('⚠️ ¿Estás seguro de eliminar esta sede? Se borrarán sus mesas, productos y accesos asociados.')) {
        return;
    }

    try {
        try {
            await apiFetch(`/saas/locales/${localId}`, {
                method: 'DELETE'
            });
        } catch (delErr) {
            if (delErr.message && (delErr.message.includes('405') || delErr.message.includes('Method Not Allowed'))) {
                await apiFetch(`/saas/locales/${localId}/delete`, {
                    method: 'POST'
                });
            } else {
                throw delErr;
            }
        }
        showNotification('✅ Sede eliminada correctamente.', 'success');
        loadLocalesSettingsList();

        // Si se borró la sede activa, refrescar selector
        if (typeof setupOwnerLocalSelector === 'function') {
            await setupOwnerLocalSelector();
            if (typeof reloadCurrentActivePage === 'function') {
                reloadCurrentActivePage();
            }
        }
    } catch (err) {
        showNotification(`Error al eliminar: ${err.message}`, 'error');
    }
}

function handleSwitchActiveLocal(localId, localNombre) {
    sessionStorage.setItem('active_local_id', localId);
    showNotification(`📍 Sede activa cambiada a: ${localNombre}`, 'info');

    // Actualizar selector global en la barra superior
    const globalSelect = document.getElementById('global-local-select');
    if (globalSelect) {
        globalSelect.value = localId;
    }

    // Recargar tabla de settings para reflejar badge de sede activa
    renderLocalesSettingsList(allLocalesSettings);
    loadEmployeesList();
}

