/**
 * SIGREA - interfaz web operativa.
 *
 * La UI no contiene reglas de negocio: consume unicamente los endpoints
 * definidos en la especificacion de OpenSpec. Todas las reglas (duracion,
 * anticipacion, solapamiento, permisos) las aplica el servidor.
 */

const API = '/api';
const CLAVE_TOKEN = 'sigrea.token';
const CLAVE_USUARIO = 'sigrea.usuario';

const PERMISOS = {
  ESPACIOS_LEER: 'espacios:leer',
  ESPACIOS_ESCRIBIR: 'espacios:escribir',
  RESERVAS_CREAR: 'reservas:crear',
  RESERVAS_LEER: 'reservas:leer',
  RESERVAS_CANCELAR: 'reservas:cancelar',
  RESERVAS_APROBAR: 'reservas:aprobar',
  AUDITORIA_LEER: 'auditoria:leer',
};

let token = localStorage.getItem(CLAVE_TOKEN);
let usuario = JSON.parse(localStorage.getItem(CLAVE_USUARIO) ?? 'null');
let espaciosCache = [];

// ---------------------------------------------------------------------------
// Utilidades de la interfaz
// ---------------------------------------------------------------------------

function $(selector) {
  return document.querySelector(selector);
}

function mostrarMensaje(texto, tipo = 'info') {
  const elemento = $('#mensaje');
  elemento.textContent = texto;
  elemento.className = `mensaje mensaje--${tipo}`;
  elemento.hidden = false;
  window.clearTimeout(elemento.dataset['temporizador']);
  elemento.dataset['temporizador'] = String(
    window.setTimeout(() => {
      elemento.hidden = true;
    }, 6000),
  );
}

function escapar(texto) {
  const div = document.createElement('div');
  div.textContent = String(texto ?? '');
  return div.innerHTML;
}

async function api(ruta, opciones = {}) {
  const cabeceras = { 'Content-Type': 'application/json' };
  if (token !== null) {
    cabeceras['Authorization'] = `Bearer ${token}`;
  }
  const respuesta = await fetch(`${API}${ruta}`, {
    method: opciones.metodo ?? 'GET',
    headers: cabeceras,
    body: opciones.cuerpo === undefined ? undefined : JSON.stringify(opciones.cuerpo),
  });

  if (respuesta.status === 204) {
    return { ok: true, estado: 204, cuerpo: null };
  }

  const cuerpo = await respuesta.json().catch(() => null);
  if (!respuesta.ok) {
    const codigo = cuerpo?.error?.codigo ?? 'ERROR';
    const mensaje = cuerpo?.error?.mensaje ?? 'Se ha producido un error';
    const detalles = (cuerpo?.error?.detalles ?? [])
      .map((detalle) => `${detalle.campo ?? ''} ${detalle.mensaje}`.trim())
      .join('; ');
    const error = new Error(`${codigo}: ${mensaje}${detalles === '' ? '' : ` (${detalles})`}`);
    error.estado = respuesta.status;
    error.codigo = codigo;
    throw error;
  }
  return { ok: true, estado: respuesta.status, cuerpo };
}

// ---------------------------------------------------------------------------
// Sesion
// ---------------------------------------------------------------------------

async function iniciarSesion(correo, contrasena) {
  const { cuerpo } = await api('/auth/login', { metodo: 'POST', cuerpo: { email: correo, contrasena } });
  token = cuerpo.token;
  usuario = cuerpo.usuario;
  localStorage.setItem(CLAVE_TOKEN, token);
  localStorage.setItem(CLAVE_USUARIO, JSON.stringify(usuario));
  await mostrarAplicacion();
}

async function registrarUsuario(nombre, correo, contrasena) {
  const { cuerpo } = await api('/auth/registro', {
    metodo: 'POST',
    cuerpo: { nombre, email: correo, contrasena },
  });
  token = cuerpo.token;
  usuario = cuerpo.usuario;
  localStorage.setItem(CLAVE_TOKEN, token);
  localStorage.setItem(CLAVE_USUARIO, JSON.stringify(usuario));
  await mostrarAplicacion();
}

