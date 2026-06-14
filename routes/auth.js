const express = require('express')
const router = express.Router()
const db = require('../db')

router.post('/login', (req, res) => {
  const { email, password } = req.body
  const sql = 'SELECT * FROM users WHERE email = ? AND password = ?'
  db.query(sql, [email, password], (err, results) => {
    if (err) return res.status(500).json({ error: err.message })
    if (results.length === 0) {
      return res.status(401).json({ message: 'Email atau password salah' })
    }
    const user = results[0]
    res.json({
      token: 'token-' + user.id,
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    })
  })
})

module.exports = router