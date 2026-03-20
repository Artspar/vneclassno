import { useEffect, useState } from 'react';
import { acceptInvite, loginTelegram, meContext, resolveInvite } from './api';
import { getStartTokenFromTelegram, getStartTokenFromUrl, getTelegramWebApp } from './telegram';

type Step = 'loading' | 'select-child' | 'create-child' | 'done' | 'error';

export function App() {
  const [step, setStep] = useState<Step>('loading');
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [token, setToken] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [children, setChildren] = useState<Array<{ id: string; firstName: string; lastName: string }>>([]);
  const [selectedChildId, setSelectedChildId] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [busy, setBusy] = useState(false);

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

      const inviteToken = getStartTokenFromUrl() ?? getStartTokenFromTelegram(wa) ?? '';
      if (!inviteToken) {
        throw new Error('Не найден токен инвайта');
      }

      setToken(inviteToken);

      const initData = wa?.initData?.trim();
      const fallbackUserId = wa?.initDataUnsafe?.user?.id;
      const telegramInitData = initData && initData.length > 0 ? initData : fallbackUserId ? `id=${fallbackUserId}` : '';
      if (!telegramInitData) {
        throw new Error('Не удалось получить Telegram init data');
      }

      const auth = await loginTelegram(telegramInitData);
      setAccessToken(auth.accessToken);

      const invite = await resolveInvite(inviteToken);
      if (invite.invite.status !== 'active') {
        throw new Error(`Инвайт недействителен: ${invite.invite.status}`);
      }

      const me = await meContext(auth.accessToken);
      setChildren(me.children);
      if (me.children.length > 0) {
        setSelectedChildId(me.children[0].id);
        setStep('select-child');
      } else {
        setStep('create-child');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка инициализации mini app');
      setStep('error');
    } finally {
      setBusy(false);
    }
  }

  async function handleAcceptSelected() {
    if (!selectedChildId) {
      setError('Выберите ребенка');
      return;
    }

    setBusy(true);
    setError('');
    try {
      const result = await acceptInvite(token, accessToken, { childId: selectedChildId });
      setStatusMessage(`Готово. Статус: ${result.status}`);
      setStep('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка отправки заявки');
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateAndAccept() {
    if (!firstName.trim() || !lastName.trim()) {
      setError('Заполните имя и фамилию');
      return;
    }

    setBusy(true);
    setError('');
    try {
      const result = await acceptInvite(token, accessToken, {
        newChild: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          birthDate: birthDate || undefined,
        },
      });
      setStatusMessage(`Готово. Статус: ${result.status}`);
      setStep('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка отправки заявки');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <div className="card">
        <span className="badge">Telegram Mini App</span>
        <h1>Добавление ребенка в секцию</h1>
        <p className="muted">Инвайт: {token || '...'}</p>
      </div>

      {step === 'loading' && (
        <div className="card">
          <p>{busy ? 'Загрузка...' : 'Подготовка данных...'}</p>
        </div>
      )}

      {step === 'select-child' && (
        <div className="card stack">
          <h2>Выберите ребенка</h2>
          <select value={selectedChildId} onChange={(e) => setSelectedChildId(e.target.value)}>
            {children.map((child) => (
              <option key={child.id} value={child.id}>
                {child.firstName} {child.lastName}
              </option>
            ))}
          </select>
          <button disabled={busy} onClick={() => void handleAcceptSelected()}>
            {busy ? 'Отправляем...' : 'Добавить в секцию'}
          </button>
          <button className="secondary" disabled={busy} onClick={() => setStep('create-child')}>
            Создать нового ребенка
          </button>
        </div>
      )}

      {step === 'create-child' && (
        <div className="card stack">
          <h2>Новый ребенок</h2>
          <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Имя" />
          <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Фамилия" />
          <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
          <button disabled={busy} onClick={() => void handleCreateAndAccept()}>
            {busy ? 'Отправляем...' : 'Создать и отправить'}
          </button>
          {children.length > 0 && (
            <button className="secondary" disabled={busy} onClick={() => setStep('select-child')}>
              Назад к выбору
            </button>
          )}
        </div>
      )}

      {step === 'done' && (
        <div className="card">
          <h2>Готово</h2>
          <p className="success">{statusMessage}</p>
        </div>
      )}

      {step === 'error' && (
        <div className="card">
          <h2>Ошибка</h2>
          <p className="error">{error || 'Не удалось обработать инвайт'}</p>
        </div>
      )}

      {error && step !== 'error' && <p className="error-inline">{error}</p>}
    </div>
  );
}