async function cerrarSesion() {
  try {
    await api('/auth/logout', { metodo: 'POST' });
  } catch {
    // Si el token ya no es valido, la sesion local se limpia igualmente.
  }
  token = null;
  usuario = null;
  localStorage.removeItem(CLAVE_TOKEN);
  localStorage.removeItem(CLAVE_USUARIO);
  $('#vista-login').hidden = false;
  $('#vista-aplicacion').hidden = true;
  $('#cabecera-sesion').hidden = true;
}

// ---------------------------------------------------------------------------
// Vistas
// ---------------------------------------------------------------------------

async function mostrarAplicacion() {
  if (token === null) {
    return;
  }
  $('#vista-login').hidden = true;
  $('#vista-aplicacion').hidden = false;
  $('#cabecera-sesion').hidden = false;
  $('#datos-sesion').textContent = `${usuario.nombre} - ${usuario.rol}`;

  const permisos = await permisosDelUsuario();
  $('#pestana-pendientes').hidden = !permisos.has(PERMISOS.RESERVAS_APROBAR);
  $('#pestana-auditoria').hidden = !permisos.has(PERMISOS.AUDITORIA_LEER);

  await cargarEspacios();
  await cambiarVista('espacios');
}

async function permisosDelUsuario() {
  try {
    const { cuerpo } = await api('/roles');
    const rol = cuerpo.datos.find((r) => r.nombre === usuario.rol);
    return new Set(rol ? rol.permisos : []);
  } catch {
    return new Set();
  }
}

function cambiarVista(nombre) {
  for (const pestana of document.querySelectorAll('.pestana')) {
    pestana.classList.toggle('pestana--activa', pestana.dataset['vista'] === nombre);
  }
  for (const panel of document.querySelectorAll('#vista-aplicacion > div')) {
    panel.hidden = panel.id !== `panel-${nombre}`;
  }
  if (nombre === 'mis-reservas') {
    void cargarMisReservas();
  }
  if (nombre === 'pendientes') {
    void cargarPendientes();
  }
  if (nombre === 'auditoria') {
    void cargarAuditoria();
  }
}

// ---------------------------------------------------------------------------
// Espacios
// ---------------------------------------------------------------------------

async function cargarEspacios() {
  const tipo = $('#filtro-tipo').value;
  const consulta = tipo === '' ? '' : `?tipo=${encodeURIComponent(tipo)}`;
  const { cuerpo } = await api(`/espacios${consulta}`);
  espaciosCache = cuerpo.datos;

  const contenedor = $('#lista-espacios');
  if (espaciosCache.length === 0) {
    contenedor.innerHTML = '<p class="vacio">No hay espacios que coincidan con el filtro.</p>';
  } else {
    contenedor.innerHTML = espaciosCache
      .map(
        (espacio) => `
        <article class="tarjeta">
          <h3>${escapar(espacio.nombre)}</h3>
          <p class="tarjeta__codigo">${escapar(espacio.codigo)}</p>
          <dl>
            <dt>Tipo</dt><dd>${escapar(espacio.tipo.replace(/_/g, ' '))}</dd>
            <dt>Capacidad</dt><dd>${escapar(espacio.capacidad)} personas</dd>
            <dt>Ubicacion</dt><dd>${escapar(espacio.edificio ?? '-')} - ${escapar(espacio.piso ?? '-')}</dd>
            <dt>Horario</dt><dd>${escapar(espacio.horarioApertura)} a ${escapar(espacio.horarioCierre)}</dd>
          </dl>
          <p class="tarjeta__estado ${espacio.activo ? 'estado--activo' : 'estado--inactivo'}">
            ${espacio.activo ? 'Activo' : 'Inactivo'}
          </p>
        </article>`,
      )
      .join('');
  }

  llenarSelectoresEspacios();
}

function llenarSelectoresEspacios() {
  const opciones = espaciosCache
    .map(
      (espacio) =>
        `<option value="${escapar(espacio.id)}">${escapar(espacio.codigo)} - ${escapar(espacio.nombre)}</option>`,
    )
    .join('');

  for (const id of ['#disponibilidad-espacio', '#reserva-espacio']) {
    const selector = $(id);
    const valorActual = selector.value;
    selector.innerHTML = opciones;
    if (valorActual !== '') {
      selector.value = valorActual;
    }
  }
}

