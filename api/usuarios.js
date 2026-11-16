const pool = require('../lib/db');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Método no permitido' });
  }

  try {
    const [rows] = await pool.execute(
      'SELECT id_us, us_nombre, us_user, us_tipo FROM usuarios ORDER BY us_nombre ASC'
    );
    return res.status(200).json({ success: true, usuarios: rows });
  } catch (error) {
    console.error('Error al cargar usuarios:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener la lista de usuarios' });
  }
};