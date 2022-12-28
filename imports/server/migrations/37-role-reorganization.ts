import { GLOBAL_SCOPE } from '../../lib/is-admin';
import MeteorUsers from '../../lib/models/MeteorUsers';
import Migrations from './Migrations';

Migrations.add({
  version: 37,
  name: 'Reorganize roles and eliminate inactiveOperator',
  async up() {
    // Casts necessary to account for schema changes

    for await (const user of MeteorUsers.find({ roles: 'inactiveOperator' } as any)) {
      await MeteorUsers.updateAsync(user._id, {
        $push: { roles: 'operator' },
      } as any, {
        validate: false,
        filter: false,
      } as any);
      await MeteorUsers.updateAsync(user._id, {
        $pull: { roles: 'inactiveOperator' },
      } as any, {
        validate: false,
        filter: false,
      } as any);
    }

    for await (const user of MeteorUsers.find({ roles: { $type: 'array' } })) {
      const newRoles: Record<string, string[]> = {};
      (user.roles as unknown as string[]).forEach((role) => {
        if (role === 'operator') {
          user.hunts?.forEach((huntId) => {
            newRoles[huntId] ||= [];
            newRoles[huntId]!.push('operator');
          });
        } else {
          newRoles[GLOBAL_SCOPE] ||= [];
          newRoles[GLOBAL_SCOPE].push(role);
        }
      });

      await MeteorUsers.updateAsync(user._id, {
        $set: { roles: newRoles },
      }, { validate: false } as any);
    }
  },
});
