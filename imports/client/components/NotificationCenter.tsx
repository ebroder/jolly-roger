/* eslint-disable max-len */
import { Meteor } from 'meteor/meteor';
import { OAuth } from 'meteor/oauth';
import { useSubscribe, useTracker } from 'meteor/react-meteor-data';
import { ServiceConfiguration } from 'meteor/service-configuration';
import { faCopy } from '@fortawesome/free-solid-svg-icons/faCopy';
import { faPuzzlePiece } from '@fortawesome/free-solid-svg-icons/faPuzzlePiece';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import React, { useCallback, useState } from 'react';
import Button from 'react-bootstrap/Button';
import OverlayTrigger from 'react-bootstrap/OverlayTrigger';
import Toast from 'react-bootstrap/Toast';
import ToastContainer from 'react-bootstrap/ToastContainer';
import Tooltip from 'react-bootstrap/Tooltip';
import CopyToClipboard from 'react-copy-to-clipboard';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import Flags from '../../Flags';
import { calendarTimeFormat } from '../../lib/calendarTimeFormat';
import { indexedById } from '../../lib/listUtils';
import Announcements from '../../lib/models/Announcements';
import ChatNotifications from '../../lib/models/ChatNotifications';
import Guesses from '../../lib/models/Guesses';
import Hunts from '../../lib/models/Hunts';
import { indexedDisplayNames } from '../../lib/models/MeteorUsers';
import PendingAnnouncements from '../../lib/models/PendingAnnouncements';
import Puzzles from '../../lib/models/Puzzles';
import { userIsOperatorForAnyHunt } from '../../lib/permission_stubs';
import { AnnouncementType } from '../../lib/schemas/Announcement';
import { ChatNotificationType } from '../../lib/schemas/ChatNotification';
import { GuessType } from '../../lib/schemas/Guess';
import { HuntType } from '../../lib/schemas/Hunt';
import { PuzzleType } from '../../lib/schemas/Puzzle';
import dismissChatNotification from '../../methods/dismissChatNotification';
import dismissPendingAnnouncement from '../../methods/dismissPendingAnnouncement';
import linkUserDiscordAccount from '../../methods/linkUserDiscordAccount';
import setGuessState from '../../methods/setGuessState';
import { guessURL } from '../../model-helpers';
import { requestDiscordCredential } from '../discord';
import { useOperatorActionsHidden } from '../hooks/persisted-state';
import markdown from '../markdown';
import Breakable from './styling/Breakable';

const StyledNotificationActionBar = styled.ul`
  display: flex;
  list-style-type: none;
  margin: 0;
  padding: 0;
  flex-direction: row;
`;

const StyledNotificationActionItem = styled.li`
  margin: 8px 8px 4px 0;
  display: inline-block;
`;

