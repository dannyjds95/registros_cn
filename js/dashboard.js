const userData = JSON.parse(localStorage.getItem('usuario_cobros'));

if (!userData) {
  window.location.href = 'index.html';
}

const esAdmin = userData.us_tipo.toUpperCase() === 'ADMINISTRADOR';
let todosLosRegistros = [];

// Configurar cabecera según usuario
document.getElementById('user-name').textContent = userData.us_nombre || userData.us_user;
document.getElementById('user-role').textContent = userData.us_tipo;

// Habilitar filtro de usuarios para TODOS los roles
document.getElementById('filtro-usuario').style.display = 'inline-block';
cargarUsuarios();

// Controles exclusivos para ADMINISTRADOR
if (esAdmin) {
  document.getElementById('btn-abrir-modal').style.display = 'inline-block';
  document.getElementById('col-acciones').style.display = 'table-cell';
}

// Cerrar sesión
document.getElementById('btn-logout').addEventListener('click', () => {
  localStorage.removeItem('usuario_cobros');
  window.location.href = 'index.html';
});

// Cargar listado de usuarios en el select del formulario y en el filtro de tabla
async function cargarUsuarios() {
  try {
    const res = await fetch('/api/usuarios');
    const data = await res.json();

    if (data.success) {
      const selectForm = document.getElementById('reg-usuario');
      const selectFiltro = document.getElementById('filtro-usuario');

      if (selectForm) {
        selectForm.innerHTML = '<option value="">-- Seleccione un usuario --</option>';
      }
      if (selectFiltro) {
        selectFiltro.innerHTML = '<option value="">Todos los usuarios</option>';
      }

      data.usuarios.forEach(u => {
        const texto = u.us_nombre || u.us_user;
        const opcion = `<option value="${u.id_us}">${texto}</option>`;
        if (selectForm) selectForm.innerHTML += opcion;
        if (selectFiltro) selectFiltro.innerHTML += opcion;
      });
    }
  } catch (err) {
    console.error('Error cargando usuarios:', err);
  }
}

// Cargar TODOS los registros desde la base de datos
async function cargarRegistros() {
  try {
    const res = await fetch('/api/registros');
    const data = await res.json();

    if (data.success) {
      todosLosRegistros = data.registros;
      actualizarEstadoDeuda();    // 1. Deuda del usuario actual
      actualizarBalanceGeneral(); // 2. Balance global de todos los movimientos
      aplicarFiltros();           // 3. Tabla de movimientos
    }
  } catch (err) {
    const columnas = esAdmin ? 7 : 6;
    document.getElementById('tabla-registros').innerHTML =
      `<tr><td colspan="${columnas}" style="text-align:center; color:red;">Error al cargar los datos</td></tr>`;
  }
}

// Filtrar únicamente la tabla de movimientos
function aplicarFiltros() {
  const texto = document.getElementById('filtro-texto').value.toLowerCase();
  const tipo = document.getElementById('filtro-tipo').value;
  const usuarioFiltro = document.getElementById('filtro-usuario').value;

  const filtrados = todosLosRegistros.filter(r => {
    const coincideTexto = (r.reg_detalle || '').toLowerCase().includes(texto);
    const coincideTipo = tipo === '' || r.reg_tipo === tipo;
    const coincideUsuario = usuarioFiltro === '' || String(r.id_us) === usuarioFiltro;
    return coincideTexto && coincideTipo && coincideUsuario;
  });

  renderizarTabla(filtrados);
}

