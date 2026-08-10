import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAppStore } from '../state/store';
import { InstallHint } from './InstallHint';
import { NavIcon, type NavIconName } from './NavIcon';
import { UpdatePrompt } from './UpdatePrompt';

const exploreLinks = [
  { to: '/explore?view=cards', label: '料理・スタイルから探す', description: 'ご当地、定番、現代スタイルを味や麺から探します。' },
  { to: '/explore?view=map', label: '地図から探す', description: 'ご当地料理と世界の麺文化を地域から探します。' },
  { to: '/explore?view=scatter', label: '味覚マップから探す', description: '味の距離とバブルから料理を眺めます。' },
  { to: '/records?tab=places', label: '自分のお店・一杯', description: '気になる店や具体的なメニューを端末内で管理します。' }
];

const bottomNav: { to: string; label: string; icon: NavIconName; end?: boolean }[] = [
  { to: '/', label: 'ホーム', icon: 'home', end: true },
  { to: '/explore', label: '探す', icon: 'explore' },
  { to: '/diagnosis', label: '診断', icon: 'diagnosis' },
  { to: '/records', label: '記録', icon: 'records' }
];

export function AppLayout({ children }: { children: ReactNode }) {
  const compare = useAppStore((state) => state.compare);
  const clearCompare = useAppStore((state) => state.clearCompare);
  const settings = useAppStore((state) => state.settings);
  const setSettings = useAppStore((state) => state.setSettings);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [exploreOpen, setExploreOpen] = useState(false);
  const exploreRef = useRef<HTMLDivElement | null>(null);
  const exploreButtonRef = useRef<HTMLButtonElement | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const sheetOpenerRef = useRef<HTMLButtonElement | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  // The explore menu opens on click or keyboard only, never on hover.
  useEffect(() => {
    if (!exploreOpen) return undefined;
    const onPointerDown = (event: MouseEvent) => {
      if (!exploreRef.current?.contains(event.target as Node)) setExploreOpen(false);
    };
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setExploreOpen(false);
      exploreButtonRef.current?.focus();
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [exploreOpen]);

  // The more sheet behaves like a dialog: Escape closes it and focus goes back
  // to the button that opened it.
  useEffect(() => {
    if (!sheetOpen) return undefined;
    sheetRef.current?.querySelector<HTMLElement>('a, button')?.focus();
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setSheetOpen(false);
      sheetOpenerRef.current?.focus();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [sheetOpen]);

  useEffect(() => { setSheetOpen(false); }, [location.pathname, location.search]);

  useEffect(() => {
    document.documentElement.style.setProperty('--font-scale', String(settings.fontScale));
    document.documentElement.classList.toggle('high-contrast', settings.highContrast);
    document.documentElement.classList.toggle('reduce-motion', settings.reduceMotion);
  }, [settings]);

  const displaySettings = (
    <div className="display-settings">
      <label>
        文字サイズ
        <input type="range" min="0.9" max="1.25" step="0.05" value={settings.fontScale} onChange={(event: ChangeEvent<HTMLInputElement>) => setSettings({ fontScale: Number(event.target.value) })} />
      </label>
      <label className="check-row"><input type="checkbox" checked={settings.highContrast} onChange={(event: ChangeEvent<HTMLInputElement>) => setSettings({ highContrast: event.target.checked })} />高コントラスト</label>
      <label className="check-row"><input type="checkbox" checked={settings.reduceMotion} onChange={(event: ChangeEvent<HTMLInputElement>) => setSettings({ reduceMotion: event.target.checked })} />動きを減らす</label>
    </div>
  );

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="header-inner">
          <NavLink to="/" className="brand" aria-label="Noodle Voyage ホーム">
            <span className="brand-wordmark"><strong>NOODLE VOYAGE</strong><small>by EpsilonLab</small></span>
          </NavLink>
          <button type="button" className="menu-button" aria-expanded={menuOpen} aria-controls="site-navigation" onClick={() => setMenuOpen((open) => !open)}>
            メニュー
          </button>
          <nav id="site-navigation" className={menuOpen ? 'site-nav is-open' : 'site-nav'} aria-label="主要メニュー">
            <div className="explore-menu" ref={exploreRef}>
              <button
                type="button"
                ref={exploreButtonRef}
                className="explore-menu-trigger"
                aria-expanded={exploreOpen}
                aria-controls="explore-menu-list"
                aria-haspopup="menu"
                onClick={() => setExploreOpen((open) => !open)}
                onKeyDown={(event: KeyboardEvent<HTMLButtonElement>) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setExploreOpen((open) => !open);
                  }
                }}
              >
                探す
              </button>
              {exploreOpen ? (
                <ul id="explore-menu-list" className="explore-menu-list" role="menu" aria-label="探し方">
                  {exploreLinks.map((link) => (
                    <li key={link.to} role="none">
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => { setExploreOpen(false); setMenuOpen(false); navigate(link.to); }}
                      >
                        <strong>{link.label}</strong>
                        <span>{link.description}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <NavLink to="/diagnosis" onClick={() => setMenuOpen(false)} className={({ isActive }) => isActive ? 'is-active' : ''}>好み診断</NavLink>
            <NavLink to="/records" onClick={() => setMenuOpen(false)} className={({ isActive }) => isActive ? 'is-active' : ''}>マイ記録</NavLink>
            <NavLink to="/about" onClick={() => setMenuOpen(false)} className={({ isActive }) => isActive ? 'is-active' : ''}>ガイド</NavLink>
          </nav>
          <details className="accessibility-menu">
            <summary>表示</summary>
            <div className="accessibility-popover">
              {displaySettings}
              <Link className="text-link" to="/about#app">アプリとして使う</Link>
            </div>
          </details>
        </div>
      </header>

      <main id="main-content" tabIndex={-1}>{children}</main>

      {compare.length > 0 ? (
        <div className="compare-tray" role="region" aria-label="比較トレイ">
          <p>比較中 <strong>{compare.length}</strong> 件<span>最大3件</span></p>
          <div className="compare-tray-actions">
            <Link className="button button-primary" to="/compare">並べて比べる</Link>
            <button type="button" className="button button-ghost" onClick={clearCompare}>選択を解除</button>
          </div>
        </div>
      ) : null}

      <InstallHint />
      <UpdatePrompt />

      <nav className="bottom-nav" aria-label="下部メニュー">
        {bottomNav.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => isActive ? 'is-active' : ''}>
            <NavIcon name={item.icon} />
            <span>{item.label}</span>
          </NavLink>
        ))}
        <button
          type="button"
          ref={sheetOpenerRef}
          className={sheetOpen ? 'is-active' : ''}
          aria-expanded={sheetOpen}
          aria-controls="more-sheet"
          onClick={() => setSheetOpen((open) => !open)}
        >
          <NavIcon name="more" />
          <span>メニュー</span>
        </button>
      </nav>

      {sheetOpen ? (
        <>
          <div className="sheet-backdrop" onClick={() => { setSheetOpen(false); sheetOpenerRef.current?.focus(); }} />
          <div id="more-sheet" className="more-sheet" role="dialog" aria-labelledby="more-sheet-title" ref={sheetRef}>
            <h2 id="more-sheet-title">メニュー</h2>
            <Link to="/compare"><NavIcon name="compare" />比較{compare.length > 0 ? <span className="nav-count">{compare.length}</span> : null}</Link>
            <Link to="/about"><NavIcon name="guide" />ガイド</Link>
            <Link to="/about#app"><NavIcon name="app" />アプリとして使う</Link>
            <div className="more-sheet-settings">
              <h3><NavIcon name="display" />表示設定</h3>
              {displaySettings}
            </div>
            <button type="button" className="button button-secondary" onClick={() => { setSheetOpen(false); sheetOpenerRef.current?.focus(); }}>閉じる</button>
          </div>
        </>
      ) : null}

      <footer className="site-footer">
        <div>
          <strong>NOODLE VOYAGE by EpsilonLab</strong>
          <p>日本と世界の麺料理をめぐる、味覚の旅。</p>
        </div>
        <nav className="footer-links" aria-label="フッターメニュー">
          <NavLink to="/about">ガイド</NavLink>
          <NavLink to="/about#data">データについて</NavLink>
          <NavLink to="/about#app">アプリとして使う</NavLink>
          <a href="https://github.com/Epsilon-Lab-Atelier/noodle-voyage" target="_blank" rel="noopener noreferrer">GitHub</a>
        </nav>
        <p>原材料やアレルギー対応は店舗へ直接ご確認ください。</p>
        <p className="footer-credit">© 2026 EpsilonLab</p>
      </footer>
    </div>
  );
}
