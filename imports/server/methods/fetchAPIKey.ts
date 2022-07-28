import { check, Match } from 'meteor/check';
import { Random } from 'meteor/random';
import Ansible from '../../Ansible';
import fetchAPIKey from '../../methods/fetchAPIKey';
import APIKeys from '../models/APIKeys';
import Locks from '../models/Locks';
import userForKeyOperation from '../userForKeyOperation';

fetchAPIKey.define({
  validate(arg) {
    check(arg, { forUser: Match.Optional(String) });

    return arg;
  },

  run({ forUser }) {
    check(this.userId, String);

    const user = userForKeyOperation(this.userId, forUser);

    let key = APIKeys.findOne({ user });
    if (!key) {
      // It would be cool to handle this with unique indexes, but we
      // need partial indexes to only match { deleted: false }, and I
      // don't want to assume a new enough version of MongoDB for
      // that.
      Locks.withLock(`api_key:${user}`, () => {
        key = APIKeys.findOne({ user });

        if (!key) {
          Ansible.log('Generating new API key for user', { user, requestedBy: this.userId });
          key = APIKeys.findOne(
            APIKeys.insert({
              user,
              key: Random.id(32),
            })
          );
        }
      });
    }

    return key!.key;
  },
});
