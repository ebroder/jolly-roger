import { Meteor } from 'meteor/meteor';
import Discord from 'discord.js';
import Flags from '../Flags';
import DiscordCache from '../lib/models/DiscordCache';
import MeteorUsers from '../lib/models/MeteorUsers';
import Settings from '../lib/models/Settings';
import { SettingType } from '../lib/schemas/Setting';
import Locks, { PREEMPT_TIMEOUT } from './models/Locks';
import onExit from './onExit';

type DiscordEventsWithArguments<Args> = {
  [K in keyof Discord.ClientEvents]-?: Discord.ClientEvents[K] extends Args ? K : never;
}[keyof Discord.ClientEvents]

class DiscordClientRefresher {
  public client?: Discord.Client;

  private token?: string;

  private configObserveHandle: Meteor.LiveQueryHandle;

  private featureFlagObserveHandle: Meteor.LiveQueryHandle;

  private wakeup?: () => void;

  constructor() {
    this.client = undefined;
    this.token = undefined;

    const configCursor = Settings.find({ name: 'discord.bot' });
    this.configObserveHandle = configCursor.observe({
      added: (doc) => this.updateBotConfig(doc),
      changed: (doc) => this.updateBotConfig(doc),
      removed: () => this.clearBotConfig(),
    });

    this.featureFlagObserveHandle = Flags.observeChanges('disable.discord', () => this.refreshClient());
  }

  ready() {
    return !!this.client;
  }

  shutdown() {
    this.configObserveHandle.stop();
    this.featureFlagObserveHandle.stop();
    this.clearBotConfig();
  }

  updateBotConfig(doc: SettingType) {
    if (doc.name !== 'discord.bot') {
      return; // this should be impossible
    }

    this.token = doc.value.token;
    this.refreshClient();
  }

  clearBotConfig() {
    this.token = undefined;
    this.refreshClient();
  }

  refreshClient() {
    if (this.client) {
      this.client.destroy();
      this.client = undefined;
    }

    if (this.wakeup) {
      this.wakeup();
      this.wakeup = undefined;
    }

    if (Flags.active('disable.discord')) {
      return;
    }

    if (this.token) {
      const client = new Discord.Client();
      // Setting the token makes this client usable for REST API calls, but
      // won't connect to the websocket gateway
      client.token = this.token;
      this.client = client;

      Meteor.defer(() => {
        void Locks.withLock('discord-bot', async (lock) => {
          // The token gets set to null when the gateway is destroyed. If it's
          // been destroyed, bail, since that means that the config changed and
          // another defer function will have been scheduled
          if (!client.token) {
            return;
          }

          // Start renewing the lock now in the background (remember -
          // "background" includes blocking on awaited promises)
          const renew = Meteor.setInterval(async () => {
            try {
              await Locks.renew(lock);
            } catch {
              // we must have lost the lock
              this.refreshClient();
            }
          }, PREEMPT_TIMEOUT / 2);

          try {
            // If we get the lock, we're responsible for opening the websocket
            // gateway connection
            const ready = new Promise<void>((r) => { client.on('ready', r); });
            await client.login(this.token);
            await ready;

            await this.cacheResource(client, 'guild', client.guilds.cache, 'guildCreate', 'guildUpdate', 'guildDelete');
            await this.cacheResource(client, 'channel', client.channels.cache, 'channelCreate', 'channelUpdate', 'channelDelete');

            // Role update events are global, but the cache of roles is not
            const allRoles = client.guilds.cache.reduce((
              roles: Map<Discord.Snowflake, Discord.Role>,
              guild,
            ) => {
              guild.roles.cache.forEach((r) => roles.set(r.id, r));
              return roles;
            }, new Map());
            await this.cacheResource(client, 'role', allRoles, 'roleCreate', 'roleUpdate', 'roleDelete');

            const updateUser = (u: Discord.User) => {
              void MeteorUsers.updateAsync({
                'discordAccount.id': u.id,
              }, {
                $set: {
                  'discordAccount.username': u.username,
                  'discordAccount.discriminator': u.discriminator,
                  'discordAccount.avatar': u.avatar,
                },
              }, {
                multi: true,
              });
            };
            client.on('userUpdate', Meteor.bindEnvironment((_, u) => updateUser(u)));
            client.users.cache.forEach(Meteor.bindEnvironment(updateUser));

            const invalidated = new Promise<void>((r) => { client.on('invalidated', r); });
            const wakeup = new Promise<void>((r) => {
              this.wakeup = r;
            });

            const wokenUp = await Promise.race([
              wakeup.then(() => true),
              invalidated.then(() => false),
            ]);
            // if we were explicitly woken up, then another instance of
            // refreshClient fired off and we don't have to do anything;
            // otherwise we need to clean things up ourselves
            if (!wokenUp) {
              this.refreshClient();
            }
          } finally {
            Meteor.clearInterval(renew);
          }
        });
      });
    }
  }

  async cacheResource<
    ResourceType extends Discord.Base & { id: Discord.Snowflake },
    CreateEvent extends DiscordEventsWithArguments<[ResourceType]>,
    UpdateEvent extends DiscordEventsWithArguments<[ResourceType, ResourceType]>,
    DeleteEvent extends DiscordEventsWithArguments<[ResourceType]>,
  >(
    client: Discord.Client,
    type: string,
    cache: ReadonlyMap<Discord.Snowflake, ResourceType>,
    createEvent: CreateEvent,
    updateEvent: UpdateEvent,
    deleteEvent: DeleteEvent,
  ) {
    const oldIds = await DiscordCache.find({ type }).mapAsync((c) => c.snowflake);
    const newIds = new Set(...cache.keys());
    const toDelete = oldIds.filter((x) => !newIds.has(x));
    await DiscordCache.removeAsync({ type, snowflake: { $in: toDelete } });

    await [...cache.entries()].reduce(async (p, [k, v]) => {
      await p;
      await DiscordCache.upsertAsync({
        type,
        snowflake: k,
      }, {
        $set: {
          type,
          snowflake: k,
          object: v.toJSON() as any,
        },
      });
    }, Promise.resolve());

    client.on(createEvent, (Meteor.bindEnvironment((r: ResourceType) => {
      void DiscordCache.upsertAsync({
        type,
        snowflake: r.id,
      }, {
        $set: {
          type,
          snowflake: r.id,
          object: r.toJSON() as any,
        },
      });
    })) as any);
    client.on(updateEvent, (Meteor.bindEnvironment((_oldR: ResourceType, r: ResourceType) => {
      void DiscordCache.upsertAsync({
        type,
        snowflake: r.id,
      }, {
        $set: {
          type,
          snowflake: r.id,
          object: r.toJSON() as any,
        },
      });
    })) as any);
    client.on(deleteEvent, (Meteor.bindEnvironment((r: ResourceType) => {
      void DiscordCache.removeAsync({ type, snowflake: r.id });
    })) as any);
  }
}

const discordClientRefresher = new DiscordClientRefresher();
Meteor.startup(() => {
  onExit(Meteor.bindEnvironment(() => discordClientRefresher.shutdown()));
});

export default discordClientRefresher;
