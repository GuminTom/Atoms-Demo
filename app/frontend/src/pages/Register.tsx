import React, { useState } from 'react';
import { useNavigate, Link, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../components/ui/card';
import { Zap, Loader2 } from 'lucide-react';

const Register: React.FC = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, localRegister } = useAuth();
  const navigate = useNavigate();

  // Redirect to dashboard if already logged in
  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    // Validate byte length (bcrypt limit is 72 bytes, not characters)
    const passwordBytes = new TextEncoder().encode(password).length;
    if (passwordBytes < 6) {
      setError('Password must be at least 6 bytes');
      return;
    }

    if (passwordBytes > 72) {
      setError('Password must be no more than 72 bytes (multi-byte characters count as multiple bytes)');
      return;
    }

    setLoading(true);

    try {
      await localRegister(username, email, password, name || undefined);
      navigate('/');
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="flex flex-col items-center gap-2">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-600 to-cyan-600 flex items-center justify-center">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">VideoCode</h1>
          <p className="text-muted-foreground text-sm">Multi-Agent Video Coding Platform</p>
        </div>

        <Card className="bg-card border-border">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl font-bold text-center text-foreground">Create Account</CardTitle>
            <CardDescription className="text-center text-muted-foreground">
              Fill in the details below to create your account
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {error && (
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm p-3 rounded-xl">
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="username" className="text-foreground">Username</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="Choose a username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoComplete="username"
                  minLength={3}
                  className="bg-muted border-border text-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-foreground">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="bg-muted border-border text-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name" className="text-foreground">Display Name (optional)</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Enter your display name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  className="bg-muted border-border text-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-foreground">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Create a password (6-72 bytes)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="bg-muted border-border text-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-foreground">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="bg-muted border-border text-foreground"
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-4">
              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white rounded-xl"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating Account...
                  </>
                ) : (
                  'Create Account'
                )}
              </Button>
              <p className="text-sm text-muted-foreground text-center">
                Already have an account?{' '}
                <Link to="/login" className="text-violet-400 hover:text-violet-300 hover:underline font-medium">
                  Sign in
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default Register;