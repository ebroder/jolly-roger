// explicitly import all the stuff from lib/ since mainModule skips autoloading
// things
import '../imports/lib/config/accounts';

// Register migrations
import '../imports/server/migrations/all';

// Other stuff in the server folder
import '../imports/server/accounts';
import '../imports/server/announcements';
import '../imports/server/ansible';
import '../imports/server/api-init';
import '../imports/server/api_keys';
import '../imports/server/chat';
import '../imports/server/chat-notifications';
import '../imports/server/discord';
import '../imports/server/discord-client-refresher';
import '../imports/server/feature_flags';
import '../imports/server/fixture';
import '../imports/server/git_revision';
import '../imports/server/guesses';
import '../imports/server/hunts';
import '../imports/server/assets';
import '../imports/server/browserconfig';
import '../imports/server/site-manifest';
import '../imports/server/migrations-run'; // runs migrations
import '../imports/server/profile';
import '../imports/server/puzzle';
import '../imports/server/server-render';
import '../imports/server/setup';
import '../imports/server/subscribers';
import '../imports/server/operator';
import '../imports/server/users';
import '../imports/server/mediasoup';
import '../imports/server/mediasoup-api';

// Imports are necessary to make sure the modules are in the bundle
import ModelsFacade from '../imports/lib/models/facade';
import SchemasFacade from '../imports/lib/schemas/facade';

(global as any).Models = ModelsFacade;
(global as any).Schemas = SchemasFacade;
