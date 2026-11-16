import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Briefcase,
  Building2,
  ExternalLink,
  FileText,
  Globe,
  Layers,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { apiClient } from '../../config/api.config';
import { BillablePlacement, Client, Requirement } from '../../types';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { ActionButton } from '../../components/shared/ActionButton';
import { TablePagination } from '../../components/shared/TablePagination';
import { MaskedValue } from '../../components/shared/MaskedValue';
import { EditClientModal } from '../../components/modals/edit/EditClientModal';
import { getStageDotClass } from '../../utils/stageStyles';
import { useClientPagination } from '../../utils/usePagination';

interface ClientDetailPageProps {
  client: Client | null;
  backLabel?: string;
  onBack: () => void;
  requirements: Requirement[];
  placements: BillablePlacement[];
  rateMasked?: boolean;
  initialEditing?: boolean;
  onClientUpdated?: (updatedClient: Client) => void;
  onOpenRequirement?: (req: Requirement) => void;
  onDeleteClient?: (client: Client) => Promise<void> | void;
  showToast: (title: string, message: string, icon?: string) => void;
}

export const ClientDetailPage: React.FC<ClientDetailPageProps> = ({
  client,
  backLabel = 'Back to Clients',
  onBack,
  requirements,
  placements,
  rateMasked = false,
  initialEditing = false,
  onClientUpdated,
  onOpenRequirement,
  onDeleteClient,
  showToast,
}) => {
  const [isEditingClient, setIsEditingClient] = useState(initialEditing);

  const [showAddContact, setShowAddContact] = useState(false);
  const [isSavingContact, setIsSavingContact] = useState(false);
  const [contactForm, setContactForm] = useState({
    name: '',
    designation: 'Hiring Manager',
    email: '',
    phone: '',
    isPrimary: false,
  });

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeletingClient, setIsDeletingClient] = useState(false);

  useEffect(() => {
    setIsEditingClient(Boolean(initialEditing));
    setShowAddContact(false);
    setShowDeleteConfirm(false);
    setIsDeletingClient(false);
  }, [client?.id, initialEditing]);

  const clientReqs = client
    ? requirements.filter((r) => r.companyName.toLowerCase() === client.name.toLowerCase())
    : [];
  const clientPlacements = client
    ? placements.filter((p) => p.customer.toLowerCase() === client.name.toLowerCase())
    : [];
  const contactsPg = useClientPagination(client?.contacts || [], 5, client?.id);
  const reqsPg = useClientPagination(clientReqs, 5, client?.id);
  const placementsPg = useClientPagination(clientPlacements, 5, client?.id);

  if (!client) {
    return (
      <section className="max-w-7xl mx-auto py-16 text-center space-y-3 animate-fade-in">
        <p className="text-sm font-semibold text-slate-700">Client account not found.</p>
        <button
          type="button"
          onClick={onBack}
          className="px-3.5 py-2 rounded-lg bg-brand-600 text-white text-xs font-semibold hover:bg-brand-700 inline-flex items-center gap-1.5 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{backLabel}</span>
        </button>
      </section>
    );
  }

  const activeClientPlacements = clientPlacements.filter(
    (p) => p.status !== 'Completed' && p.status !== 'Terminated'
  );

  const cleanWebsite = client.website
    ? client.website.replace(/^https?:\/\//i, '').replace(/\/$/, '')
    : '';
  const websiteHref = client.website
    ? /^https?:\/\//i.test(client.website)
      ? client.website
      : `https://${client.website}`
    : '';

  const customFieldEntries = Object.entries(client.customFields || {}).filter(
    ([, v]) => v !== null && v !== undefined && String(v).trim() !== ''
  );

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactForm.name.trim() || !contactForm.email.trim()) {
      showToast(
        'Missing Fields',
        'Contact name and email are required.',
        'fa-solid fa-circle-exclamation text-rose-500'
      );
      return;
    }
    setIsSavingContact(true);
    try {
      const res = await apiClient.post(`/clients/${client.id}/contacts`, {
        fullName: contactForm.name.trim(),
        designation: contactForm.designation.trim(),
        email: contactForm.email.trim(),
        phone: contactForm.phone.trim(),
        isPrimary: contactForm.isPrimary,
      });
      const created = res.data?.data;
      const newContact = {
        name: created?.fullName || contactForm.name.trim(),
        designation: created?.designation || contactForm.designation.trim(),
        email: created?.email || contactForm.email.trim(),
        phone: created?.phone || contactForm.phone.trim(),
        isPrimary: created?.isPrimary ?? contactForm.isPrimary,
      };
      const existingContacts = newContact.isPrimary
        ? client.contacts.map((c) => ({ ...c, isPrimary: false }))
        : client.contacts;
      const updatedClient: Client = {
        ...client,
        contacts: [...existingContacts, newContact],
      };
      if (onClientUpdated) onClientUpdated(updatedClient);
      setContactForm({
        name: '',
        designation: 'Hiring Manager',
        email: '',
        phone: '',
        isPrimary: false,
      });
      setShowAddContact(false);
      showToast(
        'Contact Added',
        `${newContact.name} saved to ${client.name}.`,
        'fa-solid fa-circle-check text-emerald-500'
      );
    } catch (err: any) {
      showToast(
        'Save Failed',
        err?.response?.data?.message || 'Could not add contact.',
        'fa-solid fa-circle-exclamation text-rose-500'
      );
    } finally {
      setIsSavingContact(false);
    }
  };

  return (
    <section className="max-w-7xl mx-auto space-y-5 animate-fade-in">
      {/* Slim Breadcrumb */}
      <div className="flex items-center gap-2 text-xs">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-semibold shadow-2xs transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{backLabel}</span>
        </button>
        <span className="text-slate-300">/</span>
        <span className="text-[11px] font-semibold text-slate-800 truncate">{client.name}</span>
      </div>

      {/* Main Header Card */}
      <div className="bg-white rounded-xl border border-slate-200/80 card-shadow px-6 py-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-4 min-w-0">
          <div className="w-12 h-12 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center border border-brand-100 shadow-2xs shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-lg sm:text-[19px] font-bold text-slate-900 tracking-tight truncate">
                {client.name}
              </h1>
              {activeClientPlacements.length > 0 && (
                <StatusBadge
                  label={`${activeClientPlacements.length} Active Placement${
                    activeClientPlacements.length === 1 ? '' : 's'
                  }`}
                  tone="emerald"
                  size="xs"
                />
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
              <span className="inline-flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span>{client.location || 'Location not set'}</span>
              </span>
              {cleanWebsite && cleanWebsite !== 'https://' && (
                <>
                  <span className="text-slate-300">&bull;</span>
                  <a
                    href={websiteHref}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-brand-600 hover:underline font-medium"
                  >
                    <Globe className="w-3.5 h-3.5 shrink-0" />
                    <span>{cleanWebsite}</span>
                    <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                  </a>
                </>
              )}
              {client.boardNumber && (
                <>
                  <span className="text-slate-300">&bull;</span>
                  <span className="inline-flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{client.boardNumber}</span>
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap flex-shrink-0">
          <button
            type="button"
            onClick={() => setIsEditingClient(true)}
            className="px-3.5 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Pencil className="w-3.5 h-3.5" />
            <span>Edit Client</span>
          </button>

          <button
            type="button"
            onClick={() => setShowAddContact(true)}
            className="px-3.5 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2.4} />
            <span>Add Contact</span>
          </button>
        </div>
      </div>

      {/* Main 2-Column Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        {/* Left Main Content: Hiring Contacts, Job Requisitions & Billable Placements */}
        <div className="lg:col-span-2 space-y-4">
          {/* Hiring Contacts */}
          <section className="bg-white rounded-xl border border-slate-200/80 card-shadow overflow-hidden text-xs">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Users className="w-3.5 h-3.5 text-brand-600" />
                <h2 className="font-bold text-slate-900">
                  Client Contact Persons ({client.contacts.length})
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowAddContact(true)}
                className="text-brand-600 font-semibold hover:underline text-xs inline-flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" strokeWidth={2.4} />
                <span>Add Contact</span>
              </button>
            </div>

            {client.contacts.length === 0 ? (
              <div className="py-10 text-center text-slate-400">
                No contact persons added for this client yet.
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase">
                      <tr>
                        <th className="px-4 py-2.5">Contact</th>
                        <th className="px-4 py-2.5">Designation</th>
                        <th className="px-4 py-2.5">Email</th>
                        <th className="px-4 py-2.5">Phone</th>
                        <th className="px-4 py-2.5 text-right">Role</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {contactsPg.pagedItems.map((cnt, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-4 py-3 font-semibold text-slate-900 whitespace-nowrap">
                            {cnt.name || (cnt as any).fullName}
                          </td>
                          <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                            {cnt.designation || '—'}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {cnt.email ? (
                              <a
                                href={`mailto:${cnt.email}`}
                                className="inline-flex items-center gap-1 hover:text-brand-600"
                              >
                                <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                                <span>{cnt.email}</span>
                              </a>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                            {cnt.phone ? (
                              <a href={`tel:${cnt.phone}`} className="hover:text-brand-600 font-medium">
                                {cnt.phone}
                              </a>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            {cnt.isPrimary ? (
                              <span className="text-[10px] font-semibold text-amber-800 bg-amber-500/[0.12] px-2 py-0.5 rounded">
                                Primary Lead
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-400">Contact</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <TablePagination
                  page={contactsPg.page}
                  limit={contactsPg.limit}
                  total={contactsPg.total}
                  onPageChange={contactsPg.setPage}
                  onLimitChange={contactsPg.setLimit}
                  itemLabel="contacts"
                  pageSizeOptions={[5, 10, 20, 50]}
                />
              </>
            )}
          </section>

          {/* Job Requisitions */}
          <section className="bg-white rounded-xl border border-slate-200/80 card-shadow overflow-hidden text-xs">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Briefcase className="w-3.5 h-3.5 text-brand-600" />
                <h2 className="font-bold text-slate-900">
                  Job Requisitions ({clientReqs.length})
                </h2>
              </div>
            </div>
            {clientReqs.length === 0 ? (
              <div className="py-10 text-center text-slate-400">
                No active job orders for this client.
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase">
                      <tr>
                        <th className="px-4 py-2.5">Req ID</th>
                        <th className="px-4 py-2.5">Opportunity</th>
                        <th className="px-4 py-2.5">Recruiter</th>
                        <th className="px-4 py-2.5">Location</th>
                        <th className="px-4 py-2.5 text-right">Stage</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {reqsPg.pagedItems.map((r) => (
                        <tr
                          key={r.id}
                          onClick={() => onOpenRequirement && onOpenRequirement(r)}
                          className={
                            onOpenRequirement
                              ? 'hover:bg-slate-50/80 cursor-pointer transition-colors'
                              : undefined
                          }
                        >
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                              {r.code}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-900">
                            {r.opportunityTitle}
                          </td>
                          <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                            {r.assignedRecruiter || 'Unassigned'}
                          </td>
                          <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                            {r.location || '—'}
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <StatusBadge
                              stage={r.status}
                              dotClass={getStageDotClass(r.status)}
                              size="xs"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <TablePagination
                  page={reqsPg.page}
                  limit={reqsPg.limit}
                  total={reqsPg.total}
                  onPageChange={reqsPg.setPage}
                  onLimitChange={reqsPg.setLimit}
                  itemLabel="requisitions"
                  pageSizeOptions={[5, 10, 20, 50]}
                />
              </>
            )}
          </section>

          {/* Billable Placements */}
          <section className="bg-white rounded-xl border border-slate-200/80 card-shadow overflow-hidden text-xs">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-bold text-slate-900">
                Billable Placements ({clientPlacements.length})
              </h2>
            </div>
            {clientPlacements.length === 0 ? (
              <div className="py-10 text-center text-slate-400">
                No billable consultants placed for this account yet.
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase">
                      <tr>
                        <th className="px-4 py-2.5">Consultant</th>
                        <th className="px-4 py-2.5">Role / Skill</th>
                        <th className="px-4 py-2.5">Contract Period</th>
                        <th className="px-4 py-2.5">Bill Rate</th>
                        <th className="px-4 py-2.5 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {placementsPg.pagedItems.map((b) => (
                        <tr key={b.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-4 py-3 font-semibold text-slate-900 whitespace-nowrap">
                            {b.resourceName}
                          </td>
                          <td className="px-4 py-3 text-slate-600">{b.skillRole}</td>
                          <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                            {b.startDate} &rarr; {b.endDate}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <MaskedValue value={b.billing} isMasked={rateMasked} />
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <StatusBadge stage={b.status} size="xs" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <TablePagination
                  page={placementsPg.page}
                  limit={placementsPg.limit}
                  total={placementsPg.total}
                  onPageChange={placementsPg.setPage}
                  onLimitChange={placementsPg.setLimit}
                  itemLabel="placements"
                  pageSizeOptions={[5, 10, 20, 50]}
                />
              </>
            )}
          </section>
        </div>

        {/* Right Metadata Sidebar */}
        <aside className="space-y-4">
          {/* KPIs + Account Metadata */}
          <div className="bg-white rounded-xl border border-slate-200/80 card-shadow p-4 space-y-4 text-xs">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Account Summary
            </h3>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/70">
                <div className="text-[10px] font-bold uppercase text-slate-400">Contacts</div>
                <div className="text-base font-extrabold text-slate-900 mt-0.5">
                  {client.contacts.length}
                </div>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/70">
                <div className="text-[10px] font-bold uppercase text-slate-400">Orders</div>
                <div className="text-base font-extrabold text-brand-700 mt-0.5">
                  {clientReqs.length}
                </div>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/70">
                <div className="text-[10px] font-bold uppercase text-slate-400">Active</div>
                <div className="text-base font-extrabold text-emerald-600 mt-0.5">
                  {activeClientPlacements.length}
                </div>
              </div>
            </div>

            <dl className="space-y-2 border-t border-slate-100 pt-3">
              <div className="flex items-start justify-between gap-2">
                <dt className="text-slate-400 font-medium">Phone</dt>
                <dd className="text-slate-800 font-medium text-right">
                  {client.boardNumber || '—'}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-2">
                <dt className="text-slate-400 font-medium">HQ Location</dt>
                <dd className="text-slate-800 font-medium text-right">{client.location || '—'}</dd>
              </div>
              <div className="flex items-start justify-between gap-2">
                <dt className="text-slate-400 font-medium">Website</dt>
                <dd className="text-slate-800 font-medium text-right truncate max-w-[170px]">
                  {cleanWebsite && cleanWebsite !== 'https://' ? cleanWebsite : '—'}
                </dd>
              </div>
            </dl>
          </div>

          {/* MSA Terms */}
          <div className="bg-white rounded-xl border border-slate-200/80 card-shadow p-4 space-y-2 text-xs">
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <FileText className="w-3.5 h-3.5 text-brand-600" />
              <span>Master Services Agreement</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Corporate staffing account under standard Master Services Agreement (MSA). Direct
              engagement for C2C, W2, contract-to-hire, and project-based staffing requirements.
            </p>
          </div>

          {/* Custom Attributes */}
          {customFieldEntries.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200/80 card-shadow p-4 space-y-2.5 text-xs">
              <div className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-brand-600" />
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Custom Attributes
                </h3>
              </div>
              <dl className="space-y-1.5">
                {customFieldEntries.map(([k, v]) => (
                  <div key={k} className="flex items-start justify-between gap-2">
                    <dt className="text-slate-400 font-medium capitalize shrink-0">
                      {k.replace(/_/g, ' ')}
                    </dt>
                    <dd className="text-slate-800 font-medium text-right min-w-0 [overflow-wrap:anywhere]">
                      {String(v)}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {/* Delete Client Control */}
          {onDeleteClient && (
            <div className="bg-white rounded-xl border border-slate-200/80 card-shadow p-4 space-y-2.5 text-xs">
              {!showDeleteConfirm ? (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full px-3 py-2 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 font-semibold text-xs inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Client</span>
                </button>
              ) : (
                <div className="space-y-2.5">
                  <div className="flex items-start gap-2 text-rose-700 text-[11px]">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>
                      Permanently remove <strong>{client.name}</strong> from Client Directory?
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isDeletingClient}
                      onClick={() => setShowDeleteConfirm(false)}
                      className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-[11px] font-semibold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <ActionButton
                      type="button"
                      loading={isDeletingClient}
                      loadingText="Deleting..."
                      onClick={async () => {
                        setIsDeletingClient(true);
                        try {
                          await onDeleteClient(client);
                          onBack();
                        } catch {
                          // Error toast displayed by parent caller
                        } finally {
                          setIsDeletingClient(false);
                        }
                      }}
                      className="flex-1 px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-semibold cursor-pointer"
                    >
                      Confirm Delete
                    </ActionButton>
                  </div>
                </div>
              )}
            </div>
          )}
        </aside>
      </div>

      <EditClientModal
        client={client}
        isOpen={isEditingClient}
        onClose={() => setIsEditingClient(false)}
        onClientUpdated={onClientUpdated}
        showToast={showToast}
      />

      {/* Add Client Contact Modal */}
      {showAddContact && (
        <div
          onClick={() => !isSavingContact && setShowAddContact(false)}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden flex flex-col animate-fade-in max-h-[92vh]"
          >
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-[#141615] text-white shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white shrink-0">
                  <Users className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-bold text-white truncate">Add Client Contact</h2>
                  <div className="text-[11px] text-slate-400 mt-0.5 truncate">{client.name}</div>
                </div>
              </div>
              <button
                type="button"
                disabled={isSavingContact}
                onClick={() => setShowAddContact(false)}
                aria-label="Close modal"
                className="text-slate-400 hover:text-white w-7 h-7 rounded flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveContact} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-6 overflow-y-auto space-y-4 text-xs flex-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      autoFocus
                      value={contactForm.name}
                      onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                      placeholder="e.g., Sarah Connor"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Designation
                    </label>
                    <input
                      type="text"
                      value={contactForm.designation}
                      onChange={(e) =>
                        setContactForm({ ...contactForm, designation: e.target.value })
                      }
                      placeholder="VP Engineering"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Email *
                    </label>
                    <input
                      type="email"
                      required
                      value={contactForm.email}
                      onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                      placeholder="sarah@client.com"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Phone
                    </label>
                    <input
                      type="text"
                      value={contactForm.phone}
                      onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                      placeholder="+1 (555) 234-5678"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:border-brand-600 focus:outline-none"
                    />
                  </div>
                </div>

                <label className="inline-flex items-center gap-2 text-[11px] font-medium text-slate-700 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={contactForm.isPrimary}
                    onChange={(e) =>
                      setContactForm({ ...contactForm, isPrimary: e.target.checked })
                    }
                    className="rounded border-slate-300"
                  />
                  <span>Mark as Primary Hiring Lead</span>
                </label>
              </div>

              <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  disabled={isSavingContact}
                  onClick={() => setShowAddContact(false)}
                  className="px-3.5 py-1.5 border border-slate-200 bg-white rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60 cursor-pointer"
                >
                  Cancel
                </button>
                <ActionButton
                  type="submit"
                  loading={isSavingContact}
                  loadingText="Saving..."
                  className="px-4 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold cursor-pointer"
                >
                  Save Contact
                </ActionButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};