// Sección 1: Estado de Aportaciones del usuario actual que inició sesión
// Sección 1: Estado de Aportaciones del usuario actual que inició sesión
function actualizarEstadoDeuda() {
  const VALOR_CUOTA = 5;

  const mesesNombres = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const idActual = String(userData.id_us);
  const nombreActual = userData.us_nombre || userData.us_user;

  // Inicio en Enero 2026 solo para el usuario con ID 30010; Agosto 2023 para los demás
  const esUsuario2026 = idActual === '30010';
  const ANIO_INICIO = esUsuario2026 ? 2026 : 2023;
  const MES_INICIO = esUsuario2026 ? 0 : 7; // 0 = Enero, 7 = Agosto

  // Actualizar subtítulo de la tarjeta según la fecha de inicio del usuario
  const elSubtitulo = document.querySelector('#card-deuda .debt-subtitle');
  if (elSubtitulo) {
    elSubtitulo.textContent = `Cuota mensual de $5.00 desde ${mesesNombres[MES_INICIO]} ${ANIO_INICIO}`;
  }

  // Calcular total de meses transcurridos desde su fecha de inicio hasta el mes actual
  const hoy = new Date();
  const cuotasTranscurridas = Math.max(
    0,
    (hoy.getFullYear() - ANIO_INICIO) * 12 + (hoy.getMonth() - MES_INICIO) + 1
  );
  const valorTotalEsperado = cuotasTranscurridas * VALOR_CUOTA;

  // Sumar únicamente los INGRESOS del usuario actual
  const totalPagado = todosLosRegistros
    .filter(r => String(r.id_us) === idActual && r.reg_tipo === 'INGRESO')
    .reduce((suma, r) => suma + (parseFloat(r.reg_valor) || 0), 0);

  const valorAdeudado = Math.max(0, valorTotalEsperado - totalPagado);
  const saldoAFavor = Math.max(0, totalPagado - valorTotalEsperado);

  const cuotasPagadas = totalPagado / VALOR_CUOTA;
  const cuotasAdeudadas = valorAdeudado / VALOR_CUOTA;
  const formatearCuotas = (num) => Number.isInteger(num) ? num : num.toFixed(1);

  // Calcular hasta qué mes y año alcanza lo pagado
  const cuotasCompletas = Math.floor(totalPagado / VALOR_CUOTA);
  let textoCubiertoHasta = 'Sin cuotas pagadas';
  if (cuotasCompletas > 0) {
    const totalMeses = ANIO_INICIO * 12 + MES_INICIO + cuotasCompletas - 1;
    const anioCubierto = Math.floor(totalMeses / 12);
    const mesCubierto = totalMeses % 12;
    textoCubiertoHasta = `${mesesNombres[mesCubierto]} ${anioCubierto}`;
  }

  // Actualizar interfaz de la Sección 1
  document.getElementById('deuda-usuario-nombre').textContent = nombreActual;
  document.getElementById('deuda-pagado').textContent = `$${totalPagado.toFixed(2)}`;
  document.getElementById('deuda-cuotas-pagadas').textContent =
    `${formatearCuotas(cuotasPagadas)} de ${cuotasTranscurridas} cuotas`;

  const elCuotasDebe = document.getElementById('deuda-cuotas-debe');
  const elValorDebe = document.getElementById('deuda-valor-debe');
  const elBadge = document.getElementById('deuda-estado-badge');
  const elCard = document.getElementById('card-deuda');

  elCuotasDebe.textContent = `${formatearCuotas(cuotasAdeudadas)} ${cuotasAdeudadas === 1 ? 'cuota' : 'cuotas'}`;
  elValorDebe.textContent = `$${valorAdeudado.toFixed(2)}`;
  document.getElementById('deuda-total-esperado').textContent = `Total esperado: $${valorTotalEsperado.toFixed(2)}`;
  document.getElementById('deuda-cubierto-hasta').textContent = textoCubiertoHasta;

  if (valorAdeudado === 0) {
    elCuotasDebe.className = 'debt-number success';
    elValorDebe.className = 'debt-number success';
    elCard.classList.add('al-dia');
    elBadge.className = 'status-badge status-ok';
    elBadge.textContent = saldoAFavor > 0
      ? `Al día (Saldo a favor: $${saldoAFavor.toFixed(2)})`
      : 'Al día';
  } else {
    elCuotasDebe.className = 'debt-number danger';
    elValorDebe.className = 'debt-number danger';
    elCard.classList.remove('al-dia');
    elBadge.className = 'status-badge status-pending';
    elBadge.textContent = 'Con saldo pendiente';
  }
}

// Sección 2: Balance General (Global sobre todos los registros, igual para todos)
function actualizarBalanceGeneral() {
  let ingresos = 0;
  let egresos = 0;

  todosLosRegistros.forEach(r => {
    const val = parseFloat(r.reg_valor) || 0;
    if (r.reg_tipo === 'INGRESO') ingresos += val;
    if (r.reg_tipo === 'EGRESO') egresos += val;
  });

  const balance = ingresos - egresos;
  const elBalance = document.getElementById('total-balance');

  document.getElementById('total-ingresos').textContent = `$${ingresos.toFixed(2)}`;
  document.getElementById('total-egresos').textContent = `$${egresos.toFixed(2)}`;
  elBalance.textContent = `$${balance.toFixed(2)}`;
  elBalance.className = balance < 0 ? 'debt-number danger' : 'debt-number';
}

