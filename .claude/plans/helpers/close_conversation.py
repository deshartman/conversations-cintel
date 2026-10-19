# Download the helper library from https://www.twilio.com/docs/python/install
import sys
import os
from twilio.rest import Client
from twilio.rest.conversations.v2 import ConversationList
from dotenv import load_dotenv

load_dotenv()

# Find your Account SID and Auth Token at twilio.com/console
# and set the environment variables. See http://twil.io/secure
account_sid = os.environ["TWILIO_ACCOUNT_SID"]
auth_token = os.environ["TWILIO_AUTH_TOKEN"]
client = Client(account_sid, auth_token)

conv_id = sys.argv[1]
conversation_by_id = client.conversations.v2.conversations(conv_id).patch(
    patch_conversation_by_id_request=ConversationList.PatchConversationByIdRequest(
        {"status": "CLOSED"}
    )
)

print(conversation_by_id.id)