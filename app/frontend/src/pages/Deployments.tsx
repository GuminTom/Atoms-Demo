import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { client } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { ScrollArea } from '../components/ui/scroll-area';
import {
  Rocket,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  Globe,
  StopCircle,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Trash2,
  ExternalLink,
  Zap,
  ArrowLeft,
} from 'lucide-react';

interface Deployment {
  id: number;
  app_id: number;
  app_name?: string;
  status: string;
  url?: string;
  version?: string;
  environment?: string;
  logs?: string;
  created_at?: string;
  updated_at?: string;
}

interface AppItem {
  id: number;
  name: string;
  status?: string;
}

const statusConfig: Record<string, { icon: typeof Rocket; color: string; label: string }> = {
  pending: { icon: Clock, color: 'text-amber-400', label: 'Pending' },
  building: { icon: Loader2, color: 'text-cyan-400', label: 'Building' },
  deployed: { icon: CheckCircle2, color: 'text-emerald-400', label: 'Deployed' },
  failed: { icon: XCircle, color: 'text-rose-400', label: 'Failed' },
  stopped: { icon: StopCircle, color: 'text-muted-foreground', label: 'Stopped' },
};

const statusBg: Record<string, string> = {
  pending: 'bg-amber-500/15',
  building: 'bg-cyan-500/15',
  deployed: 'bg-emerald-500/15',
  failed: 'bg-rose-500/15',
  stopped: 'bg-muted/30',
};

