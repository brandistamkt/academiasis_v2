/* AcademiaSIS v2 - Frontend */
const API = "";
const state = {
  view: "dashboard",
  period: "hoy",
  alumnoSeleccionado: null,
  inscStep: 1,
  cierre: { fechaId: null, valoracion: null, quePaso: [], asistencias: {}, consumos: {} },
};

// ============== HELPERS ==============
async function api(url, options = {}) {
  const opts = {
    headers: { "Content-Type": "application/json" },
    ...options,
  };
  if (opts.body && typeof opts.body !== "string") {
    opts.body = JSON.stringify(opts.body);
  }
  const res = await fetch(API + url, opts);
  let data;
  try { data = await res.json(); } catch { data = null; }
  if (!res.ok) {
    const msg = (data && data.error) || `Error ${res.status}`;
    toast(msg, "error");
    throw new Error(msg);
  }
  return data;
}

function toast(msg, type = "success") {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.className = `toast ${type}`;
  setTimeout(() => { t.className = "toast hidden"; }, 2500);
}

function fmtMoney(n) {
  return Number(n || 0).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(s) {
  if (!s) return "";
  return s.split("T")[0];
}

function openModal(id) { document.getElementById(id).classList.remove("hidden"); }
function closeModal(id) { document.getElementById(id).classList.add("hidden"); }

function escapeHtml(s) {
  if (s === null || s === undefined) return "";
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// ============== NAVIGATION ==============
function showView(view) {
  state.view = view;
  document.querySelectorAll(".view").forEach(v => v.classList.add("hidden"));
  document.getElementById(`view-${view}`).classList.remove("hidden");
  document.querySelectorAll(".menu-item").forEach(m => m.classList.toggle("active", m.dataset.view === view));
  document.getElementById("topbarTitle").textContent =
    document.querySelector(`.menu-item[data-view="${view}"]`).textContent;
  document.getElementById("sidebar").classList.remove("open");
  loaders[view] && loaders[view]();
}

// ============== DASHBOARD ==============
async function loadDashboard() {
  try {
    const d = await api(`/api/dashboard?period=${state.period}`);
    // Metricas
    document.getElementById("m-inscritos").textContent = d.metrics.inscritos_periodo;
    document.getElementById("m-inscritos-sub").textContent = `total acumulado: ${d.metrics.total_alumnos}`;
    document.getElementById("m-ingresos").textContent = fmtMoney(d.metrics.ingresos);
    document.getElementById("m-gastos").textContent = fmtMoney(d.metrics.gastos);
    document.getElementById("m-utilidad").textContent = fmtMoney(d.metrics.utilidad);
    document.getElementById("m-margen").textContent = d.metrics.margen;

    // Alertas
    const alerts = [];
    if (d.alertas.stock_critico > 0) alerts.push(`<span>⚠ <strong>${d.alertas.stock_critico}</strong> insumos en stock critico</span>`);
    if (d.alertas.pagos_pendientes > 0) alerts.push(`<span>💳 <strong>${d.alertas.pagos_pendientes}</strong> pagos pendientes</span>`);
    if (d.alertas.talleres_mañana > 0) alerts.push(`<span>📅 <strong>${d.alertas.talleres_mañana}</strong> talleres mañana</span>`);
    const ab = document.getElementById("alertBar");
    if (alerts.length) { ab.innerHTML = alerts.join(""); ab.classList.remove("hidden"); }
    else { ab.classList.add("hidden"); }

    // Grafica 7 dias
    const chart = document.getElementById("chart-bars");
    const max = Math.max(1, ...d.chart.flatMap(x => [x.ingresos, x.gastos]));
    chart.innerHTML = d.chart.map(x => {
      const hi = (x.ingresos / max) * 100;
      const hg = (x.gastos / max) * 100;
      const dia = x.fecha.slice(5);
      return `<div class="chart-bar-group">
        <div class="chart-bar-stack">
          <div class="chart-bar ingreso" style="height:${hi}%" title="Ingresos S/ ${fmtMoney(x.ingresos)}"></div>
          <div class="chart-bar gasto" style="height:${hg}%" title="Gastos S/ ${fmtMoney(x.gastos)}"></div>
        </div>
        <div class="chart-label">${dia}</div>
      </div>`;
    }).join("");

    // Top cursos
    document.getElementById("top-cursos").innerHTML = (d.top_cursos || []).map(c => `
      <tr>
        <td>${escapeHtml(c.taller)}</td>
        <td>${c.inscritos}</td>
        <td>S/ ${fmtMoney(c.ingresos)}</td>
        <td>${c.asistencias || 0}</td>
        <td>S/ ${fmtMoney(c.ticket)}</td>
      </tr>`).join("") || `<tr><td colspan="5" class="muted">Sin datos</td></tr>`;

    // Fuentes
    document.getElementById("fuentes-list").innerHTML = (d.fuentes || []).map(f => `
      <div class="fuente-row">
        <div class="fuente-row-name">${escapeHtml(f.fuente || "Otro")}</div>
        <div class="fuente-row-bar"><div class="fuente-row-fill" style="width:${f.porcentaje}%"></div></div>
        <div class="fuente-row-pct">${f.porcentaje}%</div>
      </div>`).join("") || `<p class="muted">Sin datos</p>`;

    // Ring retorno
    const r = d.tasa_retorno || 0;
    const c = 364;
    document.getElementById("ring-circle").setAttribute("stroke-dashoffset", c - (c * r / 100));
    document.getElementById("ring-text").textContent = `${r}%`;

    // Stock critico
    document.getElementById("stock-critico-list").innerHTML = (d.stock_critico || []).map(s => `
      <div class="spinner-row">
        <div>
          <div class="spinner-row-name">${escapeHtml(s.nombre)}</div>
          <div class="spinner-row-info">${s.stock_actual} ${s.unidad} (min: ${s.stock_minimo})</div>
        </div>
        <span class="chip chip-danger">Critico</span>
      </div>`).join("") || `<p class="muted">Todo OK</p>`;

    // Proximos
    document.getElementById("proximos-list").innerHTML = (d.proximos || []).map(p => `
      <tr>
        <td>${fmtDate(p.fecha)}</td>
        <td>${escapeHtml(p.turno)}</td>
        <td>${escapeHtml(p.taller)}</td>
        <td>${escapeHtml(p.sede || "-")}</td>
        <td>${escapeHtml(p.profesor || "-")}</td>
        <td>${p.inscritos}/${p.cupo}</td>
        <td><span class="chip chip-${p.estado === 'activa' ? 'ok' : 'gray'}">${p.estado}</span></td>
      </tr>`).join("") || `<tr><td colspan="7" class="muted">Sin proximos</td></tr>`;

    // Insc por taller
    document.getElementById("insc-taller-list").innerHTML = (d.insc_por_taller || []).map(i => {
      const pct = i.cupo ? Math.min(100, (i.inscritos * 100 / i.cupo)) : 0;
      return `<tr>
        <td>${escapeHtml(i.taller)}</td>
        <td>${fmtDate(i.fecha)}</td>
        <td>${escapeHtml(i.turno)}</td>
        <td>${i.inscritos}/${i.cupo}</td>
        <td>${i.asistencias || 0}</td>
        <td><div class="progress-bar"><div class="progress-bar-fill" style="width:${pct}%"></div></div></td>
      </tr>`;
    }).join("") || `<tr><td colspan="6" class="muted">Sin datos</td></tr>`;

    // Reprogramados
    const rep = d.reprogramados || [];
    document.getElementById("rep-count").textContent = rep.length;
    document.getElementById("reprogramados-list").innerHTML = rep.length ? rep.map(r => `
      <div class="spinner-row">
        <div>
          <div class="spinner-row-name">${escapeHtml(r.nombre)} (${escapeHtml(r.dni)})</div>
          <div class="spinner-row-info">${escapeHtml(r.taller)} - ${fmtDate(r.fecha)}</div>
        </div>
        <span class="chip chip-warn">Reprogramo</span>
      </div>`).join("") : `<p class="muted">Sin reprogramados</p>`;

    // Seguimientos
    document.getElementById("seguimientos-list").innerHTML = (d.seguimientos || []).map(s => {
      const saldo = (s.monto_total || 0) - (s.monto_pagado || 0);
      return `<div class="spinner-row">
        <div>
          <div class="spinner-row-name">${escapeHtml(s.nombre)}</div>
          <div class="spinner-row-info">${escapeHtml(s.taller)} - ${fmtDate(s.fecha)} - Saldo: S/ ${fmtMoney(saldo)}</div>
        </div>
        <div>
          <span class="chip chip-${s.estado_pago === 'Pagado' ? 'ok' : 'warn'}">${s.estado_pago}</span>
          <button class="btn-icon" onclick="quickPay(${s.id})" title="Marcar pagado">💰</button>
        </div>
      </div>`;
    }).join("") || `<p class="muted">Sin pendientes</p>`;
  } catch (e) { console.error(e); }
}

async function quickPay(iid) {
  if (!confirm("Marcar pagado completo?")) return;
  try {
    // Get inscription full info
    const all = await api(`/api/inscripciones`);
    const i = all.find(x => x.id === iid);
    if (!i) return;
    await api(`/api/inscripciones/${iid}`, {
      method: "PUT",
      body: { monto_total: i.monto_total, monto_pagado: i.monto_total, metodo_pago: i.metodo_pago, asistencia: i.asistencia, notas: i.notas },
    });
    toast("Marcado pagado");
    loadDashboard();
  } catch (e) {}
}

// ============== ALUMNOS ==============
async function loadAlumnos() {
  const q = document.getElementById("alumno-search").value;
  const rows = await api(`/api/alumnos?q=${encodeURIComponent(q)}`);
  document.getElementById("alumnos-list").innerHTML = rows.map(a => `
    <tr>
      <td><a href="#" onclick="verPerfil(${a.id});return false">${escapeHtml(a.nombre)}</a></td>
      <td>${escapeHtml(a.dni)}</td>
      <td>${escapeHtml(a.telefono || "-")}</td>
      <td><span class="chip chip-blue">${escapeHtml(a.fuente || "Otro")}</span></td>
      <td>${a.total_talleres || 0}</td>
      <td>${fmtDate(a.ultimo_taller) || "-"}</td>
      <td>
        <button class="btn-icon" onclick="verPerfil(${a.id})">👁</button>
        <button class="btn-icon" onclick="editAlumno(${a.id})">✏</button>
        <button class="btn-icon" onclick="deleteAlumno(${a.id})">🗑</button>
      </td>
    </tr>`).join("") || `<tr><td colspan="7" class="muted">Sin alumnos</td></tr>`;
}

async function verPerfil(id) {
  const d = await api(`/api/alumnos/${id}`);
  document.getElementById("perfil-nombre").textContent = d.alumno.nombre;
  const stats = d.stats || {};
  document.getElementById("perfil-body").innerHTML = `
    <div class="grid-2" style="margin-bottom:16px">
      <div>
        <h3>Datos personales</h3>
        <p><strong>DNI:</strong> ${escapeHtml(d.alumno.dni)}</p>
        <p><strong>Correo:</strong> ${escapeHtml(d.alumno.correo || "-")}</p>
        <p><strong>Telefono:</strong> ${escapeHtml(d.alumno.telefono || "-")}</p>
        <p><strong>Edad:</strong> ${d.alumno.edad || "-"}</p>
        <p><strong>Profesion:</strong> ${escapeHtml(d.alumno.profesion || "-")}</p>
        <p><strong>Fuente:</strong> ${escapeHtml(d.alumno.fuente || "-")}</p>
      </div>
      <div>
        <h3>Estadisticas</h3>
        <p><strong>Total talleres:</strong> ${stats.total || 0}</p>
        <p><strong>Total pagado:</strong> S/ ${fmtMoney(stats.pagado)}</p>
        <p><strong>Saldo pendiente:</strong> S/ ${fmtMoney(stats.saldo)}</p>
        <p><strong>Asistencias:</strong> ${stats.asistencias || 0}</p>
        <p><strong>Tasa retorno:</strong> ${stats.total > 1 ? "Recurrente" : "Nuevo"}</p>
      </div>
    </div>
    <h3>Anotaciones</h3>
    <p>${escapeHtml(d.alumno.notas || "Sin anotaciones")}</p>
    <h3 style="margin-top:14px">Historial</h3>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Fecha</th><th>Taller</th><th>Turno</th><th>Sede</th><th>Pago</th><th>Asistencia</th><th>Saldo</th></tr></thead>
        <tbody>
        ${d.historial.map(h => `
          <tr>
            <td>${fmtDate(h.fecha)}</td>
            <td>${escapeHtml(h.taller)}</td>
            <td>${escapeHtml(h.turno)}</td>
            <td>${escapeHtml(h.sede || "-")}</td>
            <td><span class="chip chip-${h.estado_pago === 'Pagado' ? 'ok' : 'warn'}">${h.estado_pago}</span></td>
            <td>${escapeHtml(h.asistencia)}</td>
            <td>S/ ${fmtMoney((h.monto_total||0)-(h.monto_pagado||0))}</td>
          </tr>`).join("") || `<tr><td colspan="7" class="muted">Sin historial</td></tr>`}
        </tbody>
      </table>
    </div>
  `;
  openModal("modal-perfil-alumno");
}

async function editAlumno(id) {
  const d = await api(`/api/alumnos/${id}`);
  const a = d.alumno;
  const f = document.getElementById("form-alumno");
  f.id.value = a.id;
  f.nombre.value = a.nombre || "";
  f.dni.value = a.dni || "";
  f.correo.value = a.correo || "";
  f.telefono.value = a.telefono || "";
  f.edad.value = a.edad || "";
  f.profesion.value = a.profesion || "";
  f.notas.value = a.notas || "";
  if (a.fuente) {
    const r = f.querySelector(`input[name=fuente][value="${a.fuente}"]`);
    if (r) r.checked = true;
  }
  document.getElementById("alumno-modal-title").textContent = "Editar Alumno";
  openModal("modal-alumno");
}

async function deleteAlumno(id) {
  if (!confirm("Eliminar alumno?")) return;
  await api(`/api/alumnos/${id}`, { method: "DELETE" });
  toast("Alumno eliminado");
  loadAlumnos();
}

document.getElementById("form-alumno").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target;
  const data = {
    nombre: f.nombre.value,
    dni: f.dni.value,
    correo: f.correo.value,
    telefono: f.telefono.value,
    edad: f.edad.value || null,
    profesion: f.profesion.value,
    fuente: f.querySelector("input[name=fuente]:checked")?.value || "Otro",
    notas: f.notas.value,
  };
  try {
    if (f.id.value) {
      await api(`/api/alumnos/${f.id.value}`, { method: "PUT", body: data });
      toast("Alumno actualizado");
    } else {
      await api("/api/alumnos", { method: "POST", body: data });
      toast("Alumno creado");
    }
    closeModal("modal-alumno");
    f.reset();
    f.id.value = "";
    document.getElementById("alumno-modal-title").textContent = "Nuevo Alumno";
    loadAlumnos();
  } catch (e) {}
});

