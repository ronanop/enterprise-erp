export type KycGridRow = {
  id: string;
  network_profile: string;
  numbers: string;
  oem: string;
  major_partner: string;
};

export type KycContactRow = {
  id: string;
  designation: string;
  name: string;
  mobile: string;
  email: string;
};

export type CrmKycFormData = {
  company_name: string;
  number_of_locations: string;
  roc: string;
  coi: string;
  gst_no: string;
  pan: string;
  corporate_hq: string;
  it_budget_per_year: string;
  company_account_label: string;
  quote_label: string;
  tan: string;
  number_of_employees: string;
  users_major_partner: string;
  res: string;
  res_no_of_engineer: string;
  res_expiry_date: string;
  amcs: string;
  amcs_no_of_engineer: string;
  amcs_expiry_date: string;
  network_profiles: KycGridRow[];
  cloud_rows: KycGridRow[];
  security_rows: KycGridRow[];
  contact_rows: KycContactRow[];
};

export type KycHardwareProductOption = { value: string; label: string };

export const KYC_PRODUCT_OTHER_VALUE = "__kyc_product_other__";
export const KYC_PRODUCT_OTHER_LABEL = "Others";

/** Product options for Hardware/Network Infrastructure table (first column). */
export const KYC_HARDWARE_PRODUCT_OPTIONS: KycHardwareProductOption[] = [
  { value: "", label: "None" },
  { value: "routers", label: "Routers" },
  { value: "switches", label: "Switches" },
  { value: "firewalls", label: "Firewalls" },
  { value: "wireless_access_points", label: "Wireless Access Points" },
  { value: "load_balancers", label: "Load Balancers" },
  { value: "vpn_gateways", label: "VPN Gateways" },
  { value: "network_cabling", label: "Network Cabling" },
  { value: "dns", label: "DNS" },
  { value: "dhcp", label: "DHCP" },
  { value: "proxy_servers", label: "Proxy Servers" },
  { value: "servers", label: "Servers" },
  { value: "desktop_computers", label: "Desktop Computers" },
  { value: "laptops", label: "Laptops" },
  { value: "storage_devices", label: "Storage Devices" },
  { value: "nas_san", label: "NAS/SAN" },
  { value: "backup_appliances", label: "Backup Appliances" },
  { value: "printers_scanners", label: "Printers and Scanners" },
  { value: "racks_server_cabinets", label: "Racks and Server Cabinets" },
  { value: "monitors", label: "Monitors" },
  { value: "docking_stations", label: "Docking Stations" },
  { value: "hardware_security_modules", label: "Hardware Security Modules" },
  { value: "biometric_devices", label: "Biometric Devices" },
  { value: "ups", label: "UPS" },
  { value: "kvm_switches", label: "KVM Switches" },
  { value: "ssd_arrays", label: "SSD Arrays" },
  { value: KYC_PRODUCT_OTHER_VALUE, label: KYC_PRODUCT_OTHER_LABEL },
];

/** Product options for Cloud Information table (same columns as hardware grid). */
export const KYC_CLOUD_PRODUCT_OPTIONS: KycHardwareProductOption[] = [
  { value: "", label: "None" },
  { value: "iaas", label: "IaaS" },
  { value: "paas", label: "PaaS" },
  { value: "saas", label: "SaaS" },
  { value: "storage_and_backup", label: "Storage and Backup" },
  { value: "aws", label: "AWS" },
  { value: "gcp", label: "GCP" },
  { value: "azure_app_service", label: "Azure App Service" },
  { value: "microsoft_365", label: "Microsoft 365" },
  { value: "cloud_compute", label: "Cloud Compute" },
  { value: "vms", label: "VMs" },
  { value: "kubernetes_services", label: "Kubernetes Services" },
  { value: "container_service", label: "Container Service" },
  { value: "cloud_storage", label: "Cloud Storage" },
  { value: "serverless_functions", label: "Serverless Functions" },
  { value: "block_storage", label: "Block Storage" },
  { value: "file_storage", label: "File Storage" },
  { value: "cloud_backup", label: "Cloud Backup" },
  { value: "disaster_recovery", label: "Disaster Recovery" },
  { value: "cloud_database", label: "Cloud Database" },
  { value: "dbaas", label: "Database as a Service (DBaaS)" },
  { value: "data_warehouse", label: "Data Warehouse" },
  { value: "data_lake", label: "Data Lake" },
  { value: "cdn", label: "CDN" },
  { value: "load_balancer", label: "Load Balancer" },
  { value: "vpc", label: "VPC" },
  { value: "vpn_gateway", label: "VPN Gateway" },
  { value: "dns_service", label: "DNS Service" },
  { value: "api_gateway", label: "API Gateway" },
  { value: "iam", label: "IAM" },
  { value: "kms", label: "KMS" },
  { value: "secret_manager", label: "Secret Manager" },
  { value: "waf", label: "WAF" },
  { value: "ddos_protection", label: "DDoS Protection" },
  { value: "cloud_monitoring", label: "Cloud Monitoring" },
  { value: "logging_and_analytics", label: "Logging and Analytics" },
  { value: "devops_platform", label: "DevOps Platform" },
  { value: "cicd_pipeline", label: "CI/CD Pipeline" },
  { value: "ai_ml", label: "AI & ML" },
  { value: "container_registry", label: "Container Registry" },
  { value: "generative_ai_services", label: "Generative AI Services" },
  { value: "iot_platform", label: "IoT Platform" },
  { value: "event_streaming", label: "Event Streaming" },
  { value: "messaging_service", label: "Messaging Service" },
  { value: "managed_hosting", label: "Managed Hosting" },
  { value: "managed_kubernetes", label: "Managed Kubernetes" },
  { value: "managed_database", label: "Managed Database" },
  { value: "daas", label: "Desktop as a Service (DaaS)" },
  { value: "vdi", label: "Virtual Desktop Infrastructure (VDI)" },
  { value: "saas_applications", label: "SaaS Applications" },
  { value: KYC_PRODUCT_OTHER_VALUE, label: KYC_PRODUCT_OTHER_LABEL },
];

