// Dashboard KPIs (computed from prospects)
export const dashboardStats = {
  totalProspects: 12,
  hotLeads: 4,
  warmLeads: 4,
  coldLeads: 4,
  registered: 5,
};

// Today's Focus
export const todaysFocus = {
  followUps: [
    { id: 1, name: 'Thabo Molefe', action: 'Send product catalog', temperature: 'Hot' as const },
    { id: 2, name: 'Zanele Mbeki', action: 'Close registration', temperature: 'Hot' as const },
    { id: 3, name: 'Palesa Mokoena', action: 'Schedule follow-up call', temperature: 'Warm' as const },
  ],
  meetings: [
    { id: 1, name: 'Thabo Molefe', time: '14:00', type: 'Business Presentation' },
    { id: 2, name: 'Tshepo Modise', time: '11:00', type: 'Onboarding Call' },
  ],
  hotLeadsNeedingAction: [
    { id: 1, name: 'Zanele Mbeki', status: 'Ready to sign', daysSinceContact: 2 },
    { id: 2, name: 'Kagiso Tau', status: 'Building team', daysSinceContact: 0 },
  ],
};

// Recent Activities (Nimble-style feed)
export const recentActivities = [
  { id: 1, type: 'whatsapp', contact: 'Thabo Molefe', description: 'Sent product catalog via WhatsApp', time: '10 min ago' },
  { id: 2, type: 'call', contact: 'Sipho Nkosi', description: 'Training call completed', time: '45 min ago' },
  { id: 3, type: 'meeting', contact: 'Zanele Mbeki', description: 'Business presentation done', time: '2 hours ago' },
  { id: 4, type: 'registration', contact: 'Kagiso Tau', description: 'Activated as distributor', time: '3 hours ago' },
  { id: 5, type: 'whatsapp', contact: 'Mandla Zulu', description: 'Followed up on order', time: '4 hours ago' },
  { id: 6, type: 'call', contact: 'Naledi Khumalo', description: 'Discovery call scheduled', time: '5 hours ago' },
];

export const kpiData = {
  contacts: 1247,
  deals: 89,
  tasks: 23,
  activities: 156,
};

export const todayTasks = [
  { id: 1, title: 'Call back Sarah Chen', due: '10:00 AM', completed: false, priority: 'high' },
  { id: 2, title: 'Send proposal to Acme Corp', due: '11:30 AM', completed: true, priority: 'medium' },
  { id: 3, title: 'Review contract terms', due: '2:00 PM', completed: false, priority: 'high' },
  { id: 4, title: 'Update CRM notes', due: '4:00 PM', completed: false, priority: 'low' },
  { id: 5, title: 'Prepare demo slides', due: '5:00 PM', completed: false, priority: 'medium' },
];

export const pipelineSummary = [
  { stage: 'New', count: 12, value: 45000 },
  { stage: 'Qualified', count: 8, value: 120000 },
  { stage: 'Proposal', count: 5, value: 85000 },
  { stage: 'Won', count: 15, value: 340000 },
  { stage: 'Lost', count: 4, value: 28000 },
];

export const deals = [
  { id: 1, title: 'TechFlow Enterprise License', value: 45000, contact: 'Sarah Chen', stage: 'Proposal' },
  { id: 2, title: 'DataSync Annual Plan', value: 28000, contact: 'Michael Torres', stage: 'Qualified' },
  { id: 3, title: 'CloudBase Starter', value: 12000, contact: 'Emily Watson', stage: 'New' },
  { id: 4, title: 'FinanceHub Pro', value: 65000, contact: 'James Miller', stage: 'Won' },
  { id: 5, title: 'GrowthLabs Team', value: 18000, contact: 'Lisa Park', stage: 'New' },
];

