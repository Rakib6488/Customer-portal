import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, AlertCircle, CheckCircle, Activity, Coffee, FileSpreadsheet,
  Plus, Search, Key, Trash2, ExternalLink, RefreshCw, EyeOff, Scroll, Clock,
  Calendar, Filter, Download, ListFilter, FileText, Users, Save, BookOpen, Edit
} from 'lucide-react';
import { AgentCredential, LiveAgentSession, CRMContact, SupportTicket, RosterDay, KBArticle } from '../types';
import { updateAgentCredentialsInSheet, ensureSheetExists } from '../workspace';
import { upsertSession, saveSpreadsheetConfig, fetchCloudCollection, deleteCloudRecord } from '../firebase';

interface AdminSectionProps {
  token: string | null;
  connectedSpreadsheetId: string | null;
  connectedSpreadsheetUrl: string | null;
  setConnectedSpreadsheetId?: React.Dispatch<React.SetStateAction<string>>;
  setConnectedSpreadsheetUrl?: React.Dispatch<React.SetStateAction<string>>;
  agentCredentials: AgentCredential[];
  setAgentCredentials: React.Dispatch<React.SetStateAction<AgentCredential[]>>;
  liveAgentSessions: LiveAgentSession[];
  setLiveAgentSessions: React.Dispatch<React.SetStateAction<LiveAgentSession[]>>;
  liveBreaks: any[];
  contacts: CRMContact[];
  tickets: SupportTicket[];
  kbArticles: KBArticle[];
  setKbArticles: React.Dispatch<React.SetStateAction<KBArticle[]>>;
  rosterDays: RosterDay[];
  setRosterDays: React.Dispatch<React.SetStateAction<RosterDay[]>>;
  generateAutoRoster: (year: number, month: number, seed: number) => RosterDay[];
  systemLogs: { message: string; timestamp: string }[];
  logActivity: (message: string) => void;
  isBreakOverrun: (breakType: string, durationSeconds: number) => boolean;
  getBreakLimitMinutes: (breakType: string) => number;
}