// Renderizar tabla de movimientos
function renderizarTabla(lista) {
  const tbody = document.getElementById('tabla-registros');
  const columnas = esAdmin ? 7 : 6;

  if (lista.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${columnas}" style="text-align: center; padding: 2rem;">No hay registros para mostrar.</td></tr>`;
    return;
  }

  tbody.innerHTML = lista.map(r => {
    const badgeTipo = r.reg_tipo === 'INGRESO'
      ? '<span class="tag-ingreso">INGRESO</span>'
      : '<span class="tag-egreso">EGRESO</span>';

    const nombreUsuario = r.us_nombre ? `${r.us_nombre}` : `ID: ${r.id_us}`;
    const valorFormateado = `$${parseFloat(r.reg_valor).toFixed(2)}`;

    const btnFoto = r.reg_imagen
      ? `<button type="button" class="btn-sm btn-outline" onclick="verFoto('${r.reg_imagen}')">Ver imagen</button>`
      : '<span style="color: #94a3b8; font-size: 0.85rem;">Sin foto</span>';

    const btnEliminar = esAdmin
      ? `<td><button type="button" class="btn-sm btn-danger-sm" onclick="eliminarRegistro(${r.id_reg})">Eliminar</button></td>`
      : '';

    return `
      <tr>
        <td>${r.reg_fecha}</td>
        <td><strong>${nombreUsuario}</strong></td>
        <td>${badgeTipo}</td>
        <td>${r.reg_detalle || '-'}</td>
        <td><strong>${valorFormateado}</strong></td>
        <td>${btnFoto}</td>
        ${btnEliminar}
      </tr>
    `;
  }).join('');
}

// Eventos de filtros de la tabla
document.getElementById('filtro-texto').addEventListener('input', aplicarFiltros);
document.getElementById('filtro-tipo').addEventListener('change', aplicarFiltros);
document.getElementById('filtro-usuario').addEventListener('change', aplicarFiltros);

// Lógica del Modal de Nuevo Registro
const modalRegistro = document.getElementById('modal-registro');
const inputImagen = document.getElementById('reg-imagen');
const previewImg = document.getElementById('preview-imagen');

document.getElementById('btn-abrir-modal').addEventListener('click', () => {
  document.getElementById('form-registro').reset();
  document.getElementById('reg-fecha').value = new Date().toISOString().split('T')[0];
  previewImg.style.display = 'none';
  document.getElementById('modal-error').style.display = 'none';
  modalRegistro.style.display = 'flex';
});

document.getElementById('btn-cerrar-modal').addEventListener('click', () => {
  modalRegistro.style.display = 'none';
});

// Vista previa de la imagen seleccionada
inputImagen.addEventListener('change', () => {
  const file = inputImagen.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = e => {
      previewImg.src = e.target.result;
      previewImg.style.display = 'block';
    };
    reader.readAsDataURL(file);
  } else {
    previewImg.style.display = 'none';
  }
});

// Comprimir imagen antes de enviar
function comprimirImagen(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 1200;
        let width = img.width;
        let height = img.height;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
    };
  });
}

// Enviar formulario de registro
document.getElementById('form-registro').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btnGuardar = document.getElementById('btn-guardar-registro');
  const errorDiv = document.getElementById('modal-error');

  errorDiv.style.display = 'none';
  btnGuardar.disabled = true;
  btnGuardar.textContent = 'Guardando...';

  try {
    let imagenBase64 = null;
    if (inputImagen.files.length > 0) {
      imagenBase64 = await comprimirImagen(inputImagen.files[0]);
    }

    const payload = {
      rol_solicitante: userData.us_tipo,
      id_us: document.getElementById('reg-usuario').value,
      reg_tipo: document.getElementById('reg-tipo').value,
      reg_fecha: document.getElementById('reg-fecha').value,
      reg_valor: document.getElementById('reg-valor').value,
      reg_detalle: document.getElementById('reg-detalle').value.trim(),
      imagenBase64
    };

    const res = await fetch('/api/registros', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (data.success) {
      modalRegistro.style.display = 'none';
      await cargarRegistros();
    } else {
      errorDiv.textContent = data.message || 'Error al guardar';
      errorDiv.style.display = 'block';
    }
  } catch (err) {
    errorDiv.textContent = 'Error de conexión con el servidor';
    errorDiv.style.display = 'block';
  } finally {
    btnGuardar.disabled = false;
    btnGuardar.textContent = 'Guardar Registro';
  }
});

