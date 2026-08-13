/** Static demo content for Part 2 ESS screens (portal extras). */

export type PortalNotification = {
  id: string;
  title: string;
  body: string;
  when: string;
  group: "today" | "yesterday" | "older";
  unread: boolean;
  tone: "blue" | "purple" | "green" | "red" | "amber";
  kind: "attendance" | "task" | "leave" | "salary" | "event" | "birthday";
};

export type PortalAnnouncement = {
  id: string;
  title: string;
  body: string;
  tag: string;
  tagTone: "critical" | "celebrations" | "policy" | "events" | "news";
  when: string;
  likes: number;
  comments: number;
  pinned?: boolean;
  image: string;
};

export type PortalHoliday = {
  id: string;
  name: string;
  date: string; // YYYY-MM-DD
  weekday: string;
  kind: "mandatory" | "optional";
};

export type TeamMemberDay = "duty" | "wfh" | "casual" | "sick" | "off";

export type TeamMember = {
  id: string;
  name: string;
  team: string;
  days: TeamMemberDay[];
};

export const mockNotifications: PortalNotification[] = [
  {
    id: "n1",
    title: "Attendance Alert",
    body: "You haven't clocked in yet today. Tap to check in.",
    when: "9:15 AM",
    group: "today",
    unread: true,
    tone: "blue",
    kind: "attendance",
  },
  {
    id: "n2",
    title: "New Task Assigned",
    body: "Complete Q3 expense reconciliation by Friday.",
    when: "11:40 AM",
    group: "today",
    unread: true,
    tone: "purple",
    kind: "task",
  },
  {
    id: "n3",
    title: "Leave Approved",
    body: "Your Casual Leave for tomorrow was approved.",
    when: "Yesterday",
    group: "yesterday",
    unread: false,
    tone: "green",
    kind: "leave",
  },
  {
    id: "n4",
    title: "Salary Disbursed",
    body: "June payslip is ready. Net pay credited successfully.",
    when: "Yesterday",
    group: "yesterday",
    unread: false,
    tone: "blue",
    kind: "salary",
  },
  {
    id: "n5",
    title: "Town Hall Meeting",
    body: "All-hands starts at 4:00 PM in Auditorium A.",
    when: "Oct 01",
    group: "older",
    unread: false,
    tone: "amber",
    kind: "event",
  },
  {
    id: "n6",
    title: "Birthday",
    body: "Wish Sarah Jenkins a happy birthday today!",
    when: "Sep 28",
    group: "older",
    unread: false,
    tone: "purple",
    kind: "birthday",
  },
];

export const mockAnnouncements: PortalAnnouncement[] = [
  {
    id: "a1",
    title: "Global HQ Expansion Strategy 2025",
    body: "We are thrilled to share the blueprint for our new regional hubs designed for hybrid collaboration.",
    tag: "CRITICAL",
    tagTone: "critical",
    when: "2h ago",
    likes: 210,
    comments: 34,
    pinned: true,
    image:
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&q=80",
  },
  {
    id: "a2",
    title: "Q3 Performance Awards Winners",
    body: "Celebrating outstanding contributions across Engineering, Design, and People Ops.",
    tag: "Celebrations",
    tagTone: "celebrations",
    when: "1d ago",
    likes: 124,
    comments: 18,
    image:
      "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=800&q=80",
  },
  {
    id: "a3",
    title: "Updated Remote Work Guidelines",
    body: "New hybrid policy takes effect next month. Review the updated handbook section.",
    tag: "Policy",
    tagTone: "policy",
    when: "3d ago",
    likes: 89,
    comments: 42,
    image:
      "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800&q=80",
  },
];

export const mockHolidays: PortalHoliday[] = [
  {
    id: "h1",
    name: "Independence Day",
    date: `${new Date().getFullYear()}-08-15`,
    weekday: "Friday",
    kind: "mandatory",
  },
  {
    id: "h2",
    name: "Gandhi Jayanti",
    date: `${new Date().getFullYear()}-10-02`,
    weekday: "Thursday",
    kind: "mandatory",
  },
  {
    id: "h3",
    name: "Diwali",
    date: `${new Date().getFullYear()}-10-20`,
    weekday: "Monday",
    kind: "mandatory",
  },
  {
    id: "h4",
    name: "Christmas Day",
    date: `${new Date().getFullYear()}-12-25`,
    weekday: "Thursday",
    kind: "optional",
  },
  {
    id: "h5",
    name: "New Year's Day",
    date: `${new Date().getFullYear() + 1}-01-01`,
    weekday: "Thursday",
    kind: "mandatory",
  },
];