// MLM Prospects Schema
export interface Prospect {
  id: number;
  DateCaptured: string;
  FullName: string;
  PhoneNumber: string;
  EmailAddress: string;
  City: string;
  Province: string;
  State: string;
  Country: string;
  LeadTemperature: 'Hot' | 'Warm' | 'Cold';
  CommunicationStatus: 'New' | 'In Progress' | 'Pending' | 'Completed';
  RegistrationStatus: 'Registered' | 'Not Registered' | 'Activated';
  LeadType: 'Prospect' | 'Registered_Nopurchase' | 'Purchase_Nostatus' | 'Purchase_Status';
  InterestLevel: 'High' | 'Medium' | 'Low';
  FocusArea: 'Health Transformation' | 'Business Opportunity' | 'Both';
  LeadPath: 'Customer' | 'Distributor' | 'Not sure yet';
  SponsorName: string;
  AssignedTo: string;
  ActionTaken: string;
  NextAction: string;
  MeetingTime: string;
  APLGoID: string;
  AssociateStatus: string;
  AdditionalNotes: string;
  GOStatus: string;
}

export const prospects: Prospect[] = [
  {
    id: 1,
    DateCaptured: '2026-02-08',
    FullName: 'Thabo Molefe',
    PhoneNumber: '+27 82 345 6789',
    EmailAddress: 'thabo.molefe@gmail.com',
    City: 'Johannesburg',
    Province: 'Gauteng',
    State: '',
    Country: 'South Africa',
    LeadTemperature: 'Hot',
    CommunicationStatus: 'In Progress',
    RegistrationStatus: 'Not Registered',
    LeadType: 'Prospect',
    InterestLevel: 'High',
    FocusArea: 'Both',
    LeadPath: 'Distributor',
    SponsorName: 'Alex Morgan',
    AssignedTo: 'Alex Morgan',
    ActionTaken: 'Initial call completed',
    NextAction: 'Send product catalog',
    MeetingTime: '2026-02-10 14:00',
    APLGoID: '',
    AssociateStatus: 'Pending',
    AdditionalNotes: 'Very interested in business opportunity',
    GOStatus: '',
  },
  {
    id: 2,
    DateCaptured: '2026-02-07',
    FullName: 'Naledi Khumalo',
    PhoneNumber: '+27 83 456 7890',
    EmailAddress: 'naledi.k@outlook.com',
    City: 'Pretoria',
    Province: 'Gauteng',
    State: '',
    Country: 'South Africa',
    LeadTemperature: 'Warm',
    CommunicationStatus: 'New',
    RegistrationStatus: 'Not Registered',
    LeadType: 'Prospect',
    InterestLevel: 'Medium',
    FocusArea: 'Health Transformation',
    LeadPath: 'Customer',
    SponsorName: 'Alex Morgan',
    AssignedTo: 'Alex Morgan',
    ActionTaken: '',
    NextAction: 'Schedule intro call',
    MeetingTime: '',
    APLGoID: '',
    AssociateStatus: '',
    AdditionalNotes: 'Referred by existing customer',
    GOStatus: '',
  },
  {
    id: 3,
    DateCaptured: '2026-02-06',
    FullName: 'Sipho Nkosi',
    PhoneNumber: '+27 84 567 8901',
    EmailAddress: 'sipho.nkosi@yahoo.com',
    City: 'Durban',
    Province: 'KwaZulu-Natal',
    State: '',
    Country: 'South Africa',
    LeadTemperature: 'Hot',
    CommunicationStatus: 'Completed',
    RegistrationStatus: 'Activated',
    LeadType: 'Purchase_Status',
    InterestLevel: 'High',
    FocusArea: 'Business Opportunity',
    LeadPath: 'Distributor',
    SponsorName: 'Alex Morgan',
    AssignedTo: 'Alex Morgan',
    ActionTaken: 'Signed up as distributor',
    NextAction: 'Training session',
    MeetingTime: '2026-02-12 10:00',
    APLGoID: 'APL-78234',
    AssociateStatus: 'Active',
    AdditionalNotes: 'Fast starter, very motivated',
    GOStatus: '',
  },
  {
    id: 4,
    DateCaptured: '2026-02-05',
    FullName: 'Lerato Dlamini',
    PhoneNumber: '+27 85 678 9012',
    EmailAddress: 'lerato.d@gmail.com',
    City: 'Cape Town',
    Province: 'Western Cape',
    State: '',
    Country: 'South Africa',
    LeadTemperature: 'Cold',
    CommunicationStatus: 'Pending',
    RegistrationStatus: 'Not Registered',
    LeadType: 'Prospect',
    InterestLevel: 'Low',
    FocusArea: 'Health Transformation',
    LeadPath: 'Not sure yet',
    SponsorName: 'Alex Morgan',
    AssignedTo: 'Sarah Botha',
    ActionTaken: 'Left voicemail',
    NextAction: 'Follow up in 1 week',
    MeetingTime: '',
    APLGoID: '',
    AssociateStatus: '',
    AdditionalNotes: 'Busy schedule, try again later',
    GOStatus: '',
  },
  {
    id: 5,
    DateCaptured: '2026-02-04',
    FullName: 'Mandla Zulu',
    PhoneNumber: '+27 86 789 0123',
    EmailAddress: 'mandla.zulu@icloud.com',
    City: 'Bloemfontein',
    Province: 'Free State',
    State: '',
    Country: 'South Africa',
    LeadTemperature: 'Warm',
    CommunicationStatus: 'In Progress',
    RegistrationStatus: 'Registered',
    LeadType: 'Registered_Nopurchase',
    InterestLevel: 'Medium',
    FocusArea: 'Health Transformation',
    LeadPath: 'Customer',
    SponsorName: 'Alex Morgan',
    AssignedTo: 'Alex Morgan',
    ActionTaken: 'Product demo completed',
    NextAction: 'Process first order',
    MeetingTime: '2026-02-09 16:00',
    APLGoID: 'APL-78301',
    AssociateStatus: 'Customer',
    AdditionalNotes: 'Interested in weight management products',
    GOStatus: '',
  },
  {
    id: 6,
    DateCaptured: '2026-02-03',
    FullName: 'Zanele Mbeki',
    PhoneNumber: '+27 87 890 1234',
    EmailAddress: 'zanele.m@gmail.com',
    City: 'Port Elizabeth',
    Province: 'Eastern Cape',
    State: '',
    Country: 'South Africa',
    LeadTemperature: 'Hot',
    CommunicationStatus: 'In Progress',
    RegistrationStatus: 'Not Registered',
    LeadType: 'Prospect',
    InterestLevel: 'High',
    FocusArea: 'Both',
    LeadPath: 'Distributor',
    SponsorName: 'Sipho Nkosi',
    AssignedTo: 'Alex Morgan',
    ActionTaken: 'Business presentation done',
    NextAction: 'Close registration',
    MeetingTime: '2026-02-11 09:00',
    APLGoID: '',
    AssociateStatus: 'Pending',
    AdditionalNotes: 'Ready to sign, needs sponsor approval',
    GOStatus: '',
  },
  {
    id: 7,
    DateCaptured: '2026-02-02',
    FullName: 'Bongani Sithole',
    PhoneNumber: '+27 72 901 2345',
    EmailAddress: 'bongani.s@hotmail.com',
    City: 'Polokwane',
    Province: 'Limpopo',
    State: '',
    Country: 'South Africa',
    LeadTemperature: 'Cold',
    CommunicationStatus: 'New',
    RegistrationStatus: 'Not Registered',
    LeadType: 'Prospect',
    InterestLevel: 'Low',
    FocusArea: 'Health Transformation',
    LeadPath: 'Not sure yet',
    SponsorName: 'Alex Morgan',
    AssignedTo: 'Sarah Botha',
    ActionTaken: '',
    NextAction: 'Initial contact',
    MeetingTime: '',
    APLGoID: '',
    AssociateStatus: '',
    AdditionalNotes: 'Facebook lead, needs qualification',
    GOStatus: '',
  },
  {
    id: 8,
    DateCaptured: '2026-02-01',
    FullName: 'Nomvula Mthembu',
    PhoneNumber: '+27 73 012 3456',
    EmailAddress: 'nomvula.m@gmail.com',
    City: 'Nelspruit',
    Province: 'Mpumalanga',
    State: '',
    Country: 'South Africa',
    LeadTemperature: 'Warm',
    CommunicationStatus: 'Completed',
    RegistrationStatus: 'Activated',
    LeadType: 'Purchase_Nostatus',
    InterestLevel: 'Medium',
    FocusArea: 'Health Transformation',
    LeadPath: 'Customer',
    SponsorName: 'Alex Morgan',
    AssignedTo: 'Alex Morgan',
    ActionTaken: 'First order placed',
    NextAction: 'Follow up on product experience',
    MeetingTime: '',
    APLGoID: 'APL-78156',
    AssociateStatus: 'Customer',
    AdditionalNotes: 'Happy with initial products',
    GOStatus: '',
  },
  {
    id: 9,
    DateCaptured: '2026-01-30',
    FullName: 'Tshepo Modise',
    PhoneNumber: '+27 74 123 4567',
    EmailAddress: 'tshepo.modise@gmail.com',
    City: 'Kimberley',
    Province: 'Northern Cape',
    State: '',
    Country: 'South Africa',
    LeadTemperature: 'Hot',
    CommunicationStatus: 'In Progress',
    RegistrationStatus: 'Registered',
    LeadType: 'Purchase_Status',
    InterestLevel: 'High',
    FocusArea: 'Business Opportunity',
    LeadPath: 'Distributor',
    SponsorName: 'Alex Morgan',
    AssignedTo: 'Alex Morgan',
    ActionTaken: 'Registration completed',
    NextAction: 'Onboarding call',
    MeetingTime: '2026-02-10 11:00',
    APLGoID: 'APL-78289',
    AssociateStatus: 'Pending Activation',
    AdditionalNotes: 'Experienced in network marketing',
    GOStatus: '',
  },
  {
    id: 10,
    DateCaptured: '2026-01-28',
    FullName: 'Palesa Mokoena',
    PhoneNumber: '+27 75 234 5678',
    EmailAddress: 'palesa.m@yahoo.com',
    City: 'Rustenburg',
    Province: 'North West',
    State: '',
    Country: 'South Africa',
    LeadTemperature: 'Warm',
    CommunicationStatus: 'Pending',
    RegistrationStatus: 'Not Registered',
    LeadType: 'Prospect',
    InterestLevel: 'Medium',
    FocusArea: 'Both',
    LeadPath: 'Not sure yet',
    SponsorName: 'Sipho Nkosi',
    AssignedTo: 'Sarah Botha',
    ActionTaken: 'Sent info pack',
    NextAction: 'Schedule follow-up call',
    MeetingTime: '',
    APLGoID: '',
    AssociateStatus: '',
    AdditionalNotes: 'Reviewing materials',
    GOStatus: '',
  },
  {
    id: 11,
    DateCaptured: '2026-01-25',
    FullName: 'Kagiso Tau',
    PhoneNumber: '+27 76 345 6789',
    EmailAddress: 'kagiso.tau@gmail.com',
    City: 'Soweto',
    Province: 'Gauteng',
    State: '',
    Country: 'South Africa',
    LeadTemperature: 'Hot',
    CommunicationStatus: 'Completed',
    RegistrationStatus: 'Activated',
    LeadType: 'Purchase_Status',
    InterestLevel: 'High',
    FocusArea: 'Business Opportunity',
    LeadPath: 'Distributor',
    SponsorName: 'Alex Morgan',
    AssignedTo: 'Alex Morgan',
    ActionTaken: 'Fully onboarded',
    NextAction: 'Weekly team meeting',
    MeetingTime: '2026-02-15 18:00',
    APLGoID: 'APL-78102',
    AssociateStatus: 'Active',
    AdditionalNotes: 'Building team actively',
    GOStatus: '',
  },
  {
    id: 12,
    DateCaptured: '2026-01-22',
    FullName: 'Lindiwe Ngcobo',
    PhoneNumber: '+27 77 456 7890',
    EmailAddress: 'lindiwe.n@outlook.com',
    City: 'Pietermaritzburg',
    Province: 'KwaZulu-Natal',
    State: '',
    Country: 'South Africa',
    LeadTemperature: 'Cold',
    CommunicationStatus: 'Pending',
    RegistrationStatus: 'Not Registered',
    LeadType: 'Prospect',
    InterestLevel: 'Low',
    FocusArea: 'Health Transformation',
    LeadPath: 'Customer',
    SponsorName: 'Alex Morgan',
    AssignedTo: 'Sarah Botha',
    ActionTaken: 'No response yet',
    NextAction: 'Try WhatsApp',
    MeetingTime: '',
    APLGoID: '',
    AssociateStatus: '',
    AdditionalNotes: 'Unresponsive to calls',
    GOStatus: '',
  },
];