document.getElementById("alumno-search").addEventListener("input", debounce(loadAlumnos, 300));

function debounce(fn, ms) {
  let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// ============== TALLERES & SEDES & FECHAS ==============
async function loadTalleres() {
  const [tals, sedes, fechas] = await Promise.all([
    api("/api/talleres"), api("/api/sedes"), api("/api/fechas"),
  ]);

  document.getElementById("talleres-list").innerHTML = tals.map(t => `
    <tr>
      <td>${escapeHtml(t.nombre)}</td>
      <td>${t.duracion_dias}</td>
      <td>S/ ${fmtMoney(t.precio_base)}</td>
      <td><button class="btn-icon" onclick="deleteTaller(${t.id})">🗑</button></td>
    </tr>`).join("") || `<tr><td colspan="4" class="muted">Sin talleres</td></tr>`;

  document.getElementById("sedes-list").innerHTML = sedes.map(s => `
    <tr>
      <td>${escapeHtml(s.nombre)}</td>
      <td>${escapeHtml(s.direccion || "-")}</td>
      <td><button class="btn-icon" onclick="deleteSede(${s.id})">🗑</button></td>
    </tr>`).join("") || `<tr><td colspan="3" class="muted">Sin sedes</td></tr>`;

  // Selects taller
  const opts = `<option value="">Todos</option>` + tals.map(t => `<option value="${t.id}">${escapeHtml(t.nombre)}</option>`).join("");
  document.getElementById("filtro-fecha-taller").innerHTML = opts;
  document.getElementById("fecha-taller-sel").innerHTML = tals.map(t => `<option value="${t.id}">${escapeHtml(t.nombre)}</option>`).join("");
  document.getElementById("fecha-sede-sel").innerHTML = `<option value="">--</option>` + sedes.map(s => `<option value="${s.id}">${escapeHtml(s.nombre)}</option>`).join("");

  renderFechas(fechas);
}

function renderFechas(fechas) {
  document.getElementById("fechas-list").innerHTML = fechas.map(f => `
    <tr>
      <td>${escapeHtml(f.taller)}</td>
      <td>${fmtDate(f.fecha)}</td>
      <td>${escapeHtml(f.turno)}</td>
      <td>${escapeHtml(f.sede || "-")}</td>
      <td>${escapeHtml(f.profesor || "-")}</td>
      <td>${f.inscritos}/${f.cupo}</td>
      <td>S/ ${fmtMoney(f.ingresos)}</td>
      <td><span class="chip chip-${f.estado === 'activa' ? 'ok' : 'gray'}">${f.estado}</span></td>
      <td>
        ${f.estado === 'activa' ? `<button class="btn btn-secondary btn-sm" onclick="abrirCierre(${f.id})">Cerrar</button>` : ''}
        <button class="btn-icon" onclick="deleteFecha(${f.id})">🗑</button>
      </td>
    </tr>`).join("") || `<tr><td colspan="9" class="muted">Sin fechas programadas</td></tr>`;
}

document.getElementById("filtro-fecha-taller").addEventListener("change", async (e) => {
  const v = e.target.value;
  const url = v ? `/api/fechas?taller_id=${v}` : `/api/fechas`;
  const fechas = await api(url);
  renderFechas(fechas);
});

document.getElementById("form-taller").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target;
  await api("/api/talleres", { method: "POST", body: {
    nombre: f.nombre.value,
    duracion_dias: parseInt(f.duracion_dias.value) || 1,
    precio_base: parseFloat(f.precio_base.value) || 0,
    descripcion: f.descripcion.value,
  }});
  toast("Taller creado");
  closeModal("modal-taller"); f.reset(); loadTalleres();
});

