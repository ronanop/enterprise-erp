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
  ai_rows: KycGridRow[];
  software_rows: KycGridRow[];
  fsm_rows: KycGridRow[];
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
  { value: "ngfw", label: "Next-Generation Firewall (NGFW)" },
  { value: "waf", label: "Web Application Firewall (WAF)" },
  { value: "epp", label: "Endpoint Protection Platform (EPP)" },
  { value: "edr", label: "Endpoint Detection & Response (EDR)" },
  { value: "xdr", label: "Extended Detection & Response (XDR)" },
  { value: "antivirus_anti_malware", label: "Antivirus / Anti-Malware" },
  { value: "email_security", label: "Email Security" },
  { value: "network_security", label: "Network Security" },
  { value: "swg", label: "Secure Web Gateway (SWG)" },
  { value: "sase", label: "Secure Access Service Edge (SASE)" },
  { value: "ztna", label: "Zero Trust Network Access (ZTNA)" },
  { value: "vpn", label: "Virtual Private Network (VPN)" },
  { value: "ips", label: "Intrusion Prevention System (IPS)" },
  { value: "ids", label: "Intrusion Detection System (IDS)" },
  { value: "siem", label: "Security Information & Event Management (SIEM)" },
  { value: "soar", label: "Security Orchestration, Automation & Response (SOAR)" },
  { value: "iam", label: "Identity & Access Management (IAM)" },
  { value: "pam", label: "Privileged Access Management (PAM)" },
  { value: "mfa", label: "Multi-Factor Authentication (MFA)" },
  { value: "sso", label: "Single Sign-On (SSO)" },
  { value: "iga", label: "Identity Governance & Administration (IGA)" },
  { value: "dlp", label: "Data Loss Prevention (DLP)" },
  { value: "casb", label: "Cloud Access Security Broker (CASB)" },
  { value: "cspm", label: "Cloud Security Posture Management (CSPM)" },
  { value: "cwpp", label: "Cloud Workload Protection (CWPP)" },
  { value: "cnapp", label: "Cloud-Native Application Protection Platform (CNAPP)" },
  { value: "vulnerability_management", label: "Vulnerability Management" },
  { value: "patch_management", label: "Patch Management" },
  { value: "security_configuration_management", label: "Security Configuration Management" },
  { value: "application_security", label: "Application Security" },
  { value: "api_security", label: "API Security" },
  { value: "database_security", label: "Database Security" },
  { value: "nac", label: "Network Access Control (NAC)" },
  { value: "mobile_device_security", label: "Mobile Device Security" },
  { value: "mdm", label: "Mobile Device Management (MDM)" },
  { value: "encryption", label: "Encryption" },
  { value: "key_management", label: "Key Management" },
  { value: "hsm", label: "Hardware Security Module (HSM)" },
  { value: "security_certificate_management", label: "Security Certificate Management" },
  { value: "backup_ransomware_protection", label: "Backup & Ransomware Protection" },
  { value: "disaster_recovery_security", label: "Disaster Recovery Security" },
  { value: "security_awareness_training", label: "Security Awareness & Training" },
  { value: "penetration_testing", label: "Penetration Testing" },
  { value: "vulnerability_assessment", label: "Vulnerability Assessment" },
  { value: "dfir", label: "Digital Forensics & Incident Response (DFIR)" },
  { value: "mdr", label: "Managed Detection & Response (MDR)" },
  { value: "soc", label: "Security Operations Center (SOC)" },
  { value: "grc", label: "Governance, Risk & Compliance (GRC)" },
  { value: "endpoint_security", label: "Endpoint Security" },
  { value: "identity_security", label: "Identity Security" },
  { value: "cloud_security", label: "Cloud Security" },
  { value: "data_security", label: "Data Security" },
  { value: "security_operations", label: "Security Operations" },
  { value: "security_services", label: "Security Services" },
  { value: KYC_PRODUCT_OTHER_VALUE, label: KYC_PRODUCT_OTHER_LABEL },
];

