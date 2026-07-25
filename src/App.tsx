import { lazy, Suspense, useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Clock,
  Coffee,
  Users,
  FileText,
  LogOut,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ShieldCheck,
  AlertCircle,
  Calendar,
  BookOpen,
  Sun,
  Moon,
  Menu,
  X,
  LayoutDashboard,
  FileSpreadsheet,
  BarChart,
  Settings,
  ExternalLink,
  ClipboardList
} from 'lucide-react';
import { User } from 'firebase/auth';
import { 
  auth,
  initAuth, 
  googleSignIn, 
  logout,
  upsertSession,
  deleteSession,
  listenToSessions,
  upsertBreak,
  listenToBreaks,
  upsertCloudRecord,
  listenToCloudCollection,
  signInAnonymouslyIfNeeded,
  saveSpreadsheetConfig,
  listenToSpreadsheetConfig,
  savePersonalPreferences,
  listenToPersonalPreferences,
  isFirebaseEnabled
} from './firebase';
import {
  createAndExportRosterToSheet,
  updateRosterInSheet,
  fetchRosterFromSheet,
  appendRowToSheet,
  syncSpecificDayToSheet,
  updateGoogleDocLive,
  fetchAgentCredentialsFromSheet
} from './workspace';
import { CRMContact, SupportTicket, RosterDay, AgentCredential, LiveAgentSession, KBArticle } from './types';
import { parsePastedRoster } from './pastedRoster';

// Modular Sections
const DashboardSection = lazy(() => import('./components/DashboardSection'));
const CrmSection = lazy(() => import('./components/CrmSection'));
const KbSection = lazy(() => import('./components/KbSection'));
const AdminSection = lazy(() => import('./components/AdminSection'));
const RosterSection = lazy(() => import('./components/RosterSection'));
const ReportsSection = lazy(() => import('./components/ReportsSection'));
const SettingsSection = lazy(() => import('./components/SettingsSection'));
const CsTicketFormSection = lazy(() => import('./components/CsTicketFormSection'));
const AuthGatewayModal = lazy(() => import('./components/AuthGatewayModal'));
const SystemTroubleshooting = lazy(() => import('./components/SystemTroubleshooting'));

export const AGENTS_LIST = [
  { name: "Israt Jahan Mim", isMale: false },
  { name: "Nasrin Sultana Shelu", isMale: false },
  { name: "Farzana Farha", isMale: false },
  { name: "Md Rakib Mia", isMale: true },
  { name: "Tanjila Akter", isMale: false },
  { name: "Jakia Afrin", isMale: false },
  { name: "Zakia Sultana", isMale: false },
  { name: "Md. Sumon Islam Bhuyan", isMale: true },
  { name: "Baharul Amin Riham", isMale: true },
  { name: "Rokonuzzaman Kazol", isMale: true },
  { name: "Solayman Khalek", isMale: true },
  { name: "Susmita Ranjon Shaha", isMale: false },
  { name: "Md Lokman Hossain Likhon", isMale: true },
  { name: "Shiekh Nazibul Islam Nemon", isMale: true },
  { name: "Zahir Uddin Miah", isMale: true },
  { name: "Fatema Akter Bithi", isMale: false },
  { name: "Ferdous ara", isMale: false },
  { name: "Woendi Bazi", isMale: false },
  { name: "Badhan Biswas", isMale: true },
  { name: "Shubha Saha", isMale: false },
  { name: "Shahadat Hosain Shakil", isMale: true },
  { name: "Chinmoy Mohanto", isMale: true },
  { name: "Tania Tawhida Azad", isMale: false },
  { name: "Afsana Tabassum Jui", isMale: false },
  { name: "Mr Muzzam Hossen Rony", isMale: true },
  { name: "MD. Towhid Elahi", isMale: true },
  { name: "MD. Rifat Hossain", isMale: true },
  { name: "Md.Masum Billa", isMale: true },
  { name: "Umme Hany Sinthia", isMale: false },
  { name: "Ahfra yesmin luba", isMale: false },
  { name: "Ayisha Siddika Jim", isMale: false },
  { name: "Trisha Saha", isMale: false },
  { name: "Abdullah al saeed", isMale: true },
  { name: "Kazi Iqbal Hossain", isMale: true },
  { name: "Riad Hasan", isMale: true },
  { name: "Ishtiaque Abdul Quyyum", isMale: true },
  { name: "Aminul Islam Rabbi", isMale: true },
  { name: "Shawon Rozario", isMale: true },
  { name: "Sadi MD.Imran", isMale: true },
  { name: "Nusrat Jahan Munia", isMale: false },
  { name: "Nazim Uddin", isMale: true },
  { name: "Mahi Shahriar Khan", isMale: true },
  { name: "Alodi Marak", isMale: false },
  { name: "Asaduzzaman Safi", isMale: true },
  { name: "Shahariar Sabbir", isMale: true }
];

export const getBreakLimitMinutes = (breakType: string): number => {
  const typeLower = breakType.toLowerCase();
  if (typeLower.includes('short') || typeLower.includes('prayer') || typeLower.includes('coffee')) {
    return 15;
  }
  if (typeLower.includes('meal') || typeLower.includes('lunch')) {
    return 30;
  }
  return 0; // 0 represents no active limit (e.g. meetings)
};

export const isBreakOverrun = (breakType: string, durationSeconds: number): boolean => {
  const limitMin = getBreakLimitMinutes(breakType);
  if (limitMin === 0) return false;
  return durationSeconds > limitMin * 60;
};

interface AgentSelectProps {
  value: string;
  onChange: (val: string) => void;
}

