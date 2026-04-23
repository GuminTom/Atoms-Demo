import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { client } from '../lib/api';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import {
  Plus,
  Code2,
  Rocket,
  BarChart3,
  Clock,
  ArrowRight,
  Zap,
  Users,
  Bot,
  MoreVertical,
  Pencil,
  Trash2,
  X,
  Check,
  Search,
  ArrowUpDown,
  RocketIcon,
  Archive,
  RotateCcw,
  LayoutGrid,
  List,
  Eye,
} from 'lucide-react';

interface AppItem {
  id: number;
  name: string;
  description?: string;
  status?: string;
  agent_mode?: string;
  thumbnail?: string;
  created_at?: string;
  updated_at?: string;
}

type SortMode = 'updated' | 'name' | 'created';
type ViewMode = 'grid' | 'list';

const DEMO_APPS: AppItem[] = [
  {
    id: 1,
    name: 'E-Commerce Store',
    description: 'Full-stack online store with product catalog, cart, and checkout flow',
    status: 'published',
    agent_mode: 'team',
    created_at: '2026-04-18T10:30:00Z',
    updated_at: '2026-04-20T14:22:00Z',
  },
  {
    id: 2,
    name: 'Task Manager',
    description: 'Kanban-style project management tool with drag-and-drop boards',
    status: 'draft',
    agent_mode: 'engineer',
    created_at: '2026-04-19T08:15:00Z',
    updated_at: '2026-04-21T09:10:00Z',
  },
  {
    id: 3,
    name: 'Portfolio Site',
    description: 'Personal portfolio with blog, project showcase, and contact form',
    status: 'published',
    agent_mode: 'engineer',
    created_at: '2026-04-15T16:00:00Z',
    updated_at: '2026-04-19T11:45:00Z',
  },
  {
    id: 4,
    name: 'AI Chat App',
    description: 'Real-time chat application powered by multi-agent AI system',
    status: 'draft',
    agent_mode: 'team',
    created_at: '2026-04-20T12:00:00Z',
    updated_at: '2026-04-21T08:30:00Z',
  },
  {
    id: 5,
    name: 'Analytics Dashboard',
    description: 'Data visualization dashboard with charts and real-time metrics',
    status: 'archived',
    agent_mode: 'team',
    created_at: '2026-04-10T09:00:00Z',
    updated_at: '2026-04-17T15:20:00Z',
  },
  {
    id: 6,
    name: 'Blog Platform',
    description: 'Markdown-based blogging platform with SEO optimization',
    status: 'draft',
    agent_mode: 'engineer',
    created_at: '2026-04-21T07:00:00Z',
    updated_at: '2026-04-21T10:00:00Z',
  },
];

