import Link from 'next/link';

export default function HomePage() {
  return (
    <main>
      <div className="card stack">
        <span className="badge">VneClassno PWA</span>
        <h1>Управление занятиями</h1>
        <p className="caption">
          Открой ссылку инвайта вида <code>/invite/&lt;token&gt;</code>, чтобы добавить ребенка в секцию.
        </p>
        <Link href="/invite/demo-token">Пример страницы инвайта</Link>
      </div>
    </main>
  );
}
