# Profile Helpers

Node.js scripts for creating a demo Owl Airlines passenger profile in Twilio Conversation Memory.

## Scenario

Avery Stone is an Owl Club Gold passenger with an upcoming London to San Francisco trip (OA404). Avery is trying to move
from a middle seat to a window seat near the front of the cabin.

## Usage

Install dependencies (once):

```bash
npm install
```

Run the full profile setup after creating a Memory Store:

```bash
node helpers/profile/run_all.js <TWILIO_MEMORY_STORE_ID>
```

Or set `TWILIO_MEMORY_STORE_ID` in `.env` and run:

```bash
npm run profile
```

Run individual steps when demoing the API calls:

```bash
npm run profile:trait-groups
npm run profile:create
npm run profile:observations
npm run profile:verify
```

Or invoke them directly with `node`:

```bash
node helpers/profile/1_create_trait_groups.js <TWILIO_MEMORY_STORE_ID>
node helpers/profile/2_create_profile.js <TWILIO_MEMORY_STORE_ID>
node helpers/profile/3_add_observations.js <TWILIO_MEMORY_STORE_ID> <TWILIO_MEMORY_PROFILE_ID>
node helpers/profile/4_verify_memory.js <TWILIO_MEMORY_STORE_ID> <TWILIO_MEMORY_PROFILE_ID>
```

The `Contact` trait group is system-managed by Twilio. These scripts create and clean up only the
custom Owl Airlines groups listed in `TWILIO_MEMORY_PROFILE_TRAIT_GROUPS`.

Cleanup is dry-run by default:

```bash
npm run profile:cleanup
npm run profile:cleanup:apply
```

You can also clean up one part of the profile setup:

```bash
node helpers/profile/0_cleanup.js profile <TWILIO_MEMORY_PROFILE_ID>
node helpers/profile/0_cleanup.js traits <TWILIO_MEMORY_STORE_ID>
node helpers/profile/0_cleanup.js --yes all <TWILIO_MEMORY_STORE_ID> <TWILIO_MEMORY_PROFILE_ID>
```