export default function AdminSection({
  token,
  connectedSpreadsheetId,
  connectedSpreadsheetUrl,
  setConnectedSpreadsheetId,
  setConnectedSpreadsheetUrl,
  agentCredentials,
  setAgentCredentials,
  liveAgentSessions = [],
  setLiveAgentSessions,
  liveBreaks = [],
  contacts = [],
  tickets = [],
  kbArticles = [],
  setKbArticles,
  rosterDays = [],
  setRosterDays,
  generateAutoRoster,
  systemLogs = [],
  logActivity,
  isBreakOverrun,
  getBreakLimitMinutes
}: AdminSectionProps) {
  // Agent creation form states
  const [newAgentId, setNewAgentId] = useState('');
  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentPass, setNewAgentPass] = useState('');
  const [newAgentRole, setNewAgentRole] = useState<'AGENT' | 'ADMIN'>('AGENT');
  const [creationError, setCreationError] = useState('');
  const [creationSuccess, setCreationSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Search filter for credentials list
  const [credSearch, setCredSearch] = useState('');

  // Local notifications (toast-like) state
  const [notifications, setNotifications] = useState<string[]>([]);
  const [monitorNow, setMonitorNow] = useState(Date.now());
  const [activeAdminSection, setActiveAdminSection] = useState('overview');
  const jumpToAdminSection = (section: string, target: string) => {
    setActiveAdminSection(section);
    document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const rosterShiftKeys = ['morning', 'standardDay', 'lateDay', 'afternoon', 'evening', 'night', 'off'] as const;
  const [adminRosterDate, setAdminRosterDate] = useState('');
  const [adminRosterDraft, setAdminRosterDraft] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!adminRosterDate && rosterDays.length) setAdminRosterDate(rosterDays[0].date);
    const day = rosterDays.find((item) => item.date === adminRosterDate);
    if (day) setAdminRosterDraft(Object.fromEntries(rosterShiftKeys.map((key) => [key, (day.shifts?.[key] || []).join(', ')])));
  }, [adminRosterDate, rosterDays.length]);
  const saveAdminRosterOverride = () => {
    if (!adminRosterDate) return;
    setRosterDays((days) => days.map((day) => day.date === adminRosterDate ? { ...day, shifts: Object.fromEntries(rosterShiftKeys.map((key) => [key, (adminRosterDraft[key] || '').split(',').map((name) => name.trim()).filter(Boolean)])) as RosterDay['shifts'] } : day));
    logActivity(`Admin updated roster assignments for ${adminRosterDate}`);
  };
  const regenerateAdminRoster = () => {
    const first = rosterDays[0]?.date || new Date().toISOString().slice(0, 10);
    const year = Number(first.slice(0, 4));
    const month = Number(first.slice(5, 7)) - 1;
    const seed = Math.floor(Date.now() / 1000) % 100000;
    setRosterDays(generateAutoRoster(year, month, seed));
    logActivity(`Admin regenerated roster for ${year}-${String(month + 1).padStart(2, '0')} with seed ${seed}`);
  };
  const [kbSearch, setKbSearch] = useState('');
  const [kbEditingId, setKbEditingId] = useState<string | null>(null);
  const [kbForm, setKbForm] = useState({ title: '', category: 'General', content: '' });
  const visibleKbArticles = kbArticles.filter((article) => (article.title + ' ' + article.category + ' ' + article.content).toLowerCase().includes(kbSearch.toLowerCase()));
  const resetKbForm = () => { setKbEditingId(null); setKbForm({ title: '', category: 'General', content: '' }); };
  const saveKbArticle = () => {
    if (!kbForm.title.trim() || !kbForm.content.trim()) return;
    const now = new Date().toISOString();
    const id = kbEditingId || 'kb-admin-' + Date.now();
    const existing = kbArticles.find((item) => item.id === kbEditingId);
    const article: KBArticle = { id, title: kbForm.title.trim(), category: kbForm.category.trim() || 'General', content: kbForm.content.trim(), author: 'Admin', createdAt: existing?.createdAt || now, updatedAt: now };
    setKbArticles((items) => kbEditingId ? items.map((item) => item.id === kbEditingId ? article : item) : [article, ...items]);
    logActivity('Admin ' + (kbEditingId ? 'updated' : 'created') + ' knowledge base article: ' + article.title);
    resetKbForm();
  };
  const editKbArticle = (article: KBArticle) => { setKbEditingId(article.id); setKbForm({ title: article.title, category: article.category, content: article.content }); };
  const deleteKbArticle = async (article: KBArticle) => {
    if (!confirm('Delete knowledge base article "' + article.title + '"?')) return;
    await deleteCloudRecord('kb_articles', article.id);
    setKbArticles((items) => items.filter((item) => item.id !== article.id));
    logActivity('Admin deleted knowledge base article: ' + article.title);
    if (kbEditingId === article.id) resetKbForm();
  };
  useEffect(() => {
    const timer = window.setInterval(() => setMonitorNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  // 📈 Reports Panel State
  const [repType, setRepType] = useState<'breaks' | 'sessions' | 'tickets' | 'contacts' | 'roster'>('breaks');
  const [repDateMode, setRepDateMode] = useState<'all' | 'day' | 'month' | 'range'>('all');
  const [repDate, setRepDate] = useState(new Date().toISOString().substring(0, 10));
  const [repMonth, setRepMonth] = useState(new Date().toISOString().substring(0, 7));
  const [repStartDate, setRepStartDate] = useState(new Date().toISOString().substring(0, 10) + 'T00:00');
  const [repEndDate, setRepEndDate] = useState(new Date().toISOString().substring(0, 10) + 'T23:59');
  const [repAgentId, setRepAgentId] = useState('all');
  const [repSearch, setRepSearch] = useState('');
  const [isPushingToSheet, setIsPushingToSheet] = useState(false);

  // Filter helper functions
  const getFilteredBreaks = () => {
    return liveBreaks.filter(b => {
      // Agent filter
      if (repAgentId !== 'all') {
        const matchesAgent = b.agentId?.toLowerCase() === repAgentId.toLowerCase() || 
                             b.agentName?.toLowerCase().includes(repAgentId.toLowerCase());
        if (!matchesAgent) return false;
      }
      // Date filter
      const startTime = b.startTime;
      if (!startTime) return false;
      if (repDateMode === 'day') {
        if (!startTime.startsWith(repDate)) return false;
      } else if (repDateMode === 'month') {
        if (!startTime.startsWith(repMonth)) return false;
      } else if (repDateMode === 'range') {
        const startTs = new Date(repStartDate).getTime();
        const endTs = new Date(repEndDate).getTime();
        const bTs = new Date(startTime).getTime();
        if (bTs < startTs || bTs > endTs) return false;
      }
      // Text search
      if (repSearch.trim()) {
        const query = repSearch.toLowerCase();
        const textMatch = b.agentName?.toLowerCase().includes(query) ||
                          b.reason?.toLowerCase().includes(query) ||
                          b.status?.toLowerCase().includes(query);
        if (!textMatch) return false;
      }
      return true;
    });
  };

  const getFilteredSessions = () => {
    return liveAgentSessions.filter(s => {
      // Agent filter
      if (repAgentId !== 'all') {
        const matchesAgent = s.id?.toLowerCase() === repAgentId.toLowerCase() || 
                             s.agentId?.toLowerCase() === repAgentId.toLowerCase() || 
                             s.name?.toLowerCase().includes(repAgentId.toLowerCase());
        if (!matchesAgent) return false;
      }
      // Date filter
      const loginTime = s.loginTime;
      if (!loginTime) return false;
      if (repDateMode === 'day') {
        if (!loginTime.startsWith(repDate)) return false;
      } else if (repDateMode === 'month') {
        if (!loginTime.startsWith(repMonth)) return false;
      } else if (repDateMode === 'range') {
        const startTs = new Date(repStartDate).getTime();
        const endTs = new Date(repEndDate).getTime();
        const sTs = new Date(loginTime).getTime();
        if (sTs < startTs || sTs > endTs) return false;
      }
      // Text search
      if (repSearch.trim()) {
        const query = repSearch.toLowerCase();
        const textMatch = s.name?.toLowerCase().includes(query) ||
                          s.id?.toLowerCase().includes(query) ||
                          s.agentId?.toLowerCase().includes(query) ||
                          s.status?.toLowerCase().includes(query) ||
                          s.currentActivity?.toLowerCase().includes(query);
        if (!textMatch) return false;
      }
      return true;
    });
  };

  const getFilteredTickets = () => {
    return tickets.filter(t => {
      // Date filter
      const createdAt = t.createdAt;
      if (!createdAt) return false;
      if (repDateMode === 'day') {
        if (!createdAt.startsWith(repDate)) return false;
      } else if (repDateMode === 'month') {
        if (!createdAt.startsWith(repMonth)) return false;
      } else if (repDateMode === 'range') {
        const startTs = new Date(repStartDate).getTime();
        const endTs = new Date(repEndDate).getTime();
        const tTs = new Date(createdAt).getTime();
        if (tTs < startTs || tTs > endTs) return false;
      }
      // Text search
      if (repSearch.trim()) {
        const query = repSearch.toLowerCase();
        const textMatch = t.id?.toLowerCase().includes(query) ||
                          t.title?.toLowerCase().includes(query) ||
                          t.contactName?.toLowerCase().includes(query) ||
                          t.category?.toLowerCase().includes(query) ||
                          t.status?.toLowerCase().includes(query) ||
                          t.priority?.toLowerCase().includes(query);
        if (!textMatch) return false;
      }
      return true;
    });
  };

  const getFilteredContacts = () => {
    return contacts.filter(c => {
      // Date filter
      const lastContactDate = c.lastContactDate;
      if (!lastContactDate) return false;
      if (repDateMode === 'day') {
        if (!lastContactDate.startsWith(repDate)) return false;
      } else if (repDateMode === 'month') {
        if (!lastContactDate.startsWith(repMonth)) return false;
      } else if (repDateMode === 'range') {
        const startTs = new Date(repStartDate).getTime();
        const endTs = new Date(repEndDate).getTime();
        const cTs = new Date(lastContactDate).getTime();
        if (cTs < startTs || cTs > endTs) return false;
      }
      // Text search
      if (repSearch.trim()) {
        const query = repSearch.toLowerCase();
        const textMatch = c.id?.toLowerCase().includes(query) ||
                          c.name?.toLowerCase().includes(query) ||
                          c.email?.toLowerCase().includes(query) ||
                          c.phone?.toLowerCase().includes(query) ||
                          c.company?.toLowerCase().includes(query) ||
                          c.status?.toLowerCase().includes(query);
        if (!textMatch) return false;
      }
      return true;
    });
  };

  const getFilteredRoster = () => {
    return rosterDays.filter(day => {
      // Date filter
      const date = day.date;
      if (!date) return false;
      if (repDateMode === 'day') {
        if (date !== repDate) return false;
      } else if (repDateMode === 'month') {
        if (!date.startsWith(repMonth)) return false;
      } else if (repDateMode === 'range') {
        const startTs = new Date(repStartDate.substring(0, 10)).getTime();
        const endTs = new Date(repEndDate.substring(0, 10)).getTime();
        const dTs = new Date(date).getTime();
        if (dTs < startTs || dTs > endTs) return false;
      }
      // Agent filter inside rosters
      if (repAgentId !== 'all') {
        const agentNameLower = repAgentId.toLowerCase();
        const hasAgent = 
          (day.shifts?.morning || []).some(n => n.toLowerCase().includes(agentNameLower)) ||
          (day.shifts?.standardDay || []).some(n => n.toLowerCase().includes(agentNameLower)) ||
          (day.shifts?.lateDay || []).some(n => n.toLowerCase().includes(agentNameLower)) ||
          (day.shifts?.afternoon || []).some(n => n.toLowerCase().includes(agentNameLower)) ||
          (day.shifts?.evening || []).some(n => n.toLowerCase().includes(agentNameLower)) ||
          (day.shifts?.night || []).some(n => n.toLowerCase().includes(agentNameLower)) ||
          (day.shifts?.off || []).some(n => n.toLowerCase().includes(agentNameLower));
        if (!hasAgent) return false;
      }
      // Text search
      if (repSearch.trim()) {
        const query = repSearch.toLowerCase();
        const textMatch = day.dayOfWeek?.toLowerCase().includes(query) ||
                          day.date?.toLowerCase().includes(query) ||
                          day.notes?.toLowerCase().includes(query);
        if (!textMatch) return false;
      }
      return true;
    });
  };

  const handleExportCustomReport = () => {
    try {
      let csvContent = "\uFEFF"; // Add UTF-8 BOM
      let filename = "";

      if (repType === 'breaks') {
        const filtered = getFilteredBreaks();
        csvContent += "=== AGENT BREAK COMPLIANCE REPORT ===\n";
        csvContent += "Break ID,Agent ID,Agent Name,Break Type,Start Time (ISO),End Time (ISO),Duration (Seconds),Duration (Formatted),Status,Compliance State\n";
        filtered.forEach(b => {
          const durationFormatted = b.duration ? `${Math.floor(b.duration / 60)}m ${b.duration % 60}s` : 'N/A';
          const isOver = b.duration && isBreakOverrun(b.reason, b.duration);
          const complianceState = b.status === 'active' ? 'Active' : (isOver ? 'OVERRUN (🚨 Non-Compliant)' : 'COMPLIANT');
          csvContent += `"${b.id || ''}","${b.agentId || ''}","${b.agentName || ''}","${b.reason || ''}","${b.startTime || ''}","${b.endTime || ''}","${b.duration || 0}","${durationFormatted}","${b.status || ''}","${complianceState}"\n`;
        });
        filename = `Agent_Breaks_Compliance_Report_${repDateMode === 'all' ? 'AllTime' : repDateMode === 'day' ? repDate : repDateMode === 'month' ? repMonth : 'Range'}.csv`;
        logActivity(`Admin generated Custom Agent Break Compliance Report. Count: ${filtered.length}`);
      } else if (repType === 'sessions') {
        const filtered = getFilteredSessions();
        csvContent += "=== OPERATIONAL AGENT SESSIONS REPORT ===\n";
        csvContent += "Agent ID,Agent Name,Checked-in Login Time (ISO),Current Status,Current Activity,Last Active Timestamp (ISO),Shift Duration (Seconds),Shift Duration (Formatted),Cumulative Break Duration (Seconds)\n";
        filtered.forEach(s => {
          const shiftFormatted = s.shiftTimer ? `${Math.floor(s.shiftTimer / 3600)}h ${Math.floor((s.shiftTimer % 3605) / 60)}m` : '0m';
          csvContent += `"${s.agentId || s.id || ''}","${s.name || ''}","${s.loginTime || ''}","${s.status || ''}","${s.currentActivity || ''}","${s.lastActive || ''}","${s.shiftTimer || 0}","${shiftFormatted}","${s.breakTimer || 0}"\n`;
        });
        filename = `Agent_Duty_Sessions_Report_${repDateMode === 'all' ? 'AllTime' : repDateMode === 'day' ? repDate : repDateMode === 'month' ? repMonth : 'Range'}.csv`;
        logActivity(`Admin generated Custom Operational Sessions Report. Count: ${filtered.length}`);
      } else if (repType === 'tickets') {
        const filtered = getFilteredTickets();
        csvContent += "=== SUPPORT SLA TICKETS REPORT ===\n";
        csvContent += "Ticket ID,Customer ID,Customer Name,Subject,Category,Priority,Status,Created At (ISO)\n";
        filtered.forEach(t => {
          csvContent += `"${t.id || ''}","${t.contactId || ''}","${t.contactName || ''}","${t.title || ''}","${t.category || ''}","${t.priority || ''}","${t.status || ''}","${t.createdAt || ''}"\n`;
        });
        filename = `Support_Tickets_SLA_Report_${repDateMode === 'all' ? 'AllTime' : repDateMode === 'day' ? repDate : repDateMode === 'month' ? repMonth : 'Range'}.csv`;
        logActivity(`Admin generated Custom Support SLA Tickets Report. Count: ${filtered.length}`);
      } else if (repType === 'contacts') {
        const filtered = getFilteredContacts();
        csvContent += "=== CRM CUSTOMERS DIRECTORY REPORT ===\n";
        csvContent += "Contact ID,Name,Email,Phone,Company,Classification Status,Last Contact Timestamp (ISO)\n";
        filtered.forEach(c => {
          csvContent += `"${c.id || ''}","${c.name || ''}","${c.email || ''}","${c.phone || ''}","${c.company || ''}","${c.status || ''}","${c.lastContactDate || ''}"\n`;
        });
        filename = `CRM_Customer_Directory_Report_${repDateMode === 'all' ? 'AllTime' : repDateMode === 'day' ? repDate : repDateMode === 'month' ? repMonth : 'Range'}.csv`;
        logActivity(`Admin generated Custom CRM Customers Directory Report. Count: ${filtered.length}`);
      } else if (repType === 'roster') {
        const filtered = getFilteredRoster();
        csvContent += "=== HISTORIC SHIFT ROSTERS AND SCHEDULES REPORT ===\n";
        csvContent += "Date,Day of Week,Morning Shift,Standard Day Shift,Late Day Shift,Afternoon Shift,Evening Shift,Night Shift,Off Duty Representatives,Notes\n";
        filtered.forEach(day => {
          csvContent += `"${day.date || ''}","${day.dayOfWeek || ''}","${(day.shifts?.morning || []).join(';')}","${(day.shifts?.standardDay || []).join(';')}","${(day.shifts?.lateDay || []).join(';')}","${(day.shifts?.afternoon || []).join(';')}","${(day.shifts?.evening || []).join(';')}","${(day.shifts?.night || []).join(';')}","${(day.shifts?.off || []).join(';')}","${day.notes || ''}"\n`;
        });
        filename = `Workforce_Shift_Rosters_Report_${repDateMode === 'all' ? 'AllTime' : repDateMode === 'day' ? repDate : repDateMode === 'month' ? repMonth : 'Range'}.csv`;
        logActivity(`Admin generated Custom Workforce Shift Rosters Report. Count: ${filtered.length}`);
      }

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(`Error generating report: ${e.message || e}`);
    }
  };

  const handlePushReportToGoogleSheet = async () => {

    const confirmPush = confirm(`Are you sure you want to push the filtered ${repType.toUpperCase()} dataset as a dedicated sheet tab in your connected Google Spreadsheet?`);
    if (!confirmPush) return;

    setIsPushingToSheet(true);

    let rows: any[][] = [];
    let headers: string[] = [];
    let sheetName = "";

    const dateSuffix = repDateMode === 'all' ? 'All' : repDateMode === 'day' ? repDate : repDateMode === 'month' ? repMonth : 'Range';
    sheetName = `${repType.toUpperCase()}_${dateSuffix.replace(/[-:]/g, '')}`.substring(0, 30); // Google sheet tab max chars is 31

    if (repType === 'breaks') {
      const filtered = getFilteredBreaks();
      headers = ["Break ID", "Agent ID", "Agent Name", "Break Type", "Start Time", "End Time", "Duration (Sec)", "Status"];
      rows = filtered.map(b => [
        b.id || '',
        b.agentId || '',
        b.agentName || '',
        b.reason || '',
        b.startTime || '',
        b.endTime || '',
        String(b.duration || 0),
        b.status || ''
      ]);
    } else if (repType === 'sessions') {
      const filtered = getFilteredSessions();
      headers = ["Agent ID", "Agent Name", "Login Time", "Status", "Activity", "Last Active", "Shift Duration (Sec)", "Break Duration (Sec)"];
      rows = filtered.map(s => [
        s.agentId || s.id || '',
        s.name || '',
        s.loginTime || '',
        s.status || '',
        s.currentActivity || '',
        s.lastActive || '',
        String(s.shiftTimer || 0),
        String(s.breakTimer || 0)
      ]);
    } else if (repType === 'tickets') {
      const filtered = getFilteredTickets();
      headers = ["Ticket ID", "Customer ID", "Customer Name", "Subject", "Category", "Priority", "Status", "Created At"];
      rows = filtered.map(t => [
        t.id || '',
        t.contactId || '',
        t.contactName || '',
        t.title || '',
        t.category || '',
        t.priority || '',
        t.status || '',
        t.createdAt || ''
      ]);
    } else if (repType === 'contacts') {
      const filtered = getFilteredContacts();
      headers = ["Contact ID", "Name", "Email", "Phone", "Company", "Status", "Last Contact Date"];
      rows = filtered.map(c => [
        c.id || '',
        c.name || '',
        c.email || '',
        c.phone || '',
        c.company || '',
        c.status || '',
        c.lastContactDate || ''
      ]);
    } else if (repType === 'roster') {
      const filtered = getFilteredRoster();
      headers = ["Date", "Day", "Morning", "Standard Day", "Late Day", "Afternoon", "Evening", "Night", "Off Duty", "Notes"];
      rows = filtered.map(day => [
        day.date || '',
        day.dayOfWeek || '',
        (day.shifts?.morning || []).join(', '),
        (day.shifts?.standardDay || []).join(', '),
        (day.shifts?.lateDay || []).join(', '),
        (day.shifts?.afternoon || []).join(', '),
        (day.shifts?.evening || []).join(', '),
        (day.shifts?.night || []).join(', '),
        (day.shifts?.off || []).join(', '),
        day.notes || ''
      ]);
    }

    try {
      await ensureSheetExists(token, connectedSpreadsheetId, sheetName, headers);

      const clearRange = `${sheetName}!A2:Z10000`;
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${connectedSpreadsheetId}/values/${clearRange}:clear`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const writeRange = `${sheetName}!A2`;
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${connectedSpreadsheetId}/values/${writeRange}?valueInputOption=USER_ENTERED`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            values: rows
          })
        }
      );

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || "Failed to push spreadsheet values");
      }

      logActivity(`Admin pushed Operational Audit Report (${repType.toUpperCase()}) to Google Sheet tab "${sheetName}". Count: ${rows.length}`);
      alert(`🎉 Report successfully synced to Google Spreadsheet!\nSheet Tab: ${sheetName}\nRecords Synced: ${rows.length}`);
    } catch (e: any) {
      console.error("Failed to push report to Google Sheets:", e);
      alert(`⚠️ Error syncing report to Google Sheet: ${e.message || String(e)}`);
    } finally {
      setIsPushingToSheet(false);
    }
  };

  // Periodically check live break overrun compliance and trigger alert toasts for Admins
  useEffect(() => {
    const activeOverruns: string[] = [];

    liveAgentSessions.forEach(sess => {
      if (sess.status === 'on_break') {
        // Calculate break duration from lastActive or session state if we have the duration.
        // Let's assume we calculate it based on (now - loginTime) or custom tracked duration.
        // In this workspace, sessions from liveAgentSessions are tracked with real-time timers.
        // We can parse how long they have been active.
        const startSec = Math.floor((Date.now() - new Date(sess.lastActive).getTime()) / 1000);
        if (isBreakOverrun(sess.currentActivity, startSec)) {
          activeOverruns.push(`${sess.name} is overrunning their ${sess.currentActivity.replace('_', ' ')} (${Math.floor(startSec / 60)}m active)`);
        }
      }
    });

    if (activeOverruns.length > 0) {
      setNotifications(prev => {
        // Only append unique ones that aren't already there
        const filtered = activeOverruns.filter(item => !prev.includes(item));
        if (filtered.length > 0) {
          return [...prev, ...filtered];
        }
        return prev;
      });
    }
  }, [liveAgentSessions, isBreakOverrun]);

  // Handle agent creation
  const handleCreateAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreationError('');
    setCreationSuccess('');

    if (!newAgentId.trim() || !newAgentName.trim() || !newAgentPass.trim()) {
      setCreationError('All fields are required.');
      return;
    }

    const exists = agentCredentials.some(
      (c) => c.agentId.toLowerCase().trim() === newAgentId.toLowerCase().trim()
    );

    if (exists) {
      setCreationError('An agent or admin with this ID already exists.');
      return;
    }


    setIsSubmitting(true);
    try {
      const newCred: AgentCredential = {
        agentId: newAgentId.trim().toLowerCase(),
        passwordHash: newAgentPass.trim(),
        name: newAgentName.trim(),
        role: newAgentRole
      };

      const updatedList = [...agentCredentials, newCred];

      if (token && connectedSpreadsheetId) {
        try {
          // Submit directly to sheets backend
          await updateAgentCredentialsInSheet(token, connectedSpreadsheetId, updatedList);
          setCreationSuccess(`Successfully created agent ${newCred.name} and synchronized with Google Sheets!`);
        } catch (sheetErr: any) {
          console.warn("Failed to sync to Google Sheets, falling back to local saving:", sheetErr);
          setCreationSuccess(`Successfully created agent ${newCred.name} (Local Storage only, Sheets offline).`);
          logActivity(`⚠️ Google Sheets sync failed: ${sheetErr.message || sheetErr}. Saved "${newCred.name}" to local cache.`);
        }
      } else {
        setCreationSuccess(`Successfully created agent ${newCred.name} (Local Storage only, Sheets not connected).`);
        logActivity(`Saved "${newCred.name}" to local storage fallback.`);
      }

      // Update local state
      setAgentCredentials(updatedList);
      localStorage.setItem('csp_agent_credentials', JSON.stringify(updatedList));

      setNewAgentId('');
      setNewAgentName('');
      setNewAgentPass('');
      logActivity(`Admin created new credential profile for "${newCred.name}" (${newCred.role})`);
    } catch (err: any) {
      setCreationError(`Error saving: ${err.message || err}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset agent password
  const handleResetPassword = async (agentId: string) => {
    const newPass = prompt(`Enter new temporary password for agent: ${agentId}`, 'agent123');
    if (!newPass) return;

    try {
      const updatedList = agentCredentials.map(c => 
        c.agentId === agentId ? { ...c, passwordHash: newPass } : c
      );

      if (token && connectedSpreadsheetId) {
        try {
          await updateAgentCredentialsInSheet(token, connectedSpreadsheetId, updatedList);
          alert(`Success: Temporary password of "${agentId}" has been reset and synced with Google Sheets!`);
        } catch (sheetErr: any) {
          console.warn("Google Sheets sync failed:", sheetErr);
          alert(`Success: Temporary password reset (Saved locally only, Sheets offline).`);
          logActivity(`⚠️ Google Sheets sync failed: ${sheetErr.message || sheetErr}. Saved password reset of "${agentId}" to local cache.`);
        }
      } else {
        alert(`Success: Temporary password reset (Saved locally, Sheets not connected).`);
        logActivity(`Saved password reset of "${agentId}" to local cache.`);
      }

      setAgentCredentials(updatedList);
      localStorage.setItem('csp_agent_credentials', JSON.stringify(updatedList));

      logActivity(`Admin reset password of agent ID "${agentId}"`);
    } catch (err: any) {
      alert(`Error resetting password: ${err.message || err}`);
    }
  };

  // Revoke agent access (delete credential)
  const handleRevokeAccess = async (agentId: string) => {
    if (agentId === 'admin') {
      alert('Cannot revoke master administrator access.');
      return;
    }

    if (!confirm(`Are you sure you want to permanently revoke access for agent: ${agentId}?`)) {
      return;
    }

    try {
      await Promise.all([deleteCloudRecord('agent_credentials', agentId), deleteCloudRecord('agents', agentId), deleteCloudRecord('activeBreaks', agentId)]);
      const updatedList = agentCredentials.filter(c => c.agentId !== agentId);

      if (token && connectedSpreadsheetId) {
        try {
          await updateAgentCredentialsInSheet(token, connectedSpreadsheetId, updatedList);
          alert(`Success: Access for agent "${agentId}" has been revoked and synced with Google Sheets!`);
        } catch (sheetErr: any) {
          console.warn("Google Sheets sync failed:", sheetErr);
          alert(`Success: Access revoked (Saved locally only, Sheets offline).`);
          logActivity(`⚠️ Google Sheets sync failed: ${sheetErr.message || sheetErr}. Saved revoke access of "${agentId}" to local cache.`);
        }
      } else {
        alert(`Success: Access revoked (Saved locally, Sheets not connected).`);
        logActivity(`Saved revoke access of "${agentId}" to local cache.`);
      }

      setAgentCredentials(updatedList);
      localStorage.setItem('csp_agent_credentials', JSON.stringify(updatedList));

      logActivity(`Admin revoked credential profile and access for agent ID "${agentId}"`);
    } catch (err: any) {
      alert(`Error revoking access: ${err.message || err}`);
    }
  };

  // Force an agent status back to available in Firestore
  const handleForceStatusAvailable = async (sess: LiveAgentSession) => {
    try {
      const updatedSess: LiveAgentSession = {
        ...sess,
        status: 'available',
        currentActivity: 'available',
        lastActive: new Date().toISOString()
      };

      await upsertSession(updatedSess);
      logActivity(`Admin forced status override to AVAILABLE for agent: ${sess.name}`);
      alert(`Successfully forced agent "${sess.name}" back to "Available" status.`);
    } catch (err: any) {
      alert(`Error forcing session status: ${err.message || err}`);
    }
  };

  // Export all team data to a unified CSV (Aggregated CRM, Tickets, Roster)
  const handleExportAllTeamData = () => {
    try {
      let csvContent = "data:text/csv;charset=utf-8,";
      
      // Part 1: Team rosters overview
      csvContent += "=== TEAM SHIFT ROSTER DISPOSITION ===\n";
      csvContent += "Date,Day of Week,Morning Shift,Standard Day,Late Day Shift,Afternoon Shift,Evening Shift,Night Shift,Off Duty\n";
      rosterDays.forEach(day => {
        csvContent += `"${day.date}","${day.dayOfWeek}","${(day.shifts?.morning || []).join(';')}","${(day.shifts?.standardDay || []).join(';')}","${(day.shifts?.lateDay || []).join(';')}","${(day.shifts?.afternoon || []).join(';')}","${(day.shifts?.evening || []).join(';')}","${(day.shifts?.night || []).join(';')}","${(day.shifts?.off || []).join(';')}"\n`;
      });
      csvContent += "\n\n";

      // Part 2: CRM Contacts
      csvContent += "=== CRM CUSTOMER DIRECTORY ===\n";
      csvContent += "Contact ID,Name,Email,Phone,Company,Customer Class,Last Contact Date\n";
      contacts.forEach(c => {
        csvContent += `"${c.id}","${c.name}","${c.email}","${c.phone}","${c.company}","${c.status}","${c.lastContactDate}"\n`;
      });
      csvContent += "\n\n";

      // Part 3: Support Tickets
      csvContent += "=== CLOSED AND HISTORIC SUPPORT TICKETS ===\n";
      csvContent += "Ticket ID,Customer ID,Customer Name,Subject,Priority,Status,Category,Created At\n";
      tickets.forEach(t => {
        csvContent += `"${t.id}","${t.contactId}","${t.contactName}","${t.title}","${t.priority}","${t.status}","${t.category}","${t.createdAt}"\n`;
      });

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `Master_Workforce_CRM_Audit_${new Date().toISOString().substring(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      logActivity("Admin generated and downloaded Master Unified Team Data CRM Audit CSV");
    } catch (err: any) {
      alert(`Failed to export team data: ${err.message || err}`);
    }
  };

  // Download a complete cloud backup, including historical records not shown on live boards.
  const handleDownloadFullCloudBackup = async () => {
    try {
      const collectionNames = ['agents', 'activeBreaks', 'breaks', 'shift_logs', 'activities', 'contacts', 'tickets', 'kb_articles', 'roster_days'];
      const entries = await Promise.all(collectionNames.map(async (name) => [name, await fetchCloudCollection(name)]));
      const backup = { exportedAt: new Date().toISOString(), project: 'customer-portal-49149', collections: Object.fromEntries(entries) };
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `customer-portal-full-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      logActivity('Admin downloaded complete Firestore cloud backup JSON');
    } catch (err: any) {
      alert(`Failed to download full cloud backup: ${err?.message || err}`);
    }
  };

  // Open Google Sheets portal
  const handleOpenLiveSpreadsheet = () => {
    if (connectedSpreadsheetUrl) {
      window.open(connectedSpreadsheetUrl, '_blank', 'noopener,noreferrer');
    } else {
      alert("⚠️ Google spreadsheet is not connected yet.");
    }
  };

  const filteredCredentials = agentCredentials.filter(c => 
    c.name.toLowerCase().includes(credSearch.toLowerCase()) ||
    c.agentId.toLowerCase().includes(credSearch.toLowerCase())
  );

  return (
    <div id="admin-overview" className="p-6 space-y-6 text-left bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 animate-fadeIn font-sans">
      
      {/* Persistent browser toast notifications for Admin */}
      {notifications.length > 0 && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 p-4 rounded-xl space-y-2 mb-4">
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400 font-bold text-xs uppercase tracking-wider">
            <AlertCircle className="w-4 h-4 animate-ping shrink-0" />
            Active Floor Overrun Compliance Alarms
          </div>
          <div className="divide-y divide-red-200 dark:divide-red-900/30 text-xs">
            {notifications.map((notif, idx) => (
              <div key={idx} className="py-1.5 text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
                <span>{notif}</span>
                <button 
                  onClick={() => setNotifications(notifications.filter((_, i) => i !== idx))}
                  className="text-[10px] uppercase font-bold text-red-500 hover:text-red-400 hover:underline cursor-pointer"
                >
                  Dismiss ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Admin header workspace view */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-zinc-200 dark:border-zinc-800/80 pb-5">
        <div>
          <h2 className="text-lg font-bold text-amber-600 dark:text-amber-400 tracking-wide flex items-center gap-2 font-serif">
            <ShieldCheck className="w-5 h-5 text-red-500 animate-pulse" />
            CRM WORKFORCE & SECURITY CONTROL CENTRE
          </h2>
          <p className="text-xs text-zinc-500">
            Real-time automated compliance surveillance, spreadsheet raw auditing portals, and security workforce management.
          </p>
        </div>
        
        {/* OPEN LIVE SPREADSHEET button */}
        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={handleOpenLiveSpreadsheet}
            disabled={!connectedSpreadsheetUrl}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider rounded-lg shadow-sm transition-all cursor-pointer disabled:opacity-50"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            OPEN LIVE SPREADSHEET
          </button>

          <button
            onClick={handleDownloadFullCloudBackup}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-wider rounded-lg shadow-xs transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Download Full Cloud Backup (JSON)
          </button>

          <button
            onClick={handleExportAllTeamData}
            className="flex items-center gap-1.5 px-4 py-2 border border-zinc-300 dark:border-zinc-850 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold text-xs uppercase tracking-wider rounded-lg shadow-xs transition-all cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Export Team Data (CSV)
          </button>
        </div>
      </div>

      {/* 📊 Google Sheets Connection Configuration */}
      <div className="sticky top-2 z-20 bg-zinc-50/95 dark:bg-zinc-950/95 backdrop-blur border border-zinc-200 dark:border-zinc-800 rounded-xl p-2 shadow-lg">
        <div className="flex flex-wrap gap-1">
          {[['overview', 'Overview', 'admin-overview'], ['reports', 'Reports', 'admin-reports'], ['live', 'Live Monitoring', 'admin-live'], ['roster', 'Roster', 'admin-roster'], ['kb', 'Knowledge Base', 'admin-kb'], ['access', 'Access Management', 'admin-access'], ['data', 'Data & Logs', 'admin-data']].map(([key, label, target]) => <button key={key} onClick={() => jumpToAdminSection(key, target)} className={`px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${activeAdminSection === key ? 'bg-amber-600 text-white' : 'text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800'}`}>{label}</button>)}
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800/80 rounded-xl p-5 space-y-4 shadow-xs text-left">
        <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800/80 pb-3">
          <FileSpreadsheet className="w-5 h-5 text-emerald-500" />
          <div>
            <h3 className="font-bold text-zinc-800 dark:text-zinc-100 text-sm font-sans">Google Sheets Integration Settings</h3>
            <p className="text-[11px] text-zinc-500 font-sans">
              Configure the exact Google Spreadsheet ID where agent logs, shift rosters, and credentials sync in real-time.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block font-sans">Connected Spreadsheet ID</label>
            <input
              type="text"
              value={connectedSpreadsheetId || ''}
              onChange={(e) => {
                const newId = e.target.value.trim();
                if (setConnectedSpreadsheetId) {
                  setConnectedSpreadsheetId(newId);
                  if (newId && setConnectedSpreadsheetUrl) {
                    setConnectedSpreadsheetUrl(`https://docs.google.com/spreadsheets/d/${newId}/edit`);
                  }
                }
              }}
              placeholder="Enter Spreadsheet ID"
              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-lg px-3 py-2 text-xs font-mono outline-hidden transition-all text-zinc-800 dark:text-zinc-200"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block font-sans">Connected Spreadsheet URL</label>
            <input
              type="text"
              value={connectedSpreadsheetUrl || ''}
              onChange={(e) => {
                const newUrl = e.target.value.trim();
                if (setConnectedSpreadsheetUrl) {
                  setConnectedSpreadsheetUrl(newUrl);
                  const match = newUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
                  if (match && match[1] && setConnectedSpreadsheetId) {
                    setConnectedSpreadsheetId(match[1]);
                  }
                }
              }}
              placeholder="Enter Spreadsheet URL"
              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-lg px-3 py-2 text-xs font-mono outline-hidden transition-all text-zinc-800 dark:text-zinc-200"
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-zinc-50 dark:bg-zinc-950/40 p-3 rounded-lg border border-zinc-200/50 dark:border-zinc-850/50">
          <div className="text-[11px] text-zinc-500 font-sans leading-normal">
            {token ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                ● Connected to Google Account. Changes will synchronize with Sheets automatically.
              </span>
            ) : (
              <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1 animate-pulse">
                ⚠️ Google Workspace offline. Currently running in local caching mode. Connect via Top-Bar Auth banner.
              </span>
            )}
          </div>
          <button
            onClick={async () => {
              logActivity(`Updated Google Spreadsheet connection settings. Target ID: ${connectedSpreadsheetId}`);
              if (connectedSpreadsheetId) {
                try {
                  await saveSpreadsheetConfig(connectedSpreadsheetId, connectedSpreadsheetUrl || '');
                } catch (e) {
                  console.error("Failed to save spreadsheet config to Firestore:", e);
                }
              }
              alert("Spreadsheet connection settings saved successfully and synced globally!");
            }}
            className="px-4 py-1.5 bg-zinc-900 dark:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-white font-bold text-[10px] uppercase tracking-wider rounded-lg transition-all cursor-pointer"
          >
            Save Settings
          </button>
        </div>
      </div>

      {/* 📈 Workforce & Operational Audit Reports Engine */}
      <div id="admin-reports" className="bg-white dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800/80 rounded-xl p-5 space-y-5 shadow-xs">
        <div className="border-b border-zinc-200 dark:border-zinc-800/85 pb-3">
          <h3 className="font-bold text-zinc-850 dark:text-zinc-100 text-sm flex items-center gap-1.5 font-sans">
            <FileText className="w-5 h-5 text-amber-500" />
            Workforce & Operational Audit Reports Engine
          </h3>
          <p className="text-[11px] text-zinc-500">
            Generate, filter, and audit granular compliance reports day-by-day, month-by-month, or on a precision custom date & time range.
          </p>
        </div>

        {/* Filters Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-sans">
          <div>
            <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block mb-1">Dataset to Audit</label>
            <select
              value={repType}
              onChange={(e) => {
                setRepType(e.target.value as any);
                setRepSearch('');
              }}
              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded-lg px-3 py-2 text-zinc-850 dark:text-zinc-150 focus:outline-none focus:border-amber-500 font-medium"
            >
              <option value="breaks">☕ Breaks Compliance Audit Log</option>
              <option value="sessions">💼 Agent Sessions & On-Duty Shifts</option>
              <option value="tickets">🎫 Support SLA Tickets Archive</option>
              <option value="contacts">👥 CRM Customer Directory Logs</option>
              <option value="roster">🗓️ Historic Shift Rosters & Schedule</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block mb-1">Time Filtering Mode</label>
            <select
              value={repDateMode}
              onChange={(e) => setRepDateMode(e.target.value as any)}
              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded-lg px-3 py-2 text-zinc-850 dark:text-zinc-150 focus:outline-none focus:border-amber-500 font-medium"
            >
              <option value="all">🗓️ All Time (Full History)</option>
              <option value="day">📅 Specific Date (Day-by-Day)</option>
              <option value="month">📆 Specific Month (Month-by-Month)</option>
              <option value="range">⏱️ Precision Date & Time Range</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block mb-1">Target Agent</label>
            <select
              value={repAgentId}
              onChange={(e) => setRepAgentId(e.target.value)}
              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded-lg px-3 py-2 text-zinc-850 dark:text-zinc-150 focus:outline-none focus:border-amber-500 font-medium"
            >
              <option value="all">👥 All Active Representatives</option>
              {agentCredentials.map(agent => (
                <option key={agent.agentId} value={agent.agentId}>{agent.name} ({agent.agentId})</option>
              ))}
            </select>
          </div>

          <div>
            {repDateMode === 'day' && (
              <>
                <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block mb-1">Select Date</label>
                <input
                  type="date"
                  value={repDate}
                  onChange={(e) => setRepDate(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-lg px-3 py-1.5 text-xs text-zinc-850 dark:text-zinc-150 outline-hidden transition-all"
                />
              </>
            )}
            {repDateMode === 'month' && (
              <>
                <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block mb-1">Select Month</label>
                <input
                  type="month"
                  value={repMonth}
                  onChange={(e) => setRepMonth(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-lg px-3 py-1.5 text-xs text-zinc-850 dark:text-zinc-150 outline-hidden transition-all"
                />
              </>
            )}
            {repDateMode === 'range' && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase block mb-1">Start Time</label>
                  <input
                    type="datetime-local"
                    value={repStartDate}
                    onChange={(e) => setRepStartDate(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-lg p-1 text-[10px] text-zinc-850 dark:text-zinc-150 outline-hidden transition-all"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase block mb-1">End Time</label>
                  <input
                    type="datetime-local"
                    value={repEndDate}
                    onChange={(e) => setRepEndDate(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-lg p-1 text-[10px] text-zinc-850 dark:text-zinc-150 outline-hidden transition-all"
                  />
                </div>
              </div>
            )}
            {repDateMode === 'all' && (
              <div className="flex items-center justify-center h-full pt-4">
                <span className="text-[10px] text-zinc-400 dark:text-zinc-550 italic">No date bounds configured</span>
              </div>
            )}
          </div>
        </div>

        {/* Real-time Keyword Search & Summary Section */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 pt-1 border-t border-zinc-100 dark:border-zinc-850">
          <div className="relative max-w-md w-full">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder={`Search keywords within filtered ${repType} records...`}
              value={repSearch}
              onChange={(e) => setRepSearch(e.target.value)}
              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded-lg pl-9 pr-3 py-1.5 text-xs text-zinc-805 dark:text-zinc-200 focus:outline-none focus:border-amber-500 font-mono placeholder:text-zinc-500"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-zinc-400 font-mono">
              Filtered Dataset Size:
            </span>
            <span className="bg-amber-100/60 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-700 dark:text-amber-400 font-mono font-bold text-xs px-2.5 py-0.5 rounded-md">
              {repType === 'breaks' && getFilteredBreaks().length}
              {repType === 'sessions' && getFilteredSessions().length}
              {repType === 'tickets' && getFilteredTickets().length}
              {repType === 'contacts' && getFilteredContacts().length}
              {repType === 'roster' && getFilteredRoster().length} records
            </span>
          </div>
        </div>

        {/* Dynamic Analytics & Statistics Preview Card */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {repType === 'breaks' && (() => {
            const list = getFilteredBreaks();
            const completed = list.filter(b => b.status === 'completed');
            const overruns = list.filter(b => b.duration && isBreakOverrun(b.reason, b.duration));
            const totalDur = list.reduce((acc, b) => acc + (b.duration || 0), 0);
            const avgDur = completed.length > 0 ? Math.round(totalDur / completed.length / 60) : 0;
            const slaAdherence = list.length > 0 ? Math.round(((list.length - overruns.length) / list.length) * 100) : 100;

            return (
              <>
                <div className="bg-zinc-50/50 dark:bg-zinc-950/20 border border-zinc-150 dark:border-zinc-850 p-3 rounded-lg text-left">
                  <span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-550 uppercase block">Total Breaks Taken</span>
                  <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300 font-mono">{list.length}</span>
                </div>
                <div className="bg-zinc-50/50 dark:bg-zinc-950/20 border border-zinc-150 dark:border-zinc-850 p-3 rounded-lg text-left">
                  <span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-550 uppercase block">Compliance Overruns</span>
                  <span className={`text-sm font-bold font-mono ${overruns.length > 0 ? 'text-red-500 font-extrabold animate-pulse' : 'text-zinc-700 dark:text-zinc-300'}`}>{overruns.length}</span>
                </div>
                <div className="bg-zinc-50/50 dark:bg-zinc-950/20 border border-zinc-150 dark:border-zinc-850 p-3 rounded-lg text-left">
                  <span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-550 uppercase block">Avg Break Length</span>
                  <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300 font-mono">{avgDur} mins</span>
                </div>
                <div className="bg-zinc-50/50 dark:bg-zinc-950/20 border border-zinc-150 dark:border-zinc-850 p-3 rounded-lg text-left">
                  <span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-550 uppercase block">SLA Compliance Rate</span>
                  <span className={`text-sm font-bold font-mono ${slaAdherence < 90 ? 'text-amber-500' : 'text-emerald-500'}`}>{slaAdherence}%</span>
                </div>
              </>
            );
          })()}

          {repType === 'sessions' && (() => {
            const list = getFilteredSessions();
            const active = list.filter(s => s.status !== 'offline');
            const totalShiftSecs = list.reduce((acc, s) => acc + (s.shiftTimer || 0), 0);
            const totalHours = Math.round(totalShiftSecs / 3600);
            const avgShiftMins = list.length > 0 ? Math.round((totalShiftSecs / list.length) / 60) : 0;

            return (
              <>
                <div className="bg-zinc-50/50 dark:bg-zinc-950/20 border border-zinc-150 dark:border-zinc-850 p-3 rounded-lg text-left">
                  <span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-550 uppercase block">Total Duty Sessions</span>
                  <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300 font-mono">{list.length}</span>
                </div>
                <div className="bg-zinc-50/50 dark:bg-zinc-950/20 border border-zinc-150 dark:border-zinc-850 p-3 rounded-lg text-left">
                  <span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-550 uppercase block">Representatives Active</span>
                  <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300 font-mono text-emerald-500">{active.length} online</span>
                </div>
                <div className="bg-zinc-50/50 dark:bg-zinc-950/20 border border-zinc-150 dark:border-zinc-850 p-3 rounded-lg text-left">
                  <span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-550 uppercase block">Cumulative Duty Volume</span>
                  <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300 font-mono">{totalHours} hrs</span>
                </div>
                <div className="bg-zinc-50/50 dark:bg-zinc-950/20 border border-zinc-150 dark:border-zinc-850 p-3 rounded-lg text-left">
                  <span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-550 uppercase block">Avg Shift Session Duration</span>
                  <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300 font-mono">{Math.floor(avgShiftMins / 60)}h {avgShiftMins % 60}m</span>
                </div>
              </>
            );
          })()}

          {repType === 'tickets' && (() => {
            const list = getFilteredTickets();
            const resolved = list.filter(t => t.status === 'Resolved' || t.status === 'Closed');
            const openRatio = list.length > 0 ? Math.round(((list.length - resolved.length) / list.length) * 100) : 0;
            const critical = list.filter(t => t.priority === 'Urgent' || t.priority === 'High');

            return (
              <>
                <div className="bg-zinc-50/50 dark:bg-zinc-950/20 border border-zinc-150 dark:border-zinc-850 p-3 rounded-lg text-left">
                  <span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-550 uppercase block">Support Tickets Tracked</span>
                  <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300 font-mono">{list.length}</span>
                </div>
                <div className="bg-zinc-50/50 dark:bg-zinc-950/20 border border-zinc-150 dark:border-zinc-850 p-3 rounded-lg text-left">
                  <span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-550 uppercase block">Tickets Resolved / Closed</span>
                  <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300 font-mono text-emerald-500">{resolved.length} resolved</span>
                </div>
                <div className="bg-zinc-50/50 dark:bg-zinc-950/20 border border-zinc-150 dark:border-zinc-850 p-3 rounded-lg text-left">
                  <span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-550 uppercase block">Active Backlog Ratio</span>
                  <span className={`text-sm font-bold font-mono ${openRatio > 50 ? 'text-amber-500' : 'text-zinc-650'}`}>{openRatio}% open</span>
                </div>
                <div className="bg-zinc-50/50 dark:bg-zinc-950/20 border border-zinc-150 dark:border-zinc-850 p-3 rounded-lg text-left">
                  <span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-550 uppercase block">Urgent & High SLA Priority</span>
                  <span className={`text-sm font-bold font-mono ${critical.length > 0 ? 'text-red-500 font-extrabold' : 'text-zinc-700 dark:text-zinc-300'}`}>{critical.length} critical</span>
                </div>
              </>
            );
          })()}

          {repType === 'contacts' && (() => {
            const list = getFilteredContacts();
            const vips = list.filter(c => c.status === 'VIP');
            const leads = list.filter(c => c.status === 'Lead');
            const regular = list.filter(c => c.status !== 'VIP' && c.status !== 'Lead');

            return (
              <>
                <div className="bg-zinc-50/50 dark:bg-zinc-950/20 border border-zinc-150 dark:border-zinc-850 p-3 rounded-lg text-left">
                  <span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-550 uppercase block">CRM Contacts Records</span>
                  <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300 font-mono">{list.length}</span>
                </div>
                <div className="bg-zinc-50/50 dark:bg-zinc-950/20 border border-zinc-150 dark:border-zinc-850 p-3 rounded-lg text-left">
                  <span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-550 uppercase block">VIP Classification</span>
                  <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300 font-mono text-purple-500">{vips.length} VIPs</span>
                </div>
                <div className="bg-zinc-50/50 dark:bg-zinc-950/20 border border-zinc-150 dark:border-zinc-850 p-3 rounded-lg text-left">
                  <span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-550 uppercase block">Marketing Leads</span>
                  <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300 font-mono text-blue-500">{leads.length} leads</span>
                </div>
                <div className="bg-zinc-50/50 dark:bg-zinc-950/20 border border-zinc-150 dark:border-zinc-850 p-3 rounded-lg text-left">
                  <span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-550 uppercase block">Standard/Enterprise</span>
                  <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300 font-mono">{regular.length} accounts</span>
                </div>
              </>
            );
          })()}

          {repType === 'roster' && (() => {
            const list = getFilteredRoster();
            return (
              <>
                <div className="bg-zinc-50/50 dark:bg-zinc-950/20 border border-zinc-150 dark:border-zinc-850 p-3 rounded-lg text-left">
                  <span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-550 uppercase block">Scheduled Shift Days</span>
                  <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300 font-mono">{list.length} days</span>
                </div>
                <div className="bg-zinc-50/50 dark:bg-zinc-950/20 border border-zinc-150 dark:border-zinc-850 p-3 rounded-lg text-left">
                  <span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-550 uppercase block">Month Context</span>
                  <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 font-mono uppercase">{repMonth}</span>
                </div>
                <div className="bg-zinc-50/50 dark:bg-zinc-950/20 border border-zinc-150 dark:border-zinc-850 p-3 rounded-lg text-left">
                  <span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-550 uppercase block">Roster Year Context</span>
                  <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300 font-mono">2026</span>
                </div>
                <div className="bg-zinc-50/50 dark:bg-zinc-950/20 border border-zinc-150 dark:border-zinc-850 p-3 rounded-lg text-left">
                  <span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-550 uppercase block">Source Hub</span>
                  <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 font-sans uppercase text-amber-500">Google Sheet Tab</span>
                </div>
              </>
            );
          })()}
        </div>

        {/* Real-time Interactive Preview Table */}
        <div className="border border-zinc-200 dark:border-zinc-850 rounded-xl overflow-hidden text-xs">
          <div className="bg-zinc-50 dark:bg-zinc-950/60 px-4 py-2 border-b border-zinc-200 dark:border-zinc-850 flex items-center justify-between">
            <span className="font-bold text-[10px] text-zinc-400 uppercase tracking-wider font-mono">Real-time Audited Dataset Preview</span>
            <span className="text-[10px] text-zinc-500 italic">Showing up to 100 recent rows</span>
          </div>

          <div className="overflow-x-auto max-h-[220px] overflow-y-auto">
            {repType === 'breaks' && (() => {
              const list = getFilteredBreaks().slice(0, 100);
              return list.length > 0 ? (
                <table className="w-full text-left font-mono text-[11px]">
                  <thead className="bg-zinc-100/60 dark:bg-zinc-900 text-zinc-450 uppercase text-[9px] font-bold border-b border-zinc-250 dark:border-zinc-855 text-zinc-500">
                    <tr>
                      <th className="py-2.5 px-3">Agent</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3">Start Time (UTC)</th>
                      <th className="py-2.5 px-3">End Time (UTC)</th>
                      <th className="py-2.5 px-3">Duration</th>
                      <th className="py-2.5 px-3 text-right">Compliance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900 text-zinc-700 dark:text-zinc-300">
                    {list.map((b, idx) => {
                      const isOver = b.duration && isBreakOverrun(b.reason, b.duration);
                      return (
                        <tr key={idx} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-850/10">
                          <td className="py-2 px-3 font-sans font-semibold text-zinc-850 dark:text-zinc-200">{b.agentName}</td>
                          <td className="py-2 px-3"><span className="bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-650 dark:text-zinc-400 uppercase text-[9px] font-bold">{b.reason}</span></td>
                          <td className="py-2 px-3 text-[10px]">{b.startTime ? new Date(b.startTime).toLocaleString() : 'N/A'}</td>
                          <td className="py-2 px-3 text-[10px]">{b.endTime ? new Date(b.endTime).toLocaleString() : <span className="text-amber-500 animate-pulse font-bold">Active (Ongoing)</span>}</td>
                          <td className="py-2 px-3">{b.duration ? `${Math.floor(b.duration / 60)}m ${b.duration % 60}s` : 'N/A'}</td>
                          <td className="py-2 px-3 text-right">
                            {b.status === 'active' ? (
                              <span className="bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 px-2 py-0.5 rounded text-[10px] font-bold">Ongoing</span>
                            ) : isOver ? (
                              <span className="bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400 px-2 py-0.5 rounded text-[10px] font-bold animate-pulse">🚨 OVERRUN</span>
                            ) : (
                              <span className="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 px-2 py-0.5 rounded text-[10px] font-bold">✓ COMPLIANT</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="py-12 text-center text-zinc-400 italic">No matching break records found for the selected criteria.</div>
              );
            })()}

            {repType === 'sessions' && (() => {
              const list = getFilteredSessions().slice(0, 100);
              return list.length > 0 ? (
                <table className="w-full text-left font-mono text-[11px]">
                  <thead className="bg-zinc-100/60 dark:bg-zinc-900 text-zinc-450 uppercase text-[9px] font-bold border-b border-zinc-250 dark:border-zinc-855 text-zinc-500">
                    <tr>
                      <th className="py-2.5 px-3">Agent</th>
                      <th className="py-2.5 px-3">Duty Status</th>
                      <th className="py-2.5 px-3">Check-in Login Time</th>
                      <th className="py-2.5 px-3">Last Active</th>
                      <th className="py-2.5 px-3">Cumulative Shift</th>
                      <th className="py-2.5 px-3">Total Breaks Duration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900 text-zinc-700 dark:text-zinc-300">
                    {list.map((s, idx) => (
                      <tr key={idx} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-850/10">
                        <td className="py-2 px-3 font-sans font-semibold text-zinc-850 dark:text-zinc-200">{s.name}</td>
                        <td className="py-2 px-3">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                            s.status === 'offline' 
                              ? 'bg-zinc-100 text-zinc-500 dark:bg-zinc-850 dark:text-zinc-450' 
                              : s.status === 'on_break' 
                              ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400 animate-pulse'
                              : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400'
                          }`}>
                            {s.status === 'on_break' ? `On Break: ${s.currentActivity}` : s.status}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-[10px]">{s.loginTime ? new Date(s.loginTime).toLocaleString() : 'N/A'}</td>
                        <td className="py-2 px-3 text-[10px]">{s.lastActive ? new Date(s.lastActive).toLocaleTimeString() : 'N/A'}</td>
                        <td className="py-2 px-3">{s.shiftTimer ? `${Math.floor(s.shiftTimer / 3600)}h ${Math.floor((s.shiftTimer % 3600) / 60)}m` : '0m'}</td>
                        <td className="py-2 px-3">{s.breakTimer ? `${Math.floor(s.breakTimer / 60)}m ${s.breakTimer % 60}s` : '0m'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="py-12 text-center text-zinc-400 italic">No active or historical representative sessions found.</div>
              );
            })()}

            {repType === 'tickets' && (() => {
              const list = getFilteredTickets().slice(0, 100);
              return list.length > 0 ? (
                <table className="w-full text-left font-mono text-[11px]">
                  <thead className="bg-zinc-100/60 dark:bg-zinc-900 text-zinc-450 uppercase text-[9px] font-bold border-b border-zinc-250 dark:border-zinc-855 text-zinc-500">
                    <tr>
                      <th className="py-2.5 px-3">ID</th>
                      <th className="py-2.5 px-3">Customer Context</th>
                      <th className="py-2.5 px-3">Subject / Issue</th>
                      <th className="py-2.5 px-3">Priority</th>
                      <th className="py-2.5 px-3">SLA Status</th>
                      <th className="py-2.5 px-3">Creation Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900 text-zinc-700 dark:text-zinc-300">
                    {list.map((t, idx) => (
                      <tr key={idx} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-850/10">
                        <td className="py-2 px-3 font-semibold text-amber-500">{t.id}</td>
                        <td className="py-2 px-3 font-sans font-semibold text-zinc-800 dark:text-zinc-200">{t.contactName}</td>
                        <td className="py-2 px-3 font-sans max-w-xs truncate">{t.title}</td>
                        <td className="py-2 px-3">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${
                            t.priority === 'Urgent' || t.priority === 'High'
                              ? 'bg-red-50 text-red-600 border-red-200 dark:bg-red-950/40 dark:border-red-900/60'
                              : 'bg-zinc-50 text-zinc-600 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-400'
                          }`}>
                            {t.priority}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                            t.status === 'Resolved' || t.status === 'Closed'
                              ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 text-emerald-400'
                              : 'bg-amber-50 text-amber-600 dark:bg-amber-950/30 text-amber-400'
                          }`}>
                            {t.status}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-[10px]">{t.createdAt ? new Date(t.createdAt).toLocaleString() : 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="py-12 text-center text-zinc-400 italic">No tickets found for selected range.</div>
              );
            })()}

            {repType === 'contacts' && (() => {
              const list = getFilteredContacts().slice(0, 100);
              return list.length > 0 ? (
                <table className="w-full text-left font-mono text-[11px]">
                  <thead className="bg-zinc-100/60 dark:bg-zinc-900 text-zinc-450 uppercase text-[9px] font-bold border-b border-zinc-250 dark:border-zinc-855 text-zinc-500">
                    <tr>
                      <th className="py-2.5 px-3">Customer ID</th>
                      <th className="py-2.5 px-3">Full Name</th>
                      <th className="py-2.5 px-3">Company</th>
                      <th className="py-2.5 px-3">Email Directory</th>
                      <th className="py-2.5 px-3">Classification</th>
                      <th className="py-2.5 px-3">Last Contact Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900 text-zinc-700 dark:text-zinc-300">
                    {list.map((c, idx) => (
                      <tr key={idx} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-850/10">
                        <td className="py-2 px-3 text-amber-500 font-semibold">{c.id}</td>
                        <td className="py-2 px-3 font-sans font-semibold text-zinc-800 dark:text-zinc-200">{c.name}</td>
                        <td className="py-2 px-3 font-sans">{c.company}</td>
                        <td className="py-2 px-3 font-mono">{c.email}</td>
                        <td className="py-2 px-3">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                            c.status === 'VIP' 
                              ? 'bg-purple-50 text-purple-600 border border-purple-250 dark:bg-purple-950/40 dark:text-purple-400' 
                              : c.status === 'Lead'
                              ? 'bg-blue-50 text-blue-600 border border-blue-200 dark:bg-blue-950/40'
                              : 'bg-zinc-50 text-zinc-600 border border-zinc-200'
                          }`}>
                            {c.status}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-[10px]">{c.lastContactDate ? new Date(c.lastContactDate).toLocaleString() : 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="py-12 text-center text-zinc-400 italic">No contact entries matched date criteria.</div>
              );
            })()}

            {repType === 'roster' && (() => {
              const list = getFilteredRoster().slice(0, 100);
              return list.length > 0 ? (
                <table className="w-full text-left font-mono text-[11px]">
                  <thead className="bg-zinc-100/60 dark:bg-zinc-900 text-zinc-450 uppercase text-[9px] font-bold border-b border-zinc-250 dark:border-zinc-855 text-zinc-500">
                    <tr>
                      <th className="py-2.5 px-3">Target Date</th>
                      <th className="py-2.5 px-3">Day</th>
                      <th className="py-2.5 px-3">Morning Duty</th>
                      <th className="py-2.5 px-3">Standard Day</th>
                      <th className="py-2.5 px-3">Afternoon Duty</th>
                      <th className="py-2.5 px-3">Evening / Night</th>
                      <th className="py-2.5 px-3">Off Duty Offs</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900 text-zinc-700 dark:text-zinc-300">
                    {list.map((day, idx) => (
                      <tr key={idx} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-850/10">
                        <td className="py-2 px-3 font-semibold text-amber-500">{day.date}</td>
                        <td className="py-2 px-3 font-sans font-semibold text-zinc-800 dark:text-zinc-200">{day.dayOfWeek}</td>
                        <td className="py-2 px-3 font-sans text-[10px] text-zinc-500">{(day.shifts?.morning || []).slice(0, 3).join(', ')}</td>
                        <td className="py-2 px-3 font-sans text-[10px] text-zinc-500">{(day.shifts?.standardDay || []).slice(0, 3).join(', ')}</td>
                        <td className="py-2 px-3 font-sans text-[10px] text-zinc-500">{(day.shifts?.afternoon || []).slice(0, 3).join(', ')}</td>
                        <td className="py-2 px-3 font-sans text-[10px] text-zinc-500">{[...(day.shifts?.evening || []), ...(day.shifts?.night || [])].slice(0, 3).join(', ')}</td>
                        <td className="py-2 px-3 font-sans text-[10px] text-red-400">{(day.shifts?.off || []).slice(0, 3).join(', ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="py-12 text-center text-zinc-400 italic">No scheduled workforce shift plans found.</div>
              );
            })()}
          </div>
        </div>

        {/* Action Triggers */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            onClick={handleExportCustomReport}
            className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-bold uppercase tracking-wider py-2.5 rounded-lg transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer text-xs"
          >
            <Download className="w-4 h-4" />
            Download Filtered CSV Report
          </button>
          
          <button
            onClick={handlePushReportToGoogleSheet}
            disabled={isPushingToSheet || !token}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold uppercase tracking-wider py-2.5 rounded-lg transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 text-xs"
          >
            <FileSpreadsheet className="w-4 h-4" />
            {isPushingToSheet ? 'Syncing to Google Sheets...' : 'Push Dataset to Connected Google Sheet'}
          </button>
        </div>
      </div>

      {/* Live workforce summary dashboard */}
      <div id="admin-live" className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total Sessions', value: liveAgentSessions.length, icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/10' },
          { label: 'On Duty', value: liveAgentSessions.filter((s) => s.status === 'available').length, icon: CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
          { label: 'On Break', value: liveAgentSessions.filter((s) => s.status === 'on_break').length, icon: Coffee, color: 'text-amber-500', bg: 'bg-amber-500/10' },
          { label: 'Break Overruns', value: liveAgentSessions.filter((s) => {
            if (s.status !== 'on_break') return false;
            const active = liveBreaks.find((b: any) => b.agentId === (s.agentId || s.id) && b.status === 'active');
            const started = active?.startTime || s.lastActive;
            return isBreakOverrun(s.currentActivity, Math.max(0, Math.floor((monitorNow - new Date(started).getTime()) / 1000)));
          }).length, icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-500/10' },
        ].map((card) => (
          <div key={card.label} className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg ${card.bg} ${card.color} flex items-center justify-center`}><card.icon className="w-4 h-4" /></div>
            <div><p className="text-[9px] text-zinc-400 uppercase tracking-wider font-bold">{card.label}</p><p className={`text-xl font-black font-mono ${card.color}`}>{card.value}</p></div>
          </div>
        ))}
      </div>

      {/* Live break monitoring board */}
      <div className="bg-white dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800/80 rounded-xl p-5 space-y-3 shadow-xs">
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
          <div className="flex items-center gap-2"><Coffee className="w-5 h-5 text-amber-500 animate-pulse" /><div><h3 className="font-bold text-sm">Live Break Monitoring</h3><p className="text-[10px] text-zinc-500">All active breaks update in real time.</p></div></div>
          <span className="text-[10px] font-mono font-bold text-amber-500">{liveBreaks.length} ACTIVE</span>
        </div>
        {liveAgentSessions.filter((s) => s.status === 'on_break').length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {liveAgentSessions.filter((s) => s.status === 'on_break').map((sess) => {
              const active = liveBreaks.find((b: any) => b.agentId === (sess.agentId || sess.id) && b.status === 'active');
              const started = active?.startTime || sess.lastActive;
              const seconds = Math.max(0, Math.floor((monitorNow - new Date(started).getTime()) / 1000));
              const over = isBreakOverrun(sess.currentActivity, seconds);
              return <div key={sess.agentId || sess.id} className={`rounded-lg border p-3 ${over ? 'border-red-400 bg-red-500/10' : 'border-amber-500/30 bg-amber-500/5'}`}>
                <div className="flex justify-between gap-2"><span className="font-bold text-xs truncate">{sess.name}</span><span className={`text-[9px] font-mono font-bold uppercase ${over ? 'text-red-500' : 'text-amber-500'}`}>{over ? 'OVERRUN' : 'ON BREAK'}</span></div>
                <div className="flex justify-between mt-2 text-[10px] font-mono text-zinc-500"><span>{sess.currentActivity}</span><span className="font-bold">{Math.floor(seconds / 60)}m {seconds % 60}s</span></div>
              </div>;
            })}
          </div>
        ) : <div className="text-center py-5 text-xs italic text-zinc-500">No agents are currently on break.</div>}
      </div>

      {/* Knowledge Base management */}
      <div id="admin-kb" className="bg-white dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800/80 rounded-xl p-5 space-y-4 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800 pb-3">
          <div><h3 className="font-bold text-sm flex items-center gap-2"><BookOpen className="w-5 h-5 text-purple-500" /> Knowledge Base Management</h3><p className="text-[10px] text-zinc-500">Add, edit, search and remove internal support articles.</p></div>
          <div className="flex gap-2"><input value={kbSearch} onChange={(e) => setKbSearch(e.target.value)} placeholder="Search articles..." className="w-44 bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-xs" /><button onClick={resetKbForm} className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-bold uppercase rounded-lg"><Plus className="w-3 h-3 inline mr-1" />New Article</button></div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-1 max-h-80 overflow-y-auto space-y-2 pr-1">{visibleKbArticles.map((article) => <div key={article.id} className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-3"><div className="flex justify-between gap-2"><div><p className="text-xs font-bold truncate">{article.title}</p><p className="text-[9px] text-purple-500 uppercase">{article.category}</p></div><div className="flex gap-1"><button onClick={() => editKbArticle(article)} className="p-1 text-blue-500 hover:bg-blue-500/10 rounded"><Edit className="w-3 h-3" /></button><button onClick={() => deleteKbArticle(article)} className="p-1 text-red-500 hover:bg-red-500/10 rounded"><Trash2 className="w-3 h-3" /></button></div></div></div>)}</div>
          <div className="lg:col-span-2 space-y-3"><input value={kbForm.title} onChange={(e) => setKbForm({ ...kbForm, title: e.target.value })} placeholder="Article title" className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs" /><input value={kbForm.category} onChange={(e) => setKbForm({ ...kbForm, category: e.target.value })} placeholder="Category" className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs" /><textarea value={kbForm.content} onChange={(e) => setKbForm({ ...kbForm, content: e.target.value })} placeholder="Article content / SOP..." className="w-full min-h-40 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 text-xs leading-relaxed" /><div className="flex justify-end gap-2"><button onClick={resetKbForm} className="px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg text-xs">Cancel</button><button onClick={saveKbArticle} disabled={!kbForm.title.trim() || !kbForm.content.trim()} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold"><Save className="w-3 h-3 inline mr-1" />{kbEditingId ? 'Update Article' : 'Save Article'}</button></div></div>
        </div>
      </div>

      {/* Admin roster control center */}
      <div id="admin-roster" className="bg-white dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800/80 rounded-xl p-5 space-y-4 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800 pb-3">
          <div><h3 className="font-bold text-sm flex items-center gap-2"><Calendar className="w-5 h-5 text-blue-500" /> Roster Control Center</h3><p className="text-[10px] text-zinc-500">Monitor and edit every date and shift. Changes are saved to Firestore automatically.</p></div>
          <div className="flex gap-2"><select value={adminRosterDate} onChange={(e) => setAdminRosterDate(e.target.value)} className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-lg px-2 py-2 text-xs font-mono">{rosterDays.map((day) => <option key={day.date} value={day.date}>{day.date}</option>)}</select><button onClick={regenerateAdminRoster} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold uppercase rounded-lg"><RefreshCw className="w-3 h-3 inline mr-1" />Regenerate Month</button></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {rosterShiftKeys.map((key) => <label key={key} className="space-y-1"><span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">{key.replace(/([A-Z])/g, ' $1')}</span><textarea value={adminRosterDraft[key] || ''} onChange={(e) => setAdminRosterDraft({ ...adminRosterDraft, [key]: e.target.value })} placeholder="Agent names, comma separated" className="w-full min-h-20 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-2 text-[10px] font-sans" /></label>)}
        </div>
        <div className="flex items-center justify-between gap-3"><span className="text-[10px] text-zinc-500">{rosterDays.length} roster days loaded • edits are audit logged</span><button onClick={saveAdminRosterOverride} disabled={!adminRosterDate} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold uppercase rounded-lg"><Save className="w-3.5 h-3.5 inline mr-1" />Save Roster Changes</button></div>
      </div>

      {/* 🚨 Unified Real-time Live Agent Monitor & Overrun Compliance */}
      <div className="bg-white dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800/80 rounded-xl p-5 space-y-4 shadow-xs">
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800/80 pb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-red-500 animate-pulse" />
            <div>
              <h3 className="font-bold text-zinc-800 dark:text-zinc-100 text-sm font-sans">Live Floor Agent Surveillance & Overrun Monitor</h3>
              <p className="text-[11px] text-zinc-500">
                Automated compliance tracking of active floor timers. Overruns highlight in red with flash indicators.
              </p>
            </div>
          </div>
          <span className="bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 text-amber-600 dark:text-amber-400 font-mono font-bold text-[10px] px-3 py-1 rounded-full uppercase tracking-wider shrink-0">
            {liveAgentSessions.filter(s => s.status !== 'offline').length} Floor Agents Active
          </span>
        </div>

        {liveAgentSessions.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {liveAgentSessions.map((sess, idx) => {
              // Calculate duration from last active timestamp
              const activeSec = Math.floor((Date.now() - new Date(sess.lastActive).getTime()) / 1000);
              const isOver = sess.status === 'on_break' && isBreakOverrun(sess.currentActivity, activeSec);
              const limitMin = getBreakLimitMinutes(sess.currentActivity);

              let statusColor = 'bg-emerald-50 border-emerald-200 text-emerald-600 dark:bg-emerald-950/40 dark:border-emerald-900/60 dark:text-emerald-400';
              if (sess.status === 'on_break') {
                statusColor = isOver 
                  ? 'bg-red-50 border-red-300 text-red-600 dark:bg-red-950/50 dark:border-red-900 dark:text-red-400 animate-flash-red'
                  : 'bg-amber-50 border-amber-200 text-amber-600 dark:bg-amber-950/40 dark:border-amber-900/60 dark:text-amber-400 animate-pulse';
              }

              return (
                <div 
                  key={idx} 
                  className={`border rounded-xl p-4 flex flex-col justify-between shadow-xs transition-all relative overflow-hidden ${
                    isOver 
                      ? 'border-red-400 bg-red-50/20 dark:bg-red-950/20 animate-pulse' 
                      : 'border-zinc-200 dark:border-zinc-850 bg-white dark:bg-zinc-950/50'
                  }`}
                >
                  <div className="flex justify-between items-start gap-2 z-10">
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 block truncate">{sess.name}</span>
                      <span className="text-[9px] font-mono text-zinc-400 dark:text-zinc-550 block uppercase">ID: {sess.id}</span>
                    </div>
                    <span className={`text-[9px] font-mono font-bold border px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0 ${statusColor}`}>
                      {sess.status === 'on_break' ? `Break: ${sess.currentActivity.replace('_', ' ')}` : 'On Duty'}
                    </span>
                  </div>

                  <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-900/60 grid grid-cols-2 gap-2 text-[10px] font-mono text-zinc-500 z-10">
                    <div>
                      <span className="text-[8px] text-zinc-400 uppercase block">Duration Active</span>
                      <span className={`font-semibold ${isOver ? 'text-red-500 font-bold' : 'text-zinc-700 dark:text-zinc-300'}`}>
                        {Math.floor(activeSec / 60)}m {activeSec % 60}s
                      </span>
                    </div>
                    <div>
                      <span className="text-[8px] text-zinc-400 uppercase block">Threshold Limit</span>
                      <span className="text-zinc-700 dark:text-zinc-300 font-semibold">{limitMin > 0 ? `${limitMin} mins` : 'None'}</span>
                    </div>
                  </div>

                  {/* Override controls */}
                  <div className="mt-3.5 pt-2.5 border-t border-zinc-100 dark:border-zinc-900/40 flex justify-between items-center z-10">
                    <span className="text-[9px] font-mono text-zinc-400 flex items-center gap-1 shrink-0">
                      {isOver && <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 animate-ping"></span>}
                      {sess.status === 'on_break' ? (isOver ? 'LIMIT OVERRUN' : 'COMPLIANT') : 'AVAILABLE'}
                    </span>
                    <button
                      onClick={() => handleForceStatusAvailable(sess)}
                      className="px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white font-mono font-bold text-[9px] uppercase rounded transition-all cursor-pointer shrink-0"
                    >
                      Admin Override / Force Available
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center gap-3 bg-zinc-100/50 dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-850 rounded-xl p-4 text-zinc-500 text-xs font-serif">
            <Clock className="w-5 h-5 text-zinc-450 shrink-0" />
            <p className="italic">No online agent sessions registered in local state or Firestore.</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* AGENT DIRECTORY & CREATION ENGINE (col-span-8) */}
        <div id="admin-access" className="lg:col-span-8 bg-white dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800/80 rounded-xl p-5 space-y-4 shadow-xs">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-zinc-200 dark:border-zinc-800/80 pb-3">
            <div>
              <h3 className="font-bold text-zinc-850 dark:text-zinc-100 text-sm">Credentials & Personnel Directory</h3>
              <p className="text-[11px] text-zinc-500">Query and synchronize workforce credentials with sheets.</p>
            </div>
            <div className="relative max-w-xs w-full">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search staff directory..."
                value={credSearch}
                onChange={(e) => setCredSearch(e.target.value)}
                className="bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded-lg pl-9 pr-3 py-1.5 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-amber-500 w-full font-mono placeholder:text-zinc-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="sticky top-0 bg-white dark:bg-zinc-900 text-zinc-400 uppercase tracking-wider text-[9px] font-bold border-b border-zinc-200 dark:border-zinc-800">
                <tr>
                  <th className="py-2.5 px-3">Agent ID</th>
                  <th className="py-2.5 px-3">Full Name</th>
                  <th className="py-2.5 px-3">Password</th>
                  <th className="py-2.5 px-3 text-center">Role</th>
                  <th className="py-2.5 px-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900 text-zinc-750 dark:text-zinc-300">
                {filteredCredentials.map((cred, idx) => (
                  <tr key={idx} className="hover:bg-zinc-50 dark:hover:bg-zinc-850/20">
                    <td className="py-2.5 px-3 font-semibold text-amber-600 dark:text-amber-400">{cred.agentId}</td>
                    <td className="py-2.5 px-3 font-sans font-semibold text-zinc-800 dark:text-zinc-100">{cred.name}</td>
                    <td className="py-2.5 px-3 text-zinc-500 select-all font-mono">{cred.passwordHash}</td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border font-sans ${
                        cred.role === 'ADMIN'
                          ? 'bg-red-50 text-red-600 border-red-200 dark:bg-red-950/40 dark:border-red-900/60 dark:text-red-400'
                          : 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/40 dark:border-blue-900/60 dark:text-blue-400'
                      }`}>
                        {cred.role}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => handleResetPassword(cred.agentId)}
                        className="p-1 border border-zinc-200 dark:border-zinc-800 text-zinc-600 hover:text-amber-500 dark:text-zinc-400 rounded cursor-pointer shrink-0"
                        title="Reset password"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleRevokeAccess(cred.agentId)}
                        className="p-1 border border-zinc-200 dark:border-zinc-800 text-red-500 hover:text-red-700 rounded cursor-pointer shrink-0"
                        title="Revoke access"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* AGENT CREATION ENGINE FORM (col-span-4) */}
        <div className="lg:col-span-4 bg-white dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800/80 rounded-xl p-5 space-y-4 shadow-xs">
          <div className="border-b border-zinc-200 dark:border-zinc-800/80 pb-3">
            <h3 className="font-bold text-zinc-850 dark:text-zinc-100 text-sm flex items-center gap-1.5 font-sans">
              <Plus className="w-4 h-4 text-amber-500" />
              Agent Creation Engine
            </h3>
            <p className="text-[11px] text-zinc-500">Register new staff with cloud access. Google Sheets sync is optional.</p>
          </div>

          <form onSubmit={handleCreateAgent} className="space-y-4 text-xs font-sans">
            {creationError && (
              <div className="p-2.5 bg-red-50 border border-red-200 text-red-600 text-[11px] rounded flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {creationError}
              </div>
            )}

            {creationSuccess && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-600 text-[11px] rounded flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 shrink-0" />
                {creationSuccess}
              </div>
            )}

            <div>
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">Agent Username / ID *</label>
              <input
                type="text"
                required
                placeholder="Enter agent ID"
                value={newAgentId}
                onChange={(e) => setNewAgentId(e.target.value.toLowerCase().trim())}
                className="w-full bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500 text-zinc-850 dark:text-zinc-100"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">Full Representative Name *</label>
              <input
                type="text"
                required
                placeholder="Enter full name"
                value={newAgentName}
                onChange={(e) => setNewAgentName(e.target.value)}
                className="w-full bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500 text-zinc-850 dark:text-zinc-100"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">Temporary Plaintext Password *</label>
              <input
                type="text"
                required
                placeholder="Enter password"
                value={newAgentPass}
                onChange={(e) => setNewAgentPass(e.target.value)}
                className="w-full bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500 text-zinc-850 dark:text-zinc-100 font-mono"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">Authorized Account Role</label>
              <select
                value={newAgentRole}
                onChange={(e) => setNewAgentRole(e.target.value as 'AGENT' | 'ADMIN')}
                className="w-full bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500 text-zinc-850 dark:text-zinc-100 font-medium"
              >
                <option value="AGENT">AGENT (Operational CRM Panel)</option>
                <option value="ADMIN">ADMIN ( Roster, Override & Credentials Control)</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold uppercase tracking-wider py-2.5 rounded-lg transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Creating cloud account...' : 'Add Account to Directory'}
            </button>
          </form>
        </div>
      </div>

      {/* AUDIT & ACTIVITY LOGS */}
      <div id="admin-data" className="bg-white dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800/80 rounded-xl p-5 space-y-4 shadow-xs">
        <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800/80 pb-3">
          <Scroll className="w-5 h-5 text-amber-500" />
          <div>
            <h3 className="font-bold text-zinc-850 dark:text-zinc-100 text-sm font-sans">System Activity Logs & Administrative Audit</h3>
            <p className="text-[11px] text-zinc-500">Read-only historical chronicle of security modifications and staff updates in active session.</p>
          </div>
        </div>

        <div className="overflow-y-auto max-h-[180px] rounded-lg border border-zinc-150 dark:border-zinc-850 divide-y divide-zinc-100 dark:divide-zinc-900 text-xs font-mono">
          {systemLogs.length > 0 ? (
            systemLogs.map((log, idx) => (
              <div key={idx} className="p-2.5 bg-zinc-50/50 dark:bg-zinc-950/40 text-zinc-650 dark:text-zinc-400 flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                <span className="font-medium text-zinc-700 dark:text-zinc-300">{log.message}</span>
                <span className="text-[10px] text-zinc-400 dark:text-zinc-550 shrink-0">{new Date(log.timestamp).toLocaleTimeString()} ({new Date(log.timestamp).toLocaleDateString()})</span>
              </div>
            ))
          ) : (
            <div className="p-6 text-center text-zinc-400 italic text-xs font-serif">
              No administrative system logs recorded yet.
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
