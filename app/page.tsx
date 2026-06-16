'use client';

import React, { useState, useEffect, useRef } from 'react';

interface SessionRecord {
  date: string;
  rounds: number;
  bestHold: number;
  totalHoldTime: number;
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
    ).slice(0, 20);
    setSessionRecords(updated);
    localStorage.setItem('wimhofRecords', JSON.stringify(updated));
    
    if (newRecord.bestHold > bestHoldEver) {
      setBestHoldEver(newRecord.bestHold);
    }
  };

  const startBreathing = () => {
    setPhase('breathing');
    setBreathCount(0);
    setCurrentRound(prev => prev + 1);

    let count = 0;
    breathIntervalRef.current = setInterval(() => {
      count++;
      setBreathCount(count);
      
      if (count >= breathsPerRound) {
        if (breathIntervalRef.current) clearInterval(breathIntervalRef.current);
        startHold();
      }
    }, 2000);
  };

  const startHold = () => {
    setPhase('hold');
    setHoldTime(0);
    setIsHolding(true);

    holdIntervalRef.current = setInterval(() => {
      setHoldTime(prev => prev + 1);
    }, 1000);
  };

  const endHold = () => {
    if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
    setIsHolding(false);
    
    setPhase('recovery');
    setRecoveryTimer(recoveryTime);
    
    recoveryIntervalRef.current = setInterval(() => {
      setRecoveryTimer(prev => {
        const newTime = prev - 1;
        if (newTime <= 0) {
          if (recoveryIntervalRef.current) clearInterval(recoveryIntervalRef.current);
          finishRound();
          return 0;
        }
        return newTime;
      });
    }, 1000);
  };

  const finishRound = () => {
    if (currentRound < rounds) {
      setTimeout(() => startBreathing(), 1000);
    } else {
      const newRecord: SessionRecord = {
        date: new Date().toISOString(),
        rounds: currentRound,
        bestHold: holdTime,
        totalHoldTime: holdTime * currentRound,
      };
      saveRecord(newRecord);
      setPhase('idle');
      setCurrentRound(0);
      alert(`¡Sesión completada! Mejor retención: ${holdTime} segundos. ¡Excelente trabajo!`);
    }
  };

  const resetSession = () => {
    [breathIntervalRef, holdIntervalRef, recoveryIntervalRef].forEach(ref => {
      if (ref.current) clearInterval(ref.current);
    });
    setPhase('idle');
    setCurrentRound(0);
    setBreathCount(0);
    setHoldTime(0);
    setRecoveryTimer(0);
    setIsHolding(false);
  };

  const startSession = () => {
    resetSession();
    startBreathing();
  };

  useEffect(() => {
    return () => {
      [breathIntervalRef, holdIntervalRef, recoveryIntervalRef].forEach(ref => {
        if (ref.current) clearInterval(ref.current);
      });
    };
  }, []);

  const [circleScale, setCircleScale] = useState(1);
  useEffect(() => {
    if (phase === 'breathing') {
      const anim = setInterval(() => setCircleScale(prev => prev === 1 ? 1.5 : 1), 1000);
      return () => clearInterval(anim);
    } else {
      setCircleScale(1);
    }
  }, [phase]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-slate-900 to-black text-white flex flex-col">
      <div className="max-w-2xl mx-auto w-full p-6 flex-1 flex flex-col">
        <div className="text-center mb-8 pt-8">
          <h1 className="text-5xl font-bold tracking-tighter mb-2 text-orange-400">WIM HOF</h1>
          <p className="text-xl text-zinc-400">Método de Respiración</p>
          <p className="text-sm text-zinc-500 mt-1">30 respiraciones • Retención • Recuperación</p>
        </div>

        <div className="flex justify-between mb-8 text-sm">
          <div>Mejor retención: <span className="text-orange-400 font-mono">{bestHoldEver}s</span></div>
          <div>Rondas: {rounds}</div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center">
          {phase === 'idle' && (
            <div className="text-center">
              <div className="w-48 h-48 mx-auto mb-8 rounded-full border-8 border-orange-500/30 flex items-center justify-center">
                <div className="text-6xl">🫁</div>
              </div>
              <button onClick={startSession} className="px-12 py-6 bg-orange-500 hover:bg-orange-600 text-black font-semibold text-2xl rounded-2xl transition-all active:scale-95">
                INICIAR SESIÓN
              </button>
            </div>
          )}

          {phase === 'breathing' && (
            <div className="text-center">
              <div className="mb-8">
                <div className="text-6xl font-mono mb-2 text-orange-400">Ronda {currentRound}</div>
                <div className="text-8xl font-bold mb-4">{breathCount} / {breathsPerRound}</div>
                <p className="text-xl text-zinc-400">Respiraciones profundas</p>
              </div>
              <div className="w-64 h-64 mx-auto rounded-full border-8 border-orange-500 flex items-center justify-center transition-all duration-1000" style={{ transform: `scale(${circleScale})` }}>
                <div className="text-7xl">🌬️</div>
              </div>
            </div>
          )}

          {phase === 'hold' && (
            <div className="text-center">
              <div className="mb-8">
                <div className="text-6xl font-mono mb-2 text-orange-400">RETENCIÓN</div>
                <div className="text-[10rem] font-bold leading-none text-white font-mono tracking-tighter">{holdTime}</div>
                <p className="text-2xl text-zinc-400 -mt-4">segundos</p>
              </div>
              <button onClick={endHold} className="px-16 py-6 bg-red-600 hover:bg-red-700 text-white font-bold text-xl rounded-2xl transition-all active:scale-95">
                TERMINAR RETENCIÓN
              </button>
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
            </div>
          )}
        </div>

        <div className="mt-auto pt-8 border-t border-zinc-800">
          <div className="grid grid-cols-3 gap-4 text-sm mb-6">
            <div>
              <label className="block text-zinc-400 mb-1">Rondas</label>
              <input type="number" value={rounds} onChange={(e) => setRounds(Math.max(1, parseInt(e.target.value) || 1))} className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-center text-2xl font-mono" />
            </div>
            <div>
              <label className="block text-zinc-400 mb-1">Respiraciones</label>
              <input type="number" value={breathsPerRound} onChange={(e) => setBreathsPerRound(Math.max(10, parseInt(e.target.value) || 30))} className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-center text-2xl font-mono" />
            </div>
            <div>
              <label className="block text-zinc-400 mb-1">Recuperación (s)</label>
              <input type="number" value={recoveryTime} onChange={(e) => setRecoveryTime(Math.max(5, parseInt(e.target.value) || 15))} className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-center text-2xl font-mono" />
            </div>
          </div>

          {phase !== 'idle' && <button onClick={resetSession} className="w-full py-4 bg-zinc-800 hover:bg-red-900/50 text-zinc-400 hover:text-white rounded-2xl transition-colors">Reiniciar Sesión</button>}
        </div>

        {sessionRecords.length > 0 && (
          <div className="mt-8">
            <h3 className="text-lg font-semibold mb-3 text-orange-400">Historial Reciente</h3>
            <div className="space-y-2 max-h-64 overflow-auto pr-2 text-sm">
              {sessionRecords.slice(0, 5).map((record, idx) => (
                <div key={idx} className="flex justify-between bg-zinc-900/50 p-3 rounded-xl border border-zinc-800">
                  <div>{new Date(record.date).toLocaleDateString('es-CO')}</div>
                  <div className="font-mono">{record.bestHold}s • {record.rounds} rondas</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <audio ref={audioRef} src="https://freesound.org/data/previews/66/66930_931655-lq.mp3" />
    </div>
  );
};

export default WimHofTimer;