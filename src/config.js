/**
 * !!! NOTE !!!
 *
 * If you're setting up the bot, DO NOT EDIT THIS FILE DIRECTLY!
 *
 * Create a configuration file in the same directory as the example file.
 * You never need to edit anything under src/ to use the bot.
 *
 * !!! NOTE !!!
 */

const fs = require('fs');
const path = require('path');

let userConfig = {};

// Config files to search for, in priority order
const configFiles = [
  'config.ini',
  'config.ini.ini',
  'config.ini.txt',
  'config.json',
  'config.json5',
  'config.json.json',
  'config.json.txt',
  'config.js'
];

let foundConfigFile;
for (const configFile of configFiles) {
  try {
    fs.accessSync(__dirname + '/../' + configFile);
    foundConfigFile = configFile;
    break;
  } catch (e) {}
}

// Load config file
if (foundConfigFile) {
  console.log(`Loading configuration from ${foundConfigFile}...`);
  try {
    if (foundConfigFile.endsWith('.js')) {
      userConfig = require(`../${foundConfigFile}`);
    } else {
      const raw = fs.readFileSync(__dirname + '/../' + foundConfigFile, {encoding: "utf8"});
      if (foundConfigFile.endsWith('.ini') || foundConfigFile.endsWith('.ini.txt')) {
        userConfig = require('ini').decode(raw);
      } else {
        userConfig = require('json5').parse(raw);
      }
    }
  } catch (e) {
    throw new Error(`Error reading config file! The error given was: ${e.message}`);
  }
}

const required = ['token', 'mailGuildId', 'mainGuildId', 'logChannelId'];
const numericOptions = ['requiredAccountAge', 'requiredTimeOnServer', 'smallAttachmentLimit', 'port'];

const defaultConfig = {
  "token": null,
  "mailGuildId": null,
  "mainGuildId": null,
  "logChannelId": null,

  "prefix": "!",
  "snippetPrefix": "!!",
  "snippetPrefixAnon": "!!!",

  "status": "Message me for help!",
  "responseMessage": "Thank you for your message! Our mod team will reply to you here as soon as possible.",
  "closeMessage": null,
  "allowUserClose": false,

  "newThreadCategoryId": null,
  "mentionRole": "here",
  "pingOnBotMention": true,
  "botMentionResponse": null,

  "inboxServerPermission": null,
  "alwaysReply": false,
  "alwaysReplyAnon": false,
  "useNicknames": false,
  "ignoreAccidentalThreads": false,
  "threadTimestamps": false,
  "allowMove": false,
  "syncPermissionsOnMove": true,
  "typingProxy": false,
  "typingProxyReverse": false,
  "mentionUserInThreadHeader": false,
  "rolesInThreadHeader": false,

  "enableGreeting": false,
  "greetingMessage": null,
  "greetingAttachment": null,

  "guildGreetings": {},

  "requiredAccountAge": null, // In hours
  "accountAgeDeniedMessage": "Your Discord account is not old enough to contact modmail.",

  "requiredTimeOnServer": null, // In minutes
  "timeOnServerDeniedMessage": "You haven't been a member of the server for long enough to contact modmail.",

  "relaySmallAttachmentsAsAttachments": false,
  "smallAttachmentLimit": 1024 * 1024 * 2,
  "attachmentStorage": "local",
  "attachmentStorageChannelId": null,

  "categoryAutomation": {},

  "updateNotifications": true,
  "plugins": [],

  "commandAliases": {},

  "port": 8890,
  "url": null,

  "dbDir": path.join(__dirname, '..', 'db'),
  "knex": null,

  "logDir": path.join(__dirname, '..', 'logs'),
};

// Load config values from environment variables
const envKeyPrefix = 'MM_';
let loadedEnvValues = 0;

for (const [key, value] of Object.entries(process.env)) {
  if (! key.startsWith(envKeyPrefix)) continue;

  // MM_CLOSE_MESSAGE -> closeMessage
  // MM_COMMAND_ALIASES__MV => commandAliases.mv
  const configKey = key.slice(envKeyPrefix.length)
    .toLowerCase()
    .replace(/([a-z])_([a-z])/g, (m, m1, m2) => `${m1}${m2.toUpperCase()}`)
    .replace('__', '.');

  userConfig[configKey] = value.includes('||')
    ? value.split('||')
    : value;

  loadedEnvValues++;
}

if (process.env.PORT && !process.env.MM_PORT) {
  // Special case: allow common "PORT" environment variable without prefix
  userConfig.port = process.env.PORT;
  loadedEnvValues++;
}