const GuessMessage = React.memo(({
  guess, puzzle, hunt, guesser, onDismiss,
}: {
  guess: GuessType;
  puzzle: PuzzleType;
  hunt: HuntType;
  guesser: string;
  onDismiss: (guessId: string) => void;
}) => {
  const markCorrect = useCallback(() => {
    setGuessState.call({ guessId: guess._id, state: 'correct' });
  }, [guess._id]);

  const markIncorrect = useCallback(() => {
    setGuessState.call({ guessId: guess._id, state: 'incorrect' });
  }, [guess._id]);

  const markRejected = useCallback(() => {
    setGuessState.call({ guessId: guess._id, state: 'rejected' });
  }, [guess._id]);

  const dismissGuess = useCallback(() => {
    onDismiss(guess._id);
  }, [onDismiss, guess._id]);

  const directionTooltip = (
    <Tooltip id={`guess-${guess._id}-direction-tooltip`}>
      Direction this puzzle was solved, ranging from completely backsolved (-10) to completely forward solved (10)
    </Tooltip>
  );
  const confidenceTooltip = (
    <Tooltip id={`guess-${guess._id}-confidence-tooltip`}>
      Submitter-estimated likelihood that this answer is correct
    </Tooltip>
  );
  const copyTooltip = (
    <Tooltip id={`guess-${guess._id}-copy-tooltip`}>
      Copy to clipboard
    </Tooltip>
  );
  const extLinkTooltip = (
    <Tooltip id={`guess-${guess._id}-ext-link-tooltip`}>
      Open puzzle
    </Tooltip>
  );

  const linkTarget = `/hunts/${puzzle.hunt}/puzzles/${puzzle._id}`;

  return (
    <Toast onClose={dismissGuess}>
      <Toast.Header>
        <strong className="me-auto">
          Guess for
          {' '}
          <a href={linkTarget} target="_blank" rel="noopener noreferrer">
            {puzzle.title}
          </a>
          {' '}
          from
          {' '}
          <a href={`/users/${guess.createdBy}`} target="_blank" rel="noopener noreferrer">
            <Breakable>{guesser}</Breakable>
          </a>
        </strong>
      </Toast.Header>
      <Toast.Body>
        <div>
          <Breakable>{guess.guess}</Breakable>
        </div>
        <div>
          <OverlayTrigger placement="top" overlay={directionTooltip}>
            <span>
              Solve direction:
              {' '}
              {guess.direction}
            </span>
          </OverlayTrigger>
        </div>
        <div>
          <OverlayTrigger placement="top" overlay={confidenceTooltip}>
            <span>
              Confidence:
              {' '}
              {guess.confidence}
              %
            </span>
          </OverlayTrigger>
        </div>
        <StyledNotificationActionBar>
          <StyledNotificationActionItem>
            <OverlayTrigger placement="top" overlay={copyTooltip}>
              {({ ref, ...triggerHandler }) => (
                <CopyToClipboard text={guess.guess} {...triggerHandler}>
                  <Button variant="outline-secondary" size="sm" ref={ref} aria-label="Copy"><FontAwesomeIcon icon={faCopy} /></Button>
                </CopyToClipboard>
              )}
            </OverlayTrigger>
          </StyledNotificationActionItem>
          <StyledNotificationActionItem>
            <OverlayTrigger placement="top" overlay={extLinkTooltip}>
              <Button variant="outline-secondary" size="sm" as="a" href={guessURL(hunt, puzzle)} target="_blank" rel="noopener noreferrer">
                <FontAwesomeIcon icon={faPuzzlePiece} />
              </Button>
            </OverlayTrigger>
          </StyledNotificationActionItem>
        </StyledNotificationActionBar>
        <StyledNotificationActionBar>
          <StyledNotificationActionItem>
            <Button variant="outline-secondary" size="sm" onClick={markCorrect}>Correct</Button>
          </StyledNotificationActionItem>
          <StyledNotificationActionItem>
            <Button variant="outline-secondary" size="sm" onClick={markIncorrect}>Incorrect</Button>
          </StyledNotificationActionItem>
          <StyledNotificationActionItem>
            <Button variant="outline-secondary" size="sm" onClick={markRejected}>Reject</Button>
          </StyledNotificationActionItem>
        </StyledNotificationActionBar>
      </Toast.Body>
    </Toast>
  );
});

enum DiscordMessageStatus {
  IDLE = 'idle',
  LINKING = 'linking',
  ERROR = 'error',
  SUCCESS = 'success',
}

type DiscordMessageState = {
  status: DiscordMessageStatus;
  error?: string;
}

const DiscordMessage = React.memo(({ onDismiss }: {
  onDismiss: () => void;
}) => {
  const [state, setState] = useState<DiscordMessageState>({ status: DiscordMessageStatus.IDLE });

  const requestComplete = useCallback((token: string) => {
    const secret = OAuth._retrieveCredentialSecret(token);
    if (!secret) {
      setState({ status: DiscordMessageStatus.IDLE });
      return;
    }

    linkUserDiscordAccount.call({ key: token, secret }, (error) => {
      if (error) {
        setState({ status: DiscordMessageStatus.ERROR, error: error.message });
      } else {
        setState({ status: DiscordMessageStatus.IDLE });
      }
    });
  }, []);

  const initiateOauthFlow = useCallback(() => {
    setState({ status: DiscordMessageStatus.LINKING });
    requestDiscordCredential(requestComplete);
  }, [requestComplete]);

  const msg = 'It looks like you\'re not in our Discord server, which Jolly Roger manages access to.  Get added:';
  const actions = [
    <StyledNotificationActionItem key="invite">
      <Button
        variant="outline-secondary"
        disabled={!(state.status === DiscordMessageStatus.IDLE || state.status === DiscordMessageStatus.ERROR)}
        onClick={initiateOauthFlow}
      >
        Add me
      </Button>
    </StyledNotificationActionItem>,
  ];

  return (
    <Toast onClose={onDismiss}>
      <Toast.Header>
        <strong className="me-auto">
          Discord account not linked
        </strong>
      </Toast.Header>
      <Toast.Body>
        {msg}
        <StyledNotificationActionBar>
          {actions}
        </StyledNotificationActionBar>
        {state.status === DiscordMessageStatus.ERROR ? state.error! : null}
      </Toast.Body>
    </Toast>
  );
});