// Column definitions for the prospects table
export const prospectColumns = [
  { key: 'DateCaptured', label: 'Date', default: true },
  { key: 'FullName', label: 'Full Name', default: true },
  { key: 'PhoneNumber', label: 'Phone', default: true },
  { key: 'EmailAddress', label: 'Email', default: true },
  { key: 'City', label: 'City', default: true },
  { key: 'Province', label: 'Province', default: false },
  { key: 'Country', label: 'Country', default: false },
  { key: 'LeadTemperature', label: 'Temperature', default: true },
  { key: 'CommunicationStatus', label: 'Comm. Status', default: true },
  { key: 'RegistrationStatus', label: 'Reg. Status', default: true },
  { key: 'LeadType', label: 'Lead Type', default: true },
  { key: 'InterestLevel', label: 'Interest', default: false },
  { key: 'FocusArea', label: 'Focus Area', default: true },
  { key: 'LeadPath', label: 'Lead Path', default: true },
  { key: 'SponsorName', label: 'Sponsor', default: false },
  { key: 'AssignedTo', label: 'Assigned To', default: true },
  { key: 'ActionTaken', label: 'Action Taken', default: false },
  { key: 'NextAction', label: 'Next Action', default: true },
  { key: 'MeetingTime', label: 'Meeting', default: false },
  { key: 'APLGoID', label: 'APL ID', default: false },
  { key: 'AssociateStatus', label: 'Assoc. Status', default: false },
  { key: 'AdditionalNotes', label: 'Notes', default: false },
  { key: 'GOStatus', label: 'GO Status', default: false },
];

