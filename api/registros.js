const pool = require('../lib/db');

const GITHUB_OWNER = 'dannyjds95';
const GITHUB_REPO = 'registros_cn';
const GITHUB_BRANCH = 'main';

module.exports = async function handler(req, res) {
  // 1. CONSULTAR REGISTROS (GET)
// 1. CONSULTAR REGISTROS (GET - Todos los usuarios ven todos los movimientos)
  if (req.method === 'GET') {
    try {
      const query = `
        SELECT r.id_reg, r.id_us, r.reg_tipo, r.reg_fecha, r.reg_valor, r.reg_detalle, r.reg_imagen,
               u.us_nombre, u.us_user
        FROM registros r
        LEFT JOIN usuarios u ON r.id_us = u.id_us
        ORDER BY r.reg_fecha DESC, r.id_reg DESC
      `;

      const [rows] = await pool.execute(query);
      return res.status(200).json({ success: true, registros: rows });
    } catch (error) {
      console.error('Error al consultar registros:', error);
      return res.status(500).json({ success: false, message: 'Error al consultar los registros' });
    }
  }

  // 2. CREAR NUEVO REGISTRO Y SUBIR FOTO A GITHUB (POST)
  if (req.method === 'POST') {
    const { rol_solicitante, id_us, reg_tipo, reg_fecha, reg_valor, reg_detalle, imagenBase64 } = req.body;

    if (!rol_solicitante || rol_solicitante.toUpperCase() !== 'ADMINISTRADOR') {
      return res.status(403).json({ success: false, message: 'No tienes permisos para agregar registros' });
    }

    if (!id_us || !reg_tipo || !reg_fecha || reg_valor === undefined || reg_valor === '') {
      return res.status(400).json({ success: false, message: 'Completa los campos obligatorios' });
    }

    try {
      let rutaImagen = null;

      if (imagenBase64) {
        if (!process.env.GITHUB_TOKEN) {
          throw new Error('Falta configurar la variable GITHUB_TOKEN en Vercel');
        }

        const base64Data = imagenBase64.replace(/^data:image\/\w+;base64,/, '');
        const nombreArchivo = `${Date.now()}.jpg`;
        rutaImagen = `imagenes/comprobantes/${nombreArchivo}`;

        const githubUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${rutaImagen}`;

        const ghRes = await fetch(githubUrl, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github+json',
            'Content-Type': 'application/json',
            'User-Agent': 'registros-cn-app'
          },
          body: JSON.stringify({
            message: `Nuevo comprobante: ${nombreArchivo}`,
            content: base64Data,
            branch: GITHUB_BRANCH
          })
        });

        if (!ghRes.ok) {
          const ghError = await ghRes.json();
          throw new Error(`Error de GitHub: ${ghError.message || ghRes.statusText}`);
        }
      }

      await pool.execute(
        `INSERT INTO registros (id_us, reg_tipo, reg_fecha, reg_valor, reg_detalle, reg_imagen)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id_us, reg_tipo, reg_fecha, reg_valor, reg_detalle || '', rutaImagen]
      );

      return res.status(201).json({ success: true, message: 'Registro guardado correctamente' });
    } catch (error) {
      console.error('Error al guardar registro:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Error desconocido al guardar'
      });
    }
  }

  // 3. ELIMINAR REGISTRO Y BORRAR FOTO DE GITHUB (DELETE)
  if (req.method === 'DELETE') {
    const { id_reg, rol_solicitante } = req.query;

    if (!rol_solicitante || rol_solicitante.toUpperCase() !== 'ADMINISTRADOR') {
      return res.status(403).json({ success: false, message: 'No tienes permisos para eliminar registros' });
    }

    if (!id_reg) {
      return res.status(400).json({ success: false, message: 'Falta el ID del registro' });
    }

    try {
      const [rows] = await pool.execute('SELECT reg_imagen FROM registros WHERE id_reg = ?', [id_reg]);

      if (rows.length > 0 && rows[0].reg_imagen && process.env.GITHUB_TOKEN) {
        const rutaArchivo = rows[0].reg_imagen;
        const githubUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${rutaArchivo}`;

        try {
          // Primero obtenemos el SHA del archivo en GitHub para poder eliminarlo
          const getRes = await fetch(`${githubUrl}?ref=${GITHUB_BRANCH}`, {
            headers: {
              'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
              'Accept': 'application/vnd.github+json',
              'User-Agent': 'registros-cn-app'
            }
          });

          if (getRes.ok) {
            const fileData = await getRes.json();
            await fetch(githubUrl, {
              method: 'DELETE',
              headers: {
                'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github+json',
                'Content-Type': 'application/json',
                'User-Agent': 'registros-cn-app'
              },
              body: JSON.stringify({
                message: `Eliminar comprobante: ${rutaArchivo}`,
                sha: fileData.sha,
                branch: GITHUB_BRANCH
              })
            });
          }
        } catch (ghErr) {
          console.warn('No se pudo borrar la imagen de GitHub:', ghErr);
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