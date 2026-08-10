export type NavIconName = 'home' | 'explore' | 'diagnosis' | 'records' | 'more' | 'compare' | 'guide' | 'display' | 'app';

const paths: Record<NavIconName, string> = {
  home: 'M4 11.2 12 4l8 7.2M6.5 9.8V20h11V9.8',
  explore: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14ZM16.2 16.2 21 21',
  diagnosis: 'M12 4v16M4 8h16M7 15h4M15 15h2',
  records: 'M6 4h9l3 3v13H6zM9 9h6M9 13h6M9 17h4',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  compare: 'M5 6h6v12H5zM13 6h6v12h-6zM11 12h2',
  guide: 'M5 5h9a3 3 0 0 1 3 3v11a3 3 0 0 0-3-3H5zM17 8h2v11h-5',
  display: 'M4 6h16v10H4zM9 20h6M12 16v4',
  app: 'M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2ZM11 18h2'
};

/** Icons mark actions only; every one of them sits next to its own label. */
export function NavIcon({ name }: { name: NavIconName }) {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
      <path d={paths[name]} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
