import eEnterpriseLogo from '../assets/e_enterprise_logo.jpeg'

export const DEFAULT_PROJECT = {
  projectTitle: 'OneCloud Launch Tracker',
  projectSubtitle: 'Next Generation Sovereign Hyperscale Cloud',
  overallProgress: 35,
}

export const DEFAULT_METRICS = {
  totalServices: 150,
  dataCenters: 4,
  complianceCerts: 6,
  teamMembers: 45,
}

export const DEFAULT_ADMIN_SETTINGS = {
  primaryColor: '#E30613',
  secondaryColor: '#1B365D',
  accentColor: '#FFB81C',
  logoUrl: eEnterpriseLogo,
  companyName: 'e& enterprise',
}

export const DEFAULT_USERS = [
  {
    id: 'admin_001',
    name: 'System Administrator',
    email: 'admin@eenterprise.com',
    role: 'admin',
    pin: '1234',
    isActive: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    lastLogin: null,
  },
  {
    id: 'pm_001',
    name: 'Project Manager',
    email: 'pm@eenterprise.com',
    role: 'editor',
    pin: '5678',
    isActive: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    lastLogin: null,
  },
]

const OWNER = 'Munther Altawash'

// Task ids are stable strings so saved time tracking / comments survive reloads.
const t = (id, name, status, responsibleFunction) => ({
  id,
  name,
  status,
  responsiblePerson: OWNER,
  responsibleFunction,
  priority: 'medium',
  description: '',
  dueDate: '',
  estimatedHours: 0,
})

export const DEFAULT_PHASES = [
  {
    id: 'po',
    name: 'Purchase Order',
    status: 'completed',
    progress: 100,
    startDate: '2024-01-15',
    endDate: '2024-02-01',
    description: 'Contract finalization and purchase order processing',
    responsiblePerson: OWNER,
    responsibleFunction: 'Procurement Manager',
    tasks: [
      t('po_1', 'Contract Review', 'completed', 'Legal Counsel'),
      t('po_2', 'PO Generation', 'completed', 'Procurement Manager'),
      t('po_3', 'Budget Approval', 'completed', 'Finance Director'),
      t('po_4', 'Vendor Onboarding', 'completed', 'Vendor Relations'),
    ],
  },
  {
    id: 'legal',
    name: 'Legal & Compliance',
    status: 'in-progress',
    progress: 75,
    startDate: '2024-02-01',
    endDate: '2024-03-15',
    description: 'Legal documentation, compliance verification, and regulatory approvals',
    responsiblePerson: OWNER,
    responsibleFunction: 'Chief Legal Officer',
    tasks: [
      t('legal_1', 'Data Protection Agreement', 'completed', 'Legal Counsel'),
      t('legal_2', 'Compliance Audit', 'completed', 'Compliance Officer'),
      t('legal_3', 'Regulatory Approvals', 'in-progress', 'Regulatory Affairs'),
      t('legal_4', 'Security Clearance', 'pending', 'Security Director'),
    ],
  },
  {
    id: 'dc-readiness',
    name: 'Data Center Readiness',
    status: 'pending',
    progress: 0,
    startDate: '2024-03-15',
    endDate: '2024-05-30',
    description: 'Infrastructure setup, hardware installation, and network configuration',
    responsiblePerson: OWNER,
    responsibleFunction: 'Infrastructure Director',
    tasks: [
      t('dc_1', 'Hardware Procurement', 'pending', 'Infrastructure Director'),
      t('dc_2', 'DC Space Allocation', 'pending', 'Facilities Manager'),
      t('dc_3', 'Network Setup', 'pending', 'Network Architect'),
      t('dc_4', 'Power & Cooling', 'pending', 'DC Operations Manager'),
    ],
  },
  {
    id: 'service-launch',
    name: 'Service Launch',
    status: 'pending',
    progress: 0,
    startDate: '2024-05-30',
    endDate: '2024-07-15',
    description: 'Platform deployment, testing, and service activation',
    responsiblePerson: OWNER,
    responsibleFunction: 'Cloud Platform Director',
    tasks: [
      t('launch_1', 'Platform Deployment', 'pending', 'Cloud Platform Director'),
      t('launch_2', 'Security Testing', 'pending', 'Security Director'),
      t('launch_3', 'Performance Testing', 'pending', 'QA Lead'),
      t('launch_4', 'Go-Live Preparation', 'pending', 'Operations Manager'),
    ],
  },
  {
    id: 'post-launch',
    name: 'Post Launch',
    status: 'pending',
    progress: 0,
    startDate: '2024-07-15',
    endDate: '2024-09-30',
    description: 'Monitoring, optimization, and customer onboarding',
    responsiblePerson: OWNER,
    responsibleFunction: 'Operations Manager',
    tasks: [
      t('post_1', 'Performance Monitoring', 'pending', 'Operations Manager'),
      t('post_2', 'Customer Onboarding', 'pending', 'Customer Success Manager'),
      t('post_3', 'Service Optimization', 'pending', 'Senior Engineer'),
      t('post_4', 'Documentation', 'pending', 'Technical Writer'),
    ],
  },
]