// Filter options
export const filterOptions = {
  LeadTemperature: ['Hot', 'Warm', 'Cold'],
  RegistrationStatus: ['Registered', 'Not Registered', 'Activated'],
  LeadType: ['Prospect', 'Registered_Nopurchase', 'Purchase_Nostatus', 'Purchase_Status'],
  FocusArea: ['Health Transformation', 'Business Opportunity', 'Both'],
  LeadPath: ['Customer', 'Distributor', 'Not sure yet'],
};

// Orders Schema
export interface Order {
  id: number;
  orderId: string;
  contactName: string;
  product: string;
  quantity: number;
  amount: number;
  status: 'Pending' | 'Paid' | 'Delivered' | 'Activated';
  orderDate: string;
  badges: ('Activated' | 'First Order' | 'Upgrade')[];
}

export const orders: Order[] = [
  {
    id: 1,
    orderId: 'ORD-2026-0089',
    contactName: 'Sipho Nkosi',
    product: 'Business Starter Pack',
    quantity: 1,
    amount: 4500,
    status: 'Activated',
    orderDate: '2026-02-08',
    badges: ['Activated', 'First Order'],
  },
  {
    id: 2,
    orderId: 'ORD-2026-0088',
    contactName: 'Mandla Zulu',
    product: 'Wellness Bundle',
    quantity: 2,
    amount: 1890,
    status: 'Delivered',
    orderDate: '2026-02-07',
    badges: [],
  },
  {
    id: 3,
    orderId: 'ORD-2026-0087',
    contactName: 'Nomvula Mthembu',
    product: 'Weight Management Kit',
    quantity: 1,
    amount: 2350,
    status: 'Delivered',
    orderDate: '2026-02-06',
    badges: ['First Order'],
  },
  {
    id: 4,
    orderId: 'ORD-2026-0086',
    contactName: 'Kagiso Tau',
    product: 'Premium Business Pack',
    quantity: 1,
    amount: 8900,
    status: 'Activated',
    orderDate: '2026-02-05',
    badges: ['Activated', 'Upgrade'],
  },
  {
    id: 5,
    orderId: 'ORD-2026-0085',
    contactName: 'Thabo Molefe',
    product: 'Starter Wellness Pack',
    quantity: 1,
    amount: 1250,
    status: 'Pending',
    orderDate: '2026-02-04',
    badges: [],
  },
  {
    id: 6,
    orderId: 'ORD-2026-0084',
    contactName: 'Zanele Mbeki',
    product: 'Energy Boost Bundle',
    quantity: 3,
    amount: 2100,
    status: 'Paid',
    orderDate: '2026-02-03',
    badges: [],
  },
  {
    id: 7,
    orderId: 'ORD-2026-0083',
    contactName: 'Tshepo Modise',
    product: 'Business Starter Pack',
    quantity: 1,
    amount: 4500,
    status: 'Paid',
    orderDate: '2026-02-02',
    badges: ['First Order'],
  },
  {
    id: 8,
    orderId: 'ORD-2026-0082',
    contactName: 'Palesa Mokoena',
    product: 'Wellness Sample Kit',
    quantity: 1,
    amount: 450,
    status: 'Delivered',
    orderDate: '2026-02-01',
    badges: ['First Order'],
  },
  {
    id: 9,
    orderId: 'ORD-2026-0081',
    contactName: 'Sipho Nkosi',
    product: 'Monthly Reorder - Wellness',
    quantity: 1,
    amount: 1650,
    status: 'Delivered',
    orderDate: '2026-01-28',
    badges: [],
  },
  {
    id: 10,
    orderId: 'ORD-2026-0080',
    contactName: 'Kagiso Tau',
    product: 'Team Builder Kit',
    quantity: 2,
    amount: 3200,
    status: 'Activated',
    orderDate: '2026-01-25',
    badges: ['Activated'],
  },
];