export default function Dashboard() {
  const { user, loading: authLoading, login } = useAuth();
  const navigate = useNavigate();
  const [apps, setApps] = useState<AppItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState<number | null>(null);
  const [editingApp, setEditingApp] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortMode, setSortMode] = useState<SortMode>('updated');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [deployingApp, setDeployingApp] = useState<number | null>(null);
  const [demoMode, setDemoMode] = useState(false);

  const isDemo = demoMode || !user;

  useEffect(() => {
    if (user) {
      fetchApps();
    } else if (demoMode) {
      setApps(DEMO_APPS);
      setLoading(false);
    } else {
      setLoading(false);
    }
  }, [user, demoMode]);

  const fetchApps = async () => {
    try {
      const res = await client.entities.apps.query({
        sort: '-updated_at',
        limit: 50,
      });
      setApps(res?.data?.items || []);
    } catch {
      setApps([]);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (app: AppItem) => {
    setEditingApp(app.id);
    setEditName(app.name);
    setEditDesc(app.description || '');
    setMenuOpen(null);
  };

  const handleSaveEdit = async (appId: number) => {
    if (isDemo) {
      setApps((prev) =>
        prev.map((a) => (a.id === appId ? { ...a, name: editName, description: editDesc } : a))
      );
      setEditingApp(null);
      return;
    }
    try {
      await client.entities.apps.update({
        id: appId,
        data: { name: editName, description: editDesc },
      });
      setEditingApp(null);
      await fetchApps();
    } catch {
      // Handle error
    }
  };

  const handleDelete = async (appId: number) => {
    if (isDemo) {
      setApps((prev) => prev.filter((a) => a.id !== appId));
      setDeleteConfirm(null);
      setMenuOpen(null);
      return;
    }
    try {
      await client.entities.apps.delete({ id: appId });
      setDeleteConfirm(null);
      setMenuOpen(null);
      await fetchApps();
    } catch {
      // Handle error
    }
  };

  const handleStatusChange = async (appId: number, newStatus: string) => {
    if (isDemo) {
      setApps((prev) =>
        prev.map((a) => (a.id === appId ? { ...a, status: newStatus } : a))
      );
      setMenuOpen(null);
      return;
    }
    try {
      await client.entities.apps.update({
        id: appId,
        data: { status: newStatus },
      });
      setMenuOpen(null);
      await fetchApps();
    } catch {
      // Handle error
    }
  };

  const handleDeploy = async (app: AppItem) => {
    if (isDemo) {
      setDeployingApp(app.id);
      setMenuOpen(null);
      setTimeout(() => {
        setApps((prev) =>
          prev.map((a) => (a.id === app.id ? { ...a, status: 'published' } : a))
        );
        setDeployingApp(null);
      }, 3000);
      return;
    }
    setDeployingApp(app.id);
    setMenuOpen(null);
    try {
      await client.entities.deployments.create({
        data: {
          app_id: app.id,
          status: 'building',
          version: 'v1',
          environment: 'production',
          url: `https://${app.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${app.id}.vibecode.app`,
        },
      });
      await client.entities.apps.update({
        id: app.id,
        data: { status: 'published' },
      });
      setTimeout(async () => {
        try {
          const depRes = await client.entities.deployments.query({
            query: JSON.stringify({ app_id: app.id }),
            sort: '-created_at',
            limit: 1,
          });
          const latestDep = depRes?.data?.items?.[0];
          if (latestDep) {
            await client.entities.deployments.update({
              id: latestDep.id,
              data: { status: 'deployed' },
            });
          }
          await fetchApps();
        } catch {
          // Handle error
        } finally {
          setDeployingApp(null);
        }
      }, 3000);
    } catch {
      setDeployingApp(null);
    }
  };

  // Filter and sort apps
  const filteredApps = useMemo(() => {
    let result = [...apps];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (app) =>
          app.name.toLowerCase().includes(q) ||
          (app.description && app.description.toLowerCase().includes(q))
      );
    }

    if (statusFilter !== 'all') {
      result = result.filter((app) => (app.status || 'draft') === statusFilter);
    }

    result.sort((a, b) => {
      switch (sortMode) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'created':
          return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
        case 'updated':
        default:
          return new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime();
      }
    });

    return result;
  }, [apps, searchQuery, statusFilter, sortMode]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center animate-pulse">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <p className="text-muted-foreground text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user && !demoMode) {
    return (
      <div className="flex items-center justify-center h-screen bg-background relative overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet-500/30 rounded-full blur-[128px]" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/20 rounded-full blur-[128px]" />
        </div>
        <div className="relative z-10 text-center max-w-lg px-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center mx-auto mb-6">
            <Zap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold mb-3 bg-gradient-to-r from-violet-400 via-cyan-400 to-violet-400 bg-clip-text text-transparent">
            VibeCode
          </h1>
          <p className="text-muted-foreground text-lg mb-8 leading-relaxed">
            Multi-agent AI coding platform. Build, deploy, and ship applications with intelligent agents.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              onClick={login}
              size="lg"
              className="bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white font-semibold px-8 h-12 rounded-xl shadow-lg shadow-violet-500/25"
            >
              Get Started
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button
              onClick={() => setDemoMode(true)}
              size="lg"
              variant="outline"
              className="border-border text-foreground/80 hover:bg-muted px-8 h-12 rounded-xl"
            >
              <Eye className="w-4 h-4 mr-2" />
              Preview Demo
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const statusColor: Record<string, string> = {
    draft: 'bg-muted/30 text-muted-foreground',
    published: 'bg-emerald-500/20 text-emerald-400',
    archived: 'bg-amber-500/20 text-amber-400',
  };

  const getNextStatus = (currentStatus: string): { status: string; label: string; icon: typeof Rocket }[] => {
    switch (currentStatus) {
      case 'draft':
        return [{ status: 'published', label: 'Publish', icon: Rocket }];
      case 'published':
        return [{ status: 'archived', label: 'Archive', icon: Archive }];
      case 'archived':
        return [{ status: 'draft', label: 'Reactivate', icon: RotateCcw }];
      default:
        return [{ status: 'published', label: 'Publish', icon: Rocket }];
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Demo Banner */}
      {isDemo && !user && (
        <div className="mb-4 flex items-center justify-between bg-violet-500/10 border border-violet-500/20 rounded-xl px-4 py-2.5">
          <span className="text-xs text-violet-300 flex items-center gap-2">
            <Eye className="w-3.5 h-3.5" />
            Demo Mode — Sign in to save your work
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={login}
            className="text-violet-300 hover:text-violet-100 hover:bg-violet-500/20 text-xs h-7"
          >
            Sign In
          </Button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Welcome back, {user?.name || 'Developer'}
          </p>
        </div>
        <Button
          onClick={() => navigate('/workspace')}
          className="bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white font-medium rounded-xl shadow-lg shadow-violet-500/20"
        >
          <Plus className="w-4 h-4 mr-2" />
          New App
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card className="bg-card border-border hover:border-border transition-colors">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Total Apps</p>
                <p className="text-2xl font-bold text-foreground mt-1">{apps.length}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-violet-500/15 flex items-center justify-center">
                <Code2 className="w-5 h-5 text-violet-400" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border hover:border-border transition-colors">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Deployed</p>
                <p className="text-2xl font-bold text-foreground mt-1">
                  {apps.filter((a) => a.status === 'published').length}
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center">
                <Rocket className="w-5 h-5 text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border hover:border-border transition-colors">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Drafts</p>
                <p className="text-2xl font-bold text-foreground mt-1">
                  {apps.filter((a) => !a.status || a.status === 'draft').length}
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-muted/30 flex items-center justify-center">
                <Pencil className="w-5 h-5 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search, Filter & Sort Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search apps..."
            className="pl-9 bg-card border-border text-foreground placeholder:text-muted-foreground/70 h-9"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Status Filter */}
          <div className="flex items-center gap-0.5 bg-card border border-border rounded-lg p-0.5">
            {['all', 'draft', 'published', 'archived'].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                  statusFilter === s
                    ? 'bg-muted/80 text-foreground'
                    : 'text-muted-foreground hover:text-foreground/80'
                }`}
              >
                {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>

          {/* Sort Toggle */}
          <button
            onClick={() => {
              const modes: SortMode[] = ['updated', 'name', 'created'];
              const next = modes[(modes.indexOf(sortMode) + 1) % modes.length];
              setSortMode(next);
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-card border border-border rounded-lg text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowUpDown className="w-3 h-3" />
            {sortMode === 'updated' ? 'Updated' : sortMode === 'name' ? 'Name' : 'Created'}
          </button>

          {/* View Toggle */}
          <div className="flex items-center gap-0.5 bg-card border border-border rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === 'grid' ? 'bg-muted/80 text-foreground' : 'text-muted-foreground hover:text-foreground/80'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === 'list' ? 'bg-muted/80 text-foreground' : 'text-muted-foreground hover:text-foreground/80'
              }`}
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Apps */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">
            Apps
            {filteredApps.length !== apps.length && (
              <span className="text-muted-foreground text-sm font-normal ml-2">
                {filteredApps.length} of {apps.length}
              </span>
            )}
          </h2>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="bg-card border-border animate-pulse">
                <CardContent className="p-5">
                  <div className="h-4 bg-muted rounded w-2/3 mb-3" />
                  <div className="h-3 bg-muted rounded w-full mb-2" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredApps.length === 0 ? (
          <Card className="bg-card border-border border-dashed">
            <CardContent className="p-12 text-center">
              <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                <Code2 className="w-7 h-7 text-muted-foreground" />
              </div>
              <h3 className="text-foreground/80 font-medium mb-2">
                {searchQuery || statusFilter !== 'all' ? 'No matching apps' : 'No apps yet'}
              </h3>
              <p className="text-muted-foreground text-sm mb-4">
                {searchQuery || statusFilter !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'Create your first app to get started'}
              </p>
              {!searchQuery && statusFilter === 'all' && (
                <Button
                  onClick={() => navigate('/workspace')}
                  className="bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white rounded-xl"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create App
                </Button>
              )}
            </CardContent>
          </Card>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredApps.map((app) => (
              <Card
                key={app.id}
                className="bg-card border-border hover:border-border transition-all duration-200 cursor-pointer group relative"
                onClick={() => {
                  if (editingApp !== app.id && deleteConfirm !== app.id) {
                    navigate(`/workspace/${app.id}`);
                  }
                }}
              >
                <CardContent className="p-5">
                  {editingApp === app.id ? (
                    <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="bg-muted border-border text-foreground text-sm"
                        placeholder="App name"
                        autoFocus
                      />
                      <Input
                        value={editDesc}
                        onChange={(e) => setEditDesc(e.target.value)}
                        className="bg-muted border-border text-foreground text-sm"
                        placeholder="Description"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleSaveEdit(app.id)}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs rounded-lg"
                        >
                          <Check className="w-3 h-3 mr-1" /> Save
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingApp(null)}
                          className="border-border text-muted-foreground hover:text-foreground text-xs rounded-lg"
                        >
                          <X className="w-3 h-3 mr-1" /> Cancel
                        </Button>
                      </div>
                    </div>
                  ) : deleteConfirm === app.id ? (
                    <div onClick={(e) => e.stopPropagation()}>
                      <p className="text-sm text-rose-400 font-medium mb-3">Delete &quot;{app.name}&quot;?</p>
                      <p className="text-xs text-muted-foreground mb-3">This action cannot be undone.</p>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleDelete(app.id)}
                          className="bg-rose-600 hover:bg-rose-500 text-white text-xs rounded-lg"
                        >
                          <Trash2 className="w-3 h-3 mr-1" /> Delete
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setDeleteConfirm(null);
                            setMenuOpen(null);
                          }}
                          className="border-border text-muted-foreground hover:text-foreground text-xs rounded-lg"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">📦</span>
                          <h3 className="font-semibold text-foreground group-hover:text-violet-300 transition-colors">
                            {app.name}
                          </h3>
                        </div>
                        <div className="flex items-center gap-1">
                          <Badge
                            variant="secondary"
                            className={`text-[10px] ${statusColor[app.status || 'draft']}`}
                          >
                            {app.status || 'draft'}
                          </Badge>
                          <div className="relative">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setMenuOpen(menuOpen === app.id ? null : app.id);
                              }}
                              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground/80 opacity-0 group-hover:opacity-100 transition-all"
                            >
                              <MoreVertical className="w-3.5 h-3.5" />
                            </button>
                            {menuOpen === app.id && (
                              <div
                                className="absolute right-0 top-8 z-20 bg-muted border border-border rounded-lg shadow-xl py-1 min-w-[140px]"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  onClick={() => handleEdit(app)}
                                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-foreground/80 hover:bg-muted/80 transition-colors"
                                >
                                  <Pencil className="w-3 h-3" /> Edit Details
                                </button>
                                {getNextStatus(app.status || 'draft').map((action) => (
                                  <button
                                    key={action.status}
                                    onClick={() => handleStatusChange(app.id, action.status)}
                                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-foreground/80 hover:bg-muted/80 transition-colors"
                                  >
                                    <action.icon className="w-3 h-3" /> {action.label}
                                  </button>
                                ))}
                                {(app.status === 'draft' || !app.status) && (
                                  <button
                                    onClick={() => handleDeploy(app)}
                                    disabled={deployingApp === app.id}
                                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-emerald-400 hover:bg-muted/80 transition-colors disabled:opacity-50"
                                  >
                                    <RocketIcon className="w-3 h-3" />
                                    {deployingApp === app.id ? 'Deploying...' : 'Quick Deploy'}
                                  </button>
                                )}
                                <div className="border-t border-border my-1" />
                                <button
                                  onClick={() => {
                                    setDeleteConfirm(app.id);
                                    setMenuOpen(null);
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-rose-400 hover:bg-muted/80 transition-colors"
                                >
                                  <Trash2 className="w-3 h-3" /> Delete
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <p className="text-muted-foreground text-sm line-clamp-2 mb-3">
                        {app.description || 'No description'}
                      </p>
                      <div className="flex items-center justify-between text-xs text-muted-foreground/70">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {app.updated_at ? new Date(app.updated_at).toLocaleDateString() : 'Just now'}
                        </span>
                        <span className="flex items-center gap-1">
                          {app.agent_mode === 'team' ? (
                            <>
                              <Users className="w-3 h-3" /> Team
                            </>
                          ) : (
                            <>
                              <Bot className="w-3 h-3" /> Engineer
                            </>
                          )}
                        </span>
                      </div>
                      {deployingApp === app.id && (
                        <div className="mt-3 flex items-center gap-2">
                          <div className="h-1 flex-1 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-violet-500 to-cyan-500 rounded-full animate-pulse w-2/3" />
                          </div>
                          <span className="text-[10px] text-cyan-400">Deploying...</span>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredApps.map((app) => (
              <Card
                key={app.id}
                className="bg-card border-border hover:border-border transition-all duration-200 cursor-pointer group"
                onClick={() => {
                  if (editingApp !== app.id && deleteConfirm !== app.id) {
                    navigate(`/workspace/${app.id}`);
                  }
                }}
              >
                <CardContent className="p-4 flex items-center justify-between">
                  {editingApp === app.id ? (
                    <div className="flex items-center gap-3 flex-1" onClick={(e) => e.stopPropagation()}>
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="bg-muted border-border text-foreground text-sm max-w-[200px]"
                        placeholder="App name"
                        autoFocus
                      />
                      <Input
                        value={editDesc}
                        onChange={(e) => setEditDesc(e.target.value)}
                        className="bg-muted border-border text-foreground text-sm flex-1"
                        placeholder="Description"
                      />
                      <Button
                        size="sm"
                        onClick={() => handleSaveEdit(app.id)}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs rounded-lg shrink-0"
                      >
                        <Check className="w-3 h-3 mr-1" /> Save
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingApp(null)}
                        className="border-border text-muted-foreground hover:text-foreground text-xs rounded-lg shrink-0"
                      >
                        <X className="w-3 h-3 mr-1" /> Cancel
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-4">
                        <span className="text-lg">📦</span>
                        <div>
                          <p className="text-sm font-semibold text-foreground group-hover:text-violet-300 transition-colors">
                            {app.name}
                          </p>
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {app.description || 'No description'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                        <Badge
                          variant="secondary"
                          className={`text-[10px] ${statusColor[app.status || 'draft']}`}
                        >
                          {app.status || 'draft'}
                        </Badge>
                        <span className="text-xs text-muted-foreground/70 flex items-center gap-1">
                          {app.agent_mode === 'team' ? (
                            <>
                              <Users className="w-3 h-3" /> Team
                            </>
                          ) : (
                            <>
                              <Bot className="w-3 h-3" /> Engineer
                            </>
                          )}
                        </span>
                        <span className="text-xs text-muted-foreground/70 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {app.updated_at ? new Date(app.updated_at).toLocaleDateString() : 'Just now'}
                        </span>
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuOpen(menuOpen === app.id ? null : app.id);
                            }}
                            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground/80 opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <MoreVertical className="w-3.5 h-3.5" />
                          </button>
                          {menuOpen === app.id && (
                            <div className="absolute right-0 top-8 z-20 bg-muted border border-border rounded-lg shadow-xl py-1 min-w-[140px]">
                              <button
                                onClick={() => handleEdit(app)}
                                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-foreground/80 hover:bg-muted/80 transition-colors"
                              >
                                <Pencil className="w-3 h-3" /> Edit Details
                              </button>
                              {getNextStatus(app.status || 'draft').map((action) => (
                                <button
                                  key={action.status}
                                  onClick={() => handleStatusChange(app.id, action.status)}
                                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-foreground/80 hover:bg-muted/80 transition-colors"
                                >
                                  <action.icon className="w-3 h-3" /> {action.label}
                                </button>
                              ))}
                              {(app.status === 'draft' || !app.status) && (
                                <button
                                  onClick={() => handleDeploy(app)}
                                  disabled={deployingApp === app.id}
                                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-emerald-400 hover:bg-muted/80 transition-colors disabled:opacity-50"
                                >
                                  <RocketIcon className="w-3 h-3" />
                                  {deployingApp === app.id ? 'Deploying...' : 'Quick Deploy'}
                                </button>
                              )}
                              <div className="border-t border-border my-1" />
                              <button
                                onClick={() => {
                                  setDeleteConfirm(app.id);
                                  setMenuOpen(null);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-rose-400 hover:bg-muted/80 transition-colors"
                              >
                                <Trash2 className="w-3 h-3" /> Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Click-away handler for menu */}
      {menuOpen !== null && (
        <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(null)} />
      )}
    </div>
  );
}