if (loadedEnvValues > 0) {
  console.log(`Loaded ${loadedEnvValues} ${loadedEnvValues === 1 ? 'value' : 'values'} from environment variables`);
}

// Convert config keys with periods to objects
// E.g. commandAliases.mv -> commandAliases: { mv: ... }
for (const [key, value] of Object.entries(userConfig)) {
  if (! key.includes('.')) continue;

  const keys = key.split('.');
  let cursor = userConfig;
  for (let i = 0; i < keys.length; i++) {
    if (i === keys.length - 1) {
      cursor[keys[i]] = value;
    } else {
      cursor[keys[i]] = cursor[keys[i]] || {};
      cursor = cursor[keys[i]];
    }
  }

  delete userConfig[key];
}

// Combine user config with default config to form final config
const finalConfig = Object.assign({}, defaultConfig);

for (const [prop, value] of Object.entries(userConfig)) {
  if (! defaultConfig.hasOwnProperty(prop)) {
    throw new Error(`Unknown option: ${prop}`);
  }

  finalConfig[prop] = value;
}

// Default knex config
if (! finalConfig['knex']) {
  finalConfig['knex'] = {
    client: 'pg',
    connection: process.env.DATABASE_URL,
  };
}

// Make sure migration settings are always present in knex config
Object.assign(finalConfig['knex'], {
  migrations: {
    directory: path.join(finalConfig.dbDir, 'migrations')
  }
});

if (finalConfig.smallAttachmentLimit > 1024 * 1024 * 8) {
  finalConfig.smallAttachmentLimit = 1024 * 1024 * 8;
  console.warn('[WARN] smallAttachmentLimit capped at 8MB');
}

// Specific checks
if (finalConfig.attachmentStorage === 'discord' && ! finalConfig.attachmentStorageChannelId) {
  console.error('Config option \'attachmentStorageChannelId\' is required with attachment storage \'discord\'');
  process.exit(1);
}

// Make sure mainGuildId is internally always an array
if (! Array.isArray(finalConfig['mainGuildId'])) {
  finalConfig['mainGuildId'] = [finalConfig['mainGuildId']];
}

// Make sure inboxServerPermission is always an array
if (! Array.isArray(finalConfig['inboxServerPermission'])) {
  if (finalConfig['inboxServerPermission'] == null) {
    finalConfig['inboxServerPermission'] = [];
  } else {
    finalConfig['inboxServerPermission'] = [finalConfig['inboxServerPermission']];
  }
}

// Move greetingMessage/greetingAttachment to the guildGreetings object internally
// Or, in other words, if greetingMessage and/or greetingAttachment is set, it is applied for all servers that don't
// already have something set up in guildGreetings. This retains backwards compatibility while allowing you to override
// greetings for specific servers in guildGreetings.
if (finalConfig.greetingMessage || finalConfig.greetingAttachment) {
  for (const guildId of finalConfig.mainGuildId) {
    if (finalConfig.guildGreetings[guildId]) continue;
    finalConfig.guildGreetings[guildId] = {
      message: finalConfig.greetingMessage,
      attachment: finalConfig.greetingAttachment
    };
  }
}

// newThreadCategoryId is syntactic sugar for categoryAutomation.newThread
if (finalConfig.newThreadCategoryId) {
  finalConfig.categoryAutomation.newThread = finalConfig.newThreadCategoryId;
  delete finalConfig.newThreadCategoryId;
}

// Turn empty string options to null (i.e. "option=" without a value in config.ini)
for (const [key, value] of Object.entries(finalConfig)) {
  if (value === '') {
    finalConfig[key] = null;
  }
}

// Cast numeric options to numbers
for (const numericOpt of numericOptions) {
  if (finalConfig[numericOpt] != null) {
    const number = parseFloat(finalConfig[numericOpt]);
    if (Number.isNaN(number)) {
      console.error(`Invalid numeric value for ${numericOpt}: ${finalConfig[numericOpt]}`);
      process.exit(1);
    }
    finalConfig[numericOpt] = number;
  }
}

// Cast boolean options (on, true, 1) (off, false, 0)
for (const [key, value] of Object.entries(finalConfig)) {
  if (typeof value !== "string") continue;
  if (["on", "true", "1"].includes(value)) {
    finalConfig[key] = true;
  } else if (["off", "false", "0"].includes(value)) {
    finalConfig[key] = false;
  }
}

// Make sure all of the required config options are present
for (const opt of required) {
  if (! finalConfig[opt]) {
    console.error(`Missing required configuration value: ${opt}`);
    process.exit(1);
  }
}

console.log("Configuration ok!");

module.exports = finalConfig;
