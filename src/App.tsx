import { Suspense, lazy, useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { LoadingState } from './components/LoadingState';
import { hydrateAppStore } from './state/store';

const HomePage = lazy(() => import('./pages/HomePage'));
const DiagnosisPage = lazy(() => import('./pages/DiagnosisPage'));
const ExplorePage = lazy(() => import('./pages/ExplorePage'));
const DishPage = lazy(() => import('./pages/DishPage'));
const ComparePage = lazy(() => import('./pages/ComparePage'));
const RecordsPage = lazy(() => import('./pages/RecordsPage'));
const PlaceFormPage = lazy(() => import('./pages/PlaceFormPage'));
const PlaceDetailPage = lazy(() => import('./pages/PlaceDetailPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

function ScrollManager() {
  const location = useLocation();
  useEffect(() => {
    document.title = 'Noodle Voyage 2026';
    // A link such as /about#app should land on that section, not the top.
    const target = location.hash ? document.getElementById(location.hash.slice(1)) : null;
    if (target) {
      target.scrollIntoView({ block: 'start', behavior: 'auto' });
      return;
    }
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [location.pathname, location.hash]);
  return null;
}

export default function App() {
  useEffect(() => { void hydrateAppStore(); }, []);
  return (
    <HashRouter>
      <ScrollManager />
      <AppLayout>
        <Suspense fallback={<LoadingState />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/diagnosis" element={<DiagnosisPage />} />
            <Route path="/explore" element={<ExplorePage />} />
            <Route path="/dish/:dishId" element={<DishPage />} />
            <Route path="/compare" element={<ComparePage />} />
            <Route path="/records" element={<RecordsPage />} />
            <Route path="/places/new" element={<PlaceFormPage />} />
            <Route path="/places/:placeId" element={<PlaceDetailPage />} />
            {/* Older entry points kept working; /records is the one canonical screen. */}
            <Route path="/my" element={<Navigate to="/records?tab=wishlist" replace />} />
            <Route path="/collection" element={<Navigate to="/records?tab=wishlist" replace />} />
            <Route path="/my-places" element={<Navigate to="/records?tab=places" replace />} />
            <Route path="/my-places/new" element={<Navigate to="/places/new" replace />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </AppLayout>
    </HashRouter>
  );
}
