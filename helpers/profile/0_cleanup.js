// Delete the demo passenger profile and optional Owl Airlines trait groups.
//
// Usage:
//   node helpers/profile/0_cleanup.js                                      # dry-run all from .env
//   node helpers/profile/0_cleanup.js --yes                                # delete all from .env
//   node helpers/profile/0_cleanup.js profile <TWILIO_MEMORY_PROFILE_ID>
//   node helpers/profile/0_cleanup.js --yes profile <TWILIO_MEMORY_PROFILE_ID>
//   node helpers/profile/0_cleanup.js --yes profile <TWILIO_MEMORY_STORE_ID> <TWILIO_MEMORY_PROFILE_ID>
//   node helpers/profile/0_cleanup.js traits <TWILIO_MEMORY_STORE_ID>
//   node helpers/profile/0_cleanup.js --yes traits <TWILIO_MEMORY_STORE_ID>
//   node helpers/profile/0_cleanup.js --yes all <TWILIO_MEMORY_STORE_ID> <TWILIO_MEMORY_PROFILE_ID>

import {
  findInListing,
  isNotFoundError,
  loadEnv,
  prettyPrint,
  requireTwilioAuth,
  twilioRequest,
} from '../common.js';

function parseArgs(argv) {
  const args = argv.slice(2);
  let dryRun = true;
  if (args[0] === '--yes') {
    dryRun = false;
    args.shift();
  }

  let target = args[0] || 'all';
  let memoryStoreId = process.env.TWILIO_MEMORY_STORE_ID;
  let profileId = process.env.TWILIO_MEMORY_PROFILE_ID;

  switch (target) {
    case 'all':
      if (args[1]) memoryStoreId = args[1];
      if (args[2]) profileId = args[2];
      break;
    case 'profile':
      if (args[2]) {
        memoryStoreId = args[1];
        profileId = args[2];
      } else if (args[1]) {
        profileId = args[1];
      }
      break;
    case 'traits':
      if (args[1]) memoryStoreId = args[1];
      break;
    default:
      if (args[1]) {
        memoryStoreId = args[0];
        profileId = args[1];
        target = 'all';
      } else if (args[0]) {
        profileId = args[0];
        target = 'all';
      } else {
        console.error(`Unknown cleanup target: ${target}`);
        process.exit(1);
      }
  }

  return { dryRun, target, memoryStoreId, profileId };
}

async function deleteProfile({ memoryStoreId, profileId, dryRun }) {
  if (!profileId) {
    console.log('Skipping Passenger Profile: no TWILIO_MEMORY_PROFILE_ID configured.');
    console.log('');
    return;
  }
  if (!memoryStoreId) {
    console.error('Missing TWILIO_MEMORY_STORE_ID.');
    process.exit(1);
  }

  const url = `https://memory.twilio.com/v1/Stores/${memoryStoreId}/Profiles/${profileId}`;
  console.log('Deleting Passenger Profile...');
  console.log(`DELETE ${url}`);
  if (!dryRun) {
    try {
      prettyPrint(await twilioRequest('DELETE', url));
    } catch (err) {
      if (!isNotFoundError(err)) throw err;
      console.log('Passenger Profile not found; already deleted.');
    }
  }
  console.log('');
}

async function findTraitGroupId(baseUrl, name) {
  const listing = await twilioRequest('GET', baseUrl);
  // The API may return the list under different envelope keys, so
  // findInListing walks the whole response looking for a match.
  const matches = findInListing(listing, (v) => v.displayName === name || v.name === name);
  return matches.map((v) => v.id || v.sid || v.uniqueName).find(Boolean) || null;
}

async function deleteTraitGroup({ baseUrl, name, dryRun }) {
  console.log(`Finding Trait Group: ${name}`);
  console.log(`GET ${baseUrl}`);

  if (dryRun) {
    console.log(`DELETE ${baseUrl}/<${name} trait group id>`);
    console.log('');
    return;
  }

  const traitGroupId = await findTraitGroupId(baseUrl, name);

  if (traitGroupId) {
    const url = `${baseUrl}/${traitGroupId}`;
    console.log(`Deleting Trait Group: ${name}`);
    console.log(`DELETE ${url}`);
    const response = await twilioRequest('DELETE', url);
    prettyPrint(response);
    console.log('');
    return;
  }

  const fallbackUrl = `${baseUrl}/${name}`;
  console.log(`Deleting Trait Group by display name: ${name}`);
  console.log(`DELETE ${fallbackUrl}`);
  try {
    prettyPrint(await twilioRequest('DELETE', fallbackUrl));
  } catch (err) {
    if (!isNotFoundError(err)) throw err;
    console.log(`Trait Group "${name}" not found; already deleted.`);
  }
  console.log('');
}

async function deleteTraitGroups({ memoryStoreId, dryRun }) {
  if (!memoryStoreId) {
    console.error('Missing TWILIO_MEMORY_STORE_ID.');
    process.exit(1);
  }
  const baseUrl = `https://memory.twilio.com/v1/ControlPlane/Stores/${memoryStoreId}/TraitGroups`;
  const groups = (process.env.TWILIO_MEMORY_PROFILE_TRAIT_GROUPS || 'Loyalty,Travel')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  for (const name of groups) {
    await deleteTraitGroup({ baseUrl, name, dryRun });
  }
}

async function run() {
  loadEnv();
  const { dryRun, target, memoryStoreId, profileId } = parseArgs(process.argv);

  if (dryRun) {
    console.log('Dry run. No Twilio profile resources will be deleted.');
    console.log('Add --yes to apply deletion.');
    console.log('');
  } else {
    requireTwilioAuth();
  }

  switch (target) {
    case 'all':
      await deleteProfile({ memoryStoreId, profileId, dryRun });
      await deleteTraitGroups({ memoryStoreId, dryRun });
      break;
    case 'profile':
      await deleteProfile({ memoryStoreId, profileId, dryRun });
      break;
    case 'traits':
      await deleteTraitGroups({ memoryStoreId, dryRun });
      break;
  }

  console.log('Done.');
}

await run();
