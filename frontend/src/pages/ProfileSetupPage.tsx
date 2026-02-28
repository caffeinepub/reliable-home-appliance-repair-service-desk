import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useSaveCallerUserProfile, useGetUserSignature } from '../hooks/useQueries';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import SignatureCapture from '../components/SignatureCapture';
import { UserCircle, Loader2 } from 'lucide-react';

type Step = 'profile' | 'signature';

export default function ProfileSetupPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [step, setStep] = useState<Step>('profile');
  const saveProfile = useSaveCallerUserProfile();
  const { data: existingSignature, isLoading: sigLoading } = useGetUserSignature();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await saveProfile.mutateAsync({ name: name.trim() });
      // If signature already exists, skip to home
      if (existingSignature) {
        navigate({ to: '/' });
      } else {
        setStep('signature');
      }
    } catch (err) {
      console.error('Failed to save profile:', err);
    }
  };

  const handleSignatureComplete = () => {
    navigate({ to: '/' });
  };

  const handleSignatureSkip = () => {
    navigate({ to: '/' });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center mb-4">
            <UserCircle size={36} className="text-accent-foreground" />
          </div>
          <h1 className="font-display font-bold text-xl text-foreground">
            {step === 'profile' ? 'Welcome!' : 'Your Signature'}
          </h1>
          <p className="text-muted-foreground text-sm mt-1 text-center">
            {step === 'profile'
              ? "Let's set up your profile to get started."
              : 'Optional: Add your signature for use on estimates and waivers.'}
          </p>
        </div>

        <div className="bg-card rounded-2xl shadow-card border border-border p-6">
          {step === 'profile' ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium">
                  Your Name
                </Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="e.g. John Smith"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="rounded-xl"
                  autoFocus
                />
              </div>
              <Button
                type="submit"
                disabled={!name.trim() || saveProfile.isPending || sigLoading}
                className="w-full bg-primary text-primary-foreground rounded-xl font-semibold"
                size="lg"
              >
                {saveProfile.isPending ? (
                  <>
                    <Loader2 className="animate-spin mr-2" size={18} />
                    Saving...
                  </>
                ) : (
                  'Continue'
                )}
              </Button>
              {saveProfile.isError && (
                <p className="text-destructive text-sm text-center">
                  Failed to save profile. Please try again.
                </p>
              )}
            </form>
          ) : (
            <SignatureCapture
              onComplete={handleSignatureComplete}
              onSkip={handleSignatureSkip}
            />
          )}
        </div>
      </div>
    </div>
  );
}
