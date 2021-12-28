// Used to perform periodic garbage collection tasks, particularly around
// previous server instances that would normally have taken care of cleanup
// themselves, but terminated ungracefully.

import os from 'os';
import { Meteor } from 'meteor/meteor';
import { Random } from 'meteor/random';
import Servers from '../lib/models/servers';

const serverId = Random.id();

// Global registry of callbacks to run when we determine that a backend is dead.
const globalGCHooks: ((deadServers: string[]) => void)[] = [];

function registerPeriodicCleanupHook(f: (deadServers: string[]) => void): void {
  globalGCHooks.push(f);
}

function cleanup() {
  Servers.upsert({ _id: serverId }, {
    $set: {
      pid: process.pid,
      hostname: os.hostname(),
    },
  });

  // Servers disappearing should be a fairly rare occurrence, but a disappearing
  // server that's hosting an audio call blocks that call from proceeding until
  // it's garbage collected, so set the timeouts on the tighter side. 5 seconds
  // should be quick enough to recover without users noticing too much
  // interruption, but long enough to account for transient blocking.
  const timeout = new Date(Date.now() - 5 * 1000);
  const deadServers = Servers.find({ updatedAt: { $lt: timeout } })
    .map((server) => server._id);
  if (deadServers.length === 0) {
    return;
  }

  // Run all hooks.
  globalGCHooks.forEach((f) => f(deadServers));

  // Delete the record of the server, now that we've cleaned up after it.
  Servers.remove({ _id: { $in: deadServers } });
}

function periodic() {
  Meteor.setTimeout(periodic, 500 + (1000 * Random.fraction()));
  cleanup();
}

// Defer the first run to give other startup hooks a chance to run
Meteor.startup(() => Meteor.defer(() => periodic()));

export { serverId, registerPeriodicCleanupHook };
