import { useEffect, useState } from 'react';
import {
  acceptInvite,
  bulkUpdateAttendance,
  decideAbsence,
  getAttendanceBoard,
  getPreferences,
  loginTelegram,
  meContext,
  requestAbsence,
  resolveInvite,
  setActiveRole as setActiveRolePreference,
  type AttendanceBoard,
  type MeContext,
} from './api';
import { getStartTokenFromTelegram, getStartTokenFromUrl, getTelegramWebApp } from './telegram';

type Tab = 'home' | 'schedule' | 'attendance' | 'payments' | 'profile';

const ACCESS_TOKEN_KEY = 'vneclassno_tg_access_token';
const ACTIVE_ROLE_KEY = 'vneclassno_tg_active_role';

type UserRole = 'super_admin' | 'section_admin' | 'coach' | 'parent';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'home', label: 'Главная' },
  { id: 'schedule', label: 'Календарь' },
  { id: 'attendance', label: 'Посещения' },
  { id: 'payments', label: 'Платежи' },
  { id: 'profile', label: 'Профиль' },
];

const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Главный админ',
  section_admin: 'Админ секции',
  coach: 'Тренер',
  parent: 'Родитель',
};

function toUserRole(value: string): UserRole | null {
  if (value === 'super_admin' || value === 'section_admin' || value === 'coach' || value === 'parent') {
    return value;
  }

  return null;
}

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

function isTransient(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const message = error.message.toLowerCase();
  return message.includes('fetch') || message.includes('timeout') || message.includes('долго отвечает');
}

async function withRetry<T>(fn: () => Promise<T>, retries = 1, delayMs = 1200): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === retries || !isTransient(error)) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}