const AnnouncementMessage = React.memo(({
  id, announcement, createdByDisplayName,
}: {
  id: string;
  announcement: AnnouncementType;
  createdByDisplayName: string;
}) => {
  const [dismissed, setDismissed] = useState<boolean>(false);
  const onDismiss = useCallback(() => {
    setDismissed(true);
    dismissPendingAnnouncement.call({ pendingAnnouncementId: id });
  }, [id]);

  if (dismissed) {
    return null;
  }

  return (
    <Toast onClose={onDismiss}>
      <Toast.Header>
        <strong className="me-auto">
          Announcement
        </strong>
        <small>
          {calendarTimeFormat(announcement.createdAt)}
        </small>
      </Toast.Header>
      <Toast.Body>
        <div
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: markdown(announcement.message) }}
        />
        <div>
          {'- '}
          {createdByDisplayName}
        </div>
      </Toast.Body>
    </Toast>
  );
});

const ProfileMissingMessage = ({ onDismiss }: {
  onDismiss: () => void;
}) => {
  return (
    <Toast onClose={onDismiss}>
      <Toast.Header>
        <strong className="me-auto">
          Profile missing
        </strong>
      </Toast.Header>
      <Toast.Body>
        Somehow you don&apos;t seem to have a profile.  (This can happen if you wind
        up having to do a password reset before you successfully log in for the
        first time.)  Please set a display name for yourself via
        {' '}
        <Link to="/users/me">
          the profile page
        </Link>
        .
      </Toast.Body>
    </Toast>
  );
};

const ChatNotificationMessage = ({
  cn, hunt, puzzle, senderDisplayName,
}: {
  cn: ChatNotificationType;
  hunt: HuntType;
  puzzle: PuzzleType;
  senderDisplayName: string;
}) => {
  const id = cn._id;
  const dismiss = useCallback(() => dismissChatNotification.call({ chatNotificationId: id }), [id]);

  return (
    <Toast onClose={dismiss}>
      <Toast.Header>
        <strong className="me-auto">
          Mention on
          {' '}
          <Link to={`/hunts/${hunt._id}/puzzles/${puzzle._id}`}>
            {puzzle.title}
          </Link>
        </strong>
        <small>
          {calendarTimeFormat(cn.createdAt)}
        </small>
      </Toast.Header>
      <Toast.Body>
        <div>
          {senderDisplayName}
          {': '}
          <div>
            {cn.text}
          </div>
        </div>
      </Toast.Body>
    </Toast>
  );
};

const StyledToastContainer = styled(ToastContainer)`
  z-index: 1050;

  >*:not(:last-child) {
    // I like these toasts packed a little more efficiently
    margin-bottom: 0.5rem;
  }
`;