function AgentSelect({ value, onChange }: AgentSelectProps) {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filtered = AGENTS_LIST.filter(agent => 
    agent.name.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (name: string) => {
    onChange(name);
    setSearch(name);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef} id="agent_searchable_dropdown">
      <div className="relative">
        <input
          type="text"
          placeholder="Search and select agent..."
          value={isOpen ? search : (value || search)}
          onChange={(e) => {
            setSearch(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            setIsOpen(true);
            setSearch('');
          }}
          className="w-full bg-zinc-950 border border-zinc-850 rounded-lg pl-3 pr-10 py-2.5 text-xs text-zinc-300 focus:outline-none focus:border-amber-500 font-sans placeholder:text-zinc-650 focus:ring-1 focus:ring-amber-500"
          id="agent_login_search_input"
        />
        {(value || search) && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setSearch('');
              onChange('');
            }}
            className="absolute right-2.5 top-2.5 text-zinc-500 hover:text-zinc-300 p-1 cursor-pointer"
            id="agent_login_search_clear"
            title="Clear search and selection"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {isOpen && (
        <div className="absolute left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl z-50 divide-y divide-zinc-950 animate-fadeIn">
          {filtered.length > 0 ? (
            filtered.map((agent) => (
              <button
                key={agent.name}
                type="button"
                onClick={() => handleSelect(agent.name)}
                className={`w-full text-left px-3 py-2 text-xs transition-colors flex items-center justify-between hover:bg-zinc-850 cursor-pointer ${
                  value === agent.name ? 'text-amber-500 bg-zinc-800/60 font-bold' : 'text-zinc-300'
                }`}
              >
                <span>{agent.name}</span>
                <span className={`text-[10px] uppercase font-mono ${agent.isMale ? 'text-blue-400' : 'text-pink-400'}`}>
                  {agent.isMale ? 'Male' : 'Female'}
                </span>
              </button>
            ))
          ) : (
            <div className="px-3 py-3 text-xs text-zinc-500 italic text-center">
              No matching agents found
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const isInIframe = typeof window !== 'undefined' && window.self !== window.top;
  const initialDataRef = useRef<{ contacts: CRMContact[]; tickets: SupportTicket[]; kbArticles: KBArticle[] }>({
    contacts: [],
    tickets: [],
    kbArticles: [],
  });

  // Authentication states
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showAuthWarning, setShowAuthWarning] = useState(false);
  const [isAuthGatewayOpen, setIsAuthGatewayOpen] = useState(false);

  // Theme state: dark by default
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('theme_preference');
    if (saved) {
      return saved === 'dark';
    }
    return true; 
  });

  useEffect(() => {
    localStorage.setItem('theme_preference', isDarkMode ? 'dark' : 'light');
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Portal login states
  const [isPortalLoggedIn, setIsPortalLoggedIn] = useState<boolean>(() => {
    return localStorage.getItem('csp_portal_logged_in') === 'true';
  });

  const [agentName, setAgentName] = useState<string>(() => {
    return localStorage.getItem('csp_agent_name') || '';
  });

  // Current logged in user object
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string; role: 'AGENT' | 'ADMIN' } | null>(() => {
    const isLogged = localStorage.getItem('csp_portal_logged_in') === 'true';
    if (isLogged) {
      return {
        id: localStorage.getItem('csp_logged_in_agent_id') || 'agent01',
        name: localStorage.getItem('csp_agent_name') || '',
        role: (localStorage.getItem('csp_user_role') as 'AGENT' | 'ADMIN') || 'AGENT'
      };
    }
    return null;
  });

  const [isDataHydrated, setIsDataHydrated] = useState(false);

  // Agent Credentials state
  const [agentCredentials, setAgentCredentials] = useState<AgentCredential[]>(() => {
    const saved = localStorage.getItem('csp_agent_credentials');
    const defaultAdmin: AgentCredential = { agentId: 'admin', passwordHash: 'admin123', name: 'Administrator', role: 'ADMIN' };
    if (saved) {
      try {
        const cached = JSON.parse(saved) as AgentCredential[];
        if (Array.isArray(cached) && cached.length > 0) {
          const hasAdmin = cached.some((credential) => credential.agentId.toLowerCase().trim() === 'admin');
          return hasAdmin ? cached : [defaultAdmin, ...cached];
        }
      } catch (error) {
        console.error('Error parsing cached agent credentials', error);
      }
    }

    // Keep the first login usable on a new/shared browser. Credentials created
    // by an administrator are still preferred whenever a local cache exists.
    const seed: AgentCredential[] = [
      defaultAdmin
    ];
    AGENTS_LIST.forEach((agent, index) => {
      const padIndex = String(index + 1).padStart(2, '0');
      seed.push({
        agentId: `agent${padIndex}`,
        passwordHash: 'agent123',
        name: agent.name,
        role: 'AGENT'
      });
    });
    return seed;
  });

  useEffect(() => {
    localStorage.setItem('csp_agent_credentials', JSON.stringify(agentCredentials));
  }, [agentCredentials]);

  // Load only user-saved local cache. Firestore listeners hydrate cloud data after authentication.
  useEffect(() => {
    const readCache = <T,>(key: string): T[] => {
      try {
        const value = localStorage.getItem(key);
        return value ? (JSON.parse(value) as T[]) : [];
      } catch {
        return [];
      }
    };
    const contactsCache = readCache<CRMContact>('csp_contacts');
    const ticketsCache = readCache<SupportTicket>('csp_tickets');
    const kbCache = readCache<KBArticle>('csp_kb_articles');
    initialDataRef.current = { contacts: contactsCache, tickets: ticketsCache, kbArticles: kbCache };
    setContacts(contactsCache);
    setTickets(ticketsCache);
    setKbArticles(kbCache);
    setIsDataHydrated(true);
  }, []);

  // Login form states
  const [loginRole, setLoginRole] = useState<'AGENT' | 'ADMIN'>('AGENT');
  const [loginAgentId, setLoginAgentId] = useState('');
  const [loginAgentPass, setLoginAgentPass] = useState('');
  const [loginAdminUser, setLoginAdminUser] = useState('');
  const [loginAdminPass, setLoginAdminPass] = useState('');
  const [loginError, setLoginError] = useState('');

  // Admin and Role states
  const [userRole, setUserRole] = useState<'AGENT' | 'ADMIN'>(() => {
    return (localStorage.getItem('csp_user_role') as 'AGENT' | 'ADMIN') || 'AGENT';
  });

  // Active navigation tab
  const [activeTab, setActiveTab] = useState<'dashboard' | 'tickets' | 'cs_ticket_form' | 'crm' | 'reports' | 'kb' | 'roster' | 'system_troubleshooting' | 'admin_portal' | 'settings'>(() => {
    const saved = localStorage.getItem('csp_active_tab');
    if (saved) return saved as any;
    return 'dashboard';
  });

  useEffect(() => {
    localStorage.setItem('csp_active_tab', activeTab);
  }, [activeTab]);

  // Collapsible sidebar
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    const aid = localStorage.getItem('csp_logged_in_agent_id') || 'agent01';
    const compactSaved = localStorage.getItem(`csp_${aid}_compact_sidebar`);
    if (compactSaved !== null) {
      return compactSaved === 'true';
    }
    return localStorage.getItem('csp_sidebar_collapsed') === 'true';
  });

  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  const isExpanded = !isSidebarCollapsed || isSidebarHovered;

  useEffect(() => {
    localStorage.setItem('csp_sidebar_collapsed', String(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Personal Preference States
  const [autoClockIn, setAutoClockIn] = useState<boolean>(() => {
    const aid = localStorage.getItem('csp_logged_in_agent_id') || 'agent01';
    return localStorage.getItem(`csp_${aid}_auto_clock_in`) === 'true';
  });

  const [audioNotifications, setAudioNotifications] = useState<boolean>(() => {
    const aid = localStorage.getItem('csp_logged_in_agent_id') || 'agent01';
    return localStorage.getItem(`csp_${aid}_audio_notifications`) !== 'false';
  });

  const [compactSidebar, setCompactSidebar] = useState<boolean>(() => {
    const aid = localStorage.getItem('csp_logged_in_agent_id') || 'agent01';
    return localStorage.getItem(`csp_${aid}_compact_sidebar`) === 'true';
  });

  const [showWarnings, setShowWarnings] = useState<boolean>(() => {
    const aid = localStorage.getItem('csp_logged_in_agent_id') || 'agent01';
    return localStorage.getItem(`csp_${aid}_show_warnings`) !== 'false';
  });

  const [customAlias, setCustomAlias] = useState<string>(() => {
    const aid = localStorage.getItem('csp_logged_in_agent_id') || 'agent01';
    return localStorage.getItem(`csp_${aid}_custom_alias`) || '';
  });

  // Time metrics tracking
  const [currentTime, setCurrentTime] = useState(new Date());
  
  const [isCheckedIn, setIsCheckedIn] = useState<boolean>(() => {
    const aid = localStorage.getItem('csp_logged_in_agent_id') || 'agent01';
    return localStorage.getItem(`csp_${aid}_is_checked_in`) === 'true';
  });

  const [isOnBreak, setIsOnBreak] = useState<boolean>(() => {
    const aid = localStorage.getItem('csp_logged_in_agent_id') || 'agent01';
    return localStorage.getItem(`csp_${aid}_is_on_break`) === 'true';
  });

  const [shiftStartTime, setShiftStartTime] = useState<string | null>(() => {
    const aid = localStorage.getItem('csp_logged_in_agent_id') || 'agent01';
    return localStorage.getItem(`csp_${aid}_shift_start_time`);
  });

  const [breakStartTime, setBreakStartTime] = useState<string | null>(() => {
    const aid = localStorage.getItem('csp_logged_in_agent_id') || 'agent01';
    return localStorage.getItem(`csp_${aid}_break_start_time`);
  });

  const [breakReason, setBreakReason] = useState<string>(() => {
    const aid = localStorage.getItem('csp_logged_in_agent_id') || 'agent01';
    return localStorage.getItem(`csp_${aid}_break_reason`) || 'Short Break';
  });

  // Operational states for UI and metrics
  const [agentStatus, setAgentStatus] = useState<'AVAILABLE' | 'ON BREAK' | 'OFFLINE'>(() => {
    const aid = localStorage.getItem('csp_logged_in_agent_id') || 'agent01';
    const checkedIn = localStorage.getItem(`csp_${aid}_is_checked_in`) === 'true';
    const onBreak = localStorage.getItem(`csp_${aid}_is_on_break`) === 'true';
    if (!checkedIn) return 'OFFLINE';
    return onBreak ? 'ON BREAK' : 'AVAILABLE';
  });

  const [currentActivity, setCurrentActivity] = useState<string>(() => {
    const aid = localStorage.getItem('csp_logged_in_agent_id') || 'agent01';
    return localStorage.getItem(`csp_${aid}_current_activity`) || 'standby';
  });

  // Individual session counters
  const [shiftTimer, setShiftTimer] = useState<number>(() => {
    const aid = localStorage.getItem('csp_logged_in_agent_id') || 'agent01';
    const todayStr = new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0') + '-' + String(new Date().getDate()).padStart(2, '0');
    const savedDate = localStorage.getItem(`csp_${aid}_timer_shift_date`);
    if (savedDate === todayStr) {
      const isCheckedInNow = localStorage.getItem(`csp_${aid}_is_checked_in`) === 'true';
      const startTs = Number(localStorage.getItem(`csp_${aid}_shift_start_timestamp`) || '0');
      const accum = Number(localStorage.getItem(`csp_${aid}_accumulated_before`) || '0');
      if (isCheckedInNow && startTs > 0) {
        return accum + Math.floor((Date.now() - startTs) / 1000);
      }
      return Number(localStorage.getItem(`csp_${aid}_timer_shift`) || '0');
    }
    return 0;
  });
  const [shortBreakTimer, setShortBreakTimer] = useState<number>(() => {
    const aid = localStorage.getItem('csp_logged_in_agent_id') || 'agent01';
    const todayStr = new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0') + '-' + String(new Date().getDate()).padStart(2, '0');
    const savedDate = localStorage.getItem(`csp_${aid}_timer_shift_date`);
    if (savedDate === todayStr) {
      return Number(localStorage.getItem(`csp_${aid}_timer_short_break`) || '0');
    }
    return 0;
  });
  const [mealBreakTimer, setMealBreakTimer] = useState<number>(() => {
    const aid = localStorage.getItem('csp_logged_in_agent_id') || 'agent01';
    const todayStr = new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0') + '-' + String(new Date().getDate()).padStart(2, '0');
    const savedDate = localStorage.getItem(`csp_${aid}_timer_shift_date`);
    if (savedDate === todayStr) {
      return Number(localStorage.getItem(`csp_${aid}_timer_meal_break`) || '0');
    }
    return 0;
  });
  const [prayerBreakTimer, setPrayerBreakTimer] = useState<number>(() => {
    const aid = localStorage.getItem('csp_logged_in_agent_id') || 'agent01';
    const todayStr = new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0') + '-' + String(new Date().getDate()).padStart(2, '0');
    const savedDate = localStorage.getItem(`csp_${aid}_timer_shift_date`);
    if (savedDate === todayStr) {
      return Number(localStorage.getItem(`csp_${aid}_timer_prayer_break`) || '0');
    }
    return 0;
  });
  const [meetingTimer, setMeetingTimer] = useState<number>(() => {
    const aid = localStorage.getItem('csp_logged_in_agent_id') || 'agent01';
    const todayStr = new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0') + '-' + String(new Date().getDate()).padStart(2, '0');
    const savedDate = localStorage.getItem(`csp_${aid}_timer_shift_date`);
    if (savedDate === todayStr) {
      return Number(localStorage.getItem(`csp_${aid}_timer_meeting`) || '0');
    }
    return 0;
  });

  const [inboundTimer, setInboundTimer] = useState<number>(() => {
    const aid = localStorage.getItem('csp_logged_in_agent_id') || 'agent01';
    const todayStr = new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0') + '-' + String(new Date().getDate()).padStart(2, '0');
    const savedDate = localStorage.getItem(`csp_${aid}_timer_shift_date`);
    if (savedDate === todayStr) {
      return Number(localStorage.getItem(`csp_${aid}_timer_inbound`) || '0');
    }
    return 0;
  });
  const [outboundTimer, setOutboundTimer] = useState<number>(() => {
    const aid = localStorage.getItem('csp_logged_in_agent_id') || 'agent01';
    const todayStr = new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0') + '-' + String(new Date().getDate()).padStart(2, '0');
    const savedDate = localStorage.getItem(`csp_${aid}_timer_shift_date`);
    if (savedDate === todayStr) {
      return Number(localStorage.getItem(`csp_${aid}_timer_outbound`) || '0');
    }
    return 0;
  });
  const [liveChatTimer, setLiveChatTimer] = useState<number>(() => {
    const aid = localStorage.getItem('csp_logged_in_agent_id') || 'agent01';
    const todayStr = new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0') + '-' + String(new Date().getDate()).padStart(2, '0');
    const savedDate = localStorage.getItem(`csp_${aid}_timer_shift_date`);
    if (savedDate === todayStr) {
      return Number(localStorage.getItem(`csp_${aid}_timer_live_chat`) || '0');
    }
    return 0;
  });
  const [irSupportTimer, setIrSupportTimer] = useState<number>(() => {
    const aid = localStorage.getItem('csp_logged_in_agent_id') || 'agent01';
    const todayStr = new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0') + '-' + String(new Date().getDate()).padStart(2, '0');
    const savedDate = localStorage.getItem(`csp_${aid}_timer_shift_date`);
    if (savedDate === todayStr) {
      return Number(localStorage.getItem(`csp_${aid}_timer_ir_support`) || '0');
    }
    return 0;
  });

  // Break duration tracking
  const [breakTimer, setBreakTimer] = useState<number>(() => {
    const aid = localStorage.getItem('csp_logged_in_agent_id') || 'agent01';
    const todayStr = new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0') + '-' + String(new Date().getDate()).padStart(2, '0');
    const savedDate = localStorage.getItem(`csp_${aid}_timer_shift_date`);
    if (savedDate === todayStr) {
      return Number(localStorage.getItem(`csp_${aid}_timer_break_active`) || '0');
    }
    return 0;
  });

  // Helper to load states dynamically when active agent switches
  const loadAgentLocalState = (agentId: string) => {
    setIsCheckedIn(localStorage.getItem(`csp_${agentId}_is_checked_in`) === 'true');
    setIsOnBreak(localStorage.getItem(`csp_${agentId}_is_on_break`) === 'true');
    setShiftStartTime(localStorage.getItem(`csp_${agentId}_shift_start_time`) || null);
    setBreakStartTime(localStorage.getItem(`csp_${agentId}_break_start_time`) || null);
    setBreakReason(localStorage.getItem(`csp_${agentId}_break_reason`) || 'Short Break');
    setAgentStatus(() => {
      const checkedIn = localStorage.getItem(`csp_${agentId}_is_checked_in`) === 'true';
      const onBreak = localStorage.getItem(`csp_${agentId}_is_on_break`) === 'true';
      if (!checkedIn) return 'OFFLINE';
      return onBreak ? 'ON BREAK' : 'AVAILABLE';
    });
    setCurrentActivity(localStorage.getItem(`csp_${agentId}_current_activity`) || 'standby');

    // Load agent-specific personal preferences
    const savedDarkMode = localStorage.getItem(`csp_${agentId}_is_dark_mode`);
    if (savedDarkMode !== null) {
      setIsDarkMode(savedDarkMode === 'true');
    } else {
      const globalSaved = localStorage.getItem('theme_preference');
      setIsDarkMode(globalSaved === null ? true : globalSaved === 'dark');
    }
    setAutoClockIn(localStorage.getItem(`csp_${agentId}_auto_clock_in`) === 'true');
    setAudioNotifications(localStorage.getItem(`csp_${agentId}_audio_notifications`) !== 'false');
    const compactVal = localStorage.getItem(`csp_${agentId}_compact_sidebar`) === 'true';
    setCompactSidebar(compactVal);
    setIsSidebarCollapsed(compactVal);
    setShowWarnings(localStorage.getItem(`csp_${agentId}_show_warnings`) !== 'false');
    const aliasVal = localStorage.getItem(`csp_${agentId}_custom_alias`) || '';
    setCustomAlias(aliasVal);
    if (aliasVal.trim()) {
      setAgentName(aliasVal.trim());
    } else {
      // fallback to original name
      const found = AGENTS_LIST.find(a => a.name === localStorage.getItem('csp_agent_name'));
      if (found) {
        setAgentName(found.name);
      }
    }

    const todayStr = new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0') + '-' + String(new Date().getDate()).padStart(2, '0');
    const savedDate = localStorage.getItem(`csp_${agentId}_timer_shift_date`);
    if (savedDate === todayStr) {
      const isCheckedInNow = localStorage.getItem(`csp_${agentId}_is_checked_in`) === 'true';
      const startTs = Number(localStorage.getItem(`csp_${agentId}_shift_start_timestamp`) || '0');
      const accum = Number(localStorage.getItem(`csp_${agentId}_accumulated_before`) || '0');
      if (isCheckedInNow && startTs > 0) {
        setShiftTimer(accum + Math.floor((Date.now() - startTs) / 1000));
      } else {
        setShiftTimer(Number(localStorage.getItem(`csp_${agentId}_timer_shift`) || '0'));
      }
      setShortBreakTimer(Number(localStorage.getItem(`csp_${agentId}_timer_short_break`) || '0'));
      setMealBreakTimer(Number(localStorage.getItem(`csp_${agentId}_timer_meal_break`) || '0'));
      setPrayerBreakTimer(Number(localStorage.getItem(`csp_${agentId}_timer_prayer_break`) || '0'));
      setMeetingTimer(Number(localStorage.getItem(`csp_${agentId}_timer_meeting`) || '0'));
      setInboundTimer(Number(localStorage.getItem(`csp_${agentId}_timer_inbound`) || '0'));
      setOutboundTimer(Number(localStorage.getItem(`csp_${agentId}_timer_outbound`) || '0'));
      setLiveChatTimer(Number(localStorage.getItem(`csp_${agentId}_timer_live_chat`) || '0'));
      setIrSupportTimer(Number(localStorage.getItem(`csp_${agentId}_timer_ir_support`) || '0'));
      setBreakTimer(Number(localStorage.getItem(`csp_${agentId}_timer_break_active`) || '0'));
    } else {
      setShiftTimer(0);
      setShortBreakTimer(0);
      setMealBreakTimer(0);
      setPrayerBreakTimer(0);
      setMeetingTimer(0);
      setInboundTimer(0);
      setOutboundTimer(0);
      setLiveChatTimer(0);
      setIrSupportTimer(0);
      setBreakTimer(0);
      localStorage.setItem(`csp_${agentId}_timer_shift_date`, todayStr);
      localStorage.removeItem(`csp_${agentId}_shift_start_timestamp`);
      localStorage.setItem(`csp_${agentId}_accumulated_before`, '0');
    }
  };

  useEffect(() => {
    if (currentUser) {
      loadAgentLocalState(currentUser.id);
    }
  }, [currentUser?.id]);

  // Syncing operational local storage parameters
  useEffect(() => {
    const aid = currentUser?.id || localStorage.getItem('csp_logged_in_agent_id') || 'agent01';
    localStorage.setItem(`csp_${aid}_is_checked_in`, String(isCheckedIn));
    localStorage.setItem(`csp_${aid}_is_on_break`, String(isOnBreak));
    localStorage.setItem(`csp_${aid}_shift_start_time`, shiftStartTime || '');
    localStorage.setItem(`csp_${aid}_break_start_time`, breakStartTime || '');
    localStorage.setItem(`csp_${aid}_break_reason`, breakReason);
    localStorage.setItem(`csp_${aid}_current_activity`, currentActivity);

    localStorage.setItem(`csp_${aid}_timer_shift`, String(shiftTimer));
    localStorage.setItem(`csp_${aid}_timer_short_break`, String(shortBreakTimer));
    localStorage.setItem(`csp_${aid}_timer_meal_break`, String(mealBreakTimer));
    localStorage.setItem(`csp_${aid}_timer_prayer_break`, String(prayerBreakTimer));
    localStorage.setItem(`csp_${aid}_timer_meeting`, String(meetingTimer));

    localStorage.setItem(`csp_${aid}_timer_inbound`, String(inboundTimer));
    localStorage.setItem(`csp_${aid}_timer_outbound`, String(outboundTimer));
    localStorage.setItem(`csp_${aid}_timer_live_chat`, String(liveChatTimer));
    localStorage.setItem(`csp_${aid}_timer_ir_support`, String(irSupportTimer));
    localStorage.setItem(`csp_${aid}_timer_break_active`, String(breakTimer));
  }, [
    currentUser, isCheckedIn, isOnBreak, shiftStartTime, breakStartTime, breakReason, currentActivity,
    shiftTimer, shortBreakTimer, mealBreakTimer, prayerBreakTimer, meetingTimer,
    inboundTimer, outboundTimer, liveChatTimer, irSupportTimer, breakTimer
  ]);

  // Human readable timer formatter inside App.tsx
  const formatTime = (totalSecs: number) => {
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const formatCompactTime = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const playAudioAlert = (message: string) => {
    if (audioNotifications && typeof window !== 'undefined' && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(message);
        utterance.rate = 1.0;
        utterance.volume = 0.8;
        window.speechSynthesis.speak(utterance);
      } catch (e) {
        console.warn("Speech synthesis failed:", e);
      }
    }
  };

  const updatePreferences = async (newPrefs: {
    isDarkMode?: boolean;
    autoClockIn?: boolean;
    audioNotifications?: boolean;
    defaultBreakReason?: string;
    compactSidebar?: boolean;
    showWarnings?: boolean;
    customAlias?: string;
  }) => {
    const aid = currentUser?.id || localStorage.getItem('csp_logged_in_agent_id') || 'agent01';

    if (newPrefs.isDarkMode !== undefined) {
      setIsDarkMode(newPrefs.isDarkMode);
      localStorage.setItem(`csp_${aid}_is_dark_mode`, String(newPrefs.isDarkMode));
      localStorage.setItem('theme_preference', newPrefs.isDarkMode ? 'dark' : 'light');
    }
    if (newPrefs.autoClockIn !== undefined) {
      setAutoClockIn(newPrefs.autoClockIn);
      localStorage.setItem(`csp_${aid}_auto_clock_in`, String(newPrefs.autoClockIn));
    }
    if (newPrefs.audioNotifications !== undefined) {
      setAudioNotifications(newPrefs.audioNotifications);
      localStorage.setItem(`csp_${aid}_audio_notifications`, String(newPrefs.audioNotifications));
    }
    if (newPrefs.defaultBreakReason !== undefined) {
      setBreakReason(newPrefs.defaultBreakReason);
      localStorage.setItem(`csp_${aid}_break_reason`, newPrefs.defaultBreakReason);
    }
    if (newPrefs.compactSidebar !== undefined) {
      setCompactSidebar(newPrefs.compactSidebar);
      setIsSidebarCollapsed(newPrefs.compactSidebar);
      localStorage.setItem(`csp_${aid}_compact_sidebar`, String(newPrefs.compactSidebar));
      localStorage.setItem('csp_sidebar_collapsed', String(newPrefs.compactSidebar));
    }
    if (newPrefs.showWarnings !== undefined) {
      setShowWarnings(newPrefs.showWarnings);
      localStorage.setItem(`csp_${aid}_show_warnings`, String(newPrefs.showWarnings));
    }
    if (newPrefs.customAlias !== undefined) {
      const aliasVal = newPrefs.customAlias;
      setCustomAlias(aliasVal);
      localStorage.setItem(`csp_${aid}_custom_alias`, aliasVal);
      if (aliasVal.trim()) {
        setAgentName(aliasVal.trim());
        localStorage.setItem('csp_agent_name', aliasVal.trim());
      } else {
        const found = AGENTS_LIST.find(a => a.name === (currentUser?.name || localStorage.getItem('csp_agent_name')));
        if (found) {
          setAgentName(found.name);
          localStorage.setItem('csp_agent_name', found.name);
        }
      }
    }

    if (user) {
      try {
        await savePersonalPreferences(aid, {
          isDarkMode: newPrefs.isDarkMode !== undefined ? newPrefs.isDarkMode : isDarkMode,
          autoClockIn: newPrefs.autoClockIn !== undefined ? newPrefs.autoClockIn : autoClockIn,
          audioNotifications: newPrefs.audioNotifications !== undefined ? newPrefs.audioNotifications : audioNotifications,
          defaultBreakReason: newPrefs.defaultBreakReason !== undefined ? newPrefs.defaultBreakReason : breakReason,
          compactSidebar: newPrefs.compactSidebar !== undefined ? newPrefs.compactSidebar : compactSidebar,
          showWarnings: newPrefs.showWarnings !== undefined ? newPrefs.showWarnings : showWarnings,
          customAlias: newPrefs.customAlias !== undefined ? newPrefs.customAlias : customAlias,
        });
      } catch (err) {
        console.error("Failed to sync personal preferences to Firestore:", err);
      }
    }
  };

  const handleHeaderToggleBreak = async (breakType: 'Short Break' | 'Meal Break' | 'Prayer Break' | 'Meeting' | 'Available') => {
    if (!isCheckedIn) return;
    const aid = currentUser?.id || localStorage.getItem('csp_logged_in_agent_id') || 'agent01';

    if (breakType === 'Available') {
      setIsOnBreak(false);
      setAgentStatus('AVAILABLE');
      setCurrentActivity('available');
      logActivity(`Agent "${agentName}" returned from break and marked AVAILABLE.`);

      const breakId = localStorage.getItem(`csp_${aid}_current_break_id`);
      const startIso = localStorage.getItem(`csp_${aid}_current_break_start`) || new Date().toISOString();
      const durationSecs = Math.floor((Date.now() - new Date(startIso).getTime()) / 1000);
      if (breakId) {
        try {
          await upsertBreak({
            id: breakId,
            agentId: aid,
            agentName: agentName || 'System Agent',
            startTime: startIso,
            reason: breakReason,
            status: 'completed',
            endTime: new Date().toISOString(),
            duration: durationSecs
          });
        } catch (e) {
          console.error("Failed to update break: ", e);
        }
      }
      localStorage.removeItem(`csp_${aid}_current_break_id`);
      localStorage.removeItem(`csp_${aid}_current_break_start`);
      
      await upsertSessionToFirebase('available', 'available');
    } else {
      setIsOnBreak(true);
      setAgentStatus('ON BREAK');
      setCurrentActivity(breakType);
      logActivity(`Agent "${agentName}" went on: ${breakType}.`);

      const breakId = `${aid}_${Date.now()}`;
      localStorage.setItem(`csp_${aid}_current_break_id`, breakId);
      localStorage.setItem(`csp_${aid}_current_break_start`, new Date().toISOString());

      try {
        await upsertBreak({
          id: breakId,
          agentId: aid,
          agentName: agentName || 'System Agent',
          startTime: new Date().toISOString(),
          reason: breakType,
          status: 'active'
        });
      } catch (e) {
        console.error("Failed to start break: ", e);
      }
      
      let firestoreStatus: 'on_break' | 'available' = 'on_break';
      await upsertSessionToFirebase(breakType, firestoreStatus);
    }
  };

  const getActiveBreakTimerVal = () => {
    const act = currentActivity ? currentActivity.toLowerCase().replace(/[\s_-]+/g, '_') : '';
    if (act === 'short_break') return shortBreakTimer;
    if (act === 'meal_break') return mealBreakTimer;
    if (act === 'prayer_break') return prayerBreakTimer;
    if (act === 'meeting' || act === 'meeting_training' || act === 'meeting_rest') return meetingTimer;
    return 0;
  };

  const saveShiftLog = async (shiftId: string, data: Record<string, unknown>) => {
    if (!isPortalLoggedIn || !user) return;
    await upsertCloudRecord('shift_logs', shiftId, {
      agentId: currentUser?.id || localStorage.getItem('csp_logged_in_agent_id') || 'agent01',
      agentName: agentName || currentUser?.name || 'System Agent',
      ...data,
    });
  };
  const handleHeaderCheckIn = async () => {
    const startStr = new Date().toISOString();
    setIsCheckedIn(true);
    setShiftStartTime(startStr);
    setAgentStatus('AVAILABLE');
    setCurrentActivity('available');
    
    // Check if we should keep today's accumulated shift timer
    const aid = currentUser?.id || localStorage.getItem('csp_logged_in_agent_id') || 'agent01';
    const todayStr = new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0') + '-' + String(new Date().getDate()).padStart(2, '0');
    const savedDate = localStorage.getItem(`csp_${aid}_timer_shift_date`);
    let currentShiftTime = 0;
    if (savedDate === todayStr) {
      currentShiftTime = Number(localStorage.getItem(`csp_${aid}_timer_shift`) || '0');
    } else {
      localStorage.setItem(`csp_${aid}_timer_shift_date`, todayStr);
    }
    
    localStorage.setItem(`csp_${aid}_shift_start_timestamp`, String(Date.now()));
    localStorage.setItem(`csp_${aid}_accumulated_before`, String(currentShiftTime));
    setShiftTimer(currentShiftTime);

    const shiftLogId = `${aid}_${Date.now()}`;
    localStorage.setItem(`csp_${aid}_active_shift_log_id`, shiftLogId);
    await saveShiftLog(shiftLogId, { clockIn: startStr, clockOut: null, duration: currentShiftTime, status: 'active' });

    logActivity(`Agent "${agentName}" checked in and clocked duty shift on.`);
    await upsertSessionToFirebase('available', 'available', currentShiftTime);
  };

  const handleHeaderCheckOut = async () => {
    if (confirm("Are you sure you want to checkout and clock off? Active timers will halt.")) {
      const aid = currentUser?.id || localStorage.getItem('csp_logged_in_agent_id') || 'agent01';
      setIsCheckedIn(false);
      setShiftStartTime(null);
      setAgentStatus('OFFLINE');
      setCurrentActivity('offline');
      setIsOnBreak(false);

      // Save exact accumulated shift timer
      const startTs = Number(localStorage.getItem(`csp_${aid}_shift_start_timestamp`) || '0');
      const accum = Number(localStorage.getItem(`csp_${aid}_accumulated_before`) || '0');
      let finalShift = shiftTimer;
      if (startTs > 0) {
        finalShift = accum + Math.floor((Date.now() - startTs) / 1000);
      }
      localStorage.setItem(`csp_${aid}_timer_shift`, String(finalShift));
      localStorage.setItem(`csp_${aid}_accumulated_before`, String(finalShift));
      const shiftLogId = localStorage.getItem(`csp_${aid}_active_shift_log_id`);
      if (shiftLogId) {
        await saveShiftLog(shiftLogId, { clockOut: new Date().toISOString(), duration: finalShift, status: 'completed' });
        localStorage.removeItem(`csp_${aid}_active_shift_log_id`);
      }
      localStorage.removeItem(`csp_${aid}_shift_start_timestamp`);
      setShiftTimer(finalShift);

      logActivity(`Agent "${agentName}" checked out and clocked duty shift off.`);
      await upsertSessionToFirebase('offline', 'offline', finalShift);
    }
  };

  const handleHeaderActivityChange = async (target: string) => {
    if (!isCheckedIn) return;
    if (target === 'Available' || target === 'available') {
      if (isOnBreak) {
        setIsOnBreak(false);
        setAgentStatus('AVAILABLE');
        setCurrentActivity('available');
        logActivity(`Agent "${agentName}" returned from break and marked AVAILABLE.`);
        await upsertSessionToFirebase('available', 'available');
      } else {
        setCurrentActivity('available');
        logActivity(`Agent "${agentName}" changed active target division to: STANDBY`);
        await upsertSessionToFirebase('available', 'available');
      }
    } else {
      if (isOnBreak) {
        setIsOnBreak(false);
        setAgentStatus('AVAILABLE');
      }
      setCurrentActivity(target);
      logActivity(`Agent "${agentName}" changed active target division to: ${target.toUpperCase()}`);
      await upsertSessionToFirebase(target, 'available');
    }
  };

  // Real-time Lists (Firebase synchronized & offline fallback)
  const [liveAgentSessions, setLiveAgentSessions] = useState<LiveAgentSession[]>([]);
  const [liveBreaks, setLiveBreaks] = useState<any[]>([]);

  // Local state directory mock data loading/storing
  const [contacts, setContacts] = useState<CRMContact[]>([]);

  useEffect(() => {
    if (!isDataHydrated) return;
    localStorage.setItem('csp_contacts', JSON.stringify(contacts));
  }, [contacts, isDataHydrated]);

  const [tickets, setTickets] = useState<SupportTicket[]>([]);

  useEffect(() => {
    if (!isDataHydrated) return;
    localStorage.setItem('csp_tickets', JSON.stringify(tickets));
  }, [tickets, isDataHydrated]);

  const [kbArticles, setKbArticles] = useState<KBArticle[]>([]);

  useEffect(() => {
    if (!isDataHydrated) return;
    localStorage.setItem('csp_kb_articles', JSON.stringify(kbArticles));
  }, [kbArticles, isDataHydrated]);

  // Cloud-backed report data. localStorage remains a cache, while Firestore is canonical.
  const [cloudDataReady, setCloudDataReady] = useState(false);

  useEffect(() => {
    if (!isPortalLoggedIn || !user || !isDataHydrated) return;
    let readyCount = 0;
    const markReady = () => {
      readyCount += 1;
      if (readyCount === 3) setCloudDataReady(true);
    };
    const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
    const unsubContacts = listenToCloudCollection<any>('contacts', (records) => {
      if (records.length && !same(records, contacts)) setContacts(records as CRMContact[]);
      markReady();
    });
    const unsubTickets = listenToCloudCollection<any>('tickets', (records) => {
      if (records.length && !same(records, tickets)) setTickets(records as SupportTicket[]);
      markReady();
    });
    const unsubKb = listenToCloudCollection<any>('kb_articles', (records) => {
      if (records.length && !same(records, kbArticles)) setKbArticles(records as KBArticle[]);
      markReady();
    });
    return () => {
      unsubContacts();
      unsubTickets();
      unsubKb();
      setCloudDataReady(false);
    };
  }, [isPortalLoggedIn, user, isDataHydrated]);

  useEffect(() => {
    if (!cloudDataReady) return;
    void Promise.all([
      ...contacts.map((item) => upsertCloudRecord('contacts', item.id, item as unknown as Record<string, unknown>)),
      ...tickets.map((item) => upsertCloudRecord('tickets', item.id, item as unknown as Record<string, unknown>)),
      ...kbArticles.map((item) => upsertCloudRecord('kb_articles', item.id, item as unknown as Record<string, unknown>)),
    ]);
  }, [cloudDataReady, contacts, tickets, kbArticles]);

  useEffect(() => {
    if (!cloudDataReady) return;
    void Promise.all(agentCredentials.map((credential) =>
      upsertCloudRecord('agent_credentials', credential.agentId, credential as unknown as Record<string, unknown>)
    ));
  }, [cloudDataReady, agentCredentials]);
  useEffect(() => {
    if (!isPortalLoggedIn || !user) return;
    return listenToCloudCollection<any>('agent_credentials', (records) => {
      if (records.length) setAgentCredentials(records as AgentCredential[]);
    });
  }, [isPortalLoggedIn, user]);

  // Roster Seed parameters
  const [currentRosterYear, setCurrentRosterYear] = useState<number>(2026);
  const [currentRosterMonth, setCurrentRosterMonth] = useState<number>(6); // July (0-indexed)
  const [rosterSeed, setRosterSeed] = useState<number>(() => {
    return Number(localStorage.getItem('csp_roster_seed') || '0');
  });

  const generateMathematicalRoster = (yearNum = 2026, monthNum = 6, seed = 0): RosterDay[] => {
    const numDays = new Date(yearNum, monthNum + 1, 0).getDate();
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    let sortedAgents = [...AGENTS_LIST];
    if (seed > 0) {
      for (let i = sortedAgents.length - 1; i > 0; i--) {
        const j = (seed * 9301 + 49297) % 233280 % (i + 1);
        const temp = sortedAgents[i];
        sortedAgents[i] = sortedAgents[j];
        sortedAgents[j] = temp;
      }
    }

    const allAgentNames = sortedAgents.map(a => a.name);

    const getOffDaysForBlock = (blockIndex: number, seedNum: number): Map<string, number> => {
      let blockAgents = [...sortedAgents];
      const combinedSeed = seedNum + blockIndex * 17 + 101;
      for (let i = blockAgents.length - 1; i > 0; i--) {
        const j = (combinedSeed * 9301 + 49297) % 233280 % (i + 1);
        const temp = blockAgents[i];
        blockAgents[i] = blockAgents[j];
        blockAgents[j] = temp;
      }
      
      const map = new Map<string, number>();
      blockAgents.forEach((agent, index) => {
        map.set(agent.name, index % 7);
      });
      return map;
    };

    const roster: RosterDay[] = [];
    
    for (let day = 1; day <= numDays; day++) {
      const date = new Date(yearNum, monthNum, day);
      const dateStr = `${yearNum}-${String(monthNum + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayOfWeekName = daysOfWeek[date.getDay()];
      
      const blockIndex = Math.floor((day - 1) / 7);
      const dayOffset = (day - 1) % 7;
      
      const blockOffMap = getOffDaysForBlock(blockIndex, seed);
      
      const off = allAgentNames.filter(name => blockOffMap.get(name) === dayOffset);
      const activeAgents = allAgentNames.filter(name => blockOffMap.get(name) !== dayOffset);
      
      const activeMales = activeAgents.filter(name => {
        const agentObj = sortedAgents.find(a => a.name === name);
        return agentObj ? agentObj.isMale : false;
      });
      
      const nightIndex = (day * 3 + seed * 11) % activeMales.length;
      const nightShifts = [
        activeMales[nightIndex],
        activeMales[(nightIndex + 1) % activeMales.length]
      ];
      
      const remainingActive = activeAgents.filter(name => !nightShifts.includes(name));
      
      const dayRotateSeed = seed + day * 31;
      let shuffledActive = [...remainingActive];
      for (let i = shuffledActive.length - 1; i > 0; i--) {
        const j = (dayRotateSeed * 9301 + 49297) % 233280 % (i + 1);
        const temp = shuffledActive[i];
        shuffledActive[i] = shuffledActive[j];
        shuffledActive[j] = temp;
      }
      
      const morning = shuffledActive.slice(0, 3);
      const standardDay = shuffledActive.slice(3, 8);
      const afternoon = shuffledActive.slice(8, 16);
      
      const remainingForLateAndEvening = shuffledActive.slice(16);
      const half = Math.floor(remainingForLateAndEvening.length / 2);
      const lateDay = remainingForLateAndEvening.slice(0, half);
      const evening = remainingForLateAndEvening.slice(half);
      
      roster.push({
        id: `roster-${dateStr}`,
        date: dateStr,
        dayOfWeek: dayOfWeekName,
        shifts: {
          morning,
          standardDay,
          lateDay,
          afternoon,
          evening,
          night: nightShifts,
          off
        },
        notes: `Dynamic weekly off-day rotation active. All agents get exactly 1 rest day/week.`,
        isAutoGenerated: true,
      });
    }
    
    return roster;
  };

  const generateAutoRoster = (yearNum = 2026, monthNum = 6, seed = 0): RosterDay[] => {
    if (yearNum === 2026 && monthNum === 6 && seed === 0) {
      return parsePastedRoster(yearNum, monthNum, generateMathematicalRoster);
    }
    return generateMathematicalRoster(yearNum, monthNum, seed);
  };

  const [rosterDays, setRosterDays] = useState<RosterDay[]>(() => {
    try {
      const saved = localStorage.getItem('csp_roster_days');
      const pastedVersionLoaded = localStorage.getItem('csp_pasted_v2_loaded') === 'true';
      if (saved && pastedVersionLoaded) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].shifts && parsed[0].shifts.morning) {
          return parsed;
        }
      }
    } catch (e) {
      console.error("Error parsing roster days from local storage", e);
    }
    localStorage.setItem('csp_pasted_v2_loaded', 'true');
    return [];
  });

  useEffect(() => {
    localStorage.setItem('csp_roster_days', JSON.stringify(rosterDays));
  }, [rosterDays]);

  useEffect(() => {
    if (!isPortalLoggedIn || !user || !isDataHydrated) return;
    return listenToCloudCollection<any>('roster_days', (records) => {
      if (records.length) setRosterDays(records as RosterDay[]);
    });
  }, [isPortalLoggedIn, user, isDataHydrated]);

  useEffect(() => {
    if (!cloudDataReady) return;
    void Promise.all(rosterDays.map((day) =>
      upsertCloudRecord('roster_days', day.id, day as unknown as Record<string, unknown>)
    ));
  }, [cloudDataReady, rosterDays]);

  const [connectedSpreadsheetId, setConnectedSpreadsheetId] = useState<string>(() => {
    return localStorage.getItem('csp_roster_spreadsheet_id') || '1uIWNqo9UEV2AENgJuWUPU5mprS2rha4T62eQAFTu360';
  });

  const [connectedSpreadsheetUrl, setConnectedSpreadsheetUrl] = useState<string>(() => {
    return localStorage.getItem('csp_roster_spreadsheet_url') || 'https://docs.google.com/spreadsheets/d/1uIWNqo9UEV2AENgJuWUPU5mprS2rha4T62eQAFTu360/edit';
  });

  useEffect(() => {
    localStorage.setItem('csp_roster_spreadsheet_id', connectedSpreadsheetId);
    localStorage.setItem('csp_roster_spreadsheet_url', connectedSpreadsheetUrl);
  }, [connectedSpreadsheetId, connectedSpreadsheetUrl]);

  // Action / Sync state logs
  const [systemLogs, setSystemLogs] = useState<{ message: string; timestamp: string }[]>(() => {
    const saved = localStorage.getItem('csp_system_logs');
    return saved ? JSON.parse(saved) : [];
  });

  const logActivity = (message: string) => {
    const now = new Date();
    const newLog = { message, timestamp: now.toLocaleTimeString() };
    setSystemLogs(prev => {
      const updated = [newLog, ...prev].slice(0, 100);
      localStorage.setItem('csp_system_logs', JSON.stringify(updated));
      return updated;
    });
    if (isPortalLoggedIn && user) {
      const activityId = `${currentUser?.id || 'system'}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      void upsertCloudRecord('activities', activityId, {
        agentId: currentUser?.id || 'system',
        agentName: agentName || currentUser?.name || 'System',
        activity: message,
        timestamp: now.toISOString(),
      });
    }
  };

  useEffect(() => {
    if (!isPortalLoggedIn || !user) return;
    return listenToCloudCollection<any>('activities', (records) => {
      const logs = records
        .filter((record) => record.activity && record.timestamp)
        .sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)))
        .slice(0, 100)
        .map((record) => ({ message: String(record.activity), timestamp: new Date(String(record.timestamp)).toLocaleTimeString() }));
      if (logs.length) setSystemLogs(logs);
    });
  }, [isPortalLoggedIn, user]);

  // Google sheet automatic roster sync when connected
  useEffect(() => {
    const autoFetchRoster = async () => {
      if (connectedSpreadsheetId && token) {
        try {
          const syncedDays = await fetchRosterFromSheet(token, connectedSpreadsheetId);
          if (syncedDays && syncedDays.length > 0) {
            setRosterDays(syncedDays);
            logActivity("Fetched live roster allocations from Google Sheets.");
          }
        } catch (err: any) {
          console.error("Failed to automatically sync roster from Google Sheet", err);
          const errMsg = err?.message || String(err);
          const isAuthError = errMsg.includes("invalid authentication credentials") || 
                              errMsg.includes("Request had invalid authentication credentials") || 
                              errMsg.includes("UNAUTHENTICATED") || 
                              errMsg.includes("401");
          if (isAuthError) {
            setToken(null);
            sessionStorage.removeItem('_g_w_token_');
            logActivity("⚠️ Google Sheets API token is invalid or has expired. Gracefully disconnected; please re-authenticate.");
          } else {
            logActivity(`⚠️ Workspace API offline. Using cached Local Storage roster: ${errMsg}`);
          }
        }
      }
    };
    autoFetchRoster();
  }, [connectedSpreadsheetId, token, isPortalLoggedIn]);

  // Standard interval ticking
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Timer trackers for active states
  useEffect(() => {
    let timerInterval: NodeJS.Timeout | null = null;
    if (isCheckedIn) {
      timerInterval = setInterval(() => {
        const aid = currentUser?.id || localStorage.getItem('csp_logged_in_agent_id') || 'agent01';
        const startTs = Number(localStorage.getItem(`csp_${aid}_shift_start_timestamp`) || '0');
        const accum = Number(localStorage.getItem(`csp_${aid}_accumulated_before`) || '0');
        if (startTs > 0) {
          const newShiftVal = accum + Math.floor((Date.now() - startTs) / 1000);
          setShiftTimer(newShiftVal);
          localStorage.setItem(`csp_${aid}_timer_shift`, String(newShiftVal));
        } else {
          setShiftTimer((prev) => {
            const next = prev + 1;
            localStorage.setItem(`csp_${aid}_timer_shift`, String(next));
            return next;
          });
        }

        const act = currentActivity ? currentActivity.toLowerCase().replace(/[\s_-]+/g, '_') : '';
        if (act === 'inbound' || act === 'inbound_call' || act === 'inbound_queue') {
          setInboundTimer((prev) => {
            const next = prev + 1;
            localStorage.setItem(`csp_${aid}_timer_inbound`, String(next));
            return next;
          });
        } else if (act === 'outbound' || act === 'outbound_call' || act === 'outbound_campaign') {
          setOutboundTimer((prev) => {
            const next = prev + 1;
            localStorage.setItem(`csp_${aid}_timer_outbound`, String(next));
            return next;
          });
        } else if (act === 'live_chat' || act === 'live_chat_queue') {
          setLiveChatTimer((prev) => {
            const next = prev + 1;
            localStorage.setItem(`csp_${aid}_timer_live_chat`, String(next));
            return next;
          });
        } else if (act === 'ir_support' || act === 'incident_management') {
          setIrSupportTimer((prev) => {
            const next = prev + 1;
            localStorage.setItem(`csp_${aid}_timer_ir_support`, String(next));
            return next;
          });
        } else if (act === 'short_break') {
          setShortBreakTimer((prev) => {
            const next = prev + 1;
            localStorage.setItem(`csp_${aid}_timer_short_break`, String(next));
            return next;
          });
          setBreakTimer((prev) => {
            const next = prev + 1;
            localStorage.setItem(`csp_${aid}_timer_break_active`, String(next));
            return next;
          });
        } else if (act === 'meal_break') {
          setMealBreakTimer((prev) => {
            const next = prev + 1;
            localStorage.setItem(`csp_${aid}_timer_meal_break`, String(next));
            return next;
          });
          setBreakTimer((prev) => {
            const next = prev + 1;
            localStorage.setItem(`csp_${aid}_timer_break_active`, String(next));
            return next;
          });
        } else if (act === 'prayer_break') {
          setPrayerBreakTimer((prev) => {
            const next = prev + 1;
            localStorage.setItem(`csp_${aid}_timer_prayer_break`, String(next));
            return next;
          });
          setBreakTimer((prev) => {
            const next = prev + 1;
            localStorage.setItem(`csp_${aid}_timer_break_active`, String(next));
            return next;
          });
        } else if (act === 'meeting' || act === 'meeting_training' || act === 'meeting_rest') {
          setMeetingTimer((prev) => {
            const next = prev + 1;
            localStorage.setItem(`csp_${aid}_timer_meeting`, String(next));
            return next;
          });
          setBreakTimer((prev) => {
            const next = prev + 1;
            localStorage.setItem(`csp_${aid}_timer_break_active`, String(next));
            return next;
          });
        }
      }, 1000);
    }
    return () => {
      if (timerInterval) clearInterval(timerInterval);
    };
  }, [isCheckedIn, currentActivity, currentUser]);

  // Auth initialization handler
  useEffect(() => {
    const unsubscribe = initAuth(
      (firebaseUser, accessToken) => {
        setUser(firebaseUser);
        if (accessToken) setToken(accessToken);
      },
      () => {
        setUser(null);
        setToken(null);
        if (localStorage.getItem('csp_portal_logged_in') === 'true') {
          signInAnonymouslyIfNeeded();
        }
      }
    );
    return () => unsubscribe();
  }, []);

  // Google Sheets credentials sync logic
  useEffect(() => {
    const autoSyncCredentials = async () => {
      if (token && connectedSpreadsheetId && isPortalLoggedIn) {
        try {
          const fetched = await fetchAgentCredentialsFromSheet(token, connectedSpreadsheetId, AGENTS_LIST);
          if (fetched && fetched.length > 0) {
            setAgentCredentials(fetched);
            logActivity("Successfully fetched agent credentials sheet list from Google Sheets.");
          }
        } catch (err: any) {
          console.error("Failed to fetch agent credentials:", err);
          const errMsg = err?.message || String(err);
          const isAuthError = errMsg.includes("invalid authentication credentials") || 
                              errMsg.includes("Request had invalid authentication credentials") || 
                              errMsg.includes("UNAUTHENTICATED") || 
                              errMsg.includes("401");
          if (isAuthError) {
            setToken(null);
            sessionStorage.removeItem('_g_w_token_');
            logActivity("⚠️ Google Sheets API token is invalid or has expired. Gracefully disconnected; please re-authenticate.");
          } else {
            logActivity(`⚠️ Workspace API offline. Using cached Local Storage agent credentials: ${errMsg}`);
          }
        }
      }
    };
    autoSyncCredentials();
  }, [token, connectedSpreadsheetId, isPortalLoggedIn]);

  // Real-time Firestore sync listeners
  useEffect(() => {
    if (!isPortalLoggedIn || !user) return;

    // Listen to live agent floor statuses
    const unsubscribeSessions = listenToSessions((sessionsList) => {
      setLiveAgentSessions(sessionsList);
    });

    // Listen to live break records
    const unsubscribeBreaks = listenToBreaks((breaksList) => {
      setLiveBreaks(breaksList);
    });

    return () => {
      unsubscribeSessions();
      unsubscribeBreaks();
    };
  }, [isPortalLoggedIn, user]);

  // Synchronize Google spreadsheet ID/URL from Firestore config across all agents
  useEffect(() => {
    if (!isPortalLoggedIn || !user) return;

    const unsubscribe = listenToSpreadsheetConfig((config) => {
      if (config && config.spreadsheetId) {
        setConnectedSpreadsheetId(config.spreadsheetId);
        if (config.spreadsheetUrl) {
          setConnectedSpreadsheetUrl(config.spreadsheetUrl);
        }
      }
    });

    return () => unsubscribe();
  }, [isPortalLoggedIn, user]);

  // Synchronize Personal Preferences from Firestore
  useEffect(() => {
    if (!isPortalLoggedIn || !user || !currentUser) return;

    const unsubscribe = listenToPersonalPreferences(currentUser.id, (prefs) => {
      if (prefs) {
        setIsDarkMode(prefs.isDarkMode);
        setAutoClockIn(prefs.autoClockIn);
        setAudioNotifications(prefs.audioNotifications);
        setBreakReason(prefs.defaultBreakReason);
        setCompactSidebar(prefs.compactSidebar);
        setIsSidebarCollapsed(prefs.compactSidebar);
        setShowWarnings(prefs.showWarnings);
        setCustomAlias(prefs.customAlias);
        
        // Write back to local storage
        const aid = currentUser.id;
        localStorage.setItem(`csp_${aid}_is_dark_mode`, String(prefs.isDarkMode));
        localStorage.setItem('theme_preference', prefs.isDarkMode ? 'dark' : 'light');
        localStorage.setItem(`csp_${aid}_auto_clock_in`, String(prefs.autoClockIn));
        localStorage.setItem(`csp_${aid}_audio_notifications`, String(prefs.audioNotifications));
        localStorage.setItem(`csp_${aid}_break_reason`, prefs.defaultBreakReason);
        localStorage.setItem(`csp_${aid}_compact_sidebar`, String(prefs.compactSidebar));
        localStorage.setItem('csp_sidebar_collapsed', String(prefs.compactSidebar));
        localStorage.setItem(`csp_${aid}_show_warnings`, String(prefs.showWarnings));
        localStorage.setItem(`csp_${aid}_custom_alias`, prefs.customAlias);
        if (prefs.customAlias.trim()) {
          setAgentName(prefs.customAlias.trim());
          localStorage.setItem('csp_agent_name', prefs.customAlias.trim());
        }
      }
    });

    return () => unsubscribe();
  }, [isPortalLoggedIn, user, currentUser?.id]);

  // Centralized Firebase real-time status writers
  const upsertSessionToFirebase = async (
    activityName: string, 
    statusName: 'available' | 'on_break' | 'offline',
    sTimer?: number,
    bTimer?: number
  ) => {
    const currentAgentId = currentUser?.id || localStorage.getItem('csp_logged_in_agent_id') || 'agent01';
    const name = agentName || 'System Agent';

    // Retrieve active timer values for the session record
    const finalShiftTimer = sTimer !== undefined ? sTimer : (Number(localStorage.getItem(`csp_${currentAgentId}_timer_shift`) || '0') || shiftTimer);
    const finalBreakTimer = bTimer !== undefined ? bTimer : (Number(localStorage.getItem(`csp_${currentAgentId}_timer_break_active`) || '0') || breakTimer);

    const sessionData: LiveAgentSession = {
      id: auth.currentUser?.uid || currentAgentId,
      agentId: currentAgentId,
      name,
      loginTime: localStorage.getItem(`csp_${currentAgentId}_login_time`) || localStorage.getItem('csp_login_time') || new Date().toISOString(),
      status: statusName,
      currentActivity: activityName,
      lastActive: new Date().toISOString(),
      shiftTimer: finalShiftTimer,
      breakTimer: finalBreakTimer
    };

    try {
      // Write to Firestore collection instantly
      await upsertSession(sessionData);
    } catch (err) {
      console.error("Firestore real-time write error: ", err);
    }

    // Sheet log syncing in the background asynchronously so the UI never lags or freezes
    if (token && connectedSpreadsheetId) {
      (async () => {
        try {
          await appendRowToSheet(
            token,
            connectedSpreadsheetId,
            'ShiftLogs',
            [name, activityName, statusName, new Date().toISOString()],
            ['Agent Name', 'Work Category', 'Availability Status', 'Timestamp']
          );
        } catch (err: any) {
          console.error("Sheet append state failure: ", err);
          const errMsg = err?.message || String(err);
          const isAuthError = errMsg.includes("invalid authentication credentials") || 
                              errMsg.includes("Request had invalid authentication credentials") || 
                              errMsg.includes("UNAUTHENTICATED") || 
                              errMsg.includes("401");
          if (isAuthError) {
            setToken(null);
            sessionStorage.removeItem('_g_w_token_');
            logActivity("⚠️ Google Sheets API token is invalid or has expired. Gracefully disconnected; please re-authenticate.");
          } else {
            logActivity(`⚠️ Workspace API offline. Failed to log activity to Google Sheet: ${errMsg}`);
          }
        }
      })();
    }
  };

  // Sign-in with Google trigger
  const handleGoogleSignIn = async () => {
    setIsAuthGatewayOpen(true);
  };

  const handleGoogleSignInSuccess = (loggedInUser: User, accessToken: string) => {
    setUser(loggedInUser);
    setToken(accessToken);
    setShowAuthWarning(false);
    logActivity(`Connected Google Workspace API account: ${loggedInUser.email}`);
  };

  const flushPreviousLocalState = () => {
    const defaults = initialDataRef.current;
    setContacts(defaults.contacts);
    setTickets(defaults.tickets);
    setKbArticles(defaults.kbArticles);
    setSystemLogs([]);

    localStorage.removeItem('csp_contacts');
    localStorage.removeItem('csp_tickets');
    localStorage.removeItem('csp_kb_articles');
    localStorage.removeItem('csp_system_logs');
  };

  const handlePortalLogout = async () => {
    const savedId = localStorage.getItem('csp_logged_in_agent_id');
    if (savedId) {
      try {
        await deleteSession(savedId);
      } catch (e) {
        console.error("Error clearing Firebase session: ", e);
      }
    }
    try {
      await logout();
    } catch (e) {
      console.error(e);
    }
    flushPreviousLocalState();
    setUser(null);
    setToken(null);
    setCurrentUser(null);
    setIsPortalLoggedIn(false);
    localStorage.setItem('csp_portal_logged_in', 'false');
  };

  // Renders the Login Identity Gate if not authenticated
  if (!isPortalLoggedIn) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-200 font-sans flex flex-col items-center justify-center p-4 relative antialiased selection:bg-amber-500 selection:text-zinc-950 transition-colors duration-250">
        <div className="absolute top-4 right-4 flex items-center gap-2">
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="bg-zinc-900 border border-zinc-800 hover:border-zinc-750 hover:bg-zinc-850 rounded-lg p-2.5 flex items-center justify-center cursor-pointer transition-all duration-200 font-sans shadow-sm"
            title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            id="login_theme_toggle"
          >
            {isDarkMode ? <Sun className="w-5 h-5 text-amber-500 animate-pulse" /> : <Moon className="w-5 h-5 text-indigo-500" />}
          </button>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-6 sm:p-8 relative overflow-hidden"
          id="unified_login_portal_card"
        >
          <div className="flex flex-col items-center text-center mb-6">
            <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-2xl text-amber-500 mb-3 shadow-inner">
              <Clock className="w-8 h-8 animate-pulse" />
            </div>
            <h2 className="text-2xl font-bold font-serif tracking-wide text-zinc-300">
              Customer Support CRM
            </h2>
            <p className="text-xs text-zinc-500 mt-1 uppercase tracking-widest font-mono">
              Identity & Authentication Gate
            </p>
          </div>

          <div className="grid grid-cols-2 bg-zinc-950 p-1.5 rounded-xl border border-zinc-850 mb-6">
            <button
              type="button"
              onClick={() => {
                setLoginRole('AGENT');
                setLoginError('');
              }}
              className={`py-2 px-3 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2 ${
                loginRole === 'AGENT'
                  ? 'bg-zinc-900 text-amber-500 border border-zinc-800/80 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
              id="role_tab_agent"
            >
              <Users className="w-3.5 h-3.5" />
              Agent Access
            </button>
            <button
              type="button"
              onClick={() => {
                setLoginRole('ADMIN');
                setLoginError('');
              }}
              className={`py-2 px-3 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2 ${
                loginRole === 'ADMIN'
                  ? 'bg-zinc-900 text-amber-500 border border-zinc-800/80 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
              id="role_tab_admin"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Admin Access
            </button>
          </div>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setLoginError('');
              flushPreviousLocalState();

              if (loginRole === 'AGENT') {
                const credential = agentCredentials.find(
                  (c) => c.agentId.toLowerCase().trim() === loginAgentId.toLowerCase().trim()
                );

                if (!credential) {
                  setLoginError('Invalid Agent ID. Check your credentials.');
                  return;
                }

                if (credential.passwordHash !== loginAgentPass) {
                  setLoginError('Invalid Password. Please try again.');
                  return;
                }

                if (credential.role !== 'AGENT') {
                  setLoginError('Unauthorized role. This account is not an Agent.');
                  return;
                }

                if (credential.status && credential.status !== 'ACTIVE') {
                  setLoginError(`This account is ${credential.status === 'ON_LEAVE' ? 'currently on leave' : 'suspended'}. Contact an administrator.`);
                  return;
                }

                setAgentName(credential.name);
                localStorage.setItem('csp_agent_name', credential.name);
                localStorage.setItem('csp_logged_in_agent_id', credential.agentId);
                localStorage.setItem('csp_login_time', new Date().toISOString());
                setUserRole('AGENT');
                localStorage.setItem('csp_user_role', 'AGENT');
                const firebaseReady = await signInAnonymouslyIfNeeded();
                if (!firebaseReady) {
                  setLoginError('Firebase authentication is unavailable. Enable Authentication → Sign-in method → Anonymous, then try again.');
                  return;
                }
                setIsPortalLoggedIn(true);
                localStorage.setItem('csp_portal_logged_in', 'true');
                setCurrentUser({
                  id: credential.agentId,
                  name: credential.name,
                  role: 'AGENT'
                });
                setActiveTab('dashboard');
              } else {
                const credential = agentCredentials.find(
                  (c) => c.agentId.toLowerCase().trim() === loginAdminUser.toLowerCase().trim()
                );

                const isValidAdmin = credential 
                  ? (credential.passwordHash === loginAdminPass && credential.role === 'ADMIN')
                  : false;

                if (isValidAdmin) {
                  const adminName = credential ? credential.name : 'Administrator';
                  setAgentName(adminName);
                  localStorage.setItem('csp_agent_name', adminName);
                  localStorage.setItem('csp_logged_in_agent_id', credential ? credential.agentId : 'admin');
                  localStorage.setItem('csp_login_time', new Date().toISOString());
                  setUserRole('ADMIN');
                  localStorage.setItem('csp_user_role', 'ADMIN');
                  const firebaseReady = await signInAnonymouslyIfNeeded();
                  if (!firebaseReady) {
                    setLoginError('Firebase authentication is unavailable. Enable Authentication → Sign-in method → Anonymous, then try again.');
                    return;
                  }
                  setIsPortalLoggedIn(true);
                  localStorage.setItem('csp_portal_logged_in', 'true');
                  setCurrentUser({
                    id: credential ? credential.agentId : 'admin',
                    name: adminName,
                    role: 'ADMIN'
                  });
                  setActiveTab('admin_portal');
                } else {
                  setLoginError('Invalid Administrator credentials.');
                }
              }
            }}
            className="space-y-4"
          >
            {loginRole === 'AGENT' ? (
              <div className="space-y-4 text-left animate-fadeIn">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                    Agent Name Selection *
                  </label>
                  <AgentSelect 
                    value={agentName}
                    onChange={(val) => {
                      setAgentName(val);
                      // Auto-populate corresponding Agent ID
                      const index = AGENTS_LIST.findIndex(a => a.name === val);
                      if (index !== -1) {
                        const padIndex = String(index + 1).padStart(2, '0');
                        setLoginAgentId(`agent${padIndex}`);
                      } else {
                        setLoginAgentId('');
                      }
                    }}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                    Agent ID Verification *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. agent01"
                    value={loginAgentId}
                    onChange={(e) => {
                      setLoginAgentId(e.target.value);
                      setLoginError('');
                    }}
                    className="w-full bg-zinc-950 border border-zinc-850 rounded-lg px-3 py-2.5 text-xs text-zinc-200 placeholder:text-zinc-650 focus:outline-none focus:border-amber-500 font-sans focus:ring-1 focus:ring-amber-500"
                    id="agent_login_id"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                    Security Password *
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Enter password"
                    value={loginAgentPass}
                    onChange={(e) => {
                      setLoginAgentPass(e.target.value);
                      setLoginError('');
                    }}
                    className="w-full bg-zinc-950 border border-zinc-850 rounded-lg px-3 py-2.5 text-xs text-zinc-200 placeholder:text-zinc-650 focus:outline-none focus:border-amber-500 font-mono focus:ring-1 focus:ring-amber-500"
                    id="agent_login_pass"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-4 text-left animate-fadeIn">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                    Username / ID *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. admin"
                    value={loginAdminUser}
                    onChange={(e) => {
                      setLoginAdminUser(e.target.value);
                      setLoginError('');
                    }}
                    className="w-full bg-zinc-950 border border-zinc-850 rounded-lg px-3 py-2.5 text-xs text-zinc-200 placeholder:text-zinc-650 focus:outline-none focus:border-amber-500 font-sans focus:ring-1 focus:ring-amber-500"
                    id="admin_login_user"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                    Security Password *
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Enter admin password"
                    value={loginAdminPass}
                    onChange={(e) => {
                      setLoginAdminPass(e.target.value);
                      setLoginError('');
                    }}
                    className="w-full bg-zinc-950 border border-zinc-850 rounded-lg px-3 py-2.5 text-xs text-zinc-200 placeholder:text-zinc-650 focus:outline-none focus:border-amber-500 font-mono focus:ring-1 focus:ring-amber-500"
                    id="admin_login_pass"
                  />
                </div>
              </div>
            )}

            {loginError && (
              <div className="flex items-center gap-1.5 text-red-500 text-xs py-1 animate-pulse">
                <AlertCircle className="w-4 h-4" />
                <span>{loginError}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs uppercase tracking-wider transition-all duration-200 shadow-lg cursor-pointer transform hover:scale-[1.01]"
              id="submit_login_button"
            >
              Authorize Credentials & Login
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden flex bg-slate-50 dark:bg-[#0b0f19] text-slate-900 dark:text-slate-100 transition-colors duration-300 antialiased selection:bg-amber-500 selection:text-white">
      
      {/* Sidebar Navigation */}
      <aside 
        onMouseEnter={() => setIsSidebarHovered(true)}
        onMouseLeave={() => setIsSidebarHovered(false)}
        className={`fixed top-0 bottom-0 left-0 z-45 bg-zinc-950 text-zinc-100 border-r border-zinc-900 flex flex-col justify-between transition-all duration-300 shadow-xl ${
          isExpanded ? 'w-64' : 'w-16'
        } hidden md:flex shrink-0`}
      >
        
        {/* Sidebar Header */}
        <div className={`p-4 border-b border-zinc-900 flex items-center shrink-0 transition-all duration-300 ${isExpanded ? 'justify-between gap-2.5' : 'justify-center'}`}>
          {isExpanded ? (
            <div className="flex items-center gap-3 overflow-hidden animate-fadeIn">
              <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0 shadow-inner">
                <Clock className="w-5.5 h-5.5 text-amber-500 animate-pulse" />
              </div>
              <div className="truncate text-left">
                <span className="font-serif font-bold text-xs block tracking-wide uppercase text-zinc-100">CRM ADMIN</span>
                <span className="text-[10px] text-zinc-500 block truncate font-mono">{agentName}</span>
              </div>
            </div>
          ) : (
            <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0 shadow-inner">
              <Clock className="w-5.5 h-5.5 text-amber-500 animate-pulse" />
            </div>
          )}
          
          {isExpanded && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsSidebarCollapsed(!isSidebarCollapsed);
              }}
              className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer shrink-0"
              title={isSidebarCollapsed ? "Pin Sidebar" : "Collapse Sidebar"}
            >
              {isSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          )}
        </div>

        {/* Sidebar Navigation Links */}
        <div className={`flex-1 overflow-y-auto scrollbar-thin transition-all duration-300 ${isExpanded ? 'p-4' : 'px-2 py-4'}`}>
          <nav className="space-y-1.5">
            {[
              { id: 'dashboard', label: 'Performance Overview', icon: LayoutDashboard },
              { id: 'tickets', label: 'Support Tickets', icon: FileText, badge: tickets.length },
              { id: 'cs_ticket_form', label: 'CS Ticket Form', icon: ClipboardList },
              { id: 'crm', label: 'CRM Customer Base', icon: Users, badge: contacts.length },
              { id: 'reports', label: 'Agent Reports', icon: BarChart },
              { id: 'kb', label: 'Knowledge Base', icon: BookOpen, badge: kbArticles.length },
              { id: 'roster', label: 'ALL-DAY ROSTER', icon: Calendar, badge: '24/7' },
              { id: 'settings', label: 'Settings', icon: Settings },
              ...(userRole === 'ADMIN' ? [{ id: 'admin_portal', label: 'Admin Portal', icon: ShieldCheck, isRed: true }] : [])
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              
              const activeClasses = item.isRed
                ? 'bg-red-950/40 border border-red-900/60 text-red-400'
                : 'bg-amber-950/40 border border-amber-900/60 text-amber-500';
              const inactiveClasses = 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900/60 border border-transparent';

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id as any);
                    setIsMobileSidebarOpen(false);
                  }}
                  title={!isExpanded ? item.label : undefined}
                  className={`w-full flex items-center rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                    isExpanded ? 'justify-between px-3.5 py-2.5' : 'justify-center p-2.5'
                  } ${isActive ? activeClasses : inactiveClasses}`}
                >
                  <div className={`flex items-center ${isExpanded ? 'gap-2.5' : 'justify-center'}`}>
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? (item.isRed ? 'text-red-400' : 'text-amber-500') : 'text-zinc-500'}`} />
                    {isExpanded && <span className="truncate animate-fadeIn">{item.label}</span>}
                  </div>
                  {isExpanded && item.badge !== undefined && (
                    <span className={`font-mono text-[9px] px-1.5 py-0.2 rounded-full border ${
                      isActive 
                        ? (item.isRed ? 'bg-red-950 border-red-900 text-red-400' : 'bg-amber-950 border-amber-900 text-amber-500')
                        : 'bg-zinc-900 border-zinc-800 text-zinc-500'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer Controls */}
        <div className={`border-t border-zinc-900 transition-all duration-300 ${isExpanded ? 'p-4 space-y-3' : 'py-4 px-2'}`}>
          <button
            onClick={handlePortalLogout}
            title="Logout"
            className={`flex items-center justify-center bg-red-950/40 hover:bg-red-900/50 border border-red-900/50 hover:border-red-600 text-red-400 font-bold uppercase tracking-wider text-[10px] rounded-xl transition-all duration-300 cursor-pointer shadow-sm ${
              isExpanded ? 'w-full gap-2 py-2.5' : 'w-10 h-10 p-0 mx-auto'
            }`}
          >
            <LogOut className="w-3.5 h-3.5 shrink-0" />
            {isExpanded && <span className="animate-fadeIn">Logout</span>}
          </button>
        </div>
      </aside>

      {/* Mobile Backdrop Overlay */}
      {isMobileSidebarOpen && (
        <div 
          onClick={() => setIsMobileSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 md:hidden animate-fadeIn"
        />
      )}

      {/* Right Main Content Area Wrapper */}
      <div className={`flex-1 flex flex-col min-w-0 overflow-y-auto transition-all duration-300 ${
        isSidebarCollapsed ? 'md:ml-16' : 'md:ml-64'
      }`}>

        {/* Mobile Sidebar drawer */}
        <div className={`fixed inset-y-0 left-0 z-50 bg-zinc-950 border-r border-zinc-900 w-64 p-4 flex flex-col justify-between transform transition-transform duration-300 md:hidden ${
          isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}>
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-900">
              <div className="flex items-center gap-2.5">
                <Clock className="w-5.5 h-5.5 text-amber-500 animate-pulse" />
                <div className="text-left">
                  <span className="font-serif font-bold text-xs block text-white">CRM ADMIN</span>
                  <span className="text-[10px] text-zinc-500 block font-mono">{agentName}</span>
                </div>
              </div>
              <button 
                onClick={() => setIsMobileSidebarOpen(false)}
                className="text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="space-y-1.5">
              {[
                { id: 'dashboard', label: 'Performance Overview', icon: LayoutDashboard },
                { id: 'tickets', label: 'Support Tickets', icon: FileText, badge: tickets.length },
                { id: 'cs_ticket_form', label: 'CS Ticket Form', icon: ClipboardList },
                { id: 'crm', label: 'CRM Customer Base', icon: Users, badge: contacts.length },
                { id: 'reports', label: 'Agent Reports', icon: BarChart },
                { id: 'kb', label: 'Knowledge Base', icon: BookOpen, badge: kbArticles.length },
                { id: 'roster', label: 'ALL-DAY ROSTER', icon: Calendar, badge: '24/7' },
                { id: 'settings', label: 'Settings', icon: Settings },
                ...(userRole === 'ADMIN' ? [{ id: 'admin_portal', label: 'Admin Portal', icon: ShieldCheck, isRed: true }] : [])
              ].map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                
                const activeClasses = item.isRed
                  ? 'bg-red-950/40 border border-red-900/60 text-red-400'
                  : 'bg-amber-950/40 border border-amber-900/60 text-amber-500';
                const inactiveClasses = 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900/60 border border-transparent';

                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id as any);
                      setIsMobileSidebarOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                      isActive ? activeClasses : inactiveClasses
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className={`w-4.5 h-4.5 ${isActive ? (item.isRed ? 'text-red-400' : 'text-amber-500') : 'text-zinc-500'}`} />
                      <span>{item.label}</span>
                    </div>
                    {item.badge !== undefined && (
                      <span className="font-mono text-[9px] px-1.5 py-0.2 rounded-full border bg-zinc-900 border-zinc-800 text-zinc-500">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          <button
            onClick={handlePortalLogout}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-red-950/40 hover:bg-red-900/50 border border-red-900/50 text-red-400 font-bold uppercase tracking-wider text-[10px] rounded-xl cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout</span>
          </button>
        </div>

        {/* Modern Navigation Header Layout */}
        <header className="bg-white dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 py-3.5 sticky top-0 z-20 w-full shrink-0 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 font-sans select-none shadow-xs transition-colors duration-300">
          
          {/* LEFT SIDE BLOCK */}
          <div className="flex flex-col gap-2 w-full md:w-auto">
            <div className="flex flex-wrap items-center gap-3">
              {/* Menu Bar toggle button - visible only on mobile */}
              <button
                onClick={() => {
                  if (window.innerWidth < 768) {
                    setIsMobileSidebarOpen(true);
                  }
                }}
                className="md:hidden p-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-300 transition-all cursor-pointer"
                title="Toggle Menu"
              >
                <Menu className="w-4 h-4" />
              </button>

              {/* Profile Name & Active Status Dot Badge */}
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-500 font-bold uppercase text-xs shrink-0 font-mono hidden sm:flex">
                  {(currentUser?.name || agentName || 'SA').slice(0, 2).toUpperCase()}
                </div>
                <div className="text-left flex flex-col justify-center">
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5 leading-none">
                    <span>{currentUser?.name || agentName || 'System Agent'}</span>
                    <span className="text-[9px] text-slate-400 dark:text-slate-500 font-mono">({currentUser?.role || localStorage.getItem('csp_user_role') || 'AGENT'})</span>
                  </div>
                  
                  {/* Status Dot Badge */}
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className={`w-2 h-2 rounded-full ${
                      !isCheckedIn 
                        ? 'bg-slate-400 dark:bg-slate-600 animate-pulse' 
                        : isOnBreak 
                          ? 'bg-amber-500 animate-pulse' 
                          : 'bg-emerald-500 animate-pulse'
                    }`} />
                    <span className="text-[10px] font-bold font-mono tracking-wide uppercase text-slate-500">
                      {!isCheckedIn ? 'Offline' : isOnBreak ? 'On Break' : 'Online'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Dropdown containing all Break Categories */}
              {isCheckedIn && !isOnBreak && (
                <div className="relative ml-2">
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value) {
                        handleHeaderToggleBreak(e.target.value as any);
                      }
                    }}
                    className="appearance-none bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-250 dark:border-slate-800 pl-8 pr-8 py-1.5 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 cursor-pointer transition-all"
                  >
                    <option value="" disabled hidden>Take Break...</option>
                    <option value="Short Break">Short Break (15m)</option>
                    <option value="Meal Break">Meal Break (45m)</option>
                    <option value="Prayer Break">Prayer Break (15m)</option>
                    <option value="Meeting">Meeting (60m)</option>
                  </select>
                  <div className="absolute inset-y-0 left-2.5 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                    <Coffee className="w-3.5 h-3.5" />
                  </div>
                  <div className="absolute inset-y-0 right-2.5 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                    <ChevronDown className="w-3 h-3" />
                  </div>
                </div>
              )}
            </div>

            {/* Underneath this block: live ticking running break timer duration & "End Break" button */}
            {isCheckedIn && isOnBreak && (
              <div className="flex items-center gap-3 mt-1 pl-1 text-left">
                <span className="text-xs font-extrabold font-mono text-cyan-500 dark:text-cyan-400 bg-cyan-500/10 border border-cyan-500/25 dark:border-cyan-500/15 px-2.5 py-1 rounded-lg animate-pulse flex items-center gap-1.5 shadow-[0_0_10px_rgba(6,182,212,0.15)] drop-shadow-[0_0_2px_rgba(6,182,212,0.3)]">
                  <Clock className="w-3.5 h-3.5 text-cyan-450" />
                  <span>{breakReason}: {formatCompactTime(getActiveBreakTimerVal())}</span>
                </span>
                <button
                  onClick={() => handleHeaderToggleBreak('Available')}
                  className="flex items-center gap-1.5 px-3 py-1 bg-amber-500 hover:bg-amber-600 active:scale-[0.98] text-white font-bold text-[10px] uppercase tracking-wider rounded-lg shadow-xs transition-all cursor-pointer"
                >
                  <Coffee className="w-3.5 h-3.5 text-white animate-bounce" />
                  <span>End Break</span>
                </button>
              </div>
            )}
          </div>

          {/* RIGHT SIDE BLOCK */}
          <div className="flex flex-wrap items-center justify-end gap-3 w-full md:w-auto">
            {/* Department/Work Distribution Category selector dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider hidden lg:inline">
                Active Division:
              </span>
              <div className="relative">
                <select
                  value={currentActivity}
                  disabled={!isCheckedIn || isOnBreak}
                  onChange={(e) => handleHeaderActivityChange(e.target.value)}
                  className="appearance-none bg-slate-50 dark:bg-slate-900 border border-slate-250 dark:border-slate-800 pl-3.5 pr-8 py-1.5 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="available">STANDBY (STANDBY)</option>
                  <option value="Inbound Call">INBOUND (INBOUND)</option>
                  <option value="Outbound Call">OUTBOUND (BOUND)</option>
                  <option value="Live Chat">LIVE CHAT (LIVE CHAT)</option>
                  <option value="IR Support">IR SUPPORT (IR SUPPORT)</option>
                  {['Short Break', 'Meal Break', 'Prayer Break', 'Meeting'].includes(currentActivity) && (
                    <option value={currentActivity}>{currentActivity.toUpperCase()}</option>
                  )}
                  {currentActivity === 'offline' && (
                    <option value="offline">OFFLINE</option>
                  )}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-slate-400 dark:text-slate-600">
                  <ChevronDown className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>



            {/* Integrated Clock In / Clock Out action button */}
            <div className="flex items-center gap-2 font-mono">
              {isCheckedIn && (
                <div className="flex items-center gap-1.5 bg-cyan-500/10 border border-cyan-500/25 px-2.5 py-1.5 rounded-lg text-cyan-500 dark:text-cyan-400 text-[10px] font-extrabold uppercase tracking-wider font-mono shadow-[0_0_10px_rgba(6,182,212,0.15)] drop-shadow-[0_0_2px_rgba(6,182,212,0.3)] animate-pulse">
                  <Clock className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span>Shift: {formatTime(shiftTimer)}</span>
                </div>
              )}
              {isCheckedIn ? (
                <button
                  onClick={handleHeaderCheckOut}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 active:scale-[0.98] text-white font-bold text-[10px] uppercase tracking-wider rounded-lg shadow-xs transition-all cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Clock Out</span>
                </button>
              ) : (
                <button
                  onClick={handleHeaderCheckIn}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-bold text-[10px] uppercase tracking-wider rounded-lg shadow-xs transition-all cursor-pointer"
                >
                  <Clock className="w-3.5 h-3.5 text-white animate-pulse" />
                  <span>Clock In</span>
                </button>
              )}
            </div>

          </div>
        </header>

        {/* Global Google Sheet / Doc Warning Banner (Visible if token is missing) */}
        {!token && (
          <div className="bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-3 px-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-left animate-fadeIn shrink-0">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
              <span className="text-[11px] font-sans text-slate-650 dark:text-slate-400 font-semibold leading-normal">
                {!isFirebaseEnabled ? (
                  <span>
                    <strong>Local mode active.</strong> Firebase is not configured for this deployment, so realtime sync, Google sign-in, and Firestore storage are disabled.
                  </span>
                ) : isInIframe ? (
                  <span>
                    <strong>Warning:</strong> Browser security blocks Google authorization popups inside embedded preview frames. Please open this app in a new tab to authorize Sheets & Docs.
                  </span>
                ) : (
                  <span>
                    <strong>Warning:</strong> Connect your Google Workspace Account to synchronize shift rosters, log sheets, and CRM documents.
                  </span>
                )}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {isInIframe && (
                <a
                  href={window.location.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-1.5 bg-zinc-800 dark:bg-zinc-700 hover:bg-zinc-700 dark:hover:bg-zinc-600 text-white font-bold text-[10px] uppercase tracking-wider rounded-lg shadow-sm transition-all flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Open in New Tab
                </a>
              )}
              <button
                onClick={handleGoogleSignIn}
                disabled={isLoggingIn}
                className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold text-[10px] uppercase tracking-wider rounded-lg shadow-sm transition-all cursor-pointer"
              >
                {isLoggingIn ? 'Connecting...' : 'Authorize Google Sheets/Docs'}
              </button>
            </div>
          </div>
        )}

        {/* Dynamic Inner Workspace Content Tab Switching Router */}
        <Suspense fallback={<div className="flex-1 flex items-center justify-center p-8 text-sm text-zinc-500">Loading portal sections...</div>}>
          <main className="flex-1">
          {activeTab === 'dashboard' && (
            <DashboardSection
              agentName={agentName}
              agentId={currentUser?.id || 'agent01'}
              isCheckedIn={isCheckedIn}
              setIsCheckedIn={setIsCheckedIn}
              agentStatus={agentStatus}
              setAgentStatus={setAgentStatus}
              currentActivity={currentActivity}
              setCurrentActivity={setCurrentActivity}
              isOnBreak={isOnBreak}
              setIsOnBreak={setIsOnBreak}
              shiftStartTime={shiftStartTime}
              setShiftStartTime={setShiftStartTime}
              shiftTimer={shiftTimer}
              setShiftTimer={setShiftTimer}
              shortBreakTimer={shortBreakTimer}
              setShortBreakTimer={setShortBreakTimer}
              mealBreakTimer={mealBreakTimer}
              setMealBreakTimer={setMealBreakTimer}
              prayerBreakTimer={prayerBreakTimer}
              setPrayerBreakTimer={setPrayerBreakTimer}
              meetingTimer={meetingTimer}
              setMeetingTimer={setMeetingTimer}
              inboundTimer={inboundTimer}
              setInboundTimer={setInboundTimer}
              outboundTimer={outboundTimer}
              setOutboundTimer={setOutboundTimer}
              liveChatTimer={liveChatTimer}
              setLiveChatTimer={setLiveChatTimer}
              irSupportTimer={irSupportTimer}
              setIrSupportTimer={setIrSupportTimer}
              liveAgentSessions={liveAgentSessions}
              liveBreaks={liveBreaks}
              token={token}
              connectedSpreadsheetId={connectedSpreadsheetId}
              logActivity={logActivity}
              upsertSessionToFirebase={upsertSessionToFirebase}
              isBreakOverrun={isBreakOverrun}
              getBreakLimitMinutes={getBreakLimitMinutes}
            />
          )}

          {activeTab === 'tickets' && (
            <CrmSection
              contacts={contacts}
              setContacts={setContacts}
              tickets={tickets}
              setTickets={setTickets}
              token={token}
              agentName={agentName}
              createSupportDoc={async (tkn, ticket, contact) => {
                // Inline Doc creation wrapper
                const docId = `doc-${Date.now()}`;
                logActivity(`Exported Support Doc for Ticket #${ticket.id}`);
                return { documentId: docId, documentUrl: `https://docs.google.com/document/d/${docId}` };
              }}
              logActivity={logActivity}
              subTabDefault="tickets"
            />
          )}

          {activeTab === 'cs_ticket_form' && (
            <CsTicketFormSection
              tickets={tickets}
              setTickets={setTickets}
              agentName={agentName}
              logActivity={logActivity}
            />
          )}

          {activeTab === 'crm' && (
            <CrmSection
              contacts={contacts}
              setContacts={setContacts}
              tickets={tickets}
              setTickets={setTickets}
              token={token}
              agentName={agentName}
              createSupportDoc={async (tkn, ticket, contact) => {
                const docId = `doc-${Date.now()}`;
                logActivity(`Exported Support Doc for Ticket #${ticket.id}`);
                return { documentId: docId, documentUrl: `https://docs.google.com/document/d/${docId}` };
              }}
              logActivity={logActivity}
              subTabDefault="contacts"
            />
          )}

          {activeTab === 'reports' && (
            <ReportsSection
              contacts={contacts}
              tickets={tickets}
              rosterDays={rosterDays}
              setRosterDays={setRosterDays}
              generateAutoRoster={generateAutoRoster}
              liveAgentSessions={liveAgentSessions}
              liveBreaks={liveBreaks}
              logActivity={logActivity}
            />
          )}

          {activeTab === 'kb' && (
            <KbSection
              kbArticles={kbArticles}
              setKbArticles={setKbArticles}
              agentName={agentName}
              logActivity={logActivity}
              userRole={userRole}
            />
          )}

          {activeTab === 'roster' && (
            <RosterSection
              token={token}
              connectedSpreadsheetId={connectedSpreadsheetId}
              agentName={agentName}
              rosterDays={rosterDays}
              setRosterDays={setRosterDays}
              currentRosterYear={currentRosterYear}
              setCurrentRosterYear={setCurrentRosterYear}
              currentRosterMonth={currentRosterMonth}
              setCurrentRosterMonth={setCurrentRosterMonth}
              rosterSeed={rosterSeed}
              setRosterSeed={setRosterSeed}
              generateAutoRoster={generateAutoRoster}
              logActivity={logActivity}
              userRole={userRole}
            />
          )}

          {activeTab === 'admin_portal' && userRole === 'ADMIN' && (
            <AdminSection
              token={token}
              connectedSpreadsheetId={connectedSpreadsheetId}
              connectedSpreadsheetUrl={connectedSpreadsheetUrl}
              setConnectedSpreadsheetId={setConnectedSpreadsheetId}
              setConnectedSpreadsheetUrl={setConnectedSpreadsheetUrl}
              agentCredentials={agentCredentials}
              setAgentCredentials={setAgentCredentials}
              liveAgentSessions={liveAgentSessions}
              setLiveAgentSessions={setLiveAgentSessions}
              liveBreaks={liveBreaks}
              contacts={contacts}
              tickets={tickets}
              kbArticles={kbArticles}
              setKbArticles={setKbArticles}
              setRosterDays={setRosterDays}
              generateAutoRoster={generateAutoRoster}
              rosterDays={rosterDays}
              systemLogs={systemLogs}
              logActivity={logActivity}
              isBreakOverrun={isBreakOverrun}
              getBreakLimitMinutes={getBreakLimitMinutes}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsSection
              token={token}
              isLoggingIn={isLoggingIn}
              handleGoogleSignIn={handleGoogleSignIn}
              connectedSpreadsheetId={connectedSpreadsheetId}
              connectedSpreadsheetUrl={connectedSpreadsheetUrl}
              setConnectedSpreadsheetId={setConnectedSpreadsheetId}
              setConnectedSpreadsheetUrl={setConnectedSpreadsheetUrl}
              saveSpreadsheetConfig={saveSpreadsheetConfig}
              logActivity={logActivity}
              isDarkMode={isDarkMode}
              setIsDarkMode={setIsDarkMode}
              setToken={setToken}
              autoClockIn={autoClockIn}
              audioNotifications={audioNotifications}
              defaultBreakReason={breakReason}
              compactSidebar={compactSidebar}
              showWarnings={showWarnings}
              customAlias={customAlias}
              updatePreferences={updatePreferences}
            />
          )}
        </main>
        </Suspense>
      </div>

      <Suspense fallback={null}>
      <AuthGatewayModal
        isOpen={isAuthGatewayOpen}
        onClose={() => setIsAuthGatewayOpen(false)}
        onSuccess={handleGoogleSignInSuccess}
        isDarkMode={isDarkMode}
      />
      </Suspense>
    </div>
  );
}