// ---------------------------------------------------------------------------
// Disponibilidad
// ---------------------------------------------------------------------------

async function consultarDisponibilidad(espacioId, fecha) {
  const { cuerpo } = await api(`/espacios/${espacioId}/disponibilidad?fecha=${encodeURIComponent(fecha)}`);
  const { espacio, franja, ocupado, libre } = cuerpo;

  const filasOcupadas =
    ocupado.length === 0
      ? '<tr><td colspan="4" class="vacio">Sin reservas activas en esta fecha</td></tr>'
      : ocupado
          .map(
            (franja) => `
        <tr>
          <td>${escapar(franja.horaInicio)} - ${escapar(franja.horaFin)}</td>
          <td><span class="etiqueta etiqueta--${escapar(franja.estado.toLowerCase())}">${escapar(franja.estado)}</span></td>
          <td>${escapar(franja.solicitanteNombre)}</td>
          <td>#${escapar(franja.reservaId)}</td>
        </tr>`,
          )
          .join('');

  const filasLibres =
    libre.length === 0
      ? '<tr><td colspan="2" class="vacio">No quedan franjas libres en esta fecha</td></tr>'
      : libre
          .map((f) => `<tr><td>${escapar(f.horaInicio)} - ${escapar(f.horaFin)}</td><td>Libre</td></tr>`)
          .join('');

  $('#resultado-disponibilidad').innerHTML = `
    <h3>${escapar(espacio.nombre)} (${escapar(espacio.codigo)})</h3>
    <p>Horario de funcionamiento: ${escapar(franja.apertura)} a ${escapar(franja.cierre)}</p>
    <h4>Franjas ocupadas</h4>
    <table>
      <thead><tr><th>Franja</th><th>Estado</th><th>Solicitante</th><th>Reserva</th></tr></thead>
      <tbody>${filasOcupadas}</tbody>
    </table>
    <h4>Franjas libres</h4>
    <table>
      <thead><tr><th>Franja</th><th>Estado</th></tr></thead>
      <tbody>${filasLibres}</tbody>
    </table>`;
}

// ---------------------------------------------------------------------------
// Reservas
// ---------------------------------------------------------------------------

async function cargarMisReservas() {
  const { cuerpo } = await api('/reservas');
  const contenedor = $('#lista-mis-reservas');

  if (cuerpo.datos.length === 0) {
    contenedor.innerHTML = '<p class="vacio">Todavia no ha realizado ninguna reserva.</p>';
    return;
  }

  contenedor.innerHTML = `
    <table>
      <thead>
        <tr><th>Espacio</th><th>Fecha</th><th>Franja</th><th>Estado</th><th>Acciones</th></tr>
      </thead>
      <tbody>
        ${cuerpo.datos
          .map((reserva) => {
            const cancelable = reserva.estado === 'PENDIENTE' || reserva.estado === 'APROBADA';
            return `
            <tr>
              <td>${escapar(reserva.espacioCodigo)}</td>
              <td>${escapar(reserva.fecha)}</td>
              <td>${escapar(reserva.horaInicio)} - ${escapar(reserva.horaFin)}</td>
              <td><span class="etiqueta etiqueta--${escapar(reserva.estado.toLowerCase())}">${escapar(reserva.estado)}</span></td>
              <td>
                ${
                  cancelable
                    ? `<button type="button" class="boton boton--peligro" data-cancelar="${escapar(reserva.id)}">Cancelar</button>`
                    : '&mdash;'
                }
                <button type="button" class="boton boton--secundario" data-historial="${escapar(reserva.id)}">Historial</button>
              </td>
            </tr>`;
          })
          .join('')}
      </tbody>
    </table>
    <div id="detalle-historial"></div>`;
}