document.getElementById("form-sede").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target;
  await api("/api/sedes", { method: "POST", body: { nombre: f.nombre.value, direccion: f.direccion.value }});
  toast("Sede creada");
  closeModal("modal-sede"); f.reset(); loadTalleres();
});

document.getElementById("form-fecha").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target;
  await api("/api/fechas", { method: "POST", body: {
    taller_id: parseInt(f.taller_id.value),
    fecha: f.fecha.value,
    turno: f.turno.value,
    sede_id: f.sede_id.value ? parseInt(f.sede_id.value) : null,
    profesor: f.profesor.value,
    cupo: parseInt(f.cupo.value) || 20,
  }});
  toast("Fecha programada");
  closeModal("modal-fecha"); f.reset(); loadTalleres();
});

async function deleteTaller(id) {
  if (!confirm("Eliminar taller? Tambien eliminara las fechas asociadas.")) return;
  await api(`/api/talleres/${id}`, { method: "DELETE" });
  toast("Eliminado"); loadTalleres();
}
async function deleteSede(id) {
  if (!confirm("Eliminar sede?")) return;
  await api(`/api/sedes/${id}`, { method: "DELETE" });
  toast("Eliminado"); loadTalleres();
}
async function deleteFecha(id) {
  if (!confirm("Eliminar fecha?")) return;
  await api(`/api/fechas/${id}`, { method: "DELETE" });
  toast("Eliminado"); loadTalleres();
}

