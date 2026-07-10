import { startTransition, useDeferredValue, useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import './App.css'
import {
  adminDemoUser,
  availabilitySnapshot,
  defaultViews,
  demoPassword,
  examTypes,
  initialAccessHistory,
  initialAdminPatients,
  initialAdmissions,
  initialAgenda,
  initialAppointments,
  initialAuditLogs,
  initialBeds,
  initialConsents,
  initialExams,
  initialFinanceReports,
  initialHomeCareVisits,
  initialNotifications,
  initialPatientProfile,
  initialPermissions,
  initialPrescriptions,
  initialProfessionals,
  initialSupplies,
  initialTelemedicineMessages,
  initialTimeline,
  initialUnits,
  moduleStatuses,
  professionalDemoUser,
  profileMenus,
  profileMeta,
  specialties,
  unitNames,
  unitWings,
} from './mockData'
import type {
  AccessHistoryItem,
  AdminPatientRow,
  AdmissionRecord,
  AgendaItem,
  AlertTone,
  Appointment,
  AuditLog,
  AuthView,
  BedRecord,
  ConsentItem,
  Exam,
  FinanceRecord,
  HomeCareVisit,
  MenuItem,
  NotificationItem,
  PatientProfile,
  PermissionMatrixRow,
  PrescriptionItem,
  ProfessionalRow,
  Profile,
  TelemedicineMessage,
  TimelineEvent,
  UnitRecord,
} from './mockData'

interface FeedbackMessage {
  tone: AlertTone
  message: string
}

interface ConfirmationDialog {
  title: string
  description: string
  confirmLabel: string
  onConfirm: () => void
}

interface DataSubjectRequest {
  id: string
  title: string
  description: string
  requestedAt: string
  status: string
  channel: string
}

type AgendaViewMode = 'Diaria' | 'Semanal' | 'Mensal'

interface AccessDirectoryUser {
  id: string
  name: string
  login: string
  email: string
  profileKey: Profile
  profileLabel: string
  unit: string
  status: string
  scope: string
}

interface AccessDirectoryMeta {
  login: string
  email: string
  status: string
}

interface PermissionAccessDraft {
  name: string
  login: string
  email: string
  unit: string
  status: string
}

interface MetricCardProps {
  label: string
  value: string
  detail: string
  tone?: 'neutral' | 'accent' | 'success' | 'warning'
}

interface SectionIntroProps {
  eyebrow: string
  title: string
  description: string
  actions?: ReactNode
  className?: string
}

interface PanelProps {
  children: ReactNode
  className?: string
}

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
})

const roleLogins: Record<Profile, string> = {
  patient: 'maria.oliveira',
  professional: 'dra.helena',
  admin: 'fernanda.nunes',
}

function formatMoney(value: number) {
  return currencyFormatter.format(value)
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('pt-BR')
}

function maskCpf(value: string) {
  const digits = value.replace(/\D/g, '')
  if (digits.length < 11) {
    return value
  }

  return `${digits.slice(0, 3)}.***.***-${digits.slice(-2)}`
}

function maskPhone(value: string) {
  const digits = value.replace(/\D/g, '')
  if (digits.length < 10) {
    return value
  }

  return `(${digits.slice(0, 2)}) *****-${digits.slice(-4)}`
}

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function toLoginHandle(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .join('.')
}

function parseIsoDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function startOfDay(date: Date) {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

function matchesRelativePeriod(itemDate: string, period: string) {
  if (period === 'Todos os períodos') {
    return true
  }

  const current = startOfDay(new Date())
  const target = startOfDay(parseIsoDate(itemDate))
  const diffDays = Math.floor((current.getTime() - target.getTime()) / 86_400_000)

  if (period === 'Últimos 30 dias') {
    return diffDays <= 30
  }

  if (period === 'Últimos 90 dias') {
    return diffDays <= 90
  }

  if (period === 'Ano atual') {
    return current.getFullYear() === target.getFullYear()
  }

  return true
}

function matchesAgendaWindow(itemDate: string, baseDate: string, viewMode: AgendaViewMode) {
  const target = startOfDay(parseIsoDate(itemDate))
  const base = startOfDay(parseIsoDate(baseDate))

  if (viewMode === 'Diaria') {
    return target.getTime() === base.getTime()
  }

  if (viewMode === 'Semanal') {
    const diffDays = Math.floor((target.getTime() - base.getTime()) / 86_400_000)
    return diffDays >= 0 && diffDays <= 6
  }

  return (
    target.getFullYear() === base.getFullYear() && target.getMonth() === base.getMonth()
  )
}

function matchesSearch(search: string, ...values: Array<string | number | undefined>) {
  if (!search) {
    return true
  }

  return values.some((value) => String(value ?? '').toLowerCase().includes(search))
}

function matchesUnitFilter(selectedUnit: string, rowUnit: string) {
  return selectedUnit === 'Todas as unidades' || selectedUnit === rowUnit
}

function statusTone(status: string) {
  const value = status.toLowerCase()

  if (
    value.includes('confirmado') ||
    value.includes('ativo') ||
    value.includes('estável') ||
    value.includes('operação') ||
    value.includes('sincronizado') ||
    value.includes('concluído') || value.includes('concluido') ||
    value.includes('sucesso')
  ) {
    return 'success'
  }

  if (
    value.includes('agendado') ||
    value.includes('pendente') ||
    value.includes('alerta') ||
    value.includes('reservado') ||
    value.includes('alta prevista')
  ) {
    return 'warning'
  }

  if (
    value.includes('cancelado') ||
    value.includes('crítico') ||
    value.includes('manutenção') ||
    value.includes('inativo')
  ) {
    return 'error'
  }

  if (
    value.includes('em atendimento') ||
    value.includes('ocupado') ||
    value.includes('internado') ||
    value.includes('auditado') ||
    value.includes('logs ativos')
  ) {
    return 'info'
  }

  return 'neutral'
}

function buildNowTimestamp() {
  const now = new Date()

  return {
    date: now.toLocaleDateString('pt-BR'),
    time: now.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    }),
  }
}

function MetricCard({ label, value, detail, tone = 'neutral' }: MetricCardProps) {
  return (
    <article className={`metric-card metric-card--${tone}`}>
      <span className="metric-card__label">{label}</span>
      <strong className="metric-card__value">{value}</strong>
      <span className="metric-card__detail">{detail}</span>
    </article>
  )
}

function StatusBadge({ status }: { status: string }) {
  const tone = statusTone(status)
  return <span className={`badge badge--${tone}`}>{status}</span>
}

function Panel({ children, className = '' }: PanelProps) {
  return <section className={['panel', className].filter(Boolean).join(' ')}>{children}</section>
}

function SectionIntro({ eyebrow, title, description, actions, className = '' }: SectionIntroProps) {
  return (
    <div className={['section-intro', className].filter(Boolean).join(' ')}>
      <div>
        <span className="section-intro__eyebrow">{eyebrow}</span>
        <h1 className="section-intro__title">{title}</h1>
        <p className="section-intro__description">{description}</p>
      </div>
      {actions ? <div className="section-intro__actions">{actions}</div> : null}
    </div>
  )
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  )
}

