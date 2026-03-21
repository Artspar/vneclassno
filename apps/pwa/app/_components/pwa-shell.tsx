'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  bulkUpdateAttendance,
  confirmParticipation,
  createInvite,
  createNotification,
  decideAbsence,
  getAttendanceBoard,
  getNotifications,
  markNotificationRead,
  getPaymentOptions,
  getContextSelection,
  getMeContext,
  getPreferences,
  loginPwa,
  requestPwaOtp,
  requestTelegramLink,
  requestAbsence,
  setContextSelection,
  setActiveRole as setActiveRolePreference,
  type AttendanceBoard,
  type MeContextResponse,
  type NotificationFeedResponse,
  type OtpChannel,
  type PaymentOptionsResponse,
} from '../../lib/api';

const ACCESS_TOKEN_KEY = 'vneclassno_pwa_access_token';
const ACTIVE_ROLE_KEY = 'vneclassno_pwa_active_role';
const NOTIFICATION_READ_KEY_PREFIX = 'vneclassno_pwa_notification_read_';

type UserRole = 'super_admin' | 'section_admin' | 'coach' | 'parent';

type Tab = 'home' | 'schedule' | 'attendance' | 'payments' | 'profile';

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


function getDeliveryTick(delivery?: { attempted: number; delivered: number; failed: number }): string {
  if (!delivery || delivery.attempted === 0) {
    return '✓';
  }

  if (delivery.delivered >= delivery.attempted) {
    return '✓✓';
  }

  return '✓';
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

export default function PwaShell() {
  const [tab, setTab] = useState<Tab>('home');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [phone, setPhone] = useState('+79990000001');
  const [otpCode, setOtpCode] = useState('1234');
  const [otpChannel, setOtpChannel] = useState<OtpChannel>('sms');
  const [otpRequestId, setOtpRequestId] = useState('');
  const [otpStatus, setOtpStatus] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [context, setContext] = useState<MeContextResponse | null>(null);
  const [activeRole, setActiveRole] = useState<UserRole>('parent');
  const [roleBusy, setRoleBusy] = useState(false);
  const [activeChildId, setActiveChildId] = useState('');
  const [activeSectionId, setActiveSectionId] = useState('');
  const [attendanceBoard, setAttendanceBoard] = useState<AttendanceBoard | null>(null);
  const [attendanceBusy, setAttendanceBusy] = useState(false);
  const [notificationFeed, setNotificationFeed] = useState<NotificationFeedResponse | null>(null);
  const [notificationBusy, setNotificationBusy] = useState(false);
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>([]);
  const [participationEditOpen, setParticipationEditOpen] = useState(false);
  const [notificationEditIds, setNotificationEditIds] = useState<string[]>([]);
  const [paymentOptions, setPaymentOptions] = useState<PaymentOptionsResponse | null>(null);
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [notificationType, setNotificationType] = useState<'training' | 'game' | 'event'>('training');
  const [notificationTitle, setNotificationTitle] = useState('');
  const [notificationMessage, setNotificationMessage] = useState('');
  const [notificationTargetMode, setNotificationTargetMode] = useState<'all' | 'selected'>('all');
  const [notificationChildIds, setNotificationChildIds] = useState<string[]>([]);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareLinkUrl, setShareLinkUrl] = useState('');
  const [shareChildId, setShareChildId] = useState('');
  const [linkBusy, setLinkBusy] = useState(false);
  const [telegramLinkUrl, setTelegramLinkUrl] = useState('');

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

      const preferences = await getPreferences(token).catch(() => ({ activeRole: undefined }));
      const storedRole = window.localStorage.getItem(ACTIVE_ROLE_KEY);
      const resolvedFromServer = preferences.activeRole && nextContext.roles.includes(preferences.activeRole) ? preferences.activeRole : null;
      const hasStoredRole = typeof storedRole === 'string' && nextContext.roles.includes(storedRole);
      const resolvedRole = resolvedFromServer ?? (hasStoredRole && storedRole ? storedRole : (nextContext.roles[0] ?? 'parent'));
      const normalizedRole = toUserRole(resolvedRole) ?? 'parent';
      setActiveRole(normalizedRole);
      window.localStorage.setItem(ACTIVE_ROLE_KEY, normalizedRole);

      const selection = await getContextSelection(token).catch(() => ({ activeChildId: undefined, activeSectionId: undefined }));

      setActiveChildId(selection.activeChildId ?? nextContext.activeChildId ?? nextContext.children[0]?.id ?? '');
      setActiveSectionId(selection.activeSectionId ?? nextContext.activeSectionId ?? nextContext.sections[0]?.id ?? '');

      const readKey = `${NOTIFICATION_READ_KEY_PREFIX}${nextContext.userId}`;
      const rawRead = window.localStorage.getItem(readKey);
      if (!rawRead) {
        setReadNotificationIds([]);
      } else {
        try {
          const parsed = JSON.parse(rawRead);
          setReadNotificationIds(Array.isArray(parsed) ? parsed.filter((value) => typeof value === 'string') : []);
        } catch {
          setReadNotificationIds([]);
        }
      }
    } catch (e) {
      window.localStorage.removeItem(ACCESS_TOKEN_KEY);
      setAccessToken('');
      setContext(null);
      setError(e instanceof Error ? e.message : 'Не удалось загрузить контекст');
    } finally {
      setBusy(false);
    }
  }

  async function requestOtpCode() {
    setBusy(true);
    setError('');
    setOtpStatus('');
    try {
      const response = await requestPwaOtp(phone, otpChannel);
      setOtpRequestId(response.requestId);
      const debugTail = response.debugCode ? ` (тест-код: ${response.debugCode})` : '';
      setOtpStatus(`Код отправлен через ${response.channel}, получатель ${response.destinationMasked}${debugTail}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось запросить OTP код');
    } finally {
      setBusy(false);
    }
  }

  async function login() {
    setBusy(true);
    setError('');
    try {
      const auth = await loginPwa(phone, otpCode, otpRequestId || undefined);
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
      setParticipationEditOpen(false);
    }
  }

  async function loadNotificationsFeed() {
    if (!accessToken) {
      return;
    }

    setNotificationBusy(true);
    setError('');
    try {
      const feed = await getNotifications(accessToken, {
        sectionId: activeSectionId || undefined,
        childId: isCoachView ? undefined : activeChildId || undefined,
      });
      setNotificationFeed(feed);

      if (!isCoachView) {
        const serverReadIds = feed.items.filter((item) => item.isRead).map((item) => item.id);
        setReadNotificationIds(serverReadIds);
        persistReadNotifications(serverReadIds);
      } else {
        setReadNotificationIds([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить уведомления');
    } finally {
      setNotificationBusy(false);
    }
  }

  async function loadPayments() {
    if (!accessToken) {
      return;
    }

    setPaymentBusy(true);
    setError('');
    try {
      const data = await getPaymentOptions(accessToken, {
        sectionId: activeSectionId || undefined,
        childId: isCoachView ? undefined : activeChildId || undefined,
      });
      setPaymentOptions(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить оплаты');
    } finally {
      setPaymentBusy(false);
    }
  }

  async function handleParticipationDecision(decision: 'confirmed' | 'declined') {
    if (!attendanceBoard) {
      return;
    }

    const targetChildId = attendanceBoard.items.some((item) => item.childId === activeChildId)
      ? activeChildId
      : (attendanceBoard.items[0]?.childId ?? '');

    if (!targetChildId) {
      setError('В выбранной секции нет ребенка для подтверждения участия');
      return;
    }

    if (targetChildId !== activeChildId) {
      setActiveChildId(targetChildId);
      if (accessToken) {
        void setContextSelection(accessToken, {
          activeChildId: targetChildId,
          activeSectionId: activeSectionId || undefined,
        }).catch(() => {});
      }
    }

    setAttendanceBusy(true);
    setError('');
    setParticipationEditOpen(false);
    setAttendanceBoard((current) =>
      current
        ? {
            ...current,
            items: current.items.map((item) =>
              item.childId === targetChildId ? { ...item, participationStatus: decision } : item,
            ),
          }
        : current,
    );

    try {
      await confirmParticipation(accessToken, {
        sessionId: attendanceBoard.session.id,
        childId: targetChildId,
        decision,
      });
      const refreshedBoard = await getAttendanceBoard(accessToken, activeSectionId);
      setAttendanceBoard(refreshedBoard);
      await loadPayments();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось обновить участие');
    } finally {
      setAttendanceBusy(false);
      setParticipationEditOpen(false);
    }
  }

  function toggleNotificationChild(childId: string) {
    setNotificationChildIds((current) =>
      current.includes(childId) ? current.filter((value) => value !== childId) : [...current, childId],
    );
  }

  function persistReadNotifications(nextIds: string[]) {
    if (!context?.userId) {
      return;
    }

    window.localStorage.setItem(`${NOTIFICATION_READ_KEY_PREFIX}${context.userId}`, JSON.stringify(nextIds));
  }

  async function markNotificationAsRead(notificationId: string) {
    setReadNotificationIds((current) => {
      if (current.includes(notificationId)) {
        return current;
      }

      const next = [...current, notificationId];
      persistReadNotifications(next);
      return next;
    });

    try {
      await markNotificationRead(accessToken, notificationId);
    } catch {
      // UI remains responsive even if read-sync request fails.
    }
  }

  async function handleNotificationParticipation(notificationId: string, decision: 'confirmed' | 'declined') {
    setNotificationEditIds((current) => current.filter((id) => id !== notificationId));
    await handleParticipationDecision(decision);
    await markNotificationAsRead(notificationId);
    await loadNotificationsFeed();
  }

  function openNotificationEdit(notificationId: string) {
    setNotificationEditIds((current) => (current.includes(notificationId) ? current : [...current, notificationId]));
  }

  async function sendNotification() {
    if (!accessToken || !activeSectionId) {
      return;
    }

    setNotificationBusy(true);
    setError('');
    try {
      await createNotification(accessToken, {
        sectionId: activeSectionId,
        type: notificationType,
        title: notificationTitle.trim(),
        message: notificationMessage.trim(),
        targetMode: notificationTargetMode,
        childIds: notificationTargetMode === 'selected' ? notificationChildIds : undefined,
      });
      setNotificationTitle('');
      setNotificationMessage('');
      setNotificationChildIds([]);
      await loadNotificationsFeed();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось отправить уведомление');
    } finally {
      setNotificationBusy(false);
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
    window.localStorage.removeItem(ACTIVE_ROLE_KEY);
    setActiveChildId('');
    setActiveSectionId('');
    setAttendanceBoard(null);
    setReadNotificationIds([]);
    setParticipationEditOpen(false);
    setNotificationEditIds([]);
    setTab('home');
  }

  useEffect(() => {
    if (tab === 'attendance' || tab === 'schedule') {
      void loadAttendanceBoard();
    }

    if (tab === 'payments') {
      void loadPayments();
    }
  }, [tab, accessToken, activeSectionId, activeChildId, activeRole]);

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    void loadNotificationsFeed();
  }, [accessToken, activeSectionId, activeChildId, activeRole]);

  useEffect(() => {
    const roleIsCoach = activeRole === 'coach' || activeRole === 'section_admin' || activeRole === 'super_admin';
    if (roleIsCoach || tab !== 'schedule' || !notificationFeed?.items?.length) {
      return;
    }

    const unreadIds = notificationFeed.items
      .filter((item) => !readNotificationIds.includes(item.id))
      .map((item) => item.id);

    if (unreadIds.length === 0) {
      return;
    }

    const next = [...new Set([...readNotificationIds, ...unreadIds])];
    setReadNotificationIds(next);
    persistReadNotifications(next);

    void Promise.all(unreadIds.map((id) => markNotificationRead(accessToken, id).catch(() => undefined)));
  }, [activeRole, tab, notificationFeed, readNotificationIds, accessToken]);

  useEffect(() => {
    const roleIsCoach = activeRole === 'coach' || activeRole === 'section_admin' || activeRole === 'super_admin';
    if (roleIsCoach || !attendanceBoard?.items?.length) {
      return;
    }

    if (attendanceBoard.items.some((item) => item.childId === activeChildId)) {
      return;
    }

    const fallbackChildId = attendanceBoard.items[0].childId;
    setActiveChildId(fallbackChildId);

    if (!accessToken) {
      return;
    }

    void setContextSelection(accessToken, {
      activeChildId: fallbackChildId,
      activeSectionId: activeSectionId || undefined,
    }).catch(() => {});
  }, [activeRole, attendanceBoard, activeChildId, accessToken, activeSectionId]);

  const activeChild = context?.children.find((child) => child.id === activeChildId) ?? context?.children[0];
  const activeSection = context?.sections.find((section) => section.id === activeSectionId) ?? context?.sections[0];
  const isCoachView = activeRole === 'coach' || activeRole === 'section_admin' || activeRole === 'super_admin';
  const participationChildId = attendanceBoard?.items.some((item) => item.childId === activeChildId)
    ? activeChildId
    : (attendanceBoard?.items[0]?.childId ?? '');
  const activeParticipationStatus =
    attendanceBoard?.items.find((item) => item.childId === participationChildId)?.participationStatus ?? 'not_confirmed';
  const unreadNotificationCount = isCoachView
    ? 0
    : (typeof notificationFeed?.unreadCount === 'number'
      ? notificationFeed.unreadCount
      : (notificationFeed?.items.filter((item) => !readNotificationIds.includes(item.id)).length ?? 0));
  const confirmedCount = attendanceBoard?.items.filter((item) => item.participationStatus === 'confirmed').length ?? 0;
  const declinedCount = attendanceBoard?.items.filter((item) => item.participationStatus === 'declined').length ?? 0;
  const pendingChildren = attendanceBoard?.items.filter((item) => !item.participationStatus).map((item) => item.childName) ?? [];

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

  async function handleSectionChange(nextSectionId: string) {
    setActiveSectionId(nextSectionId);
    setParticipationEditOpen(false);
    setNotificationEditIds([]);

    if (!accessToken) {
      return;
    }

    try {
      await setContextSelection(accessToken, {
        activeChildId: isCoachView ? undefined : activeChildId || undefined,
        activeSectionId: nextSectionId || undefined,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить активную секцию');
    }
  }

  async function handleChildChange(nextChildId: string) {
    setActiveChildId(nextChildId);
    setParticipationEditOpen(false);
    setNotificationEditIds([]);

    if (!accessToken) {
      return;
    }

    try {
      await setContextSelection(accessToken, {
        activeChildId: nextChildId || undefined,
        activeSectionId: activeSectionId || undefined,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить активного ребенка');
    }
  }

  async function handleCreateParentShareLink() {
    if (!accessToken || !activeSectionId) {
      return;
    }

    let childIdForLink = isCoachView ? shareChildId : activeChildId;
    if (isCoachView && !childIdForLink) {
      const board = attendanceBoard ?? (await getAttendanceBoard(accessToken, activeSectionId));
      setAttendanceBoard(board);
      childIdForLink = board.items[0]?.childId ?? '';
      if (childIdForLink) {
        setShareChildId(childIdForLink);
      }
    }

    if (!childIdForLink) {
      setError('Выберите ребенка для ссылки второго родителя');
      return;
    }

    setShareBusy(true);
    setError('');
    try {
      const invite = await createInvite(accessToken, activeSectionId, {
        allowParentReshare: true,
        childId: childIdForLink,
      });
      setShareLinkUrl(invite.pwaInviteUrl);

      if (navigator.share) {
        await navigator.share({
          title: 'Ссылка для второго родителя',
          text: 'Откройте ссылку, чтобы добавить второго родителя к ребенку в секции',
          url: invite.pwaInviteUrl,
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось создать ссылку шэринга');
    } finally {
      setShareBusy(false);
    }
  }

  async function handleTelegramLinkRequest() {
    if (!accessToken) {
      return;
    }

    setLinkBusy(true);
    setError('');
    try {
      const result = await requestTelegramLink(accessToken);
      setTelegramLinkUrl(result.startUrl);
      window.open(result.startUrl, '_blank', 'noopener,noreferrer');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сформировать ссылку привязки Telegram');
    } finally {
      setLinkBusy(false);
    }
  }

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
            <select value={otpChannel} onChange={(e) => setOtpChannel(e.target.value as OtpChannel)}>
              <option value="sms">OTP по SMS</option>
              <option value="telegram">OTP в Telegram</option>
              <option value="vk">OTP во ВКонтакте</option>
            </select>
            <button disabled={busy} onClick={() => void requestOtpCode()}>
              {busy ? 'Отправляем код...' : 'Получить OTP код'}
            </button>
            <input value={otpCode} onChange={(e) => setOtpCode(e.target.value)} placeholder="Код" />
            <button disabled={busy} onClick={() => void login()}>
              {busy ? 'Входим...' : 'Продолжить'}
            </button>
            {otpStatus && <p className="caption">{otpStatus}</p>}
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

      <section className="hero-card fade-in-2">
        <p className="hero-card-kicker">Быстрый статус</p>
        <div className="hero-card-row">
          <strong>{isCoachView ? 'Группа под контролем' : 'Ребенок в фокусе'}</strong>
          <span>{isCoachView ? 'Online' : 'Активно'}</span>
        </div>
        <p className="hero-card-sub">
          {isCoachView
            ? `Секция: ${activeSection?.name ?? 'не выбрана'}`
            : `Секция: ${activeSection?.name ?? 'не выбрана'} · Статус: на занятии`}
        </p>
      </section>

      <section className="content-sheet fade-in-2">
        <div className={`context-grid compact-grid ${isCoachView ? 'coach-grid' : ''}`}>
          {!isCoachView && (
            <div className="stack">
              <p className="caption">Ребенок</p>
              <select value={activeChildId} onChange={(e) => void handleChildChange(e.target.value)}>
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
            <select value={activeSectionId} onChange={(e) => void handleSectionChange(e.target.value)}>
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
            {!attendanceBoard && <div className="list-card">{attendanceBusy ? 'Загружаем...' : 'Нет данных по расписанию'}</div>}
            {attendanceBoard && (
              <div className="list-card stack">
                <strong>{attendanceBoard.session.title}</strong>
                <p className="caption">Начало: {new Date(attendanceBoard.session.startsAt).toLocaleString('ru-RU')}</p>
                <p className="caption">Окончание: {new Date(attendanceBoard.session.endsAt).toLocaleString('ru-RU')}</p>
                {!isCoachView && activeChildId && (
                  <>
                    <p className="caption">
                      Участие: {attendanceBoard.items.find((item) => item.childId === participationChildId)?.participationStatus ?? 'не подтверждено'}
                    </p>
                    {activeParticipationStatus === 'not_confirmed' || participationEditOpen ? (
                      <div className="inline-actions">
                        <button disabled={attendanceBusy} onClick={() => void handleParticipationDecision('confirmed')}>
                          Участвуем
                        </button>
                        <button disabled={attendanceBusy} onClick={() => void handleParticipationDecision('declined')}>
                          Не участвуем
                        </button>
                      </div>
                    ) : (
                      <div className="inline-actions">
                        <p className="caption">Ответ отправлен: {activeParticipationStatus === 'confirmed' ? 'участвуем' : 'не участвуем'}</p>
                        <button type="button" disabled={attendanceBusy} onClick={() => setParticipationEditOpen(true)}>
                          Изменить ответ
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {isCoachView && attendanceBoard && (
              <div className="list-card stack">
                <h3>Отправить уведомление</h3>
                <select value={notificationType} onChange={(e) => setNotificationType(e.target.value as 'training' | 'game' | 'event')}>
                  <option value="training">Тренировка</option>
                  <option value="game">Игра</option>
                  <option value="event">Мероприятие</option>
                </select>
                <input value={notificationTitle} onChange={(e) => setNotificationTitle(e.target.value)} placeholder="Заголовок" />
                <textarea value={notificationMessage} onChange={(e) => setNotificationMessage(e.target.value)} placeholder="Текст уведомления" />
                <select value={notificationTargetMode} onChange={(e) => setNotificationTargetMode(e.target.value as 'all' | 'selected')}>
                  <option value="all">Всем детям секции</option>
                  <option value="selected">Только выбранным</option>
                </select>
                {notificationTargetMode === 'selected' && (
                  <div className="stack">
                    {attendanceBoard.items.map((item) => (
                      <label key={item.childId} className="caption">
                        <input
                          type="checkbox"
                          checked={notificationChildIds.includes(item.childId)}
                          onChange={() => toggleNotificationChild(item.childId)}
                        />{' '}
                        {item.childName}
                      </label>
                    ))}
                  </div>
                )}
                <button disabled={notificationBusy} onClick={() => void sendNotification()}>
                  {notificationBusy ? 'Отправляем...' : 'Отправить уведомление'}
                </button>
              </div>
            )}

            {isCoachView && attendanceBoard && (
              <div className="list-card stack">
                <h3>Предварительный отчет участия</h3>
                <p className="caption">Да: {confirmedCount} · Нет: {declinedCount} · Без ответа: {pendingChildren.length}</p>
                {pendingChildren.length > 0 && <p className="caption">Ожидаем ответ: {pendingChildren.join(', ')}</p>}
              </div>
            )}

            <h3>Лента уведомлений</h3>
            {!notificationFeed && <div className="list-card">{notificationBusy ? 'Загружаем...' : 'Пока уведомлений нет'}</div>}
            {notificationFeed?.items.map((item) => {
              const isRead = readNotificationIds.includes(item.id);
              const isEditingAnswer = notificationEditIds.includes(item.id);
              return (
                <div key={item.id} className="list-card stack">
                  <div className="headline-row">
                    <strong>{item.title}</strong>
                    <span className="status-pill">{item.type}</span>
                  </div>
                  <p>{item.message}</p>
                  {!isCoachView && activeChildId && item.type !== 'event' && (
                    <>
                      {activeParticipationStatus === 'not_confirmed' || isEditingAnswer ? (
                        <div className="inline-actions">
                          <button disabled={attendanceBusy} onClick={() => void handleNotificationParticipation(item.id, 'confirmed')}>
                            Участвуем
                          </button>
                          <button disabled={attendanceBusy} onClick={() => void handleNotificationParticipation(item.id, 'declined')}>
                            Не участвуем
                          </button>
                        </div>
                      ) : (
                        <div className="inline-actions">
                          <p className="caption">Ответ отправлен: {activeParticipationStatus === 'confirmed' ? 'участвуем' : 'не участвуем'}</p>
                          <button type="button" disabled={attendanceBusy} onClick={() => openNotificationEdit(item.id)}>
                            Изменить ответ
                          </button>
                        </div>
                      )}
                    </>
                  )}
                  <p className="caption">{!isCoachView ? (isRead ? 'Прочитано' : 'Новое') + ' · ' : ''}Каналы: {item.channels.join(', ')} · {new Date(item.createdAt).toLocaleString('ru-RU')} · {getDeliveryTick(item.delivery)}</p>
                </div>
              );
            })}
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
            {!paymentOptions && <div className="list-card">{paymentBusy ? 'Загружаем...' : 'Пока нет данных по оплате'}</div>}
            {paymentOptions && <p className="caption">{paymentOptions.rule.description}</p>}
            {paymentOptions?.items.map((item) => (
              <div key={`${item.childId}:${item.sectionId}`} className="list-card stack">
                <strong>{item.childName}</strong>
                <p className="caption">{item.sessionTitle}</p>
                <p className="caption">Срок: {new Date(item.dueAt).toLocaleString('ru-RU')}</p>
                <p className="caption">Участие: {item.participationStatus}</p>
                <p className="caption">Способ: {item.recommendedMethod}</p>
                {!item.canPayNow && <p className="caption">{item.lockedReason}</p>}
                {item.canPayNow && (
                  <button>{item.canPayEarly ? 'Оплатить заранее' : 'Оплатить'}</button>
                )}
              </div>
            ))}
          </>
        )}

        {tab === 'profile' && (
          <>
            <h2>Профиль</h2>
            <p className="caption">Активная роль: {ROLE_LABELS[activeRole]}</p>
            <div className="list-card stack">
              <p className="caption">Статус привязок</p>
              <p>{context.hasLinkedTelegram ? 'Telegram: привязан' : 'Telegram: не привязан'}</p>
              <p>{context.hasLinkedPhone ? 'Телефон: привязан' : 'Телефон: не привязан'}</p>
            </div>
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
            <p className="caption">Телефон: {phone}</p>
            <div className="list-card stack">
              <p className="caption">Шэринг ссылки</p>
              <p className="caption">Тренер и первый родитель могут отправить ссылку для добавления второго родителя.</p>
              {isCoachView && attendanceBoard && attendanceBoard.items.length > 0 && (
                <select value={shareChildId} onChange={(e) => setShareChildId(e.target.value)}>
                  <option value="">Выберите ребенка</option>
                  {attendanceBoard.items.map((item) => (
                    <option key={item.childId} value={item.childId}>
                      {item.childName}
                    </option>
                  ))}
                </select>
              )}
              <button type="button" disabled={shareBusy} onClick={() => void handleCreateParentShareLink()}>
                {shareBusy ? 'Готовим ссылку...' : 'Создать ссылку для второго родителя'}
              </button>
              {shareLinkUrl && (
                <a className="link-block" href={shareLinkUrl} target="_blank" rel="noreferrer">
                  Открыть/скопировать ссылку
                </a>
              )}
            </div>
            <button type="button" disabled={linkBusy} onClick={() => void handleTelegramLinkRequest()}>
              {linkBusy ? 'Готовим ссылку...' : context.hasLinkedTelegram ? 'Перепривязать Telegram' : 'Привязать Telegram'}
            </button>
            {telegramLinkUrl && (
              <a className="link-block" href={telegramLinkUrl} target="_blank" rel="noreferrer">
                Открыть бота для завершения привязки
              </a>
            )}
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
            <span className="tabbar-label">{item.label}</span>
            {item.id === 'schedule' && unreadNotificationCount > 0 && <span className="tabbar-badge">{unreadNotificationCount}</span>}
          </button>
        ))}
      </nav>

      {error && <p className="error">{error}</p>}
    </main>
  );
}
