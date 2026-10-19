# Profile Helpers

Scripts for creating a demo Owl Airlines passenger profile in Twilio Conversation Memory.

## Scenario

Avery Stone is an Owl Club Gold passenger with an upcoming SFO to JFK trip. Avery is trying to move
from a middle seat to a window seat near the front of the cabin.

## Usage

Run the full profile setup after creating a Memory Store:

```bash
./helpers/profile/run_all.sh <TWILIO_MEMORY_STORE_ID>
```

Or set `TWILIO_MEMORY_STORE_ID` in `.env` and run:

```bash
./helpers/profile/run_all.sh
```

Run individual steps when demoing the API calls:

```bash
./helpers/profile/1_create_trait_groups.sh <TWILIO_MEMORY_STORE_ID>
./helpers/profile/2_create_profile.sh <TWILIO_MEMORY_STORE_ID>
./helpers/profile/3_add_observations.sh <TWILIO_MEMORY_STORE_ID> <TWILIO_MEMORY_PROFILE_ID>
./helpers/profile/4_verify_memory.sh <TWILIO_MEMORY_STORE_ID> <TWILIO_MEMORY_PROFILE_ID>
```

The `Contact` trait group is system-managed by Twilio. These scripts create and clean up only the
custom Owl Airlines groups listed in `TWILIO_MEMORY_PROFILE_TRAIT_GROUPS`.

`2_create_profile.sh` stores `DEMO_CALLER_PHONE_NUMBER` as the profile's `Contact.phone`. During a
call or message, TAC uses that channel address to resolve the profile dynamically. The profile ID
printed by these helpers is only for setup operations such as adding observations, verifying Recall,
and cleanup; it is not application runtime configuration.

Cleanup is dry-run by default:

```bash
./helpers/profile/0_cleanup.sh
./helpers/profile/0_cleanup.sh --yes
```

You can also clean up one part of the profile setup:

```bash
./helpers/profile/0_cleanup.sh profile <TWILIO_MEMORY_PROFILE_ID>
./helpers/profile/0_cleanup.sh traits <TWILIO_MEMORY_STORE_ID>
./helpers/profile/0_cleanup.sh --yes all <TWILIO_MEMORY_STORE_ID> <TWILIO_MEMORY_PROFILE_ID>
```
