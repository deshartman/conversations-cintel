# Conversation Intelligence: manual setup (Console)

The Owl Air demo sets up Conversation Intelligence **by hand in the Twilio Console**. Nothing here is
scripted. Do not use `npm run setup` steps 3-4 for this.

**Prerequisites:** the Memory Store and Conversation Configuration exist (setup steps 1-2), and the
account has accepted the Conversations terms (`npm run preflight` passes).

## 1. Create the custom language operators

Console: **Orchestration → Conversation Intelligence → Language operators → Create operator**.
Create both operators below. Copy the prompt and JSON schema exactly, with output format **JSON**.

### Operator: `offer-coupon`

Decides whether Owl Airlines should offer a recovery coupon.

Prompt:

```text
Return true when the customer is frustrated, impacted by a delay or cancellation, or should receive a loyalty recovery gesture. Return false otherwise.
```

JSON output schema:

```json
{
  "additionalProperties": false,
  "properties": {
    "offer_coupon": {
      "description": "Whether Owl Airlines should offer a recovery coupon.",
      "type": "boolean"
    }
  },
  "required": [
    "offer_coupon"
  ],
  "type": "object"
}
```

### Operator: `Intent-Recognition`

Identifies what the customer is trying to do right now.

Prompt:

```text
Identify the customer's current intent and return a short description. Examples: Change seats, Human escalation, Add check-in baggage, Flight change, Loyalty recovery.
```

JSON output schema:

```json
{
  "additionalProperties": false,
  "properties": {
    "description": {
      "description": "A short description of the customer's intent.",
      "type": "string"
    }
  },
  "required": [
    "description"
  ],
  "type": "object"
}
```

## 2. Create the Intelligence configuration

Console: **Orchestration → Conversation Intelligence → Intelligence configurations → Create
intelligence configuration**.

- **Name:** e.g. `OwlAir-Intel`
- **Attach Conversation Configuration:** pick the Owl Air Conversation Configuration from setup step 2
  (`TWILIO_CONVERSATION_CONFIGURATION_ID`).

The attached Conversation Configuration controls *which* conversations get analysed.

## 3. Add a rule

On the new Intelligence configuration, click **Create rule**:

- **Operators:** add `offer-coupon` and `Intent-Recognition`.
- **Trigger:** choose live (during the conversation) or **At conversation end**.
- **Action:** keep the results in the Console. This app has **no `/ci-webhook` route**, so a webhook
  action pointed at the app would return 404.

## 4. Show the results

Run a test call or SMS as Avery, then open the conversation in the Console to show the operator
results. For example: intent "Change seats", and `offer_coupon: true` after a frustrated delay message.
