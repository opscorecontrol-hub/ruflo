import { nanoid } from 'nanoid';
import { writeQueue, runQuery, getOne, getAll } from '../db/init.js';
import { bus } from '../events.js';

const PROVIDER = process.env.VM_PROVIDER || 'local';
const HCLOUD_TOKEN = process.env.HCLOUD_TOKEN;
const HCLOUD_BASE = 'https://api.hetzner.cloud/v1';

function hcloudHeaders() {
  return {
    'Authorization': `Bearer ${HCLOUD_TOKEN}`,
    'Content-Type': 'application/json'
  };
}

async function hcloudRequest(method, path, body) {
  const res = await fetch(`${HCLOUD_BASE}${path}`, {
    method,
    headers: hcloudHeaders(),
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30000)
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Hetzner API ${method} ${path} → ${res.status}: ${text}`);
  }
  return res.status === 204 ? null : res.json();
}

async function createLocalVm(swarmId, config) {
  const id = nanoid();
  const name = `local-vm-${id.slice(0, 8)}`;
  const ip_address = `10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
  const created_at = Date.now();

  await writeQueue(() => {
    runQuery(
      'INSERT INTO vms (id, swarm_id, provider, name, ip_address, instance_type, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, swarmId, 'local', name, ip_address, config.instanceType || 'cx22', 'running', created_at]
    );
  });

  const vm = getOne('SELECT * FROM vms WHERE id = ?', [id]);
  bus.emit('vm:status', { vmId: id, swarmId, status: 'running' });
  return vm;
}

async function createHetznerVm(swarmId, config) {
  if (!HCLOUD_TOKEN) throw new Error('HCLOUD_TOKEN not set');

  const id = nanoid();
  const name = `blackbird-${id.slice(0, 8)}`;
  const created_at = Date.now();

  await writeQueue(() => {
    runQuery(
      'INSERT INTO vms (id, swarm_id, provider, name, instance_type, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, swarmId, 'hetzner', name, config.instanceType || 'cx22', 'pending', created_at]
    );
  });

  const data = await hcloudRequest('POST', '/servers', {
    name,
    server_type: config.instanceType || 'cx22',
    image: 'ubuntu-24.04',
    location: config.region || 'nbg1',
    labels: { swarm_id: swarmId, managed_by: 'blackbird2030' }
  });

  const server = data.server;
  const ip_address = server.public_net?.ipv4?.ip || null;

  await writeQueue(() => {
    runQuery(
      'UPDATE vms SET provider_id = ?, ip_address = ?, status = ? WHERE id = ?',
      [String(server.id), ip_address, 'running', id]
    );
  });

  const vm = getOne('SELECT * FROM vms WHERE id = ?', [id]);
  bus.emit('vm:status', { vmId: id, swarmId, status: 'running' });
  return vm;
}

export async function createVm(swarmId, config = {}) {
  const provider = config.provider || PROVIDER;
  if (provider === 'hetzner') return createHetznerVm(swarmId, config);
  return createLocalVm(swarmId, config);
}

export async function destroyVm(vmId) {
  const vm = getOne('SELECT * FROM vms WHERE id = ?', [vmId]);
  if (!vm) return;

  if (vm.provider === 'hetzner' && vm.provider_id && HCLOUD_TOKEN) {
    try {
      await hcloudRequest('DELETE', `/servers/${vm.provider_id}`);
    } catch (err) {
      console.warn('[vmProvisioner] Hetzner delete failed:', err.message);
    }
  }

  await writeQueue(() => {
    runQuery("UPDATE vms SET status = 'terminated' WHERE id = ?", [vmId]);
  });

  bus.emit('vm:status', { vmId, swarmId: vm.swarm_id, status: 'terminated' });
}

export function listVms(swarmId) {
  if (swarmId) {
    return getAll('SELECT * FROM vms WHERE swarm_id = ? ORDER BY created_at DESC', [swarmId]);
  }
  return getAll('SELECT * FROM vms ORDER BY created_at DESC');
}

export async function syncVmStatus(vmId) {
  const vm = getOne('SELECT * FROM vms WHERE id = ?', [vmId]);
  if (!vm) return null;

  if (vm.provider !== 'hetzner' || !vm.provider_id || !HCLOUD_TOKEN) {
    return vm;
  }

  try {
    const data = await hcloudRequest('GET', `/servers/${vm.provider_id}`);
    const server = data.server;
    const status = server.status === 'running' ? 'running' : server.status;
    const ip_address = server.public_net?.ipv4?.ip || vm.ip_address;

    await writeQueue(() => {
      runQuery(
        'UPDATE vms SET status = ?, ip_address = ? WHERE id = ?',
        [status, ip_address, vmId]
      );
    });

    bus.emit('vm:status', { vmId, swarmId: vm.swarm_id, status });
    return getOne('SELECT * FROM vms WHERE id = ?', [vmId]);
  } catch (err) {
    console.warn('[vmProvisioner] syncVmStatus failed:', err.message);
    return vm;
  }
}
