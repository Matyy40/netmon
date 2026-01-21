// server.js - Backend NetMon
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const ping = require('ping');
const { exec } = require('child_process');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
const allowedOrigins = [
  'http://localhost:3000',
  'https://netmon-frontend.onrender.com', // Ajustez selon votre URL frontend
];

app.use(cors({
  origin: function(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));
app.use(express.json());

// Base de données SQLite
const db = new sqlite3.Database('./netmon.db', (err) => {
  if (err) console.error('Erreur DB:', err);
  else console.log('✅ Base de données connectée');
});

// Création des tables
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip_address TEXT UNIQUE,
    mac_address TEXT,
    hostname TEXT,
    custom_name TEXT,
    device_type TEXT,
    first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT 1
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS device_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id INTEGER,
    status BOOLEAN,
    checked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (device_id) REFERENCES devices(id)
  )`);
});

// ========== ROUTES API ==========

// 1. GET /api/devices - Liste tous les équipements
app.get('/api/devices', (req, res) => {
  db.all('SELECT * FROM devices ORDER BY ip_address', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// 2. GET /api/devices/:id - Détails d'un équipement
app.get('/api/devices/:id', (req, res) => {
  const { id } = req.params;
  db.get('SELECT * FROM devices WHERE id = ?', [id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: 'Équipement non trouvé' });
    }
    res.json(row);
  });
});

// 3. POST /api/devices - Ajouter un équipement
app.post('/api/devices', (req, res) => {
  const { ip_address, mac_address, hostname, custom_name, device_type } = req.body;
  
  const sql = `INSERT INTO devices (ip_address, mac_address, hostname, custom_name, device_type) 
               VALUES (?, ?, ?, ?, ?)`;
  
  db.run(sql, [ip_address, mac_address, hostname, custom_name, device_type], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ id: this.lastID, message: 'Équipement ajouté' });
  });
});

// 4. PUT /api/devices/:id - Modifier un équipement
app.put('/api/devices/:id', (req, res) => {
  const { id } = req.params;
  const { custom_name, device_type } = req.body;
  
  const sql = `UPDATE devices SET custom_name = ?, device_type = ? WHERE id = ?`;
  
  db.run(sql, [custom_name, device_type, id], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ message: 'Équipement modifié', changes: this.changes });
  });
});

// 5. DELETE /api/devices/:id - Supprimer un équipement
app.delete('/api/devices/:id', (req, res) => {
  const { id } = req.params;
  
  db.run('DELETE FROM devices WHERE id = ?', [id], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ message: 'Équipement supprimé', changes: this.changes });
  });
});

// 6. POST /api/scan - Scanner le réseau
app.post('/api/scan', async (req, res) => {
  try {
    const networkInfo = getNetworkInfo();
    const devices = await scanNetwork(networkInfo);
    
    // Enregistrer ou mettre à jour les équipements
    for (const device of devices) {
      await saveOrUpdateDevice(device);
    }
    
    res.json({ 
      message: 'Scan terminé', 
      devices_found: devices.length,
      devices 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 7. POST /api/check-status - Vérifier le statut de tous les équipements
app.post('/api/check-status', async (req, res) => {
  try {
    db.all('SELECT * FROM devices', async (err, devices) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      const results = [];
      
      for (const device of devices) {
        const isAlive = await checkDeviceStatus(device.ip_address);
        
        // Mettre à jour le statut
        db.run(
          'UPDATE devices SET is_active = ?, last_seen = CURRENT_TIMESTAMP WHERE id = ?',
          [isAlive ? 1 : 0, device.id]
        );
        
        // Enregistrer dans l'historique
        db.run(
          'INSERT INTO device_history (device_id, status) VALUES (?, ?)',
          [device.id, isAlive ? 1 : 0]
        );
        
        results.push({ 
          id: device.id, 
          ip: device.ip_address, 
          status: isAlive 
        });
      }
      
      res.json({ message: 'Vérification terminée', results });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 8. GET /api/devices/:id/history - Historique d'un équipement
app.get('/api/devices/:id/history', (req, res) => {
  const { id } = req.params;
  const limit = req.query.limit || 50;
  
  const sql = `SELECT * FROM device_history 
               WHERE device_id = ? 
               ORDER BY checked_at DESC 
               LIMIT ?`;
  
  db.all(sql, [id, limit], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// 9. GET /api/stats - Statistiques globales
app.get('/api/stats', (req, res) => {
  db.get(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active,
      SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) as inactive
    FROM devices
  `, (err, stats) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(stats);
  });
});

// ========== FONCTIONS UTILITAIRES ==========

// Obtenir les informations réseau
function getNetworkInfo() {
  const interfaces = os.networkInterfaces();
  
  for (const name in interfaces) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        const ip = iface.address;
        const subnet = ip.substring(0, ip.lastIndexOf('.'));
        return { ip, subnet };
      }
    }
  }
  return null;
}

// Scanner le réseau (simple ping scan)
async function scanNetwork(networkInfo) {
  if (!networkInfo) return [];
  
  const { subnet } = networkInfo;
  const devices = [];
  const promises = [];
  
  console.log(`🔍 Scan du réseau ${subnet}.0/24...`);
  
  for (let i = 1; i <= 254; i++) {
    const ip = `${subnet}.${i}`;
    promises.push(
      checkDeviceStatus(ip).then(isAlive => {
        if (isAlive) {
          devices.push({
            ip_address: ip,
            hostname: `device-${i}`,
            mac_address: null
          });
        }
      })
    );
  }
  
  await Promise.all(promises);
  console.log(`✅ Scan terminé: ${devices.length} équipements trouvés`);
  
  return devices;
}

// Vérifier si un équipement est actif
async function checkDeviceStatus(ip) {
  try {
    const result = await ping.promise.probe(ip, { timeout: 1 });
    return result.alive;
  } catch (error) {
    return false;
  }
}

// Enregistrer ou mettre à jour un équipement
function saveOrUpdateDevice(device) {
  return new Promise((resolve, reject) => {
    db.get('SELECT id FROM devices WHERE ip_address = ?', [device.ip_address], (err, row) => {
      if (err) return reject(err);
      
      if (row) {
        // Mise à jour
        db.run(
          'UPDATE devices SET is_active = 1, last_seen = CURRENT_TIMESTAMP WHERE id = ?',
          [row.id],
          (err) => err ? reject(err) : resolve()
        );
      } else {
        // Insertion
        db.run(
          'INSERT INTO devices (ip_address, hostname, is_active) VALUES (?, ?, 1)',
          [device.ip_address, device.hostname],
          (err) => err ? reject(err) : resolve()
        );
      }
    });
  });
}

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`🚀 Serveur NetMon démarré sur http://localhost:${PORT}`);
});