async function cancelarReserva(id) {
  const motivo = window.prompt('Motivo de la cancelacion (opcional)');
  if (motivo === null) {
    return;
  }
  try {
    await api(`/reservas/${id}/cancelar`, { metodo: 'POST', cuerpo: { motivo } });
    mostrarMensaje('Reserva cancelada.', 'exito');
    await cargarMisReservas();
  } catch (error) {
    mostrarMensaje(error.message, 'error');
  }
}

async function verHistorial(id) {
  try {
    const { cuerpo } = await api(`/reservas/${id}/historial`);
    const filas = cuerpo.datos
      .map(
        (evento) => `
        <tr>
          <td>${escapar(evento.tipo)}</td>
          <td>${escapar(evento.actorNombre ?? 'sistema')}</td>
          <td>${escapar(new Date(evento.creadoEn).toLocaleString('es'))}</td>
        </tr>`,
      )
      .join('');
    $('#detalle-historial').innerHTML = `
      <h4>Historial de la reserva #${escapar(id)}</h4>
      <table>
        <thead><tr><th>Evento</th><th>Actor</th><th>Fecha</th></tr></thead>
        <tbody>${filas}</tbody>
      </table>`;
  } catch (error) {
    mostrarMensaje(error.message, 'error');
  }
}

async function cargarPendientes() {
  const { cuerpo } = await api('/reservas/pendientes');
  const contenedor = $('#lista-pendientes');

  if (cuerpo.datos.length === 0) {
    contenedor.innerHTML = '<p class="vacio">No hay solicitudes pendientes de resolver.</p>';
    return;
  }

  contenedor.innerHTML = `
    <table>
      <thead>
        <tr><th>Espacio</th><th>Solicitante</th><th>Fecha</th><th>Franja</th><th>Justificacion</th><th>Acciones</th></tr>
      </thead>
      <tbody>
        ${cuerpo.datos
          .map(
            (reserva) => `
          <tr>
            <td>${escapar(reserva.espacioCodigo)}</td>
            <td>${escapar(reserva.solicitanteNombre)}</td>
            <td>${escapar(reserva.fecha)}</td>
            <td>${escapar(reserva.horaInicio)} - ${escapar(reserva.horaFin)}</td>
            <td>${escapar(reserva.justificacion)}</td>
            <td>
              <button type="button" class="boton boton--principal" data-aprobar="${escapar(reserva.id)}">Aprobar</button>
              <button type="button" class="boton boton--peligro" data-rechazar="${escapar(reserva.id)}">Rechazar</button>
            </td>
          </tr>`,
          )
          .join('')}
      </tbody>
    </table>`;
}

async function aprobarReserva(id) {
  try {
    await api(`/reservas/${id}/aprobar`, { metodo: 'POST' });
    mostrarMensaje('Solicitud aprobada.', 'exito');
    await cargarPendientes();
  } catch (error) {
    mostrarMensaje(error.message, 'error');
  }
}

async function rechazarReserva(id) {
  const motivo = window.prompt('Motivo del rechazo (obligatorio, minimo 10 caracteres)');
  if (motivo === null) {
    return;
  }
  try {
    await api(`/reservas/${id}/rechazar`, { metodo: 'POST', cuerpo: { motivo } });
    mostrarMensaje('Solicitud rechazada.', 'exito');
    await cargarPendientes();
  } catch (error) {
    mostrarMensaje(error.message, 'error');
  }
}

async function cargarAuditoria() {
  const { cuerpo } = await api('/eventos?limite=100');
  const contenedor = $('#lista-auditoria');

  if (cuerpo.datos.length === 0) {
    contenedor.innerHTML = '<p class="vacio">No hay eventos registrados.</p>';
    return;
  }

  contenedor.innerHTML = `
    <table>
      <thead>
        <tr><th>Tipo</th><th>Actor</th><th>Entidad</th><th>Detalle</th><th>Fecha</th></tr>
      </thead>
      <tbody>
        ${cuerpo.datos
          .map(
            (evento) => `
          <tr>
            <td>${escapar(evento.tipo)}</td>
            <td>${escapar(evento.actorNombre ?? 'sistema')}</td>
            <td>${escapar(evento.entidadTipo)} #${escapar(evento.entidadId ?? '-')}</td>
            <td>${escapar(JSON.stringify(evento.datos))}</td>
            <td>${escapar(new Date(evento.creadoEn).toLocaleString('es'))}</td>
          </tr>`,
          )
          .join('')}
      </tbody>
    </table>`;
}

