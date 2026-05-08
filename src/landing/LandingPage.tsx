import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Icon } from '../components/shared/Icon';
import { useT, useLocale } from '../i18n';

const TASKS = [
  { id: 't1', titleKey: 'landing.preview_card_done_title', hours: '2h', who: 'AB', color: '#4a6f8a' },
  { id: 't2', titleKey: 'landing.preview_card_t2_title', hours: '4h', who: 'EY', color: '#b86a3a' },
  { id: 't3', titleKey: 'landing.preview_card_t1_title', hours: '3h', who: 'AB', color: '#4a6f8a' },
  { id: 't4', titleKey: 'landing.preview_card_t3_title', hours: '1.5h', who: 'AB', color: '#4a6f8a' },
  { id: 't5', titleKey: 'landing.preview_card_t4_title', hours: '1.5h', who: 'JW', color: '#6a8455' },
  { id: 't6', titleKey: 'landing.preview_card_doing_title', hours: '0.5h', who: 'AB', color: '#4a6f8a' },
  { id: 't7', titleKey: 'landing.preview_card_review', hours: '1h', who: 'EY', color: '#b86a3a' },
  { id: 't8', titleKey: 'landing.preview_card_t4_title', hours: '1h', who: 'JW', color: '#6a8455' },
];

type Lane = 'todo' | 'doing' | 'done';
type State = Record<Lane, string[]>;

export interface LandingPageProps {
  onLogin: () => void;
}

function fmtClock(s: number): string {
  const h = String(Math.floor(s / 3600)).padStart(2, '0');
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const sec = String(s % 60).padStart(2, '0');
  return `${h}:${m}:${sec}`;
}

