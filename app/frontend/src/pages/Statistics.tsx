import { useEffect, useState } from 'react';
import { client } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import {
  Code2,
  Rocket,
  Users,
  Bot,
  TrendingUp,
  Activity,
  Zap,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
} from 'lucide-react';

interface AppItem {
  id: number;
  name: string;
  status?: string;
  agent_mode?: string;
  created_at?: string;
  updated_at?: string;
}

interface Deployment {
  id: number;
  app_id: number;
  app_name?: string;
  status: 'pending' | 'building' | 'deployed' | 'failed';
  created_at?: string;
}

export default function Statistics() {
  const { user } = useAuth();
  const [apps, setApps] = useState<AppItem[]>([]);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchData();
    else setLoading(false);
  }, [user]);

  const fetchData = async () => {
    try {
      const [appsRes, depRes] = await Promise.all([
        client.entities.apps.query({ limit: 100 }),
        client.entities.deployments.query({ limit: 100, sort: '-created_at' }),
      ]);
      setApps(appsRes?.data?.items || []);
      setDeployments(depRes?.data?.items || []);
    } catch {
      // Handle error
    } finally {
      setLoading(false);
    }
  };

  // Compute real stats
  const totalApps = apps.length;
  const totalDeploys = deployments.length;
  const deployedCount = deployments.filter(d => d.status === 'deployed').length;
  const failedCount = deployments.filter(d => d.status === 'failed').length;
  const engineerModeApps = apps.filter(a => a.agent_mode === 'engineer' || !a.agent_mode).length;
  const teamModeApps = apps.filter(a => a.agent_mode === 'team').length;
  const draftApps = apps.filter(a => a.status === 'draft' || !a.status).length;
  const publishedApps = apps.filter(a => a.status === 'published').length;
  const successRate = totalDeploys > 0 ? Math.round((deployedCount / totalDeploys) * 100) : 0;

  // Compute weekly activity from real data
  const now = new Date();
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const weeklyApps = Array(7).fill(0);
  const weeklyDeploys = Array(7).fill(0);

  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dayStr = d.toISOString().split('T')[0];
    const dayIdx = 6 - i;

    apps.forEach(app => {
      if (app.created_at && app.created_at.startsWith(dayStr)) weeklyApps[dayIdx]++;
    });
    deployments.forEach(dep => {
      if (dep.created_at && dep.created_at.startsWith(dayStr)) weeklyDeploys[dayIdx]++;
    });
  }

  const maxActivity = Math.max(...weeklyApps, ...weeklyDeploys, 1);

  // Recent deployments for activity feed
  const recentDeploys = deployments.slice(0, 5);

  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-zinc-50">Statistics</h1>
          <p className="text-zinc-400 text-sm mt-1">Track your development activity and usage</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="bg-zinc-900 border-zinc-800 animate-pulse">
              <CardContent className="p-4">
                <div className="h-4 bg-zinc-800 rounded w-1/2 mb-2" />
                <div className="h-6 bg-zinc-800 rounded w-1/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-50">Statistics</h1>
        <p className="text-zinc-400 text-sm mt-1">Track your development activity and usage</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Code2 className="w-4 h-4 text-violet-400" />
              <span className="text-xs text-zinc-500 uppercase tracking-wider">Apps</span>
            </div>
            <p className="text-2xl font-bold text-zinc-50">{totalApps}</p>
            <p className="text-[10px] text-zinc-600 mt-1">{draftApps} draft · {publishedApps} published</p>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Rocket className="w-4 h-4 text-emerald-400" />
              <span className="text-xs text-zinc-500 uppercase tracking-wider">Deploys</span>
            </div>
            <p className="text-2xl font-bold text-zinc-50">{totalDeploys}</p>
            <p className="text-[10px] text-zinc-600 mt-1">{deployedCount} live · {failedCount} failed</p>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Bot className="w-4 h-4 text-cyan-400" />
              <span className="text-xs text-zinc-500 uppercase tracking-wider">Engineer</span>
            </div>
            <p className="text-2xl font-bold text-zinc-50">{engineerModeApps}</p>
            <p className="text-[10px] text-zinc-600 mt-1">single-agent apps</p>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-amber-400" />
              <span className="text-xs text-zinc-500 uppercase tracking-wider">Team</span>
            </div>
            <p className="text-2xl font-bold text-zinc-50">{teamModeApps}</p>
            <p className="text-[10px] text-zinc-600 mt-1">multi-agent apps</p>
          </CardContent>
        </Card>
      </div>

      {/* Weekly Activity Chart */}
      <Card className="bg-zinc-900 border-zinc-800 mb-8">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
            <Activity className="w-4 h-4 text-violet-400" />
            Weekly Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-3 h-40 pt-4">
            {weeklyApps.map((_, i) => {
              const dayLabel = weekDays[new Date(now.getTime() - (6 - i) * 86400000).getDay()];
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex flex-col items-center gap-1" style={{ height: '120px' }}>
                    <div
                      className="w-full max-w-[32px] rounded-t-md bg-gradient-to-t from-violet-600 to-violet-400 transition-all duration-500"
                      style={{ height: `${(weeklyApps[i] / maxActivity) * 100}%`, minHeight: weeklyApps[i] > 0 ? '8px' : '2px' }}
                    />
                    <div
                      className="w-full max-w-[32px] rounded-t-md bg-gradient-to-t from-emerald-600 to-emerald-400 transition-all duration-500"
                      style={{ height: `${(weeklyDeploys[i] / maxActivity) * 100}%`, minHeight: weeklyDeploys[i] > 0 ? '8px' : '2px' }}
                    />
                  </div>
                  <span className="text-[10px] text-zinc-600">{dayLabel}</span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-4 mt-4 pt-3 border-t border-zinc-800">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm bg-violet-500" />
              <span className="text-[10px] text-zinc-500">Apps Created</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
              <span className="text-[10px] text-zinc-500">Deployments</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Agent Mode Usage */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              Agent Mode Usage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-zinc-400 flex items-center gap-1.5">
                    <Bot className="w-3 h-3 text-cyan-400" /> Engineer Mode
                  </span>
                  <span className="text-xs text-zinc-300">{engineerModeApps} apps</span>
                </div>
                <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400 rounded-full transition-all duration-700"
                    style={{ width: `${totalApps > 0 ? (engineerModeApps / totalApps) * 100 : 50}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-zinc-400 flex items-center gap-1.5">
                    <Users className="w-3 h-3 text-amber-400" /> Team Mode
                  </span>
                  <span className="text-xs text-zinc-300">{teamModeApps} apps</span>
                </div>
                <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-700"
                    style={{ width: `${totalApps > 0 ? (teamModeApps / totalApps) * 100 : 50}%` }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
              <Zap className="w-4 h-4 text-violet-400" />
              Quick Stats
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { label: 'Success Rate', value: `${successRate}%`, icon: CheckCircle2, color: successRate >= 80 ? 'text-emerald-400' : 'text-amber-400' },
                { label: 'Failed Deploys', value: `${failedCount}`, icon: XCircle, color: 'text-rose-400' },
                { label: 'In Progress', value: `${deployments.filter(d => d.status === 'building' || d.status === 'pending').length}`, icon: Loader2, color: 'text-cyan-400' },
                { label: 'Draft Apps', value: `${draftApps}`, icon: Clock, color: 'text-zinc-400' },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 border-b border-zinc-800 last:border-0">
                  <span className="text-xs text-zinc-400 flex items-center gap-1.5">
                    <item.icon className={`w-3 h-3 ${item.color}`} />
                    {item.label}
                  </span>
                  <span className="text-xs font-semibold text-zinc-200">{item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Deployment Activity */}
      {recentDeploys.length > 0 && (
        <Card className="bg-zinc-900 border-zinc-800 mt-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              Recent Deployments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentDeploys.map(dep => {
                const statusIcon = dep.status === 'deployed' ? CheckCircle2 : dep.status === 'failed' ? XCircle : dep.status === 'building' ? Loader2 : Clock;
                const statusColor = dep.status === 'deployed' ? 'text-emerald-400' : dep.status === 'failed' ? 'text-rose-400' : dep.status === 'building' ? 'text-cyan-400' : 'text-amber-400';
                const Icon = statusIcon;
                return (
                  <div key={dep.id} className="flex items-center justify-between py-2 border-b border-zinc-800 last:border-0">
                    <div className="flex items-center gap-2">
                      <Icon className={`w-3.5 h-3.5 ${statusColor} ${dep.status === 'building' ? 'animate-spin' : ''}`} />
                      <span className="text-xs text-zinc-300">{dep.app_name || `App #${dep.app_id}`}</span>
                    </div>
                    <span className="text-[10px] text-zinc-600">
                      {dep.created_at ? new Date(dep.created_at).toLocaleString() : 'Just now'}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}