export const mockTeam: TeamMember[] = [
  {
    id: "t1",
    name: "Sarah J.",
    team: "Design",
    days: ["duty", "duty", "wfh", "duty", "casual"],
  },
  {
    id: "t2",
    name: "Amit K.",
    team: "Engineering",
    days: ["duty", "duty", "duty", "wfh", "duty"],
  },
  {
    id: "t3",
    name: "Priya M.",
    team: "Engineering",
    days: ["sick", "sick", "duty", "duty", "duty"],
  },
  {
    id: "t4",
    name: "Leo C.",
    team: "Design",
    days: ["wfh", "wfh", "duty", "duty", "casual"],
  },
  {
    id: "t5",
    name: "Riya S.",
    team: "Engineering",
    days: ["duty", "duty", "duty", "duty", "duty"],
  },
];

/** —— Part 3: documents & assets —— */

export type PortalDocument = {
  id: string;
  title: string;
  category: "Personal" | "Company" | "Tax" | "Salary";
  modified: string;
  recent?: boolean;
};

export type PortalAsset = {
  id: string;
  name: string;
  specs: string;
  assetId: string;
  category: "Laptops" | "Mobile" | "Peripherals";
  status: "Active" | "In Use";
  serial: string;
  assigned: string;
  warranty: string;
};

export const mockDocuments: PortalDocument[] = [
  {
    id: "d1",
    title: "Salary_Slip_Jan.pdf",
    category: "Salary",
    modified: "Modified Jan 28",
    recent: true,
  },
  {
    id: "d2",
    title: "Offer_Letter_2024.pdf",
    category: "Company",
    modified: "Modified Mar 02",
    recent: true,
  },
  {
    id: "d3",
    title: "Offer Letter",
    category: "Company",
    modified: "Modified 2h ago",
  },
  {
    id: "d4",
    title: "Aadhaar Card",
    category: "Personal",
    modified: "Modified Aug 12",
  },
  {
    id: "d5",
    title: "Form 16 FY24",
    category: "Tax",
    modified: "Modified Jun 15",
  },
  {
    id: "d6",
    title: "PAN Card",
    category: "Personal",
    modified: "Modified Jan 04",
  },
];

export const mockAssets: PortalAsset[] = [
  {
    id: "a1",
    name: 'MacBook Pro 16"',
    specs: "M2 Max • 32GB • 1TB SSD",
    assetId: "MBP-2024-X42",
    category: "Laptops",
    status: "In Use",
    serial: "NX.V15AA.001.2429",
    assigned: "Jan 12, 2024",
    warranty: "Valid until Nov 2025",
  },
  {
    id: "a2",
    name: 'Dell UltraSharp 32"',
    specs: "4K • USB-C • HDR",
    assetId: "MON-2024-D12",
    category: "Peripherals",
    status: "Active",
    serial: "CN-0H7K8-742",
    assigned: "Jan 12, 2024",
    warranty: "Valid until Jan 2027",
  },
  {
    id: "a3",
    name: "iPhone 15 Pro",
    specs: "256GB • Dual SIM",
    assetId: "PHN-2024-I09",
    category: "Mobile",
    status: "In Use",
    serial: "F2LX9QH6N72",
    assigned: "Mar 01, 2024",
    warranty: "Valid until Mar 2026",
  },
];

export const mockEmergencyContacts = [
  {
    id: "e1",
    name: "Julian Rivera",
    relation: "Spouse",
    role: "Legal Guardian",
    email: "j.rivera@designmail.com",
    phone: "+1 (555) 100-2000",
    primary: true,
    blood: "B+",
  },
  {
    id: "e2",
    name: "Elena Vance",
    relation: "Sister",
    email: "elena.vance@workplace.com",
    phone: "+1 (555) 100-2001",
    blood: "O-",
    primary: false,
  },
  {
    id: "e3",
    name: "Marcus Kaine",
    relation: "Close Friend",
    email: "m.kaine@provider.net",
    phone: "+1 (555) 100-2002",
    blood: "B+",
    primary: false,
  },
];