// ---------------------------------------------------------------------------
// Eventos de la interfaz
// ---------------------------------------------------------------------------

$('#formulario-login').addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const correo = $('#login-email').value;
  const contrasena = $('#login-contrasena').value;
  try {
    await iniciarSesion(correo, contrasena);
    mostrarMensaje('Sesion iniciada.', 'exito');
  } catch (error) {
    mostrarMensaje(error.message, 'error');
  }
});

$('#formulario-registro').addEventListener('submit', async (evento) => {
  evento.preventDefault();
  try {
    await registrarUsuario($('#registro-nombre').value, $('#registro-email').value, $('#registro-contrasena').value);
    mostrarMensaje('Cuenta creada correctamente.', 'exito');
  } catch (error) {
    mostrarMensaje(error.message, 'error');
  }
});

$('#boton-salir').addEventListener('click', () => {
  void cerrarSesion();
});

for (const pestana of document.querySelectorAll('.pestana')) {
  pestana.addEventListener('click', () => {
    void cambiarVista(pestana.dataset['vista']);
  });
}

$('#filtro-tipo').addEventListener('change', () => {
  void cargarEspacios();
});

$('#formulario-disponibilidad').addEventListener('submit', async (evento) => {
  evento.preventDefault();
  try {
    await consultarDisponibilidad($('#disponibilidad-espacio').value, $('#disponibilidad-fecha').value);
  } catch (error) {
    mostrarMensaje(error.message, 'error');
  }
});

$('#boton-nueva-reserva').addEventListener('click', () => {
  const formulario = $('#formulario-reserva');
  formulario.hidden = !formulario.hidden;
  if (!formulario.hidden) {
    const hoy = new Date();
    const iso = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
    $('#reserva-fecha').value = iso;
  }
});

$('#boton-cancelar-reserva').addEventListener('click', () => {
  $('#formulario-reserva').hidden = true;
});

$('#formulario-reserva').addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const asistentes = $('#reserva-asistentes').value;
  const cuerpo = {
    espacioId: Number($('#reserva-espacio').value),
    fecha: $('#reserva-fecha').value,
    horaInicio: $('#reserva-hora-inicio').value,
    horaFin: $('#reserva-hora-fin').value,
    justificacion: $('#reserva-justificacion').value,
  };
  if (asistentes !== '') {
    cuerpo.asistentes = Number(asistentes);
  }

  try {
    await api('/reservas', { metodo: 'POST', cuerpo });
    mostrarMensaje('Solicitud de reserva enviada.', 'exito');
    $('#formulario-reserva').hidden = true;
    $('#formulario-reserva').reset();
    await cargarMisReservas();
  } catch (error) {
    mostrarMensaje(error.message, 'error');
  }
});

document.addEventListener('click', (evento) => {
  const objetivo = evento.target;
  if (!(objetivo instanceof HTMLElement)) {
    return;
  }
  if (objetivo.dataset['cancelar'] !== undefined) {
    void cancelarReserva(objetivo.dataset['cancelar']);
  }
  if (objetivo.dataset['historial'] !== undefined) {
    void verHistorial(objetivo.dataset['historial']);
  }
  if (objetivo.dataset['aprobar'] !== undefined) {
    void aprobarReserva(objetivo.dataset['aprobar']);
  }
  if (objetivo.dataset['rechazar'] !== undefined) {
    void rechazarReserva(objetivo.dataset['rechazar']);
  }
});

// ---------------------------------------------------------------------------
// Arranque
// ---------------------------------------------------------------------------

async function arrancar() {
  if (token !== null && usuario !== null) {
    try {
      await api('/auth/perfil');
      await mostrarAplicacion();
      return;
    } catch {
      token = null;
      localStorage.removeItem(CLAVE_TOKEN);
      localStorage.removeItem(CLAVE_USUARIO);
    }
  }
  $('#vista-login').hidden = false;
}

void arrancar();