/** Product options for Security Users Profile table. */
export const KYC_SECURITY_PRODUCT_OPTIONS: KycHardwareProductOption[] = [
  { value: "", label: "None" },
  { value: "endpoint_security", label: "Endpoint Security" },
  { value: "gateway_security", label: "Gateway Security" },
  { value: "nms", label: "NMS" },
  { value: "firewall", label: "Firewall" },
  { value: "waf", label: "WAF" },
  { value: "ids_ips", label: "IDS/IPS" },
  { value: "siem", label: "SIEM" },
  { value: "soar", label: "SOAR" },
  { value: "edr", label: "EDR" },
  { value: "xdr", label: "XDR" },
  { value: "dlp", label: "DLP" },
  { value: "email_security", label: "Email Security" },
  { value: "pam", label: "Privileged Access Management (PAM)" },
  { value: "iam", label: "IAM" },
  { value: "vpn", label: "VPN" },
  { value: "ddos_protection", label: "DDoS Protection" },
  { value: "vulnerability_management", label: "Vulnerability Management" },
  { value: "threat_intelligence", label: "Threat Intelligence" },
  { value: KYC_PRODUCT_OTHER_VALUE, label: KYC_PRODUCT_OTHER_LABEL },
];

export function isKycProductPreset(
  value: string,
  options: readonly KycHardwareProductOption[],
): boolean {
  if (!value || value === KYC_PRODUCT_OTHER_VALUE) return true;
  return options.some((option) => option.value === value && option.value !== KYC_PRODUCT_OTHER_VALUE);
}

export function kycProductSelectValue(
  value: string,
  options: readonly KycHardwareProductOption[],
): string {
  if (!value) return "";
  if (value === KYC_PRODUCT_OTHER_VALUE) return KYC_PRODUCT_OTHER_VALUE;
  if (isKycProductPreset(value, options)) return value;
  return KYC_PRODUCT_OTHER_VALUE;
}

function newRowId(): string {
  return `row-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function emptyKycGridRow(): KycGridRow {
  return { id: newRowId(), network_profile: "", numbers: "", oem: "", major_partner: "" };
}

export function emptyKycContactRow(): KycContactRow {
  return { id: newRowId(), designation: "", name: "", mobile: "", email: "" };
}

export function emptyKycFormData(companyName = "", companyAccountLabel = ""): CrmKycFormData {
  return {
    company_name: companyName,
    number_of_locations: "",
    roc: "",
    coi: "",
    gst_no: "",
    pan: "",
    corporate_hq: "",
    it_budget_per_year: "",
    company_account_label: companyAccountLabel,
    quote_label: "",
    tan: "",
    number_of_employees: "",
    users_major_partner: "",
    res: "",
    res_no_of_engineer: "",
    res_expiry_date: "",
    amcs: "",
    amcs_no_of_engineer: "",
    amcs_expiry_date: "",
    network_profiles: [emptyKycGridRow()],
    cloud_rows: [emptyKycGridRow()],
    security_rows: [emptyKycGridRow()],
    contact_rows: [emptyKycContactRow()],
  };
}

/** Preset designations for KYC Contact table (deduplicated; spelling normalized). */
export const KYC_CONTACT_DESIGNATION_OTHER = "Others";

export const KYC_CONTACT_DESIGNATION_OPTIONS = [
  "CEO",
  "COO",
  "CTO",
  "CIO",
  "CFO",
  "CISO",
  "CDO",
  "CHRO",
  "CMO",
  "CRO",
  "CPO",
  "CSO",
  "CCO",
  "CSCO",
  "Procurement Head",
  "Purchase Head",
  "Purchase Manager",
  "Purchase Executive",
  "Senior Purchase Manager",
  "Procurement Director",
  "Head of Strategic Sourcing",
  "Vendor Manager",
  "IT Head",
  "Infra Head",
  "VP Engineering",
  "VP Technology",
  "VP Product",
  "VP Operations",
  "Engineering Director",
  "IT Director",
  "Senior IT Manager",
  "IT Manager",
  "Senior Project Manager",
  "Project Manager",
  "Development Manager",
  "Infra Manager",
  "QA Manager",
  "Product Manager",
  "Technical Lead",
  "DevOps Lead",
  "DevOps Head",
  "Senior Software Engineer",
  "Senior DevOps Engineer",
  "Cloud Manager",
  "Cloud Head",
  "Security Engineer",
  "Security Manager",
  "Network Manager",
  KYC_CONTACT_DESIGNATION_OTHER,
] as const;

const KYC_CONTACT_DESIGNATION_PRESET_SET = new Set<string>(KYC_CONTACT_DESIGNATION_OPTIONS);

export function isKycContactDesignationPreset(value: string): boolean {
  return KYC_CONTACT_DESIGNATION_PRESET_SET.has(value);
}

export function kycContactDesignationPresetLabel(value: string): string {
  if (!value) return "";
  if (value === KYC_CONTACT_DESIGNATION_OTHER) return KYC_CONTACT_DESIGNATION_OTHER;
  if (isKycContactDesignationPreset(value)) return value;
  return KYC_CONTACT_DESIGNATION_OTHER;
}