export const orderFilterOptions = {
  status: ['Pending', 'Paid', 'Delivered', 'Activated'],
  product: ['Business Starter Pack', 'Premium Business Pack', 'Wellness Bundle', 'Weight Management Kit', 'Starter Wellness Pack', 'Energy Boost Bundle', 'Wellness Sample Kit', 'Monthly Reorder - Wellness', 'Team Builder Kit'],
};

// WhatsApp Conversations
export interface WhatsAppMessage {
  id: number;
  text: string;
  sender: 'user' | 'contact';
  timestamp: string;
}

export interface WhatsAppConversation {
  id: number;
  contactName: string;
  phoneNumber: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  status: 'online' | 'offline' | 'typing';
  leadTemperature: 'Hot' | 'Warm' | 'Cold';
  messages: WhatsAppMessage[];
}

export const whatsappConversations: WhatsAppConversation[] = [
  {
    id: 1,
    contactName: 'Thabo Molefe',
    phoneNumber: '+27 82 345 6789',
    lastMessage: 'Thanks for the product info! When can we meet?',
    lastMessageTime: '10:32 AM',
    unreadCount: 2,
    status: 'online',
    leadTemperature: 'Hot',
    messages: [
      { id: 1, text: 'Hi Thabo! I wanted to share some exciting products with you.', sender: 'user', timestamp: '10:15 AM' },
      { id: 2, text: 'Hi! Yes, I\'ve been waiting for this. What do you have?', sender: 'contact', timestamp: '10:18 AM' },
      { id: 3, text: 'I\'m sending you our wellness catalog. These products have helped thousands transform their health.', sender: 'user', timestamp: '10:22 AM' },
      { id: 4, text: 'Wow, this looks great! I\'m especially interested in the weight management products.', sender: 'contact', timestamp: '10:28 AM' },
      { id: 5, text: 'Thanks for the product info! When can we meet?', sender: 'contact', timestamp: '10:32 AM' },
    ],
  },
  {
    id: 2,
    contactName: 'Sipho Nkosi',
    phoneNumber: '+27 84 567 8901',
    lastMessage: 'I\'ve signed up 3 new team members this week!',
    lastMessageTime: '9:45 AM',
    unreadCount: 0,
    status: 'online',
    leadTemperature: 'Hot',
    messages: [
      { id: 1, text: 'Great job on the training yesterday!', sender: 'user', timestamp: '9:30 AM' },
      { id: 2, text: 'Thanks! I\'ve signed up 3 new team members this week!', sender: 'contact', timestamp: '9:45 AM' },
    ],
  },
  {
    id: 3,
    contactName: 'Zanele Mbeki',
    phoneNumber: '+27 87 890 1234',
    lastMessage: 'Let me discuss with my husband and get back to you',
    lastMessageTime: 'Yesterday',
    unreadCount: 0,
    status: 'offline',
    leadTemperature: 'Hot',
    messages: [
      { id: 1, text: 'Hi Zanele, are you ready to complete your registration?', sender: 'user', timestamp: 'Yesterday' },
      { id: 2, text: 'Let me discuss with my husband and get back to you', sender: 'contact', timestamp: 'Yesterday' },
    ],
  },
  {
    id: 4,
    contactName: 'Mandla Zulu',
    phoneNumber: '+27 86 789 0123',
    lastMessage: 'Order received, thank you!',
    lastMessageTime: 'Yesterday',
    unreadCount: 0,
    status: 'offline',
    leadTemperature: 'Warm',
    messages: [
      { id: 1, text: 'Your order has been shipped! Tracking: ZA123456789', sender: 'user', timestamp: 'Yesterday' },
      { id: 2, text: 'Order received, thank you!', sender: 'contact', timestamp: 'Yesterday' },
    ],
  },
  {
    id: 5,
    contactName: 'Naledi Khumalo',
    phoneNumber: '+27 83 456 7890',
    lastMessage: 'Can you send me more information about the business?',
    lastMessageTime: 'Yesterday',
    unreadCount: 1,
    status: 'offline',
    leadTemperature: 'Warm',
    messages: [
      { id: 1, text: 'Hi Naledi! Great speaking with you earlier.', sender: 'user', timestamp: 'Yesterday' },
      { id: 2, text: 'Can you send me more information about the business?', sender: 'contact', timestamp: 'Yesterday' },
    ],
  },
  {
    id: 6,
    contactName: 'Tshepo Modise',
    phoneNumber: '+27 74 123 4567',
    lastMessage: 'See you at the training tomorrow!',
    lastMessageTime: '2 days ago',
    unreadCount: 0,
    status: 'offline',
    leadTemperature: 'Hot',
    messages: [
      { id: 1, text: 'Reminder: Team training tomorrow at 10 AM', sender: 'user', timestamp: '2 days ago' },
      { id: 2, text: 'See you at the training tomorrow!', sender: 'contact', timestamp: '2 days ago' },
    ],
  },
  {
    id: 7,
    contactName: 'Palesa Mokoena',
    phoneNumber: '+27 75 234 5678',
    lastMessage: 'I\'ll review the materials and let you know',
    lastMessageTime: '3 days ago',
    unreadCount: 0,
    status: 'offline',
    leadTemperature: 'Warm',
    messages: [
      { id: 1, text: 'Here\'s the info pack I promised. Let me know if you have questions!', sender: 'user', timestamp: '3 days ago' },
      { id: 2, text: 'I\'ll review the materials and let you know', sender: 'contact', timestamp: '3 days ago' },
    ],
  },
  {
    id: 8,
    contactName: 'Lerato Dlamini',
    phoneNumber: '+27 85 678 9012',
    lastMessage: 'Sorry, been busy. Can we talk next week?',
    lastMessageTime: '1 week ago',
    unreadCount: 0,
    status: 'offline',
    leadTemperature: 'Cold',
    messages: [
      { id: 1, text: 'Hi Lerato, just following up on our conversation.', sender: 'user', timestamp: '1 week ago' },
      { id: 2, text: 'Sorry, been busy. Can we talk next week?', sender: 'contact', timestamp: '1 week ago' },
    ],
  },
];

