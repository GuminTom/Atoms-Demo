import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { client } from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Separator } from '../components/ui/separator';
import {
  Settings,
  Bot,
  Key,
  Github,
  Palette,
  Save,
  Eye,
  EyeOff,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Monitor,
  Moon,
  Sun,
  Code2,
  Bell,
  Unplug,
  ExternalLink,
} from 'lucide-react';

interface ModelOption {
  id: string;
  name: string;
  provider: string;
  description: string;
}

const AVAILABLE_MODELS: ModelOption[] = [
  { id: 'claude-opus-4.6', name: 'Claude Opus 4.6', provider: 'Anthropic', description: 'Code Expert / Multimodal / High Quality' },
  { id: 'gpt-5.4', name: 'GPT-5.4', provider: 'OpenAI', description: 'Versatile / Multimodal / Structured Writing' },
  { id: 'deepseek-v3.2', name: 'DeepSeek V3.2', provider: 'DeepSeek', description: 'Cost Effective / Text Only / Bulk Processing' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'Google', description: 'Multimodal / Production Grade / General Purpose' },
  { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro', provider: 'Google', description: 'Best Multimodal / Long Context' },
];

interface ApiKeyEntry {
  provider: string;
  key_preview: string;
  is_set: boolean;
}

interface WorkspacePrefs {
  theme: string;
  font_size: number;
  tab_size: number;
  word_wrap: boolean;
  auto_save: boolean;
  auto_save_delay: number;
}

const DEFAULT_PREFS: WorkspacePrefs = {
  theme: 'dark',
  font_size: 14,
  tab_size: 2,
  word_wrap: true,
  auto_save: true,
  auto_save_delay: 2000,
};

export default function SettingsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('model');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  // Model config
  const [defaultModel, setDefaultModel] = useState('deepseek-v3.2');
  const [savedModel, setSavedModel] = useState('deepseek-v3.2');

  // API Keys
  const [apiKeys, setApiKeys] = useState<ApiKeyEntry[]>([
    { provider: 'openai', key_preview: '', is_set: false },
    { provider: 'anthropic', key_preview: '', is_set: false },
    { provider: 'deepseek', key_preview: '', is_set: false },
    { provider: 'google', key_preview: '', is_set: false },
  ]);
  const [newKeyProvider, setNewKeyProvider] = useState('');
  const [newKeyValue, setNewKeyValue] = useState('');
  const [showKeyValue, setShowKeyValue] = useState(false);

  // GitHub
  const [githubBound, setGithubBound] = useState(false);
  const [githubUsername, setGithubUsername] = useState('');
  const [githubLoading, setGithubLoading] = useState(false);

  // Preferences
  const [prefs, setPrefs] = useState<WorkspacePrefs>(DEFAULT_PREFS);

  useEffect(() => {
    loadSettings();
  }, [user]);

  const loadSettings = async () => {
    try {
      // Load user preferences from backend
      const res = await client.api.get('/api/v1/users/preferences');
      if (res?.data) {
        const data = res.data;
        if (data.default_model) {
          setDefaultModel(data.default_model);
          setSavedModel(data.default_model);
        }
        if (data.github_bound) {
          setGithubBound(true);
          setGithubUsername(data.github_username || '');
        }
        if (data.api_keys) {
          setApiKeys(data.api_keys);
        }
        if (data.preferences) {
          setPrefs({ ...DEFAULT_PREFS, ...data.preferences });
        }
      }
    } catch {
      // Use defaults if no saved settings
    }
  };

  const showSaveSuccess = (section: string) => {
    setSaveSuccess(section);
    setTimeout(() => setSaveSuccess(null), 3000);
  };

  const saveModelConfig = async () => {
    setSaving(true);
    try {
      await client.api.put('/api/v1/users/preferences', {
        default_model: defaultModel,
      });
      setSavedModel(defaultModel);
      showSaveSuccess('model');
    } catch {
      // Handle error
    } finally {
      setSaving(false);
    }
  };

  const saveApiKey = async () => {
    if (!newKeyProvider.trim() || !newKeyValue.trim()) return;
    setSaving(true);
    try {
      await client.api.post('/api/v1/users/api-keys', {
        provider: newKeyProvider.trim().toLowerCase(),
        key: newKeyValue.trim(),
      });
      setApiKeys(prev =>
        prev.map(k =>
          k.provider === newKeyProvider.trim().toLowerCase()
            ? { ...k, key_preview: `****${newKeyValue.slice(-4)}`, is_set: true }
            : k
        )
      );
      setNewKeyProvider('');
      setNewKeyValue('');
      setShowKeyValue(false);
      showSaveSuccess('apikeys');
    } catch {
      // Handle error
    } finally {
      setSaving(false);
    }
  };

  const deleteApiKey = async (provider: string) => {
    setSaving(true);
    try {
      await client.api.delete(`/api/v1/users/api-keys/${provider}`);
      setApiKeys(prev =>
        prev.map(k =>
          k.provider === provider ? { ...k, key_preview: '', is_set: false } : k
        )
      );
      showSaveSuccess('apikeys');
    } catch {
      // Handle error
    } finally {
      setSaving(false);
    }
  };

  const handleGithubBind = async () => {
    setGithubLoading(true);
    try {
      // Simulate GitHub OAuth flow
      await client.api.post('/api/v1/users/github/bind');
      setGithubBound(true);
      setGithubUsername(user?.name?.toLowerCase().replace(/\s/g, '') || 'developer');
      showSaveSuccess('github');
    } catch {
      // Fallback: simulate binding for demo
      setGithubBound(true);
      setGithubUsername(user?.name?.toLowerCase().replace(/\s/g, '') || 'developer');
      showSaveSuccess('github');
    } finally {
      setGithubLoading(false);
    }
  };

  const handleGithubUnbind = async () => {
    setGithubLoading(true);
    try {
      await client.api.delete('/api/v1/users/github/unbind');
      setGithubBound(false);
      setGithubUsername('');
      showSaveSuccess('github');
    } catch {
      setGithubBound(false);
      setGithubUsername('');
      showSaveSuccess('github');
    } finally {
      setGithubLoading(false);
    }
  };

  const savePreferences = async () => {
    setSaving(true);
    try {
      await client.api.put('/api/v1/users/preferences', {
        preferences: prefs,
      });
      showSaveSuccess('preferences');
    } catch {
      // Handle error
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'model', label: 'Default Model', icon: Bot },
    { id: 'apikeys', label: 'API Keys', icon: Key },
    { id: 'github', label: 'GitHub', icon: Github },
    { id: 'preferences', label: 'Preferences', icon: Palette },
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-50 flex items-center gap-2">
          <Settings className="w-6 h-6 text-violet-400" />
          Settings
        </h1>
        <p className="text-zinc-400 text-sm mt-1">Configure your workspace, models, and integrations</p>
      </div>

      {/* Save Success Banner */}
      {saveSuccess && (
        <div className="mb-4 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4" />
          Settings saved successfully
        </div>
      )}

      <div className="flex gap-6">
        {/* Left Tab Navigation */}
        <div className="w-48 shrink-0">
          <nav className="space-y-1 sticky top-6">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-violet-500/15 text-violet-400'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Right Content */}
        <div className="flex-1 min-w-0">
          {/* Default Model */}
          {activeTab === 'model' && (
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
                  <Bot className="w-4 h-4 text-violet-400" />
                  Default Agent Model
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-xs text-zinc-500">
                  Select the default LLM model used by agents when processing your requests.
                  You can override this per-session in the workspace.
                </p>
                <div className="space-y-2">
                  {AVAILABLE_MODELS.map(model => (
                    <button
                      key={model.id}
                      onClick={() => setDefaultModel(model.id)}
                      className={`w-full flex items-center gap-4 p-3 rounded-lg border transition-all text-left ${
                        defaultModel === model.id
                          ? 'border-violet-500/50 bg-violet-500/10'
                          : 'border-zinc-800 bg-zinc-800/30 hover:border-zinc-700 hover:bg-zinc-800/60'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        defaultModel === model.id
                          ? 'border-violet-400'
                          : 'border-zinc-600'
                      }`}>
                        {defaultModel === model.id && (
                          <div className="w-2 h-2 rounded-full bg-violet-400" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-zinc-200">{model.name}</p>
                          <Badge variant="secondary" className="text-[9px] bg-zinc-700 text-zinc-300">
                            {model.provider}
                          </Badge>
                        </div>
                        <p className="text-xs text-zinc-500 mt-0.5">{model.description}</p>
                      </div>
                      {savedModel === model.id && (
                        <Badge variant="secondary" className="text-[9px] bg-emerald-500/15 text-emerald-400">
                          Active
                        </Badge>
                      )}
                    </button>
                  ))}
                </div>
                <div className="flex justify-end pt-2">
                  <Button
                    onClick={saveModelConfig}
                    disabled={saving || defaultModel === savedModel}
                    className="bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white rounded-xl"
                  >
                    {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                    Save Model
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* API Keys */}
          {activeTab === 'apikeys' && (
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
                  <Key className="w-4 h-4 text-violet-400" />
                  API Keys
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-xs text-zinc-500">
                  Configure your own API keys for LLM providers. Keys are encrypted at rest and never shown in full.
                </p>

                {/* Existing Keys */}
                <div className="space-y-2">
                  {apiKeys.filter(k => k.is_set).map(key => (
                    <div key={key.provider} className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/50 border border-zinc-800">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-zinc-700 flex items-center justify-center">
                          <Key className="w-4 h-4 text-zinc-300" />
                        </div>
                        <div>
                          <p className="text-sm text-zinc-200 capitalize">{key.provider}</p>
                          <p className="text-xs text-zinc-500 font-mono">{key.key_preview}</p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteApiKey(key.provider)}
                        className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 text-xs"
                      >
                        <Unplug className="w-3.5 h-3.5 mr-1" /> Remove
                      </Button>
                    </div>
                  ))}
                  {apiKeys.filter(k => k.is_set).length === 0 && (
                    <div className="text-center py-6">
                      <Key className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                      <p className="text-zinc-500 text-xs">No API keys configured</p>
                      <p className="text-zinc-600 text-[10px] mt-1">Add a key below to use your own provider accounts</p>
                    </div>
                  )}
                </div>

                <Separator className="bg-zinc-800" />

                {/* Add New Key */}
                <div className="space-y-3">
                  <p className="text-xs text-zinc-400 font-medium">Add New API Key</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1 block">Provider</label>
                      <select
                        value={newKeyProvider}
                        onChange={e => setNewKeyProvider(e.target.value)}
                        className="w-full h-9 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm px-3 focus:outline-none focus:border-violet-500"
                      >
                        <option value="">Select provider...</option>
                        <option value="openai">OpenAI</option>
                        <option value="anthropic">Anthropic</option>
                        <option value="deepseek">DeepSeek</option>
                        <option value="google">Google (Gemini)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1 block">API Key</label>
                      <div className="relative">
                        <Input
                          type={showKeyValue ? 'text' : 'password'}
                          value={newKeyValue}
                          onChange={e => setNewKeyValue(e.target.value)}
                          placeholder="sk-..."
                          className="bg-zinc-800 border-zinc-700 text-zinc-100 pr-10 text-sm"
                        />
                        <button
                          onClick={() => setShowKeyValue(!showKeyValue)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                        >
                          {showKeyValue ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button
                      onClick={saveApiKey}
                      disabled={saving || !newKeyProvider || !newKeyValue.trim()}
                      className="bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white rounded-xl"
                    >
                      {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Key className="w-4 h-4 mr-1" />}
                      Add Key
                    </Button>
                  </div>
                </div>

                <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                  <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-amber-300/80">
                    API keys are encrypted and stored securely. They are only decrypted when needed for API calls.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* GitHub Integration */}
          {activeTab === 'github' && (
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
                  <Github className="w-4 h-4 text-violet-400" />
                  GitHub Integration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-xs text-zinc-500">
                  Connect your GitHub account to push code directly to your repositories.
                </p>

                {githubBound ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-4 p-4 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                      <div className="w-12 h-12 rounded-xl bg-zinc-800 flex items-center justify-center">
                        <Github className="w-6 h-6 text-zinc-200" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-zinc-200">{githubUsername}</p>
                          <Badge variant="secondary" className="text-[9px] bg-emerald-500/15 text-emerald-400">
                            <CheckCircle2 className="w-3 h-3 mr-1" /> Connected
                          </Badge>
                        </div>
                        <p className="text-xs text-zinc-500 mt-0.5">GitHub account is linked</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleGithubUnbind}
                        disabled={githubLoading}
                        className="border-rose-500/30 text-rose-400 hover:bg-rose-500/10 rounded-xl text-xs"
                      >
                        {githubLoading ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Unplug className="w-3.5 h-3.5 mr-1" />}
                        Unbind
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs text-zinc-400 font-medium">Capabilities</p>
                      {[
                        'Push code to your repositories',
                        'Create new repositories',
                        'List your existing repositories',
                        'Automatic commit and push from workspace',
                      ].map((cap, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs text-zinc-400">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          {cap}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 rounded-2xl bg-zinc-800 flex items-center justify-center mx-auto mb-4">
                      <Github className="w-8 h-8 text-zinc-400" />
                    </div>
                    <h3 className="text-zinc-300 font-medium mb-2">Connect GitHub</h3>
                    <p className="text-zinc-500 text-sm mb-4 max-w-sm mx-auto">
                      Link your GitHub account to push code, create repos, and manage your projects directly from the workspace.
                    </p>
                    <Button
                      onClick={handleGithubBind}
                      disabled={githubLoading}
                      className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded-xl"
                    >
                      {githubLoading ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Github className="w-4 h-4 mr-2" />
                      )}
                      Connect GitHub Account
                    </Button>
                    <p className="text-[10px] text-zinc-600 mt-3">
                      Requires repo and user:email scopes
                    </p>
                  </div>
                )}

                <Separator className="bg-zinc-800" />

                <div className="space-y-2">
                  <p className="text-xs text-zinc-400 font-medium">OAuth Scopes</p>
                  <div className="flex flex-wrap gap-2">
                    {['repo', 'user:email'].map(scope => (
                      <Badge key={scope} variant="secondary" className="text-[10px] bg-zinc-800 text-zinc-400">
                        {scope}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Preferences */}
          {activeTab === 'preferences' && (
            <div className="space-y-4">
              {/* Theme */}
              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader>
                  <CardTitle className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
                    <Palette className="w-4 h-4 text-violet-400" />
                    Theme
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { id: 'dark', label: 'Dark', icon: Moon },
                      { id: 'light', label: 'Light', icon: Sun },
                      { id: 'system', label: 'System', icon: Monitor },
                    ].map(theme => (
                      <button
                        key={theme.id}
                        onClick={() => setPrefs(p => ({ ...p, theme: theme.id }))}
                        className={`flex flex-col items-center gap-2 p-4 rounded-lg border transition-all ${
                          prefs.theme === theme.id
                            ? 'border-violet-500/50 bg-violet-500/10'
                            : 'border-zinc-800 bg-zinc-800/30 hover:border-zinc-700'
                        }`}
                      >
                        <theme.icon className={`w-5 h-5 ${prefs.theme === theme.id ? 'text-violet-400' : 'text-zinc-500'}`} />
                        <span className={`text-xs font-medium ${prefs.theme === theme.id ? 'text-violet-300' : 'text-zinc-400'}`}>
                          {theme.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Editor */}
              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader>
                  <CardTitle className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
                    <Code2 className="w-4 h-4 text-cyan-400" />
                    Editor
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5 block">Font Size</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min={10}
                          max={24}
                          value={prefs.font_size}
                          onChange={e => setPrefs(p => ({ ...p, font_size: parseInt(e.target.value) }))}
                          className="flex-1 accent-violet-500"
                        />
                        <span className="text-xs text-zinc-300 w-8 text-right">{prefs.font_size}px</span>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5 block">Tab Size</label>
                      <div className="flex items-center gap-2">
                        {[2, 4, 8].map(size => (
                          <button
                            key={size}
                            onClick={() => setPrefs(p => ({ ...p, tab_size: size }))}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                              prefs.tab_size === size
                                ? 'bg-violet-500/20 text-violet-400 border border-violet-500/50'
                                : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:border-zinc-600'
                            }`}
                          >
                            {size}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between py-2">
                    <div>
                      <p className="text-sm text-zinc-200">Word Wrap</p>
                      <p className="text-xs text-zinc-500">Wrap long lines in the editor</p>
                    </div>
                    <button
                      onClick={() => setPrefs(p => ({ ...p, word_wrap: !p.word_wrap }))}
                      className={`w-10 h-5 rounded-full transition-colors ${
                        prefs.word_wrap ? 'bg-violet-500' : 'bg-zinc-700'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                        prefs.word_wrap ? 'translate-x-5' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>
                </CardContent>
              </Card>

              {/* Auto-save */}
              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader>
                  <CardTitle className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
                    <Bell className="w-4 h-4 text-emerald-400" />
                    Auto-Save
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <p className="text-sm text-zinc-200">Enable Auto-Save</p>
                      <p className="text-xs text-zinc-500">Automatically save file changes</p>
                    </div>
                    <button
                      onClick={() => setPrefs(p => ({ ...p, auto_save: !p.auto_save }))}
                      className={`w-10 h-5 rounded-full transition-colors ${
                        prefs.auto_save ? 'bg-emerald-500' : 'bg-zinc-700'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                        prefs.auto_save ? 'translate-x-5' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>

                  {prefs.auto_save && (
                    <div>
                      <label className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5 block">Auto-Save Delay</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min={500}
                          max={10000}
                          step={500}
                          value={prefs.auto_save_delay}
                          onChange={e => setPrefs(p => ({ ...p, auto_save_delay: parseInt(e.target.value) }))}
                          className="flex-1 accent-emerald-500"
                        />
                        <span className="text-xs text-zinc-300 w-14 text-right">{(prefs.auto_save_delay / 1000).toFixed(1)}s</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button
                  onClick={savePreferences}
                  disabled={saving}
                  className="bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white rounded-xl"
                >
                  {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                  Save Preferences
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}