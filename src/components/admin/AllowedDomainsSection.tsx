// Fm16BUutfUO: Admin-Sektion für die E-Mail-Domain-Whitelist.
// Beim Eintragen einer Domain dürfen sich Nutzer mit dieser Domain
// selbst per Magic-Link registrieren (werden als 'member' angelegt).

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '../../data/api';
import { Icon } from '../shared/Icon';
import { showToast } from '../shared/Toast';
import { useT } from '../../i18n';

const KEY = ['btm', 'allowed-domains'] as const;

export function AllowedDomainsSection() {
  const t = useT();
  const qc = useQueryClient();
  const [draft, setDraft] = useState('');
  const [adding, setAdding] = useState(false);

  const { data: domains = [], isLoading } = useQuery({
    queryKey: KEY,
    queryFn: api.listAllowedDomains,
    staleTime: 60_000,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: KEY });

  const submitNew = async () => {
    const d = draft.trim().toLowerCase().replace(/^@/, '');
    if (!d) return;
    setAdding(true);
    try {
      await api.addAllowedDomain(d);
      setDraft('');
      refresh();
      showToast(t('admin.domains_added'));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '';
      if (msg.includes('409') || msg.includes('duplicate')) {
        showToast(t('admin.domains_duplicate'));
      } else if (msg.includes('400') || msg.includes('invalid')) {
        showToast(t('admin.domains_invalid'));
      } else {
        showToast(t('common.error_generic'));
      }
    } finally {
      setAdding(false);
    }
  };

  const remove = async (id: string, domain: string) => {
    if (!confirm(t('admin.domains_delete_confirm', { domain }))) return;
    try {
      await api.deleteAllowedDomain(id);
      refresh();
    } catch {
      showToast(t('common.error_generic'));
    }
  };

  return (
    <section className="admin-section admin-domains-section">
      <div className="admin-section-head">
        <Icon name="shield-check" size={14} />
        <h3>{t('admin.domains_heading')}</h3>
        <span className="admin-section-count">{domains.length}</span>
      </div>
      <p className="admin-domains-hint">{t('admin.domains_hint')}</p>

      <div className="admin-domains-add">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submitNew(); } }}
          placeholder={t('admin.domains_add_placeholder')}
          maxLength={253}
          disabled={adding}
        />
        <button
          type="button"
          className="tb-btn accent"
          onClick={submitNew}
          disabled={!draft.trim() || adding}
        >
          <Icon name="plus" size={12} /> {t('common.add')}
        </button>
      </div>

      {isLoading ? (
        <div className="admin-domains-empty">{t('common.loading')}</div>
      ) : domains.length === 0 ? (
        <div className="admin-domains-empty">{t('admin.domains_empty')}</div>
      ) : (
        <ul className="admin-domains-list">
          {domains.map((d) => (
            <li key={d.id} className="admin-domain-row">
              <Icon name="at-sign" size={11} />
              <span className="admin-domain-name">{d.domain}</span>
              <button
                type="button"
                className="admin-domain-delete"
                onClick={() => remove(d.id, d.domain)}
                title={t('common.delete')}
                aria-label={t('common.delete')}
              >
                <Icon name="x" size={11} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
