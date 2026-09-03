import { useState, useEffect, useMemo } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import {
  ShieldCheck, Copy, Check, Download,
  AlertTriangle, ArrowRight, RotateCcw, X, Lock
} from 'lucide-react'
import {
  getOrCreateUserRecoveryKey,
  markUserRecoveryKeyVerified,
} from '../../lib/recoveryKey'
import { haptic } from '../../lib/haptic'

interface RecoveryKeyModalProps {
  userId: string
  email: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onVerified?: () => void
}

type Step = 'view' | 'quiz' | 'success'

export function RecoveryKeyModal({
  userId,
  email,
  open,
  onOpenChange,
  onVerified,
}: RecoveryKeyModalProps) {
  const [step, setStep] = useState<Step>('view')
  const [copied, setCopied] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [selectedAnswers, setSelectedAnswers] = useState<string[]>([])
  const [candidateChips, setCandidateChips] = useState<string[]>([])

  // Load or generate phrase
  const recoveryStatus = useMemo(() => {
    if (!userId) return null
    return getOrCreateUserRecoveryKey(userId)
  }, [userId])

  const phrase = useMemo(() => recoveryStatus?.phrase || [], [recoveryStatus])

  // Quiz Setup: Pick 3 unique positions (#3, #7, #11 in 0-indexed)
  const quizPositions = useMemo(() => [2, 6, 10], [])

  // Prepare quiz candidate chips whenever transitioning to quiz step
  useEffect(() => {
    if (step === 'quiz' && phrase.length >= 12) {
      const correctWords = quizPositions.map(pos => phrase[pos])
      const otherWords = phrase.filter((_, idx) => !quizPositions.includes(idx)).slice(0, 3)
      const all = [...correctWords, ...otherWords]
      // Deterministic reverse/interleave shuffle
      const shuffled = [all[4], all[0], all[5], all[2], all[1], all[3]].filter(Boolean)
      setCandidateChips(shuffled.length === 6 ? shuffled : all)
      setSelectedAnswers([])
      setErrorMsg('')
    }
  }, [step, phrase, quizPositions])

  const handleStartQuiz = () => {
    haptic('light')
    setStep('quiz')
  }

  const handleCopy = () => {
    const text = phrase.map((w, i) => `${i + 1}. ${w}`).join('\n')
    navigator.clipboard.writeText(text)
    setCopied(true)
    haptic('light')
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    const content = `LIFE OS - MASTER RECOVERY KEY
Generated: ${new Date().toLocaleDateString()}
Account: ${email}

Keep this 12-word recovery phrase offline in a safe place.
Never share these words with anyone.

1. ${phrase[0]}    2. ${phrase[1]}    3. ${phrase[2]}    4. ${phrase[3]}
5. ${phrase[4]}    6. ${phrase[5]}    7. ${phrase[6]}    8. ${phrase[7]}
9. ${phrase[8]}    10. ${phrase[9]}   11. ${phrase[10]}  12. ${phrase[11]}
`
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `life-os-recovery-key-${email.split('@')[0]}.txt`
    a.click()
    URL.revokeObjectURL(url)
    haptic('medium')
  }

  const handleChipClick = (word: string) => {
    if (selectedAnswers.includes(word)) {
      // Remove word
      setSelectedAnswers(prev => prev.filter(w => w !== word))
    } else if (selectedAnswers.length < 3) {
      // Add word
      setSelectedAnswers(prev => [...prev, word])
      haptic('light')
    }
    setErrorMsg('')
  }

  const handleVerifyQuiz = async () => {
    if (selectedAnswers.length !== 3) return
    const expected = quizPositions.map(pos => phrase[pos])
    const isCorrect = selectedAnswers.every((word, idx) => word === expected[idx])

    if (isCorrect) {
      haptic('success')
      await markUserRecoveryKeyVerified(userId, email)
      setStep('success')
      onVerified?.()
    } else {
      haptic('error')
      setErrorMsg('Incorrect word order. Please check your written phrase and try again.')
      setSelectedAnswers([])
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-bg/80 backdrop-blur-md animate-in fade-in duration-200" />
        <Dialog.Content
          className="fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-border rounded-t-3xl p-6 shadow-2xl sm:inset-auto sm:left-1/2 sm:-translate-x-1/2 sm:top-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-lg sm:rounded-3xl sm:border max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200"
          style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
        >
          {/* Top handle on mobile */}
          <div className="w-10 h-1 rounded-full bg-border mx-auto mb-4 sm:hidden" />

          {/* ── STEP 1: View 12 Words ────────────────────────────────────── */}
          {step === 'view' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
                    <Lock size={18} />
                  </div>
                  <div>
                    <Dialog.Title className="text-base font-display font-bold text-text">
                      Master Recovery Key
                    </Dialog.Title>
                    <p className="text-xs text-text-secondary">
                      Zero-email account recovery & backup
                    </p>
                  </div>
                </div>
                <Dialog.Close className="p-1 text-text-muted hover:text-text rounded-lg">
                  <X size={18} />
                </Dialog.Close>
              </div>

              <div className="bg-warning/10 border border-warning/25 rounded-2xl p-4 flex items-start gap-3 text-xs text-text-secondary leading-relaxed">
                <AlertTriangle size={16} className="text-warning flex-shrink-0 mt-0.5" />
                <p>
                  Write down these <strong>12 words in order</strong>. If you ever forget your password, this is the only key that can restore your account without sending emails.
                </p>
              </div>

              {/* 12 Word Grid */}
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 select-all">
                {phrase.map((word, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 bg-surface-2 border border-border/80 rounded-xl px-3 py-2 text-xs font-mono"
                  >
                    <span className="text-text-muted text-[10px] font-bold w-4 text-right">
                      {idx + 1}.
                    </span>
                    <span className="font-semibold text-text tracking-wide truncate">
                      {word}
                    </span>
                  </div>
                ))}
              </div>

              {/* Action Buttons: Copy & Download */}
              <div className="flex gap-2">
                <button
                  onClick={handleCopy}
                  className="flex-1 flex items-center justify-center gap-2 py-2 bg-surface-2 hover:bg-muted border border-border text-text font-medium text-xs rounded-xl transition-colors"
                >
                  {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                  {copied ? 'Copied to Clipboard' : 'Copy Phrase'}
                </button>
                <button
                  onClick={handleDownload}
                  className="flex-1 flex items-center justify-center gap-2 py-2 bg-surface-2 hover:bg-muted border border-border text-text font-medium text-xs rounded-xl transition-colors"
                >
                  <Download size={14} />
                  Download .txt
                </button>
              </div>

              {/* Next Step Button */}
              <button
                onClick={handleStartQuiz}
                className="w-full py-3 bg-accent text-bg font-semibold text-sm rounded-xl hover:bg-accent-dim transition-all flex items-center justify-center gap-2 mt-2 shadow-sm"
              >
                I've Saved It · Test & Verify <ArrowRight size={16} />
              </button>
            </div>
          )}

          {/* ── STEP 2: Trust Wallet Verification Quiz ──────────────────── */}
          {step === 'quiz' && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
                    <ShieldCheck size={18} />
                  </div>
                  <div>
                    <Dialog.Title className="text-base font-display font-bold text-text">
                      Verify Recovery Key
                    </Dialog.Title>
                    <p className="text-xs text-text-secondary">
                      Tap the 3 requested words in order
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setStep('view')}
                  className="text-xs text-text-muted hover:text-accent font-medium flex items-center gap-1"
                >
                  <RotateCcw size={12} /> View again
                </button>
              </div>

              {errorMsg && (
                <div className="bg-danger/10 border border-danger/30 rounded-xl p-3 text-xs text-danger flex items-center gap-2 animate-in fade-in">
                  <AlertTriangle size={14} /> {errorMsg}
                </div>
              )}

              {/* Target Slots */}
              <div className="grid grid-cols-3 gap-2">
                {quizPositions.map((pos, slotIdx) => {
                  const filledWord = selectedAnswers[slotIdx]
                  return (
                    <div
                      key={pos}
                      onClick={() => filledWord && handleChipClick(filledWord)}
                      className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all cursor-pointer min-h-[64px] ${
                        filledWord
                          ? 'bg-accent/10 border-accent text-accent font-semibold shadow-sm'
                          : 'bg-surface-2 border-dashed border-border text-text-muted'
                      }`}
                    >
                      <span className="text-[10px] uppercase tracking-wider font-bold opacity-75 mb-0.5">
                        Word #{pos + 1}
                      </span>
                      <span className="text-xs font-mono font-bold">
                        {filledWord || '—'}
                      </span>
                    </div>
                  )
                })}
              </div>

              {/* Word Chips Bank */}
              <div>
                <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-3">
                  Select matching words:
                </p>
                <div className="flex flex-wrap gap-2">
                  {candidateChips.map(word => {
                    const isSelected = selectedAnswers.includes(word)
                    return (
                      <button
                        key={word}
                        disabled={isSelected}
                        onClick={() => handleChipClick(word)}
                        className={`px-4 py-2 rounded-xl text-xs font-mono transition-all ${
                          isSelected
                            ? 'bg-surface-2/40 border border-border/40 text-text-muted/40 cursor-not-allowed'
                            : 'bg-surface-2 border border-border text-text hover:border-accent hover:text-accent font-medium active:scale-95'
                        }`}
                      >
                        {word}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Verify & Finish Button */}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setSelectedAnswers([])}
                  disabled={selectedAnswers.length === 0}
                  className="px-4 py-3 bg-surface-2 text-text-secondary hover:text-text font-medium text-xs rounded-xl transition-colors disabled:opacity-40"
                >
                  Clear
                </button>
                <button
                  onClick={handleVerifyQuiz}
                  disabled={selectedAnswers.length !== 3}
                  className="flex-1 py-3 bg-accent text-bg font-semibold text-sm rounded-xl hover:bg-accent-dim transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  Verify & Protect Account
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 3: Confirmed & Protected ──────────────────────────── */}
          {step === 'success' && (
            <div className="text-center py-4 space-y-4 animate-in zoom-in-95 duration-200">
              <div className="w-16 h-16 rounded-full bg-success/15 border border-success/30 text-success flex items-center justify-center mx-auto">
                <ShieldCheck size={36} />
              </div>
              <div>
                <h3 className="text-lg font-display font-bold text-text">
                  Account Fully Protected
                </h3>
                <p className="text-xs text-text-secondary mt-2 max-w-sm mx-auto leading-relaxed">
                  Your Master Recovery Key is verified. You can now reset your password at any time without needing email confirmation.
                </p>
              </div>
              <button
                onClick={() => onOpenChange(false)}
                className="w-full py-3 bg-success text-bg font-semibold text-sm rounded-xl hover:bg-success/90 transition-colors shadow-sm mt-4"
              >
                Done
              </button>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
