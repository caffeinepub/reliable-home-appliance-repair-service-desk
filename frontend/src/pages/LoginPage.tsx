import { useInternetIdentity } from '../hooks/useInternetIdentity';
import { useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Wrench, Shield, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const { login, clear, loginStatus, identity, isInitializing } = useInternetIdentity();
  const navigate = useNavigate();
  const isAuthenticated = !!identity;
  const isLoggingIn = loginStatus === 'logging-in';

  useEffect(() => {
    if (isAuthenticated) {
      navigate({ to: '/' });
    }
  }, [isAuthenticated, navigate]);

  const handleLogin = async () => {
    if (isAuthenticated) {
      await clear();
    } else {
      try {
        await login();
      } catch (error: unknown) {
        const err = error as Error;
        if (err?.message === 'User is already authenticated') {
          await clear();
          setTimeout(() => login(), 300);
        }
      }
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-12">
      {/* Logo & Brand */}
      <div className="flex flex-col items-center mb-10 animate-fade-in">
        <div className="w-24 h-24 rounded-2xl bg-primary flex items-center justify-center shadow-card mb-5">
          <img
            src="/assets/generated/reliable-logo.dim_256x256.png"
            alt="Reliable Home Appliance Repair"
            className="w-20 h-20 object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
          <Wrench className="text-primary-foreground hidden" size={40} />
        </div>
        <h1 className="font-display font-bold text-2xl text-foreground text-center leading-tight">
          Reliable Home Appliance Repair LLC
        </h1>
        <p className="text-muted-foreground text-sm mt-1 text-center">
          Professional Service Desk
        </p>
      </div>

      {/* Login Card */}
      <div className="w-full max-w-sm bg-card rounded-2xl shadow-card border border-border p-6 animate-fade-in">
        <div className="flex items-center gap-2 mb-4">
          <Shield size={18} className="text-primary" />
          <h2 className="font-semibold text-foreground">Secure Login</h2>
        </div>
        <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
          Sign in with your Internet Identity to access the service desk. Your identity is secured on the blockchain.
        </p>

        {isInitializing ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="animate-spin text-primary" size={24} />
          </div>
        ) : (
          <Button
            onClick={handleLogin}
            disabled={isLoggingIn}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold py-3 rounded-xl"
            size="lg"
          >
            {isLoggingIn ? (
              <>
                <Loader2 className="animate-spin mr-2" size={18} />
                Signing In...
              </>
            ) : (
              'Sign In'
            )}
          </Button>
        )}

        {loginStatus === 'loginError' && (
          <p className="text-destructive text-sm mt-3 text-center">
            Login failed. Please try again.
          </p>
        )}
      </div>

      {/* Footer */}
      <p className="text-muted-foreground text-xs mt-8 text-center">
        © {new Date().getFullYear()} Reliable Home Appliance Repair LLC
      </p>
    </div>
  );
}
