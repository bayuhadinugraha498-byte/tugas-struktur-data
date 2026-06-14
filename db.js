const mysql = require('mysql2');

const db = mysql.createConnection({
  host: 'ChocoBakery',
  user: 'root',
  password: '',
  database: 'choco_app'
});

db.connect(err => {
  if (err) {
    console.error('Koneksi MySQL gagal:', err);
    return;
  }
  console.log('MySQL Connected!');
});

module.exports = db;