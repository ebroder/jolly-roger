import { Meteor } from 'meteor/meteor';
import { Roles } from 'meteor/nicolaslopezj:roles';
import { useTracker } from 'meteor/react-meteor-data';
import { _ } from 'meteor/underscore';
import DOMPurify from 'dompurify';
import marked from 'marked';
import moment from 'moment';
import React, { useCallback, useState } from 'react';
import Alert from 'react-bootstrap/Alert';
import Button from 'react-bootstrap/Button';
import { withBreadcrumb } from 'react-breadcrumbs-context';
import { RouteComponentProps } from 'react-router';
import Announcements from '../../lib/models/announcements';
import Profiles from '../../lib/models/profiles';
import { AnnouncementType } from '../../lib/schemas/announcements';

/* eslint-disable max-len */

interface AnnouncementFormProps {
  huntId: string;
}

enum AnnouncementFormSubmitState {
  IDLE = 'idle',
  SUBMITTING = 'submitting',
  FAILED = 'failed',
}

const AnnouncementForm = (props: AnnouncementFormProps) => {
  const [message, setMessage] = useState<string>('');
  const [submitState, setSubmitState] = useState<AnnouncementFormSubmitState>(AnnouncementFormSubmitState.IDLE);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const onMessageChanged = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(event.target.value);
  }, []);

  const postAnnouncement = useCallback(() => {
    if (message) {
      setSubmitState(AnnouncementFormSubmitState.SUBMITTING);
      Meteor.call('postAnnouncement', props.huntId, message, (error?: Error) => {
        if (error) {
          setErrorMessage(error.message);
          setSubmitState(AnnouncementFormSubmitState.FAILED);
        } else {
          setErrorMessage('');
          setSubmitState(AnnouncementFormSubmitState.IDLE);
        }
      });
    }
  }, [message, props.huntId]);

  return (
    <div className="announcement-form">
      <h3>Write an announcement:</h3>
      {submitState === 'failed' ? <Alert variant="danger">{errorMessage}</Alert> : null}
      <textarea
        value={message}
        onChange={onMessageChanged}
        disabled={submitState === 'submitting'}
      />
      <div>Try to keep it brief and on-point.</div>
      <div className="button-row">
        <Button
          variant="primary"
          onClick={postAnnouncement}
          disabled={submitState === 'submitting'}
        >
          Send
        </Button>
      </div>
    </div>
  );
};

interface AnnouncementProps {
  announcement: AnnouncementType;
  displayNames: Record<string, string>;
}

const Announcement = (props: AnnouncementProps) => {
  const ann = props.announcement;

  // TODO: All the styles here could stand to be improved, but this gets it on the screen in a
  // minimally-offensive manner, and preserves the intent of newlines.
  return (
    <div className="announcement">
      <div className="announcement-origin">
        <div className="announcement-timestamp">{moment(ann.createdAt).calendar()}</div>
        <div>{props.displayNames[ann.createdBy]}</div>
      </div>
      <div
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: marked(DOMPurify.sanitize(ann.message)) }}
      />
    </div>
  );
};

interface AnnouncementsPageParams {
  huntId: string;
}

interface AnnouncementsPageWithRouterParams extends RouteComponentProps<AnnouncementsPageParams> {
}

interface AnnouncementsPageTracker {
  ready: boolean;
  canCreateAnnouncements: boolean;
  announcements: AnnouncementType[];
  displayNames: Record<string, string>;
}

const AnnouncementsPage = (props: AnnouncementsPageWithRouterParams) => {
  const tracker = useTracker<AnnouncementsPageTracker>(() => {
    // We already have subscribed to mongo.announcements on the main page, since we want to be able
    // to show them on any page.  So we don't *need* to make the subscription here...
    // ...except that we might want to wait to render until we've received all of them?  IDK.
    const announcementsHandle = Meteor.subscribe('mongo.announcements', { hunt: props.match.params.huntId });
    const displayNamesHandle = Profiles.subscribeDisplayNames();
    const ready = announcementsHandle.ready() && displayNamesHandle.ready();

    let announcements: AnnouncementType[];
    let displayNames: Record<string, string>;
    if (!ready) {
      announcements = [];
      displayNames = {};
    } else {
      announcements = Announcements.find({ hunt: props.match.params.huntId }, { sort: { createdAt: 1 } }).fetch();
      displayNames = Profiles.displayNames();
    }
    const canCreateAnnouncements = Roles.userHasPermission(Meteor.userId(), 'mongo.announcements.insert');

    return {
      ready,
      announcements,
      canCreateAnnouncements,
      displayNames,
    };
  }, [props.match.params.huntId]);

  if (!tracker.ready) {
    return <div>loading...</div>;
  }

  return (
    <div>
      <h1>Announcements</h1>
      {tracker.canCreateAnnouncements && <AnnouncementForm huntId={props.match.params.huntId} />}
      {/* ostensibly these should be ul and li, but then I have to deal with overriding
          block/inline and default margins and list style type and meh */}
      <div>
        {tracker.announcements.map((announcement) => {
          return (
            <Announcement
              key={announcement._id}
              announcement={announcement}
              displayNames={tracker.displayNames}
            />
          );
        })}
      </div>
    </div>
  );
};

const crumb = withBreadcrumb(({ match }: AnnouncementsPageWithRouterParams) => {
  return { title: 'Announcements', path: `/hunts/${match.params.huntId}/announcements` };
});

const AnnouncementsPageContainer = crumb(AnnouncementsPage);
export default AnnouncementsPageContainer;
