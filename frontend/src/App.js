import React, { useState, useEffect } from 'react';
import { RefreshCw, Wifi, WifiOff, Plus, Trash2, Edit, Activity } from 'lucide-react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export default function NetMon() {
  const [devices, setDevices] = useState([]);
  const [stats, setStats] = useState({ total: 0, active: 0, inactive: 0 });
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editDevice, setEditDevice] = useState(null);

  useEffect(() => {
    loadDevices();
    loadStats();
    
    const interval = setInterval(() => {
      checkAllStatus();
      loadStats();
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const loadDevices = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/devices`);
      const data = await response.json();
      setDevices(data);
    } catch (error) {
      console.error('Erreur:', error);
    }
    setLoading(false);
  };

  const loadStats = async () => {
    try {
      const response = await fetch(`${API_URL}/stats`);
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Erreur:', error);
    }
  };

  const scanNetwork = async () => {
    setScanning(true);
    try {
      const response = await fetch(`${API_URL}/scan`, { method: 'POST' });
      const data = await response.json();
      alert(`Scan terminé: ${data.devices_found} équipements trouvés`);
      loadDevices();
      loadStats();
    } catch (error) {
      alert('Erreur lors du scan');
    }
    setScanning(false);
  };

  const checkAllStatus = async () => {
    try {
      await fetch(`${API_URL}/check-status`, { method: 'POST' });
      loadDevices();
      loadStats();
    } catch (error) {
      console.error('Erreur:', error);
    }
  };

  const deleteDevice = async (id) => {
    if (!window.confirm('Supprimer cet équipement ?')) return;     
    try {
      await fetch(`${API_URL}/devices/${id}`, { method: 'DELETE' });
      loadDevices();
      loadStats();
    } catch (error) {
      alert('Erreur lors de la suppression');
    }
  };

  const updateDevice = async (id, data) => {
    try {
      await fetch(`${API_URL}/devices/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      loadDevices();
      setEditDevice(null);
    } catch (error) {
      alert('Erreur lors de la modification');
    }
  };

  const addDevice = async (data) => {
    try {
      await fetch(`${API_URL}/devices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      loadDevices();
      loadStats();
      setShowAddModal(false);
    } catch (error) {
      alert('Erreur lors de l\'ajout');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-blue-600 text-white p-6 shadow-lg">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Activity size={36} />
            NetMon - Surveillance Réseau
          </h1>
          <p className="text-blue-100 mt-2">
            Gérez et surveillez vos équipements réseau en temps réel
          </p>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <StatCard title="Total" value={stats.total} color="bg-blue-500" icon={<Activity />} />
          <StatCard title="Actifs" value={stats.active} color="bg-green-500" icon={<Wifi />} />
          <StatCard title="Inactifs" value={stats.inactive} color="bg-red-500" icon={<WifiOff />} />
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex flex-wrap gap-4">
            <button
              onClick={scanNetwork}
              disabled={scanning}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
            >
              <RefreshCw className={scanning ? 'animate-spin' : ''} size={20} />
              {scanning ? 'Scan en cours...' : 'Scanner le réseau'}
            </button>
            
            <button
              onClick={checkAllStatus}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Activity size={20} />
              Vérifier statuts
            </button>
            
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              <Plus size={20} />
              Ajouter manuellement
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="p-4 bg-gray-100 border-b">
            <h2 className="text-xl font-semibold">
              Équipements ({devices.length})
            </h2>
          </div>
          
          {loading ? (
            <div className="p-8 text-center text-gray-500">Chargement...</div>
          ) : devices.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              Aucun équipement. Lancez un scan pour commencer.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">IP</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nom</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dernière vue</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {devices.map(device => (
                    <DeviceRow
                      key={device.id}
                      device={device}
                      onEdit={setEditDevice}
                      onDelete={deleteDevice}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showAddModal && <AddDeviceModal onClose={() => setShowAddModal(false)} onAdd={addDevice} />}
      {editDevice && <EditDeviceModal device={editDevice} onClose={() => setEditDevice(null)} onUpdate={updateDevice} />}
    </div>
  );
}

function StatCard({ title, value, color, icon }) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-500 text-sm font-medium">{title}</p>
          <p className="text-3xl font-bold mt-2">{value}</p>
        </div>
        <div className={`${color} p-3 rounded-full text-white`}>{icon}</div>
      </div>
    </div>
  );
}

function DeviceRow({ device, onEdit, onDelete }) {
  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-3">
        {device.is_active ? (
          <span className="flex items-center gap-2 text-green-600">
            <Wifi size={18} />Actif
          </span>
        ) : (
          <span className="flex items-center gap-2 text-red-600">
            <WifiOff size={18} />Inactif
          </span>
        )}
      </td>
      <td className="px-4 py-3 font-mono text-sm">{device.ip_address}</td>
      <td className="px-4 py-3">{device.custom_name || device.hostname || '-'}</td>
      <td className="px-4 py-3">
        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
          {device.device_type || 'Non défini'}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-gray-500">
        {new Date(device.last_seen).toLocaleString('fr-FR')}
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-2">
          <button onClick={() => onEdit(device)} className="p-1 text-blue-600 hover:bg-blue-50 rounded">
            <Edit size={18} />
          </button>
          <button onClick={() => onDelete(device.id)} className="p-1 text-red-600 hover:bg-red-50 rounded">
            <Trash2 size={18} />
          </button>
        </div>
      </td>
    </tr>
  );
}

function AddDeviceModal({ onClose, onAdd }) {
  const [form, setForm] = useState({
    ip_address: '',
    custom_name: '',
    device_type: 'Ordinateur'
  });

  const handleSubmit = () => {
    if (!form.ip_address) {
      alert('L\'adresse IP est requise');
      return;
    }
    onAdd(form);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
        <h3 className="text-xl font-bold mb-4">Ajouter un équipement</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Adresse IP *</label>
            <input
              type="text"
              placeholder="192.168.1.10"
              value={form.ip_address}
              onChange={e => setForm({...form, ip_address: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Nom personnalisé</label>
            <input
              type="text"
              placeholder="Mon PC"
              value={form.custom_name}
              onChange={e => setForm({...form, custom_name: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Type</label>
            <select
              value={form.device_type}
              onChange={e => setForm({...form, device_type: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option>Ordinateur</option>
              <option>Smartphone</option>
              <option>Tablette</option>
              <option>IoT</option>
              <option>Serveur</option>
              <option>Imprimante</option>
              <option>Autre</option>
            </select>
          </div>
          <div className="flex gap-2 pt-4">
            <button onClick={handleSubmit} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              Ajouter
            </button>
            <button onClick={onClose} className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">
              Annuler
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EditDeviceModal({ device, onClose, onUpdate }) {
  const [form, setForm] = useState({
    custom_name: device.custom_name || '',
    device_type: device.device_type || 'Ordinateur'
  });

  const handleSubmit = () => {
    onUpdate(device.id, form);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
        <h3 className="text-xl font-bold mb-4">Modifier l'équipement</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">IP (non modifiable)</label>
            <input
              type="text"
              disabled
              value={device.ip_address}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Nom personnalisé</label>
            <input
              type="text"
              placeholder="Mon PC"
              value={form.custom_name}
              onChange={e => setForm({...form, custom_name: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Type</label>
            <select
              value={form.device_type}
              onChange={e => setForm({...form, device_type: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option>Ordinateur</option>
              <option>Smartphone</option>
              <option>Tablette</option>
              <option>IoT</option>
              <option>Serveur</option>
              <option>Imprimante</option>
              <option>Autre</option>
            </select>
          </div>
          <div className="flex gap-2 pt-4">
            <button onClick={handleSubmit} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              Modifier
            </button>
            <button onClick={onClose} className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">
              Annuler
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}