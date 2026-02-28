import { useState } from 'react';
import { useSignaturePad } from '../hooks/useSignaturePad';
import { useStoreUserSignature } from '../hooks/useQueries';
import { Button } from '@/components/ui/button';
import { Loader2, PenLine, RotateCcw, Check, SkipForward } from 'lucide-react';

interface SignatureCaptureProps {
  onComplete: () => void;
  onSkip: () => void;
}

export default function SignatureCapture({ onComplete, onSkip }: SignatureCaptureProps) {
  const { canvasRef, clear, getSignatureBytes, isEmpty } = useSignaturePad();
  const storeSignature = useStoreUserSignature();
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    const bytes = await getSignatureBytes();
    if (!bytes) return;
    try {
      await storeSignature.mutateAsync(bytes);
      setSaved(true);
      setTimeout(() => onComplete(), 1200);
    } catch (err) {
      console.error('Failed to save signature:', err);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <PenLine size={18} className="text-primary" />
        <p className="text-sm text-muted-foreground">
          Draw your signature below using your finger or mouse.
        </p>
      </div>

      <div className="relative rounded-xl border-2 border-dashed border-border bg-background overflow-hidden">
        <canvas
          ref={canvasRef}
          width={600}
          height={200}
          className="w-full touch-none cursor-crosshair"
          style={{ display: 'block', height: '160px' }}
        />
        {isEmpty && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-muted-foreground/40 text-sm select-none">Sign here</span>
          </div>
        )}
      </div>

      {saved && (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
          <Check size={16} />
          Signature saved successfully!
        </div>
      )}

      {storeSignature.isError && (
        <p className="text-destructive text-sm text-center">
          Failed to save signature. Please try again.
        </p>
      )}

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={clear}
          disabled={isEmpty || storeSignature.isPending || saved}
          className="rounded-xl"
        >
          <RotateCcw size={14} className="mr-1.5" />
          Clear
        </Button>
        <Button
          type="button"
          onClick={handleSave}
          disabled={isEmpty || storeSignature.isPending || saved}
          className="flex-1 bg-primary text-primary-foreground rounded-xl font-semibold"
        >
          {storeSignature.isPending ? (
            <>
              <Loader2 className="animate-spin mr-2" size={16} />
              Saving...
            </>
          ) : saved ? (
            <>
              <Check size={16} className="mr-1.5" />
              Saved!
            </>
          ) : (
            'Save Signature'
          )}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onSkip}
          disabled={storeSignature.isPending}
          className="rounded-xl text-muted-foreground"
        >
          <SkipForward size={14} className="mr-1" />
          Skip
        </Button>
      </div>
    </div>
  );
}
