import { useEffect, useState } from 'react';
import { acceptInvite, loginTelegram, meContext, resolveInvite, type MeContext } from './api';
import { getStartTokenFromTelegram, getStartTokenFromUrl, getTelegramWebApp } from './telegram';

type Tab = 'home' | 'schedule' | 'attendance' | 'payments' | 'profile';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'home', label: 'Главная' },
  { id: 'schedule', label: 'Календарь' },
  { id: 'attendance', label: 'Посещения' },
  { id: 'payments', label: 'Платежи' },
  { id: 'profile', label: 'Профиль' },
];

export function App() {
  const [tab, setTab] = useState<Tab>('home');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  const [accessToken, setAccessToken] = useState('');
  const [context, setContext] = useState<MeContext | null>(null);
  const [activeChildId, setActiveChildId] = useState('');
  const [activeSectionId, setActiveSectionId] = useState('');

  const [inviteToken, setInviteToken] = useState('');
  const [selectedChildId, setSelectedChildId] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [inviteMode, setInviteMode] = useState<'child' | 'new'>('child');

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

      const auth = await loginTelegram(telegramInitData);
      setAccessToken(auth.accessToken);

      const me = await meContext(auth.accessToken);
      setContext(me);
      setActiveChildId(me.activeChildId ?? me.children[0]?.id ?? '');
      setActiveSectionId(me.activeSectionId ?? me.sections[0]?.id ?? '');
      setSelectedChildId(me.children[0]?.id ?? '');
      if (me.children.length === 0) {
        setInviteMode('new');
      }

      const token = getStartTokenFromUrl() ?? getStartTokenFromTelegram(wa) ?? '';
      if (token) {
        const invite = await resolveInvite(token);
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

  const activeChild = context?.children.find((child) => child.id === activeChildId) ?? context?.children[0];
  const activeSection = context?.sections.find((section) => section.id === activeSectionId) ?? context?.sections[0];
  const hasChildren = (context?.children.length ?? 0) > 0;

  if (!accessToken || !context) {
    return (
      <div className="page">
        <div className="card stack">
          <span className="badge">Telegram Mini App</span>
          <h1>Вход через Telegram</h1>
          <p className="muted">Открывайте мини-приложение из бота. Вход выполняется автоматически по Telegram ID.</p>
          <p>{busy ? 'Подключаемся...' : 'Ожидаем инициализацию...'}</p>
          {error && <p className="error-inline">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="page app">
      <section className="card stack">
        <div className="top-row">
          <span className="badge">Родитель</span>
          <span className="status">Online</span>
        </div>

        <div className="context-grid">
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
      </section>

      <section className="card stack">
        {tab === 'home' && (
          <>
            <h2>{activeChild ? `${activeChild.firstName} ${activeChild.lastName}` : 'Ребенок не выбран'}</h2>
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
            <div className="list-card">12 мар · присутствовал</div>
            <div className="list-card">14 мар · отсутствовал</div>
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
            <p className="muted">Вход выполнен через Telegram.</p>
          </>
        )}

        {statusMessage && <p className="success">{statusMessage}</p>}
        {error && <p className="error-inline">{error}</p>}
      </section>

      <nav className="tabbar card" aria-label="Навигация">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`tabbar-item ${tab === item.id ? 'active' : ''}`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
