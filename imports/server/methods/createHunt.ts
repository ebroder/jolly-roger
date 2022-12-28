import { check } from 'meteor/check';
import { Meteor } from 'meteor/meteor';
import Hunts from '../../lib/models/Hunts';
import MeteorUsers from '../../lib/models/MeteorUsers';
import { addUserToRole, checkAdmin } from '../../lib/permission_stubs';
import { HuntPattern } from '../../lib/schemas/Hunt';
import createHunt from '../../methods/createHunt';
import addUsersToDiscordRole from '../addUsersToDiscordRole';
import { ensureHuntFolder } from '../gdrive';
import getOrCreateTagByName from '../getOrCreateTagByName';

const DEFAULT_TAGS = [
  'is:meta',
  'is:metameta',
  'is:runaround',
  'priority:high',
  'priority:low',
  'type:crossword',
  'type:duck-konundrum',
  'group:events',
  'needs:extraction',
  'needs:onsite  ',
];

createHunt.define({
  validate(arg) {
    check(arg, HuntPattern);
    return arg;
  },

  async run(arg) {
    check(this.userId, String);
    checkAdmin(this.userId);

    const huntId = await Hunts.insertAsync(arg);
    addUserToRole(this.userId, huntId, 'operator');

    await DEFAULT_TAGS.reduce(async (p, tag) => {
      await p;
      await getOrCreateTagByName(huntId, tag);
    }, Promise.resolve());

    Meteor.defer(async () => {
      // Sync discord roles
      const userIds = (await MeteorUsers.find({ hunts: huntId }).fetchAsync()).map((u) => u._id);
      await addUsersToDiscordRole(userIds, huntId);
      await ensureHuntFolder({ _id: huntId, name: arg.name });
    });

    return huntId;
  },
});