// ============== INSCRIPCIONES ==============
async function loadInscripciones() {
  const desde = document.getElementById("filtro-insc-desde").value;
  const hasta = document.getElementById("filtro-insc-hasta").value;
  const taller = document.getElementById("filtro-insc-taller").value;
  const estado = document.getElementById("filtro-insc-estado").value;
  const params = new URLSearchParams();
  if (desde) params.set("desde", desde);
  if (hasta) params.set("hasta", hasta);
  if (taller) params.set("taller_id", taller);
  if (estado) params.set("estado", estado);

  // Llenar filtro taller
  const tals = await api("/api/talleres");
  document.getElementById("filtro-insc-taller").innerHTML =
    `<option value="">Todos</option>` + tals.map(t => `<option value="${t.id}" ${taller==t.id?'selected':''}>${escapeHtml(t.nombre)}</option>`).join("");

  const rows = await api(`/api/inscripciones?${params}`);
  document.getElementById("inscripciones-list").innerHTML = rows.map(i => `
    <tr>
      <td>${escapeHtml(i.alumno)}</td>
      <td>${escapeHtml(i.dni)}</td>
      <td>${escapeHtml(i.taller)}</td>
      <td>${fmtDate(i.fecha)}</td>
      <td>${escapeHtml(i.turno)}</td>
      <td>${escapeHtml(i.sede || "-")}</td>
      <td><span class="chip chip-${i.estado_pago === 'Pagado' ? 'ok' : 'warn'}">${i.estado_pago}</span></td>
      <td>S/ ${fmtMoney(i.monto_pagado)}/S/ ${fmtMoney(i.monto_total)}</td>
      <td>${escapeHtml(i.asistencia)}</td>
      <td>
        <button class="btn-icon" onclick="editInscripcion(${i.id})">✏</button>
        <button class="btn-icon" onclick="deleteInscripcion(${i.id})">🗑</button>
      </td>
    </tr>`).join("") || `<tr><td colspan="10" class="muted">Sin inscripciones</td></tr>`;
}

