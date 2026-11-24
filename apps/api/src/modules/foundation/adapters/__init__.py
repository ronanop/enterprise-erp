"""Foundation infrastructure adapters (external providers)."""

from modules.foundation.adapters.graph_email_adapter import GraphEmailAdapter
from modules.foundation.adapters.mailapi_adapter import MailApiAdapter
from modules.foundation.adapters.smtp_email_adapter import SmtpEmailAdapter

__all__ = ["GraphEmailAdapter", "MailApiAdapter", "SmtpEmailAdapter"]
