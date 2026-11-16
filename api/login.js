const mysql = require('mysql2/promise');

// Creamos el pool de conexión usando las variables de entorno de Vercel
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 4000,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: {
    minVersion: 'TLSv1.2',
    rejectUnauthorized: true
  },
  waitForConnections: true,
  connectionLimit: 5
});

module.exports = async function handler(req, res) {
  // Cabeceras CORS (útil si decides abrir el HTML desde GitHub Pages)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Método no permitido' });
  }

  const { usuario, password } = req.body;

  if (!usuario || !password) {
    return res.status(400).json({ success: false, message: 'Ingresa usuario y contraseña' });
  }

  try {
    const [rows] = await pool.execute(
      'SELECT id_us, us_tipo, us_nombre, us_user, us_password, us_foto FROM usuarios WHERE us_user = ? LIMIT 1',
      [usuario]
    );

    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Usuario no encontrado' });
    }

    const user = rows[0];

    // Validación de contraseña (si luego usas encriptación bcrypt, aquí se cambia)
    if (user.us_password !== password) {
      return res.status(401).json({ success: false, message: 'Contraseña incorrecta' });
    }

    // Devolvemos los datos del usuario sin enviar la contraseña
    return res.status(200).json({
      success: true,
      user: {
        id_us: user.id_us,
        us_tipo: user.us_tipo,
        us_nombre: user.us_nombre,
        us_user: user.us_user,
        us_foto: user.us_foto
      }
    });

  } catch (error) {
    console.error('Error en login:', error);
    return res.status(500).json({ success: false, message: 'Error conectando a la base de datos' });
  }
};