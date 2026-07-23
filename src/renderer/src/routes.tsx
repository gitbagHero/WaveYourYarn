import type { RouteObject } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { DashboardPage } from './pages/DashboardPage'
import { LoginPage } from './pages/LoginPage'
import { LikedSongsPage } from './pages/LikedSongsPage'
import { ExportPage } from './pages/ExportPage'
import { SettingsPage } from './pages/SettingsPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { PlaylistsPage } from './pages/PlaylistsPage'
import { PlaylistDetailPage } from './pages/PlaylistDetailPage'
import { StatisticsPage } from './pages/StatisticsPage'
import { AIReportsPage } from './pages/AIReportsPage'

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'liked-songs', element: <LikedSongsPage /> },
      { path: 'playlists', element: <PlaylistsPage /> },
      { path: 'playlists/:id', element: <PlaylistDetailPage /> },
      { path: 'export', element: <ExportPage /> },
      { path: 'statistics', element: <StatisticsPage /> },
      { path: 'ai-reports', element: <AIReportsPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: '*', element: <NotFoundPage /> }
    ]
  }
]
