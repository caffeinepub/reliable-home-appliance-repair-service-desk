import { Button } from "@/components/ui/button";
import { Check, Loader2, PenLine, RotateCcw, SkipForward } from "lucide-react";
import { useState } from "react";
import { useSignaturePad } from "../hooks/useSignaturePad";

interface SignatureCaptureProps {
  /** Called with the raw PNG bytes when the user saves their signature. */
  onSave?: (bytes: Uint8Array) => Promise<void> | void;
  /** Called when the user clicks "Skip" or dismisses the pad. */
  onSkip?: () => void;
  /** Called after a successful save (used by ProfileSetupPage flow). */
  onComplete?: () => void;
  /** External pending state (e.g. from a parent mutation). */
  isSaving?: boolean;
}

export default function SignatureCapture({
  onSave,
  onSkip,
  onComplete,
  isSaving: externalSaving = false,
}: SignatureCaptureProps) {
  const { canvasRef, clear, getSignatureBytes, isEmpty } = useSignaturePad();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const isPending = saving || externalSaving;

  const handleSave = async () => {
    const bytes = getSignatureBytes();
    if (!bytes || bytes.length === 0) return;
    setError("");
    setSaving(true);
    try {
      if (onSave) {
        await onSave(bytes);
      }
      setSaved(true);
      if (onComplete) {
        setTimeout(() => onComplete(), 1200);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save signature");
    } finally {
      setSaving(false);
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

      {/* Canvas wrapper — explicit height so the canvas is never zero-sized */}
      <div
        className="relative rounded-xl border-2 border-dashed border-border bg-background overflow-hidden"
        style={{ height: "160px" }}
      >
        <canvas
          ref={canvasRef}
          style={{
            display: "block",
            width: "100%",
            height: "100%",
            touchAction: "none",
            cursor: "crosshair",
          }}
        />
        {isEmpty && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-muted-foreground/40 text-sm select-none">
              Sign here
            </span>
          </div>
        )}
      </div>

      {saved && (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
          <Check size={16} />
          Signature saved successfully!
        </div>
      )}

      {error && <p className="text-destructive text-sm text-center">{error}</p>}

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={clear}
          disabled={isEmpty || isPending || saved}
          className="rounded-xl"
        >
          <RotateCcw size={14} className="mr-1.5" />
          Clear
        </Button>
        <Button
          type="button"
          onClick={handleSave}
          disabled={isEmpty || isPending || saved}
          className="flex-1 bg-primary text-primary-foreground rounded-xl font-semibold"
        >
          {isPending ? (
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
            "Save Signature"
          )}
        </Button>
        {onSkip && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onSkip}
            disabled={isPending}
            className="rounded-xl text-muted-foreground"
          >
            <SkipForward size={14} className="mr-1" />
            Skip
          </Button>
        )}
      </div>
    </div>
  );
}