/** Product options for AI Products table. */
export const KYC_AI_PRODUCT_OPTIONS: KycHardwareProductOption[] = [
  { value: "", label: "None" },
  { value: "generative_ai", label: "Generative AI" },
  { value: "ai_chatbot", label: "AI Chatbot" },
  { value: "ai_virtual_assistant", label: "AI Virtual Assistant" },
  { value: "ai_copilot", label: "AI Copilot" },
  { value: "ai_agent_agentic_ai", label: "AI Agent / Agentic AI" },
  { value: "ai_search", label: "AI Search" },
  { value: "enterprise_ai_search", label: "Enterprise AI Search" },
  { value: "ai_knowledge_management", label: "AI Knowledge Management" },
  { value: "machine_learning_platform", label: "Machine Learning Platform" },
  { value: "deep_learning_platform", label: "Deep Learning Platform" },
  { value: "nlp", label: "Natural Language Processing (NLP)" },
  { value: "computer_vision", label: "Computer Vision" },
  { value: "speech_recognition", label: "Speech Recognition" },
  { value: "text_to_speech", label: "Text-to-Speech" },
  { value: "ai_translation", label: "AI Translation" },
  { value: "document_ai", label: "Document AI" },
  { value: "idp", label: "Intelligent Document Processing (IDP)" },
  { value: "ocr", label: "Optical Character Recognition (OCR)" },
  { value: "predictive_analytics", label: "Predictive Analytics" },
  { value: "ai_data_analytics", label: "AI Data Analytics" },
  { value: "ai_business_intelligence", label: "AI Business Intelligence" },
  { value: "ai_recommendation_engine", label: "AI Recommendation Engine" },
  { value: "ai_fraud_detection", label: "AI Fraud Detection" },
  { value: "ai_risk_analytics", label: "AI Risk Analytics" },
  { value: "ai_cybersecurity", label: "AI Cybersecurity" },
  { value: "ai_threat_detection", label: "AI Threat Detection" },
  { value: "ai_code_assistant", label: "AI Code Assistant" },
  { value: "ai_software_development", label: "AI Software Development" },
  { value: "ai_testing_qa", label: "AI Testing & QA" },
  { value: "ai_automation", label: "AI Automation" },
  { value: "rpa_with_ai", label: "Robotic Process Automation (RPA) with AI" },
  { value: "ai_customer_service", label: "AI Customer Service" },
  { value: "ai_contact_center", label: "AI Contact Center" },
  { value: "ai_marketing", label: "AI Marketing" },
  { value: "ai_sales_assistant", label: "AI Sales Assistant" },
  { value: "ai_hr_recruitment", label: "AI HR / Recruitment" },
  { value: "ai_finance_accounting", label: "AI Finance & Accounting" },
  { value: "ai_healthcare", label: "AI Healthcare" },
  { value: "ai_iot", label: "AI IoT" },
  { value: "edge_ai", label: "Edge AI" },
  { value: "ai_infrastructure", label: "AI Infrastructure" },
  { value: "gpu_computing", label: "GPU Computing" },
  { value: "ai_cloud_services", label: "AI Cloud Services" },
  { value: "ai_model_hosting", label: "AI Model Hosting" },
  { value: "ai_model_management", label: "AI Model Management" },
  { value: "mlops", label: "MLOps" },
  { value: "ai_governance", label: "AI Governance" },
  { value: "ai_security", label: "AI Security" },
  { value: "ai_observability", label: "AI Observability" },
  { value: "ai_agent", label: "AI Agent" },
  { value: "machine_learning", label: "Machine Learning" },
  { value: "nlp_and_speech", label: "NLP & Speech" },
  { value: "ai_analytics", label: "AI Analytics" },
  { value: "ai_development", label: "AI Development" },
  { value: "ai_security_governance", label: "AI Security & Governance" },
  { value: "industry_specific_ai", label: "Industry-Specific AI" },
  { value: KYC_PRODUCT_OTHER_VALUE, label: KYC_PRODUCT_OTHER_LABEL },
];