export default function Deployments() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [apps, setApps] = useState<AppItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedDep, setExpandedDep] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [showDeployModal, setShowDeployModal] = useState(false);
  const [selectedApp, setSelectedApp] = useState<number | null>(null);

  useEffect(() => {
    if (user) {
      fetchDeployments();
      fetchApps();
    } else {
      setLoading(false);
    }
  }, [user]);

  const fetchDeployments = async () => {
    try {
      const res = await client.entities.deployments.query({
        sort: '-created_at',
        limit: 50,
      });
      setDeployments(res?.data?.items || []);
    } catch {
      setDeployments([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchApps = async () => {
    try {
      const res = await client.entities.apps.query({
        sort: '-updated_at',
        limit: 50,
      });
      setApps(res?.data?.items || []);
    } catch {
      setApps([]);
    }
  };

  const getAppName = useCallback(
    (appId: number) => {
      const app = apps.find((a) => a.id === appId);
      return app?.name || `App #${appId}`;
    },
    [apps]
  );

  const getNextVersion = (appId: number) => {
    const appDeps = deployments.filter((d) => d.app_id === appId);
    const maxVersion = appDeps.reduce((max, d) => {
      const v = parseInt(d.version?.replace('v', '') || '0', 10);
      return v > max ? v : max;
    }, 0);
    return `v${maxVersion + 1}`;
  };

  const handleDeploy = async () => {
    if (!selectedApp) return;
    setActionLoading(selectedApp);
    try {
      const app = apps.find((a) => a.id === selectedApp);
      const version = getNextVersion(selectedApp);
      const slug = app?.name.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'app';
      const url = `https://${slug}-${selectedApp}.vibecode.app`;

      await client.entities.deployments.create({
        data: {
          app_id: selectedApp,
          status: 'building',
          version,
          environment: 'production',
          url,
          logs: `Starting deployment ${version}...\nBuilding project...\n`,
        },
      });

      // Update app status
      await client.entities.apps.update({
        id: selectedApp,
        data: { status: 'published' },
      });

      setShowDeployModal(false);
      setSelectedApp(null);
      await fetchDeployments();
      await fetchApps();

      // Simulate build completion
      setTimeout(async () => {
        try {
          const depRes = await client.entities.deployments.query({
            sort: '-created_at',
            limit: 1,
          });
          const latestDep = depRes?.data?.items?.[0];
          if (latestDep && latestDep.status === 'building') {
            await client.entities.deployments.update({
              id: latestDep.id,
              data: {
                status: 'deployed',
                logs: `Starting deployment ${version}...\nBuilding project...\nBuild complete!\nDeploying to production...\n✓ Deployment successful! Live at ${url}`,
              },
            });
            await fetchDeployments();
          }
        } catch {
          // Handle error
        }
        setActionLoading(null);
      }, 4000);
    } catch {
      setActionLoading(null);
    }
  };

  const handleStop = async (dep: Deployment) => {
    setActionLoading(dep.id);
    try {
      await client.entities.deployments.update({
        id: dep.id,
        data: {
          status: 'stopped',
          logs: (dep.logs || '') + '\n⚠️ Deployment stopped by user.',
        },
      });
      await fetchDeployments();
    } catch {
      // Handle error
    } finally {
      setActionLoading(null);
    }
  };

  const handleRedeploy = async (dep: Deployment) => {
    setActionLoading(dep.id);
    try {
      const version = getNextVersion(dep.app_id);
      const app = apps.find((a) => a.id === dep.app_id);
      const slug = app?.name.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'app';
      const url = `https://${slug}-${dep.app_id}.vibecode.app`;

      await client.entities.deployments.create({
        data: {
          app_id: dep.app_id,
          status: 'building',
          version,
          environment: 'production',
          url,
          logs: `Redeploying from ${dep.version} → ${version}...\nBuilding project...\n`,
        },
      });

      await fetchDeployments();

      // Simulate build completion
      setTimeout(async () => {
        try {
          const depRes = await client.entities.deployments.query({
            sort: '-created_at',
            limit: 1,
          });
          const latestDep = depRes?.data?.items?.[0];
          if (latestDep && latestDep.status === 'building') {
            await client.entities.deployments.update({
              id: latestDep.id,
              data: {
                status: 'deployed',
                logs: `Redeploying from ${dep.version} → ${version}...\nBuilding project...\nBuild complete!\nDeploying to production...\n✓ Deployment successful! Live at ${url}`,
              },
            });
            await fetchDeployments();
          }
        } catch {
          // Handle error
        }
        setActionLoading(null);
      }, 4000);
    } catch {
      setActionLoading(null);
    }
  };

  const handleDelete = async (depId: number) => {
    setActionLoading(depId);
    try {
      await client.entities.deployments.delete({ id: depId });
      await fetchDeployments();
    } catch {
      // Handle error
    } finally {
      setActionLoading(null);
    }
  };

  const deployed = deployments.filter((d) => d.status === 'deployed').length;
  const building = deployments.filter((d) => d.status === 'building' || d.status === 'pending').length;
  const failed = deployments.filter((d) => d.status === 'failed').length;
  const stopped = deployments.filter((d) => d.status === 'stopped').length;

  // Apps that can be deployed (draft or have no active deployment)
  const deployableApps = apps.filter((app) => {
    const activeDep = deployments.find(
      (d) => d.app_id === app.id && (d.status === 'deployed' || d.status === 'building')
    );
    return !activeDep;
  });

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate('/')}
        className="mb-4 -ml-2 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        Back
      </Button>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Deployments</h1>
          <p className="text-muted-foreground text-sm mt-1">Monitor and manage your app deployments</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setShowDeployModal(true)}
            className="bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white font-medium rounded-xl"
            disabled={deployableApps.length === 0}
          >
            <Rocket className="w-4 h-4 mr-2" />
            New Deploy
          </Button>
          <Button
            onClick={() => { fetchDeployments(); fetchApps(); }}
            variant="outline"
            className="border-border text-foreground/80 hover:bg-muted"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Deploy Modal */}
      {showDeployModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <Card className="bg-card border-border w-full max-w-md mx-4 shadow-2xl">
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">Deploy App</h2>
              <p className="text-muted-foreground text-sm mb-4">Select an app to deploy to production</p>
              {deployableApps.length === 0 ? (
                <p className="text-muted-foreground text-sm py-4 text-center">No apps available for deployment</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto mb-4">
                  {deployableApps.map((app) => (
                    <button
                      key={app.id}
                      onClick={() => setSelectedApp(selectedApp === app.id ? null : app.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left ${
                        selectedApp === app.id
                          ? 'border-violet-500/50 bg-violet-500/10'
                          : 'border-border bg-muted/50 hover:border-border'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-muted/80 flex items-center justify-center text-sm">
                        📦
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">{app.name}</p>
                        <p className="text-xs text-muted-foreground">{app.status || 'draft'}</p>
                      </div>
                      {selectedApp === app.id && (
                        <CheckCircle2 className="w-4 h-4 text-violet-400" />
                      )}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowDeployModal(false);
                    setSelectedApp(null);
                  }}
                  className="border-border text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleDeploy}
                  disabled={!selectedApp || actionLoading !== null}
                  className="bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white"
                >
                  {actionLoading !== null ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Deploying...
                    </>
                  ) : (
                    <>
                      <Rocket className="w-4 h-4 mr-2" /> Deploy
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card className="bg-card border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{deployed}</p>
              <p className="text-xs text-muted-foreground">Live</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/15 flex items-center justify-center">
              <Loader2 className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{building}</p>
              <p className="text-xs text-muted-foreground">Building</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/15 flex items-center justify-center">
              <XCircle className="w-5 h-5 text-rose-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{failed}</p>
              <p className="text-xs text-muted-foreground">Failed</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-muted/30 flex items-center justify-center">
              <StopCircle className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stopped}</p>
              <p className="text-xs text-muted-foreground">Stopped</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Deployment List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="bg-card border-border animate-pulse">
              <CardContent className="p-4">
                <div className="h-4 bg-muted rounded w-1/3 mb-2" />
                <div className="h-3 bg-muted rounded w-1/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : deployments.length === 0 ? (
        <Card className="bg-card border-border border-dashed">
          <CardContent className="p-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <Rocket className="w-7 h-7 text-muted-foreground" />
            </div>
            <h3 className="text-foreground/80 font-medium mb-2">No deployments yet</h3>
            <p className="text-muted-foreground text-sm mb-4">Deploy your first app to see it here</p>
            <Button
              onClick={() => setShowDeployModal(true)}
              disabled={deployableApps.length === 0}
              className="bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white rounded-xl"
            >
              <Rocket className="w-4 h-4 mr-2" /> Deploy App
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="h-[calc(100vh-360px)]">
          <div className="space-y-3">
            {deployments.map((dep) => {
              const config = statusConfig[dep.status] || statusConfig.pending;
              const Icon = config.icon;
              const isExpanded = expandedDep === dep.id;
              const isActionLoading = actionLoading === dep.id;

              return (
                <Card key={dep.id} className="bg-card border-border hover:border-border transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-10 h-10 rounded-xl ${statusBg[dep.status] || 'bg-muted/30'} flex items-center justify-center`}
                        >
                          <Icon
                            className={`w-5 h-5 ${config.color} ${dep.status === 'building' ? 'animate-spin' : ''}`}
                          />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {getAppName(dep.app_id)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Deploy #{dep.id} · {dep.version || 'v1'} · {dep.environment || 'production'}
                            {dep.created_at && ` · ${new Date(dep.created_at).toLocaleString()}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="secondary"
                          className={`text-[10px] ${statusBg[dep.status] || 'bg-muted/30'} ${config.color}`}
                        >
                          {config.label}
                        </Badge>
                        {dep.status === 'deployed' && dep.url && (
                          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground h-7" asChild>
                            <a href={dep.url} target="_blank" rel="noopener noreferrer">
                              <Globe className="w-3.5 h-3.5 mr-1" />
                              Visit
                            </a>
                          </Button>
                        )}
                        {/* Action buttons */}
                        {dep.status === 'deployed' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-amber-400 hover:text-amber-300 h-7"
                            onClick={() => handleStop(dep)}
                            disabled={isActionLoading}
                          >
                            <StopCircle className="w-3.5 h-3.5 mr-1" />
                            Stop
                          </Button>
                        )}
                        {(dep.status === 'stopped' || dep.status === 'failed') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-cyan-400 hover:text-cyan-300 h-7"
                            onClick={() => handleRedeploy(dep)}
                            disabled={isActionLoading}
                          >
                            <RotateCcw className="w-3.5 h-3.5 mr-1" />
                            Redeploy
                          </Button>
                        )}
                        {dep.status === 'building' && (
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-gradient-to-r from-violet-500 to-cyan-500 rounded-full animate-pulse w-2/3" />
                            </div>
                            <span className="text-[10px] text-cyan-400">Building...</span>
                          </div>
                        )}
                        {/* Expand logs */}
                        <button
                          onClick={() => setExpandedDep(isExpanded ? null : dep.id)}
                          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground/80 transition-colors"
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </button>
                        {/* Delete */}
                        {(dep.status === 'stopped' || dep.status === 'failed') && (
                          <button
                            onClick={() => handleDelete(dep.id)}
                            disabled={isActionLoading}
                            className="p-1 rounded hover:bg-muted text-muted-foreground/70 hover:text-rose-400 transition-colors disabled:opacity-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Expanded logs */}
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-border">
                        {dep.url && (
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs text-muted-foreground">URL:</span>
                            <a
                              href={dep.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                            >
                              {dep.url}
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        )}
                        <div className="bg-background rounded-lg p-3 font-mono text-xs text-muted-foreground max-h-40 overflow-y-auto">
                          {dep.logs ? (
                            dep.logs.split('\n').map((line, i) => (
                              <div key={i} className="flex">
                                <span className="text-muted-foreground/70 w-6 shrink-0 select-none">{i + 1}</span>
                                <span
                                  className={
                                    line.startsWith('✓')
                                      ? 'text-emerald-400'
                                      : line.startsWith('⚠')
                                      ? 'text-amber-400'
                                      : line.startsWith('✗')
                                      ? 'text-rose-400'
                                      : ''
                                  }
                                >
                                  {line}
                                </span>
                              </div>
                            ))
                          ) : (
                            <span className="text-muted-foreground/70">No logs available</span>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}