const { put, del } = require('@vercel/blob');
const pool = require('../lib/db');

module.exports = async function handler(req, res) {
  // 1. CONSULTAR REGISTROS (GET)
  if (req.method === 'GET') {
    const { id_us, us_tipo } = req.query;

    if (!id_us || !us_tipo) {
      return res.status(400).json({ success: false, message: 'Faltan datos de sesión' });
    }

    try {
      let query = `
        SELECT r.id_reg, r.id_us, r.reg_tipo, r.reg_fecha, r.reg_valor, r.reg_detalle, r.reg_imagen,
               u.us_nombre, u.us_user
        FROM registros r
        LEFT JOIN usuarios u ON r.id_us = u.id_us
      `;
      let params = [];

      // Si NO es administrador, filtramos estrictamente por su id_us
      if (us_tipo.toUpperCase() !== 'ADMINISTRADOR') {
        query += ' WHERE r.id_us = ?';
        params.push(id_us);
      }

      query += ' ORDER BY r.reg_fecha DESC, r.id_reg DESC';

      const [rows] = await pool.execute(query, params);
      return res.status(200).json({ success: true, registros: rows });
    } catch (error) {
      console.error('Error al consultar registros:', error);
      return res.status(500).json({ success: false, message: 'Error al consultar los registros' });
    }
  }

  // 2. CREAR NUEVO REGISTRO (POST)
  if (req.method === 'POST') {
    const { rol_solicitante, id_us, reg_tipo, reg_fecha, reg_valor, reg_detalle, imagenBase64 } = req.body;

    if (!rol_solicitante || rol_solicitante.toUpperCase() !== 'ADMINISTRADOR') {
      return res.status(403).json({ success: false, message: 'No tienes permisos para agregar registros' });
    }

    if (!id_us || !reg_tipo || !reg_fecha || reg_valor === undefined || reg_valor === '') {
      return res.status(400).json({ success: false, message: 'Completa los campos obligatorios' });
    }

    try {
      let urlImagen = null;

      // Si se adjuntó imagen, la subimos a la carpeta imagenes/comprobantes/
      if (imagenBase64) {
        const base64Data = imagenBase64.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        const nombreArchivo = `imagenes/comprobantes/${Date.now()}.jpg`;

        const blob = await put(nombreArchivo, buffer, {
          access: 'public',
          contentType: 'image/jpeg'
        });

        urlImagen = blob.url;
      }

      await pool.execute(
        `INSERT INTO registros (id_us, reg_tipo, reg_fecha, reg_valor, reg_detalle, reg_imagen)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id_us, reg_tipo, reg_fecha, reg_valor, reg_detalle || '', urlImagen]
      );

      return res.status(201).json({ success: true, message: 'Registro guardado correctamente' });
    } catch (error) {
      console.error('Error al guardar registro:', error);
      return res.status(500).json({ success: false, message: 'Error al guardar el registro o subir la imagen' });
    }
  }

  // 3. ELIMINAR REGISTRO (DELETE)
  if (req.method === 'DELETE') {
    const { id_reg, rol_solicitante } = req.query;

    if (!rol_solicitante || rol_solicitante.toUpperCase() !== 'ADMINISTRADOR') {
      return res.status(403).json({ success: false, message: 'No tienes permisos para eliminar registros' });
    }

    if (!id_reg) {
      return res.status(400).json({ success: false, message: 'Falta el ID del registro' });
    }

    try {
      // Buscamos si tenía imagen para borrarla también del almacenamiento
      const [rows] = await pool.execute('SELECT reg_imagen FROM registros WHERE id_reg = ?', [id_reg]);
      if (rows.length > 0 && rows[0].reg_imagen && rows[0].reg_imagen.startsWith('http')) {
        try {
          await del(rows[0].reg_imagen);
        } catch (blobErr) {
          console.warn('No se pudo eliminar el archivo de Blob:', blobErr);
        }
      }

      await pool.execute('DELETE FROM registros WHERE id_reg = ?', [id_reg]);
      return res.status(200).json({ success: true, message: 'Registro eliminado' });
    } catch (error) {
      console.error('Error al eliminar registro:', error);
      return res.status(500).json({ success: false, message: 'Error al eliminar el registro' });
    }
  }

  return res.status(405).json({ success: false, message: 'Método no permitido' });
};