function App() {
  const [authView, setAuthView] = useState<AuthView>('login')
  const [sessionProfile, setSessionProfile] = useState<Profile | null>(null)
  const [currentView, setCurrentView] = useState('dashboard')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [feedback, setFeedback] = useState<FeedbackMessage | null>(null)
  const [dialog, setDialog] = useState<ConfirmationDialog | null>(null)
  const [globalSearch, setGlobalSearch] = useState('')
  const deferredSearch = useDeferredValue(globalSearch.trim().toLowerCase())
  const [unitFilter, setUnitFilter] = useState('Todas as unidades')
  const [quickMenuOpen, setQuickMenuOpen] = useState(false)
  const quickMenuRef = useRef<HTMLDivElement | null>(null)

  const [loginForm, setLoginForm] = useState({
    username: 'maria.oliveira@vidaplus.demo',
    password: '',
    profile: 'patient' as Profile,
    rememberDevice: true,
  })
  const [recoverForm, setRecoverForm] = useState({ identifier: '', contact: '' })
  const [registerForm, setRegisterForm] = useState({
    name: '',
    cpf: '',
    phone: '',
    email: '',
    consent: true,
  })

  const [patientProfile, setPatientProfile] = useState<PatientProfile>(initialPatientProfile)
  const [appointments, setAppointments] = useState<Appointment[]>(initialAppointments)
  const [exams, setExams] = useState<Exam[]>(initialExams)
  const [notifications, setNotifications] = useState<NotificationItem[]>(initialNotifications)
  const [consents, setConsents] = useState<ConsentItem[]>(initialConsents)
  const [dataSubjectRequests, setDataSubjectRequests] = useState<DataSubjectRequest[]>([])
  const [timeline, setTimeline] = useState<TimelineEvent[]>(initialTimeline)
  const [prescriptions, setPrescriptions] = useState<PrescriptionItem[]>(initialPrescriptions)
  const [appointmentDraft, setAppointmentDraft] = useState({
    specialty: specialties[0],
    unit: unitNames[0],
    professional: professionalDemoUser,
    date: '2026-07-01',
    time: '08:30',
    modality: 'Presencial',
  })
  const [examDraft, setExamDraft] = useState({
    type: examTypes[0],
    unit: unitNames[2],
    date: '2026-07-02',
    time: '07:00',
  })

  const [teleStage, setTeleStage] = useState<'waiting' | 'live' | 'finished'>('waiting')
  const [telePatientReady, setTelePatientReady] = useState(false)
  const [teleEvaluation, setTeleEvaluation] = useState(5)
  const [teleMessages, setTeleMessages] = useState<TelemedicineMessage[]>(initialTelemedicineMessages)
  const [teleClinicalSummary, setTeleClinicalSummary] = useState(
    'Paciente orientado sobre sinais de alerta e continuidade do acompanhamento clínico.',
  )
  const [telePrescriptionText, setTelePrescriptionText] = useState(
    'Hidratação, controle de sintomas e retorno em caso de piora clínica.',
  )

  const [agenda, setAgenda] = useState<AgendaItem[]>(initialAgenda)
  const [selectedProfessionalPatientId, setSelectedProfessionalPatientId] = useState(initialAdminPatients[0].id)
  const [clinicalNote, setClinicalNote] = useState({
    symptoms: 'Palpitações ocasionais e cansaço leve aos esforços.',
    diagnosis: 'Hipertensão controlada. Seguir monitoramento cardiológico.',
    conduct: 'Manter medicação habitual e reforçar a rotina de atividade leve.',
    observations: 'Paciente colaborativa, sem dor toracica no momento.',
    vitals: 'PA 12x8 | FC 76 bpm | SpO2 98%',
  })
  const [prescriptionDraft, setPrescriptionDraft] = useState({
    medicine: 'Rosuvastatina 10mg',
    dosage: '1 comprimido a noite por 60 dias',
    guidance: 'Retornar em 60 dias ou antes se houver piora clínica.',
  })
  const [examRequestDraft, setExamRequestDraft] = useState({
    type: 'Eletrocardiograma',
    priority: 'Alta',
    justification: 'Reavaliação cardiológica após queixa de palpitações.',
  })
  const [homeCareVisits] = useState<HomeCareVisit[]>(initialHomeCareVisits)

  const [adminPatients, setAdminPatients] = useState<AdminPatientRow[]>(initialAdminPatients)
  const [editingPatientId, setEditingPatientId] = useState<string | null>(null)
  const [adminProfessionals, setAdminProfessionals] = useState<ProfessionalRow[]>(initialProfessionals)
  const [editingProfessionalId, setEditingProfessionalId] = useState<string | null>(null)
  const [units, setUnits] = useState<UnitRecord[]>(initialUnits)
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null)
  const [admissions, setAdmissions] = useState<AdmissionRecord[]>(initialAdmissions)
  const [beds, setBeds] = useState<BedRecord[]>(initialBeds)
  const [supplies] = useState(initialSupplies)
  const [financeReports] = useState<FinanceRecord[]>(initialFinanceReports)
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(initialAuditLogs)
  const [accessHistory, setAccessHistory] = useState<AccessHistoryItem[]>(initialAccessHistory)
  const [permissions] = useState<PermissionMatrixRow[]>(initialPermissions)
  const [adminAccessAccount, setAdminAccessAccount] = useState({
    id: 'ADM-01',
    name: adminDemoUser,
    login: roleLogins.admin,
    email: 'fernanda.nunes@vidaplus.demo',
    unit: 'Administração central',
    status: 'Ativo',
  })
  const [accessDirectoryMeta, setAccessDirectoryMeta] = useState<Record<string, AccessDirectoryMeta>>({
    'USR-P001': { login: roleLogins.patient, email: 'maria.oliveira@vidaplus.demo', status: 'Ativo' },
    'USR-P002': { login: 'joao.santos', email: 'joao.santos@vidaplus.demo', status: 'Ativo' },
    'USR-P003': { login: 'ana.lima', email: 'ana.lima@vidaplus.demo', status: 'Ativo' },
    'USR-P004': { login: 'carlos.ferreira', email: 'carlos.ferreira@vidaplus.demo', status: 'Ativo' },
    'USR-PR-01': { login: roleLogins.professional, email: 'dra.helena@vidaplus.demo', status: 'Ativo' },
    'USR-PR-02': { login: 'dr.rafael', email: 'dr.rafael@vidaplus.demo', status: 'Ativo' },
    'USR-PR-03': { login: 'patricia.almeida', email: 'patricia.almeida@vidaplus.demo', status: 'Ativo' },
    'USR-PR-04': { login: 'bruno.rocha', email: 'bruno.rocha@vidaplus.demo', status: 'Ativo' },
    'USR-ADMIN-1': { login: roleLogins.admin, email: 'fernanda.nunes@vidaplus.demo', status: 'Ativo' },
  })
  const [userPermissionAssignments, setUserPermissionAssignments] = useState<Record<string, Record<string, string>>>({})
  const [selectedAuditLogId, setSelectedAuditLogId] = useState(initialAuditLogs[0]?.id ?? '')
  const [admissionDraft, setAdmissionDraft] = useState({
    patient: '',
    unit: unitNames[0],
    wing: unitWings[0],
    bed: '',
    reason: '',
    date: '2026-06-24',
  })
  const [admissionTransferId, setAdmissionTransferId] = useState<string | null>(null)
  const [admissionTransferDraft, setAdmissionTransferDraft] = useState({
    unit: unitNames[0],
    wing: unitWings[0],
    bed: '',
    date: '2026-06-24',
  })
  const [newPatientDraft, setNewPatientDraft] = useState({
    name: '',
    age: '40',
    unit: unitNames[0],
    careType: 'Ambulatorial',
  })
  const [newProfessionalDraft, setNewProfessionalDraft] = useState({
    name: '',
    role: 'Clínico Geral',
    unit: unitNames[1],
    shift: '08:00 - 17:00',
  })
  const [unitDraft, setUnitDraft] = useState({
    name: '',
    type: 'Hospital',
    city: 'Florianopolis/SC',
    occupancy: '70',
    status: 'Operação plena',
    specialties: 'Clínica Geral, Exames',
  })

  const [consultationStatusFilter, setConsultationStatusFilter] = useState('Todas')
  const [examStatusFilter, setExamStatusFilter] = useState('Todos')
  const [notificationFilter, setNotificationFilter] = useState('Todas')
  const [timelineFilter, setTimelineFilter] = useState('Todos')
  const [timelinePeriodFilter, setTimelinePeriodFilter] = useState('Todos os períodos')
  const [timelineProfessionalFilter, setTimelineProfessionalFilter] = useState(
    'Todos os profissionais',
  )
  const [agendaStatusFilter, setAgendaStatusFilter] = useState('Todos')
  const [agendaTypeFilter, setAgendaTypeFilter] = useState('Todos')
  const [agendaViewMode, setAgendaViewMode] = useState<AgendaViewMode>('Diaria')
  const [agendaDateFilter, setAgendaDateFilter] = useState(initialAgenda[0].date)
  const [auditModuleFilter, setAuditModuleFilter] = useState('Todos')
  const [auditProfileFilter, setAuditProfileFilter] = useState('Todos')
  const [auditDateFilter, setAuditDateFilter] = useState('Todas as datas')
  const [auditActionFilter, setAuditActionFilter] = useState('Todas as ações')
  const [auditUserFilter, setAuditUserFilter] = useState('')
  const [permissionProfileFilter, setPermissionProfileFilter] = useState('Todos')
  const [selectedPermissionUserId, setSelectedPermissionUserId] = useState('')
  const [permissionAccessDraft, setPermissionAccessDraft] = useState<PermissionAccessDraft>({
    name: '',
    login: '',
    email: '',
    unit: '',
    status: '',
  })
  const [permissionModuleDrafts, setPermissionModuleDrafts] = useState<Record<string, string>>({})
  const [supplyStatusFilter, setSupplyStatusFilter] = useState('Todos')

  useEffect(() => {
    if (!feedback) {
      return undefined
    }

    const timeoutId = window.setTimeout(() => {
      setFeedback(null)
    }, 3600)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [feedback])

  useEffect(() => {
    if (!quickMenuOpen) {
      return undefined
    }

    function handlePointerDown(event: PointerEvent) {
      if (!quickMenuRef.current?.contains(event.target as Node)) {
        setQuickMenuOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setQuickMenuOpen(false)
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [quickMenuOpen])

  const activeProfile = sessionProfile ?? loginForm.profile
  const activeMenu = profileMenus[activeProfile]
  const activeMeta = profileMeta[activeProfile]
  const isPatientSession = sessionProfile === 'patient'
  const isProfessionalSession = sessionProfile === 'professional'
  const isAdminSession = sessionProfile === 'admin'
  const quickMenuConfig: Record<Profile, { keys: string[]; title: string; description: string }> = {
    patient: {
      keys: ['profile', 'prescriptions', 'notifications', 'privacy'],
      title: 'Conta do paciente',
      description: 'Acessos de apoio, cadastro, notificações e privacidade.',
    },
    professional: {
      keys: ['prescriptions', 'examRequests', 'homecare', 'history'],
      title: 'Atalhos do profissional',
      description: 'Módulos clínicos complementares da rotina assistencial.',
    },
    admin: {
      keys: ['supplies', 'finance', 'indicators', 'security', 'permissions'],
      title: 'Atalhos administrativos',
      description: 'Módulos secundários e configurações de acesso.',
    },
  }
  const activeQuickMenuConfig = quickMenuConfig[activeProfile]
  const quickMenuItems = activeMenu.filter((item) => activeQuickMenuConfig.keys.includes(item.key))
  const visibleSidebarMenu = activeMenu.filter(
    (item) => !activeQuickMenuConfig.keys.includes(item.key),
  )
  const unreadNotifications = notifications.filter((item) => !item.read).length
  const unitOptions = units.map((item) => item.name)
  const timelineProfessionalOptions = [
    'Todos os profissionais',
    ...new Set(timeline.map((item) => item.professional)),
  ]
  const agendaDateOptions = [...new Set(agenda.map((item) => item.date))].sort()
  const auditDateOptions = ['Todas as datas', ...new Set(auditLogs.map((item) => item.date))]
  const auditProfileOptions = ['Todos', ...new Set(auditLogs.map((item) => item.profile))]
  const auditActionOptions = ['Todas as ações', ...new Set(auditLogs.map((item) => item.action))]
  const permissionAccessOptions = [
    ...new Set(permissions.flatMap((item) => [item.patient, item.professional, item.admin])),
  ]
  const permissionDirectoryUsers: AccessDirectoryUser[] = [
    ...adminPatients.map((item) => ({
      id: `USR-${item.id}`,
      name: item.name,
      login: accessDirectoryMeta[`USR-${item.id}`]?.login ?? toLoginHandle(item.name),
      email:
        accessDirectoryMeta[`USR-${item.id}`]?.email ??
        `${toLoginHandle(item.name)}@vidaplus.demo`,
      profileKey: 'patient' as const,
      profileLabel: profileMeta.patient.label,
      unit: item.unit,
      status: accessDirectoryMeta[`USR-${item.id}`]?.status ?? 'Ativo',
      scope: `${item.careType} com acesso ao próprio portal e consentimentos.`,
    })),
    ...adminProfessionals.map((item) => ({
      id: `USR-${item.id}`,
      name: item.name,
      login: accessDirectoryMeta[`USR-${item.id}`]?.login ?? toLoginHandle(item.name),
      email:
        accessDirectoryMeta[`USR-${item.id}`]?.email ??
        `${toLoginHandle(item.name)}@vidaplus.demo`,
      profileKey: 'professional' as const,
      profileLabel: profileMeta.professional.label,
      unit: item.unit,
      status: accessDirectoryMeta[`USR-${item.id}`]?.status ?? 'Ativo',
      scope: `${item.role} com escopo ${item.accessLevel.toLowerCase()}.`,
    })),
    {
      id: 'USR-ADMIN-1',
      name: adminAccessAccount.name,
      login: adminAccessAccount.login,
      email: adminAccessAccount.email,
      profileKey: 'admin',
      profileLabel: profileMeta.admin.label,
      unit: adminAccessAccount.unit,
      status: adminAccessAccount.status,
      scope: 'Governança institucional, auditoria e configurações sensíveis.',
    },
  ]
  const permissionProfileOptions = [
    'Todos',
    ...new Set(permissionDirectoryUsers.map((item) => item.profileLabel)),
  ]
  const upcomingAppointments = appointments.filter(
    (item) => item.status !== 'Cancelado' && item.status !== 'Concluído',
  )
  const pendingExams = exams.filter((item) => item.status !== 'Realizado').length
  const criticalSupplies = supplies.filter((item) => item.status === 'Crítico').length
  const availableBeds = beds.filter((item) => item.status === 'Disponível').length
  const occupiedBeds = beds.filter((item) => item.status === 'Ocupado').length
  const selectedProfessionalPatient =
    adminPatients.find((item) => item.id === selectedProfessionalPatientId) ?? adminPatients[0]
  const distinctPatients = Array.from(new Map(adminPatients.map((item) => [item.id, item])).values())
  const financeInView = financeReports.filter((item) => matchesUnitFilter(unitFilter, item.unit))
  const totalRevenue = financeInView.reduce((total, item) => total + item.revenue, 0)
  const totalExpenses = financeInView.reduce((total, item) => total + item.expenses, 0)
  const accessHistoryView = accessHistory.slice(0, 6)
  const patientAccessHistory = accessHistory.filter((item) => item.user === roleLogins.patient).slice(0, 3)
  const latestDataSubjectRequests = dataSubjectRequests.slice(0, 5)
  const teleAgendaItem = agenda.find((item) => item.type === 'Telemedicina') ?? agenda[0]
  const teleProfessionalPatient =
    adminPatients.find((item) => item.id === teleAgendaItem.patientId) ?? selectedProfessionalPatient
  const transferBedOptions = beds.filter(
    (item) =>
      item.status === 'Disponível' &&
      item.unit === admissionTransferDraft.unit &&
      item.wing === admissionTransferDraft.wing,
  )
  const nextTeleAppointment =
    appointments.find((item) => item.modality === 'Telemedicina' && item.status !== 'Cancelado') ??
    appointments[1]
  const workspaceContextTitle = isPatientSession
    ? 'Portal do paciente'
    : isProfessionalSession
      ? 'Jornada assistencial'
      : 'Operação institucional'
  const workspaceContextDescription = isPatientSession
    ? 'Acompanhe consultas, exames, prescrições e privacidade com navegação simples.'
    : isProfessionalSession
      ? 'Use agenda, prontuário, telemedicina e registros clínicos sem perder contexto.'
      : 'Gerencie pacientes, unidades, leitos, auditoria e acessos em um só ambiente.'
  const workspaceSearchPlaceholder = isPatientSession
    ? 'Pesquisar consultas, exames e prescrições...'
    : isProfessionalSession
      ? 'Pesquisar agenda, pacientes e prontuários...'
      : 'Pesquisar pacientes, leitos, unidades e logs...'
  const filteredAppointments = appointments.filter(
    (item) =>
      (consultationStatusFilter === 'Todas' || item.status === consultationStatusFilter) &&
      matchesSearch(
        deferredSearch,
        item.specialty,
        item.unit,
        item.professional,
        item.status,
        item.modality,
      ),
  )
  const filteredExams = exams.filter(
    (item) =>
      (examStatusFilter === 'Todos' || item.status === examStatusFilter) &&
      matchesSearch(deferredSearch, item.type, item.unit, item.status),
  )
  const filteredNotifications = notifications.filter(
    (item) =>
      (notificationFilter === 'Todas' ||
        (notificationFilter === 'Não lidas' && !item.read) ||
        (notificationFilter === 'Lidas' && item.read)) &&
      matchesSearch(deferredSearch, item.title, item.message),
  )
  const filteredTimeline = timeline.filter(
    (item) =>
      (timelineFilter === 'Todos' || item.category === timelineFilter) &&
      (timelineProfessionalFilter === 'Todos os profissionais' ||
        item.professional === timelineProfessionalFilter) &&
      matchesRelativePeriod(item.date, timelinePeriodFilter) &&
      matchesSearch(deferredSearch, item.title, item.professional, item.summary),
  )
  const filteredAgenda = agenda.filter(
    (item) =>
      (agendaStatusFilter === 'Todos' || item.status === agendaStatusFilter) &&
      (agendaTypeFilter === 'Todos' || item.type === agendaTypeFilter) &&
      matchesAgendaWindow(item.date, agendaDateFilter, agendaViewMode) &&
      matchesSearch(deferredSearch, item.patientName, item.reason, item.unit, item.type, item.alert),
  )
  const filteredAdminPatients = adminPatients.filter(
    (item) =>
      matchesUnitFilter(unitFilter, item.unit) &&
      matchesSearch(deferredSearch, item.name, item.status, item.unit, item.careType, item.nextStep),
  )
  const filteredProfessionals = adminProfessionals.filter(
    (item) =>
      matchesUnitFilter(unitFilter, item.unit) &&
      matchesSearch(deferredSearch, item.name, item.role, item.unit, item.shift, item.status),
  )
  const filteredUnits = units.filter(
    (item) =>
      matchesUnitFilter(unitFilter, item.name) &&
      matchesSearch(deferredSearch, item.name, item.type, item.city, item.status),
  )
  const filteredAdmissions = admissions.filter(
    (item) =>
      matchesUnitFilter(unitFilter, item.unit) &&
      matchesSearch(
        deferredSearch,
        item.patient,
        item.unit,
        item.wing,
        item.bed,
        item.reason,
        item.status,
      ),
  )
  const filteredBeds = beds.filter(
    (item) =>
      matchesUnitFilter(unitFilter, item.unit) &&
      matchesSearch(
        deferredSearch,
        item.unit,
        item.wing,
        item.room,
        item.bed,
        item.status,
        item.patient,
      ),
  )
  const filteredSupplies = supplies.filter(
    (item) =>
      (supplyStatusFilter === 'Todos' || item.status === supplyStatusFilter) &&
      matchesUnitFilter(unitFilter, item.unit) &&
      matchesSearch(deferredSearch, item.item, item.category, item.unit, item.status),
  )
  const filteredFinance = financeReports.filter(
    (item) =>
      matchesUnitFilter(unitFilter, item.unit) &&
      matchesSearch(deferredSearch, item.unit, item.outpatient, item.telemedicine),
  )
  const filteredAuditLogs = auditLogs.filter(
    (item) =>
      (auditModuleFilter === 'Todos' || item.module === auditModuleFilter) &&
      (auditProfileFilter === 'Todos' || item.profile === auditProfileFilter) &&
      (auditDateFilter === 'Todas as datas' || item.date === auditDateFilter) &&
      (auditActionFilter === 'Todas as ações' || item.action === auditActionFilter) &&
      matchesSearch(auditUserFilter.trim().toLowerCase(), item.user, item.action, item.profile) &&
      matchesSearch(
        deferredSearch,
        item.user,
        item.profile,
        item.action,
        item.module,
        item.ip,
        item.status,
      ),
  )
  const filteredPermissionUsers = permissionDirectoryUsers.filter(
    (item) =>
      (permissionProfileFilter === 'Todos' || item.profileLabel === permissionProfileFilter) &&
      matchesUnitFilter(unitFilter, item.unit) &&
      matchesSearch(
        deferredSearch,
        item.name,
        item.login,
        item.profileLabel,
        item.unit,
        item.status,
        item.scope,
      ),
  )
  const selectedPermissionUser =
    filteredPermissionUsers.find((item) => item.id === selectedPermissionUserId) ??
    filteredPermissionUsers[0] ??
    null
  const selectedPermissionRows = selectedPermissionUser
    ? permissions.map((item) => ({
        id: item.id,
        module: item.module,
        access:
          permissionModuleDrafts[item.id] ??
          userPermissionAssignments[selectedPermissionUser.id]?.[item.id] ??
          (selectedPermissionUser.profileKey === 'patient'
            ? item.patient
            : selectedPermissionUser.profileKey === 'professional'
              ? item.professional
              : item.admin),
        note: item.note,
      }))
    : []
  const permissionGrantedCount = selectedPermissionRows.filter((item) => item.access !== 'Sem acesso').length
  const selectedAuditLog =
    filteredAuditLogs.find((item) => item.id === selectedAuditLogId) ??
    filteredAuditLogs[0] ??
    auditLogs[0] ??
    null

  useEffect(() => {
    if (!selectedPermissionUser) {
      setPermissionAccessDraft((current) =>
        current.name || current.login || current.email || current.unit || current.status
          ? {
              name: '',
              login: '',
              email: '',
              unit: '',
              status: '',
            }
          : current,
      )
      setPermissionModuleDrafts((current) => (Object.keys(current).length ? {} : current))
      return
    }

    const nextAccessDraft = {
      name: selectedPermissionUser.name,
      login: selectedPermissionUser.login,
      email: selectedPermissionUser.email,
      unit: selectedPermissionUser.unit,
      status: selectedPermissionUser.status,
    }

    setPermissionAccessDraft((current) =>
      current.name === nextAccessDraft.name &&
      current.login === nextAccessDraft.login &&
      current.email === nextAccessDraft.email &&
      current.unit === nextAccessDraft.unit &&
      current.status === nextAccessDraft.status
        ? current
        : nextAccessDraft,
    )

    const nextDrafts = Object.fromEntries(
      permissions.map((item) => {
        const defaultAccess =
          selectedPermissionUser.profileKey === 'patient'
            ? item.patient
            : selectedPermissionUser.profileKey === 'professional'
              ? item.professional
              : item.admin

        return [
          item.id,
          userPermissionAssignments[selectedPermissionUser.id]?.[item.id] ?? defaultAccess,
        ]
      }),
    )

    setPermissionModuleDrafts((current) => {
      const currentKeys = Object.keys(current)
      const nextKeys = Object.keys(nextDrafts)
      const isSameSize = currentKeys.length === nextKeys.length
      const isSameValues =
        isSameSize && nextKeys.every((key) => current[key] === nextDrafts[key])

      return isSameValues ? current : nextDrafts
    })
  }, [
    permissions,
    selectedPermissionUser?.id,
    selectedPermissionUser?.name,
    selectedPermissionUser?.login,
    selectedPermissionUser?.email,
    selectedPermissionUser?.unit,
    selectedPermissionUser?.status,
    selectedPermissionUser?.profileKey,
    userPermissionAssignments,
  ])

  function showFeedback(tone: AlertTone, message: string) {
    setFeedback({ tone, message })
  }

  function sessionUserName(profile: Profile) {
    if (profile === 'patient') return patientProfile.name
    if (profile === 'professional') return professionalDemoUser
    return adminDemoUser
  }

  function appendAuditLog(profile: Profile, action: string, module: string, status = 'Sucesso') {
    const stamp = buildNowTimestamp()
    const entry: AuditLog = {
      id: `LOG-${Date.now()}`,
      date: stamp.date,
      time: stamp.time,
      user: roleLogins[profile],
      profile: profileMeta[profile].label,
      action,
      module,
      ip:
        profile === 'admin'
          ? '10.20.1.45'
          : profile === 'professional'
            ? '10.20.1.17'
            : '177.22.10.81',
      status,
    }

    setAuditLogs((current) => [entry, ...current].slice(0, 18))

    if (action.toLowerCase().includes('login')) {
      const accessItem: AccessHistoryItem = {
        id: `ACC-${Date.now()}`,
        user: roleLogins[profile],
        profile: profileMeta[profile].label,
        lastAccess: `${stamp.date} ${stamp.time}`,
        device:
          profile === 'patient'
            ? 'Smartphone Android'
            : profile === 'professional'
              ? 'Notebook clínico'
              : 'Desktop corporativo',
        risk: profile === 'patient' ? 'Médio' : 'Baixo',
      }

      setAccessHistory((current) => [accessItem, ...current].slice(0, 10))
    }
  }

  function openDialog(
    title: string,
    description: string,
    confirmLabel: string,
    onConfirm: () => void,
  ) {
    setDialog({ title, description, confirmLabel, onConfirm })
  }

  function navigate(nextView: string) {
    startTransition(() => {
      setCurrentView(nextView)
      setMobileMenuOpen(false)
      setQuickMenuOpen(false)
    })
  }

  function resetSession() {
    setSessionProfile(null)
    setAuthView('login')
    setCurrentView('dashboard')
    setMobileMenuOpen(false)
    setQuickMenuOpen(false)
    setGlobalSearch('')
    setUnitFilter('Todas as unidades')
    setLoginForm((current) => ({ ...current, password: '' }))
    showFeedback('info', 'Sessão encerrada. Para usar outro perfil, selecione-o novamente no login.')
  }

  function handleSavePermissionAccessProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!selectedPermissionUser) {
      showFeedback('warning', 'Selecione um usuário para editar o cadastro de acesso.')
      return
    }

    const nextName = permissionAccessDraft.name.trim()
    const nextLogin = permissionAccessDraft.login.trim().toLowerCase()
    const nextEmail = permissionAccessDraft.email.trim().toLowerCase()

    if (!nextName || !nextLogin || !nextEmail || !permissionAccessDraft.unit || !permissionAccessDraft.status) {
      showFeedback('error', 'Preencha nome, login, e-mail, unidade e status para salvar o cadastro.')
      return
    }

    if (selectedPermissionUser.profileKey === 'patient') {
      const entityId = selectedPermissionUser.id.replace('USR-', '')
      setAdminPatients((current) =>
        current.map((item) =>
          item.id === entityId
            ? {
                ...item,
                name: nextName,
                unit: permissionAccessDraft.unit,
              }
            : item,
        ),
      )
    } else if (selectedPermissionUser.profileKey === 'professional') {
      const entityId = selectedPermissionUser.id.replace('USR-', '')
      setAdminProfessionals((current) =>
        current.map((item) =>
          item.id === entityId
            ? {
                ...item,
                name: nextName,
                unit: permissionAccessDraft.unit,
              }
            : item,
        ),
      )
    } else {
      setAdminAccessAccount((current) => ({
        ...current,
        name: nextName,
        login: nextLogin,
        email: nextEmail,
        unit: permissionAccessDraft.unit,
        status: permissionAccessDraft.status,
      }))
    }

    setAccessDirectoryMeta((current) => ({
      ...current,
      [selectedPermissionUser.id]: {
        login: nextLogin,
        email: nextEmail,
        status: permissionAccessDraft.status,
      },
    }))

    showFeedback('success', `Cadastro de acesso de ${nextName} atualizado.`)
    appendAuditLog('admin', 'Edição de cadastro de usuário de acesso', 'Permissões', 'Auditado')
  }

  function handleSavePermissionAssignments() {
    if (!selectedPermissionUser) {
      showFeedback('warning', 'Selecione um usuário para salvar as permissões.')
      return
    }

    setUserPermissionAssignments((current) => ({
      ...current,
      [selectedPermissionUser.id]: permissionModuleDrafts,
    }))

    showFeedback('success', `Permissões por módulo atualizadas para ${selectedPermissionUser.name}.`)
    appendAuditLog('admin', 'Atualização de permissões por módulo', 'Permissões', 'Auditado')
  }

  function handleLoginSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!loginForm.username || !loginForm.password) {
      showFeedback('error', 'Preencha usuário e senha para continuar.')
      return
    }

    if (loginForm.password !== demoPassword) {
      showFeedback('error', 'Login invalido. Use a senha demo informada na tela.')
      appendAuditLog(loginForm.profile, 'Tentativa de login inválida', 'Autenticação', 'Bloqueado')
      return
    }

    startTransition(() => {
      setSessionProfile(loginForm.profile)
      setCurrentView(defaultViews[loginForm.profile])
      setAuthView('login')
    })

    showFeedback('success', `Acesso liberado para o perfil ${profileMeta[loginForm.profile].label}.`)
    appendAuditLog(loginForm.profile, 'Login realizado com sucesso', 'Autenticação')
  }

  function handleRecoverSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    showFeedback('success', 'Recuperação simulada enviada para o contato informado.')
    setAuthView('login')
  }

  function handleRegisterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    showFeedback('success', 'Pré-cadastro do paciente registrado para validação pela equipe VidaPlus.')
    appendAuditLog('patient', 'Pré-cadastro inicial de paciente', 'Cadastro Inicial')
    setAuthView('login')
  }

  function handleSavePatientProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    showFeedback('success', 'Dados cadastrais atualizados com sucesso.')
    appendAuditLog('patient', 'Atualização cadastral do paciente', 'Meu Cadastro')
  }

  function handleScheduleConsultation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const newAppointment: Appointment = {
      id: `CONS-${appointments.length + 401}`,
      specialty: appointmentDraft.specialty,
      unit: appointmentDraft.unit,
      professional: appointmentDraft.professional,
      date: appointmentDraft.date,
      time: appointmentDraft.time,
      status: 'Agendado',
      modality: appointmentDraft.modality,
      guidance:
        appointmentDraft.modality === 'Telemedicina'
          ? 'Entrar na sala virtual 10 minutos antes e testar câmera e áudio.'
          : 'Levar documento com foto e exames anteriores, se houver.',
    }

    setAppointments((current) => [newAppointment, ...current])
    setNotifications((current) => [
      {
        id: `NT-${Date.now()}`,
        title: 'Nova consulta agendada',
        message: `${newAppointment.specialty} em ${formatDate(newAppointment.date)} as ${newAppointment.time}.`,
        time: 'Agora',
        tone: 'success',
        read: false,
      },
      ...current,
    ])
    showFeedback('success', 'Consulta agendada e comprovante visual gerado.')
    appendAuditLog('patient', 'Agendamento de consulta', 'Consultas')
  }

  function handleCancelConsultation(appointmentId: string) {
    const appointment = appointments.find((item) => item.id === appointmentId)
    if (!appointment) return

    openDialog(
      'Cancelar consulta',
      `Deseja cancelar ${appointment.specialty} em ${formatDate(appointment.date)} as ${appointment.time}?`,
      'Confirmar cancelamento',
      () => {
        setAppointments((current) =>
          current.map((item) =>
            item.id === appointmentId ? { ...item, status: 'Cancelado' } : item,
          ),
        )
        setNotifications((current) => [
          {
            id: `NT-${Date.now()}`,
            title: 'Consulta cancelada',
            message: `${appointment.specialty} foi cancelada e a justificativa ficou registrada no protótipo.`,
            time: 'Agora',
            tone: 'warning',
            read: false,
          },
          ...current,
        ])
        showFeedback('warning', 'Consulta cancelada com justificativa simulada.')
        appendAuditLog('patient', 'Cancelamento de consulta', 'Consultas', 'Auditado')
      },
    )
  }

  function handleScheduleExam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const newExam: Exam = {
      id: `EX-${exams.length + 9003}`,
      type: examDraft.type,
      unit: examDraft.unit,
      date: examDraft.date,
      time: examDraft.time,
      status: 'Agendado',
      preparation: 'Confira o preparo detalhado e chegue com 15 minutos de antecedência.',
    }

    setExams((current) => [newExam, ...current])
    setNotifications((current) => [
      {
        id: `NT-${Date.now()}`,
        title: 'Exame agendado',
        message: `${newExam.type} confirmado para ${formatDate(newExam.date)} as ${newExam.time}.`,
        time: 'Agora',
        tone: 'success',
        read: false,
      },
      ...current,
    ])
    showFeedback('success', 'Exame agendado com orientações pré-exame exibidas.')
    appendAuditLog('patient', 'Agendamento de exame', 'Exames')
  }

  function handleCancelExam(examId: string) {
    const exam = exams.find((item) => item.id === examId)
    if (!exam) return

    openDialog(
      'Cancelar exame',
      `Deseja cancelar ${exam.type} marcado para ${formatDate(exam.date)} as ${exam.time}?`,
      'Cancelar exame',
      () => {
        setExams((current) =>
          current.map((item) => (item.id === examId ? { ...item, status: 'Cancelado' } : item)),
        )
        showFeedback('warning', 'Exame cancelado no fluxo demonstrativo.')
        appendAuditLog('patient', 'Cancelamento de exame', 'Exames', 'Auditado')
      },
    )
  }

  function toggleNotificationRead(notificationId: string) {
    setNotifications((current) =>
      current.map((item) =>
        item.id === notificationId ? { ...item, read: !item.read } : item,
      ),
    )
  }

  function markAllNotificationsRead() {
    setNotifications((current) => current.map((item) => ({ ...item, read: true })))
    showFeedback('info', 'Todas as notificações foram marcadas como lidas.')
  }

  function applyConsentToggle(consentId: string) {
    setConsents((current) =>
      current.map((item) =>
        item.id === consentId ? { ...item, granted: !item.granted } : item,
      ),
    )
    showFeedback('success', 'Preferencia de privacidade atualizada.')
    appendAuditLog('patient', 'Atualização de consentimento LGPD', 'Privacidade e LGPD')
  }

  function handleToggleConsent(consent: ConsentItem) {
    if (consent.critical && consent.granted) {
      openDialog(
        'Revogar consentimento sensível',
        'A revogação pode limitar o acesso ao histórico e ? continuidade assistencial entre unidades.',
        'Revogar agora',
        () => {
          applyConsentToggle(consent.id)
        },
      )
      return
    }

    applyConsentToggle(consent.id)
  }

  function registerDataSubjectRequest(
    title: string,
    description: string,
    status = 'Pendente',
  ) {
    const stamp = buildNowTimestamp()
    const request: DataSubjectRequest = {
      id: `DSR-${Date.now()}`,
      title,
      description,
      requestedAt: `${stamp.date} ${stamp.time}`,
      status,
      channel: 'Portal do paciente',
    }

    setDataSubjectRequests((current) => [request, ...current].slice(0, 10))
  }

  function handleDownloadPersonalData() {
    const stamp = buildNowTimestamp()
    const payload = {
      generatedAt: `${stamp.date} ${stamp.time}`,
      controller: 'VidaPlus Serviços Integrados de Saúde',
      dataSubject: patientProfile,
      consents,
      appointments,
      exams,
      prescriptions,
      notifications,
      timeline,
      accountAccesses: patientAccessHistory,
      lgpdRequests: dataSubjectRequests,
      note: 'Pacote demonstrativo gerado pelo protótipo front-end do SGHSS VidaPlus.',
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8',
    })
    const objectUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = `vidaplus-dados-${slugify(patientProfile.name)}-${new Date()
      .toISOString()
      .slice(0, 10)}.json`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(objectUrl)

    showFeedback('success', 'Pacote demonstrativo de dados preparado para download.')
    appendAuditLog('patient', 'Exportacao dos dados pessoais', 'Privacidade e LGPD', 'Auditado')
  }

  function handleOpenCorrectionFlow() {
    navigate('profile')
    showFeedback('info', 'Fluxo de correção cadastral aberto para revisão dos dados do titular.')
    appendAuditLog('patient', 'Acesso ao fluxo de correção cadastral', 'Privacidade e LGPD', 'Auditado')
  }

  function handleRequestPortability() {
    registerDataSubjectRequest(
      'Solicitação de portabilidade',
      'Pedido de envio estruturado dos dados pessoais e clínicos ao titular ou a outro prestador indicado.',
    )
    showFeedback('success', 'Solicitação de portabilidade registrada para tratamento.')
    appendAuditLog('patient', 'Solicitação de portabilidade de dados', 'Privacidade e LGPD', 'Auditado')
  }

  function handleRequestDeletion() {
    openDialog(
      'Solicitar exclusão ou anonimização',
      'Em saúde, o pedido pode depender de obrigações legais, regulatórias e assistenciais. O portal registrará a solicitação para análise formal.',
      'Registrar solicitação',
      () => {
        registerDataSubjectRequest(
          'Solicitação de exclusão ou anonimização',
          'Pedido do titular para exclusão dos dados tratados com base em consentimento ou anonimização quando houver retenção obrigatória.',
        )
        showFeedback('warning', 'Solicitação registrada e encaminhada para análise do encarregado.')
        appendAuditLog(
          'patient',
          'Solicitação de exclusão ou anonimização de dados',
          'Privacidade e LGPD',
          'Auditado',
        )
      },
    )
  }

  function handlePatientCheckInTelemedicine() {
    setTelePatientReady(true)
    setTeleStage('waiting')
    setTeleMessages((current) => [
      {
        id: `MSG-${Date.now()}`,
        author: 'Sistema',
        time: buildNowTimestamp().time,
        message: 'Check-in confirmado. O paciente aguarda o profissional na sala virtual.',
      },
      ...current,
    ])
    showFeedback('info', 'Paciente posicionado na sala de espera virtual.')
    appendAuditLog('patient', 'Entrada na sala de espera virtual', 'Telemedicina')
  }

  function handleStartTelemedicine() {
    if (!telePatientReady) {
      showFeedback('warning', 'Aguardando o paciente confirmar presença na sala virtual.')
      return
    }

    setTeleStage('live')
    setAgenda((current) =>
      current.map((item) =>
        item.type === 'Telemedicina' ? { ...item, status: 'Em atendimento' } : item,
      ),
    )
    setAppointments((current) =>
      current.map((item) =>
        item.modality === 'Telemedicina' ? { ...item, status: 'Em atendimento' } : item,
      ),
    )
    setTeleMessages((current) => [
      {
        id: `MSG-${Date.now()}`,
        author: 'Sistema',
        time: buildNowTimestamp().time,
        message: 'Atendimento online iniciado com canal seguro e painel clínico liberado.',
      },
      ...current,
    ])
    showFeedback('success', 'Atendimento por telemedicina iniciado.')
    appendAuditLog('professional', 'Início de atendimento por telemedicina', 'Telemedicina')
  }

  function handleFinishTelemedicine() {
    setTeleStage('finished')
    setAgenda((current) =>
      current.map((item) =>
        item.type === 'Telemedicina' ? { ...item, status: 'Concluído' } : item,
      ),
    )
    setAppointments((current) =>
      current.map((item) =>
        item.modality === 'Telemedicina' ? { ...item, status: 'Concluído' } : item,
      ),
    )
    setTimeline((current) => [
      {
        id: `TL-${Date.now()}`,
        date: '2026-06-26',
        title: 'Teleconsulta concluída',
        category: 'Telemedicina',
        professional: professionalDemoUser,
        summary: 'Atendimento online registrado com resumo clínico e orientações finais.',
      },
      ...current,
    ])
    setTeleMessages((current) => [
      {
        id: `MSG-${Date.now()}`,
        author: 'Sistema',
        time: buildNowTimestamp().time,
        message: 'Teleconsulta encerrada. Resumo e avaliação ficaram disponíveis no protótipo.',
      },
      ...current,
    ])
    showFeedback('success', 'Teleconsulta encerrada com resumo e avaliação disponíveis.')
    appendAuditLog('professional', 'Encerramento de teleconsulta', 'Telemedicina')
  }

  function handleSaveTelemedicineSummary() {
    setClinicalNote((current) => ({
      ...current,
      conduct: teleClinicalSummary,
      observations: 'Registro atualizado durante a videochamada.',
    }))
    setTeleMessages((current) => [
      {
        id: `MSG-${Date.now()}`,
        author: professionalDemoUser,
        time: buildNowTimestamp().time,
        message: 'Resumo clínico atualizado durante o atendimento online.',
      },
      ...current,
    ])
    showFeedback('success', 'Resumo clínico da telemedicina atualizado.')
    appendAuditLog('professional', 'Registro clínico durante telemedicina', 'Telemedicina', 'Auditado')
  }

  function handleIssueTelemedicinePrescription() {
    const guidance = telePrescriptionText.trim()
    if (!guidance) {
      showFeedback('error', 'Informe a orientação principal antes de emitir a prescrição online.')
      return
    }

    const newPrescription: PrescriptionItem = {
      id: `RX-${Date.now()}`,
      date: '2026-06-25',
      professional: professionalDemoUser,
      specialty: 'Telemedicina',
      items: ['Prescrição emitida durante atendimento remoto', guidance],
      validUntil: '2026-07-25',
      status: 'Ativa',
    }

    setPrescriptions((current) => [newPrescription, ...current])
    setTeleMessages((current) => [
      {
        id: `MSG-${Date.now()}`,
        author: professionalDemoUser,
        time: buildNowTimestamp().time,
        message: 'Prescrição online simulada emitida e vinculada ao prontuário.',
      },
      ...current,
    ])
    showFeedback('success', 'Prescrição online simulada emitida.')
    appendAuditLog('professional', 'Prescrição online em telemedicina', 'Telemedicina', 'Auditado')
  }

  function handleSaveClinicalNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    showFeedback('success', 'Prontuário atualizado com sintomas, conduta e sinais vitais.')
    appendAuditLog('professional', 'Atualização de prontuário', 'Prontuários')
  }

  function handleIssuePrescription(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const newPrescription: PrescriptionItem = {
      id: `RX-${Date.now()}`,
      date: '2026-06-25',
      professional: professionalDemoUser,
      specialty: 'Cardiologia',
      items: [
        `${prescriptionDraft.medicine} - ${prescriptionDraft.dosage}`,
        prescriptionDraft.guidance,
      ],
      validUntil: '2026-08-25',
      status: 'Ativa',
    }

    setPrescriptions((current) => [newPrescription, ...current])
    showFeedback('success', 'Prescrição digital simulada emitida.')
    appendAuditLog('professional', 'Emissão de prescrição digital', 'Prescrições')
  }

  function handleRequestExam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (selectedProfessionalPatient.id === patientProfile.id) {
      setExams((current) => [
        {
          id: `EX-${Date.now()}`,
          type: examRequestDraft.type,
          unit: 'Laboratório VidaPlus Diagnósticos',
          date: '2026-07-03',
          time: '09:20',
          status: 'Agendado',
          preparation: `Prioridade ${examRequestDraft.priority}. ${examRequestDraft.justification}`,
        },
        ...current,
      ])
    }

    showFeedback('success', 'Solicitação de exame registrada no fluxo do profissional.')
    appendAuditLog('professional', 'Solicitação de exame', 'Solicitação de Exames')
  }

  function handleAdmissionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!admissionDraft.patient || !admissionDraft.bed || !admissionDraft.reason) {
      showFeedback('error', 'Preencha paciente, leito e motivo da internação.')
      return
    }

    const availableBed = beds.find(
      (item) => item.id === admissionDraft.bed && item.status === 'Disponível',
    )

    if (!availableBed) {
      showFeedback('error', 'Selecione um leito disponível para concluir a internação.')
      return
    }

    const selectedPatient = adminPatients.find((item) => item.id === admissionDraft.patient)

    if (!selectedPatient) {
      showFeedback('error', 'Paciente não localizado na base demonstrativa.')
      return
    }

    const newAdmission: AdmissionRecord = {
      id: `INT-${Date.now()}`,
      patient: selectedPatient.name,
      unit: admissionDraft.unit,
      wing: admissionDraft.wing,
      bed: availableBed.room,
      admissionDate: admissionDraft.date,
      reason: admissionDraft.reason,
      status: 'Internado',
      physician: professionalDemoUser,
    }

    setAdmissions((current) => [newAdmission, ...current])
    setBeds((current) =>
      current.map((item) =>
        item.id === admissionDraft.bed
          ? { ...item, status: 'Ocupado', patient: selectedPatient.name, cleaningEta: '--' }
          : item,
      ),
    )
    setAdminPatients((current) =>
      current.map((item) =>
        item.id === selectedPatient.id
          ? { ...item, status: 'Internado', nextStep: `Leito ${availableBed.room} alocado` }
          : item,
      ),
    )
    showFeedback('success', 'Internação registrada e status do leito atualizado.')
    appendAuditLog('admin', 'Nova internação registrada', 'Internações')
  }

  function handleCreateAdminPatient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (editingPatientId) {
      setAdminPatients((current) =>
        current.map((item) =>
          item.id === editingPatientId
            ? {
                ...item,
                name: newPatientDraft.name,
                age: Number(newPatientDraft.age),
                unit: newPatientDraft.unit,
                careType: newPatientDraft.careType,
              }
            : item,
        ),
      )
      setEditingPatientId(null)
      setNewPatientDraft({
        name: '',
        age: '40',
        unit: unitOptions[0] ?? unitNames[0],
        careType: 'Ambulatorial',
      })
      showFeedback('success', 'Cadastro do paciente atualizado no módulo administrativo.')
      appendAuditLog('admin', 'Edição de paciente', 'Pacientes', 'Auditado')
      return
    }

    const newPatient: AdminPatientRow = {
      id: `P${adminPatients.length + 1}`.padStart(4, '0'),
      name: newPatientDraft.name,
      age: Number(newPatientDraft.age),
      status: 'Ativo',
      unit: newPatientDraft.unit,
      contact: '47990000000',
      insurance: 'VidaPlus Essencial',
      careType: newPatientDraft.careType,
      alerts: ['Cadastro inicial'],
      lastVisit: 'Ainda sem atendimento',
      nextStep: 'Aguardando triagem inicial',
    }

    setAdminPatients((current) => [newPatient, ...current])
    setNewPatientDraft({
      name: '',
      age: '40',
      unit: unitOptions[0] ?? unitNames[0],
      careType: 'Ambulatorial',
    })
    showFeedback('success', 'Paciente adicionado ao cadastro administrativo.')
    appendAuditLog('admin', 'Cadastro de novo paciente', 'Pacientes')
  }

  function handleCreateProfessional(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (editingProfessionalId) {
      setAdminProfessionals((current) =>
        current.map((item) =>
          item.id === editingProfessionalId
            ? {
                ...item,
                name: newProfessionalDraft.name,
                role: newProfessionalDraft.role,
                unit: newProfessionalDraft.unit,
                shift: newProfessionalDraft.shift,
              }
            : item,
        ),
      )
      setEditingProfessionalId(null)
      setNewProfessionalDraft({
        name: '',
        role: 'Clínico Geral',
        unit: unitOptions[1] ?? unitOptions[0] ?? unitNames[1],
        shift: '08:00 - 17:00',
      })
      showFeedback('success', 'Cadastro do profissional atualizado com sucesso.')
      appendAuditLog('admin', 'Edição de profissional', 'Profissionais', 'Auditado')
      return
    }

    const newProfessional: ProfessionalRow = {
      id: `PR-${adminProfessionals.length + 1}`.padStart(5, '0'),
      name: newProfessionalDraft.name,
      role: newProfessionalDraft.role,
      unit: newProfessionalDraft.unit,
      shift: newProfessionalDraft.shift,
      status: 'Ativo',
      accessLevel: 'Aguardando configuração',
    }

    setAdminProfessionals((current) => [newProfessional, ...current])
    setNewProfessionalDraft({
      name: '',
      role: 'Clínico Geral',
      unit: unitOptions[1] ?? unitOptions[0] ?? unitNames[1],
      shift: '08:00 - 17:00',
    })
    showFeedback('success', 'Profissional cadastrado no protótipo.')
    appendAuditLog('admin', 'Cadastro de novo profissional', 'Profissionais')
  }

  function handleEditPatient(patient: AdminPatientRow) {
    setEditingPatientId(patient.id)
    setNewPatientDraft({
      name: patient.name,
      age: `${patient.age}`,
      unit: patient.unit,
      careType: patient.careType,
    })
    showFeedback('info', `Formulário preenchido para editar ${patient.name}.`)
  }

  function handleEditProfessional(professional: ProfessionalRow) {
    setEditingProfessionalId(professional.id)
    setNewProfessionalDraft({
      name: professional.name,
      role: professional.role,
      unit: professional.unit,
      shift: professional.shift,
    })
    showFeedback('info', `Formulário preenchido para editar ${professional.name}.`)
  }

  function handleCreateUnit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const specialtiesList = unitDraft.specialties
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)

    if (editingUnitId) {
      setUnits((current) =>
        current.map((item) =>
          item.id === editingUnitId
            ? {
                ...item,
                name: unitDraft.name,
                type: unitDraft.type,
                city: unitDraft.city,
                occupancy: Number(unitDraft.occupancy),
                status: unitDraft.status,
                specialties: specialtiesList,
              }
            : item,
        ),
      )
      setEditingUnitId(null)
      setUnitDraft({
        name: '',
        type: 'Hospital',
        city: 'Florianopolis/SC',
        occupancy: '70',
        status: 'Operação plena',
        specialties: 'Clínica Geral, Exames',
      })
      showFeedback('success', 'Unidade atualizada no módulo administrativo.')
      appendAuditLog('admin', 'Edição de unidade', 'Unidades', 'Auditado')
      return
    }

    const newUnit: UnitRecord = {
      id: `UN-${units.length + 1}`,
      name: unitDraft.name,
      type: unitDraft.type,
      city: unitDraft.city,
      occupancy: Number(unitDraft.occupancy),
      status: unitDraft.status,
      specialties: specialtiesList,
    }

    setUnits((current) => [newUnit, ...current])
    setUnitDraft({
      name: '',
      type: 'Hospital',
      city: 'Florianopolis/SC',
      occupancy: '70',
      status: 'Operação plena',
      specialties: 'Clínica Geral, Exames',
    })
    showFeedback('success', 'Nova unidade adicionada ao cadastro institucional.')
    appendAuditLog('admin', 'Cadastro de unidade', 'Unidades')
  }

  function handleEditUnit(unit: UnitRecord) {
    setEditingUnitId(unit.id)
    setUnitDraft({
      name: unit.name,
      type: unit.type,
      city: unit.city,
      occupancy: `${unit.occupancy}`,
      status: unit.status,
      specialties: unit.specialties.join(', '),
    })
    showFeedback('info', `Formulário preenchido para editar ${unit.name}.`)
  }

  function handleToggleUnitLifecycle(unit: UnitRecord) {
    const nextStatus = unit.status === 'Inativa' ? 'Operação plena' : 'Inativa'
    openDialog(
      `${nextStatus === 'Inativa' ? 'Inativar' : 'Reativar'} unidade`,
      `Confirma a alteração da unidade ${unit.name}?`,
      nextStatus === 'Inativa' ? 'Inativar' : 'Reativar',
      () => {
        setUnits((current) =>
          current.map((item) =>
            item.id === unit.id ? { ...item, status: nextStatus } : item,
          ),
        )
        showFeedback('warning', `${unit.name} agora esta com status ${nextStatus}.`)
        appendAuditLog('admin', 'Alteração de status de unidade', 'Unidades', 'Auditado')
      },
    )
  }

  function handleTogglePatientLifecycle(patient: AdminPatientRow) {
    const nextStatus = patient.status === 'Inativo' ? 'Ativo' : 'Inativo'
    openDialog(
      `${nextStatus === 'Inativo' ? 'Inativar' : 'Reativar'} cadastro`,
      `Confirma a alteração do cadastro de ${patient.name}?`,
      nextStatus === 'Inativo' ? 'Inativar' : 'Reativar',
      () => {
        setAdminPatients((current) =>
          current.map((item) =>
            item.id === patient.id ? { ...item, status: nextStatus } : item,
          ),
        )
        showFeedback('warning', `Cadastro de ${patient.name} marcado como ${nextStatus}.`)
        appendAuditLog('admin', 'Alteração de status de paciente', 'Pacientes', 'Auditado')
      },
    )
  }

  function handleToggleProfessionalLifecycle(professional: ProfessionalRow) {
    const nextStatus = professional.status === 'Inativo' ? 'Ativo' : 'Inativo'
    openDialog(
      `${nextStatus === 'Inativo' ? 'Inativar' : 'Reativar'} profissional`,
      `Confirma a alteração do cadastro de ${professional.name}?`,
      nextStatus === 'Inativo' ? 'Inativar' : 'Reativar',
      () => {
        setAdminProfessionals((current) =>
          current.map((item) =>
            item.id === professional.id ? { ...item, status: nextStatus } : item,
          ),
        )
        showFeedback('warning', `${professional.name} agora esta com status ${nextStatus}.`)
        appendAuditLog('admin', 'Alteração de status de profissional', 'Profissionais', 'Auditado')
      },
    )
  }

  function handlePrepareAdmissionTransfer(admission: AdmissionRecord) {
    const suggestedBed =
      beds.find(
        (item) =>
          item.status === 'Disponível' &&
          item.unit === admission.unit &&
          item.wing === admission.wing,
      ) ?? beds.find((item) => item.status === 'Disponível')

    setAdmissionTransferId(admission.id)
    setAdmissionTransferDraft({
      unit: suggestedBed?.unit ?? admission.unit,
      wing: suggestedBed?.wing ?? admission.wing,
      bed: suggestedBed?.id ?? '',
      date: '2026-06-24',
    })
    showFeedback('info', `Transferencia preparada para ${admission.patient}.`)
  }

  function handleTransferAdmission(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!admissionTransferId || !admissionTransferDraft.bed) {
      showFeedback('error', 'Selecione a internação e o novo leito para concluir a transferência.')
      return
    }

    const admission = admissions.find((item) => item.id === admissionTransferId)
    const nextBed = beds.find(
      (item) => item.id === admissionTransferDraft.bed && item.status === 'Disponível',
    )

    if (!admission || !nextBed) {
      showFeedback('error', 'Não foi possível concluir a transferência com os dados atuais.')
      return
    }

    setAdmissions((current) =>
      current.map((item) =>
        item.id === admissionTransferId
          ? {
              ...item,
              unit: admissionTransferDraft.unit,
              wing: admissionTransferDraft.wing,
              bed: nextBed.room,
              status: 'Transferido',
            }
          : item,
      ),
    )
    setBeds((current) =>
      current.map((item) => {
        if (item.room === admission.bed && item.patient === admission.patient) {
          return {
            ...item,
            status: 'Higienização',
            patient: '--',
            cleaningEta: '40 min',
          }
        }

        if (item.id === nextBed.id) {
          return {
            ...item,
            status: 'Ocupado',
            patient: admission.patient,
            cleaningEta: '--',
          }
        }

        return item
      }),
    )
    setAdminPatients((current) =>
      current.map((item) =>
        item.name === admission.patient
          ? {
              ...item,
              unit: admissionTransferDraft.unit,
              status: 'Internado',
              nextStep: `Transferido para ${nextBed.room}`,
            }
          : item,
      ),
    )
    setAdmissionTransferId(null)
    setAdmissionTransferDraft({
      unit: unitOptions[0] ?? unitNames[0],
      wing: unitWings[0],
      bed: '',
      date: '2026-06-24',
    })
    showFeedback('success', 'Transferência interna registrada com atualização do leito.')
    appendAuditLog('admin', 'Transferência interna de paciente', 'Internações', 'Auditado')
  }

  function handleMarkDischargeForecast(admission: AdmissionRecord) {
    setAdmissions((current) =>
      current.map((item) =>
        item.id === admission.id ? { ...item, status: 'Alta prevista' } : item,
      ),
    )
    setAdminPatients((current) =>
      current.map((item) =>
        item.name === admission.patient
          ? { ...item, nextStep: 'Alta prevista e orientação de continuidade' }
          : item,
      ),
    )
    showFeedback('info', `Alta prevista registrada para ${admission.patient}.`)
    appendAuditLog('admin', 'Registro de alta prevista', 'Internações', 'Auditado')
  }

  function handleDischargeAdmission(admission: AdmissionRecord) {
    openDialog(
      'Concluir alta',
      `Deseja finalizar a internação de ${admission.patient} e liberar o leito ${admission.bed}?`,
      'Dar alta',
      () => {
        setAdmissions((current) =>
          current.map((item) =>
            item.id === admission.id ? { ...item, status: 'Alta médica' } : item,
          ),
        )
        setBeds((current) =>
          current.map((item) =>
            item.room === admission.bed && item.patient === admission.patient
              ? {
                  ...item,
                  status: 'Higienização',
                  patient: '--',
                  cleaningEta: '35 min',
                }
              : item,
          ),
        )
        setAdminPatients((current) =>
          current.map((item) =>
            item.name === admission.patient
              ? {
                  ...item,
                  status: 'Ativo',
                  nextStep: 'Acompanhamento pós-alta e retorno ambulatorial',
                }
              : item,
          ),
        )
        showFeedback('success', 'Alta concluída e leito encaminhado para higienização.')
        appendAuditLog('admin', 'Alta hospitalar registrada', 'Internações', 'Auditado')
      },
    )
  }

  function renderAuthContent() {
    if (authView === 'recover') {
      return (
        <div className="auth-form-stack">
          <SectionIntro
            eyebrow="Recuperação"
            title="Recuperar acesso"
            description="Fluxo demonstrativo por e-mail ou CPF, sem autenticação real."
          />
          <form className="form-grid auth-recover-form" onSubmit={handleRecoverSubmit} autoComplete="on">
            <label className="form-field form-field--full">
              <span>CPF ou e-mail</span>
              <input
                name="identifier"
                autoComplete="username"
                placeholder="Informe o CPF ou e-mail cadastrado"
                value={recoverForm.identifier}
                onChange={(event) =>
                  setRecoverForm((current) => ({ ...current, identifier: event.target.value }))
                }
                required
              />
            </label>
            <label className="form-field form-field--full">
              <span>Contato para retorno</span>
              <input
                name="recoveryContact"
                autoComplete="email"
                placeholder="E-mail ou telefone para retorno"
                value={recoverForm.contact}
                onChange={(event) =>
                  setRecoverForm((current) => ({ ...current, contact: event.target.value }))
                }
                required
              />
            </label>
            <div className="auth-recover-note">
              <p>Enviaremos orientações simuladas para o contato informado neste protótipo.</p>
            </div>
            <div className="auth-recover-actions">
              <button className="button button--primary" type="submit">
                Enviar instrucoes simuladas
              </button>
            </div>
            <button className="text-link auth-inline-link auth-recover-back" type="button" onClick={() => setAuthView('login')}>
              Voltar ao login
            </button>
          </form>
        </div>
      )
    }

    if (authView === 'register') {
      return (
        <div className="auth-form-stack">
          <SectionIntro
            eyebrow="Cadastro inicial"
            title="Novo paciente VidaPlus"
            description="Pré-cadastro com dados básicos, contato e aceite da LGPD."
          />
          <form className="form-grid auth-register-form" onSubmit={handleRegisterSubmit} autoComplete="on">
            <label className="form-field form-field--full">
              <span>Nome completo</span>
              <input
                name="fullName"
                autoComplete="name"
                value={registerForm.name}
                onChange={(event) =>
                  setRegisterForm((current) => ({ ...current, name: event.target.value }))
                }
                required
              />
            </label>
            <label className="form-field">
              <span>CPF</span>
              <input
                name="cpf"
                autoComplete="off"
                inputMode="numeric"
                placeholder="000.000.000-00"
                value={registerForm.cpf}
                onChange={(event) =>
                  setRegisterForm((current) => ({ ...current, cpf: event.target.value }))
                }
                required
              />
            </label>
            <label className="form-field">
              <span>Telefone</span>
              <input
                name="phone"
                autoComplete="tel"
                inputMode="tel"
                placeholder="(00) 00000-0000"
                value={registerForm.phone}
                onChange={(event) =>
                  setRegisterForm((current) => ({ ...current, phone: event.target.value }))
                }
                required
              />
            </label>
            <label className="form-field form-field--full">
              <span>E-mail</span>
              <input
                type="email"
                name="email"
                autoComplete="email"
                placeholder="voce@exemplo.com"
                value={registerForm.email}
                onChange={(event) =>
                  setRegisterForm((current) => ({ ...current, email: event.target.value }))
                }
                required
              />
            </label>
            <div className="auth-register-consent">
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={registerForm.consent}
                  onChange={(event) =>
                    setRegisterForm((current) => ({ ...current, consent: event.target.checked }))
                  }
                />
                <span>Aceito o tratamento de dados para fins assistenciais e contato.</span>
              </label>
              <p className="auth-register-caption">
                Os dados informados serão usados apenas no pré-cadastro e no retorno inicial da equipe.
              </p>
            </div>
            <div className="auth-register-actions">
              <button className="button button--primary" type="submit">
                Confirmar pré-cadastro
              </button>
            </div>
            <button className="text-link auth-inline-link auth-register-back" type="button" onClick={() => setAuthView('login')}>
              Voltar ao login
            </button>
          </form>
        </div>
      )
    }

    if (authView === 'privacy') {
      return (
        <div className="auth-form-stack">
          <SectionIntro
            eyebrow="Política de privacidade"
            title="Tratamento de dados pessoais"
            description="Resumo visual da política da VidaPlus, com foco em clareza e transparência."
          />
          <Panel className="panel--accent">
            <ul className="bullet-list">
              <li>Dados clínicos são restritos ao contexto assistencial e ? auditoria autorizada.</li>
              <li>CPF e telefone aparecem mascarados fora de formulários de edição.</li>
              <li>Logs simulados registram login, alteração cadastral, prontuário e permissões.</li>
              <li>O portal permite exportação de dados e abertura de solicitações do titular.</li>
              <li>Existe indicação visual de backup, disponibilidade e trilha de rastreabilidade.</li>
            </ul>
          </Panel>
          <div className="button-row">
            <button className="button button--ghost" type="button" onClick={() => setAuthView('login')}>
              Voltar ao login
            </button>
          </div>
        </div>
      )
    }

    if (authView === 'lgpd') {
      return (
        <div className="auth-form-stack">
          <SectionIntro
            eyebrow="Consentimento LGPD"
            title="Aviso de uso de dados"
            description="Tela demonstrativa do aceite inicial de dados pessoais e sensíveis."
          />
          <Panel>
            <ul className="bullet-list">
              <li>Uso de dados para consultas, exames, internações, telemedicina e continuidade assistencial.</li>
              <li>Compartilhamento interno apenas entre unidades autorizadas da VidaPlus.</li>
              <li>Direitos do titular ficam disponíveis na área Privacidade e LGPD após o acesso.</li>
              <li>Opção de revogação posterior em Privacidade e LGPD.</li>
            </ul>
          </Panel>
          <div className="button-row">
            <button className="button button--primary" type="button" onClick={() => setAuthView('login')}>
              Entendi e voltar ao login
            </button>
          </div>
        </div>
      )
    }

    return (
      <div className="auth-form-stack">
        <div className="auth-login-header">
          <span className="auth-login-kicker">Acesso SGHSS VidaPlus</span>
          <h1 className="auth-login-title">Entrar</h1>
          <p className="auth-login-copy">
            Use o ambiente de demonstração e escolha o perfil com o qual deseja navegar.
          </p>
        </div>
        <form className="form-grid auth-login-form" onSubmit={handleLoginSubmit}>
          <label className="form-field form-field--full">
            <span>E-mail, CPF ou usuário</span>
            <input
              value={loginForm.username}
              onChange={(event) =>
                setLoginForm((current) => ({ ...current, username: event.target.value }))
              }
              required
            />
          </label>
          <label className="form-field form-field--full">
            <span>Senha</span>
            <input
              type="password"
              value={loginForm.password}
              onChange={(event) =>
                setLoginForm((current) => ({ ...current, password: event.target.value }))
              }
              required
            />
          </label>
          <div className="auth-role-header">
            <strong>Perfil de acesso</strong>
            <span>Escolha como deseja explorar o protótipo.</span>
          </div>
          <div className="auth-role-select">
            <select
              aria-label="Perfil de acesso"
              value={loginForm.profile}
              onChange={(event) => {
                const profile = event.target.value as Profile
                setLoginForm((current) => ({
                  ...current,
                  profile,
                  username: `${roleLogins[profile]}@vidaplus.demo`,
                }))
              }}
            >
              {(['patient', 'professional', 'admin'] as Profile[]).map((profile) => (
                <option key={profile} value={profile}>
                  {profileMeta[profile].label}
                </option>
              ))}
            </select>
          </div>
          <p className="auth-role-caption">{profileMeta[loginForm.profile].subtitle}</p>
          <div className="auth-support-strip">
            <span className="hint-text">Senha demo</span>
            <code>{demoPassword}</code>
          </div>
          <div className="auth-utility-row">
            <label className="checkbox">
              <input
                type="checkbox"
                checked={loginForm.rememberDevice}
                onChange={(event) =>
                  setLoginForm((current) => ({ ...current, rememberDevice: event.target.checked }))
                }
              />
              <span>Lembrar dispositivo</span>
            </label>
            <button className="text-link auth-inline-link" type="button" onClick={() => setAuthView('recover')}>
              Recuperar senha
            </button>
          </div>
          <div className="button-row auth-primary-actions">
            <button className="button button--primary" type="submit">
              Entrar
            </button>
          </div>
          <div className="link-row auth-link-row auth-link-row--compact">
            <button type="button" className="text-link" onClick={() => setAuthView('register')}>
              Primeiro acesso
            </button>
            <button type="button" className="text-link" onClick={() => setAuthView('privacy')}>
              Privacidade
            </button>
            <button type="button" className="text-link" onClick={() => setAuthView('lgpd')}>
              LGPD
            </button>
          </div>
        </form>
      </div>
    )
  }

  function renderPatientView() {
    if (currentView === 'profile') {
      return (
        <div className="page-grid page-grid--management">
          <SectionIntro
            eyebrow="Cadastro"
            title="Dados do paciente"
            description="Edição de dados pessoais, convênio, alergias e contato de emergência com validação visual."
            actions={
              <button className="button button--primary" type="submit" form="patient-form">
                Salvar alterações
              </button>
            }
          />
          <div className="content-grid content-grid--wide content-grid--form-aside">
            <Panel className="panel--editor">
              <form className="form-grid" id="patient-form" onSubmit={handleSavePatientProfile}>
                <label className="form-field"><span>Nome completo</span><input value={patientProfile.name} onChange={(event) => setPatientProfile((current) => ({ ...current, name: event.target.value }))} required /></label>
                <label className="form-field"><span>CPF</span><input value={patientProfile.cpf} onChange={(event) => setPatientProfile((current) => ({ ...current, cpf: event.target.value }))} required /></label>
                <label className="form-field"><span>Data de nascimento</span><input type="date" value={patientProfile.birthDate} onChange={(event) => setPatientProfile((current) => ({ ...current, birthDate: event.target.value }))} required /></label>
                <label className="form-field"><span>Telefone</span><input value={patientProfile.phone} onChange={(event) => setPatientProfile((current) => ({ ...current, phone: event.target.value }))} required /></label>
                <label className="form-field form-field--full"><span>Endereço</span><input value={patientProfile.address} onChange={(event) => setPatientProfile((current) => ({ ...current, address: event.target.value }))} required /></label>
                <label className="form-field"><span>Convênio</span><input value={patientProfile.insurance} onChange={(event) => setPatientProfile((current) => ({ ...current, insurance: event.target.value }))} required /></label>
                <label className="form-field"><span>Alergias</span><input value={patientProfile.allergies} onChange={(event) => setPatientProfile((current) => ({ ...current, allergies: event.target.value }))} /></label>
                <label className="form-field form-field--full"><span>Contato de emergência</span><input value={patientProfile.emergencyContact} onChange={(event) => setPatientProfile((current) => ({ ...current, emergencyContact: event.target.value }))} required /></label>
              </form>
            </Panel>
            <Panel className="panel--accent">
              <h2>Resumo protegido</h2>
              <ul className="detail-list">
                <li><span>Paciente</span><strong>{patientProfile.name}</strong></li>
                <li><span>CPF mascarado</span><strong>{maskCpf(patientProfile.cpf)}</strong></li>
                <li><span>Telefone protegido</span><strong>{maskPhone(patientProfile.phone)}</strong></li>
                <li><span>Consentimentos ativos</span><strong>{consents.filter((item) => item.granted).length} de 4</strong></li>
              </ul>
            </Panel>
          </div>
        </div>
      )
    }

    if (currentView === 'consultations') {
      return (
        <div className="page-grid page-grid--management">
          <SectionIntro eyebrow="Consultas" title="Agendar, visualizar e cancelar consultas" description="Fluxo com especialidade, unidade, profissional, data, horário e comprovante visual." />
          <div className="content-grid content-grid--wide content-grid--form-aside">
            <Panel>
              <h2>Nova consulta</h2>
              <form className="form-grid" onSubmit={handleScheduleConsultation}>
                <label className="form-field"><span>Especialidade</span><select value={appointmentDraft.specialty} onChange={(event) => setAppointmentDraft((current) => ({ ...current, specialty: event.target.value }))}>{specialties.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
                <label className="form-field"><span>Unidade</span><select value={appointmentDraft.unit} onChange={(event) => setAppointmentDraft((current) => ({ ...current, unit: event.target.value }))}>{unitOptions.slice(0, 2).map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
                <label className="form-field"><span>Profissional</span><input value={appointmentDraft.professional} onChange={(event) => setAppointmentDraft((current) => ({ ...current, professional: event.target.value }))} required /></label>
                <label className="form-field"><span>Data</span><input type="date" value={appointmentDraft.date} onChange={(event) => setAppointmentDraft((current) => ({ ...current, date: event.target.value }))} required /></label>
                <label className="form-field"><span>Horário</span><input type="time" value={appointmentDraft.time} onChange={(event) => setAppointmentDraft((current) => ({ ...current, time: event.target.value }))} required /></label>
                <label className="form-field"><span>Modalidade</span><select value={appointmentDraft.modality} onChange={(event) => setAppointmentDraft((current) => ({ ...current, modality: event.target.value }))}><option value="Presencial">Presencial</option><option value="Telemedicina">Telemedicina</option></select></label>
                <div className="button-row button-row--end"><button className="button button--primary" type="submit">Confirmar agendamento</button></div>
              </form>
            </Panel>
            <Panel>
              <div className="toolbar"><h2>Minhas consultas</h2><select value={consultationStatusFilter} onChange={(event) => setConsultationStatusFilter(event.target.value)}><option value="Todas">Todas</option><option value="Agendado">Agendado</option><option value="Confirmado">Confirmado</option><option value="Concluído">Concluído</option><option value="Cancelado">Cancelado</option></select></div>
              {filteredAppointments.length === 0 ? <EmptyState title="Nenhuma consulta encontrada" description="Ajuste os filtros ou o termo de busca." /> : <div className="stack-list">{filteredAppointments.map((item) => (<article key={item.id} className="record-card"><div className="record-card__header"><div><strong>{item.specialty}</strong><p>{formatDate(item.date)} as {item.time} " {item.professional}</p></div><StatusBadge status={item.status} /></div><p className="muted">{item.unit} " {item.modality}</p><p>{item.guidance}</p>{(item.status === 'Agendado' || item.status === 'Confirmado') && <div className="button-row"><button className="button button--ghost" type="button" onClick={() => handleCancelConsultation(item.id)}>Cancelar consulta</button></div>}</article>))}</div>}
            </Panel>
          </div>
        </div>
      )
    }

    if (currentView === 'exams') {
      return (
        <div className="page-grid page-grid--management">
          <SectionIntro eyebrow="Exames" title="Agendamento e orientações pré-exame" description="Escolha tipo de exame, unidade, data e horário com feedback visual imediato." />
          <div className="content-grid content-grid--wide content-grid--form-aside">
            <Panel>
              <h2>Novo exame</h2>
              <form className="form-grid" onSubmit={handleScheduleExam}>
                <label className="form-field"><span>Tipo de exame</span><select value={examDraft.type} onChange={(event) => setExamDraft((current) => ({ ...current, type: event.target.value }))}>{examTypes.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
                <label className="form-field"><span>Laboratório ou unidade</span><select value={examDraft.unit} onChange={(event) => setExamDraft((current) => ({ ...current, unit: event.target.value }))}>{unitOptions.slice(0, 3).map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
                <label className="form-field"><span>Data</span><input type="date" value={examDraft.date} onChange={(event) => setExamDraft((current) => ({ ...current, date: event.target.value }))} required /></label>
                <label className="form-field"><span>Horário</span><input type="time" value={examDraft.time} onChange={(event) => setExamDraft((current) => ({ ...current, time: event.target.value }))} required /></label>
                <div className="button-row button-row--end"><button className="button button--primary" type="submit">Agendar exame</button></div>
              </form>
            </Panel>
            <Panel>
              <div className="toolbar"><h2>Meus exames</h2><select value={examStatusFilter} onChange={(event) => setExamStatusFilter(event.target.value)}><option value="Todos">Todos</option><option value="Agendado">Agendado</option><option value="Pendente">Pendente</option><option value="Realizado">Realizado</option><option value="Cancelado">Cancelado</option></select></div>
              <div className="stack-list">{filteredExams.map((item) => (<article key={item.id} className="record-card"><div className="record-card__header"><div><strong>{item.type}</strong><p>{formatDate(item.date)} as {item.time}</p></div><StatusBadge status={item.status} /></div><p className="muted">{item.unit}</p><p>{item.preparation}</p>{(item.status === 'Agendado' || item.status === 'Pendente') && <div className="button-row"><button className="button button--ghost" type="button" onClick={() => handleCancelExam(item.id)}>Cancelar exame</button></div>}</article>))}</div>
            </Panel>
          </div>
        </div>
      )
    }

    if (currentView === 'history') {
      return (
        <div className="page-grid">
          <SectionIntro
            eyebrow="Histórico Clínico"
            title="Linha do tempo de atendimentos"
            description="Eventos clínicos, exames, prescrições e observações em ordem cronológica."
          />
          <Panel>
            <div className="toolbar toolbar--dense">
              <select value={timelineFilter} onChange={(event) => setTimelineFilter(event.target.value)}>
                <option value="Todos">Todos</option>
                <option value="Consulta">Consulta</option>
                <option value="Exame">Exame</option>
                <option value="Prescrição">Prescrição</option>
                <option value="Evolucao">Evolucao</option>
                <option value="Telemedicina">Telemedicina</option>
              </select>
              <select
                value={timelineProfessionalFilter}
                onChange={(event) => setTimelineProfessionalFilter(event.target.value)}
              >
                {timelineProfessionalOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <select
                value={timelinePeriodFilter}
                onChange={(event) => setTimelinePeriodFilter(event.target.value)}
              >
                <option value="Todos os períodos">Todos os períodos</option>
                <option value="Últimos 30 dias">Últimos 30 dias</option>
                <option value="Últimos 90 dias">Últimos 90 dias</option>
                <option value="Ano atual">Ano atual</option>
              </select>
            </div>
            <div className="timeline">
              {filteredTimeline.map((item) => (
                <article key={item.id} className="timeline-item">
                  <div className="timeline-item__marker" />
                  <div className="timeline-item__content">
                    <div className="record-card__header">
                      <div>
                        <strong>{item.title}</strong>
                        <p>
                          {item.professional} " {formatDate(item.date)}
                        </p>
                      </div>
                      <StatusBadge status={item.category} />
                    </div>
                    <p>{item.summary}</p>
                  </div>
                </article>
              ))}
            </div>
          </Panel>
        </div>
      )
    }




    if (currentView === 'telemedicine') {
      return (
        <div className="page-grid">
          <SectionIntro eyebrow="Teleconsulta" title="Sala de espera e videochamada segura" description="Fluxo com check-in, status de conexão, prontuário online e avaliação do atendimento." />
          <div className="content-grid content-grid--wide content-grid--form-aside">
            <Panel className="panel--accent">
              <div className="record-card__header"><div><h2>{nextTeleAppointment.specialty}</h2><p>{formatDate(nextTeleAppointment.date)} as {nextTeleAppointment.time} " {nextTeleAppointment.professional}</p></div><StatusBadge status={teleStage === 'live' ? 'Ao vivo' : teleStage === 'finished' ? 'Encerrada' : telePatientReady ? 'Paciente na sala' : 'Aguardando check-in'} /></div>
              <ul className="detail-list"><li><span>Conexão segura</span><strong>Canal protegido (simulado)</strong></li><li><span>Dados clínicos</span><strong>Acesso restrito ao profissional em atendimento</strong></li></ul>
              {teleStage === 'waiting' && <div className="button-row"><button className="button button--primary" type="button" onClick={handlePatientCheckInTelemedicine}>Confirmar presença na sala</button></div>}
            </Panel>
            <Panel>
              {teleStage === 'live' ? <div className="video-stage"><div className="video-stage__screen"><div className="video-stage__window"><strong>Profissional</strong><span>{nextTeleAppointment.professional}</span></div><div className="video-stage__window video-stage__window--secondary"><strong>Paciente</strong><span>{patientProfile.name}</span></div></div><div className="video-stage__toolbar"><button className="button button--ghost" type="button">Microfone</button><button className="button button--ghost" type="button">Câmera</button><button className="button button--ghost" type="button">Compartilhar</button><button className="button button--primary" type="button" onClick={handleFinishTelemedicine}>Encerrar</button></div></div> : teleStage === 'finished' ? <div className="stack-list"><h2>Resumo da teleconsulta</h2><p>Atendimento finalizado com orientações registradas em prontuário e avaliação do paciente.</p><div className="rating-row" role="radiogroup" aria-label="Avaliação do atendimento">{[1, 2, 3, 4, 5].map((value) => <button key={value} className={`rating-chip ${teleEvaluation === value ? 'is-active' : ''}`} type="button" onClick={() => setTeleEvaluation(value)}>{value}</button>)}</div></div> : <div className="stack-list"><h2>Sala de espera virtual</h2><p>O profissional iniciará a videochamada no horário marcado. O chat fica disponível para mensagens operacionais.</p></div>}
              <div className="chat-box">{teleMessages.map((item) => (<article key={item.id} className="chat-message"><strong>{item.author}</strong><span>{item.time}</span><p>{item.message}</p></article>))}</div>
            </Panel>
          </div>
        </div>
      )
    }

    if (currentView === 'prescriptions') {
      return <div className="page-grid"><SectionIntro eyebrow="Prescrições" title="Receitas digitais simuladas" description="Visualização das prescrições emitidas, validade e orientações de uso." /><div className="stack-list">{prescriptions.map((item) => (<Panel key={item.id}><div className="record-card__header"><div><h2>{item.specialty}</h2><p>{item.professional} " validade até {formatDate(item.validUntil)}</p></div><StatusBadge status={item.status} /></div><ul className="bullet-list">{item.items.map((entry) => <li key={entry}>{entry}</li>)}</ul></Panel>))}</div></div>
    }

    if (currentView === 'notifications') {
      return <div className="page-grid"><SectionIntro eyebrow="Notificações" title="Alertas, confirmações e lembretes" description="Mensagens visuais claras com controle de leitura e priorização." actions={<button className="button button--ghost" type="button" onClick={markAllNotificationsRead}>Marcar todas como lidas</button>} /><Panel><div className="toolbar"><select value={notificationFilter} onChange={(event) => setNotificationFilter(event.target.value)}><option value="Todas">Todas</option><option value="Não lidas">Não lidas</option><option value="Lidas">Lidas</option></select></div><div className="stack-list">{filteredNotifications.map((item) => (<article key={item.id} className={`notification-card ${item.read ? 'is-read' : ''}`}><div className="record-card__header"><div><strong>{item.title}</strong><p>{item.time}</p></div><span className={`badge badge--${item.tone}`}>{item.read ? 'Lida' : 'Nova'}</span></div><p>{item.message}</p><div className="button-row"><button className="button button--ghost" type="button" onClick={() => toggleNotificationRead(item.id)}>{item.read ? 'Marcar como não lida' : 'Marcar como lida'}</button></div></article>))}</div></Panel></div>
    }

    if (currentView === 'privacy') {
      return (
        <div className="page-grid">
          <SectionIntro
            eyebrow="Privacidade e LGPD"
            title="Direitos do titular, consentimentos e rastreabilidade"
            description="área do paciente para exportação de dados, correção cadastral, solicitações LGPD e controle de compartilhamentos."
          />
          <div className="content-grid content-grid--wide">
            <Panel className="panel--accent">
              <h2>Direitos do titular</h2>
              <p className="hint-text">
                Ações visuais para acesso, correção, portabilidade e exclusão/anonimização sujeitas a análise.
              </p>
              <div className="card-grid lgpd-card-grid">
                <article className="record-card lgpd-action-card">
                  <div className="stack-list">
                    <span className="metric-card__label">Acesso</span>
                    <strong>Baixar meus dados</strong>
                    <p>Exporta um pacote JSON com cadastro, consentimentos, consultas, exames e histórico do portal.</p>
                  </div>
                  <div className="button-row">
                    <button className="button button--primary" type="button" onClick={handleDownloadPersonalData}>
                      Baixar pacote
                    </button>
                  </div>
                </article>
                <article className="record-card lgpd-action-card">
                  <div className="stack-list">
                    <span className="metric-card__label">Correção</span>
                    <strong>Corrigir cadastro</strong>
                    <p>Leva o paciente ao fluxo de atualização cadastral para revisar contato, convênio e dados básicos.</p>
                  </div>
                  <div className="button-row">
                    <button className="button button--ghost" type="button" onClick={handleOpenCorrectionFlow}>
                      Revisar dados
                    </button>
                  </div>
                </article>
                <article className="record-card lgpd-action-card">
                  <div className="stack-list">
                    <span className="metric-card__label">Portabilidade</span>
                    <strong>Solicitar portabilidade</strong>
                    <p>Registra o pedido para envio estruturado dos dados ao titular ou a outro prestador indicado.</p>
                  </div>
                  <div className="button-row">
                    <button className="button button--ghost" type="button" onClick={handleRequestPortability}>
                      Registrar pedido
                    </button>
                  </div>
                </article>
                <article className="record-card lgpd-action-card">
                  <div className="stack-list">
                    <span className="metric-card__label">Exclusão</span>
                    <strong>Solicitar exclusão ou anonimização</strong>
                    <p>Abre a demanda formal para análise quando houver tratamento baseado em consentimento ou retenção obrigatoria.</p>
                  </div>
                  <div className="button-row">
                    <button className="button button--ghost" type="button" onClick={handleRequestDeletion}>
                      Solicitar análise
                    </button>
                  </div>
                </article>
              </div>
            </Panel>
            <Panel>
              <h2>Consentimentos ativos</h2>
              <div className="stack-list">
                {consents.map((item) => (
                  <article key={item.id} className="record-card">
                    <div className="record-card__header">
                      <div>
                        <strong>{item.title}</strong>
                        <p>{item.description}</p>
                      </div>
                      <StatusBadge status={item.granted ? 'Ativo' : 'Revogado'} />
                    </div>
                    <div className="button-row">
                      <button
                        className="button button--ghost"
                        type="button"
                        onClick={() => handleToggleConsent(item)}
                      >
                        {item.granted ? 'Revogar' : 'Ativar'}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </Panel>
          </div>
          <div className="content-grid content-grid--wide">
            <Panel>
              <h2>Solicitações LGPD registradas</h2>
              {latestDataSubjectRequests.length > 0 ? (
                <div className="stack-list">
                  {latestDataSubjectRequests.map((item) => (
                    <article key={item.id} className="record-card">
                      <div className="record-card__header">
                        <div>
                          <strong>{item.title}</strong>
                          <p>{item.description}</p>
                        </div>
                        <StatusBadge status={item.status} />
                      </div>
                      <div className="lgpd-request-meta">
                        <span>Canal: {item.channel}</span>
                        <span>Registrado em {item.requestedAt}</span>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="Nenhuma solicitação registrada"
                  description="Quando houver pedido de portabilidade ou exclusão/anonimização, ele aparecera aqui com status e data."
                />
              )}
            </Panel>
            <Panel className="panel--soft">
              <h2>Canal de privacidade e compartilhamento</h2>
              <ul className="detail-list">
                <li>
                  <span>Controlador demonstrativo</span>
                  <strong>VidaPlus Serviços Integrados de Saúde</strong>
                </li>
                <li>
                  <span>Encarregado</span>
                  <strong>privacidade@vidaplus.demo</strong>
                </li>
                <li>
                  <span>Canal complementar</span>
                  <strong>0800 555 2026</strong>
                </li>
                <li>
                  <span>Prazo de resposta visual</span>
                  <strong>Acompanhamento pelo portal</strong>
                </li>
              </ul>
              <div className="stack-list">
                <article className="record-card">
                  <div className="record-card__header">
                    <div>
                      <strong>Hospital e clínica VidaPlus</strong>
                      <p>Compartilhamento interno para consultas, exames, internações e continuidade assistencial.</p>
                    </div>
                    <StatusBadge status="Ativo" />
                  </div>
                </article>
                <article className="record-card">
                  <div className="record-card__header">
                    <div>
                      <strong>Laboratório e home care</strong>
                      <p>Uso vinculado a solicitações clínicas, coleta, resultados e acompanhamentos autorizados.</p>
                    </div>
                    <StatusBadge status="Ativo" />
                  </div>
                </article>
              </div>
              <p className="hint-text lgpd-note">
                Pedidos de exclusão imediata podem não ser executados automaticamente quando houver obrigações legais, regulatórias ou assistenciais de retenção.
              </p>
            </Panel>
          </div>
          <div className="content-grid content-grid--wide">
            <Panel>
              <h2>Últimos acessos da conta</h2>
              <div className="stack-list">
                {patientAccessHistory.map((item) => (
                  <article key={item.id} className="record-card">
                    <div className="record-card__header">
                      <div>
                        <strong>{item.lastAccess}</strong>
                        <p>{item.device}</p>
                      </div>
                      <span className="badge badge--info">Risco {item.risk}</span>
                    </div>
                    <p>Usuário: {item.user}</p>
                  </article>
                ))}
              </div>
            </Panel>
            <Panel className="panel--accent">
              <h2>Boas práticas de segurança</h2>
              <ul className="bullet-list">
                <li>CPF: {maskCpf(patientProfile.cpf)}</li>
                <li>Telefone: {maskPhone(patientProfile.phone)}</li>
                <li>Revogação de consentimentos disponível sem sair da área do paciente.</li>
                <li>Dados fictícios usados apenas para demonstração acadêmica.</li>
              </ul>
            </Panel>
          </div>
        </div>
      )
    }

    return <div className="page-grid"><SectionIntro eyebrow="Dashboard do paciente" title="Visão geral da jornada assistencial" description="Resumo de próximas consultas, exames, prescrições, notificações e atalhos de autoatendimento." actions={<div className="button-row"><button className="button button--primary" type="button" onClick={() => navigate('consultations')}>Nova consulta</button><button className="button button--ghost" type="button" onClick={() => navigate('telemedicine')}>Entrar na teleconsulta</button></div>} /><div className="metric-grid"><MetricCard label="Próximas consultas" value={`${upcomingAppointments.length}`} detail="Inclui presencial e telemedicina" tone="accent" /><MetricCard label="Exames pendentes" value={`${pendingExams}`} detail="Com preparo visível e alertas" tone="warning" /><MetricCard label="Prescrições ativas" value={`${prescriptions.filter((item) => item.status === 'Ativa').length}`} detail="Receitas digitais simuladas" tone="success" /><MetricCard label="Notificações não lidas" value={`${unreadNotifications}`} detail="Lembretes e confirmações" /></div><div className="content-grid content-grid--wide"><Panel className="panel--accent"><h2>Próxima interação</h2><p className="lead-text">{upcomingAppointments[0].specialty} em {formatDate(upcomingAppointments[0].date)} as {upcomingAppointments[0].time}.</p><p>{upcomingAppointments[0].guidance}</p><div className="button-row"><button className="button button--primary" type="button" onClick={() => navigate('history')}>Ver histórico</button><button className="button button--ghost" type="button" onClick={() => navigate('profile')}>Atualizar cadastro</button></div></Panel><Panel><h2>Lembretes do dia</h2><div className="stack-list">{notifications.slice(0, 3).map((item) => (<article key={item.id} className="notification-card"><div className="record-card__header"><strong>{item.title}</strong><span className={`badge badge--${item.tone}`}>{item.time}</span></div><p>{item.message}</p></article>))}</div></Panel></div><div className="content-grid content-grid--wide"><Panel><h2>Agenda e exames</h2><div className="stack-list">{appointments.slice(0, 2).map((item) => (<article key={item.id} className="record-card"><div className="record-card__header"><strong>{item.specialty}</strong><StatusBadge status={item.status} /></div><p>{formatDate(item.date)} - {item.time} - {item.unit}</p></article>))}{exams.slice(0, 1).map((item) => (<article key={item.id} className="record-card"><div className="record-card__header"><strong>{item.type}</strong><StatusBadge status={item.status} /></div><p>{item.preparation}</p></article>))}</div></Panel><Panel><h2>Histórico recente</h2><div className="timeline">{timeline.slice(0, 3).map((item) => (<article key={item.id} className="timeline-item"><div className="timeline-item__marker" /><div className="timeline-item__content"><strong>{item.title}</strong><p>{formatDate(item.date)} - {item.professional}</p></div></article>))}</div></Panel></div></div>
  }

  function renderProfessionalView() {
    if (currentView === 'agenda') {
      const groupedAgenda = Array.from(new Set(filteredAgenda.map((item) => item.date))).map((date) => ({
        date,
        items: filteredAgenda.filter((item) => item.date === date),
      }))

      return (
        <div className="page-grid">
          <SectionIntro
            eyebrow="Agenda do profissional"
            title="Visão diária, semanal e mensal"
            description="Agenda por data, tipo e status com acesso direto ao prontuário e a telemedicina."
          />
          <div className="toolbar toolbar--dense">
            <select
              value={agendaViewMode}
              onChange={(event) => setAgendaViewMode(event.target.value as AgendaViewMode)}
            >
              <option value="Diaria">Diária</option>
              <option value="Semanal">Semanal</option>
              <option value="Mensal">Mensal</option>
            </select>
            <select value={agendaDateFilter} onChange={(event) => setAgendaDateFilter(event.target.value)}>
              {agendaDateOptions.map((item) => (
                <option key={item} value={item}>
                  {formatDate(item)}
                </option>
              ))}
            </select>
            <select value={agendaTypeFilter} onChange={(event) => setAgendaTypeFilter(event.target.value)}>
              <option value="Todos">Todos os tipos</option>
              <option value="Presencial">Presencial</option>
              <option value="Telemedicina">Telemedicina</option>
              <option value="Home Care">Home Care</option>
            </select>
            <select value={agendaStatusFilter} onChange={(event) => setAgendaStatusFilter(event.target.value)}>
              <option value="Todos">Todos os status</option>
              <option value="Agendado">Agendado</option>
              <option value="Confirmado">Confirmado</option>
              <option value="Em atendimento">Em atendimento</option>
              <option value="Concluído">Concluído</option>
            </select>
          </div>
          <div className="metric-grid">
            <MetricCard
              label="Atendimentos no recorte"
              value={`${filteredAgenda.length}`}
              detail={`${agendaViewMode.toLowerCase()} com filtros aplicados`}
              tone="accent"
            />
            <MetricCard
              label="Telemedicina"
              value={`${filteredAgenda.filter((item) => item.type === 'Telemedicina').length}`}
              detail="Consultas online no período"
              tone="success"
            />
            <MetricCard
              label="Home care"
              value={`${filteredAgenda.filter((item) => item.type === 'Home Care').length}`}
              detail="Visitas domiciliares em rota"
              tone="warning"
            />
            <MetricCard
              label="Datas com agenda"
              value={`${groupedAgenda.length}`}
              detail="Blocos organizados por dia"
            />
          </div>
          <div className="card-grid schedule-board">
            {groupedAgenda.map((group) => (
              <Panel key={group.date}>
                <div className="record-card__header">
                  <div>
                    <h2>{formatDate(group.date)}</h2>
                    <p>{group.items.length} atendimento(s) no período selecionado.</p>
                  </div>
                  <StatusBadge status={`${group.items.length} agenda(s)`} />
                </div>
                <div className="stack-list">
                  {group.items.map((item) => (
                    <article key={item.id} className="record-card">
                      <div className="record-card__header">
                        <div>
                          <strong>
                            {item.time} " {item.patientName}
                          </strong>
                          <p>
                            {item.reason} " {item.unit}
                          </p>
                        </div>
                        <StatusBadge status={item.status} />
                      </div>
                      <p className="muted">
                        {item.type} " {item.room} " {item.alert}
                      </p>
                      <div className="button-row">
                        <button
                          className="button button--ghost"
                          type="button"
                          onClick={() => {
                            setSelectedProfessionalPatientId(item.patientId)
                            navigate('records')
                          }}
                        >
                          Abrir prontuário
                        </button>
                        {item.type === 'Telemedicina' ? (
                          <button className="button button--primary" type="button" onClick={handleStartTelemedicine}>
                            Iniciar teleconsulta
                          </button>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              </Panel>
            ))}
          </div>
        </div>
      )
    }

    if (currentView === 'agenda') {
      return <div className="page-grid"><SectionIntro eyebrow="Agenda do profissional" title="Atendimentos por horário, tipo e status" description="Lista diária com acesso direto ao prontuário ou telemedicina." /><Panel><div className="toolbar"><select value={agendaStatusFilter} onChange={(event) => setAgendaStatusFilter(event.target.value)}><option value="Todos">Todos</option><option value="Agendado">Agendado</option><option value="Confirmado">Confirmado</option><option value="Em atendimento">Em atendimento</option><option value="Concluído">Concluído</option></select></div><div className="stack-list">{filteredAgenda.map((item) => (<article key={item.id} className="record-card"><div className="record-card__header"><div><strong>{item.time} " {item.patientName}</strong><p>{item.reason} " {item.unit}</p></div><StatusBadge status={item.status} /></div><p className="muted">{item.type} " {item.room} " {item.alert}</p><div className="button-row"><button className="button button--ghost" type="button" onClick={() => { setSelectedProfessionalPatientId(item.patientId); navigate('records') }}>Abrir prontuário</button>{item.type === 'Telemedicina' && <button className="button button--primary" type="button" onClick={handleStartTelemedicine}>Iniciar teleconsulta</button>}</div></article>))}</div></Panel></div>
    }

    if (currentView === 'patients') {
      return <div className="page-grid"><SectionIntro eyebrow="Pacientes do dia" title="Dados básicos e alertas clínicos" description="Acesso rápido aos pacientes vinculados aos atendimentos do profissional." /><div className="card-grid">{distinctPatients.map((item) => (<Panel key={item.id}><div className="record-card__header"><div><h2>{item.name}</h2><p>{item.age} anos " {item.careType}</p></div><StatusBadge status={item.status} /></div><ul className="bullet-list">{item.alerts.map((alert) => <li key={alert}>{alert}</li>)}</ul><div className="button-row"><button className="button button--primary" type="button" onClick={() => { setSelectedProfessionalPatientId(item.id); navigate('records') }}>Abrir detalhes</button></div></Panel>))}</div></div>
    }

    if (currentView === 'records') {
      return <div className="page-grid"><SectionIntro eyebrow="Prontuário eletrônico" title={`Registro clínico de ${selectedProfessionalPatient.name}`} description="Consulta de dados básicos, histórico resumido, sinais vitais e conduta." /><div className="content-grid content-grid--wide"><Panel className="panel--accent"><h2>Resumo do paciente</h2><ul className="detail-list"><li><span>CPF mascarado</span><strong>{selectedProfessionalPatient.id === patientProfile.id ? maskCpf(patientProfile.cpf) : '***.***.***-**'}</strong></li><li><span>Último atendimento</span><strong>{selectedProfessionalPatient.lastVisit}</strong></li><li><span>Próximo passo</span><strong>{selectedProfessionalPatient.nextStep}</strong></li></ul><ul className="bullet-list">{selectedProfessionalPatient.alerts.map((alert) => <li key={alert}>{alert}</li>)}</ul></Panel><Panel><form className="form-grid" onSubmit={handleSaveClinicalNote}><label className="form-field form-field--full"><span>Sintomas</span><textarea value={clinicalNote.symptoms} onChange={(event) => setClinicalNote((current) => ({ ...current, symptoms: event.target.value }))} rows={3} /></label><label className="form-field form-field--full"><span>Diagnóstico</span><textarea value={clinicalNote.diagnosis} onChange={(event) => setClinicalNote((current) => ({ ...current, diagnosis: event.target.value }))} rows={3} /></label><label className="form-field form-field--full"><span>Conduta</span><textarea value={clinicalNote.conduct} onChange={(event) => setClinicalNote((current) => ({ ...current, conduct: event.target.value }))} rows={3} /></label><label className="form-field form-field--full"><span>Observações</span><textarea value={clinicalNote.observations} onChange={(event) => setClinicalNote((current) => ({ ...current, observations: event.target.value }))} rows={3} /></label><label className="form-field form-field--full"><span>Sinais vitais</span><input value={clinicalNote.vitals} onChange={(event) => setClinicalNote((current) => ({ ...current, vitals: event.target.value }))} /></label><div className="button-row button-row--end"><button className="button button--primary" type="submit">Salvar evolução clínica</button></div></form></Panel></div></div>
    }

    if (currentView === 'prescriptions') {
      return <div className="page-grid"><SectionIntro eyebrow="Prescrições" title="Montagem de receita digital simulada" description="Fluxo do profissional com itens, posologia e orientações complementares." /><div className="content-grid content-grid--wide"><Panel><form className="form-grid" onSubmit={handleIssuePrescription}><label className="form-field"><span>Medicamento</span><input value={prescriptionDraft.medicine} onChange={(event) => setPrescriptionDraft((current) => ({ ...current, medicine: event.target.value }))} required /></label><label className="form-field"><span>Posologia</span><input value={prescriptionDraft.dosage} onChange={(event) => setPrescriptionDraft((current) => ({ ...current, dosage: event.target.value }))} required /></label><label className="form-field form-field--full"><span>Orientações</span><textarea value={prescriptionDraft.guidance} onChange={(event) => setPrescriptionDraft((current) => ({ ...current, guidance: event.target.value }))} rows={3} /></label><div className="button-row button-row--end"><button className="button button--primary" type="submit">Emitir prescrição</button></div></form></Panel><Panel><h2>Prescrições recentes</h2><div className="stack-list">{prescriptions.slice(0, 4).map((item) => (<article key={item.id} className="record-card"><div className="record-card__header"><strong>{item.professional}</strong><StatusBadge status={item.status} /></div><p>{item.items[0]}</p></article>))}</div></Panel></div></div>
    }

    if (currentView === 'examRequests') {
      return <div className="page-grid"><SectionIntro eyebrow="Solicitação de exames" title="Pedidos com prioridade e justificativa" description="Registro demonstrativo de exames vinculados ao atendimento atual." /><div className="content-grid content-grid--wide"><Panel><form className="form-grid" onSubmit={handleRequestExam}><label className="form-field"><span>Exame</span><select value={examRequestDraft.type} onChange={(event) => setExamRequestDraft((current) => ({ ...current, type: event.target.value }))}>{examTypes.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label className="form-field"><span>Prioridade</span><select value={examRequestDraft.priority} onChange={(event) => setExamRequestDraft((current) => ({ ...current, priority: event.target.value }))}><option value="Alta">Alta</option><option value="Média">Média</option><option value="Baixa">Baixa</option></select></label><label className="form-field form-field--full"><span>Justificativa</span><textarea value={examRequestDraft.justification} onChange={(event) => setExamRequestDraft((current) => ({ ...current, justification: event.target.value }))} rows={3} /></label><div className="button-row button-row--end"><button className="button button--primary" type="submit">Solicitar exame</button></div></form></Panel><Panel><h2>Solicitações recentes</h2><div className="stack-list">{exams.slice(0, 3).map((item) => (<article key={item.id} className="record-card"><div className="record-card__header"><strong>{item.type}</strong><StatusBadge status={item.status} /></div><p>{item.preparation}</p></article>))}</div></Panel></div></div>
    }

    if (currentView === 'telemedicine') {
      return (
        <div className="page-grid">
          <SectionIntro
            eyebrow="Telemedicina"
            title="Ambiente de atendimento remoto"
            description="Videochamada simulada com status de conexão, chat, prontuário e prescrição online na mesma tela."
            actions={
              teleStage !== 'live' ? (
                <button className="button button--primary" type="button" onClick={handleStartTelemedicine}>
                  Iniciar atendimento
                </button>
              ) : null
            }
          />
          <div className="tele-session-layout">
            <Panel className="tele-session-main">
              <div className="record-card__header">
                <div>
                  <h2>{teleAgendaItem.patientName}</h2>
                  <p>
                    {teleAgendaItem.reason} " {formatDate(teleAgendaItem.date)} " {teleAgendaItem.time}
                  </p>
                </div>
                <StatusBadge
                  status={
                    teleStage === 'live'
                      ? 'Em atendimento'
                      : teleStage === 'finished'
                        ? 'Encerrada'
                        : telePatientReady
                          ? 'Paciente pronto'
                          : 'Aguardando inicio'
                  }
                />
              </div>
              <div className="tele-session-status">
                <span className="status-pill">Canal seguro representado</span>
                <span className="status-pill">Chat operacional ativo</span>
                <span className="status-pill">Prontuário lateral disponível</span>
              </div>
              {teleStage === 'live' ? (
                <div className="video-stage">
                  <div className="video-stage__screen">
                    <div className="video-stage__window">
                      <strong>{professionalDemoUser}</strong>
                      <span>Profissional online</span>
                    </div>
                    <div className="video-stage__window video-stage__window--secondary">
                      <strong>{teleProfessionalPatient.name}</strong>
                      <span>Paciente conectado</span>
                    </div>
                  </div>
                  <div className="video-stage__toolbar tele-control-grid">
                    <button className="button button--ghost" type="button">
                      Audio
                    </button>
                    <button className="button button--ghost" type="button">
                      Video
                    </button>
                    <button className="button button--ghost" type="button">
                      Chat
                    </button>
                    <button className="button button--primary" type="button" onClick={handleFinishTelemedicine}>
                      Finalizar
                    </button>
                  </div>
                </div>
              ) : teleStage === 'finished' ? (
                <div className="stack-list">
                  <h2>Atendimento encerrado</h2>
                  <p>Resumo clínico e prescrição permanecem registrados no painel lateral para conferência final.</p>
                  <div className="rating-row" role="radiogroup" aria-label="Avaliação do atendimento">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <button
                        key={value}
                        className={`rating-chip ${teleEvaluation === value ? 'is-active' : ''}`}
                        type="button"
                        onClick={() => setTeleEvaluation(value)}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <EmptyState
                  title="Aguardando inicio da teleconsulta"
                  description="O profissional pode iniciar o atendimento assim que o paciente confirmar presença."
                />
              )}
              <div className="chat-box">
                {teleMessages.map((item) => (
                  <article key={item.id} className="chat-message">
                    <strong>{item.author}</strong>
                    <span>{item.time}</span>
                    <p>{item.message}</p>
                  </article>
                ))}
              </div>
            </Panel>
            <div className="tele-session-sidebar">
              <Panel className="panel--accent">
                <h2>Painel clínico lateral</h2>
                <ul className="detail-list">
                  <li>
                    <span>Paciente na sala</span>
                    <strong>{telePatientReady ? 'Confirmado' : 'Aguardando'}</strong>
                  </li>
                  <li>
                    <span>Tipo de atendimento</span>
                    <strong>{teleAgendaItem.type}</strong>
                  </li>
                  <li>
                    <span>Alerta clínico</span>
                    <strong>{teleAgendaItem.alert}</strong>
                  </li>
                </ul>
              </Panel>
              <Panel>
                <h2>Prontuário durante a chamada</h2>
                <label className="form-field">
                  <span>Resumo clínico</span>
                  <textarea
                    rows={5}
                    value={teleClinicalSummary}
                    onChange={(event) => setTeleClinicalSummary(event.target.value)}
                  />
                </label>
                <div className="button-row button-row--end">
                  <button className="button button--ghost" type="button" onClick={handleSaveTelemedicineSummary}>
                    Salvar resumo
                  </button>
                </div>
              </Panel>
              <Panel>
                <h2>Prescrição online</h2>
                <label className="form-field">
                  <span>Orientação principal</span>
                  <textarea
                    rows={4}
                    value={telePrescriptionText}
                    onChange={(event) => setTelePrescriptionText(event.target.value)}
                  />
                </label>
                <div className="button-row button-row--end">
                  <button className="button button--primary" type="button" onClick={handleIssueTelemedicinePrescription}>
                    Emitir prescrição
                  </button>
                </div>
              </Panel>
            </div>
          </div>
        </div>
      )
    }

    if (currentView === 'homecare') {
      return <div className="page-grid"><SectionIntro eyebrow="Home care" title="Pacientes acompanhados em domicílio" description="Visitas, risco assistencial, rota e observações de acompanhamento." /><div className="card-grid">{homeCareVisits.map((item) => (<Panel key={item.id}><div className="record-card__header"><div><h2>{item.patient}</h2><p>{item.address}</p></div><StatusBadge status={item.status} /></div><ul className="detail-list"><li><span>Próxima visita</span><strong>{item.nextVisit}</strong></li><li><span>Risco</span><strong>{item.risk}</strong></li><li><span>Responsável</span><strong>{item.nurse}</strong></li></ul><p>{item.notes}</p></Panel>))}</div></div>
    }

    if (currentView === 'history') {
      return <div className="page-grid"><SectionIntro eyebrow="Histórico do profissional" title="Atendimentos concluídos e produtividade" description="Visão rápida da carga assistencial e dos atendimentos finalizados." /><div className="metric-grid"><MetricCard label="Concluídos hoje" value={`${agenda.filter((item) => item.status === 'Concluído').length}`} detail="Atendimentos finalizados" tone="success" /><MetricCard label="Em atendimento" value={`${agenda.filter((item) => item.status === 'Em atendimento').length}`} detail="Pacientes no fluxo clínico" tone="accent" /><MetricCard label="Telemedicina" value={`${agenda.filter((item) => item.type === 'Telemedicina').length}`} detail="Consultas online do dia" /><MetricCard label="Home care" value={`${homeCareVisits.length}`} detail="Pacientes em rota domiciliar" tone="warning" /></div><Panel><div className="stack-list">{agenda.map((item) => (<article key={item.id} className="record-card"><div className="record-card__header"><strong>{item.patientName}</strong><StatusBadge status={item.status} /></div><p>{item.type} - {item.reason} - {item.time}</p></article>))}</div></Panel></div>
    }

    return <div className="page-grid"><SectionIntro eyebrow="Dashboard do profissional" title="Rotina assistencial do dia" description="Agenda diária, telemedicina, pendências clínicas e pacientes com prioridade." actions={<div className="button-row"><button className="button button--primary" type="button" onClick={() => navigate('agenda')}>Abrir agenda</button><button className="button button--ghost" type="button" onClick={() => navigate('telemedicine')}>Acessar telemedicina</button></div>} /><div className="metric-grid"><MetricCard label="Atendimentos do dia" value={`${agenda.length}`} detail="Presencial, online e home care" tone="accent" /><MetricCard label="Pendentes" value={`${agenda.filter((item) => item.status === 'Agendado' || item.status === 'Confirmado').length}`} detail="Com acesso rápido ao prontuário" /><MetricCard label="Pacientes de alto risco" value={`${homeCareVisits.filter((item) => item.risk === 'Alta').length}`} detail="Monitoramento prioritário" tone="warning" /><MetricCard label="Teleconsultas" value={`${agenda.filter((item) => item.type === 'Telemedicina').length}`} detail="Janela segura de atendimento" tone="success" /></div><div className="content-grid content-grid--wide"><Panel className="panel--accent"><h2>Próximo paciente</h2><p className="lead-text">{agenda[0].patientName} " {agenda[0].time}</p><p>{agenda[0].reason}</p><button className="button button--primary" type="button" onClick={() => { setSelectedProfessionalPatientId(agenda[0].patientId); navigate('records') }}>Abrir prontuário</button></Panel><Panel><h2>Alertas assistenciais</h2><div className="stack-list">{agenda.slice(0, 3).map((item) => (<article key={item.id} className="record-card"><div className="record-card__header"><strong>{item.patientName}</strong><StatusBadge status={item.type} /></div><p>{item.alert}</p></article>))}</div></Panel></div></div>
  }

  function renderAdminView() {
    if (currentView === 'patients') {
      return (
        <div className="page-grid page-grid--management">
          <SectionIntro
            eyebrow="Gestão de pacientes"
            title="Cadastro, filtros e situação assistencial"
            description="Fluxo administrativo com criação, edição, visualização e inativação simulada."
            className="section-intro--compact"
          />
          <div className="content-grid content-grid--wide content-grid--form-aside">
            <Panel className="panel--editor">
              <h2>{editingPatientId ? 'Editar paciente' : 'Novo paciente'}</h2>
              <form className="form-grid form-grid--editor" onSubmit={handleCreateAdminPatient}>
                <label className="form-field">
                  <span>Nome</span>
                  <input
                    value={newPatientDraft.name}
                    onChange={(event) =>
                      setNewPatientDraft((current) => ({ ...current, name: event.target.value }))
                    }
                    required
                  />
                </label>
                <label className="form-field">
                  <span>Idade</span>
                  <input
                    type="number"
                    value={newPatientDraft.age}
                    onChange={(event) =>
                      setNewPatientDraft((current) => ({ ...current, age: event.target.value }))
                    }
                    required
                  />
                </label>
                <label className="form-field">
                  <span>Unidade</span>
                  <select
                    value={newPatientDraft.unit}
                    onChange={(event) =>
                      setNewPatientDraft((current) => ({ ...current, unit: event.target.value }))
                    }
                  >
                    {unitOptions.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="form-field">
                  <span>Tipo de atendimento</span>
                  <select
                    value={newPatientDraft.careType}
                    onChange={(event) =>
                      setNewPatientDraft((current) => ({ ...current, careType: event.target.value }))
                    }
                  >
                    <option value="Ambulatorial">Ambulatorial</option>
                    <option value="Internação">Internação</option>
                    <option value="Exames">Exames</option>
                    <option value="Domiciliar">Domiciliar</option>
                  </select>
                </label>
                <div className="button-row button-row--end">
                  {editingPatientId ? (
                    <button
                      className="button button--ghost"
                      type="button"
                      onClick={() => {
                        setEditingPatientId(null)
                        setNewPatientDraft({
                          name: '',
                          age: '40',
                          unit: unitOptions[0] ?? unitNames[0],
                          careType: 'Ambulatorial',
                        })
                      }}
                    >
                      Cancelar edição
                    </button>
                  ) : null}
                  <button className="button button--primary" type="submit">
                    {editingPatientId ? 'Salvar alterações' : 'Cadastrar paciente'}
                  </button>
                </div>
              </form>
            </Panel>
            <Panel className="panel--table">
              <div className="table-wrapper">
                <table className="data-table data-table--cards">
                  <thead>
                    <tr>
                      <th>Paciente</th>
                      <th>Unidade</th>
                      <th>Status</th>
                      <th>Próximo passo</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAdminPatients.map((item) => (
                      <tr key={item.id}>
                        <td data-label="Paciente">
                          <strong>{item.name}</strong>
                          <span>{item.careType}</span>
                        </td>
                        <td data-label="Unidade">{item.unit}</td>
                        <td data-label="Status">
                          <StatusBadge status={item.status} />
                        </td>
                        <td data-label="Próximo passo">{item.nextStep}</td>
                        <td data-label="Ações">
                          <div className="button-row">
                            <button className="button button--ghost" type="button" onClick={() => handleEditPatient(item)}>
                              Editar
                            </button>
                            {(item.status === 'Ativo' || item.status === 'Inativo') && (
                              <button className="button button--ghost" type="button" onClick={() => handleTogglePatientLifecycle(item)}>
                                {item.status === 'Inativo' ? 'Reativar' : 'Inativar'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>
        </div>
      )
    }


    if (currentView === 'professionals') {
      return (
        <div className="page-grid page-grid--management">
          <SectionIntro
            eyebrow="Gestão de profissionais"
            title="Escalas, unidades e níveis de acesso"
            description="Cadastro demonstrativo de medicos, enfermagem e equipes de apoio."
          />
          <div className="content-grid content-grid--wide content-grid--form-aside">
            <Panel>
              <h2>{editingProfessionalId ? 'Editar profissional' : 'Novo profissional'}</h2>
              <form className="form-grid form-grid--editor" onSubmit={handleCreateProfessional}>
                <label className="form-field">
                  <span>Nome</span>
                  <input
                    value={newProfessionalDraft.name}
                    onChange={(event) =>
                      setNewProfessionalDraft((current) => ({ ...current, name: event.target.value }))
                    }
                    required
                  />
                </label>
                <label className="form-field">
                  <span>Especialidade/cargo</span>
                  <input
                    value={newProfessionalDraft.role}
                    onChange={(event) =>
                      setNewProfessionalDraft((current) => ({ ...current, role: event.target.value }))
                    }
                    required
                  />
                </label>
                <label className="form-field">
                  <span>Unidade</span>
                  <select
                    value={newProfessionalDraft.unit}
                    onChange={(event) =>
                      setNewProfessionalDraft((current) => ({ ...current, unit: event.target.value }))
                    }
                  >
                    {unitOptions.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="form-field">
                  <span>Turno</span>
                  <input
                    value={newProfessionalDraft.shift}
                    onChange={(event) =>
                      setNewProfessionalDraft((current) => ({ ...current, shift: event.target.value }))
                    }
                    required
                  />
                </label>
                <div className="button-row button-row--end">
                  {editingProfessionalId ? (
                    <button
                      className="button button--ghost"
                      type="button"
                      onClick={() => {
                        setEditingProfessionalId(null)
                        setNewProfessionalDraft({
                          name: '',
                          role: 'Clínico Geral',
                          unit: unitOptions[1] ?? unitOptions[0] ?? unitNames[1],
                          shift: '08:00 - 17:00',
                        })
                      }}
                    >
                      Cancelar edição
                    </button>
                  ) : null}
                  <button className="button button--primary" type="submit">
                    {editingProfessionalId ? 'Salvar alterações' : 'Cadastrar profissional'}
                  </button>
                </div>
              </form>
            </Panel>
            <Panel className="panel--table">
              <div className="table-wrapper">
                <table className="data-table data-table--cards">
                  <thead>
                    <tr>
                      <th>Profissional</th>
                      <th>Unidade</th>
                      <th>Turno</th>
                      <th>Status</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProfessionals.map((item) => (
                      <tr key={item.id}>
                        <td data-label="Profissional">
                          <strong>{item.name}</strong>
                          <span>{item.role}</span>
                        </td>
                        <td data-label="Unidade">{item.unit}</td>
                        <td data-label="Turno">{item.shift}</td>
                        <td data-label="Status">
                          <StatusBadge status={item.status} />
                        </td>
                        <td data-label="Ações">
                          <div className="button-row">
                            <button className="button button--ghost" type="button" onClick={() => handleEditProfessional(item)}>
                              Editar
                            </button>
                            {(item.status === 'Ativo' || item.status === 'Inativo') && (
                              <button className="button button--ghost" type="button" onClick={() => handleToggleProfessionalLifecycle(item)}>
                                {item.status === 'Inativo' ? 'Reativar' : 'Inativar'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>
        </div>
      )
    }


    if (currentView === 'units') {
      return (
        <div className="page-grid page-grid--management">
          <SectionIntro
            eyebrow="Unidades"
            title="Hospitais, clínicas, laboratório e home care"
            description="Cadastro e acompanhamento das unidades com status, ocupação e especialidades."
          />
          <div className="content-grid content-grid--wide content-grid--form-aside">
            <Panel className="panel--editor">
              <h2>{editingUnitId ? 'Editar unidade' : 'Nova unidade'}</h2>
              <form className="form-grid form-grid--editor" onSubmit={handleCreateUnit}>
                <label className="form-field">
                  <span>Nome</span>
                  <input
                    value={unitDraft.name}
                    onChange={(event) => setUnitDraft((current) => ({ ...current, name: event.target.value }))}
                    required
                  />
                </label>
                <label className="form-field">
                  <span>Tipo</span>
                  <select
                    value={unitDraft.type}
                    onChange={(event) => setUnitDraft((current) => ({ ...current, type: event.target.value }))}
                  >
                    <option value="Hospital">Hospital</option>
                    <option value="Clínica">Clínica</option>
                    <option value="Laboratório">Laboratório</option>
                    <option value="Home Care">Home Care</option>
                  </select>
                </label>
                <label className="form-field">
                  <span>Cidade</span>
                  <input
                    value={unitDraft.city}
                    onChange={(event) => setUnitDraft((current) => ({ ...current, city: event.target.value }))}
                    required
                  />
                </label>
                <label className="form-field">
                  <span>Ocupação (%)</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={unitDraft.occupancy}
                    onChange={(event) => setUnitDraft((current) => ({ ...current, occupancy: event.target.value }))}
                    required
                  />
                </label>
                <label className="form-field">
                  <span>Status</span>
                  <input
                    value={unitDraft.status}
                    onChange={(event) => setUnitDraft((current) => ({ ...current, status: event.target.value }))}
                    required
                  />
                </label>
                <label className="form-field form-field--full">
                  <span>Especialidades</span>
                  <input
                    value={unitDraft.specialties}
                    onChange={(event) => setUnitDraft((current) => ({ ...current, specialties: event.target.value }))}
                    placeholder="Cardiologia, Clínica Geral, Exames"
                    required
                  />
                </label>
                <div className="button-row button-row--end">
                  {editingUnitId ? (
                    <button
                      className="button button--ghost"
                      type="button"
                      onClick={() => {
                        setEditingUnitId(null)
                        setUnitDraft({
                          name: '',
                          type: 'Hospital',
                          city: 'Florianopolis/SC',
                          occupancy: '70',
                          status: 'Operação plena',
                          specialties: 'Clínica Geral, Exames',
                        })
                      }}
                    >
                      Cancelar edição
                    </button>
                  ) : null}
                  <button className="button button--primary" type="submit">
                    {editingUnitId ? 'Salvar alterações' : 'Cadastrar unidade'}
                  </button>
                </div>
              </form>
            </Panel>
            <Panel className="panel--table">
              <div className="table-wrapper">
                <table className="data-table data-table--cards">
                  <thead>
                    <tr>
                      <th>Unidade</th>
                      <th>Tipo</th>
                      <th>Cidade</th>
                      <th>Status</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUnits.map((item) => (
                      <tr key={item.id}>
                        <td data-label="Unidade">
                          <strong>{item.name}</strong>
                          <span>{item.specialties.join(', ')}</span>
                        </td>
                        <td data-label="Tipo">{item.type}</td>
                        <td data-label="Cidade">{item.city}</td>
                        <td data-label="Status">
                          <StatusBadge status={item.status} />
                        </td>
                        <td data-label="Ações">
                          <div className="button-row">
                            <button className="button button--ghost" type="button" onClick={() => handleEditUnit(item)}>
                              Editar
                            </button>
                            <button className="button button--ghost" type="button" onClick={() => handleToggleUnitLifecycle(item)}>
                              {item.status === 'Inativa' ? 'Reativar' : 'Inativar'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>
          <div className="card-grid">
            {filteredUnits.map((item) => (
              <Panel key={item.id}>
                <div className="record-card__header">
                  <div>
                    <h2>{item.name}</h2>
                    <p>
                      {item.type} " {item.city}
                    </p>
                  </div>
                  <StatusBadge status={item.status} />
                </div>
                <div className="bar-row">
                  <span>Ocupação</span>
                  <div className="bar-track">
                    <div className="bar-track__fill" style={{ width: `${item.occupancy}%` }} />
                  </div>
                  <strong>{item.occupancy}%</strong>
                </div>
                <ul className="bullet-list">
                  {item.specialties.map((specialty) => (
                    <li key={specialty}>{specialty}</li>
                  ))}
                </ul>
              </Panel>
            ))}
          </div>
        </div>
      )
    }


    if (currentView === 'admissions') {
      return (
        <div className="page-grid page-grid--management">
          <SectionIntro
            eyebrow="Internações"
            title="Fluxo de entrada, transferencia e alta"
            description="Busca de paciente, escolha de unidade, ala e leito com atualização do status assistencial."
          />
          <div className="content-grid content-grid--wide content-grid--form-aside">
            <Panel className="panel--editor">
              <h2>Nova internação</h2>
              <form className="form-grid form-grid--editor" onSubmit={handleAdmissionSubmit}>
                <label className="form-field">
                  <span>Paciente</span>
                  <select
                    value={admissionDraft.patient}
                    onChange={(event) =>
                      setAdmissionDraft((current) => ({ ...current, patient: event.target.value }))
                    }
                    required
                  >
                    <option value="">Selecione</option>
                    {adminPatients.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="form-field">
                  <span>Unidade</span>
                  <select
                    value={admissionDraft.unit}
                    onChange={(event) =>
                      setAdmissionDraft((current) => ({ ...current, unit: event.target.value }))
                    }
                  >
                    {unitOptions.slice(0, 2).map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="form-field">
                  <span>Ala</span>
                  <select
                    value={admissionDraft.wing}
                    onChange={(event) =>
                      setAdmissionDraft((current) => ({ ...current, wing: event.target.value }))
                    }
                  >
                    {unitWings.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="form-field">
                  <span>Leito</span>
                  <select
                    value={admissionDraft.bed}
                    onChange={(event) =>
                      setAdmissionDraft((current) => ({ ...current, bed: event.target.value }))
                    }
                    required
                  >
                    <option value="">Selecione</option>
                    {beds
                      .filter((item) => item.status === 'Disponível')
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.room} " {item.bed}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="form-field">
                  <span>Data de entrada</span>
                  <input
                    type="date"
                    value={admissionDraft.date}
                    onChange={(event) =>
                      setAdmissionDraft((current) => ({ ...current, date: event.target.value }))
                    }
                    required
                  />
                </label>
                <label className="form-field form-field--full">
                  <span>Motivo da internação</span>
                  <textarea
                    value={admissionDraft.reason}
                    onChange={(event) =>
                      setAdmissionDraft((current) => ({ ...current, reason: event.target.value }))
                    }
                    rows={3}
                    required
                  />
                </label>
                <div className="button-row button-row--end">
                  <button className="button button--primary" type="submit">
                    Registrar internação
                  </button>
                </div>
              </form>
            </Panel>
            <Panel className="panel--editor panel--editor-secondary">
              <h2>{admissionTransferId ? 'Transferência interna' : 'Movimentações'}</h2>
              {admissionTransferId ? (
                <form className="form-grid form-grid--editor" onSubmit={handleTransferAdmission}>
                  <label className="form-field">
                    <span>Nova unidade</span>
                    <select
                      value={admissionTransferDraft.unit}
                      onChange={(event) =>
                        setAdmissionTransferDraft((current) => ({
                          ...current,
                          unit: event.target.value,
                          bed: '',
                        }))
                      }
                    >
                      {unitOptions.slice(0, 2).map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="form-field">
                    <span>Nova ala</span>
                    <select
                      value={admissionTransferDraft.wing}
                      onChange={(event) =>
                        setAdmissionTransferDraft((current) => ({
                          ...current,
                          wing: event.target.value,
                          bed: '',
                        }))
                      }
                    >
                      {unitWings.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="form-field">
                    <span>Novo leito</span>
                    <select
                      value={admissionTransferDraft.bed}
                      onChange={(event) =>
                        setAdmissionTransferDraft((current) => ({ ...current, bed: event.target.value }))
                      }
                      required
                    >
                      <option value="">Selecione</option>
                      {transferBedOptions.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.room} " {item.bed}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="form-field">
                    <span>Data da transferencia</span>
                    <input
                      type="date"
                      value={admissionTransferDraft.date}
                      onChange={(event) =>
                        setAdmissionTransferDraft((current) => ({ ...current, date: event.target.value }))
                      }
                    />
                  </label>
                  <div className="button-row button-row--end">
                    <button className="button button--ghost" type="button" onClick={() => setAdmissionTransferId(null)}>
                      Cancelar
                    </button>
                    <button className="button button--primary" type="submit">
                      Confirmar transferencia
                    </button>
                  </div>
                </form>
              ) : (
                <EmptyState
                  title="Nenhuma transferência em edição"
                  description="Selecione uma internação abaixo para transferir o paciente entre alas ou leitos."
                />
              )}
            </Panel>
          </div>
          <div className="stack-list">
            {filteredAdmissions.map((item) => (
              <Panel key={item.id}>
                <div className="record-card__header">
                  <div>
                    <h2>{item.patient}</h2>
                    <p>
                      {item.unit} - {item.wing} " {item.bed}
                    </p>
                  </div>
                  <StatusBadge status={item.status} />
                </div>
                <ul className="detail-list">
                  <li>
                    <span>Motivo</span>
                    <strong>{item.reason}</strong>
                  </li>
                  <li>
                    <span>Data de entrada</span>
                    <strong>{formatDate(item.admissionDate)}</strong>
                  </li>
                  <li>
                    <span>Responsável</span>
                    <strong>{item.physician}</strong>
                  </li>
                </ul>
                <div className="button-row">
                  <button className="button button--ghost" type="button" onClick={() => handlePrepareAdmissionTransfer(item)}>
                    Transferir
                  </button>
                  <button className="button button--ghost" type="button" onClick={() => handleMarkDischargeForecast(item)}>
                    Alta prevista
                  </button>
                  <button className="button button--primary" type="button" onClick={() => handleDischargeAdmission(item)}>
                    Dar alta
                  </button>
                </div>
              </Panel>
            ))}
          </div>
        </div>
      )
    }


    if (currentView === 'beds') {
      return <div className="page-grid"><SectionIntro eyebrow="Controle de leitos" title="Disponibilidade por unidade, ala e quarto" description="Mapa de ocupação com status de limpeza, manutenção e reserva." /><div className="metric-grid"><MetricCard label="Leitos disponíveis" value={`${availableBeds}`} detail="Prontos para uso" tone="success" /><MetricCard label="Leitos ocupados" value={`${occupiedBeds}`} detail="Paciente internado ou reservado" tone="accent" /><MetricCard label="Higienização" value={`${beds.filter((item) => item.status === 'Higienização').length}`} detail="Aguardando liberação" tone="warning" /><MetricCard label="Manutenção" value={`${beds.filter((item) => item.status === 'Manutenção').length}`} detail="Bloqueados para uso" /></div><div className="card-grid">{filteredBeds.map((item) => (<Panel key={item.id}><div className="record-card__header"><div><strong>{item.room}</strong><p>{item.unit} - {item.wing}</p></div><StatusBadge status={item.status} /></div><ul className="detail-list"><li><span>Leito</span><strong>{item.bed}</strong></li><li><span>Paciente</span><strong>{item.patient}</strong></li><li><span>ETA higienização</span><strong>{item.cleaningEta}</strong></li></ul></Panel>))}</div></div>
    }

    if (currentView === 'supplies') {
      return <div className="page-grid"><SectionIntro eyebrow="Suprimentos" title="Estoque, mínimo e status de reposição" description="Itens críticos recebem destaque visual e permitem leitura rápida." /><div className="toolbar"><select value={supplyStatusFilter} onChange={(event) => setSupplyStatusFilter(event.target.value)}><option value="Todos">Todos</option><option value="Crítico">Crítico</option><option value="Alerta">Alerta</option><option value="Estável">Estável</option></select></div><div className="content-grid content-grid--wide content-grid--form-aside"><Panel className="panel--accent"><h2>Estoque crítico</h2><p className="lead-text">{criticalSupplies} item(ns) abaixo do limite mínimo.</p><p>Reposição priorizada nas unidades com maior consumo operacional.</p></Panel><Panel><div className="table-wrapper"><table className="data-table data-table--cards"><thead><tr><th>Item</th><th>Categoria</th><th>Unidade</th><th>Estoque</th><th>Status</th></tr></thead><tbody>{filteredSupplies.map((item) => (<tr key={item.id}><td data-label="Item"><strong>{item.item}</strong><span>{item.trend}</span></td><td data-label="Categoria">{item.category}</td><td data-label="Unidade">{item.unit}</td><td data-label="Estoque">{item.stock} / mínimo {item.minStock}</td><td data-label="Status"><StatusBadge status={item.status} /></td></tr>))}</tbody></table></div></Panel></div></div>
    }

    if (currentView === 'finance') {
      return <div className="page-grid"><SectionIntro eyebrow="Relatórios financeiros" title="Receita, despesa e volume assistencial" description="Visão por unidade com comparativos e filtros institucionais." /><div className="metric-grid"><MetricCard label="Receita total" value={formatMoney(totalRevenue)} detail="Soma das unidades filtradas" tone="success" /><MetricCard label="Despesa total" value={formatMoney(totalExpenses)} detail="Custos operacionais simulados" /><MetricCard label="Margem estimada" value={formatMoney(totalRevenue - totalExpenses)} detail="Indicador visual do período" tone="accent" /><MetricCard label="Atendimentos" value={`${filteredFinance.reduce((sum, item) => sum + item.outpatient, 0)}`} detail="Presenciais e exames" tone="warning" /></div><div className="card-grid">{filteredFinance.map((item) => (<Panel key={item.id}><h2>{item.unit}</h2><ul className="detail-list"><li><span>Receita</span><strong>{formatMoney(item.revenue)}</strong></li><li><span>Despesa</span><strong>{formatMoney(item.expenses)}</strong></li><li><span>Atendimentos ambulatoriais</span><strong>{item.outpatient}</strong></li><li><span>Telemedicina</span><strong>{item.telemedicine}</strong></li></ul><div className="bar-row"><span>Ocupação</span><div className="bar-track"><div className="bar-track__fill" style={{ width: `${item.occupancy}%` }} /></div><strong>{item.occupancy}%</strong></div></Panel>))}</div></div>
    }

    if (currentView === 'indicators') {
      return <div className="page-grid"><SectionIntro eyebrow="Indicadores operacionais" title="Gráficos e métricas da instituição" description="Acompanhamento de ocupação, agenda, exames e disponibilidade do sistema." /><div className="card-grid">{units.map((item) => (<Panel key={item.id}><div className="record-card__header"><strong>{item.name}</strong><StatusBadge status={`${item.occupancy}% ocupado`} /></div><div className="bar-row"><span>Ocupação</span><div className="bar-track"><div className="bar-track__fill" style={{ width: `${item.occupancy}%` }} /></div><strong>{item.occupancy}%</strong></div><div className="bar-row"><span>Meta de disponibilidade</span><div className="bar-track"><div className="bar-track__fill bar-track__fill--secondary" style={{ width: '99.5%' }} /></div><strong>{availabilitySnapshot.availability}</strong></div></Panel>))}</div></div>
    }

    if (currentView === 'security') {
      return (
        <div className="page-grid page-grid--management">
          <SectionIntro
            eyebrow="Segurança e auditoria"
            title="Logs críticos e histórico de acessos"
            description="Rastreabilidade das principais ações, com filtros por usuário, perfil, data, ação e módulo."
          />
          <div className="content-grid content-grid--wide content-grid--detail-aside">
            <Panel className="panel--table">
              <div className="toolbar toolbar--dense">
                <input
                  value={auditUserFilter}
                  onChange={(event) => setAuditUserFilter(event.target.value)}
                  placeholder="Filtrar por usuário ou ação"
                />
                <select value={auditProfileFilter} onChange={(event) => setAuditProfileFilter(event.target.value)}>
                  {auditProfileOptions.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                <select value={auditDateFilter} onChange={(event) => setAuditDateFilter(event.target.value)}>
                  {auditDateOptions.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                <select value={auditActionFilter} onChange={(event) => setAuditActionFilter(event.target.value)}>
                  {auditActionOptions.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                <select value={auditModuleFilter} onChange={(event) => setAuditModuleFilter(event.target.value)}>
                  <option value="Todos">Todos os módulos</option>
                  {[...new Set(auditLogs.map((item) => item.module))].map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
              <div className="table-wrapper">
                <table className="data-table data-table--cards">
                  <thead>
                    <tr>
                      <th>Data/Hora</th>
                      <th>Usuário</th>
                      <th>Ação</th>
                      <th>Módulo</th>
                      <th>IP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAuditLogs.map((item) => (
                      <tr
                        key={item.id}
                        className={selectedAuditLogId === item.id ? 'is-selected' : ''}
                        onClick={() => setSelectedAuditLogId(item.id)}
                      >
                        <td data-label="Data e hora">
                          <strong>{item.date}</strong>
                          <span>{item.time}</span>
                        </td>
                        <td data-label="Usuário">
                          {item.user}
                          <span>{item.profile}</span>
                        </td>
                        <td data-label="Ação">{item.action}</td>
                        <td data-label="Módulo">{item.module}</td>
                        <td data-label="IP">{item.ip}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
            <Panel className="panel--accent">
              <h2>Detalhes da ação</h2>
              {selectedAuditLog ? (
                <ul className="detail-list">
                  <li>
                    <span>Usuário</span>
                    <strong>{selectedAuditLog.user}</strong>
                  </li>
                  <li>
                    <span>Perfil</span>
                    <strong>{selectedAuditLog.profile}</strong>
                  </li>
                  <li>
                    <span>Data e hora</span>
                    <strong>
                      {selectedAuditLog.date} - {selectedAuditLog.time}
                    </strong>
                  </li>
                  <li>
                    <span>Ação</span>
                    <strong>{selectedAuditLog.action}</strong>
                  </li>
                  <li>
                    <span>Módulo afetado</span>
                    <strong>{selectedAuditLog.module}</strong>
                  </li>
                  <li>
                    <span>IP fictício</span>
                    <strong>{selectedAuditLog.ip}</strong>
                  </li>
                  <li>
                    <span>Status</span>
                    <strong>{selectedAuditLog.status}</strong>
                  </li>
                </ul>
              ) : (
                <EmptyState
                  title="Nenhum log selecionado"
                  description="Selecione uma linha da auditoria para visualizar os detalhes completos."
                />
              )}
              <h2>Histórico de acessos</h2>
              <div className="stack-list">
                {accessHistoryView.map((item) => (
                  <article key={item.id} className="record-card">
                    <div className="record-card__header">
                      <strong>{item.user}</strong>
                      <StatusBadge status={item.risk} />
                    </div>
                    <p>
                      {item.profile} - {item.lastAccess}
                    </p>
                    <p>{item.device}</p>
                  </article>
                ))}
              </div>
            </Panel>
          </div>
        </div>
      )
    }


    if (currentView === 'permissions') {
      return (
        <div className="page-grid page-grid--management">
          <SectionIntro
            eyebrow="Perfis de acesso"
            title="Usuários de acesso e permissões por módulo"
            description="Gestão administrativa com lista de usuários, edição de cadastro de acesso e liberações efetivas por módulo."
          />
          <div className="metric-grid">
            <MetricCard
              label="Usuários visíveis"
              value={`${filteredPermissionUsers.length}`}
              detail="Cadastros encontrados com os filtros atuais"
              tone="accent"
            />
            <MetricCard
              label="Perfis distintos"
              value={`${permissionProfileOptions.length - 1}`}
              detail="Paciente, profissional e administrador"
              tone="success"
            />
            <MetricCard
              label="Módulos controlados"
              value={`${permissions.length}`}
              detail="Permissões editáveis por usuário"
              tone="warning"
            />
          </div>
          <Panel className="panel--table">
            <div className="toolbar toolbar--dense">
              <select
                value={permissionProfileFilter}
                onChange={(event) => setPermissionProfileFilter(event.target.value)}
              >
                {permissionProfileOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <span className="status-pill">
                {selectedPermissionUser ? `Usuário selecionado: ${selectedPermissionUser.name}` : 'Selecione um usuário'}
              </span>
            </div>
            <div className="table-wrapper">
              <table className="data-table data-table--cards">
                <thead>
                  <tr>
                    <th>Usuário</th>
                    <th>Perfil</th>
                    <th>Unidade</th>
                    <th>Status da conta</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPermissionUsers.map((item) => (
                    <tr
                      key={item.id}
                      className={selectedPermissionUser?.id === item.id ? 'is-selected' : ''}
                    >
                      <td data-label="Usuário">
                        <strong>{item.name}</strong>
                        <span>{item.login}</span>
                      </td>
                      <td data-label="Perfil">{item.profileLabel}</td>
                      <td data-label="Unidade">{item.unit}</td>
                      <td data-label="Status da conta">
                        <StatusBadge status={item.status} />
                      </td>
                      <td data-label="Ações">
                        <div className="button-row">
                          <button
                            className="button button--ghost"
                            type="button"
                            onClick={() => setSelectedPermissionUserId(item.id)}
                          >
                            Editar cadastro
                          </button>
                          <button
                            className="button button--ghost"
                            type="button"
                            onClick={() => setSelectedPermissionUserId(item.id)}
                          >
                            Permissões
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
          <div className="content-grid content-grid--wide content-grid--form-aside permissions-layout">
            {selectedPermissionUser ? (
              <>
                <Panel className="panel--editor">
                  <div className="record-card__header">
                    <div>
                      <h2>Cadastro de acesso</h2>
                      <p>
                        {selectedPermissionUser.profileLabel} - {selectedPermissionUser.scope}
                      </p>
                    </div>
                    <StatusBadge status={selectedPermissionUser.status} />
                  </div>
                  <form className="form-grid form-grid--editor" onSubmit={handleSavePermissionAccessProfile}>
                    <label className="form-field">
                      <span>Nome</span>
                      <input
                        value={permissionAccessDraft.name}
                        onChange={(event) =>
                          setPermissionAccessDraft((current) => ({ ...current, name: event.target.value }))
                        }
                        required
                      />
                    </label>
                    <label className="form-field">
                      <span>Login</span>
                      <input
                        value={permissionAccessDraft.login}
                        onChange={(event) =>
                          setPermissionAccessDraft((current) => ({ ...current, login: event.target.value }))
                        }
                        required
                      />
                    </label>
                    <label className="form-field form-field--full">
                      <span>E-mail</span>
                      <input
                        type="email"
                        value={permissionAccessDraft.email}
                        onChange={(event) =>
                          setPermissionAccessDraft((current) => ({ ...current, email: event.target.value }))
                        }
                        required
                      />
                    </label>
                    <label className="form-field">
                      <span>Unidade vinculada</span>
                      <select
                        value={permissionAccessDraft.unit}
                        onChange={(event) =>
                          setPermissionAccessDraft((current) => ({ ...current, unit: event.target.value }))
                        }
                      >
                        {['Administração central', ...unitOptions].map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="form-field">
                      <span>Status da conta</span>
                      <select
                        value={permissionAccessDraft.status}
                        onChange={(event) =>
                          setPermissionAccessDraft((current) => ({ ...current, status: event.target.value }))
                        }
                      >
                        <option value="Ativo">Ativo</option>
                        <option value="Bloqueado">Bloqueado</option>
                        <option value="Pendente de liberação">Pendente de liberação</option>
                      </select>
                    </label>
                    <div className="button-row button-row--end">
                      <button className="button button--primary" type="submit">
                        Salvar cadastro
                      </button>
                    </div>
                  </form>
                </Panel>
                <Panel className="panel--accent panel--table">
                  <div className="record-card__header">
                    <div>
                      <h2>Permissões por módulo</h2>
                      <p>
                        Ajuste o nível de acesso efetivo de {selectedPermissionUser.name} em cada área do sistema.
                      </p>
                    </div>
                    <StatusBadge status={`${permissionGrantedCount} liberado(s)`} />
                  </div>
                  <div className="table-wrapper">
                    <table className="data-table data-table--cards">
                      <thead>
                        <tr>
                          <th>Módulo</th>
                          <th>Liberação</th>
                          <th>Observação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {permissions.map((item) => (
                          <tr key={item.id}>
                            <td data-label="Módulo">{item.module}</td>
                            <td data-label="Liberação">
                              <select
                                value={permissionModuleDrafts[item.id] ?? ''}
                                onChange={(event) =>
                                  setPermissionModuleDrafts((current) => ({
                                    ...current,
                                    [item.id]: event.target.value,
                                  }))
                                }
                              >
                                {permissionAccessOptions.map((option) => (
                                  <option key={option} value={option}>
                                    {option}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td data-label="Observação">{item.note}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="button-row button-row--end">
                    <button className="button button--primary" type="button" onClick={handleSavePermissionAssignments}>
                      Salvar permissões
                    </button>
                  </div>
                </Panel>
              </>
            ) : (
              <EmptyState
                title="Nenhum usuário selecionado"
                description="Escolha um usuário na lista acima para editar o cadastro e as permissões."
              />
            )}
          </div>
        </div>
      )
    }

    return <div className="page-grid"><SectionIntro eyebrow="Dashboard administrativo" title="Visão institucional da operação VidaPlus" description="Indicadores, disponibilidade, leitos, estoque crítico e múltiplas unidades em um único painel." actions={<div className="button-row"><button className="button button--primary" type="button" onClick={() => navigate('security')}>Abrir auditoria</button><button className="button button--ghost" type="button" onClick={() => navigate('beds')}>Ver leitos</button></div>} /><div className="metric-grid"><MetricCard label="Disponibilidade" value={availabilitySnapshot.availability} detail="Meta institucional representada em tela" tone="success" /><MetricCard label="Último backup" value={availabilitySnapshot.backup} detail="Rastreabilidade visual do protótipo" /><MetricCard label="Leitos ocupados" value={`${occupiedBeds}`} detail="Com controle por unidade e ala" tone="accent" /><MetricCard label="Estoque crítico" value={`${criticalSupplies}`} detail="Itens abaixo do estoque mínimo" tone="warning" /></div><div className="content-grid content-grid--wide"><Panel className="panel--accent"><h2>Status dos módulos críticos</h2><div className="stack-list">{moduleStatuses.map((item) => (<article key={item.id} className="record-card"><div className="record-card__header"><strong>{item.name}</strong><StatusBadge status={item.status} /></div><p>Latência percebida: {item.latency}</p></article>))}</div></Panel><Panel><h2>Indicadores por unidade</h2>{units.map((item) => (<div key={item.id} className="bar-row"><span>{item.name}</span><div className="bar-track"><div className="bar-track__fill" style={{ width: `${item.occupancy}%` }} /></div><strong>{item.occupancy}%</strong></div>))}</Panel></div></div>
  }

  function renderWorkspaceContent() {
    if (sessionProfile === 'patient') return renderPatientView()
    if (sessionProfile === 'professional') return renderProfessionalView()
    return renderAdminView()
  }

  return (
    <>
      {sessionProfile ? (
        <div className="workspace-shell">
          <aside className={`sidebar ${mobileMenuOpen ? 'is-open' : ''}`}>
            <div className="sidebar__brand">
              <span className="brand-badge">SGHSS VidaPlus</span>
              <h2>{activeMeta.label}</h2>
              <p>{activeMeta.description}</p>
            </div>
            <nav className="sidebar__nav" aria-label="Menu lateral">
              {visibleSidebarMenu.map((item: MenuItem) => (
                <button key={item.key} type="button" className={`sidebar__item ${currentView === item.key ? 'is-active' : ''}`} onClick={() => navigate(item.key)}><strong>{item.label}</strong><span>{item.description}</span></button>
              ))}
            </nav>
          </aside>
          <button type="button" className={`sidebar-backdrop ${mobileMenuOpen ? 'is-open' : ''}`} aria-label="Fechar menu" onClick={() => setMobileMenuOpen(false)} />
          <main className="main-shell">
            <header className="topbar topbar--workspace">
              <div className="topbar__heading topbar__heading--workspace">
                <button
                  className="button button--ghost topbar__menu-button"
                  type="button"
                  aria-label="Abrir menu lateral"
                  onClick={() => setMobileMenuOpen(true)}
                >
                  <span className="topbar__menu-icon" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </span>
                  <span className="sr-only">Abrir menu</span>
                </button>
                <div className="topbar__identity">
                  <span className="section-intro__eyebrow">{activeMeta.label}</span>
                  <strong>{workspaceContextTitle}</strong>
                  <p>{workspaceContextDescription}</p>
                </div>
              </div>
              <div className="topbar__controls topbar__controls--workspace">
                <label className="search-field search-field--compact">
                  <span className="sr-only">Pesquisar</span>
                  <input
                    value={globalSearch}
                    onChange={(event) => setGlobalSearch(event.target.value)}
                    placeholder={workspaceSearchPlaceholder}
                  />
                </label>
                {isAdminSession ? (
                  <select
                    className="topbar__unit-filter"
                    value={unitFilter}
                    onChange={(event) => setUnitFilter(event.target.value)}
                  >
                    <option value="Todas as unidades">Todas as unidades</option>
                    {units.map((item) => (
                      <option key={item.id} value={item.name}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                ) : null}
                <div
                  className={`topbar__menu-group ${quickMenuOpen ? 'is-open' : ''}`}
                  ref={quickMenuRef}
                >
                  <button
                    className="button button--ghost topbar__dropdown-trigger"
                    type="button"
                    aria-haspopup="menu"
                    aria-expanded={quickMenuOpen}
                    aria-label={`Abrir menu do usuário ${sessionUserName(sessionProfile)}`}
                    onClick={() => setQuickMenuOpen((current) => !current)}
                  >
                    <span className="sr-only">{activeMeta.label}</span>
                    <span className="topbar__launcher-grid" aria-hidden="true">
                      {Array.from({ length: 9 }).map((_, index) => (
                        <span key={index} className="topbar__launcher-dot" />
                      ))}
                    </span>
                  </button>
                  {quickMenuOpen ? (
                    <div className="topbar__dropdown" role="menu" aria-label={`Atalhos do perfil ${activeMeta.label}`}>
                      <div className="topbar__dropdown-header">
                        <span className="section-intro__eyebrow">{activeMeta.label}</span>
                        <strong>{sessionUserName(sessionProfile)}</strong>
                        <p>{activeQuickMenuConfig.title}</p>
                      </div>
                      <div className="topbar__dropdown-list">
                        {quickMenuItems.map((item) => (
                          <button
                            key={item.key}
                            className={`topbar__dropdown-item ${currentView === item.key ? 'is-active' : ''}`}
                            type="button"
                            role="menuitem"
                            onClick={() => navigate(item.key)}
                          >
                            <strong>{item.label}</strong>
                            <span>{item.description}</span>
                          </button>
                        ))}
                      </div>
                      <button
                        className="topbar__dropdown-item topbar__dropdown-item--danger"
                        type="button"
                        role="menuitem"
                        onClick={resetSession}
                      >
                        <strong>Encerrar sessão</strong>
                        <span>Sair do ambiente atual com segurança.</span>
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </header>
            <div className="page-shell">{renderWorkspaceContent()}</div>
          </main>
        </div>
      ) : (
        <div className="auth-shell auth-shell--minimal">
          <aside className="auth-hero">
            <div className="auth-hero__copy">
              <span className="brand-badge">VidaPlus</span>
              <h1>SGHSS</h1>
              <p>
                Ambiente acadêmico de gestão hospitalar com acesso por perfil e navegação guiada.
              </p>
            </div>

            <div className="auth-hero__summary">
              <div className="auth-summary-pill">
                <span>Acesso</span>
                <strong>Paciente, profissional e administrador</strong>
              </div>
              <div className="auth-summary-pill">
                <span>Uso</span>
                <strong>Dados fictícios para demonstração</strong>
              </div>
            </div>

            <div className="auth-hero__guide">
              <div className="auth-guide-card">
                <strong>Fluxo simples</strong>
                <p>Escolha o perfil, entre e navegue pelos módulos principais do sistema.</p>
              </div>
              <div className="auth-guide-card">
                <strong>Sem excesso de contexto</strong>
                <p>Somente o necessário antes do acesso para facilitar a decisão do usuário.</p>
              </div>
            </div>

            <div className="auth-hero__preview">
              <div className="auth-preview__topbar">
                <div>
                  <span className="auth-preview__eyebrow">Central assistencial</span>
                  <strong>Painel operacional VidaPlus</strong>
                </div>
                <StatusBadge status="Operação estável" />
              </div>

              <div className="auth-preview__metrics">
                <article className="auth-preview__metric">
                  <span>Próxima consulta</span>
                  <strong>{upcomingAppointments[0].time}</strong>
                  <p>{upcomingAppointments[0].specialty}</p>
                </article>
                <article className="auth-preview__metric">
                  <span>Exames pendentes</span>
                  <strong>{pendingExams}</strong>
                  <p>Com preparo e lembretes</p>
                </article>
                <article className="auth-preview__metric">
                  <span>Leitos livres</span>
                  <strong>{availableBeds}</strong>
                  <p>Prontos para alocação</p>
                </article>
                <article className="auth-preview__metric">
                  <span>Estoque crítico</span>
                  <strong>{criticalSupplies}</strong>
                  <p>Reposição priorizada</p>
                </article>
              </div>

              <div className="auth-preview__board">
                <div className="auth-preview__column">
                  <div className="auth-preview__card auth-preview__card--strong">
                    <span>Fluxos cobertos</span>
                    <strong>Consultas, telemedicina, prontuário e auditoria</strong>
                    <p>Navegação clicável por perfil com dados fictícios e feedback visual.</p>
                  </div>
                  <div className="auth-preview__card">
                    <span>Consulta em destaque</span>
                    <strong>
                      {upcomingAppointments[0].professional} - {upcomingAppointments[0].modality}
                    </strong>
                    <p>
                      {upcomingAppointments[0].unit} - {formatDate(upcomingAppointments[0].date)}
                    </p>
                  </div>
                </div>

                <div className="auth-preview__column">
                  <div className="auth-preview__module-list">
                    {moduleStatuses.slice(0, 4).map((item) => (
                      <div key={item.id} className="auth-preview__module-item">
                        <div>
                          <strong>{item.name}</strong>
                          <span>{item.latency}</span>
                        </div>
                        <StatusBadge status={item.status} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </aside>

          <main className="auth-card auth-card--minimal">{renderAuthContent()}</main>
        </div>
      )}

      {feedback ? <div className={`toast toast--${feedback.tone}`} role="status" aria-live="polite">{feedback.message}</div> : null}

      {dialog ? <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><div className="modal-card"><h2 id="dialog-title">{dialog.title}</h2><p>{dialog.description}</p><div className="button-row button-row--end"><button className="button button--ghost" type="button" onClick={() => setDialog(null)}>Fechar</button><button className="button button--primary" type="button" onClick={() => { dialog.onConfirm(); setDialog(null) }}>{dialog.confirmLabel}</button></div></div></div> : null}
    </>
  )
}

export default App
