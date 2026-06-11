import * as vmProvisioner from '../services/vmProvisioner.js';
import { cleanupOrphanedVms } from '../services/swarmController.js';
import { getOne, getAll } from '../db/init.js';

export default async function vmRoutes(fastify) {
  const auth = { onRequest: [fastify.authenticate] };

  fastify.get('/api/vms', auth, async (request) => {
    const { swarm_id } = request.query;
    return vmProvisioner.listVms(swarm_id || null);
  });

  fastify.post('/api/vms', auth, async (request, reply) => {
    const { swarm_id, provider, instanceType, instance_type, region } = request.body || {};
    if (!swarm_id) return reply.code(400).send({ error: 'swarm_id required' });
    try {
      const vm = await vmProvisioner.createVm(swarm_id, { provider, instanceType: instanceType || instance_type, region });
      return reply.code(201).send(vm);
    } catch (err) {
      return reply.code(500).send({ error: err.message });
    }
  });

  fastify.get('/api/vms/:id', auth, async (request, reply) => {
    const vm = getOne('SELECT * FROM vms WHERE id = ?', [request.params.id]);
    if (!vm) return reply.code(404).send({ error: 'VM not found' });
    return vm;
  });

  fastify.delete('/api/vms/:id', auth, async (request, reply) => {
    const vm = getOne('SELECT * FROM vms WHERE id = ?', [request.params.id]);
    if (!vm) return reply.code(404).send({ error: 'VM not found' });
    try {
      await vmProvisioner.destroyVm(request.params.id);
      return reply.code(204).send();
    } catch (err) {
      return reply.code(500).send({ error: err.message });
    }
  });

  fastify.post('/api/vms/:id/sync', auth, async (request, reply) => {
    const vm = getOne('SELECT * FROM vms WHERE id = ?', [request.params.id]);
    if (!vm) return reply.code(404).send({ error: 'VM not found' });
    const updated = await vmProvisioner.syncVmStatus(request.params.id);
    return updated;
  });

  // Returns count of active VMs per status, with agent assignment stats
  fastify.get('/api/vms/health', auth, async () => {
    const vms = getAll('SELECT * FROM vms WHERE status != ?', ['terminated']);
    const result = vms.map(vm => {
      const agents = getAll(
        "SELECT id, status FROM agents WHERE vm_id = ? AND status != 'terminated'",
        [vm.id]
      );
      return { ...vm, agentCount: agents.length, agents };
    });
    const orphaned = result.filter(v => v.agentCount === 0);
    return { total: result.length, orphaned: orphaned.length, vms: result };
  });

  // Destroy all VMs that have zero live agents assigned (safe to call any time)
  fastify.post('/api/vms/cleanup', auth, async (request, reply) => {
    try {
      const report = await cleanupOrphanedVms();
      return { ok: true, destroyed: report.destroyed.length, ids: report.destroyed };
    } catch (err) {
      return reply.code(500).send({ error: err.message });
    }
  });
}
