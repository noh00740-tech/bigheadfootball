let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioCtx;
}

/**
 * 1. playHoverSound: 메뉴 카드나 선수 카드 위에 마우스를 올렸을 때 나는 아주 짧고 가벼운 핍(Pip) 소리
 */
export function playHoverSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1000, now); // 맑은 고음

    gainNode.gain.setValueAtTime(0.04, now); // 아주 가벼운 크기
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.start(now);
    osc.stop(now + 0.05);
  } catch (e) {
    console.warn("Hover sound failed:", e);
  }
}

/**
 * 2. playClickSound: 일반 버튼을 누르거나 팝업을 닫을 때 나는 청량한 틱(Tick) 소리
 */
export function playClickSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(600, now + 0.06);

    gainNode.gain.setValueAtTime(0.08, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    osc.start(now);
    osc.stop(now + 0.06);
  } catch (e) {
    console.warn("Click sound failed:", e);
  }
}

/**
 * 3. playSelectSound: 포지션별 선수를 클릭해 스쿼드 슬롯에 최종 장착할 때 나는 쫀득한 기계음
 */
export function playSelectSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const now = ctx.currentTime;
    
    // 쫀득함을 주기 위해 듀얼 하모닉 주파수로 오실레이터 2개 중첩
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(280, now);
    osc1.frequency.setValueAtTime(440, now + 0.04);
    osc1.frequency.exponentialRampToValueAtTime(880, now + 0.12);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(420, now);
    osc2.frequency.setValueAtTime(660, now + 0.04);
    osc2.frequency.exponentialRampToValueAtTime(1320, now + 0.12);

    gainNode.gain.setValueAtTime(0.1, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc1.start(now);
    osc1.stop(now + 0.12);
    osc2.start(now);
    osc2.stop(now + 0.12);
  } catch (e) {
    console.warn("Select sound failed:", e);
  }
}

/**
 * 4. playAnalyzeStartSound: 'AI 전술 분석 받기'를 누르는 순간 우웅~ 하며 주파수가 올라가는 SF 레이저 스캔 시작음
 */
export function playAnalyzeStartSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.type = 'sawtooth'; // 레이저 효과를 위한 톱니파
    osc.frequency.setValueAtTime(100, now);
    osc.frequency.linearRampToValueAtTime(750, now + 0.65); // 0.65초 동안 주파수 상승

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(250, now);
    filter.frequency.linearRampToValueAtTime(1200, now + 0.65);

    // 볼륨 페이드 인/아웃 처리로 부드럽게
    gainNode.gain.setValueAtTime(0.01, now);
    gainNode.gain.linearRampToValueAtTime(0.12, now + 0.12);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

    osc.start(now);
    osc.stop(now + 0.65);
  } catch (e) {
    console.warn("AnalyzeStart sound failed:", e);
  }
}

/**
 * 5. playAnalyzeSuccessSound: 제미나이 AI 분석 결과가 화면에 나타날 때 울리는 레트로 딩동댕 팡파르 알림음
 */
export function playAnalyzeSuccessSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const now = ctx.currentTime;
    // C 코드 메이저 코드 톤 (C5, E5, G5, C6) 순차 재생
    const notes = [523.25, 659.25, 783.99, 1046.50];
    const duration = 0.09; // 각 음 간격
    const decay = 0.28;

    notes.forEach((freq, index) => {
      const startTime = now + index * duration;
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      gainNode.gain.setValueAtTime(0.05, startTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + decay);

      osc.start(startTime);
      osc.stop(startTime + decay);
    });
  } catch (e) {
    console.warn("AnalyzeSuccess sound failed:", e);
  }
}