async function openInscripcionModal() {
  state.alumnoSeleccionado = null;
  state.inscStep = 1;
  document.getElementById("insc-dni").value = "";
  document.getElementById("alumno-encontrado").classList.add("hidden");
  document.getElementById("alumno-nuevo").classList.add("hidden");
  document.getElementById("insc-total").value = 0;
  document.getElementById("insc-pagado").value = 0;
  document.getElementById("insc-metodo").value = "";
  document.getElementById("insc-promo").value = "";
  document.getElementById("insc-tipo-desc").value = "";
  document.getElementById("insc-notas").value = "";
  showInscStep(1);

  const tals = await api("/api/talleres");
  document.getElementById("insc-taller").innerHTML = `<option value="">--</option>` + tals.map(t => `<option value="${t.id}" data-precio="${t.precio_base}">${escapeHtml(t.nombre)}</option>`).join("");
  document.getElementById("insc-fecha").innerHTML = `<option value="">Selecciona taller primero</option>`;
  openModal("modal-inscripcion");
}

document.getElementById("insc-taller").addEventListener("change", async (e) => {
  const tid = e.target.value;
  if (!tid) return;
  const fechas = await api(`/api/fechas?taller_id=${tid}`);
  document.getElementById("insc-fecha").innerHTML = `<option value="">--</option>` +
    fechas.filter(f => f.estado === 'activa').map(f => `<option value="${f.id}">${fmtDate(f.fecha)} - ${f.turno} - ${f.sede || ""}</option>`).join("");
  const sel = e.target.options[e.target.selectedIndex];
  const precio = parseFloat(sel.dataset.precio) || 0;
  document.getElementById("insc-total").value = precio;
});

function showInscStep(n) {
  state.inscStep = n;
  document.querySelectorAll(".step").forEach(s => s.classList.toggle("active", parseInt(s.dataset.step) === n));
  document.querySelectorAll(".step-content").forEach(s => s.classList.toggle("active", parseInt(s.dataset.content) === n));
  document.querySelectorAll(".step-content").forEach(s => s.classList.toggle("hidden", parseInt(s.dataset.content) !== n));
  document.getElementById("insc-prev").style.display = n === 1 ? "none" : "";
  document.getElementById("insc-next").style.display = n === 4 ? "none" : "";
  document.getElementById("insc-save").style.display = n === 4 ? "" : "none";
}

document.getElementById("insc-prev").addEventListener("click", () => showInscStep(Math.max(1, state.inscStep - 1)));
document.getElementById("insc-next").addEventListener("click", () => {
  if (state.inscStep === 1 && !state.alumnoSeleccionado) {
    // Crear alumno nuevo si datos
    const nombre = document.getElementById("nuevo-nombre").value;
    if (!nombre) { toast("Busca o ingresa datos del alumno", "error"); return; }
  }
  showInscStep(Math.min(4, state.inscStep + 1));
});

async function searchAlumnoByDni() {
  const dni = document.getElementById("insc-dni").value.trim();
  if (!dni) return;
  const a = await api(`/api/alumnos/buscar_dni?dni=${dni}`);
  if (a) {
    state.alumnoSeleccionado = a;
    document.getElementById("alumno-encontrado").innerHTML =
      `✓ <strong>${escapeHtml(a.nombre)}</strong> - ${escapeHtml(a.correo || "Sin correo")} - ${escapeHtml(a.telefono || "Sin tel")}`;
    document.getElementById("alumno-encontrado").classList.remove("hidden");
    document.getElementById("alumno-nuevo").classList.add("hidden");
  } else {
    state.alumnoSeleccionado = null;
    document.getElementById("alumno-encontrado").classList.add("hidden");
    document.getElementById("alumno-nuevo").classList.remove("hidden");
    toast("Alumno no existe, completa los datos");
  }
}

document.getElementById("insc-save").addEventListener("click", async () => {
  try {
    let alumnoId;
    if (state.alumnoSeleccionado) {
      alumnoId = state.alumnoSeleccionado.id;
    } else {
      // Crear nuevo
      const dni = document.getElementById("insc-dni").value.trim();
      const nombre = document.getElementById("nuevo-nombre").value.trim();
      if (!dni || !nombre) { toast("Completa nombre y DNI", "error"); return; }
      const a = await api("/api/alumnos", { method: "POST", body: {
        dni, nombre,
        correo: document.getElementById("nuevo-correo").value,
        telefono: document.getElementById("nuevo-telefono").value,
        edad: document.getElementById("nuevo-edad").value || null,
        profesion: document.getElementById("nuevo-profesion").value,
        fuente: document.getElementById("nuevo-fuente").value,
      }});
      alumnoId = a.id;
    }
    const fechaId = parseInt(document.getElementById("insc-fecha").value);
    if (!fechaId) { toast("Selecciona una fecha", "error"); return; }
    await api("/api/inscripciones", { method: "POST", body: {
      alumno_id: alumnoId,
      fecha_id: fechaId,
      monto_total: parseFloat(document.getElementById("insc-total").value) || 0,
      monto_pagado: parseFloat(document.getElementById("insc-pagado").value) || 0,
      metodo_pago: document.getElementById("insc-metodo").value,
      promocion: document.getElementById("insc-promo").value,
      tipo_descuento: document.getElementById("insc-tipo-desc").value,
      notas: document.getElementById("insc-notas").value,
    }});
    toast("Inscripcion registrada");
    closeModal("modal-inscripcion");
    loadInscripciones();
  } catch (e) {}
});

async function editInscripcion(id) {
  const list = await api(`/api/inscripciones`);
  const i = list.find(x => x.id === id);
  if (!i) return;
  const f = document.getElementById("form-edit-insc");
  f.id.value = i.id;
  f.monto_total.value = i.monto_total;
  f.monto_pagado.value = i.monto_pagado;
  f.metodo_pago.value = i.metodo_pago || "";
  f.promocion.value = i.promocion || "";
  f.tipo_descuento.value = i.tipo_descuento || "";
  f.asistencia.value = i.asistencia || "Pendiente";
  f.notas.value = i.notas || "";
  openModal("modal-edit-insc");
}