/** Product options for Software table. */
export const KYC_SOFTWARE_PRODUCT_OPTIONS: KycHardwareProductOption[] = [
  { value: "", label: "None" },
  { value: "operating_systems", label: "Operating Systems" },
  { value: "productivity_software", label: "Productivity Software" },
  { value: "office_collaboration", label: "Office & Collaboration" },
  { value: "business_applications", label: "Business Applications" },
  { value: "erp", label: "Enterprise Resource Planning (ERP)" },
  { value: "crm", label: "Customer Relationship Management (CRM)" },
  { value: "hrms", label: "Human Resource Management (HRMS)" },
  { value: "finance_accounting", label: "Finance & Accounting" },
  { value: "scm", label: "Supply Chain Management (SCM)" },
  { value: "project_management", label: "Project Management" },
  { value: "itsm", label: "IT Service Management (ITSM)" },
  { value: "ecm", label: "Enterprise Content Management (ECM)" },
  { value: "document_management", label: "Document Management" },
  { value: "database_management", label: "Database Management" },
  { value: "data_analytics_bi", label: "Data Analytics & Business Intelligence" },
  { value: "software_development_tools", label: "Software Development Tools" },
  { value: "devops_cicd", label: "DevOps & CI/CD" },
  { value: "apm", label: "Application Performance Monitoring (APM)" },
  { value: "network_management", label: "Network Management" },
  { value: "systems_management", label: "Systems Management" },
  { value: "backup_recovery", label: "Backup & Recovery" },
  { value: "storage_management", label: "Storage Management" },
  { value: "security_software", label: "Security Software" },
  { value: "iam", label: "Identity & Access Management" },
  { value: "virtualization", label: "Virtualization" },
  { value: "container_management", label: "Container Management" },
  { value: "cloud_management", label: "Cloud Management" },
  { value: "email_communication", label: "Email & Communication" },
  { value: "video_conferencing", label: "Video Conferencing" },
  { value: "customer_service_contact_center", label: "Customer Service / Contact Center" },
  { value: "marketing_automation", label: "Marketing Automation" },
  { value: "ecommerce", label: "E-commerce" },
  { value: "lms", label: "Learning Management System (LMS)" },
  { value: "workflow_automation", label: "Workflow Automation" },
  { value: "rpa", label: "Robotic Process Automation (RPA)" },
  { value: "low_code_no_code", label: "Low-Code / No-Code Platform" },
  { value: "api_management", label: "API Management" },
  { value: "integration_platform", label: "Integration Platform" },
  { value: "middleware", label: "Middleware" },
  { value: "web_application_servers", label: "Web & Application Servers" },
  { value: "mobile_application_management", label: "Mobile Application Management" },
  { value: "remote_desktop_vdi", label: "Remote Desktop / VDI" },
  { value: "asset_management", label: "Asset Management" },
  { value: "license_management", label: "License Management" },
  { value: "monitoring_observability", label: "Monitoring & Observability" },
  { value: "quality_assurance_testing", label: "Quality Assurance & Testing" },
  { value: "design_creative_software", label: "Design & Creative Software" },
  { value: "gis_mapping_software", label: "GIS / Mapping Software" },
  { value: "industry_specific_software", label: "Industry-Specific Software" },
  { value: KYC_PRODUCT_OTHER_VALUE, label: KYC_PRODUCT_OTHER_LABEL },
];

/** Product options for FSM Information table. */
export const KYC_FSM_PRODUCT_OPTIONS: KycHardwareProductOption[] = [
  { value: "", label: "None" },
  { value: "field_service_management", label: "Field Service Management" },
  { value: "field_service_scheduling", label: "Field Service Scheduling" },
  { value: "workforce_management", label: "Workforce Management" },
  { value: "work_order_management", label: "Work Order Management" },
  { value: "technician_management", label: "Technician Management" },
  { value: "dispatch_management", label: "Dispatch Management" },
  { value: "scheduling_dispatch", label: "Scheduling & Dispatch" },
  { value: "route_optimization", label: "Route Optimization" },
  { value: "mobile_workforce_management", label: "Mobile Workforce Management" },
  { value: "mobile_field_service", label: "Mobile Field Service" },
  { value: "service_request_management", label: "Service Request Management" },
  { value: "service_appointment_management", label: "Service Appointment Management" },
  { value: "preventive_maintenance", label: "Preventive Maintenance" },
  { value: "asset_management", label: "Asset Management" },
  { value: "equipment_management", label: "Equipment Management" },
  { value: "asset_equipment_management", label: "Asset & Equipment Management" },
  { value: "spare_parts_management", label: "Spare Parts Management" },
  { value: "inventory_management", label: "Inventory Management" },
  { value: "inventory_spare_parts", label: "Inventory & Spare Parts" },
  { value: "contract_management", label: "Contract Management" },
  { value: "amc_management", label: "AMC Management" },
  { value: "amc_contract_management", label: "AMC & Contract Management" },
  { value: "warranty_management", label: "Warranty Management" },
  { value: "sla_management", label: "SLA Management" },
  { value: "service_billing", label: "Service Billing" },
  { value: "time_expense_management", label: "Time & Expense Management" },
  { value: "customer_service_management", label: "Customer Service Management" },
  { value: "customer_portal", label: "Customer Portal" },
  { value: "technician_mobile_app", label: "Technician Mobile App" },
  { value: "remote_assistance", label: "Remote Assistance" },
  { value: "remote_monitoring", label: "Remote Monitoring" },
  { value: "iot_based_field_service", label: "IoT-Based Field Service" },
  { value: "predictive_maintenance", label: "Predictive Maintenance" },
  { value: "iot_predictive_maintenance", label: "IoT & Predictive Maintenance" },
  { value: "service_analytics_reporting", label: "Service Analytics & Reporting" },
  { value: "service_analytics", label: "Service Analytics" },
  { value: "fsm_automation", label: "FSM Automation" },
  { value: "ai_powered_field_service", label: "AI-Powered Field Service" },
  { value: "ai_field_service", label: "AI Field Service" },
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
    ai_rows: [emptyKycGridRow()],
    software_rows: [emptyKycGridRow()],
    fsm_rows: [emptyKycGridRow()],
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
