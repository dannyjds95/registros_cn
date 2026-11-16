const pool = require('../lib/db');

module.exports = async function handler(req, res) {
  // 1. LISTAR USUARIOS (GET)
  if (req.method === 'GET') {
    try {
      const [rows] = await pool.execute(
        'SELECT id_us, us_nombre, us_user, us_tipo FROM usuarios ORDER BY us_nombre ASC'
      );
      return res.status(200).json({ success: true, usuarios: rows });
    } catch (error) {
      console.error('Error al consultar usuarios:', error);
      return res.status(500).json({ success: false, message: 'Error al consultar usuarios' });
    }
  }

  // 2. CAMBIAR CONTRASEÑA (PUT)
  if (req.method === 'PUT') {
    const { id_us, pass_actual, pass_nueva } = req.body;

    if (!id_us || !pass_actual || !pass_nueva) {
      return res.status(400).json({ success: false, message: 'Completa todos los campos' });
    }

    if (pass_nueva.length < 4) {
      return res.status(400).json({ success: false, message: 'La nueva contraseña debe tener al menos 4 caracteres' });
    }

    try {
      // Nota: Si en tu tabla TiDB la columna se llama us_password o us_clave, cámbiala aquí y en el UPDATE
      const [rows] = await pool.execute(
        'SELECT us_pass FROM usuarios WHERE id_us = ?',
        [id_us]
      );

      if (rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
      }

      if (rows[0].us_pass !== pass_actual) {
        return res.status(401).json({ success: false, message: 'La contraseña actual es incorrecta' });
      }

      await pool.execute(
        'UPDATE usuarios SET us_pass = ? WHERE id_us = ?',
        [pass_nueva, id_us]
      );

      return res.status(200).json({ success: true, message: 'Contraseña actualizada correctamente' });
    } catch (error) {
      console.error('Error al cambiar contraseña:', error);
      return res.status(500).json({ success: false, message: 'Error interno al actualizar la contraseña' });
    }
  }

  return res.status(405).json({ success: false, message: 'Método no permitido' });
};