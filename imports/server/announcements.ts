import { check } from 'meteor/check';
import { Meteor } from 'meteor/meteor';
import Ansible from '../ansible';
import Announcements from '../lib/models/announcements';
import MeteorUsers from '../lib/models/meteor_users';
import PendingAnnouncements from '../lib/models/pending_announcements';
import { userMayAddAnnouncementToHunt } from '../lib/permission_stubs';

Meteor.methods({
  postAnnouncement(huntId: unknown, message: unknown) {
    check(this.userId, String);
    check(huntId, String);
    check(message, String);

    if (!userMayAddAnnouncementToHunt(this.userId, huntId)) {
      throw new Meteor.Error(401, `User ${this.userId} may not create annoucements for hunt ${huntId}`);
    }

    Ansible.log('Creating an announcement', { user: this.userId, hunt: huntId, message });
    const id = Announcements.insert({
      hunt: huntId,
      message,
    });

    MeteorUsers.find({ hunts: huntId }).forEach((user) => {
      PendingAnnouncements.insert({
        hunt: huntId,
        announcement: id,
        user: user._id,
      });
    });
  },

  dismissPendingAnnouncement(pendingAnnouncementId: unknown) {
    check(this.userId, String);
    check(pendingAnnouncementId, String);

    PendingAnnouncements.remove({
      _id: pendingAnnouncementId,
      user: this.userId,
    });
  },
});
