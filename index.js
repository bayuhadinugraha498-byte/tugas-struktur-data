const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => res.json({ message: 'Server choco-app berjalan!' }));

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  db.query('SELECT * FROM users WHERE email = ? AND password = ?', [email, password], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) return res.status(401).json({ message: 'Email atau password salah' });
    const user = results[0];
    res.json({ token: 'token-' + user.id, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  });
});

app.get('/api/customer', (req, res) => {
  db.query("SELECT id, name, email, role FROM users WHERE role = 'Customer' LIMIT 1", (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) {
      return res.json({ id: 999, name: 'Customer Choco', email: 'customer@choco.com', role: 'Customer' });
    }
    res.json(results[0]);
  });
});

app.get('/api/transaksi', (req, res) => {
  db.query('SELECT * FROM transaksi ORDER BY created_at DESC', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

app.put('/api/transaksi/:id/status', (req, res) => {
  const { status } = req.body;
  db.query('UPDATE transaksi SET status = ? WHERE id = ?', [status, req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Status updated' });
  });
});

app.get('/api/produk', (req, res) => {
  db.query('SELECT * FROM produk', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) {
      return res.json([
        { id: 1, name: "Classic Butter Croissant", description: "Pastry mentega lembut.", price: 25000, stock: 100, image: "https://via.placeholder.com/150", badge: "Best Seller" },
        { id: 2, name: "Berry Velvet Cake", description: "Cake lembut dengan krim manis.", price: 20000, stock: 30, image: "https://via.placeholder.com/150", badge: "Best Seller" }
      ]);
    }
    res.json(results);
  });
});

app.post('/api/produk', (req, res) => {
  const { nama, harga, stok, deskripsi } = req.body;
  db.query('INSERT INTO produk (nama, harga, stok, deskripsi) VALUES (?,?,?,?)', [nama, harga, stok, deskripsi], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Produk ditambahkan', id: result.insertId });
  });
});

app.put('/api/produk/:id', (req, res) => {
  const { nama, harga, stok, deskripsi } = req.body;
  db.query('UPDATE produk SET nama=?, harga=?, stok=?, deskripsi=? WHERE id=?', [nama, harga, stok, deskripsi, req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Produk diupdate' });
  });
});

app.delete('/api/produk/:id', (req, res) => {
  db.query('DELETE FROM produk WHERE id=?', [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

app.post('/api/orders', (req, res) => {
  const { cart, totalHarga, metodePembayaran, customerId } = req.body;
  if (!totalHarga || !metodePembayaran) {
    return res.status(400).json({ error: "Data tidak lengkap." });
  }

  const status = "menunggu_verifikasi";
  db.query(
    'INSERT INTO transaksi (total, metode_pembayaran, status, customer_id, created_at) VALUES (?, ?, ?, ?, NOW())',
    [totalHarga, metodePembayaran, status, customerId || null],
    (err, result) => {
      if (err) return res.status(500).json({ error: "Gagal menyimpan transaksi: " + err.message });

      const transaksiId = result.insertId;
      if (!cart || cart.length === 0) return res.json({ success: true, transaksiId });

      const values = cart.map((item) => [transaksiId, item.id, item.qty]);
      db.query('INSERT INTO detail_transaksi (transaksi_id, produk_id, jumlah) VALUES ?', [values], (err2) => {
        if (err2) return res.status(500).json({ error: "Gagal menyimpan detail: " + err2.message });
        res.json({ success: true, transaksiId });
      });
    }
  );
});

app.get('/api/orders', (req, res) => {
  const { customerId } = req.query;
  let sql = 'SELECT * FROM transaksi ORDER BY created_at DESC';
  let params = [];
  if (customerId) {
    sql = 'SELECT * FROM transaksi WHERE customer_id = ? ORDER BY created_at DESC';
    params = [customerId];
  }
  db.query(sql, params, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

app.get('/api/orders/:id', (req, res) => {
  const sql = `
    SELECT t.*, p.nama, p.harga, dt.jumlah
    FROM transaksi t
    JOIN detail_transaksi dt ON t.id = dt.transaksi_id
    JOIN produk p ON p.id = dt.produk_id
    WHERE t.id = ?
  `;
  db.query(sql, [req.params.id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

app.get('/api/laporan', (req, res) => {
  const { dari, sampai } = req.query;
  let where = '';
  const params = [];
  if (dari && sampai) {
    where = 'WHERE DATE(created_at) BETWEEN ? AND ?';
    params.push(dari, sampai);
  }

  db.query(`SELECT * FROM transaksi ${where} ORDER BY created_at DESC`, params, (err, transaksi) => {
    if (err) return res.status(500).json({ error: err.message });

    db.query(
      `SELECT SUM(total) as omzet, COUNT(CASE WHEN status='selesai' THEN 1 END) as selesai FROM transaksi ${where}`,
      params,
      (err, ring) => {
        if (err) return res.status(500).json({ error: err.message });

        db.query(
          `SELECT p.nama, SUM(dt.jumlah) as total FROM detail_transaksi dt JOIN produk p ON dt.produk_id = p.id GROUP BY p.id ORDER BY total DESC LIMIT 5`,
          (err, terlaris) => {
            if (err) return res.status(500).json({ error: err.message });
            const totalTerjual = terlaris.reduce((a, b) => a + b.total, 0);
            res.json({
              transaksi,
              ringkasan: { omzet: ring[0].omzet || 0, selesai: ring[0].selesai || 0, terjual: totalTerjual },
              terlaris
            });
          }
        );
      }
    );
  });
});

app.get('/api/dashboard', (req, res) => {
  const sql = `SELECT 
    COUNT(*) as masuk,
    COUNT(CASE WHEN status='menunggu_verifikasi' THEN 1 END) as menunggu,
    COUNT(CASE WHEN status='selesai' THEN 1 END) as selesai
    FROM transaksi`;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results[0]);
  });
});

app.listen(3000, () => console.log('Server running at http://localhost:3000'));