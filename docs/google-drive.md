---
files:
  - imports/client/components/GoogleLinkBlock.tsx
  - imports/lib/models/DocumentActivities.ts
  - imports/lib/models/FolderPermissions.ts
  - imports/methods/configureGoogleOAuthClient.ts
  - imports/methods/linkUserGoogleAccount.ts
  - imports/methods/unlinkUserGoogleAccount.ts
  - imports/server/gdriveActivityFetcher.ts
  - imports/server/googleClientRefresher.ts
  - imports/server/methods/configureGoogleOAuthClient.ts
  - imports/server/methods/linkUserGoogleAccount.ts
  - imports/server/methods/unlinkUserGoogleAccount.ts
  - imports/server/models/DriveActivityLatests.ts
updated: 2024-01-10
---

# Google Drive Integration

Google Drive is a core part of the collaboration model for Jolly Roger, and as
such we've built a fairly deep integration with the service over time. This
integration includes:

- Allowing users to link their Google accounts to their Jolly Roger accounts
- Creating files (documents and spreadsheets) in Google Drive whose lifecycles
  are tied to the lifecycles of their associated puzzles
- Using Google Drive's permissioning model to prevent users from appearing as
  "Anonymous Animals" without letting them take destructive actions
- Polling for recent edit activity on files and storing that data to surface as
  an indicator of how "hot" a given puzzle is
- An out-of-band mechanism for adding images to a Google Spreadsheet, since the
  native UI does not work when Google Sheets is presented in an iframe

While they are all interconnected, we'll attempt to look at each separately.

## Google OAuth

Although Meteor supports OAuth-based account login methods, Jolly Roger does
not. However, we leverage Meteor's native OAuth login support to allow users to
link their Google account to their (password-authenticated) Jolly Roger account.
This is why the OAuth application credentials are stored in
`ServiceConfiguration` (see the `configureGoogleOAuthClient` Meteor method)
instead of the `Settings` model, which we use for all other configuration
related to Google integrations. This is handled by the `GoogleLinkBlock` React
component and the `linkUserGoogleAccount` and `unlinkUserGoogleAccount` Meteor
methods.

On the server side, `imports/server/googleClientRefresher.ts` is responsible for
monitoring changes to various Google-related settings and ensuring that we
always have a Google API client initiated with valid credentials (assuming such
credentials are available). It exports that client for consumption by other
code.

## File lifecycle

TODO

- DocumentDisplay
- Documents
- addUserToHunt
- gdrive
- ensurePuzzleDocument

## File permissions

There are a few design goals that influenced how we manage permissions on Google
Drive resources:

- Allow users to edit files for hunts they are a part of, even if they have not
  linked a Google account.
- If possible, avoid users showing up as ["Anonymous
  Animals"][anonymous animals] and attribute their write activity to them.
- Prevent users from being able to delete or move files (accidentally or
  otherwise).
- Avoid various quotas and rate limits imposed by Google. This includes an
  overall rate limit on API calls (of around 3 per second) and an apparent
  "flood limit" on creating a high number of shares in a short time frame.

Our current system seems to largely accomplish these goals. We still
occasionally trigger rate limits when onboarding a large group of people
simultaneously, but we can generally still recover from this because of our
just-in-time verification and initialization logic.

To satisfy the first requirement, we grant the writer permission to "anyone" on
each file. (This is the equivalent of the "Anyone on the internet with the link
can edit" setting). This is the only permission we set on individual files and
the only place we grant any full writer permissions. When a puzzle is deleted,
we remove this permission to make the corresponding file read-only.

Since all files for a hunt live in a shared folder, we grant permissions on that
folder to any Google accounts linked to hunt members. Doing this once per folder
instead of once per puzzle avoids needing to call the create permissions API
once per puzzle per user, which would reliably result in rate limiting. Granting
_any_ permission on a folder is sufficient to prevent Anonymous Animals on files
in that folder. The "commenter" permission also results in edits being
attributed to that user in the Drive Activity API (instead of the file's owner),
while also preventing the user from being able to move or delete the files
themselves.

Any time we successfully grant a user access to a hunt folder, we keep a flag
record in the `FolderPermissions` model. This allows us to make permissions
grants idempotent without needing additional API requests. When a user is about
to access a document, we double-check that the folder permission record is
present. This allows us to be resilient both to transient issues and rate
limiting from Google's APIs and changes in state of the various circuit breaker
feature flags covering the Google Drive integration.

## Activity tracking

Edits on Google Drive files are a key indicator of solving activity on a puzzle,
so we collect activity data using the [Drive Activity API][]. The server runs a
loop in the background to periodically fetch activity data
(`imports/server/gdriveActivityFetcher.ts`).

The Drive Activity API lacks any way to request "records we haven't already
seen", so instead we filter based on timestamp. We store the most recent
timestamp we've observed in the `DriveActivityLatests` model (which only
contains a single record). Activity is tracked in the `DocumentActivities`
model, with a separate record per user so that we can deduplicate a single user
acting across Google Drive, voice calls, and Jolly Roger chat in the same time
bucket.

As a note, we experimented with using Google Drive watches (both
[drive][changes.watch] and [individual file][files.watch]), but found them to be
significantly lacking in functionality by comparison. Google Drive only sends
watch push notifications every 3 minutes and on a delay, giving us significantly
less granularity than we'd like. They also don't include any information about
who edited a file. Additionally, accepting incoming webhook requests from Google
Drive made development significantly more challenging, as it required some sort
of internet-accessible proxy.

## Image uploads

TODO:

- GoogleScriptInfo
- configureEnsureGoogleScript
- configureGoogleScriptUrl
- googleScriptContent
- insertDocumentImage
- listDocumentSheets
- private/google-script/

## Utility Meteor methods

TODO: configureCollectGoogleAccountIds, configureOrganizeGoogleDrive

[anonymous animals]: https://support.google.com/docs/answer/2494888?visit_id=1-636184745566842981-35709989&hl=en&rd=1
[Drive Activity API]: https://developers.google.com/drive/activity/v2
[changes.watch]: https://developers.google.com/drive/api/v2/reference/changes/watch
[files.watch]: https://developers.google.com/drive/api/reference/rest/v2/files/watch
