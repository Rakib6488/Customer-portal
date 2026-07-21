import React, { useState, useEffect } from 'react';
import { 
  Users, Search, Plus, Trash2, Edit, AlertCircle, Calendar, 
  MessageSquare, ChevronRight, FileText, CheckCircle, Clock
} from 'lucide-react';
import { CRMContact, SupportTicket, TicketResponse } from '../types';
import { deleteCloudRecord } from '../firebase';

interface CrmSectionProps {
  contacts: CRMContact[];
  setContacts: React.Dispatch<React.SetStateAction<CRMContact[]>>;
  tickets: SupportTicket[];
  setTickets: React.Dispatch<React.SetStateAction<SupportTicket[]>>;
  token: string | null;
  agentName: string;
  createSupportDoc: (
    token: string,
    ticket: SupportTicket,
    contact?: CRMContact
  ) => Promise<{ documentId: string; documentUrl: string }>;
  logActivity: (message: string) => void;
  subTabDefault?: 'contacts' | 'tickets';
}

export default function CrmSection({
  contacts,
  setContacts,
  tickets,
  setTickets,
  token,
  agentName,
  createSupportDoc,
  logActivity,
  subTabDefault
}: CrmSectionProps) {
  // Tabs for sub-navigation in CRM Section
  const [subTab, setSubTab] = useState<'contacts' | 'tickets'>(subTabDefault || 'tickets');

  useEffect(() => {
    if (subTabDefault) {
      setSubTab(subTabDefault);
    }
  }, [subTabDefault]);
  
  // Search and Filter states
  const [contactSearch, setContactSearch] = useState('');
  const [ticketSearch, setTicketSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [priorityFilter, setPriorityFilter] = useState<string>('All');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');

  // Selected item detail states
  const [selectedContact, setSelectedContact] = useState<CRMContact | null>(contacts[0] || null);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(tickets[0] || null);

  // Modal / Form Edit states
  const [showContactModal, setShowContactModal] = useState(false);
  const [editingContact, setEditingContact] = useState<CRMContact | null>(null);
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    status: 'Lead' as CRMContact['status'],
    notes: ''
  });

  const [showTicketModal, setShowTicketModal] = useState(false);
  const [editingTicket, setEditingTicket] = useState<SupportTicket | null>(null);
  const [ticketForm, setTicketForm] = useState({
    contactId: '',
    title: '',
    priority: 'Medium' as SupportTicket['priority'],
    status: 'Open' as SupportTicket['status'],
    category: 'General' as SupportTicket['category'],
    description: ''
  });

  // Ticket reply state
  const [replyText, setReplyText] = useState('');
  const [isExportingDoc, setIsExportingDoc] = useState(false);
  const [exportedDocUrl, setExportedDocUrl] = useState<string | null>(null);

  // Handlers for Contacts
  const handleOpenContactModal = (contact: CRMContact | null = null) => {
    if (contact) {
      setEditingContact(contact);
      setContactForm({
        name: contact.name,
        email: contact.email,
        phone: contact.phone,
        company: contact.company,
        status: contact.status,
        notes: contact.notes
      });
    } else {
      setEditingContact(null);
      setContactForm({
        name: '',
        email: '',
        phone: '',
        company: '',
        status: 'Lead',
        notes: ''
      });
    }
    setShowContactModal(true);
  };

  const handleSaveContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingContact) {
      const updated = contacts.map(c => c.id === editingContact.id ? { 
        ...c, 
        ...contactForm, 
        lastContactDate: new Date().toISOString() 
      } : c);
      setContacts(updated);
      setSelectedContact({ ...editingContact, ...contactForm, lastContactDate: new Date().toISOString() });
      logActivity(`Updated CRM customer profile for "${contactForm.name}"`);
    } else {
      const newContactItem: CRMContact = {
        id: `c-${Date.now()}`,
        ...contactForm,
        lastContactDate: new Date().toISOString()
      };
      setContacts([newContactItem, ...contacts]);
      setSelectedContact(newContactItem);
      logActivity(`Created new CRM customer profile for "${contactForm.name}"`);
    }
    setShowContactModal(false);
  };

  const handleDeleteContact = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete CRM Contact: ${name}?`)) {
      const linkedTickets = tickets.filter(t => t.contactId === id);
      await Promise.all([deleteCloudRecord('contacts', id), ...linkedTickets.map((ticket) => deleteCloudRecord('tickets', ticket.id))]);
      setContacts(contacts.filter(c => c.id !== id));
      setTickets(tickets.filter(t => t.contactId !== id));
      if (selectedContact?.id === id) {
        setSelectedContact(contacts.find(c => c.id !== id) || null);
      }
      logActivity(`Deleted CRM customer profile for "${name}"`);
    }
  };

  // Handlers for Tickets
  const handleOpenTicketModal = (ticket: SupportTicket | null = null) => {
    if (ticket) {
      setEditingTicket(ticket);
      setTicketForm({
        contactId: ticket.contactId,
        title: ticket.title,
        priority: ticket.priority,
        status: ticket.status,
        category: ticket.category,
        description: ticket.description
      });
    } else {
      setEditingTicket(null);
      setTicketForm({
        contactId: contacts[0]?.id || '',
        title: '',
        priority: 'Medium',
        status: 'Open',
        category: 'General',
        description: ''
      });
    }
    setShowTicketModal(true);
  };

  const handleSaveTicket = (e: React.FormEvent) => {
    e.preventDefault();
    const matchedContact = contacts.find(c => c.id === ticketForm.contactId);
    const contactName = matchedContact ? matchedContact.name : 'Unknown Customer';

    if (editingTicket) {
      const updated = tickets.map(t => t.id === editingTicket.id ? {
        ...t,
        ...ticketForm,
        contactName
      } : t);
      setTickets(updated);
      setSelectedTicket({ ...editingTicket, ...ticketForm, contactName });
      logActivity(`Updated support ticket #${editingTicket.id.substring(0, 5)}: "${ticketForm.title}"`);
    } else {
      const newTicketItem: SupportTicket = {
        id: `t-${Date.now()}`,
        contactName,
        ...ticketForm,
        createdAt: new Date().toISOString(),
        replies: []
      };
      setTickets([newTicketItem, ...tickets]);
      setSelectedTicket(newTicketItem);
      logActivity(`Created new support ticket: "${ticketForm.title}"`);
    }
    setShowTicketModal(false);
  };

  const handleDeleteTicket = async (id: string, title: string) => {
    if (confirm(`Are you sure you want to delete Support Ticket: ${title}?`)) {
      await deleteCloudRecord('tickets', id);
      setTickets(tickets.filter(t => t.id !== id));
      if (selectedTicket?.id === id) {
        setSelectedTicket(tickets.find(t => t.id !== id) || null);
      }
      logActivity(`Deleted support ticket: "${title}"`);
    }
  };

  // Handle Ticket Reply
  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !replyText.trim()) return;

    const newReply: TicketResponse = {
      id: `r-${Date.now()}`,
      ticketId: selectedTicket.id,
      text: replyText.trim(),
      author: agentName || 'System Agent',
      createdAt: new Date().toISOString()
    };

    const updatedTickets = tickets.map(t => {
      if (t.id === selectedTicket.id) {
        return {
          ...t,
          status: 'In Progress' as const, // auto-set status to in progress
          replies: [...(t.replies || []), newReply]
        };
      }
      return t;
    });

    setTickets(updatedTickets);
    setSelectedTicket({
      ...selectedTicket,
      status: 'In Progress',
      replies: [...(selectedTicket.replies || []), newReply]
    });
    setReplyText('');
    logActivity(`Added response message to ticket #${selectedTicket.id.substring(0, 5)}`);
  };

  // Handle Ticket Status change inline
  const handleUpdateTicketStatus = (ticketId: string, status: SupportTicket['status']) => {
    const updated = tickets.map(t => t.id === ticketId ? { ...t, status } : t);
    setTickets(updated);
    if (selectedTicket?.id === ticketId) {
      setSelectedTicket(prev => prev ? { ...prev, status } : null);
    }
    logActivity(`Changed ticket #${ticketId.substring(0, 5)} status to ${status}`);
  };

  // Google Support Dossier Export
  const handleCreateSupportDossier = async () => {
    if (!selectedTicket) return;
    if (!token) {
      alert("⚠️ Google authentication token is missing or expired. Please sign in via the top-bar workspace Google Auth button first.");
      return;
    }

    setIsExportingDoc(true);
    setExportedDocUrl(null);
    try {
      const linkedContact = contacts.find(c => c.id === selectedTicket.contactId);
      const result = await createSupportDoc(token, selectedTicket, linkedContact);
      setExportedDocUrl(result.documentUrl);
      logActivity(`Created Google Doc Support Dossier for ticket: "${selectedTicket.title}"`);
    } catch (err: any) {
      alert(`Error exporting support dossier: ${err.message || err}`);
    } finally {
      setIsExportingDoc(false);
    }
  };

  // Filter lists
  const filteredContacts = contacts.filter(c => 
    c.name.toLowerCase().includes(contactSearch.toLowerCase()) ||
    c.company.toLowerCase().includes(contactSearch.toLowerCase()) ||
    c.email.toLowerCase().includes(contactSearch.toLowerCase())
  );

  const filteredTickets = tickets.filter(t => {
    const matchesSearch = t.title.toLowerCase().includes(ticketSearch.toLowerCase()) ||
      t.contactName.toLowerCase().includes(ticketSearch.toLowerCase()) ||
      t.id.toLowerCase().includes(ticketSearch.toLowerCase());
    
    const matchesPriority = priorityFilter === 'All' || t.priority === priorityFilter;
    const matchesStatus = statusFilter === 'All' || t.status === statusFilter;
    const matchesCategory = categoryFilter === 'All' || t.category === categoryFilter;

    return matchesSearch && matchesPriority && matchesStatus && matchesCategory;
  });

  return (
    <div className="flex flex-col h-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 animate-fadeIn">
      {/* Tab bar header */}
      <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800/80 px-6 py-4 bg-white dark:bg-zinc-900/40">
        <div className="flex gap-4">
          <button
            onClick={() => setSubTab('tickets')}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
              subTab === 'tickets' 
                ? 'bg-zinc-100 dark:bg-zinc-800 text-amber-600 dark:text-amber-400' 
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-350'
            }`}
          >
            Support Tickets Center ({tickets.length})
          </button>
          <button
            onClick={() => setSubTab('contacts')}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
              subTab === 'contacts' 
                ? 'bg-zinc-100 dark:bg-zinc-800 text-amber-600 dark:text-amber-400' 
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-350'
            }`}
          >
            CRM Contacts Directory ({contacts.length})
          </button>
        </div>

        <button
          onClick={() => subTab === 'tickets' ? handleOpenTicketModal() : handleOpenContactModal()}
          className="flex items-center gap-1.5 px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs uppercase rounded-lg tracking-wider transition-all shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          {subTab === 'tickets' ? 'Create Ticket' : 'Add Contact'}
        </button>
      </div>

      {subTab === 'tickets' ? (
        /* --- TICKETS SECTION --- */
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden h-[calc(100vh-180px)]">
          {/* Left panel: tickets list (col-span-5) */}
          <div className="lg:col-span-5 border-r border-zinc-200 dark:border-zinc-800/80 flex flex-col h-full bg-white dark:bg-zinc-900/10">
            {/* Search and Filters */}
            <div className="p-4 space-y-3 border-b border-zinc-200 dark:border-zinc-800/60">
              <div className="relative">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search tickets by subject, agent or ID..."
                  value={ticketSearch}
                  onChange={(e) => setTicketSearch(e.target.value)}
                  className="w-full bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded-lg pl-9 pr-3 py-2 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-amber-500 placeholder:text-zinc-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">Priority</label>
                  <select
                    value={priorityFilter}
                    onChange={(e) => setPriorityFilter(e.target.value)}
                    className="w-full bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded px-2 py-1 text-[11px] text-zinc-700 dark:text-zinc-350 focus:outline-none focus:border-amber-500"
                  >
                    <option value="All">All Priorities</option>
                    <option value="Urgent">Urgent</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>

                <div>
                  <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">Status</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded px-2 py-1 text-[11px] text-zinc-700 dark:text-zinc-350 focus:outline-none focus:border-amber-500"
                  >
                    <option value="All">All Statuses</option>
                    <option value="Open">Open</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Resolved">Resolved</option>
                    <option value="Closed">Closed</option>
                  </select>
                </div>

                <div>
                  <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">Category</label>
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="w-full bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded px-2 py-1 text-[11px] text-zinc-700 dark:text-zinc-350 focus:outline-none focus:border-amber-500"
                  >
                    <option value="All">All Categories</option>
                    <option value="Billing">Billing</option>
                    <option value="Technical">Technical</option>
                    <option value="General">General</option>
                    <option value="Feature Request">Feature Req</option>
                  </select>
                </div>
              </div>
            </div>

            {/* List container */}
            <div className="flex-1 overflow-y-auto divide-y divide-zinc-200 dark:divide-zinc-800/40">
              {filteredTickets.length > 0 ? (
                filteredTickets.map((t) => {
                  const isSelected = selectedTicket?.id === t.id;
                  let priorityColor = 'bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500';
                  if (t.priority === 'Urgent') priorityColor = 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900/60 text-red-600 dark:text-red-400';
                  else if (t.priority === 'High') priorityColor = 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/60 text-amber-600 dark:text-amber-400';
                  else if (t.priority === 'Medium') priorityColor = 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900/60 text-blue-600 dark:text-blue-400';

                  let statusColor = 'bg-zinc-100 text-zinc-500 border border-zinc-200 dark:bg-zinc-950 dark:border-zinc-850 dark:text-zinc-450';
                  if (t.status === 'Open') statusColor = 'bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900/40 dark:text-emerald-400';
                  else if (t.status === 'In Progress') statusColor = 'bg-cyan-50 text-cyan-600 border border-cyan-200 dark:bg-cyan-950/30 dark:border-cyan-900/40 dark:text-cyan-400';
                  else if (t.status === 'Resolved') statusColor = 'bg-blue-50 text-blue-600 border border-blue-200 dark:bg-blue-950/30 dark:border-blue-900/40 dark:text-blue-400';

                  return (
                    <div
                      key={t.id}
                      onClick={() => setSelectedTicket(t)}
                      className={`p-4 text-left transition-all cursor-pointer relative border-l-4 ${
                        isSelected 
                          ? 'bg-zinc-100/70 dark:bg-zinc-800/45 border-amber-600 dark:border-amber-500' 
                          : 'border-transparent hover:bg-zinc-50 dark:hover:bg-zinc-850/30'
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2 mb-1.5">
                        <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider block">ID: #{t.id.substring(0, 5)}</span>
                        <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-sans">{new Date(t.createdAt).toLocaleDateString()}</span>
                      </div>
                      <h4 className="font-bold text-xs text-zinc-800 dark:text-zinc-200 line-clamp-1 mb-2 font-sans">{t.title}</h4>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-2 mb-3.5 leading-relaxed font-sans">{t.description}</p>
                      
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 font-sans">By: <strong className="text-zinc-700 dark:text-zinc-300">{t.contactName}</strong></span>
                        <div className="flex gap-1.5 shrink-0">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border font-mono ${priorityColor}`}>{t.priority}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border font-mono ${statusColor}`}>{t.status}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center text-zinc-500 italic text-xs font-serif">
                  No matching support tickets found. Try a different query or priority filter.
                </div>
              )}
            </div>
          </div>

          {/* Right panel: ticket detail view (col-span-7) */}
          <div className="lg:col-span-7 flex flex-col h-full bg-zinc-50/50 dark:bg-zinc-950/20">
            {selectedTicket ? (
              <div className="flex-1 flex flex-col h-full overflow-hidden">
                {/* Header & Meta actions */}
                <div className="p-5 border-b border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/20 text-left">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-zinc-200 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 rounded uppercase tracking-wider">Ticket Detailed Audit</span>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-amber-950/30 border border-amber-900/40 text-amber-600 dark:text-amber-400 rounded uppercase tracking-wider">{selectedTicket.category}</span>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={handleCreateSupportDossier}
                        disabled={isExportingDoc}
                        className="px-2.5 py-1.5 border border-zinc-200 dark:border-zinc-800 text-[10px] font-bold uppercase tracking-wider rounded-lg text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
                      >
                        {isExportingDoc ? <Clock className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5 text-blue-400" />}
                        {isExportingDoc ? 'Exporting...' : 'Export Dossier (Doc)'}
                      </button>

                      <button
                        onClick={() => handleOpenTicketModal(selectedTicket)}
                        className="p-1.5 border border-zinc-200 dark:border-zinc-800 text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 rounded-lg shrink-0 cursor-pointer"
                        title="Edit Ticket"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleDeleteTicket(selectedTicket.id, selectedTicket.title)}
                        className="p-1.5 border border-zinc-200 dark:border-zinc-800 text-red-500 hover:text-red-700 rounded-lg shrink-0 cursor-pointer"
                        title="Delete Ticket"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <h3 className="text-base font-bold text-zinc-800 dark:text-zinc-100 tracking-wide font-sans mb-3">{selectedTicket.title}</h3>

                  {exportedDocUrl && (
                    <div className="mb-4 p-2.5 bg-blue-950/40 border border-blue-900/60 rounded-xl text-xs text-blue-400 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 font-mono text-[10px]">
                        <CheckCircle className="w-4 h-4 text-emerald-400 animate-pulse" />
                        DOSSIER EXPORTED SECURELY TO GOOGLE DRIVE
                      </span>
                      <a
                        href={exportedDocUrl}
                        target="_blank"
                        rel="noreferrer referrerPolicy"
                        className="font-bold underline uppercase tracking-wider text-[10px] flex items-center gap-1 hover:text-blue-300"
                      >
                        Open Dossier ✕
                      </a>
                    </div>
                  )}

                  {/* Operational status adjustment options */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-zinc-100/50 dark:bg-zinc-950/40 p-4 rounded-xl border border-zinc-200 dark:border-zinc-850">
                    <div className="space-y-0.5">
                      <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block">Customer Roster Node</span>
                      <span className="text-xs text-zinc-800 dark:text-zinc-200 font-semibold font-sans">{selectedTicket.contactName}</span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block">Change Operational Status</span>
                      <div className="flex gap-1">
                        {(['Open', 'In Progress', 'Resolved', 'Closed'] as const).map(st => (
                          <button
                            key={st}
                            onClick={() => handleUpdateTicketStatus(selectedTicket.id, st)}
                            className={`px-2 py-1 text-[10px] font-bold font-mono uppercase border rounded transition-all shrink-0 cursor-pointer ${
                              selectedTicket.status === st
                                ? 'bg-amber-600 border-amber-600 text-white shadow-sm'
                                : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50'
                            }`}
                          >
                            {st}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Description & Message Feed */}
                <div className="flex-1 overflow-y-auto p-5 space-y-5 text-left">
                  {/* Original ticket issue summary */}
                  <div className="bg-white dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800/60 rounded-xl p-4 shadow-xs">
                    <div className="flex items-center gap-1.5 mb-2 border-b border-zinc-100 dark:border-zinc-800/40 pb-2">
                      <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono">Original Customer Issue Statement</span>
                    </div>
                    <p className="text-xs text-zinc-600 dark:text-zinc-350 leading-relaxed font-sans">{selectedTicket.description}</p>
                  </div>

                  {/* Feed thread header */}
                  <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800/60 pb-1.5">
                    <MessageSquare className="w-4 h-4 text-zinc-400" />
                    <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider font-mono">Response Activity Thread ({selectedTicket.replies?.length || 0})</span>
                  </div>

                  {/* Reply timeline */}
                  <div className="space-y-4">
                    {selectedTicket.replies && selectedTicket.replies.length > 0 ? (
                      selectedTicket.replies.map((reply) => {
                        const isMe = reply.author === agentName;
                        return (
                          <div
                            key={reply.id}
                            className={`flex flex-col max-w-[85%] rounded-xl p-3 shadow-xs border ${
                              isMe
                                ? 'ml-auto bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40 text-right items-end'
                                : 'mr-auto bg-white dark:bg-zinc-900/40 border-zinc-200 dark:border-zinc-850 text-left items-start'
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400 font-sans">{reply.author}</span>
                              <span className="text-[8px] font-mono text-zinc-400">{new Date(reply.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <p className="text-xs text-zinc-700 dark:text-zinc-350 leading-relaxed font-sans">{reply.text}</p>
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-6 text-center text-zinc-400 text-xs italic font-serif">
                        No replies have been recorded for this support ticket. Use the response panel below to post an update.
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Reply Form */}
                <form onSubmit={handleSendReply} className="p-4 border-t border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/40 flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Type professional CRM support response..."
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    className="flex-1 bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded-lg px-3 py-2.5 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-amber-500 placeholder:text-zinc-500 font-sans"
                  />
                  <button
                    type="submit"
                    className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs uppercase tracking-wider px-5 rounded-lg transition-all shadow-sm shrink-0 cursor-pointer"
                  >
                    Send Response
                  </button>
                </form>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-zinc-500">
                <AlertCircle className="w-8 h-8 text-zinc-400 mb-2 animate-pulse" />
                <p className="text-xs font-serif italic">Select a ticket from the left index panel to inspect activity and post replies.</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* --- CONTACTS SECTION --- */
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden h-[calc(100vh-180px)]">
          {/* Left panel: contacts list index (col-span-4) */}
          <div className="lg:col-span-4 border-r border-zinc-200 dark:border-zinc-800/80 flex flex-col h-full bg-white dark:bg-zinc-900/10">
            {/* Search filter */}
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800/60">
              <div className="relative">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search contacts by name, company, email..."
                  value={contactSearch}
                  onChange={(e) => setContactSearch(e.target.value)}
                  className="w-full bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded-lg pl-9 pr-3 py-2 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-amber-500 placeholder:text-zinc-500"
                />
              </div>
            </div>

            {/* List index */}
            <div className="flex-1 overflow-y-auto divide-y divide-zinc-200 dark:divide-zinc-800/40">
              {filteredContacts.length > 0 ? (
                filteredContacts.map((c) => {
                  const isSelected = selectedContact?.id === c.id;
                  let badgeColor = 'bg-zinc-100 text-zinc-500 border border-zinc-200 dark:bg-zinc-950 dark:border-zinc-850';
                  if (c.status === 'VIP') badgeColor = 'bg-red-50 text-red-500 border border-red-200 dark:bg-red-950/40 dark:border-red-900/40 dark:text-red-400';
                  else if (c.status === 'Active') badgeColor = 'bg-emerald-50 text-emerald-500 border border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-900/40 dark:text-emerald-400';
                  else if (c.status === 'Lead') badgeColor = 'bg-amber-50 text-amber-500 border border-amber-200 dark:bg-amber-950/40 dark:border-amber-900/40 dark:text-amber-405';

                  return (
                    <div
                      key={c.id}
                      onClick={() => setSelectedContact(c)}
                      className={`p-4 text-left transition-all cursor-pointer border-l-4 ${
                        isSelected
                          ? 'bg-zinc-100/70 dark:bg-zinc-800/45 border-amber-600 dark:border-amber-500'
                          : 'border-transparent hover:bg-zinc-50 dark:hover:bg-zinc-850/30'
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2 mb-1.5">
                        <span className="text-xs font-bold text-zinc-800 dark:text-zinc-100 font-sans block truncate">{c.name}</span>
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border font-mono ${badgeColor}`}>{c.status}</span>
                      </div>
                      <div className="text-[10px] text-zinc-400 dark:text-zinc-550 font-mono mb-1">{c.company}</div>
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-450 line-clamp-1">{c.email}</div>
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center text-zinc-500 italic text-xs font-serif">
                  No matching contacts found in the registry.
                </div>
              )}
            </div>
          </div>

          {/* Right panel: contact detailed view (col-span-8) */}
          <div className="lg:col-span-8 flex flex-col h-full bg-zinc-50/50 dark:bg-zinc-950/20">
            {selectedContact ? (
              <div className="p-6 space-y-6 text-left overflow-y-auto">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-zinc-200 dark:border-zinc-800/80 pb-5">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-full bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 flex items-center justify-center font-bold text-zinc-700 dark:text-zinc-200 uppercase font-serif text-lg tracking-wide shrink-0">
                      {selectedContact.name.substring(0, 2)}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-zinc-800 dark:text-zinc-100 tracking-wide font-sans">{selectedContact.name}</h3>
                      <p className="text-[11px] text-zinc-500 font-mono">{selectedContact.company}</p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleOpenContactModal(selectedContact)}
                      className="px-3 py-1.5 border border-zinc-200 dark:border-zinc-800 text-[10px] font-bold uppercase tracking-wider rounded-lg text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      Edit Profile
                    </button>
                    <button
                      onClick={() => handleDeleteContact(selectedContact.id, selectedContact.name)}
                      className="p-1.5 border border-zinc-200 dark:border-zinc-800 text-red-500 hover:text-red-700 rounded-lg shrink-0 cursor-pointer"
                      title="Delete Profile"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Details layout grids */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Card 1: Core credentials */}
                  <div className="bg-white dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800/60 rounded-xl p-5 space-y-3.5 shadow-xs">
                    <h4 className="font-bold font-serif text-zinc-800 dark:text-zinc-200 text-sm border-b border-zinc-100 dark:border-zinc-800 pb-2 flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-amber-500" />
                      Contact Credentials
                    </h4>

                    <div className="space-y-2 text-xs font-sans">
                      <div className="flex justify-between py-1.5 border-b border-zinc-100 dark:border-zinc-800/40">
                        <span className="text-zinc-400">Email Address</span>
                        <span className="text-zinc-700 dark:text-zinc-300 font-semibold">{selectedContact.email}</span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-zinc-100 dark:border-zinc-800/40">
                        <span className="text-zinc-400">Phone Number</span>
                        <span className="text-zinc-700 dark:text-zinc-300 font-semibold font-mono">{selectedContact.phone}</span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-zinc-100 dark:border-zinc-800/40">
                        <span className="text-zinc-400">Customer Class</span>
                        <span className="text-zinc-700 dark:text-zinc-300 font-bold uppercase">{selectedContact.status}</span>
                      </div>
                      <div className="flex justify-between py-1.5">
                        <span className="text-zinc-400">Last Active Date</span>
                        <span className="text-zinc-700 dark:text-zinc-300 font-semibold">{new Date(selectedContact.lastContactDate).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Card 2: CRM Operations notes */}
                  <div className="bg-white dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800/60 rounded-xl p-5 space-y-3.5 shadow-xs flex flex-col justify-between">
                    <div>
                      <h4 className="font-bold font-serif text-zinc-800 dark:text-zinc-200 text-sm border-b border-zinc-100 dark:border-zinc-800 pb-2 flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-amber-500" />
                        CRM Intelligence Summary
                      </h4>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-3 leading-relaxed font-sans">{selectedContact.notes || 'No custom notes logged for this customer yet.'}</p>
                    </div>
                  </div>
                </div>

                {/* Linked support tickets */}
                <div className="space-y-3">
                  <h4 className="font-bold font-serif text-zinc-800 dark:text-zinc-200 text-sm flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-amber-500" />
                    Open Support Engagements
                  </h4>

                  {tickets.filter(t => t.contactId === selectedContact.id).length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {tickets.filter(t => t.contactId === selectedContact.id).map((t) => (
                        <div key={t.id} className="bg-white dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800/60 rounded-xl p-4 flex flex-col justify-between shadow-xs">
                          <div className="flex justify-between gap-2 mb-2">
                            <span className="text-[10px] font-mono font-bold text-zinc-400 block uppercase">ID: #{t.id.substring(0, 5)}</span>
                            <span className="text-[10px] font-mono font-bold text-amber-500 uppercase">{t.status}</span>
                          </div>
                          <h5 className="font-bold text-xs text-zinc-850 dark:text-zinc-200 line-clamp-1 mb-1 font-sans">{t.title}</h5>
                          <p className="text-[11px] text-zinc-500 line-clamp-2 leading-relaxed mb-3.5 font-sans">{t.description}</p>
                          <div className="flex items-center justify-between border-t border-zinc-100 dark:border-zinc-800/40 pt-2 text-[10px] text-zinc-400">
                            <span>Created: {new Date(t.createdAt).toLocaleDateString()}</span>
                            <span className="font-bold uppercase font-mono">{t.priority} priority</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-white dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-850 rounded-xl p-6 text-center text-zinc-400 text-xs italic font-serif">
                      No linked support tickets have been opened or recorded for this client.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-zinc-500">
                <Users className="w-8 h-8 text-zinc-400 mb-2 animate-pulse" />
                <p className="text-xs font-serif italic">Select a contact profile from the list index to explore customer credentials and SLA profiles.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: Add/Edit CRM Contact */}
      {showContactModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto animate-fadeIn backdrop-blur-xs">
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-300 dark:border-zinc-800 shadow-2xl max-w-md w-full p-6 flex flex-col gap-4 text-left">
            <div className="flex justify-between items-center pb-3 border-b border-zinc-200 dark:border-zinc-800">
              <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-base font-serif tracking-wide">
                {editingContact ? 'Edit Customer Profile' : 'Add New CRM Customer Profile'}
              </h3>
              <button
                onClick={() => setShowContactModal(false)}
                className="text-zinc-500 hover:text-zinc-300 text-sm font-bold font-mono p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveContact} className="space-y-4 font-sans text-xs">
              <div>
                <label className="text-[10px] font-bold text-zinc-400 uppercase font-mono block mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Alice Cooper"
                  value={contactForm.name}
                  onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                  className="w-full bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-zinc-400 uppercase font-mono block mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  placeholder="alice.cooper@company.com"
                  value={contactForm.email}
                  onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                  className="w-full bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-zinc-400 uppercase font-mono block mb-1">Phone Number *</label>
                <input
                  type="text"
                  required
                  placeholder="+1 (555) 019-2834"
                  value={contactForm.phone}
                  onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                  className="w-full bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase font-mono block mb-1">Company *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Acme Labs"
                    value={contactForm.company}
                    onChange={(e) => setContactForm({ ...contactForm, company: e.target.value })}
                    className="w-full bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase font-mono block mb-1">Status Class</label>
                  <select
                    value={contactForm.status}
                    onChange={(e) => setContactForm({ ...contactForm, status: e.target.value as CRMContact['status'] })}
                    className="w-full bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-amber-500"
                  >
                    <option value="Lead">Lead</option>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                    <option value="VIP">VIP</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-zinc-400 uppercase font-mono block mb-1">Intelligence Profiling Notes</label>
                <textarea
                  placeholder="Additional context on client preferences or SLA status..."
                  rows={3}
                  value={contactForm.notes}
                  onChange={(e) => setContactForm({ ...contactForm, notes: e.target.value })}
                  className="w-full bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs uppercase tracking-wider py-2.5 rounded-lg transition-all shadow-sm cursor-pointer"
              >
                {editingContact ? 'Save Changes' : 'Create Customer Profile'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Add/Edit Support Ticket */}
      {showTicketModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto animate-fadeIn backdrop-blur-xs">
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-300 dark:border-zinc-800 shadow-2xl max-w-md w-full p-6 flex flex-col gap-4 text-left">
            <div className="flex justify-between items-center pb-3 border-b border-zinc-200 dark:border-zinc-800">
              <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-base font-serif tracking-wide">
                {editingTicket ? 'Edit Support Ticket' : 'Create Support Ticket'}
              </h3>
              <button
                onClick={() => setShowTicketModal(false)}
                className="text-zinc-500 hover:text-zinc-300 text-sm font-bold font-mono p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveTicket} className="space-y-4 font-sans text-xs">
              <div>
                <label className="text-[10px] font-bold text-zinc-400 uppercase font-mono block mb-1">Customer / CRM Lead *</label>
                <select
                  value={ticketForm.contactId}
                  required
                  onChange={(e) => setTicketForm({ ...ticketForm, contactId: e.target.value })}
                  className="w-full bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-amber-500"
                >
                  <option value="">-- Associate Customer Profile --</option>
                  {contacts.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.company})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-zinc-400 uppercase font-mono block mb-1">Ticket Subject Line *</label>
                <input
                  type="text"
                  required
                  placeholder="Briefly state support request..."
                  value={ticketForm.title}
                  onChange={(e) => setTicketForm({ ...ticketForm, title: e.target.value })}
                  className="w-full bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase font-mono block mb-1">Priority</label>
                  <select
                    value={ticketForm.priority}
                    onChange={(e) => setTicketForm({ ...ticketForm, priority: e.target.value as SupportTicket['priority'] })}
                    className="w-full bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-amber-500"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase font-mono block mb-1">Status</label>
                  <select
                    value={ticketForm.status}
                    onChange={(e) => setTicketForm({ ...ticketForm, status: e.target.value as SupportTicket['status'] })}
                    className="w-full bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-amber-500"
                  >
                    <option value="Open">Open</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Resolved">Resolved</option>
                    <option value="Closed">Closed</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase font-mono block mb-1">Category</label>
                  <select
                    value={ticketForm.category}
                    onChange={(e) => setTicketForm({ ...ticketForm, category: e.target.value as SupportTicket['category'] })}
                    className="w-full bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-amber-500"
                  >
                    <option value="Billing">Billing</option>
                    <option value="Technical">Technical</option>
                    <option value="General">General</option>
                    <option value="Feature Request">Feature Request</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-zinc-400 uppercase font-mono block mb-1">Detailed Description *</label>
                <textarea
                  required
                  placeholder="Describe details of client inquiry or system error reports..."
                  rows={4}
                  value={ticketForm.description}
                  onChange={(e) => setTicketForm({ ...ticketForm, description: e.target.value })}
                  className="w-full bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs uppercase tracking-wider py-2.5 rounded-lg transition-all shadow-sm cursor-pointer"
              >
                {editingTicket ? 'Save Changes' : 'Open Ticket'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