export function App() {
  const [tab, setTab] = useState<Tab>('home');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  const [accessToken, setAccessToken] = useState('');
  const [context, setContext] = useState<MeContext | null>(null);
  const [activeRole, setActiveRole] = useState<UserRole>('parent');
  const [roleBusy, setRoleBusy] = useState(false);
  const [activeChildId, setActiveChildId] = useState('');
  const [activeSectionId, setActiveSectionId] = useState('');

  const [inviteToken, setInviteToken] = useState('');
  const [selectedChildId, setSelectedChildId] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [inviteMode, setInviteMode] = useState<'child' | 'new'>('new');
  const [attendanceBoard, setAttendanceBoard] = useState<AttendanceBoard | null>(null);
  const [attendanceBusy, setAttendanceBusy] = useState(false);

  useEffect(() => {
    void bootstrap();
  }, []);

  async function bootstrap() {
    setBusy(true);
    setError('');

    try {
      const wa = getTelegramWebApp();
      wa?.ready?.();
      wa?.expand?.();

      const initData = wa?.initData?.trim();
      const fallbackUserId = wa?.initDataUnsafe?.user?.id;
      const telegramInitData = initData && initData.length > 0 ? initData : fallbackUserId ? `id=${fallbackUserId}` : '';
      if (!telegramInitData) {
        throw new Error('Не удалось получить Telegram init data');
      }

      const storedToken = window.localStorage.getItem(ACCESS_TOKEN_KEY) ?? '';
      let resolvedToken = storedToken;
      let me: MeContext | null = null;

      if (storedToken) {
        try {
          me = await withRetry(() => meContext(storedToken), 1);
        } catch {
          window.localStorage.removeItem(ACCESS_TOKEN_KEY);
          resolvedToken = '';
        }
      }

      if (!me) {
        const auth = await withRetry(() => loginTelegram(telegramInitData), 1);
        resolvedToken = auth.accessToken;
        window.localStorage.setItem(ACCESS_TOKEN_KEY, resolvedToken);
        me = await withRetry(() => meContext(resolvedToken), 1);
      }

      setAccessToken(resolvedToken);
      setContext(me);

      const preferences = await getPreferences(resolvedToken).catch(() => ({ activeRole: undefined }));
      const storedRole = window.localStorage.getItem(ACTIVE_ROLE_KEY);
      const resolvedFromServer = preferences.activeRole && me.roles.includes(preferences.activeRole) ? preferences.activeRole : null;
      const hasStoredRole = typeof storedRole === 'string' && me.roles.includes(storedRole);
      const resolvedRole = resolvedFromServer ?? (hasStoredRole && storedRole ? storedRole : (me.roles[0] ?? 'parent'));
      const normalizedRole = toUserRole(resolvedRole) ?? 'parent';
      setActiveRole(normalizedRole);
      window.localStorage.setItem(ACTIVE_ROLE_KEY, normalizedRole);

      setActiveChildId(me.activeChildId ?? me.children[0]?.id ?? '');
      setActiveSectionId(me.activeSectionId ?? me.sections[0]?.id ?? '');
      setSelectedChildId(me.children[0]?.id ?? '');
      if (me.children.length === 0) {
        setInviteMode('new');
      }

      const token = getStartTokenFromUrl() ?? getStartTokenFromTelegram(wa) ?? '';
      if (token) {
        const invite = await withRetry(() => resolveInvite(token), 1);
        if (invite.invite.status === 'active') {
          setInviteToken(token);
          setStatusMessage('Найден инвайт: можно сразу отправить заявку из вкладки Главная.');
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка инициализации mini app');
    } finally {
      setBusy(false);
    }
  }

  async function handleAcceptInvite() {
    if (!inviteToken) {
      setError('Инвайт не найден');
      return;
    }

    if (inviteMode === 'child' && !selectedChildId) {
      setError('У вас пока нет ребенка в аккаунте. Выберите режим "Новый ребенок".');
      return;
    }

    if (inviteMode === 'new' && (!firstName.trim() || !lastName.trim())) {
      setError('Заполните имя и фамилию ребенка.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      const result =
        inviteMode === 'child'
          ? await acceptInvite(inviteToken, accessToken, { childId: selectedChildId })
          : await acceptInvite(inviteToken, accessToken, {
              newChild: {
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                birthDate: birthDate || undefined,
              },
            });

      setStatusMessage(`Готово. Статус заявки: ${result.status}`);
      setInviteToken('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка отправки заявки');
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

  const activeChild = context?.children.find((child) => child.id === activeChildId) ?? context?.children[0];
  const activeSection = context?.sections.find((section) => section.id === activeSectionId) ?? context?.sections[0];
  const hasChildren = (context?.children.length ?? 0) > 0;
  const isCoachView = activeRole === 'coach' || activeRole === 'section_admin' || activeRole === 'super_admin';

  async function switchRole(role: UserRole) {
    if (!accessToken) {
      return;
    }

    setRoleBusy(true);
    setError('');
    try {
      await setActiveRolePreference(accessToken, role);
      setActiveRole(role);
      window.localStorage.setItem(ACTIVE_ROLE_KEY, role);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось переключить роль');
    } finally {
      setRoleBusy(false);
    }
  }

  useEffect(() => {
    if (tab !== 'attendance') {
      return;
    }

    void loadAttendanceBoard();
  }, [tab, accessToken, activeSectionId]);

  if (!accessToken || !context) {
    return (
      <div className="page modern-shell">
        <section className="hero-head">
          <div className="hero-top-row">
            <span className="hero-chip">Telegram</span>
          </div>
          <div className="hero-logo">V</div>
        </section>
        <section className="content-sheet">
          <div className="auth-panel stack">
            <h1>Вход через Telegram</h1>
            <p className="muted">Открывайте мини-приложение из бота. Вход выполняется автоматически по Telegram ID.</p>
            <p>{busy ? 'Подключаемся...' : 'Ожидаем инициализацию...'}</p>
            {error && <p className="error-inline">{error}</p>}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="page modern-shell">
      <section className="hero-head">
        <div className="hero-top-row">
          <span className="hero-chip">{isCoachView ? 'Тренер' : 'Родитель'}</span>
          <span className="hero-chip">Online</span>
        </div>
        <div className="hero-logo">V</div>
        <div className="hero-title-wrap">
          <h2>{isCoachView ? 'Тренерский режим' : activeChild ? `${activeChild.firstName} ${activeChild.lastName}` : 'Ребенок не выбран'}</h2>
          <p>{activeSection?.name ?? 'Секция не выбрана'}</p>
        </div>
      </section>

      <section className="content-sheet">
        <div className={`context-grid compact-grid ${isCoachView ? 'coach-grid' : ''}`}>
          {!isCoachView && (
            <div className="stack">
              <p className="muted">Ребенок</p>
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
            <p className="muted">Секция</p>
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
                <p className="muted">Секция: {activeSection?.name ?? 'не выбрана'}</p>
                <div className="metric-grid">
                  <article className="metric-item">
                    <p className="muted">Следующее занятие</p>
                    <h3>Сегодня 18:00</h3>
                  </article>
                  <article className="metric-item">
                    <p className="muted">Отметка группы</p>
                    <h3>1 клик в Посещения</h3>
                  </article>
                  <article className="metric-item">
                    <p className="muted">Заявки</p>
                    <h3>Проверьте инвайты</h3>
                  </article>
                </div>
              </>
            ) : (
              <>
                <p className="muted">Секция: {activeSection?.name ?? 'не выбрана'}</p>
                <div className="metric-grid">
                  <article className="metric-item">
                    <p className="muted">Баланс</p>
                    <h3>8 занятий</h3>
                  </article>
                  <article className="metric-item">
                    <p className="muted">Ближайшее</p>
                    <h3>Сегодня 18:00</h3>
                  </article>
                  <article className="metric-item">
                    <p className="muted">Статус</p>
                    <h3>На занятии</h3>
                  </article>
                </div>
              </>
            )}

            {inviteToken && (
              <div className="stack invite-box">
                <p className="muted">Инвайт: {inviteToken}</p>
                <select value={inviteMode} onChange={(e) => setInviteMode(e.target.value as 'child' | 'new')}>
                  {hasChildren && <option value="child">Существующий ребенок</option>}
                  <option value="new">Новый ребенок</option>
                </select>

                {inviteMode === 'child' && hasChildren && (
                  <select value={selectedChildId} onChange={(e) => setSelectedChildId(e.target.value)}>
                    {context.children.map((child) => (
                      <option key={child.id} value={child.id}>
                        {child.firstName} {child.lastName}
                      </option>
                    ))}
                  </select>
                )}

                {inviteMode === 'new' && (
                  <>
                    <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Имя" />
                    <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Фамилия" />
                    <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
                  </>
                )}

                <button disabled={busy} onClick={() => void handleAcceptInvite()}>
                  {busy ? 'Отправляем...' : 'Отправить заявку по инвайту'}
                </button>
              </div>
            )}
          </>
        )}

        {tab === 'schedule' && (
          <>
            <h2>Календарь</h2>
            <div className="list-card">Сегодня 18:00 · Тренировка</div>
            <div className="list-card">Вс 13:30 · Игра</div>
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
                      <p className="muted">
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
          </>
        )}

        {tab === 'profile' && (
          <>
            <h2>Профиль</h2>
            <p className="muted">Активная роль: {ROLE_LABELS[activeRole]}</p>
            <div className="quick-roles">
              {context.roles
                .map((value) => toUserRole(value))
                .filter((value): value is UserRole => Boolean(value))
                .map((role) => (
                  <button
                    key={role}
                    type="button"
                    className={`role-pill ${activeRole === role ? 'active' : ''}`}
                    disabled={roleBusy}
                    onClick={() => void switchRole(role)}
                  >
                    {ROLE_LABELS[role]}
                  </button>
                ))}
            </div>
            <p className="muted">Вход выполнен через Telegram.</p>
          </>
        )}

        {statusMessage && <p className="success">{statusMessage}</p>}
        {error && <p className="error-inline">{error}</p>}
        </section>
      </section>

      <nav className="tabbar" aria-label="Навигация">
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
    </div>
  );
}