document.getElementById("form-edit-insc").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target;
  await api(`/api/inscripciones/${f.id.value}`, { method: "PUT", body: {
    monto_total: parseFloat(f.monto_total.value) || 0,
    monto_pagado: parseFloat(f.monto_pagado.value) || 0,
    metodo_pago: f.metodo_pago.value,
    promocion: f.promocion.value,
    tipo_descuento: f.tipo_descuento.value,
    asistencia: f.asistencia.value,
    notas: f.notas.value,
  }});
  toast("Actualizado");
  closeModal("modal-edit-insc");
  loadInscripciones();
});

async function deleteInscripcion(id) {
  if (!confirm("Eliminar inscripcion?")) return;
  await api(`/api/inscripciones/${id}`, { method: "DELETE" });
  toast("Eliminado"); loadInscripciones();
}

// ============== CIERRE DE CLASE ==============
async function abrirCierre(fid) {
  const d = await api(`/api/fechas/${fid}/detalle`);
  state.cierre = { fechaId: fid, valoracion: null, quePaso: [], asistencias: {}, consumos: {} };
  d.inscritos.forEach(i => { state.cierre.asistencias[i.id] = i.asistencia || "Pendiente"; });
  d.insumos.forEach(i => { state.cierre.consumos[i.id] = i.consumo_clase || 0; });

  document.getElementById("cierre-title").textContent = `Cerrar: ${d.fecha.taller}`;
  const body = document.getElementById("cierre-body");
  const opciones = [
    "Todo fluyo bien", "Faltaron materiales", "Alumnos llegaron tarde",
    "Problema con el local", "Incidente con alumno", "Falto tiempo",
    "Alumnos muy participativos", "Supero expectativas",
  ];
  body.innerHTML = `
    <div class="info-box">
      <strong>${escapeHtml(d.fecha.taller)}</strong> - ${fmtDate(d.fecha.fecha)} ${escapeHtml(d.fecha.turno)}<br>
      Sede: ${escapeHtml(d.fecha.sede || '-')} | Profesor: ${escapeHtml(d.fecha.profesor || '-')} | Alumnos: ${d.inscritos.length}
    </div>

    <h3>Valoracion general</h3>
    <div class="emoji-rate" id="emoji-rate">
      <button class="emoji-btn" data-val="dificil" title="Dificil">😞</button>
      <button class="emoji-btn" data-val="regular" title="Regular">😐</button>
      <button class="emoji-btn" data-val="bien" title="Bien">🙂</button>
      <button class="emoji-btn" data-val="excelente" title="Excelente">🤩</button>
    </div>

    <h3>¿Que paso?</h3>
    <div class="chips-multi" id="chips-paso">
      ${opciones.map(o => `<button class="chip-btn" data-val="${o}">${o}</button>`).join("")}
    </div>

    <div class="grid-2">
      <label>¿Que mejorar?<textarea class="input" id="cierre-mejorar" rows="3"></textarea></label>
      <label>¿Que funciono bien?<textarea class="input" id="cierre-funciono" rows="3"></textarea></label>
    </div>

    <h3>Asistencia</h3>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Alumno</th><th>DNI</th><th>Asistencia</th></tr></thead>
        <tbody>
        ${d.inscritos.map(i => `
          <tr>
            <td>${escapeHtml(i.nombre)}</td>
            <td>${escapeHtml(i.dni)}</td>
            <td>
              <button class="btn btn-sm" data-asis="${i.id}" data-val="Asistio">✓</button>
              <button class="btn btn-sm" data-asis="${i.id}" data-val="No asistio">✗</button>
              <button class="btn btn-sm" data-asis="${i.id}" data-val="Reprogramo">⟳</button>
            </td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>

    <h3>Consumo de insumos</h3>
    <div id="consumos-list">
      ${d.insumos.map(i => {
        const restantes = i.consumo_clase > 0 ? Math.floor(i.stock_actual / i.consumo_clase) : "-";
        return `<div class="spinner-row">
          <div>
            <div class="spinner-row-name">${escapeHtml(i.nombre)} (${i.unidad})</div>
            <div class="spinner-row-info">Stock: ${i.stock_actual} ${i.unidad} - Quedan ${restantes} clases</div>
          </div>
          <div class="spinner">
            <button onclick="consumoDelta(${i.id}, -1)">-</button>
            <input type="number" id="cons-${i.id}" step="0.01" min="0" value="${i.consumo_clase}">
            <button onclick="consumoDelta(${i.id}, 1)">+</button>
          </div>
        </div>`;
      }).join("")}
    </div>

    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeModal('modal-cierre')">Cancelar</button>
      <button class="btn btn-success" onclick="guardarCierre()">Cerrar clase</button>
    </div>
  `;

  // Event listeners
  document.getElementById("emoji-rate").addEventListener("click", (e) => {
    const btn = e.target.closest(".emoji-btn");
    if (!btn) return;
    document.querySelectorAll("#emoji-rate .emoji-btn").forEach(b => b.classList.remove("selected"));
    btn.classList.add("selected");
    state.cierre.valoracion = btn.dataset.val;
  });
  document.getElementById("chips-paso").addEventListener("click", (e) => {
    const btn = e.target.closest(".chip-btn");
    if (!btn) return;
    btn.classList.toggle("selected");
    state.cierre.quePaso = [...document.querySelectorAll("#chips-paso .chip-btn.selected")].map(b => b.dataset.val);
  });
  body.querySelectorAll("button[data-asis]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = parseInt(btn.dataset.asis);
      const val = btn.dataset.val;
      state.cierre.asistencias[id] = val;
      // Highlight selected
      body.querySelectorAll(`button[data-asis="${id}"]`).forEach(b => b.classList.remove("btn-primary"));
      btn.classList.add("btn-primary");
    });
  });

  openModal("modal-cierre");
}

function consumoDelta(insumoId, delta) {
  const input = document.getElementById(`cons-${insumoId}`);
  const v = Math.max(0, (parseFloat(input.value) || 0) + delta);
  input.value = v;
  state.cierre.consumos[insumoId] = v;
}

async function guardarCierre() {
  // Capturar consumos actuales
  Object.keys(state.cierre.consumos).forEach(id => {
    const inp = document.getElementById(`cons-${id}`);
    if (inp) state.cierre.consumos[id] = parseFloat(inp.value) || 0;
  });
  const data = {
    valoracion: state.cierre.valoracion,
    que_paso: state.cierre.quePaso,
    que_mejorar: document.getElementById("cierre-mejorar").value,
    que_funciono: document.getElementById("cierre-funciono").value,
    asistencias: Object.entries(state.cierre.asistencias).map(([id, a]) => ({ id: parseInt(id), asistencia: a })),
    consumos: Object.entries(state.cierre.consumos).map(([id, c]) => ({ insumo_id: parseInt(id), cantidad: c })),
  };
  await api(`/api/fechas/${state.cierre.fechaId}/cerrar`, { method: "POST", body: data });
  toast("Clase cerrada correctamente");
  closeModal("modal-cierre");
  loadTalleres();
}

// ============== FINANZAS ==============
async function loadFinanzas() {
  const desde = document.getElementById("fin-desde").value;
  const hasta = document.getElementById("fin-hasta").value;
  const params = new URLSearchParams();
  if (desde) params.set("desde", desde);
  if (hasta) params.set("hasta", hasta);
  const [resumen, gastos] = await Promise.all([
    api(`/api/finanzas/resumen?${params}`),
    api(`/api/gastos?${params}&limit=8`),
  ]);
  document.getElementById("fin-ingresos").textContent = fmtMoney(resumen.ingresos);
  document.getElementById("fin-gastos").textContent = fmtMoney(resumen.gastos);
  document.getElementById("fin-utilidad").textContent = fmtMoney(resumen.utilidad);

  // Categorias
  const maxCat = Math.max(1, ...(resumen.por_categoria || []).map(c => c.total));
  document.getElementById("categorias-chart").innerHTML = (resumen.por_categoria || []).map(c => `
    <div class="cat-bar">
      <div class="cat-bar-name">${escapeHtml(c.categoria || 'Sin categoria')}</div>
      <div class="cat-bar-wrap"><div class="cat-bar-fill" style="width:${(c.total/maxCat)*100}%"></div></div>
      <div class="cat-bar-val">S/ ${fmtMoney(c.total)}</div>
    </div>`).join("") || `<p class="muted">Sin gastos</p>`;

  document.getElementById("descuentos-list").innerHTML = (resumen.descuentos || []).map(d => `
    <tr><td>${escapeHtml(d.promo)}</td><td>${d.usos}</td><td>S/ ${fmtMoney(d.estimado)}</td></tr>
  `).join("") || `<tr><td colspan="3" class="muted">Sin descuentos aplicados</td></tr>`;

  document.getElementById("gastos-list").innerHTML = gastos.map(g => `
    <tr>
      <td>${escapeHtml(g.descripcion)}</td>
      <td>${escapeHtml(g.categoria || "-")}</td>
      <td>S/ ${fmtMoney(g.monto)}</td>
      <td>${fmtDate(g.fecha)}</td>
      <td>${escapeHtml(g.metodo_pago || "-")}</td>
      <td>${escapeHtml(g.comprobante || "-")}</td>
      <td><button class="btn-icon" onclick="deleteGasto(${g.id})">🗑</button></td>
    </tr>`).join("") || `<tr><td colspan="7" class="muted">Sin gastos</td></tr>`;
}

document.getElementById("form-gasto").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target;
  await api("/api/gastos", { method: "POST", body: {
    descripcion: f.descripcion.value,
    categoria: f.categoria.value,
    monto: parseFloat(f.monto.value),
    fecha: f.fecha.value,
    metodo_pago: f.metodo_pago.value,
    proveedor: f.proveedor.value,
    comprobante: f.comprobante.value,
    notas: f.notas.value,
  }});
  toast("Gasto registrado");
  closeModal("modal-gasto"); f.reset(); loadFinanzas();
});

async function deleteGasto(id) {
  if (!confirm("Eliminar gasto?")) return;
  await api(`/api/gastos/${id}`, { method: "DELETE" });
  toast("Eliminado"); loadFinanzas();
}

// ============== RENTABILIDAD ==============
async function loadRentabilidad() {
  const desde = document.getElementById("rent-desde").value;
  const hasta = document.getElementById("rent-hasta").value;
  const params = new URLSearchParams();
  if (desde) params.set("desde", desde);
  if (hasta) params.set("hasta", hasta);
  const rows = await api(`/api/rentabilidad?${params}`);
  const maxIng = Math.max(1, ...rows.map(r => r.ingresos));
  document.getElementById("rentabilidad-list").innerHTML = rows.map((r, i) => `
    <tr>
      <td><strong>${i + 1}</strong></td>
      <td>${escapeHtml(r.taller)}</td>
      <td>${r.inscritos}</td>
      <td>S/ ${fmtMoney(r.ingresos)} <div class="inline-bar"><div class="inline-bar-fill" style="width:${(r.ingresos/maxIng)*100}%"></div></div></td>
      <td>S/ ${fmtMoney(r.por_cobrar)}</td>
      <td>${r.asistencias || 0}/${r.inscritos}</td>
      <td>S/ ${fmtMoney(r.ticket_promedio)}</td>
    </tr>`).join("") || `<tr><td colspan="7" class="muted">Sin datos</td></tr>`;
}

// ============== INVENTARIO ==============
async function loadInventario() {
  const rows = await api("/api/insumos");
  document.getElementById("insumos-list").innerHTML = rows.map(i => {
    const restantes = i.consumo_clase > 0 ? Math.floor(i.stock_actual / i.consumo_clase) : "-";
    let estado = "OK", chip = "chip-ok";
    if (i.stock_actual <= i.stock_minimo) { estado = "Critico"; chip = "chip-danger"; }
    else if (typeof restantes === "number" && restantes < 5) { estado = "Bajo"; chip = "chip-warn"; }
    return `<tr>
      <td>${escapeHtml(i.nombre)}</td>
      <td>${escapeHtml(i.unidad)}</td>
      <td>${i.stock_actual}</td>
      <td>${i.stock_minimo}</td>
      <td>${i.consumo_clase}</td>
      <td>${restantes}</td>
      <td><span class="chip ${chip}">${estado}</span></td>
      <td>
        <input type="number" id="add-${i.id}" placeholder="+ stock" style="width:80px;padding:4px;border:1px solid #ccc;border-radius:4px">
        <button class="btn btn-sm btn-secondary" onclick="agregarStock(${i.id})">Agregar</button>
        <button class="btn-icon" onclick="editInsumo(${i.id})">✏</button>
        <button class="btn-icon" onclick="deleteInsumo(${i.id})">🗑</button>
      </td>
    </tr>`;
  }).join("") || `<tr><td colspan="8" class="muted">Sin insumos</td></tr>`;
}

async function agregarStock(id) {
  const input = document.getElementById(`add-${id}`);
  const cantidad = parseFloat(input.value);
  if (!cantidad || cantidad <= 0) { toast("Ingresa una cantidad", "error"); return; }
  await api(`/api/insumos/${id}/agregar`, { method: "POST", body: { cantidad }});
  toast("Stock agregado");
  loadInventario();
}

async function editInsumo(id) {
  const list = await api("/api/insumos");
  const i = list.find(x => x.id === id);
  if (!i) return;
  const f = document.getElementById("form-insumo");
  f.id.value = i.id;
  f.nombre.value = i.nombre;
  f.unidad.value = i.unidad;
  f.stock_actual.value = i.stock_actual;
  f.stock_minimo.value = i.stock_minimo;
  f.consumo_clase.value = i.consumo_clase;
  f.precio_unitario.value = i.precio_unitario;
  openModal("modal-insumo");
}

async function deleteInsumo(id) {
  if (!confirm("Eliminar insumo?")) return;
  await api(`/api/insumos/${id}`, { method: "DELETE" });
  toast("Eliminado"); loadInventario();
}

document.getElementById("form-insumo").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target;
  const data = {
    nombre: f.nombre.value,
    unidad: f.unidad.value,
    stock_actual: parseFloat(f.stock_actual.value) || 0,
    stock_minimo: parseFloat(f.stock_minimo.value) || 0,
    consumo_clase: parseFloat(f.consumo_clase.value) || 0,
    precio_unitario: parseFloat(f.precio_unitario.value) || 0,
  };
  if (f.id.value) {
    await api(`/api/insumos/${f.id.value}`, { method: "PUT", body: data });
    toast("Actualizado");
  } else {
    await api("/api/insumos", { method: "POST", body: data });
    toast("Creado");
  }
  closeModal("modal-insumo"); f.reset(); f.id.value = "";
  loadInventario();
});

// ============== REPORTES ==============
function exportExcel() {
  const desde = document.getElementById("rep-desde").value;
  const hasta = document.getElementById("rep-hasta").value;
  const params = new URLSearchParams();
  if (desde) params.set("desde", desde);
  if (hasta) params.set("hasta", hasta);
  window.location.href = `/api/reportes/excel?${params}`;
  toast("Descargando Excel...");
}

// ============== LOADERS MAP ==============
const loaders = {
  dashboard: loadDashboard,
  alumnos: loadAlumnos,
  talleres: loadTalleres,
  inscripciones: loadInscripciones,
  finanzas: loadFinanzas,
  rentabilidad: loadRentabilidad,
  inventario: loadInventario,
  reportes: () => {},
};

// ============== INIT ==============
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".menu-item").forEach(m => {
    m.addEventListener("click", (e) => {
      e.preventDefault();
      showView(m.dataset.view);
    });
  });
  document.querySelectorAll(".period-btn").forEach(b => {
    b.addEventListener("click", () => {
      document.querySelectorAll(".period-btn").forEach(x => x.classList.remove("active"));
      b.classList.add("active");
      state.period = b.dataset.period;
      loadDashboard();
    });
  });
  document.getElementById("menuToggle").addEventListener("click", () => {
    document.getElementById("sidebar").classList.toggle("open");
  });

  // Reset alumno modal on close
  document.querySelectorAll('#modal-alumno .modal-close, #modal-alumno .btn-ghost').forEach(b => {
    b.addEventListener("click", () => {
      const f = document.getElementById("form-alumno");
      f.reset(); f.id.value = "";
      document.getElementById("alumno-modal-title").textContent = "Nuevo Alumno";
    });
  });

  // Set default dates for finanzas/rentabilidad/reportes
  const today = new Date().toISOString().split("T")[0];
  const monthAgo = new Date(); monthAgo.setMonth(monthAgo.getMonth() - 1);
  const monthAgoStr = monthAgo.toISOString().split("T")[0];
  ["fin-desde", "rent-desde", "rep-desde"].forEach(id => { document.getElementById(id).value = monthAgoStr; });
  ["fin-hasta", "rent-hasta", "rep-hasta"].forEach(id => { document.getElementById(id).value = today; });

  loadDashboard();
});
