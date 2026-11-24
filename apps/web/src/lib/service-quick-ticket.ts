import {
  createServiceRequestTicket,
  loadTicketFormLookups,
  type ServiceRequestTicket,
} from "@/services/service-request-ticket-service";

function stamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
}

/**
 * One-click demo ticket: fills required + common SOP fields from lookups,
 * creates via API, then caller navigates to detail for assign / edit.
 */
export async function createQuickServiceTicket(): Promise<ServiceRequestTicket> {
  const lookups = await loadTicketFormLookups();
  const customer = lookups.customers[0];
  const branch = lookups.branches[0];
  const category = lookups.categories[0];
  const product = lookups.products[0];

  if (!customer?.value || !branch?.value || !category?.value) {
    const missing = [
      !customer?.value ? "customer" : null,
      !branch?.value ? "branch" : null,
      !category?.value ? "category" : null,
    ]
      .filter(Boolean)
      .join(", ");
    throw new Error(
      `Cannot generate ticket — missing master data (${missing}). Seed customers, branches, and service categories first.`,
    );
  }

  const id = stamp();
  const payload: Record<string, unknown> = {
    branch_id: branch.value,
    category_id: category.value,
    customer_id: customer.value,
    service_type: "managed_services",
    subject: `Quick ticket — link down at ${customer.label} (${id})`,
    contact_name: "Rahul Mehta",
    status: "ticket_registered",
    priority: "p3",
    channel: "portal",
    sla_status: "within_sla",
    email: "rahul.mehta@example.com",
    alternate_email: "noc@example.com",
    mobile: "9876543210",
    product_id: product?.value || undefined,
    asset_name: "Cisco ISR 4331",
    serial_number: `SN-QT-${id}`,
    asset_status: "existing_asset",
    amc_mail_sent: false,
    software_version: "IOS-XE 17.9.4a",
    issue_description:
      "Customer reports intermittent WAN drop on primary circuit. Link flaps every 10–15 minutes. Needs triage and remote diagnostics.",
    reference_sr_number: `SR-QT-${id}`,
    customer_reference: `CR-QT-${id}`,
    lsi: `LSI-QT-${id}`,
    ckt_id: `CKT-QT-${id}`,
    end_customer_name: customer.label,
    end_customer_email: "ops@endcustomer.example.com",
    coordinator_name: "Priya Nair",
    coordinator_phone: "9123456780",
    end_customer_street: "12 MG Road",
    end_customer_state: "Maharashtra",
    end_customer_city: "Mumbai",
    end_customer_city_type: "metro",
    end_customer_gst: "27AAAAA0000A1Z5",
    end_customer_postal_code: "400001",
    classification: "incident",
    next_plan: "Remote check → assign engineer if unresolved",
    additional_description: "Generated with one-click quick ticket for demo / UAT.",
    oem_support_enabled: false,
    site_availability: "24x7",
    site_instructions: "Call site coordinator before login. Collect RTR snaps if onsite needed.",
    link_type: "MPLS",
    bandwidth: "100 Mbps",
    ports_in_use: "Gi0/0/0",
    previous_fe_notes: "No prior FE visit for this incident.",
    ip_details: "Mgmt IP shared on secure channel after assignment.",
    mail_extra_info: "Inbound-style sample generated from portal quick create.",
    company_name_from_mail: customer.label,
  };

  return createServiceRequestTicket(payload);
}