// Eliminar registro (Solo ADMINISTRADOR)
async function eliminarRegistro(id_reg) {
  if (!confirm('¿Estás seguro de que deseas eliminar este registro?')) return;

  try {
    const res = await fetch(`/api/registros?id_reg=${id_reg}&rol_solicitante=${encodeURIComponent(userData.us_tipo)}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (data.success) {
      await cargarRegistros();
    } else {
      alert(data.message || 'No se pudo eliminar');
    }
  } catch (err) {
    alert('Error de conexión al intentar eliminar');
  }
}

// Visor de comprobante
function verFoto(ruta) {
  const urlCompleta = ruta.startsWith('http')
    ? ruta
    : `https://raw.githubusercontent.com/dannyjds95/registros_cn/main/${ruta}`;
  document.getElementById('img-visor').src = urlCompleta;
  document.getElementById('modal-foto').style.display = 'flex';
}

function cerrarModalFoto() {
  document.getElementById('modal-foto').style.display = 'none';
}

// Iniciar carga
cargarRegistros();


// Lógica para Cambiar Contraseña
const modalPassword = document.getElementById('modal-password');
const formPassword = document.getElementById('form-password');
const passMensaje = document.getElementById('pass-mensaje');

function cerrarModalPassword() {
  modalPassword.style.display = 'none';
}

document.getElementById('btn-cambiar-pass').addEventListener('click', () => {
  formPassword.reset();
  passMensaje.style.display = 'none';
  modalPassword.style.display = 'flex';
});

document.getElementById('btn-cerrar-pass').addEventListener('click', cerrarModalPassword);
document.getElementById('btn-cancelar-pass').addEventListener('click', cerrarModalPassword);

formPassword.addEventListener('submit', async (e) => {
  e.preventDefault();

  const passActual = document.getElementById('pass-actual').value;
  const passNueva = document.getElementById('pass-nueva').value;
  const passConfirmar = document.getElementById('pass-confirmar').value;
  const btnGuardar = document.getElementById('btn-guardar-pass');

  passMensaje.style.display = 'none';

  if (passNueva !== passConfirmar) {
    passMensaje.className = 'alert-error';
    passMensaje.textContent = 'La nueva contraseña y su confirmación no coinciden';
    passMensaje.style.display = 'block';
    return;
  }

  btnGuardar.disabled = true;
  btnGuardar.textContent = 'Actualizando...';

  try {
    const res = await fetch('/api/usuarios', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id_us: userData.id_us,
        pass_actual: passActual,
        pass_nueva: passNueva
      })
    });

    const data = await res.json();

    if (data.success) {
      passMensaje.className = 'alert-success';
      passMensaje.textContent = data.message;
      passMensaje.style.display = 'block';
      formPassword.reset();
      setTimeout(cerrarModalPassword, 1500);
    } else {
      passMensaje.className = 'alert-error';
      passMensaje.textContent = data.message || 'No se pudo cambiar la contraseña';
      passMensaje.style.display = 'block';
    }
  } catch (err) {
    passMensaje.className = 'alert-error';
    passMensaje.textContent = 'Error de conexión con el servidor';
    passMensaje.style.display = 'block';
  } finally {
    btnGuardar.disabled = false;
    btnGuardar.textContent = 'Actualizar contraseña';
  }
});

// Menú desplegable en dispositivos móviles
const btnMenuMovil = document.getElementById('btn-menu-movil');
const topbarMenu = document.getElementById('topbar-menu');

if (btnMenuMovil && topbarMenu) {
  btnMenuMovil.addEventListener('click', (e) => {
    e.stopPropagation();
    topbarMenu.classList.toggle('open');
  });

  // Cerrar menú al abrir el modal de contraseña
  document.getElementById('btn-cambiar-pass').addEventListener('click', () => {
    topbarMenu.classList.remove('open');
  });

  // Cerrar menú si se toca fuera de la barra superior
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.topbar')) {
      topbarMenu.classList.remove('open');
    }
  });
}