export function LandingPage({ onLogin }: LandingPageProps) {
  const t = useT();
  const [locale] = useLocale();
  void locale;
  const [state, setState] = useState<State>({
    todo: ['t2', 't3', 't8'],
    doing: ['t4'],
    done: ['t6', 't7'],
  });
  const [enteringId, setEnteringId] = useState<string | null>(null);
  const [clock, setClock] = useState(24 * 60 + 18);
  const tickRef = useRef(0);

  useEffect(() => {
    document.body.classList.add('is-landing');
    document.documentElement.classList.add('is-landing');
    return () => {
      document.body.classList.remove('is-landing');
      document.documentElement.classList.remove('is-landing');
    };
  }, []);

  useEffect(() => {
    const id = setInterval(() => setClock((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const cycle = () => {
      tickRef.current++;
      setState((prev) => {
        let next: State = { ...prev };
        if (next.doing.length > 0) {
          const id = next.doing[0];
          next = { ...next, doing: next.doing.slice(1), done: [...next.done, id] };
          setEnteringId(id);
        }
        return next;
      });
      setTimeout(() => {
        setState((prev) => {
          if (prev.todo.length === 0) return prev;
          const id = prev.todo[0];
          setEnteringId(id);
          return { ...prev, todo: prev.todo.slice(1), doing: [...prev.doing, id] };
        });
      }, 700);
      setTimeout(() => {
        setState((prev) => (prev.done.length > 3 ? { ...prev, done: prev.done.slice(-3) } : prev));
      }, 1400);
      setTimeout(() => {
        setState((prev) => {
          const used = new Set([...prev.todo, ...prev.doing, ...prev.done]);
          const free = TASKS.filter((tk) => !used.has(tk.id));
          if (prev.todo.length < 3 && free.length > 0) {
            const tk = free[Math.floor(Math.random() * free.length)];
            setEnteringId(tk.id);
            return { ...prev, todo: [...prev.todo, tk.id] };
          }
          return prev;
        });
      }, 2100);
    };
    const id = setInterval(cycle, 4500);
    return () => clearInterval(id);
  }, []);

  const findTask = (id: string) => TASKS.find((tk) => tk.id === id);
  const onLoginClick = (e?: React.MouseEvent) => {
    e?.preventDefault();
    onLogin();
  };

  const features: Array<{
    icon: string;
    title: string;
    desc: string;
    stat: ReactNode;
  }> = [
    {
      icon: 'layout-grid',
      title: t('landing.feat_board_title'),
      desc: t('landing.feat_board_desc'),
      stat: (
        <>
          <strong>{t('landing.feat_board_stat_strong')}</strong>
          {t('landing.feat_board_stat_rest')}
        </>
      ),
    },
    {
      icon: 'sparkles',
      title: t('landing.feat_ai_title'),
      desc: t('landing.feat_ai_desc'),
      stat: (
        <>
          <strong>{t('landing.feat_ai_stat_strong')}</strong>
          {t('landing.feat_ai_stat_rest')}
        </>
      ),
    },
    {
      icon: 'clock',
      title: t('landing.feat_times_title'),
      desc: t('landing.feat_times_desc'),
      stat: (
        <>
          <strong>{t('landing.feat_times_stat_strong')}</strong>
          {t('landing.feat_times_stat_rest')}
        </>
      ),
    },
    {
      icon: 'users',
      title: t('landing.feat_capacity_title'),
      desc: t('landing.feat_capacity_desc'),
      stat: (
        <>
          <strong>{t('landing.feat_capacity_stat_strong')}</strong>
        </>
      ),
    },
    {
      icon: 'timer',
      title: t('landing.feat_pomo_title'),
      desc: t('landing.feat_pomo_desc'),
      stat: (
        <>
          <strong>{t('landing.feat_pomo_stat_strong')}</strong>
          {t('landing.feat_pomo_stat_rest')}
        </>
      ),
    },
    {
      icon: 'monitor',
      title: t('landing.feat_tv_title'),
      desc: t('landing.feat_tv_desc'),
      stat: (
        <>
          <strong>{t('landing.feat_tv_stat_strong')}</strong>
          {t('landing.feat_tv_stat_rest')}
        </>
      ),
    },
  ];

  return (
    <div className="lp-root">
      <header className="lp-top">
        <div className="lp-top-inner">
          <div className="lp-logo">
            <div className="lp-logo-mark">
              <svg viewBox="0 0 32 32" width="20" height="20" fill="none">
                <rect x="6" y="9" width="20" height="2" rx="1" fill="#fff" fillOpacity="0.18" />
                <rect x="6" y="15" width="20" height="2" rx="1" fill="#fff" fillOpacity="0.18" />
                <rect x="6" y="21" width="20" height="2" rx="1" fill="#fff" fillOpacity="0.18" />
                <rect x="6" y="9" width="9" height="2" rx="1" fill="#fff" fillOpacity="0.55" />
                <rect x="6" y="15" width="14" height="2" rx="1" fill="#fff" fillOpacity="0.55" />
                <rect x="6" y="21" width="6" height="2" rx="1" fill="#fff" fillOpacity="0.55" />
                <rect x="20" y="14" width="4" height="4" rx="2" fill="#C85A2C" />
              </svg>
            </div>
            <div className="lp-logo-text">BTM</div>
            <div className="lp-org-tag">{t('landing.org_tag')}</div>
          </div>
          <div className="lp-top-spacer" />
          <a href="#features" className="lp-top-link">
            {t('landing.nav_features')}
          </a>
          <a href="#mcp" className="lp-top-link">
            {t('landing.nav_mcp')}
          </a>
          <a href="#preview" className="lp-top-link">
            {t('landing.nav_preview')}
          </a>
          <a href="#login" onClick={onLoginClick} className="lp-btn">
            <Icon name="log-in" size={14} />
            {t('landing.nav_login')}
          </a>
        </div>
      </header>

      <section className="lp-hero">
        <div>
          <div className="lp-eyebrow">{t('landing.hero_eyebrow')}</div>
          <h1>
            {t('landing.hero_h1_l1')}
            <br />
            {t('landing.hero_h1_l2')}
            <br />
            <span className="accent">{t('landing.hero_h1_l3_accent')}</span>
          </h1>
          <p className="lead">{t('landing.hero_lead')}</p>
          <div className="lp-cta-row">
            <a href="#login" onClick={onLoginClick} className="lp-btn">
              <Icon name="log-in" size={14} />
              {t('landing.hero_cta_login')}
            </a>
            <a href="#features" className="lp-btn ghost">
              {t('landing.hero_cta_more')}
              <Icon name="arrow-down" size={14} />
            </a>
          </div>
          <div className="lp-meta">
            <span className="lp-meta-dot" />
            <span>{t('landing.meta_status')}</span>
            <span style={{ opacity: 0.4 }}>·</span>
            <span>{t('landing.meta_version')}</span>
          </div>
        </div>

        <div className="mini-board">
          <div className="mini-board-head">
            <div>
              <div className="mb-week">{t('landing.mb_week')}</div>
              <div className="mb-week-meta">{t('landing.mb_week_meta')}</div>
            </div>
            <div className="mb-spacer" />
            <div className="mb-clock">
              <span className="mb-clock-dot" />
              <span>{fmtClock(clock)}</span>
            </div>
          </div>
          <div className="mb-cols">
            {(
              [
                { key: 'todo', label: t('landing.mb_col_todo'), dot: 'todo' as const },
                { key: 'doing', label: t('landing.mb_col_doing'), dot: 'doing' as const },
                { key: 'done', label: t('landing.mb_col_done'), dot: 'done' as const },
              ] as const
            ).map((col) => (
              <div className="mb-col" key={col.key}>
                <div className="mb-col-head">
                  <span className={`mb-col-dot ${col.dot}`} />
                  <span className="mb-col-ttl">{col.label}</span>
                  <span className="mb-col-ct">{state[col.key].length}</span>
                </div>
                <div className="mb-col-body">
                  {state[col.key].map((id) => {
                    const tk = findTask(id);
                    if (!tk) return null;
                    const isLive = col.key === 'doing';
                    const isDone = col.key === 'done';
                    const cls = ['mb-card', isLive && 'live', isDone && 'done', enteringId === id && 'entering']
                      .filter(Boolean)
                      .join(' ');
                    return (
                      <div key={id} className={cls}>
                        <div className="mb-card-title">{t(tk.titleKey as 'landing.preview_card_done_title')}</div>
                        <div className="mb-card-meta">
                          <span className="mb-card-who" style={{ background: tk.color }}>
                            {tk.who}
                          </span>
                          {isLive && <span className="live-pip" />}
                          <span className="mb-card-hours">{tk.hours}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-pitch">
        <p className="pitch-text">
          {t('landing.pitch_strong')} <span className="dim">{t('landing.pitch_dim')}</span>{' '}
          {t('landing.pitch_outro')}
        </p>
      </section>

      <section className="lp-section" id="features">
        <div className="lp-section-label">{t('landing.section_features_label')}</div>
        <h2>{t('landing.section_features_h2')}</h2>
        <p className="sub">{t('landing.section_features_sub')}</p>

        <div className="lp-features">
          {features.map((f) => (
            <div className="lp-feat" key={f.title}>
              <div className="lp-feat-icon">
                <Icon name={f.icon} size={18} />
              </div>
              <h3>{f.title}</h3>
              <p className="desc">{f.desc}</p>
              <div className="ft-stat">{f.stat}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="lp-mcp" id="mcp">
        <div className="lp-section">
          <div className="lp-mcp-grid">
            <div>
              <div className="lp-mcp-pill">
                <span className="dot" />
                {t('landing.mcp_pill')}
              </div>
              <h2>{t('landing.mcp_h2')}</h2>
              <p className="sub">{t('landing.mcp_sub')}</p>
              <ul className="lp-mcp-tools">
                {[
                  ['btm.create_task', t('landing.mcp_tool_create_task')],
                  ['btm.move_task', t('landing.mcp_tool_move_task')],
                  ['btm.start_timer', t('landing.mcp_tool_start_timer')],
                  ['btm.list_week', t('landing.mcp_tool_list_week')],
                  ['btm.plan_from_text', t('landing.mcp_tool_plan_from_text')],
                ].map(([code, desc]) => (
                  <li key={code} className="lp-mcp-tool">
                    <code>{code}</code>
                    <span>{desc}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="lp-mcp-chat">
              <div className="lp-mcp-chat-head">
                <span>{t('landing.mcp_chat_head')}</span>
                <span className="live" />
              </div>
              <div className="lp-mcp-msg user">
                <div className="lp-mcp-avatar">AB</div>
                <div className="lp-mcp-bubble">{t('landing.mcp_chat_user')}</div>
              </div>
              <div className="lp-mcp-msg ai">
                <div className="lp-mcp-avatar">C</div>
                <div className="lp-mcp-bubble">
                  {t('landing.mcp_chat_ai_intro_pre')}
                  <span className="dim">{t('landing.mcp_chat_ai_intro_dim')}</span>
                  {t('landing.mcp_chat_ai_intro_post')}
                  {[
                    ['„Lighthouse-Audit + Top-3 Fixes"', '1,5h'],
                    ['„og:image korrigieren"', '1,0h'],
                    ['„Sprint-Review vorbereiten"', '1,5h'],
                  ].map(([title, h]) => (
                    <div className="lp-mcp-tool-call" key={title}>
                      <span className="check">✓</span>
                      <span>
                        <span className="name">btm.create_task</span> · {title} · {h}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="lp-preview">
        <div className="lp-section" id="preview" style={{ paddingTop: 80, paddingBottom: 80 }}>
          <div className="lp-section-label">{t('landing.preview_label')}</div>
          <h2>{t('landing.preview_h2')}</h2>
          <p className="sub">{t('landing.preview_sub')}</p>

          <div className="lp-preview-frame">
            <div className="lp-preview-chrome">
              <span className="dot" />
              <span className="dot" />
              <span className="dot" />
              <span className="url">{t('landing.preview_chrome_url')}</span>
            </div>
            <div className="lp-preview-stage">
              <aside className="lp-preview-side">
                <div className="ps-label">{t('landing.preview_side_work')}</div>
                {[
                  t('sidebar.week'),
                  t('sidebar.board'),
                  t('sidebar.capacity'),
                  t('sidebar.times'),
                  t('sidebar.projects'),
                ].map((label, i) => (
                  <div className={`ps-item ${i === 0 ? 'active' : ''}`} key={label}>
                    <span className="ps-bar" />
                    {label}
                  </div>
                ))}
                <div className="ps-label">{t('landing.preview_side_outlook')}</div>
                {[t('sidebar.mobile_preview'), t('sidebar.tv_dashboard')].map((label) => (
                  <div className="ps-item" key={label}>
                    <span className="ps-bar" />
                    {label}
                  </div>
                ))}
              </aside>
              <main className="lp-preview-main">
                <div className="lp-preview-kpi-row">
                  {(
                    [
                      [
                        t('landing.preview_kpi_week'),
                        <>
                          12,4<span className="u">{t('landing.preview_kpi_week_unit')}</span>
                        </>,
                      ],
                      [t('landing.preview_kpi_active'), '1'],
                      [t('landing.preview_kpi_open'), '5'],
                      [t('landing.preview_kpi_done'), '1'],
                    ] as Array<[string, ReactNode]>
                  ).map(([k, v], i) => (
                    <div className="lp-preview-kpi" key={i}>
                      <div className="k">{k}</div>
                      <div className="v">{v}</div>
                    </div>
                  ))}
                </div>
                <div className="lp-preview-kanban">
                  <div className="lpk-col">
                    <div className="lpk-col-head">
                      <span className="mb-col-dot todo" /> {t('landing.mb_col_todo')}{' '}
                      <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-500)' }}>
                        5
                      </span>
                    </div>
                    {(
                      [
                        [t('landing.preview_card_t1_title'), t('landing.preview_card_t1_meta')],
                        [t('landing.preview_card_t2_title'), t('landing.preview_card_t2_meta')],
                        [t('landing.preview_card_t3_title'), t('landing.preview_card_t3_meta')],
                        [t('landing.preview_card_t4_title'), t('landing.preview_card_t4_meta')],
                      ] as Array<[string, string]>
                    ).map(([title, m]) => (
                      <div className="lpk-card" key={title}>
                        {title}
                        <div className="ct">{m}</div>
                      </div>
                    ))}
                  </div>
                  <div className="lpk-col">
                    <div className="lpk-col-head">
                      <span className="mb-col-dot doing" /> {t('landing.mb_col_doing')}{' '}
                      <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-500)' }}>
                        1
                      </span>
                    </div>
                    <div className="lpk-card live">
                      {t('landing.preview_card_doing_title')}
                      <div className="ct">
                        <span className="lpk-pip" /> {t('landing.preview_card_running')}
                      </div>
                    </div>
                    <div
                      className="lpk-card"
                      style={{
                        borderStyle: 'dashed',
                        background: 'transparent',
                        color: 'var(--ink-500)',
                        textAlign: 'center',
                        fontStyle: 'italic',
                      }}
                    >
                      {t('landing.preview_card_review')}
                    </div>
                  </div>
                  <div className="lpk-col">
                    <div className="lpk-col-head">
                      <span className="mb-col-dot done" /> {t('landing.mb_col_done')}{' '}
                      <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-500)' }}>
                        1
                      </span>
                    </div>
                    <div className="lpk-card" style={{ opacity: 0.65 }}>
                      {t('landing.preview_card_done_title')}
                      <div className="ct">{t('landing.preview_card_done')}</div>
                    </div>
                  </div>
                </div>
              </main>
            </div>
          </div>
        </div>
      </section>

      <section className="lp-login">
        <h2>{t('landing.login_h2')}</h2>
        <p>{t('landing.login_p')}</p>
        <a href="#login" onClick={onLoginClick} className="lp-btn">
          <Icon name="mail" size={14} />
          {t('landing.login_cta')}
        </a>
        <div className="ml-hint">{t('landing.login_hint')}</div>
      </section>

      <footer className="lp-foot">
        <div className="lp-foot-inner">
          <div className="lp-foot-org">{t('landing.foot_org')}</div>
          <div className="lp-foot-spacer" />
          <a href="#">{t('landing.foot_imprint')}</a>
          <a href="#">{t('landing.foot_privacy')}</a>
          <a href="#login" onClick={onLoginClick}>
            {t('landing.foot_login')}
          </a>
        </div>
      </footer>
    </div>
  );
}