const NotificationCenter = () => {
  const fetchPendingGuesses = useTracker(() => userIsOperatorForAnyHunt(Meteor.userId()), []);
  const pendingGuessesLoading = useSubscribe(fetchPendingGuesses ? 'pendingGuesses' : undefined);

  const [operatorActionsHidden = {}] = useOperatorActionsHidden();

  const pendingAnnouncementsLoading = useSubscribe('pendingAnnouncements');

  const disableDingwords = useTracker(() => Flags.active('disable.dingwords'));
  const chatNotificationsLoading = useSubscribe(disableDingwords ? undefined : 'chatNotifications');

  const loading =
    pendingGuessesLoading() ||
    pendingAnnouncementsLoading() ||
    chatNotificationsLoading();

  const discordEnabledOnServer = useTracker(() => (
    !!ServiceConfiguration.configurations.findOne({ service: 'discord' }) && !Flags.active('disable.discord')
  ), []);
  const { hasOwnProfile, discordConfiguredByUser } = useTracker(() => {
    const user = Meteor.user()!;
    return {
      hasOwnProfile: !!(user.displayName),
      discordConfiguredByUser: !!(user.discordAccount),
    };
  }, []);

  // Lookup tables to support guesses/pendingAnnouncements/chatNotifications
  const hunts = useTracker(() => (loading ? new Map<string, HuntType>() : indexedById(Hunts.find().fetch())), [loading]);
  const puzzles = useTracker(() => (loading ? new Map<string, PuzzleType>() : indexedById(Puzzles.find().fetch())), [loading]);
  const displayNames = useTracker(() => (loading ? {} : indexedDisplayNames()), [loading]);
  const announcements = useTracker(() => (loading ? new Map<string, AnnouncementType>() : indexedById(Announcements.find().fetch())), [loading]);

  const guesses = useTracker(() => (
    loading || !fetchPendingGuesses ?
      [] :
      Guesses.find({ state: 'pending' }, { sort: { createdAt: 1 } }).fetch()
  ), [loading, fetchPendingGuesses]);
  const pendingAnnouncements = useTracker(() => (
    loading ?
      [] :
      PendingAnnouncements.find({ user: Meteor.userId()! }, { sort: { createdAt: 1 } }).fetch()
  ), [loading]);
  const chatNotifications = useTracker(() => (
    loading || disableDingwords ?
      [] :
      ChatNotifications.find({}, { sort: { timestamp: 1 } }).fetch()
  ), [loading, disableDingwords]);

  const [hideDiscordSetupMessage, setHideDiscordSetupMessage] = useState<boolean>(false);
  const [hideProfileSetupMessage, setHideProfileSetupMessage] = useState<boolean>(false);
  const [dismissedGuesses, setDismissedGuesses] = useState<Record<string, Date>>({});

  const onHideDiscordSetupMessage = useCallback(() => {
    setHideDiscordSetupMessage(true);
  }, []);

  const onHideProfileSetupMessage = useCallback(() => {
    setHideProfileSetupMessage(true);
  }, []);

  const dismissGuess = useCallback((guessId: string) => {
    setDismissedGuesses((prevDismissedGuesses) => {
      const newState: Record<string, Date> = {};
      newState[guessId] = new Date();
      Object.assign(newState, prevDismissedGuesses);
      return newState;
    });
  }, []);

  if (loading) {
    return <div />;
  }

  // Build a list of uninstantiated messages with their props, then create them
  const messages = [] as JSX.Element[];

  if (!hasOwnProfile && !hideProfileSetupMessage) {
    messages.push(<ProfileMissingMessage
      key="profile"
      onDismiss={onHideProfileSetupMessage}
    />);
  }

  if (discordEnabledOnServer &&
    !discordConfiguredByUser &&
    !hideDiscordSetupMessage) {
    messages.push(<DiscordMessage key="discord" onDismiss={onHideDiscordSetupMessage} />);
  }

  guesses.forEach((g) => {
    const dismissedAt = dismissedGuesses[g._id];
    if (dismissedAt && dismissedAt > (g.updatedAt ?? g.createdAt)) return;
    if (operatorActionsHidden[g.hunt]) return;
    messages.push(<GuessMessage
      key={g._id}
      guess={g}
      puzzle={puzzles.get(g.puzzle)!}
      hunt={hunts.get(g.hunt)!}
      guesser={displayNames[g.createdBy]!}
      onDismiss={dismissGuess}
    />);
  });

  pendingAnnouncements.forEach((pa) => {
    messages.push(
      <AnnouncementMessage
        key={pa._id}
        id={pa._id}
        announcement={announcements.get(pa.announcement)!}
        createdByDisplayName={displayNames[pa.createdBy]!}
      />
    );
  });

  chatNotifications.forEach((cn) => {
    messages.push(
      <ChatNotificationMessage
        key={cn._id}
        cn={cn}
        hunt={hunts.get(cn.hunt)!}
        puzzle={puzzles.get(cn.puzzle)!}
        senderDisplayName={displayNames[cn.sender]!}
      />
    );
  });

  return (
    <StyledToastContainer position="bottom-end" className="p-3 position-fixed">
      {messages}
    </StyledToastContainer>
  );
};

export default NotificationCenter;
