'use client';

import React, { useState, useEffect, useRef } from 'react';

interface HoldRecord {
  round: number;
  holdTime: number;
}

interface SessionRecord {
  date: string;
  rounds: number;
  bestHold: number;
  totalHoldTime: number;
  holds: HoldRecord[];
}

const WimHofTimer: React.FC = () => {
  const [rounds, setRounds] = useState(3);
  const [breathsPerRound, setBreathsPerRound] = useState(30);
  const [recoveryTime, setRecoveryTime] = useState(15);
  const [currentRound, setCurrentRound] = useState(0);
  const [phase, setPhase] = useState<'idle' | 'breathing' | 'hold' | 'recovery'>('idle');
  const [breathCount, setBreathCount] = useState(0);
  const [holdTime, setHoldTime] = useState(0);
  const [recoveryTimer, setRecoveryTimer] = useState(0);
  const [isHolding, setIsHolding] = useState(false);
  const [isInhaling, setIsInhaling] = useState(false);
  const [holdsPerSession, setHoldsPerSession] = useState<HoldRecord[]>([]);
  const [sessionRecords, setSessionRecords] = useState<SessionRecord[]>([]);
  const [bestHoldEver, setBestHoldEver] = useState(0);

  const breathIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const holdIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const recoveryIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Load records from localStorage
  useEffect(() => {
    const savedRecords = localStorage.getItem('wimhofRecords');
    if (savedRecords) {
      const records: SessionRecord[] = JSON.parse(savedRecords);
      setSessionRecords(records);
      
      const best = Math.max(0, ...records.map(r => r.bestHold));
      setBestHoldEver(best);
    }
  }, []);

  // Save records
  const saveRecord = (newRecord: SessionRecord) => {
    const updated = [...sessionRecords, newRecord].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    ).slice(0, 20); // Keep last 20
    setSessionRecords(updated);
    localStorage.setItem('wimhofRecords', JSON.stringify(updated));
    
    if (newRecord.bestHold > bestHoldEver) {
      setBestHoldEver(newRecord.bestHold);
    }
  };

  // Breathing phase: count breaths with inhale/exhale animation
  const startBreathing = () => {
    setPhase('breathing');
    setBreathCount(0);
    setCurrentRound(prev => prev + 1);
    setIsInhaling(true);

    let count = 0;
    let isInhalePhase = true;

    breathIntervalRef.current = setInterval(() => {
      if (isInhalePhase) {
        // Inhale phase
        count++;
        setBreathCount(count);
        setIsInhaling(true);
        
        // Audio cue
        if (audioRef.current) {
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch(() => {});
        }
      } else {
        // Exhale phase
        setIsInhaling(false);
      }

      isInhalePhase = !isInhalePhase;

      if (count >= breathsPerRound && !isInhalePhase) {
        if (breathIntervalRef.current) clearInterval(breathIntervalRef.current);
        startHold();
      }
    }, 1500); // ~1.5s inhale + 1.5s exhale = 3s per full breath
  };

  const startHold = () => {
    setPhase('hold');
    setHoldTime(0);
    setIsHolding(true);
    setHoldsPerSession(prev => [...prev, { round: currentRound, holdTime: 0 }]);

    // Precise stopwatch using Date.now() - NO predefined timer
    const startTime = Date.now();
    holdIntervalRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setHoldTime(elapsed);

      // Live update the current hold
      setHoldsPerSession(prevHolds => {
        const updated = [...prevHolds];
        if (updated.length > 0) {
          updated[updated.length - 1].holdTime = elapsed;
        }
        return updated;
      });
    }, 100); // Even smoother updates
  };

  const endHold = () => {
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
    }
    setIsHolding(false);
    
    // Save current hold time (user stopped because couldn't hold anymore)
    const finalHoldTime = holdTime;
    
    // Transition to recovery
    setPhase('recovery');
    setRecoveryTimer(recoveryTime);
    
    recoveryIntervalRef.current = setInterval(() => {
      setRecoveryTimer(prev => {
        const newTime = prev - 1;
        if (newTime <= 0) {
          if (recoveryIntervalRef.current) clearInterval(recoveryIntervalRef.current);
          finishRound(finalHoldTime);
          return 0;
        }
        return newTime;
      });
    }, 1000);
  };

  const finishRound = (lastHoldTime?: number) => {
    const finalHolds = [...holdsPerSession];
    
    if (currentRound < rounds) {
      // Start next round
      setTimeout(() => {
        startBreathing();
      }, 1000);
    } else {
      // Session complete
      const sessionBest = Math.max(...finalHolds.map(h => h.holdTime), 0);
      const totalHold = finalHolds.reduce((sum, h) => sum + h.holdTime, 0);
      
      const newRecord: SessionRecord = {
        date: new Date().toISOString(),
        rounds: currentRound,
        bestHold: sessionBest,
        totalHoldTime: totalHold,
        holds: finalHolds,
      };
      
      saveRecord(newRecord);
      setPhase('idle');
      setCurrentRound(0);
      setHoldsPerSession([]);
      alert(`¡Sesión completada! Mejor retención: ${sessionBest} segundos. Total: ${totalHold}s. ¡Excelente!`);
    }
  };

  const resetSession = () => {
    if (breathIntervalRef.current) clearInterval(breathIntervalRef.current);
    if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
    if (recoveryIntervalRef.current) clearInterval(recoveryIntervalRef.current);
    
    setPhase('idle');
    setCurrentRound(0);
    setBreathCount(0);
    setHoldTime(0);
    setRecoveryTimer(0);
    setIsHolding(false);
    setIsInhaling(false);
    setHoldsPerSession([]);
  };

  const startSession = () => {
    resetSession();
    setCurrentRound(0);
    setHoldsPerSession([]);
    startBreathing();
  };

  // Cleanup intervals
  useEffect(() => {
    return () => {
      if (breathIntervalRef.current) clearInterval(breathIntervalRef.current);
      if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
      if (recoveryIntervalRef.current) clearInterval(recoveryIntervalRef.current);
    };
  }, []);

  // Visual breathing circle for breathing phase - inhale/exhale
  const [circleScale, setCircleScale] = useState(1);
  useEffect(() => {
    if (phase === 'breathing') {
      const anim = setInterval(() => {
        setCircleScale(prev => (isInhaling ? 1.6 : 0.85));
      }, 100);
      return () => clearInterval(anim);
    } else {
      setCircleScale(1);
    }
  }, [phase, isInhaling]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-slate-900 to-black text-white flex flex-col">
      <div className="max-w-2xl mx-auto w-full p-6 flex-1 flex flex-col">
        {/* Header */}
        <div className="text-center mb-8 pt-8">
          <h1 className="text-5xl font-bold tracking-tighter mb-2 text-orange-400">WIM HOF</h1>
          <p className="text-xl text-zinc-400">Método de Respiración</p>
          <p className="text-sm text-zinc-500 mt-1">30 respiraciones • Retención • Recuperación</p>
        </div>

        {/* Stats */}
        <div className="flex justify-between mb-8 text-sm">
          <div>Mejor retención: <span className="text-orange-400 font-mono">{bestHoldEver}s</span></div>
          <div>Rondas: {rounds}</div>
        </div>

        {/* Main Timer Display */}
        <div className="flex-1 flex flex-col items-center justify-center">
          {phase === 'idle' && (
            <div className="text-center">
              <div className="w-48 h-48 mx-auto mb-8 rounded-full border-8 border-orange-500/30 flex items-center justify-center">
                <div className="text-6xl">🫁</div>
              </div>
              <button
                onClick={startSession}
                className="px-12 py-6 bg-orange-500 hover:bg-orange-600 text-black font-semibold text-2xl rounded-2xl transition-all active:scale-95"
              >
                INICIAR SESIÓN
              </button>
              <p className="mt-6 text-zinc-400">Prepárate para poder interior</p>
            </div>
          )}

          {phase === 'breathing' && (
            <div className="text-center">
              <div className="mb-8">
                <div className="text-6xl font-mono mb-2 text-orange-400">Ronda {currentRound}</div>
                <div className="text-8xl font-bold mb-4">{breathCount} / {breathsPerRound}</div>
                <p className="text-xl text-zinc-400">
                  {isInhaling ? 'INHALA profundamente' : 'EXHALA completamente'}
                </p>
              </div>
              
              <div 
                className="w-64 h-64 mx-auto rounded-full border-8 border-orange-500 flex items-center justify-center transition-all duration-700 ease-in-out"
                style={{ 
                  transform: `scale(${circleScale})`,
                  backgroundColor: isInhaling ? 'rgba(249, 115, 22, 0.1)' : 'transparent'
                }}
              >
                <div className="text-7xl transition-all duration-700" style={{ transform: isInhaling ? 'scale(1.1)' : 'scale(0.9)' }}>
                  {isInhaling ? '🌬️' : '💨'}
                </div>
              </div>
              
              <button
                onClick={() => {
                  if (breathIntervalRef.current) clearInterval(breathIntervalRef.current);
                  startHold();
                }}
                className="mt-8 px-8 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-sm"
              >
                Saltar a retención
              </button>
            </div>
          )}

          {phase === 'hold' && (
            <div className="text-center">
              <div className="mb-8">
                <div className="text-6xl font-mono mb-2 text-orange-400">RETENCIÓN</div>
                <div className="text-[12rem] font-bold leading-none text-white font-mono tracking-[-0.05em] tabular-nums">{holdTime}</div>
                <p className="text-3xl text-orange-400 -mt-6 font-light">segundos</p>
                <p className="text-xl text-zinc-400 mt-2">Mantén lo más que puedas</p>
              </div>
              <button
                onClick={endHold}
                className="px-16 py-6 bg-red-600 hover:bg-red-700 text-white font-bold text-xl rounded-2xl transition-all active:scale-95 shadow-lg shadow-red-900/50"
              >
                NO AGUANTO MÁS<br />RESPIRAR
              </button>
              <p className="mt-8 text-zinc-500 text-sm max-w-xs mx-auto">Presiona cuando necesites aire. El tiempo se guarda automáticamente.</p>
            </div>
          )}

          {phase === 'recovery' && (
            <div className="text-center">
              <div className="mb-8">
                <div className="text-5xl mb-4">🌬️</div>
                <div className="text-7xl font-mono mb-2">Recuperación</div>
                <div className="text-8xl font-bold text-emerald-400">{recoveryTimer}</div>
                <p className="text-xl text-zinc-400">segundos</p>
              </div>
              <p className="max-w-xs mx-auto text-zinc-400">Inhala profundamente y mantén 15s. Relájate.</p>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="mt-auto pt-8 border-t border-zinc-800">
          <div className="grid grid-cols-3 gap-4 text-sm mb-6">
            <div>
              <label className="block text-zinc-400 mb-1">Rondas</label>
              <input
                type="number"
                value={rounds}
                onChange={(e) => setRounds(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-center text-2xl font-mono"
              />
            </div>
            <div>
              <label className="block text-zinc-400 mb-1">Respiraciones</label>
              <input
                type="number"
                value={breathsPerRound}
                onChange={(e) => setBreathsPerRound(Math.max(10, parseInt(e.target.value) || 30))}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-center text-2xl font-mono"
              />
            </div>
            <div>
              <label className="block text-zinc-400 mb-1">Recuperación (s)</label>
              <input
                type="number"
                value={recoveryTime}
                onChange={(e) => setRecoveryTime(Math.max(5, parseInt(e.target.value) || 15))}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-center text-2xl font-mono"
              />
            </div>
          </div>

          {phase !== 'idle' && (
            <button
              onClick={resetSession}
              className="w-full py-4 bg-zinc-800 hover:bg-red-900/50 text-zinc-400 hover:text-white rounded-2xl transition-colors"
            >
              Reiniciar Sesión
            </button>
          )}
        </div>

        {/* Records */}
        {sessionRecords.length > 0 && (
          <div className="mt-8">
            <h3 className="text-lg font-semibold mb-3 text-orange-400">Historial Reciente</h3>
            <div className="space-y-2 max-h-64 overflow-auto pr-2 text-sm">
              {sessionRecords.slice(0, 5).map((record, idx) => (
                <div key={idx} className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-800">
                  <div className="flex justify-between mb-2">
                    <div className="font-medium">{new Date(record.date).toLocaleDateString('es-CO')}</div>
                    <div className="font-mono text-orange-400">{record.bestHold}s mejor</div>
                  </div>
                  <div className="text-xs text-zinc-500">Rondas: {record.rounds} | Total: {record.totalHoldTime}s</div>
                  {record.holds && record.holds.length > 0 && (
                    <div className="mt-2 text-[10px] text-zinc-400 font-mono">
                      Holds: {record.holds.map(h => h.holdTime).join('s, ')}s
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Hidden audio for cues */}
      <audio ref={audioRef} src="https://freesound.org/data/previews/66/66930_931655-lq.mp3" /> {/* Placeholder sound */}
    </div>
  );
};

export default WimHofTimer;
