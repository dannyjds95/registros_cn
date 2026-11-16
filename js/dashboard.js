    const userData = JSON.parse(localStorage.getItem('usuario_cobros'));

    if (!userData) {
      window.location.href = 'index.html';
    }

    const esAdmin = userData.us_tipo.toUpperCase() === 'ADMINISTRADOR';
    let todosLosRegistros = [];

    // Configurar cabecera según usuario
    document.getElementById('user-name').textContent = userData.us_nombre || userData.us_user;
    document.getElementById('user-role').textContent = userData.us_tipo;

    if (esAdmin) {
      document.getElementById('btn-abrir-modal').style.display = 'inline-block';
      document.getElementById('col-acciones').style.display = 'table-cell';
      document.getElementById('filtro-usuario').style.display = 'inline-block';
      cargarUsuarios();
    }

    // Cerrar sesión
    document.getElementById('btn-logout').addEventListener('click', () => {
      localStorage.removeItem('usuario_cobros');
      window.location.href = 'index.html';
    });

    // Cargar listado de usuarios en el select del formulario y filtro
    async function cargarUsuarios() {
      try {
        const res = await fetch('/api/usuarios');
        const data = await res.json();

        if (data.success) {
          const selectForm = document.getElementById('reg-usuario');
          const selectFiltro = document.getElementById('filtro-usuario');

          selectForm.innerHTML = '<option value="">-- Seleccione un usuario --</option>';
          data.usuarios.forEach(u => {
            const texto = `${u.us_nombre} (${u.us_user})`;
            selectForm.innerHTML += `<option value="${u.id_us}">${texto}</option>`;
            selectFiltro.innerHTML += `<option value="${u.id_us}">${texto}</option>`;
          });
        }
      } catch (err) {
        console.error('Error cargando usuarios:', err);
      }
    }

    // Cargar registros desde la base de datos
    async function cargarRegistros() {
      try {
        const url = `/api/registros?id_us=${userData.id_us}&us_tipo=${encodeURIComponent(userData.us_tipo)}`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.success) {
          todosLosRegistros = data.registros;
          aplicarFiltros();
        }
      } catch (err) {
        document.getElementById('tabla-registros').innerHTML =
          '<tr><td colspan="7" style="text-align:center; color:red;">Error al cargar los datos</td></tr>';
      }
    }

    // Filtrar y renderizar tabla + tarjetas resumen
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
      actualizarResumen(filtrados);
    }

    function actualizarResumen(lista) {
      let ingresos = 0;
      let egresos = 0;

      lista.forEach(r => {
        const val = parseFloat(r.reg_valor) || 0;
        if (r.reg_tipo === 'INGRESO') ingresos += val;
        if (r.reg_tipo === 'EGRESO') egresos += val;
      });

      const balance = ingresos - egresos;
      document.getElementById('total-ingresos').textContent = `$${ingresos.toFixed(2)}`;
      document.getElementById('total-egresos').textContent = `$${egresos.toFixed(2)}`;
      document.getElementById('total-balance').textContent = `$${balance.toFixed(2)}`;
    }

    function renderizarTabla(lista) {
      const tbody = document.getElementById('tabla-registros');

      if (lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem;">No hay registros para mostrar.</td></tr>';
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

    // Eventos de filtros
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

    // Comprimir imagen antes de enviar para que suba rápido y sin errores de tamaño
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