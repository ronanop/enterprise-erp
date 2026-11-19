"""Foundation infrastructure adapters (external providers)."""

from modules.foundation.adapters.graph_email_adapter import GraphEmailAdapter
from modules.foundation.adapters.mailapi_adapter import MailApiAdapter

__all__ = ["GraphEmailAdapter", "MailApiAdapter"]
