"""Stock CRM dropdown/picklist catalogs (seeded under Settings defaults)."""

from __future__ import annotations

from copy import deepcopy
from typing import Any


def default_crm_catalogs() -> dict[str, Any]:
    """Tenant-editable picklists; runtime forms resolve options from here."""
    return deepcopy(_CATALOGS)


_CATALOGS: dict[str, Any] = {
    "industries": {
        "label": "Industries",
        "allow_custom_values": False,
        "options": [
            {
                "value": "IT & Technology",
                "label": "IT & Technology",
                "enabled": True,
                "order": 0,
                "source": "stock"
            },
            {
                "value": "Manufacturing",
                "label": "Manufacturing",
                "enabled": True,
                "order": 1,
                "source": "stock"
            },
            {
                "value": "Healthcare",
                "label": "Healthcare",
                "enabled": True,
                "order": 2,
                "source": "stock"
            },
            {
                "value": "BFSI",
                "label": "BFSI",
                "enabled": True,
                "order": 3,
                "source": "stock"
            },
            {
                "value": "Retail",
                "label": "Retail",
                "enabled": True,
                "order": 4,
                "source": "stock"
            },
            {
                "value": "Government",
                "label": "Government",
                "enabled": True,
                "order": 5,
                "source": "stock"
            },
            {
                "value": "Education",
                "label": "Education",
                "enabled": True,
                "order": 6,
                "source": "stock"
            },
            {
                "value": "Telecom",
                "label": "Telecom",
                "enabled": True,
                "order": 7,
                "source": "stock"
            },
            {
                "value": "Others",
                "label": "Others",
                "enabled": True,
                "order": 8,
                "source": "stock"
            }
        ]
    },
    "company_lead_sources": {
        "label": "Company / Lead sources",
        "allow_custom_values": False,
        "options": [
            {
                "value": "referral",
                "label": "Referral",
                "enabled": True,
                "order": 0,
                "source": "stock"
            },
            {
                "value": "website",
                "label": "Website",
                "enabled": True,
                "order": 1,
                "source": "stock"
            },
            {
                "value": "cold_call",
                "label": "Cold Call",
                "enabled": True,
                "order": 2,
                "source": "stock"
            },
            {
                "value": "multi_tier",
                "label": "Multi-Tier",
                "enabled": True,
                "order": 3,
                "source": "stock"
            },
            {
                "value": "event",
                "label": "Event",
                "enabled": True,
                "order": 4,
                "source": "stock"
            },
            {
                "value": "advertisement",
                "label": "Advertisement",
                "enabled": True,
                "order": 5,
                "source": "stock"
            },
            {
                "value": "other",
                "label": "Other",
                "enabled": True,
                "order": 6,
                "source": "stock"
            }
        ]
    },
    "requirement_types": {
        "label": "Requirement types",
        "allow_custom_values": False,
        "options": [
            {
                "value": "New Requirement",
                "label": "New Requirement",
                "enabled": True,
                "order": 0,
                "source": "stock"
            },
            {
                "value": "Expansion",
                "label": "Expansion",
                "enabled": True,
                "order": 1,
                "source": "stock"
            }
        ]
    },
    "purchase_models": {
        "label": "Purchase models",
        "allow_custom_values": False,
        "options": [
            {
                "value": "CAPEX",
                "label": "CAPEX",
                "enabled": True,
                "order": 0,
                "source": "stock"
            },
            {
                "value": "OPEX",
                "label": "OPEX",
                "enabled": True,
                "order": 1,
                "source": "stock"
            }
        ]
    },
    "engagement_scores": {
        "label": "Engagement scores",
        "allow_custom_values": False,
        "options": [
            {
                "value": "25",
                "label": "25",
                "enabled": True,
                "order": 0,
                "source": "stock"
            },
            {
                "value": "50",
                "label": "50",
                "enabled": True,
                "order": 1,
                "source": "stock"
            },
            {
                "value": "75",
                "label": "75",
                "enabled": True,
                "order": 2,
                "source": "stock"
            },
            {
                "value": "100",
                "label": "100",
                "enabled": True,
                "order": 3,
                "source": "stock"
            }
        ]
    },
    "product_types": {
        "label": "Product types",
        "allow_custom_values": False,
        "options": [
            {
                "value": "Hardware",
                "label": "Hardware",
                "enabled": True,
                "order": 0,
                "source": "stock"
            },
            {
                "value": "Software",
                "label": "Software",
                "enabled": True,
                "order": 1,
                "source": "stock"
            },
            {
                "value": "Services",
                "label": "Services",
                "enabled": True,
                "order": 2,
                "source": "stock"
            },
            {
                "value": "Networking",
                "label": "Networking",
                "enabled": True,
                "order": 3,
                "source": "stock"
            },
            {
                "value": "Cybersecurity",
                "label": "Cybersecurity",
                "enabled": True,
                "order": 4,
                "source": "stock"
            },
            {
                "value": "Cloud",
                "label": "Cloud",
                "enabled": True,
                "order": 5,
                "source": "stock"
            },
            {
                "value": "AI",
                "label": "AI",
                "enabled": True,
                "order": 6,
                "source": "stock"
            },
            {
                "value": "Others",
                "label": "Others",
                "enabled": True,
                "order": 7,
                "source": "stock"
            }
        ]
    },
    "sub_product_categories": {
        "label": "Sub product categories",
        "allow_custom_values": False,
        "options": [
            {
                "value": "Servers",
                "label": "Servers",
                "enabled": True,
                "order": 0,
                "source": "stock",
                "meta": {
                    "parent_value": "Hardware"
                }
            },
            {
                "value": "Storage",
                "label": "Storage",
                "enabled": True,
                "order": 1,
                "source": "stock",
                "meta": {
                    "parent_value": "Hardware"
                }
            },
            {
                "value": "Workstations / Laptops",
                "label": "Workstations / Laptops",
                "enabled": True,
                "order": 2,
                "source": "stock",
                "meta": {
                    "parent_value": "Hardware"
                }
            },
            {
                "value": "Peripherals",
                "label": "Peripherals",
                "enabled": True,
                "order": 3,
                "source": "stock",
                "meta": {
                    "parent_value": "Hardware"
                }
            },
            {
                "value": "Networking Hardware",
                "label": "Networking Hardware",
                "enabled": True,
                "order": 4,
                "source": "stock",
                "meta": {
                    "parent_value": "Hardware"
                }
            },
            {
                "value": "Others",
                "label": "Others",
                "enabled": True,
                "order": 5,
                "source": "stock",
                "meta": {
                    "parent_value": "Hardware"
                }
            },
            {
                "value": "Enterprise Applications",
                "label": "Enterprise Applications",
                "enabled": True,
                "order": 6,
                "source": "stock",
                "meta": {
                    "parent_value": "Software"
                }
            },
            {
                "value": "Operating Systems",
                "label": "Operating Systems",
                "enabled": True,
                "order": 7,
                "source": "stock",
                "meta": {
                    "parent_value": "Software"
                }
            },
            {
                "value": "Databases",
                "label": "Databases",
                "enabled": True,
                "order": 8,
                "source": "stock",
                "meta": {
                    "parent_value": "Software"
                }
            },
            {
                "value": "Licensing / Subscriptions",
                "label": "Licensing / Subscriptions",
                "enabled": True,
                "order": 9,
                "source": "stock",
                "meta": {
                    "parent_value": "Software"
                }
            },
            {
                "value": "Security Software",
                "label": "Security Software",
                "enabled": True,
                "order": 10,
                "source": "stock",
                "meta": {
                    "parent_value": "Software"
                }
            },
            {
                "value": "Others",
                "label": "Others",
                "enabled": True,
                "order": 11,
                "source": "stock",
                "meta": {
                    "parent_value": "Software"
                }
            },
            {
                "value": "Implementation",
                "label": "Implementation",
                "enabled": True,
                "order": 12,
                "source": "stock",
                "meta": {
                    "parent_value": "Services"
                }
            },
            {
                "value": "Consulting",
                "label": "Consulting",
                "enabled": True,
                "order": 13,
                "source": "stock",
                "meta": {
                    "parent_value": "Services"
                }
            },
            {
                "value": "Managed Services",
                "label": "Managed Services",
                "enabled": True,
                "order": 14,
                "source": "stock",
                "meta": {
                    "parent_value": "Services"
                }
            },
            {
                "value": "Support & AMC",
                "label": "Support & AMC",
                "enabled": True,
                "order": 15,
                "source": "stock",
                "meta": {
                    "parent_value": "Services"
                }
            },
            {
                "value": "Training",
                "label": "Training",
                "enabled": True,
                "order": 16,
                "source": "stock",
                "meta": {
                    "parent_value": "Services"
                }
            },
            {
                "value": "Others",
                "label": "Others",
                "enabled": True,
                "order": 17,
                "source": "stock",
                "meta": {
                    "parent_value": "Services"
                }
            },
            {
                "value": "Switches",
                "label": "Switches",
                "enabled": True,
                "order": 18,
                "source": "stock",
                "meta": {
                    "parent_value": "Networking"
                }
            },
            {
                "value": "Routers",
                "label": "Routers",
                "enabled": True,
                "order": 19,
                "source": "stock",
                "meta": {
                    "parent_value": "Networking"
                }
            },
            {
                "value": "Wireless / Wi-Fi",
                "label": "Wireless / Wi-Fi",
                "enabled": True,
                "order": 20,
                "source": "stock",
                "meta": {
                    "parent_value": "Networking"
                }
            },
            {
                "value": "SD-WAN",
                "label": "SD-WAN",
                "enabled": True,
                "order": 21,
                "source": "stock",
                "meta": {
                    "parent_value": "Networking"
                }
            },
            {
                "value": "Firewalls (Network)",
                "label": "Firewalls (Network)",
                "enabled": True,
                "order": 22,
                "source": "stock",
                "meta": {
                    "parent_value": "Networking"
                }
            },
            {
                "value": "Cabling / Structured Cabling",
                "label": "Cabling / Structured Cabling",
                "enabled": True,
                "order": 23,
                "source": "stock",
                "meta": {
                    "parent_value": "Networking"
                }
            },
            {
                "value": "Others",
                "label": "Others",
                "enabled": True,
                "order": 24,
                "source": "stock",
                "meta": {
                    "parent_value": "Networking"
                }
            },
            {
                "value": "Endpoint Security",
                "label": "Endpoint Security",
                "enabled": True,
                "order": 25,
                "source": "stock",
                "meta": {
                    "parent_value": "Cybersecurity"
                }
            },
            {
                "value": "Network Security",
                "label": "Network Security",
                "enabled": True,
                "order": 26,
                "source": "stock",
                "meta": {
                    "parent_value": "Cybersecurity"
                }
            },
            {
                "value": "Identity & Access Management",
                "label": "Identity & Access Management",
                "enabled": True,
                "order": 27,
                "source": "stock",
                "meta": {
                    "parent_value": "Cybersecurity"
                }
            },
            {
                "value": "SOC / Managed Detection",
                "label": "SOC / Managed Detection",
                "enabled": True,
                "order": 28,
                "source": "stock",
                "meta": {
                    "parent_value": "Cybersecurity"
                }
            },
            {
                "value": "Vulnerability Management",
                "label": "Vulnerability Management",
                "enabled": True,
                "order": 29,
                "source": "stock",
                "meta": {
                    "parent_value": "Cybersecurity"
                }
            },
            {
                "value": "Others",
                "label": "Others",
                "enabled": True,
                "order": 30,
                "source": "stock",
                "meta": {
                    "parent_value": "Cybersecurity"
                }
            },
            {
                "value": "Billing Shift AWS",
                "label": "Billing Shift AWS",
                "enabled": True,
                "order": 31,
                "source": "stock",
                "meta": {
                    "parent_value": "Cloud"
                }
            },
            {
                "value": "Billing Shift Azure",
                "label": "Billing Shift Azure",
                "enabled": True,
                "order": 32,
                "source": "stock",
                "meta": {
                    "parent_value": "Cloud"
                }
            },
            {
                "value": "Billing Shift GCP",
                "label": "Billing Shift GCP",
                "enabled": True,
                "order": 33,
                "source": "stock",
                "meta": {
                    "parent_value": "Cloud"
                }
            },
            {
                "value": "AI-POC/ OLA/ MAP",
                "label": "AI-POC/ OLA/ MAP",
                "enabled": True,
                "order": 34,
                "source": "stock",
                "meta": {
                    "parent_value": "Cloud"
                }
            },
            {
                "value": "FinOps Aquila Clouds",
                "label": "FinOps Aquila Clouds",
                "enabled": True,
                "order": 35,
                "source": "stock",
                "meta": {
                    "parent_value": "Cloud"
                }
            },
            {
                "value": "Finops Zolix Cloud",
                "label": "Finops Zolix Cloud",
                "enabled": True,
                "order": 36,
                "source": "stock",
                "meta": {
                    "parent_value": "Cloud"
                }
            },
            {
                "value": "Migration",
                "label": "Migration",
                "enabled": True,
                "order": 37,
                "source": "stock",
                "meta": {
                    "parent_value": "Cloud"
                }
            },
            {
                "value": "AI Platforms / Models",
                "label": "AI Platforms / Models",
                "enabled": True,
                "order": 38,
                "source": "stock",
                "meta": {
                    "parent_value": "AI"
                }
            },
            {
                "value": "Analytics & ML",
                "label": "Analytics & ML",
                "enabled": True,
                "order": 39,
                "source": "stock",
                "meta": {
                    "parent_value": "AI"
                }
            },
            {
                "value": "Computer Vision",
                "label": "Computer Vision",
                "enabled": True,
                "order": 40,
                "source": "stock",
                "meta": {
                    "parent_value": "AI"
                }
            },
            {
                "value": "NLP / Generative AI",
                "label": "NLP / Generative AI",
                "enabled": True,
                "order": 41,
                "source": "stock",
                "meta": {
                    "parent_value": "AI"
                }
            },
            {
                "value": "AI Consulting & Implementation",
                "label": "AI Consulting & Implementation",
                "enabled": True,
                "order": 42,
                "source": "stock",
                "meta": {
                    "parent_value": "AI"
                }
            },
            {
                "value": "Others",
                "label": "Others",
                "enabled": True,
                "order": 43,
                "source": "stock",
                "meta": {
                    "parent_value": "AI"
                }
            },
            {
                "value": "General",
                "label": "General",
                "enabled": True,
                "order": 44,
                "source": "stock",
                "meta": {
                    "parent_value": "Others"
                }
            },
            {
                "value": "Custom / Unspecified",
                "label": "Custom / Unspecified",
                "enabled": True,
                "order": 45,
                "source": "stock",
                "meta": {
                    "parent_value": "Others"
                }
            },
            {
                "value": "Others",
                "label": "Others",
                "enabled": True,
                "order": 46,
                "source": "stock",
                "meta": {
                    "parent_value": "Others"
                }
            }
        ]
    },
    "hardware_sourcing_channels": {
        "label": "Hardware sourcing channels",
        "allow_custom_values": False,
        "options": [
            {
                "value": "B2B",
                "label": "B2B",
                "enabled": True,
                "order": 0,
                "source": "stock"
            },
            {
                "value": "Open Market",
                "label": "Open Market",
                "enabled": True,
                "order": 1,
                "source": "stock"
            }
        ]
    },
    "service_sourcing_channels": {
        "label": "Service sourcing channels",
        "allow_custom_values": False,
        "options": [
            {
                "value": "Outsourced",
                "label": "Outsourced",
                "enabled": True,
                "order": 0,
                "source": "stock"
            },
            {
                "value": "Cache Service",
                "label": "Cache Service",
                "enabled": True,
                "order": 1,
                "source": "stock"
            }
        ]
    },
    "oem_names": {
        "label": "OEM names",
        "allow_custom_values": True,
        "options": [
            {
                "value": "8x8",
                "label": "8x8",
                "enabled": True,
                "order": 0,
                "source": "stock"
            },
            {
                "value": "ABB",
                "label": "ABB",
                "enabled": True,
                "order": 1,
                "source": "stock"
            },
            {
                "value": "Acer",
                "label": "Acer",
                "enabled": True,
                "order": 2,
                "source": "stock"
            },
            {
                "value": "Acronis",
                "label": "Acronis",
                "enabled": True,
                "order": 3,
                "source": "stock"
            },
            {
                "value": "Adobe",
                "label": "Adobe",
                "enabled": True,
                "order": 4,
                "source": "stock"
            },
            {
                "value": "Alibaba Cloud",
                "label": "Alibaba Cloud",
                "enabled": True,
                "order": 5,
                "source": "stock"
            },
            {
                "value": "AMD",
                "label": "AMD",
                "enabled": True,
                "order": 6,
                "source": "stock"
            },
            {
                "value": "Amazon Web Services (AWS)",
                "label": "Amazon Web Services (AWS)",
                "enabled": True,
                "order": 7,
                "source": "stock"
            },
            {
                "value": "APC",
                "label": "APC",
                "enabled": True,
                "order": 8,
                "source": "stock"
            },
            {
                "value": "Apple",
                "label": "Apple",
                "enabled": True,
                "order": 9,
                "source": "stock"
            },
            {
                "value": "Arista Networks",
                "label": "Arista Networks",
                "enabled": True,
                "order": 10,
                "source": "stock"
            },
            {
                "value": "Arcserve",
                "label": "Arcserve",
                "enabled": True,
                "order": 11,
                "source": "stock"
            },
            {
                "value": "ASUS",
                "label": "ASUS",
                "enabled": True,
                "order": 12,
                "source": "stock"
            },
            {
                "value": "Atlassian",
                "label": "Atlassian",
                "enabled": True,
                "order": 13,
                "source": "stock"
            },
            {
                "value": "Avaya",
                "label": "Avaya",
                "enabled": True,
                "order": 14,
                "source": "stock"
            },
            {
                "value": "BMC",
                "label": "BMC",
                "enabled": True,
                "order": 15,
                "source": "stock"
            },
            {
                "value": "BeyondTrust",
                "label": "BeyondTrust",
                "enabled": True,
                "order": 16,
                "source": "stock"
            },
            {
                "value": "BlackBerry",
                "label": "BlackBerry",
                "enabled": True,
                "order": 17,
                "source": "stock"
            },
            {
                "value": "Broadcom",
                "label": "Broadcom",
                "enabled": True,
                "order": 18,
                "source": "stock"
            },
            {
                "value": "Brother",
                "label": "Brother",
                "enabled": True,
                "order": 19,
                "source": "stock"
            },
            {
                "value": "Canon",
                "label": "Canon",
                "enabled": True,
                "order": 20,
                "source": "stock"
            },
            {
                "value": "Check Point",
                "label": "Check Point",
                "enabled": True,
                "order": 21,
                "source": "stock"
            },
            {
                "value": "Cisco",
                "label": "Cisco",
                "enabled": True,
                "order": 22,
                "source": "stock"
            },
            {
                "value": "Citrix",
                "label": "Citrix",
                "enabled": True,
                "order": 23,
                "source": "stock"
            },
            {
                "value": "Cohesity",
                "label": "Cohesity",
                "enabled": True,
                "order": 24,
                "source": "stock"
            },
            {
                "value": "Commvault",
                "label": "Commvault",
                "enabled": True,
                "order": 25,
                "source": "stock"
            },
            {
                "value": "CommScope",
                "label": "CommScope",
                "enabled": True,
                "order": 26,
                "source": "stock"
            },
            {
                "value": "CrowdStrike",
                "label": "CrowdStrike",
                "enabled": True,
                "order": 27,
                "source": "stock"
            },
            {
                "value": "CyberArk",
                "label": "CyberArk",
                "enabled": True,
                "order": 28,
                "source": "stock"
            },
            {
                "value": "Databricks",
                "label": "Databricks",
                "enabled": True,
                "order": 29,
                "source": "stock"
            },
            {
                "value": "Datadog",
                "label": "Datadog",
                "enabled": True,
                "order": 30,
                "source": "stock"
            },
            {
                "value": "Dell Technologies",
                "label": "Dell Technologies",
                "enabled": True,
                "order": 31,
                "source": "stock"
            },
            {
                "value": "Delta Electronics",
                "label": "Delta Electronics",
                "enabled": True,
                "order": 32,
                "source": "stock"
            },
            {
                "value": "DigitalOcean",
                "label": "DigitalOcean",
                "enabled": True,
                "order": 33,
                "source": "stock"
            },
            {
                "value": "Docker",
                "label": "Docker",
                "enabled": True,
                "order": 34,
                "source": "stock"
            },
            {
                "value": "Druva",
                "label": "Druva",
                "enabled": True,
                "order": 35,
                "source": "stock"
            },
            {
                "value": "Dynatrace",
                "label": "Dynatrace",
                "enabled": True,
                "order": 36,
                "source": "stock"
            },
            {
                "value": "Eaton",
                "label": "Eaton",
                "enabled": True,
                "order": 37,
                "source": "stock"
            },
            {
                "value": "Epson",
                "label": "Epson",
                "enabled": True,
                "order": 38,
                "source": "stock"
            },
            {
                "value": "Ericsson",
                "label": "Ericsson",
                "enabled": True,
                "order": 39,
                "source": "stock"
            },
            {
                "value": "Extreme Networks",
                "label": "Extreme Networks",
                "enabled": True,
                "order": 40,
                "source": "stock"
            },
            {
                "value": "F5",
                "label": "F5",
                "enabled": True,
                "order": 41,
                "source": "stock"
            },
            {
                "value": "Fortinet",
                "label": "Fortinet",
                "enabled": True,
                "order": 42,
                "source": "stock"
            },
            {
                "value": "Freshworks",
                "label": "Freshworks",
                "enabled": True,
                "order": 43,
                "source": "stock"
            },
            {
                "value": "Fujitsu",
                "label": "Fujitsu",
                "enabled": True,
                "order": 44,
                "source": "stock"
            },
            {
                "value": "Gigabyte",
                "label": "Gigabyte",
                "enabled": True,
                "order": 45,
                "source": "stock"
            },
            {
                "value": "Google Cloud",
                "label": "Google Cloud",
                "enabled": True,
                "order": 46,
                "source": "stock"
            },
            {
                "value": "Google",
                "label": "Google",
                "enabled": True,
                "order": 47,
                "source": "stock"
            },
            {
                "value": "HubSpot",
                "label": "HubSpot",
                "enabled": True,
                "order": 48,
                "source": "stock"
            },
            {
                "value": "HPE",
                "label": "HPE",
                "enabled": True,
                "order": 49,
                "source": "stock"
            },
            {
                "value": "HPE Aruba Networking",
                "label": "HPE Aruba Networking",
                "enabled": True,
                "order": 50,
                "source": "stock"
            },
            {
                "value": "Huawei",
                "label": "Huawei",
                "enabled": True,
                "order": 51,
                "source": "stock"
            },
            {
                "value": "Huawei Cloud",
                "label": "Huawei Cloud",
                "enabled": True,
                "order": 52,
                "source": "stock"
            },
            {
                "value": "IBM",
                "label": "IBM",
                "enabled": True,
                "order": 53,
                "source": "stock"
            },
            {
                "value": "IFS",
                "label": "IFS",
                "enabled": True,
                "order": 54,
                "source": "stock"
            },
            {
                "value": "Intel",
                "label": "Intel",
                "enabled": True,
                "order": 55,
                "source": "stock"
            },
            {
                "value": "Infor",
                "label": "Infor",
                "enabled": True,
                "order": 56,
                "source": "stock"
            },
            {
                "value": "Inspur",
                "label": "Inspur",
                "enabled": True,
                "order": 57,
                "source": "stock"
            },
            {
                "value": "Ivanti",
                "label": "Ivanti",
                "enabled": True,
                "order": 58,
                "source": "stock"
            },
            {
                "value": "Jabra",
                "label": "Jabra",
                "enabled": True,
                "order": 59,
                "source": "stock"
            },
            {
                "value": "Juniper Networks",
                "label": "Juniper Networks",
                "enabled": True,
                "order": 60,
                "source": "stock"
            },
            {
                "value": "Kaspersky",
                "label": "Kaspersky",
                "enabled": True,
                "order": 61,
                "source": "stock"
            },
            {
                "value": "Kong",
                "label": "Kong",
                "enabled": True,
                "order": 62,
                "source": "stock"
            },
            {
                "value": "Konica Minolta",
                "label": "Konica Minolta",
                "enabled": True,
                "order": 63,
                "source": "stock"
            },
            {
                "value": "Kyocera",
                "label": "Kyocera",
                "enabled": True,
                "order": 64,
                "source": "stock"
            },
            {
                "value": "Legrand",
                "label": "Legrand",
                "enabled": True,
                "order": 65,
                "source": "stock"
            },
            {
                "value": "Lenovo",
                "label": "Lenovo",
                "enabled": True,
                "order": 66,
                "source": "stock"
            },
            {
                "value": "Lexmark",
                "label": "Lexmark",
                "enabled": True,
                "order": 67,
                "source": "stock"
            },
            {
                "value": "LogicMonitor",
                "label": "LogicMonitor",
                "enabled": True,
                "order": 68,
                "source": "stock"
            },
            {
                "value": "Logitech",
                "label": "Logitech",
                "enabled": True,
                "order": 69,
                "source": "stock"
            },
            {
                "value": "ManageEngine",
                "label": "ManageEngine",
                "enabled": True,
                "order": 70,
                "source": "stock"
            },
            {
                "value": "MariaDB",
                "label": "MariaDB",
                "enabled": True,
                "order": 71,
                "source": "stock"
            },
            {
                "value": "Microsoft",
                "label": "Microsoft",
                "enabled": True,
                "order": 72,
                "source": "stock"
            },
            {
                "value": "Microsoft Azure",
                "label": "Microsoft Azure",
                "enabled": True,
                "order": 73,
                "source": "stock"
            },
            {
                "value": "Microsoft Dynamics 365",
                "label": "Microsoft Dynamics 365",
                "enabled": True,
                "order": 74,
                "source": "stock"
            },
            {
                "value": "Mitel",
                "label": "Mitel",
                "enabled": True,
                "order": 75,
                "source": "stock"
            },
            {
                "value": "MongoDB",
                "label": "MongoDB",
                "enabled": True,
                "order": 76,
                "source": "stock"
            },
            {
                "value": "MuleSoft",
                "label": "MuleSoft",
                "enabled": True,
                "order": 77,
                "source": "stock"
            },
            {
                "value": "NetApp",
                "label": "NetApp",
                "enabled": True,
                "order": 78,
                "source": "stock"
            },
            {
                "value": "NETGEAR",
                "label": "NETGEAR",
                "enabled": True,
                "order": 79,
                "source": "stock"
            },
            {
                "value": "Netskope",
                "label": "Netskope",
                "enabled": True,
                "order": 80,
                "source": "stock"
            },
            {
                "value": "New Relic",
                "label": "New Relic",
                "enabled": True,
                "order": 81,
                "source": "stock"
            },
            {
                "value": "NVIDIA",
                "label": "NVIDIA",
                "enabled": True,
                "order": 82,
                "source": "stock"
            },
            {
                "value": "Nokia",
                "label": "Nokia",
                "enabled": True,
                "order": 83,
                "source": "stock"
            },
            {
                "value": "Nutanix",
                "label": "Nutanix",
                "enabled": True,
                "order": 84,
                "source": "stock"
            },
            {
                "value": "Okta",
                "label": "Okta",
                "enabled": True,
                "order": 85,
                "source": "stock"
            },
            {
                "value": "OpenAI",
                "label": "OpenAI",
                "enabled": True,
                "order": 86,
                "source": "stock"
            },
            {
                "value": "OpenText",
                "label": "OpenText",
                "enabled": True,
                "order": 87,
                "source": "stock"
            },
            {
                "value": "Oracle",
                "label": "Oracle",
                "enabled": True,
                "order": 88,
                "source": "stock"
            },
            {
                "value": "Oracle Cloud",
                "label": "Oracle Cloud",
                "enabled": True,
                "order": 89,
                "source": "stock"
            },
            {
                "value": "Odoo",
                "label": "Odoo",
                "enabled": True,
                "order": 90,
                "source": "stock"
            },
            {
                "value": "Palo Alto Networks",
                "label": "Palo Alto Networks",
                "enabled": True,
                "order": 91,
                "source": "stock"
            },
            {
                "value": "Panduit",
                "label": "Panduit",
                "enabled": True,
                "order": 92,
                "source": "stock"
            },
            {
                "value": "Palantir",
                "label": "Palantir",
                "enabled": True,
                "order": 93,
                "source": "stock"
            },
            {
                "value": "Ping Identity",
                "label": "Ping Identity",
                "enabled": True,
                "order": 94,
                "source": "stock"
            },
            {
                "value": "Poly",
                "label": "Poly",
                "enabled": True,
                "order": 95,
                "source": "stock"
            },
            {
                "value": "Proofpoint",
                "label": "Proofpoint",
                "enabled": True,
                "order": 96,
                "source": "stock"
            },
            {
                "value": "Pure Storage",
                "label": "Pure Storage",
                "enabled": True,
                "order": 97,
                "source": "stock"
            },
            {
                "value": "PTC",
                "label": "PTC",
                "enabled": True,
                "order": 98,
                "source": "stock"
            },
            {
                "value": "QNAP",
                "label": "QNAP",
                "enabled": True,
                "order": 99,
                "source": "stock"
            },
            {
                "value": "Qualys",
                "label": "Qualys",
                "enabled": True,
                "order": 100,
                "source": "stock"
            },
            {
                "value": "Red Hat",
                "label": "Red Hat",
                "enabled": True,
                "order": 101,
                "source": "stock"
            },
            {
                "value": "Ricoh",
                "label": "Ricoh",
                "enabled": True,
                "order": 102,
                "source": "stock"
            },
            {
                "value": "Riello",
                "label": "Riello",
                "enabled": True,
                "order": 103,
                "source": "stock"
            },
            {
                "value": "RingCentral",
                "label": "RingCentral",
                "enabled": True,
                "order": 104,
                "source": "stock"
            },
            {
                "value": "Rittal",
                "label": "Rittal",
                "enabled": True,
                "order": 105,
                "source": "stock"
            },
            {
                "value": "Rubrik",
                "label": "Rubrik",
                "enabled": True,
                "order": 106,
                "source": "stock"
            },
            {
                "value": "Ruckus Networks",
                "label": "Ruckus Networks",
                "enabled": True,
                "order": 107,
                "source": "stock"
            },
            {
                "value": "Salesforce",
                "label": "Salesforce",
                "enabled": True,
                "order": 108,
                "source": "stock"
            },
            {
                "value": "Samsung",
                "label": "Samsung",
                "enabled": True,
                "order": 109,
                "source": "stock"
            },
            {
                "value": "Samsung Networks",
                "label": "Samsung Networks",
                "enabled": True,
                "order": 110,
                "source": "stock"
            },
            {
                "value": "SAP",
                "label": "SAP",
                "enabled": True,
                "order": 111,
                "source": "stock"
            },
            {
                "value": "SAS",
                "label": "SAS",
                "enabled": True,
                "order": 112,
                "source": "stock"
            },
            {
                "value": "Schneider Electric",
                "label": "Schneider Electric",
                "enabled": True,
                "order": 113,
                "source": "stock"
            },
            {
                "value": "ScienceLogic",
                "label": "ScienceLogic",
                "enabled": True,
                "order": 114,
                "source": "stock"
            },
            {
                "value": "SentinelOne",
                "label": "SentinelOne",
                "enabled": True,
                "order": 115,
                "source": "stock"
            },
            {
                "value": "ServiceMax",
                "label": "ServiceMax",
                "enabled": True,
                "order": 116,
                "source": "stock"
            },
            {
                "value": "ServiceNow",
                "label": "ServiceNow",
                "enabled": True,
                "order": 117,
                "source": "stock"
            },
            {
                "value": "Sharp",
                "label": "Sharp",
                "enabled": True,
                "order": 118,
                "source": "stock"
            },
            {
                "value": "Siemens",
                "label": "Siemens",
                "enabled": True,
                "order": 119,
                "source": "stock"
            },
            {
                "value": "Singtel",
                "label": "Singtel",
                "enabled": True,
                "order": 120,
                "source": "stock"
            },
            {
                "value": "SolarWinds",
                "label": "SolarWinds",
                "enabled": True,
                "order": 121,
                "source": "stock"
            },
            {
                "value": "Sophos",
                "label": "Sophos",
                "enabled": True,
                "order": 122,
                "source": "stock"
            },
            {
                "value": "Splunk",
                "label": "Splunk",
                "enabled": True,
                "order": 123,
                "source": "stock"
            },
            {
                "value": "Supermicro",
                "label": "Supermicro",
                "enabled": True,
                "order": 124,
                "source": "stock"
            },
            {
                "value": "SUSE",
                "label": "SUSE",
                "enabled": True,
                "order": 125,
                "source": "stock"
            },
            {
                "value": "Synology",
                "label": "Synology",
                "enabled": True,
                "order": 126,
                "source": "stock"
            },
            {
                "value": "TIBCO",
                "label": "TIBCO",
                "enabled": True,
                "order": 127,
                "source": "stock"
            },
            {
                "value": "Tenable",
                "label": "Tenable",
                "enabled": True,
                "order": 128,
                "source": "stock"
            },
            {
                "value": "TP-Link",
                "label": "TP-Link",
                "enabled": True,
                "order": 129,
                "source": "stock"
            },
            {
                "value": "Trend Micro",
                "label": "Trend Micro",
                "enabled": True,
                "order": 130,
                "source": "stock"
            },
            {
                "value": "Ubiquiti",
                "label": "Ubiquiti",
                "enabled": True,
                "order": 131,
                "source": "stock"
            },
            {
                "value": "Veritas",
                "label": "Veritas",
                "enabled": True,
                "order": 132,
                "source": "stock"
            },
            {
                "value": "Vertiv",
                "label": "Vertiv",
                "enabled": True,
                "order": 133,
                "source": "stock"
            },
            {
                "value": "Veeam",
                "label": "Veeam",
                "enabled": True,
                "order": 134,
                "source": "stock"
            },
            {
                "value": "VMware by Broadcom",
                "label": "VMware by Broadcom",
                "enabled": True,
                "order": 135,
                "source": "stock"
            },
            {
                "value": "Xerox",
                "label": "Xerox",
                "enabled": True,
                "order": 136,
                "source": "stock"
            },
            {
                "value": "Yealink",
                "label": "Yealink",
                "enabled": True,
                "order": 137,
                "source": "stock"
            },
            {
                "value": "Zscaler",
                "label": "Zscaler",
                "enabled": True,
                "order": 138,
                "source": "stock"
            },
            {
                "value": "Zoom",
                "label": "Zoom",
                "enabled": True,
                "order": 139,
                "source": "stock"
            },
            {
                "value": "Zerto",
                "label": "Zerto",
                "enabled": True,
                "order": 140,
                "source": "stock"
            },
            {
                "value": "ZTE",
                "label": "ZTE",
                "enabled": True,
                "order": 141,
                "source": "stock"
            },
            {
                "value": "Zoho",
                "label": "Zoho",
                "enabled": True,
                "order": 142,
                "source": "stock"
            },
            {
                "value": "ZoomInfo",
                "label": "ZoomInfo",
                "enabled": True,
                "order": 143,
                "source": "stock"
            },
            {
                "value": "Snowflake",
                "label": "Snowflake",
                "enabled": True,
                "order": 144,
                "source": "stock"
            },
            {
                "value": "Anthropic",
                "label": "Anthropic",
                "enabled": True,
                "order": 145,
                "source": "stock"
            },
            {
                "value": "Cloudflare",
                "label": "Cloudflare",
                "enabled": True,
                "order": 146,
                "source": "stock"
            },
            {
                "value": "SailPoint",
                "label": "SailPoint",
                "enabled": True,
                "order": 147,
                "source": "stock"
            }
        ]
    },
    "distributor_names": {
        "label": "Distributor names",
        "allow_custom_values": True,
        "options": [
            {
                "value": "IN STOCK",
                "label": "IN STOCK",
                "enabled": True,
                "order": 0,
                "source": "stock"
            }
        ]
    },
    "kyc_contact_designations": {
        "label": "KYC / contact designations",
        "allow_custom_values": True,
        "options": [
            {
                "value": "CEO",
                "label": "CEO",
                "enabled": True,
                "order": 0,
                "source": "stock"
            },
            {
                "value": "COO",
                "label": "COO",
                "enabled": True,
                "order": 1,
                "source": "stock"
            },
            {
                "value": "CTO",
                "label": "CTO",
                "enabled": True,
                "order": 2,
                "source": "stock"
            },
            {
                "value": "CIO",
                "label": "CIO",
                "enabled": True,
                "order": 3,
                "source": "stock"
            },
            {
                "value": "CFO",
                "label": "CFO",
                "enabled": True,
                "order": 4,
                "source": "stock"
            },
            {
                "value": "CISO",
                "label": "CISO",
                "enabled": True,
                "order": 5,
                "source": "stock"
            },
            {
                "value": "CDO",
                "label": "CDO",
                "enabled": True,
                "order": 6,
                "source": "stock"
            },
            {
                "value": "CHRO",
                "label": "CHRO",
                "enabled": True,
                "order": 7,
                "source": "stock"
            },
            {
                "value": "CMO",
                "label": "CMO",
                "enabled": True,
                "order": 8,
                "source": "stock"
            },
            {
                "value": "CRO",
                "label": "CRO",
                "enabled": True,
                "order": 9,
                "source": "stock"
            },
            {
                "value": "CPO",
                "label": "CPO",
                "enabled": True,
                "order": 10,
                "source": "stock"
            },
            {
                "value": "CSO",
                "label": "CSO",
                "enabled": True,
                "order": 11,
                "source": "stock"
            },
            {
                "value": "CCO",
                "label": "CCO",
                "enabled": True,
                "order": 12,
                "source": "stock"
            },
            {
                "value": "CSCO",
                "label": "CSCO",
                "enabled": True,
                "order": 13,
                "source": "stock"
            },
            {
                "value": "Procurement Head",
                "label": "Procurement Head",
                "enabled": True,
                "order": 14,
                "source": "stock"
            },
            {
                "value": "Purchase Head",
                "label": "Purchase Head",
                "enabled": True,
                "order": 15,
                "source": "stock"
            },
            {
                "value": "Purchase Manager",
                "label": "Purchase Manager",
                "enabled": True,
                "order": 16,
                "source": "stock"
            },
            {
                "value": "Purchase Executive",
                "label": "Purchase Executive",
                "enabled": True,
                "order": 17,
                "source": "stock"
            },
            {
                "value": "Senior Purchase Manager",
                "label": "Senior Purchase Manager",
                "enabled": True,
                "order": 18,
                "source": "stock"
            },
            {
                "value": "Procurement Director",
                "label": "Procurement Director",
                "enabled": True,
                "order": 19,
                "source": "stock"
            },
            {
                "value": "Head of Strategic Sourcing",
                "label": "Head of Strategic Sourcing",
                "enabled": True,
                "order": 20,
                "source": "stock"
            },
            {
                "value": "Vendor Manager",
                "label": "Vendor Manager",
                "enabled": True,
                "order": 21,
                "source": "stock"
            },
            {
                "value": "IT Head",
                "label": "IT Head",
                "enabled": True,
                "order": 22,
                "source": "stock"
            },
            {
                "value": "Infra Head",
                "label": "Infra Head",
                "enabled": True,
                "order": 23,
                "source": "stock"
            },
            {
                "value": "VP Engineering",
                "label": "VP Engineering",
                "enabled": True,
                "order": 24,
                "source": "stock"
            },
            {
                "value": "VP Technology",
                "label": "VP Technology",
                "enabled": True,
                "order": 25,
                "source": "stock"
            },
            {
                "value": "VP Product",
                "label": "VP Product",
                "enabled": True,
                "order": 26,
                "source": "stock"
            },
            {
                "value": "VP Operations",
                "label": "VP Operations",
                "enabled": True,
                "order": 27,
                "source": "stock"
            },
            {
                "value": "Engineering Director",
                "label": "Engineering Director",
                "enabled": True,
                "order": 28,
                "source": "stock"
            },
            {
                "value": "IT Director",
                "label": "IT Director",
                "enabled": True,
                "order": 29,
                "source": "stock"
            },
            {
                "value": "Senior IT Manager",
                "label": "Senior IT Manager",
                "enabled": True,
                "order": 30,
                "source": "stock"
            },
            {
                "value": "IT Manager",
                "label": "IT Manager",
                "enabled": True,
                "order": 31,
                "source": "stock"
            },
            {
                "value": "Senior Project Manager",
                "label": "Senior Project Manager",
                "enabled": True,
                "order": 32,
                "source": "stock"
            },
            {
                "value": "Project Manager",
                "label": "Project Manager",
                "enabled": True,
                "order": 33,
                "source": "stock"
            },
            {
                "value": "Development Manager",
                "label": "Development Manager",
                "enabled": True,
                "order": 34,
                "source": "stock"
            },
            {
                "value": "Infra Manager",
                "label": "Infra Manager",
                "enabled": True,
                "order": 35,
                "source": "stock"
            },
            {
                "value": "QA Manager",
                "label": "QA Manager",
                "enabled": True,
                "order": 36,
                "source": "stock"
            },
            {
                "value": "Product Manager",
                "label": "Product Manager",
                "enabled": True,
                "order": 37,
                "source": "stock"
            },
            {
                "value": "Technical Lead",
                "label": "Technical Lead",
                "enabled": True,
                "order": 38,
                "source": "stock"
            },
            {
                "value": "DevOps Lead",
                "label": "DevOps Lead",
                "enabled": True,
                "order": 39,
                "source": "stock"
            },
            {
                "value": "DevOps Head",
                "label": "DevOps Head",
                "enabled": True,
                "order": 40,
                "source": "stock"
            },
            {
                "value": "Senior Software Engineer",
                "label": "Senior Software Engineer",
                "enabled": True,
                "order": 41,
                "source": "stock"
            },
            {
                "value": "Senior DevOps Engineer",
                "label": "Senior DevOps Engineer",
                "enabled": True,
                "order": 42,
                "source": "stock"
            },
            {
                "value": "Cloud Manager",
                "label": "Cloud Manager",
                "enabled": True,
                "order": 43,
                "source": "stock"
            },
            {
                "value": "Cloud Head",
                "label": "Cloud Head",
                "enabled": True,
                "order": 44,
                "source": "stock"
            },
            {
                "value": "Security Engineer",
                "label": "Security Engineer",
                "enabled": True,
                "order": 45,
                "source": "stock"
            },
            {
                "value": "Security Manager",
                "label": "Security Manager",
                "enabled": True,
                "order": 46,
                "source": "stock"
            },
            {
                "value": "Network Manager",
                "label": "Network Manager",
                "enabled": True,
                "order": 47,
                "source": "stock"
            }
        ]
    }
}