// Extended Activities for Timeline
export interface TimelineActivity {
  id: number;
  type: 'whatsapp' | 'call' | 'meeting' | 'order' | 'note' | 'registration';
  contactName: string;
  contactId: number;
  summary: string;
  details: string;
  timestamp: string;
  date: string; // ISO date for grouping
  dateGroup: 'today' | 'yesterday' | 'earlier';
}

export const timelineActivities: TimelineActivity[] = [
  // Today
  {
    id: 1,
    type: 'whatsapp',
    contactName: 'Thabo Molefe',
    contactId: 1,
    summary: 'Sent product catalog via WhatsApp',
    details: 'Shared wellness product brochure and pricing. Customer showed strong interest in weight management products.',
    timestamp: '10:32 AM',
    date: '2026-02-09',
    dateGroup: 'today',
  },
  {
    id: 2,
    type: 'call',
    contactName: 'Sipho Nkosi',
    contactId: 3,
    summary: 'Training call completed',
    details: 'Covered product knowledge module 2. Discussed compensation plan basics. Scheduled next session for Thursday.',
    timestamp: '9:45 AM',
    date: '2026-02-09',
    dateGroup: 'today',
  },
  {
    id: 3,
    type: 'order',
    contactName: 'Mandla Zulu',
    contactId: 5,
    summary: 'New order placed - Wellness Bundle',
    details: 'Order #ORD-2026-0088 for R1,890. Quantity: 2. Payment received via EFT.',
    timestamp: '8:15 AM',
    date: '2026-02-09',
    dateGroup: 'today',
  },
  // Yesterday
  {
    id: 4,
    type: 'meeting',
    contactName: 'Zanele Mbeki',
    contactId: 6,
    summary: 'Business presentation done',
    details: 'Presented full compensation plan and product range. Very interested in distributor path. Following up tomorrow.',
    timestamp: '3:00 PM',
    date: '2026-02-08',
    dateGroup: 'yesterday',
  },
  {
    id: 5,
    type: 'registration',
    contactName: 'Kagiso Tau',
    contactId: 11,
    summary: 'Activated as distributor',
    details: 'Completed registration process. APL ID: APL-78102. Added to team WhatsApp group.',
    timestamp: '2:30 PM',
    date: '2026-02-08',
    dateGroup: 'yesterday',
  },
  {
    id: 6,
    type: 'whatsapp',
    contactName: 'Naledi Khumalo',
    contactId: 2,
    summary: 'Sent business opportunity info',
    details: 'Shared income disclosure and testimonials. Customer requested follow-up call next week.',
    timestamp: '11:00 AM',
    date: '2026-02-08',
    dateGroup: 'yesterday',
  },
  {
    id: 7,
    type: 'note',
    contactName: 'Lerato Dlamini',
    contactId: 4,
    summary: 'Added follow-up reminder',
    details: 'Customer mentioned being busy with work. Best to contact in evenings after 6 PM.',
    timestamp: '10:15 AM',
    date: '2026-02-08',
    dateGroup: 'yesterday',
  },
  // Earlier
  {
    id: 8,
    type: 'call',
    contactName: 'Tshepo Modise',
    contactId: 9,
    summary: 'Onboarding call completed',
    details: 'Walked through starter kit contents and first 30 days action plan. Very motivated.',
    timestamp: '4:00 PM',
    date: '2026-02-07',
    dateGroup: 'earlier',
  },
  {
    id: 9,
    type: 'order',
    contactName: 'Nomvula Mthembu',
    contactId: 8,
    summary: 'First order placed - Weight Management Kit',
    details: 'Order #ORD-2026-0087 for R2,350. First-time customer. Delivery scheduled for Friday.',
    timestamp: '2:00 PM',
    date: '2026-02-07',
    dateGroup: 'earlier',
  },
  {
    id: 10,
    type: 'meeting',
    contactName: 'Palesa Mokoena',
    contactId: 10,
    summary: 'Discovery call held',
    details: 'Initial discovery call. Interested in both health and business opportunity. Sent info pack.',
    timestamp: '11:30 AM',
    date: '2026-02-06',
    dateGroup: 'earlier',
  },
  {
    id: 11,
    type: 'whatsapp',
    contactName: 'Bongani Sithole',
    contactId: 7,
    summary: 'Initial contact made',
    details: 'Facebook lead. Sent welcome message and company overview video.',
    timestamp: '9:00 AM',
    date: '2026-02-05',
    dateGroup: 'earlier',
  },
  {
    id: 12,
    type: 'note',
    contactName: 'Lindiwe Ngcobo',
    contactId: 12,
    summary: 'Marked as cold lead',
    details: 'Multiple contact attempts with no response. Will try again in 2 weeks via WhatsApp.',
    timestamp: '3:30 PM',
    date: '2026-02-04',
    dateGroup: 'earlier',
  },
];

export const activityFilterOptions = {
  type: ['whatsapp', 'call', 'meeting', 'order', 'note', 'registration'],
};
