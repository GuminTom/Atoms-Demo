import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Separator } from '../components/ui/separator';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import { Badge } from '../components/ui/badge';
import {
  User,
  Mail,
  Calendar,
  Shield,
  Edit3,
  Save,
  X,
  Github,
  Key,
  Bell,
  Palette,
  Loader2,
  CheckCircle2,
} from 'lucide-react';

export default function Profile() {
  const { user, logout, refetch } = useAuth();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [email] = useState(user?.email || '');

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() || 'U';

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setSaveSuccess(false);
    try {
      await api.put('/api/v1/users/profile', { name: name.trim() });
      await refetch();
      setSaveSuccess(true);
      setEditing(false);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch {
      // Handle error - could show a toast
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-50">Profile</h1>
        <p className="text-zinc-400 text-sm mt-1">Manage your account settings and preferences</p>
      </div>

      {/* Save success banner */}
      {saveSuccess && (
        <div className="mb-4 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
          <CheckCircle2 className="w-4 h-4" />
          Profile updated successfully
        </div>
      )}

      {/* Profile Card */}
      <Card className="bg-zinc-900 border-zinc-800 mb-6">
        <CardContent className="p-6">
          <div className="flex items-start gap-6">
            <Avatar className="w-20 h-20 border-2 border-zinc-700">
              <AvatarFallback className="bg-gradient-to-br from-violet-500/20 to-cyan-500/20 text-2xl font-bold text-zinc-200">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                {editing ? (
                  <Input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="bg-zinc-800 border-zinc-700 text-zinc-100 max-w-xs"
                    onKeyDown={e => e.key === 'Enter' && handleSave()}
                    autoFocus
                  />
                ) : (
                  <h2 className="text-xl font-bold text-zinc-100">{user?.name || 'User'}</h2>
                )}
                <Badge variant="secondary" className="bg-violet-500/15 text-violet-400 text-[10px]">
                  <Shield className="w-3 h-3 mr-1" />
                  Developer
                </Badge>
              </div>
              <p className="text-zinc-400 text-sm flex items-center gap-1.5 mb-3">
                <Mail className="w-3.5 h-3.5" />
                {email}
              </p>
              <p className="text-zinc-500 text-xs flex items-center gap-1.5">
                <Calendar className="w-3 h-3" />
                Member since {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </p>
              <div className="flex gap-2 mt-4">
                {editing ? (
                  <>
                    <Button
                      onClick={handleSave}
                      size="sm"
                      disabled={saving || !name.trim()}
                      className="bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white rounded-xl"
                    >
                      {saving ? (
                        <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                      ) : (
                        <Save className="w-3.5 h-3.5 mr-1" />
                      )}
                      Save
                    </Button>
                    <Button
                      onClick={() => { setEditing(false); setName(user?.name || ''); }}
                      variant="outline"
                      size="sm"
                      className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 rounded-xl"
                      disabled={saving}
                    >
                      <X className="w-3.5 h-3.5 mr-1" /> Cancel
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={() => setEditing(true)}
                    variant="outline"
                    size="sm"
                    className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 rounded-xl"
                  >
                    <Edit3 className="w-3.5 h-3.5 mr-1" /> Edit Profile
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Settings Sections */}
      <div className="space-y-4">
        {/* Integrations */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
              <Key className="w-4 h-4 text-violet-400" />
              Integrations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center">
                  <Github className="w-4 h-4 text-zinc-300" />
                </div>
                <div>
                  <p className="text-sm text-zinc-200">GitHub</p>
                  <p className="text-xs text-zinc-500">Connect your repositories</p>
                </div>
              </div>
              <Button variant="outline" size="sm" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 rounded-xl text-xs">
                Connect
              </Button>
            </div>
            <Separator className="bg-zinc-800" />
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center">
                  <Key className="w-4 h-4 text-zinc-300" />
                </div>
                <div>
                  <p className="text-sm text-zinc-200">API Keys</p>
                  <p className="text-xs text-zinc-500">Manage your API access tokens</p>
                </div>
              </div>
              <Button variant="outline" size="sm" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 rounded-xl text-xs">
                Manage
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Preferences */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
              <Palette className="w-4 h-4 text-cyan-400" />
              Preferences
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center">
                  <Bell className="w-4 h-4 text-zinc-300" />
                </div>
                <div>
                  <p className="text-sm text-zinc-200">Notifications</p>
                  <p className="text-xs text-zinc-500">Email and in-app notifications</p>
                </div>
              </div>
              <Button variant="outline" size="sm" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 rounded-xl text-xs">
                Configure
              </Button>
            </div>
            <Separator className="bg-zinc-800" />
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center">
                  <Palette className="w-4 h-4 text-zinc-300" />
                </div>
                <div>
                  <p className="text-sm text-zinc-200">Theme</p>
                  <p className="text-xs text-zinc-500">Dark mode (default)</p>
                </div>
              </div>
              <Badge variant="secondary" className="bg-zinc-800 text-zinc-400 text-[10px]">
                Dark
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="bg-zinc-900 border-rose-500/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-rose-400 flex items-center gap-2">
              <User className="w-4 h-4" />
              Account
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-zinc-200">Sign Out</p>
                <p className="text-xs text-zinc-500">End your current session</p>
              </div>
              <Button
                onClick={logout}
                variant="outline"
                size="sm"
                className="border-rose-500/30 text-rose-400 hover:bg-rose-500/10 rounded-xl text-xs"
              >
                Sign Out
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}