import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateScaling } from './scalingPolicy.js';

const base = { agentCount: 5, vmCount: 1, avgLoad: 50, queueDepth: 10, policy: { minAgents: 1, maxAgents: 20 } };

describe('evaluateScaling', () => {
  it('returns none when load is in normal range', () => {
    const r = evaluateScaling(base);
    assert.equal(r.action, 'none');
    assert.equal(r.delta, 0);
  });

  it('returns scale_up when avgLoad > HIGH_LOAD and under maxAgents', () => {
    const r = evaluateScaling({ ...base, avgLoad: 90 });
    assert.equal(r.action, 'scale_up');
    assert.ok(r.delta >= 1 && r.delta <= 2);
  });

  it('does not scale_up when already at maxAgents', () => {
    const r = evaluateScaling({ ...base, avgLoad: 90, agentCount: 20 });
    assert.notEqual(r.action, 'scale_up');
  });

  it('returns spawn_agents when queueDepth > QUEUE_DEPTH threshold', () => {
    const r = evaluateScaling({ ...base, queueDepth: 60 });
    assert.equal(r.action, 'spawn_agents');
    assert.ok(r.delta >= 1 && r.delta <= 3);
  });

  it('does not spawn_agents when already at maxAgents', () => {
    const r = evaluateScaling({ ...base, queueDepth: 60, agentCount: 20 });
    assert.notEqual(r.action, 'spawn_agents');
  });

  it('returns scale_down when avgLoad < LOW_LOAD and above minAgents', () => {
    const r = evaluateScaling({ ...base, avgLoad: 10 });
    assert.equal(r.action, 'scale_down');
    assert.equal(r.delta, 1);
  });

  it('does not scale_down when already at minAgents', () => {
    const r = evaluateScaling({ ...base, avgLoad: 10, agentCount: 1 });
    assert.notEqual(r.action, 'scale_down');
  });

  it('scale_up delta capped at 2', () => {
    const r = evaluateScaling({ ...base, avgLoad: 95, agentCount: 19 });
    assert.equal(r.action, 'scale_up');
    assert.equal(r.delta, 1);
  });

  it('spawn_agents delta capped at 3', () => {
    const r = evaluateScaling({ ...base, queueDepth: 100, agentCount: 2 });
    assert.equal(r.action, 'spawn_agents');
    assert.ok(r.delta <= 3);
  });

  it('scale_up takes priority over spawn_agents', () => {
    const r = evaluateScaling({ ...base, avgLoad: 90, queueDepth: 60 });
    assert.equal(r.action, 'scale_up');
  });

  it('uses policy maxAgents boundary', () => {
    const r = evaluateScaling({ ...base, avgLoad: 90, policy: { minAgents: 1, maxAgents: 5 } });
    assert.notEqual(r.action, 'scale_up');
  });

  it('uses policy minAgents boundary', () => {
    const r = evaluateScaling({ ...base, avgLoad: 10, agentCount: 3, policy: { minAgents: 3, maxAgents: 20 } });
    assert.notEqual(r.action, 'scale_down');
  });
});
