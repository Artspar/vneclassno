'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  bulkUpdateAttendance,
  decideAbsence,
  getAttendanceBoard,
  getMeContext,
  loginPwa,
  requestAbsence,
  type AttendanceBoard,
  type MeContextResponse,
} from '../../lib/api';

const ACCESS_TOKEN_KEY = 'vneclassno_pwa_access_token';

type Tab = 'home' | 'schedule' | 'attendance' | 'payments' | 'profile';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'home', label: 'Главная' },
  { id: 'schedule', label: 'Календарь' },
  { id: 'attendance', label: 'Посещения' },
  { id: 'payments', label: 'Платежи' },
  { id: 'profile', label: 'Профиль' },
];

function TabIcon({ tab }: { tab: Tab }) {
  const shared = {
    width: 20,
    height: 20,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.9,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  if (tab === 'home') {
    return (
      <svg {...shared}>
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5.5 9.8V21h13V9.8" />
      </svg>
    );
  }

  if (tab === 'schedule') {
    return (
      <svg {...shared}>
        <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
        <path d="M8 3.5v3M16 3.5v3M3.5 9.5h17" />
      </svg>
    );
  }

  if (tab === 'attendance') {
    return (
      <svg {...shared}>
        <path d="M4 20.5h16" />
        <path d="M7 17V10M12 17V6M17 17v-3" />
      </svg>
    );
  }

  if (tab === 'payments') {
    return (
      <svg {...shared}>
        <rect x="3.5" y="6" width="17" height="12" rx="2.5" />
        <path d="M3.5 10h17M7 14h3" />
      </svg>
    );
  }

  return (
    <svg {...shared}>
      <circle cx="12" cy="8" r="3.4" />
      <path d="M5 20c.6-3.2 3.1-5 7-5s6.4 1.8 7 5" />
    </svg>
  );
}

export default function PwaShell() {
  const [tab, setTab] = useState<Tab>('home');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [phone, setPhone] = useState('+79990000001');
  const [otpCode, setOtpCode] = useState('1234');
  const [accessToken, setAccessToken] = useState('');
  const [context, setContext] = useState<MeContextResponse | null>(null);
  const [activeChildId, setActiveChildId] = useState('');
  const [activeSectionId, setActiveSectionId] = useState('');
  const [attendanceBoard, setAttendanceBoard] = useState<AttendanceBoard | null>(null);
  const [attendanceBusy, setAttendanceBusy] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(ACCESS_TOKEN_KEY) ?? '';
    if (!stored) {
      return;
    }

    setAccessToken(stored);
    void loadContext(stored);
  }, []);

  async function loadContext(token: string) {
    setBusy(true);
    setError('');
    try {
      const nextContext = await getMeContext(token);
      setContext(nextContext);
      setActiveChildId(nextContext.activeChildId ?? nextContext.children[0]?.id ?? '');
      setActiveSectionId(nextContext.activeSectionId ?? nextContext.sections[0]?.id ?? '');
    } catch (e) {
      window.localStorage.removeItem(ACCESS_TOKEN_KEY);
      setAccessToken('');
      setContext(null);
      setError(e instanceof Error ? e.message : 'Не удалось загрузить контекст');
    } finally {
      setBusy(false);
    }
  }

  async function login() {
    setBusy(true);
    setError('');
    try {
      const auth = await loginPwa(phone, otpCode);
      window.localStorage.setItem(ACCESS_TOKEN_KEY, auth.accessToken);
      setAccessToken(auth.accessToken);
      await loadContext(auth.accessToken);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка входа');
    } finally {
      setBusy(false);
    }
  }

  async function loadAttendanceBoard() {
    if (!accessToken || !activeSectionId) {
      return;
    }

    setAttendanceBusy(true);
    setError('');
    try {
      const board = await getAttendanceBoard(accessToken, activeSectionId);
      setAttendanceBoard(board);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить посещения');
    } finally {
      setAttendanceBusy(false);
    }
  }

  async function setAttendanceStatus(childId: string, status: 'present' | 'late' | 'absent') {
    if (!attendanceBoard) {
      return;
    }

    setAttendanceBusy(true);
    setError('');
    try {
      const next = await bulkUpdateAttendance(accessToken, {
        sessionId: attendanceBoard.session.id,
        updates: [{ childId, status }],
      });
      setAttendanceBoard(next);

      if (status === 'absent') {
        await requestAbsence(accessToken, {
          sessionId: attendanceBoard.session.id,
          childId,
          reason: 'Отметка тренера',
        });
        const refreshed = await getAttendanceBoard(accessToken, activeSectionId);
        setAttendanceBoard(refreshed);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось обновить посещение');
    } finally {
      setAttendanceBusy(false);
    }
  }

  async function handleAbsenceDecision(absenceId: string, decision: 'approved' | 'rejected') {
    setAttendanceBusy(true);
    setError('');
    try {
      await decideAbsence(accessToken, absenceId, {
        decision,
        isExcused: decision === 'approved',
      });
      const next = await getAttendanceBoard(accessToken, activeSectionId);
      setAttendanceBoard(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось принять решение по отсутствию');
    } finally {
      setAttendanceBusy(false);
    }
  }

  function logout() {
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    setAccessToken('');
    setContext(null);
    setActiveChildId('');
    setActiveSectionId('');
    setAttendanceBoard(null);
    setTab('home');
  }

  useEffect(() => {
    if (tab !== 'attendance') {
      return;
    }

    void loadAttendanceBoard();
  }, [tab, accessToken, activeSectionId]);

  const activeChild = context?.children.find((child) => child.id === activeChildId) ?? context?.children[0];
  const activeSection = context?.sections.find((section) => section.id === activeSectionId) ?? context?.sections[0];
  const isCoachView =
    context?.roles.includes('coach') || context?.roles.includes('section_admin') || context?.roles.includes('super_admin') || false;

  if (!accessToken || !context) {
    return (
      <main className="app-main modern-shell">
        <section className="hero-head fade-in-1">
          <div className="hero-top-row">
            <span className="hero-chip">VneClassno</span>
          </div>
          <div className="hero-logo">V</div>
        </section>

        <section className="content-sheet fade-in-2">
          <div className="auth-panel stack">
            <h1>Вход в приложение</h1>
            <p className="caption">Один раз вводите данные, дальше вход автоматический.</p>
            <div className="quick-roles">
              <button type="button" className="role-pill" onClick={() => setPhone('+79990000001')}>
                Родитель
              </button>
              <button type="button" className="role-pill" onClick={() => setPhone('+79990000002')}>
                Тренер
              </button>
              <button type="button" className="role-pill" onClick={() => setPhone('+79990000003')}>
                Админ секции
              </button>
            </div>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Телефон" />
            <input value={otpCode} onChange={(e) => setOtpCode(e.target.value)} placeholder="Код" />
            <button disabled={busy} onClick={() => void login()}>
              {busy ? 'Входим...' : 'Продолжить'}
            </button>
            {error && <p className="error">{error}</p>}
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="app-main modern-shell">
      <section className="hero-head fade-in-1">
        <div className="hero-top-row">
          <span className="hero-chip">{isCoachView ? 'Тренер' : 'Родитель'}</span>
          <button className="hero-chip ghost" onClick={logout}>
            Выйти
          </button>
        </div>
        <div className="hero-logo">V</div>
        <div className="hero-title-wrap">
          <h2>{isCoachView ? 'Тренерский режим' : activeChild ? `${activeChild.firstName} ${activeChild.lastName}` : 'Ребенок не выбран'}</h2>
          <p>{activeSection?.name ?? 'Секция не выбрана'}</p>
        </div>
      </section>

      <section className="content-sheet fade-in-2">
        <div className={`context-grid compact-grid ${isCoachView ? 'coach-grid' : ''}`}>
          {!isCoachView && (
            <div className="stack">
              <p className="caption">Ребенок</p>
              <select value={activeChildId} onChange={(e) => setActiveChildId(e.target.value)}>
                {context.children.map((child) => (
                  <option key={child.id} value={child.id}>
                    {child.firstName} {child.lastName}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="stack">
            <p className="caption">Секция</p>
            <select value={activeSectionId} onChange={(e) => setActiveSectionId(e.target.value)}>
              {context.sections.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <section className="tab-screen stack">
        {tab === 'home' && (
          <>
            {isCoachView ? (
              <>
                <div className="headline-row">
                  <h2>Группа под контролем</h2>
                  <span className="status-pill live">Тренер online</span>
                </div>
                <p className="caption">Секция: {activeSection?.name ?? 'не выбрана'}</p>
                <div className="metric-grid">
                  <article className="metric-item metric-cool">
                    <p className="caption">Следующее занятие</p>
                    <h3>Сегодня 18:00</h3>
                  </article>
                  <article className="metric-item metric-fresh">
                    <p className="caption">Отметить группу</p>
                    <h3>1 клик в Посещения</h3>
                  </article>
                  <article className="metric-item metric-warm">
                    <p className="caption">Новые заявки</p>
                    <h3>Проверьте инвайты</h3>
                  </article>
                </div>
              </>
            ) : (
              <>
                <div className="headline-row">
                  <span className="status-pill live">На занятии</span>
                </div>
                <p className="caption">Секция: {activeSection?.name ?? 'не выбрана'}</p>
                <div className="metric-grid">
                  <article className="metric-item metric-warm">
                    <p className="caption">Баланс абонемента</p>
                    <h3>8 занятий</h3>
                  </article>
                  <article className="metric-item metric-cool">
                    <p className="caption">Ближайшее занятие</p>
                    <h3>Сегодня 18:00</h3>
                  </article>
                  <article className="metric-item metric-fresh">
                    <p className="caption">Списано за месяц</p>
                    <h3>6 занятий</h3>
                  </article>
                </div>
              </>
            )}
          </>
        )}

        {tab === 'schedule' && (
          <>
            <h2>Расписание</h2>
            <p className="caption">Вт 18:00, Чт 18:00, Сб 11:00</p>
            <div className="list-card">Сегодня 18:00 · Тренировка · Зал 2</div>
            <div className="list-card">Воскресенье 13:30 · Игра · Стадион А</div>
          </>
        )}

        {tab === 'attendance' && (
          <>
            <h2>Посещения</h2>
            {!attendanceBoard && <div className="list-card">{attendanceBusy ? 'Загружаем...' : 'Нет данных по посещениям'}</div>}
            {attendanceBoard && (
              <>
                <div className="list-card">
                  {attendanceBoard.session.title} · {new Date(attendanceBoard.session.startsAt).toLocaleString('ru-RU')} ·{' '}
                  {attendanceBoard.session.status === 'live' ? 'Идет сейчас' : 'Запланировано'}
                </div>

                {attendanceBoard.items.map((item) => (
                  <div key={item.childId} className="list-card stack">
                    <div className="headline-row">
                      <strong>{item.childName}</strong>
                      <span className={`status-pill ${item.onLesson ? 'live' : ''}`}>
                        {item.onLesson
                          ? 'На занятии'
                          : item.status === 'present'
                            ? 'Присутствует'
                            : item.status === 'late'
                              ? 'Опоздал'
                              : item.status === 'absent'
                                ? 'Отсутствует'
                                : 'Ожидается'}
                      </span>
                    </div>

                    {isCoachView && attendanceBoard.canManage && (
                      <div className="inline-actions">
                        <button disabled={attendanceBusy} onClick={() => void setAttendanceStatus(item.childId, 'present')}>
                          Присутствует
                        </button>
                        <button disabled={attendanceBusy} onClick={() => void setAttendanceStatus(item.childId, 'late')}>
                          Опоздал
                        </button>
                        <button disabled={attendanceBusy} onClick={() => void setAttendanceStatus(item.childId, 'absent')}>
                          Отсутствует
                        </button>
                      </div>
                    )}

                    {isCoachView && attendanceBoard.canManage && item.absenceId && item.absenceStatus === 'pending' && (
                      <div className="inline-actions">
                        <button
                          disabled={attendanceBusy}
                          onClick={() => void handleAbsenceDecision(item.absenceId as string, 'approved')}
                        >
                          Легитимно
                        </button>
                        <button
                          disabled={attendanceBusy}
                          onClick={() => void handleAbsenceDecision(item.absenceId as string, 'rejected')}
                        >
                          Нелегитимно
                        </button>
                      </div>
                    )}

                    {item.absenceStatus === 'approved' && (
                      <p className="caption">
                        Отсутствие подтверждено: {item.isExcused ? 'абонемент не списывается/продлевается' : 'стандартное списание'}
                      </p>
                    )}
                  </div>
                ))}
              </>
            )}
          </>
        )}

        {tab === 'payments' && (
          <>
            <h2>Платежи</h2>
            <div className="list-card">Оплачено: 4 500 ₽ · auto_link</div>
            <div className="list-card">На проверке: 2 000 ₽ · manual_transfer</div>
            <button>Оплатить по СБП</button>
          </>
        )}

        {tab === 'profile' && (
          <>
            <h2>Профиль</h2>
            <p className="caption">Телефон: {phone}</p>
            <Link href="/demo" className="link-block">
              Открыть UI Test Lab
            </Link>
          </>
        )}
        </section>
      </section>

      <nav className="tabbar modern-tabbar fade-in-3" aria-label="Навигация">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`tabbar-item ${tab === item.id ? 'active' : ''}`}
            onClick={() => setTab(item.id)}
          >
            <TabIcon tab={item.id} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      {error && <p className="error">{error}</p>}
    </main>
  );
}
