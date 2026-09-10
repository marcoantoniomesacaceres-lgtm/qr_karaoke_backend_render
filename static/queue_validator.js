/**
 * Queue Validator - Herramienta visual para diagnosticar problemas de cola
 * 
 * Muestra:
 * - Exactamente QUÉ va a reproducir
 * - Comparación UI vs realidad
 * - Canciones escondidas
 * - Estado actual
 */

class QueueValidator {
  constructor() {
    this.debugVisible = false;
    this.lastDebugReport = null;
    window.queueValidator = this; // Asegurar referencia global inmediata
    this.initDebugPanel();
  }

  /**
   * Crea un botón de debug estático y lo inyecta en un contenedor
   */
  createStaticDebugButton(container) {
    if (!container) return;

    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'queue-debug-toggle';
    toggleBtn.textContent = '🔍 DEBUG COLA';
    toggleBtn.className = 'bees-btn bees-btn-success'; // Usar clases de BEES
    toggleBtn.style.width = '100%';
    toggleBtn.style.marginTop = '10px';
    toggleBtn.style.padding = '12px';

    toggleBtn.onclick = () => this.toggleDebugPanel();
    container.appendChild(toggleBtn);
  }

  /**
   * Inicializa el panel de debug
   */
  initDebugPanel() {
    // Crear elemento si no existe
    if (!document.getElementById('queue-debug-panel')) {
      const panel = document.createElement('div');
      panel.id = 'queue-debug-panel';

      panel.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 400px;
        max-height: 85vh;
        background: #1a1a1a;
        border: 2px solid #00ff00;
        border-radius: 8px;
        padding: 12px;
        font-family: monospace;
        font-size: 11px;
        color: #00ff00;
        z-index: 10000;
        overflow-y: auto;
        display: none;
        box-shadow: 0 0 20px rgba(0,255,0,0.4);
      `;
      document.body.appendChild(panel);
    }

    // Atajo de teclado: Ctrl+Shift+Q
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'Q') {
        this.toggleDebugPanel();
        e.preventDefault();
      }
    });
  }

  /**
   * Abre/cierra el panel de debug
   */
  toggleDebugPanel() {
    const panel = document.getElementById('queue-debug-panel');
    this.debugVisible = !this.debugVisible;
    panel.style.display = this.debugVisible ? 'block' : 'none';
    if (this.debugVisible) {
      this.refreshDebugReport();
    }
  }

  /**
   * Obtiene y muestra el reporte completo de debug para la sede seleccionada
   */
  async refreshDebugReport() {
    const btn = document.getElementById('debug-btn-refresh');
    if (btn) btn.textContent = '⏳ ACTUALIZANDO...';

    const localId = localStorage.getItem('selectedLocalId') || 1;

    try {
      const report = await apiFetch(`/admin/queue/debug?local_id=${localId}`);
      this.lastDebugReport = report;
      this.renderDebugReport(report);
    } catch (error) {
      console.error('Error fetching debug report:', error);
      this.updatePanel(`❌ Error obteniendo reporte: ${error.message}`);
    }
  }

  /**
   * Renderiza el reporte en el panel
   */
  renderDebugReport(report) {
    const panel = document.getElementById('queue-debug-panel');
    let html = '';

    // ========== TÍTULO Y SEDE ==========
    const localLabel = report.local_nombre || `Sede #${report.local_id || 1}`;
    html += '<h3 style="color:#00ff00; margin-top:0; margin-bottom: 4px;">🔍 QUEUE DEBUG REPORT</h3>';
    html += `<div style="background: rgba(0, 255, 255, 0.15); border: 1px solid #00ffff; color: #00ffff; padding: 4px 8px; border-radius: 4px; font-weight: bold; margin-bottom: 6px;">📍 SEDE: ${localLabel}</div>`;
    html += `<div style="color:#ff6600; margin-bottom:10px;">⏱ ${new Date(report.timestamp).toLocaleTimeString()}</div>`;

    // ========== QUÉ VA A REPRODUCIR ==========
    const playing = report.what_will_play;
    html += '<div style="border-bottom:1px solid #00ff00; padding-bottom:8px; margin-bottom:8px;">';
    html += '<h4 style="color:#ffff00; margin: 4px 0;">🎵 QUÉ VA A REPRODUCIR:</h4>';

    if (playing.status === 'empty') {
      html += '<span style="color:#ff0000;">❌ COLA VACÍA EN ESTA SEDE</span>';
    } else if (playing.status === 'waiting_for_approval') {
      html += `<span style="color:#ffaa00;">⏳ ESPERANDO APROBACIÓN</span><br/>`;
      html += `First: <strong>${playing.first_lazy_waiting ? playing.first_lazy_waiting.titulo : ''}</strong>`;
    } else if (playing.status === 'ready_to_play') {
      html += `<span style="color:#00ff00;">✓ LISTA PARA REPRODUCIR</span><br/>`;
      html += `Next: <strong>${playing.next_to_play ? playing.next_to_play.titulo : ''}</strong>`;
    } else if (playing.status === 'something_is_playing') {
      html += `<span style="color:#00aaff;">▶ REPRODUCIENDO AHORA</span><br/>`;
      html += `<strong>${playing.now_playing ? playing.now_playing.titulo : ''}</strong><br/>`;
      html += `User: ${playing.now_playing ? playing.now_playing.usuario : ''}<br/>`;
      html += `<br/><span style="color:#ffff00;">↓ SIGUIENTE:</span><br/>`;
      html += playing.next_after_current ? playing.next_after_current.titulo : '<span style="color:#ff0000;">NINGUNA</span>';
    }
    html += '</div>';

    // ========== NEXT 10 EN QUEUE ==========
    html += '<div style="border-bottom:1px solid #00ff00; padding-bottom:8px; margin-bottom:8px;">';
    html += '<h4 style="color:#ffff00; margin: 4px 0;">📋 PRÓXIMAS EN COLA (SEDE):</h4>';
    if (playing.next_20_in_queue && playing.next_20_in_queue.length > 0) {
      html += '<table style="width:100%; font-size:10px;">';
      playing.next_20_in_queue.slice(0, 10).forEach((song, idx) => {
        html += `<tr><td style="color:#00ff00; width:25px;">#${idx + 1}</td><td>${(song.titulo || '').substring(0, 25)}</td><td style="color:#aaa; text-align:right;">${song.usuario || ''}</td></tr>`;
      });
      html += '</table>';
    } else {
      html += '<span style="color:#ff0000;">NINGUNA</span>';
    }
    html += '</div>';

    // ========== INTEGRIDAD ==========
    const checks = report.integrity_checks;
    html += '<div style="border-bottom:1px solid #00ff00; padding-bottom:8px; margin-bottom:8px;">';
    html += '<h4 style="color:#ffff00; margin: 4px 0;">✓ INTEGRIDAD:</h4>';
    html += `<div style="color:${checks.now_playing_not_in_approved ? '#00ff00' : '#ff0000'};">${checks.now_playing_not_in_approved ? '✓' : '❌'} now_playing no en approved</div>`;
    html += `<div style="color:${checks.no_duplicates ? '#00ff00' : '#ff0000'};">${checks.no_duplicates ? '✓' : '❌'} Sin duplicados</div>`;
    html += `<div style="color:${checks.all_approved_have_correct_status ? '#00ff00' : '#ff0000'};">${checks.all_approved_have_correct_status ? '✓' : '❌'} States correctos</div>`;
    html += '</div>';

    // ========== ESTADÍSTICAS BD ==========
    const db = report.database_state;
    html += '<div style="border-bottom:1px solid #00ff00; padding-bottom:8px;">';
    html += '<h4 style="color:#ffff00; margin: 4px 0;">📊 ESTADO COLA DE SEDE:</h4>';
    html += `Reproduciendo: <strong>${db.reproduciendo_count}</strong> | Aprobadas: <strong style="color:#00ff00;">${db.aprobado_count}</strong> | Lazy: <strong>${db.pendiente_lazy_count}</strong>`;
    html += '</div>';

    // ========== BOTONES ==========
    html += `
      <div style="margin-top:12px; display: flex; flex-direction: column; gap: 8px;">
        <button id="debug-btn-refresh" style="padding:10px; background:#00ff00; color:#000; border:none; border-radius:4px; font-weight:bold; cursor:pointer;">🔄 REFRESCAR</button>
        <button id="debug-btn-compare" style="padding:10px; background:#00aaff; color:#000; border:none; border-radius:4px; font-weight:bold; cursor:pointer;">🔎 COMPARAR UI vs REALIDAD</button>
        <button id="debug-btn-json" style="padding:10px; background:#ffaa00; color:#000; border:none; border-radius:4px; font-weight:bold; cursor:pointer;">📋 VER JSON (CONSOLA)</button>
        <button id="debug-btn-close" style="padding:6px; background:#444; color:#fff; border:none; border-radius:4px; cursor:pointer;">✖ CERRAR</button>
      </div>`;

    panel.innerHTML = html;

    // Asignar eventos programáticamente
    setTimeout(() => {
      const btnRef = document.getElementById('debug-btn-refresh');
      if (btnRef) btnRef.addEventListener('click', () => this.refreshDebugReport());
      const btnComp = document.getElementById('debug-btn-compare');
      if (btnComp) btnComp.addEventListener('click', () => this.compareUIVsReality());
      const btnJson = document.getElementById('debug-btn-json');
      if (btnJson) btnJson.addEventListener('click', () => this.showJsonPanel());
      const btnClose = document.getElementById('debug-btn-close');
      if (btnClose) btnClose.addEventListener('click', () => this.toggleDebugPanel());
    }, 10);
  }

  /**
   * Compara UI vs Realidad
   */
  async compareUIVsReality() {
    const btn = document.getElementById('debug-btn-compare');
    if (btn) btn.textContent = '⏳ COMPARANDO...';

    const localId = localStorage.getItem('selectedLocalId') || 1;
    const upcomingContainer = document.getElementById('upcoming-list');
    const nowPlayingContainer = document.getElementById('now-playing-container');
    const uiCancionesList = Array.from((upcomingContainer && upcomingContainer.querySelectorAll('[data-cancion-id]')) || []);
    const nowPlayingEl = nowPlayingContainer && nowPlayingContainer.querySelector('[data-cancion-id]');
    const uiNowPlayingId = nowPlayingEl && nowPlayingEl.dataset ? nowPlayingEl.dataset.cancionId : null;

    const uiState = {
      now_playing: uiNowPlayingId ? { id: parseInt(uiNowPlayingId) } : null,
      upcoming: uiCancionesList.map(el => ({ id: parseInt(el.dataset.cancionId), titulo: el.textContent }))
    };

    try {
      const comparison = await apiFetch(`/admin/queue/compare-ui-vs-reality?local_id=${localId}`, {
        method: 'POST',
        body: JSON.stringify(uiState)
      });
      this.renderComparisonReport(comparison);
    } catch (error) {
      console.error('Error comparing:', error);
      this.updatePanel(`❌ Error en comparación: ${error.message}`);
    }
  }

  /**
   * Renderiza reporte de comparación
   */
  renderComparisonReport(comparison) {
    const panel = document.getElementById('queue-debug-panel');
    let html = '<h3 style="color:#00aaff; margin-top:0;">🔎 COMPARACIÓN UI vs BD</h3>';

    // Sincronización
    const isSync = comparison.summary.is_synchronized;
    html += `<div style="padding:10px; background:${isSync ? 'rgba(0,255,0,0.1)' : 'rgba(255,0,0,0.1)'}; color:${isSync ? '#00ff00' : '#ff0000'}; border:1px solid; border-radius:4px; margin-bottom:12px; font-weight:bold; text-align:center;">
      ${isSync ? '✓ TODO SINCRONIZADO' : '❌ DESINCRONIZADO'}
    </div>`;

    // Detalles
    html += `<div style="margin-bottom:12px;">`;
    html += `<div style="color:#00aaff;">UI Muestra: ${comparison.ui_state.upcoming_count} temas</div>`;
    html += `<div style="color:#00ff00;">BD Realidad: ${comparison.reality_state.upcoming_count} temas</div>`;
    html += `</div>`;

    // Discrepancias
    if (comparison.discrepancies.length > 0) {
      html += '<div style="border:1px solid #ff0000; padding:8px; margin-bottom:12px;">';
      html += `<h4 style="color:#ff0000; margin:0 0 8px 0;">⚠ DISCREPANCIAS (${comparison.discrepancies.length})</h4>`;
      comparison.discrepancies.forEach(d => {
        html += `<div style="margin-bottom:8px; border-left:2px solid; padding-left:6px; border-color:${d.severity === 'CRITICAL' ? '#ff0000' : '#ffaa00'};">`;
        html += `<strong>[${d.type}]</strong> ${d.message}`;
        if (d.type === 'hidden_songs' && d.hidden_songs_details) {
          d.hidden_songs_details.slice(0, 3).forEach(s => html += `<div style="font-size:9px; color:#aaa;">▪ ID ${s.id}: ${s.titulo}</div>`);
        }
        html += `</div>`;
      });
      html += '</div>';
    }

    html += `<button id="debug-btn-back" style="width:100%; padding:10px; background:#444; color:#fff; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">← VOLVER AL REPORTE</button>`;

    panel.innerHTML = html;

    setTimeout(() => {
      const btnBack = document.getElementById('debug-btn-back');
      if (btnBack) btnBack.addEventListener('click', () => this.refreshDebugReport());
    }, 10);
  }

  /**
   * Muestra el JSON del reporte dentro del panel (visible para el usuario)
   */
  showJsonPanel() {
    const panel = document.getElementById('queue-debug-panel');
    if (!this.lastDebugReport) {
      panel.innerHTML = `
        <h3 style="color:#ff0000; margin-top:0;">⚠ Sin datos</h3>
        <p>Primero presiona REFRESCAR para cargar el reporte.</p>
        <button id="debug-btn-json-back" style="width:100%; padding:10px; background:#444; color:#fff; border:none; border-radius:4px; cursor:pointer;">← VOLVER</button>
      `;
      setTimeout(() => {
        const btnJBack = document.getElementById('debug-btn-json-back');
        if (btnJBack) btnJBack.addEventListener('click', () => this.refreshDebugReport());
      }, 10);
      return;
    }

    const jsonStr = JSON.stringify(this.lastDebugReport, null, 2);
    panel.innerHTML = `
      <h3 style="color:#ffaa00; margin-top:0;">📋 DEBUG JSON COMPLETO</h3>
      <div style="display:flex; gap:6px; margin-bottom:8px;">
        <button id="debug-btn-json-copy" style="flex:1; padding:8px; background:#ffaa00; color:#000; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">📋 COPIAR</button>
        <button id="debug-btn-json-back" style="flex:1; padding:8px; background:#444; color:#fff; border:none; border-radius:4px; cursor:pointer;">← VOLVER</button>
      </div>
      <pre style="
        white-space: pre-wrap;
        word-break: break-all;
        font-size: 10px;
        color: #00ff00;
        background: #000;
        padding: 10px;
        border-radius: 4px;
        border: 1px solid #333;
        max-height: 60vh;
        overflow-y: auto;
        margin: 0;
      ">${jsonStr}</pre>
    `;
    setTimeout(() => {
      const btnJBack = document.getElementById('debug-btn-json-back');
      if (btnJBack) btnJBack.addEventListener('click', () => this.refreshDebugReport());
      const btnJCopy = document.getElementById('debug-btn-json-copy');
      if (btnJCopy) {
        btnJCopy.addEventListener('click', () => {
          navigator.clipboard.writeText(jsonStr).then(() => {
            const btn = document.getElementById('debug-btn-json-copy');
            if (btn) { btn.textContent = '✓ COPIADO!'; setTimeout(() => { if (btn) btn.textContent = '📋 COPIAR'; }, 2000); }
          }).catch(() => {
            // Fallback para navegadores sin clipboard API
            const ta = document.createElement('textarea');
            ta.value = jsonStr;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            const btn = document.getElementById('debug-btn-json-copy');
            if (btn) { btn.textContent = '✓ COPIADO!'; setTimeout(() => { if (btn) btn.textContent = '📋 COPIAR'; }, 2000); }
          });
        });
      }
    }, 10);
  }

  updatePanel(text) {
    const panel = document.getElementById('queue-debug-panel');
    panel.innerHTML = `<h3 style="color:#ff0000;">ERROR</h3><pre style="white-space:pre-wrap;">${text}</pre><button id="debug-btn-err-back" style="width:100%; padding:10px; background:#444; color:#fff; border:none; border-radius:4px; cursor:pointer;">← VOLVER</button>`;
    setTimeout(() => {
      const btnErrBack = document.getElementById('debug-btn-err-back');
      if (btnErrBack) btnErrBack.addEventListener('click', () => this.refreshDebugReport());
    }, 10);
  }

  startMonitoring() { return; }
}

// Instanciar
new QueueValidator();
