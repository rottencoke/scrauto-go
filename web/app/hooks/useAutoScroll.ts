import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
  type UIEvent,
  type WheelEvent,
} from "react";

export const SCROLL_SPEED_MIN = 0.5;
export const SCROLL_SPEED_MAX = 50;
export const SCROLL_SPEED_STEP = 0.5;

/** ホイール／手動スクロールが止まったとみなすまでの待機時間 */
const USER_SCROLL_RESUME_MS = 100;

/** タップとドラッグを区別する移動量しきい値 */
const TAP_MOVE_THRESHOLD_PX = 8;

export function clampScrollSpeed(speed: number): number {
  return Math.min(SCROLL_SPEED_MAX, Math.max(SCROLL_SPEED_MIN, speed));
}

type UseAutoScrollOptions = {
  /** false のときタップでの開始/停止を無効化（ファイル未読込など） */
  enabled?: boolean;
  initialSpeed?: number;
};

export function useAutoScroll(options: UseAutoScrollOptions = {}) {
  const { enabled = true, initialSpeed = 40 } = options;

  const scrollerRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeedState] = useState(clampScrollSpeed(initialSpeed));

  const playingRef = useRef(false);
  const speedRef = useRef(speed);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  const positionRef = useRef(0);
  /** 自動スクロールによる scrollTop 書き換え中（手動操作と区別する） */
  const programmaticScrollRef = useRef(false);
  /** 手動スクロール中は自動進行を一時停止（playing 自体は維持） */
  const userScrollPauseRef = useRef(false);
  const resumeTimerRef = useRef<number | null>(null);
  /** タップとドラッグを区別するための pointerdown 位置 */
  const pointerDownRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  const setSpeed = useCallback((value: number) => {
    setSpeedState(clampScrollSpeed(value));
  }, []);

  const clearResumeTimer = useCallback(() => {
    if (resumeTimerRef.current != null) {
      clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = null;
    }
  }, []);

  const stopPlayback = useCallback(() => {
    playingRef.current = false;
    setPlaying(false);
    lastTsRef.current = null;
    userScrollPauseRef.current = false;
    clearResumeTimer();
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    const el = scrollerRef.current;
    if (el) {
      positionRef.current = el.scrollTop;
    }
  }, [clearResumeTimer]);

  /**
   * 再生中の手動スクロール: 自動進行だけ止め、操作が落ち着いたら
   * その位置から再開する（playing は true のまま）
   */
  const pauseForUserScroll = useCallback(() => {
    if (!playingRef.current) return;

    userScrollPauseRef.current = true;
    lastTsRef.current = null;
    const el = scrollerRef.current;
    if (el) {
      positionRef.current = el.scrollTop;
    }

    clearResumeTimer();
    resumeTimerRef.current = window.setTimeout(() => {
      resumeTimerRef.current = null;
      if (!playingRef.current) return;
      const current = scrollerRef.current;
      if (current) {
        positionRef.current = current.scrollTop;
      }
      userScrollPauseRef.current = false;
      lastTsRef.current = null;
    }, USER_SCROLL_RESUME_MS);
  }, [clearResumeTimer]);

  const tick = useCallback(
    (ts: number) => {
      if (!playingRef.current) {
        lastTsRef.current = null;
        rafRef.current = null;
        return;
      }
      const el = scrollerRef.current;
      if (!el) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      // ホイール等の手動操作中は位置だけ同期し、上書きしない
      if (userScrollPauseRef.current) {
        positionRef.current = el.scrollTop;
        lastTsRef.current = null;
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      if (lastTsRef.current == null) {
        lastTsRef.current = ts;
        positionRef.current = el.scrollTop;
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const dt = Math.min(Math.max((ts - lastTsRef.current) / 1000, 0), 0.05);
      lastTsRef.current = ts;

      const max = Math.max(0, el.scrollHeight - el.clientHeight);
      if (max <= 1) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      // scrollTop は整数丸めされるため、実位置は float で積算する
      positionRef.current = Math.min(positionRef.current + speedRef.current * dt, max);
      programmaticScrollRef.current = true;
      el.scrollTop = positionRef.current;
      requestAnimationFrame(() => {
        programmaticScrollRef.current = false;
      });

      if (positionRef.current >= max - 0.5) {
        stopPlayback();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    },
    [stopPlayback],
  );

  useEffect(() => {
    if (!playing) {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      lastTsRef.current = null;
      userScrollPauseRef.current = false;
      clearResumeTimer();
      return;
    }
    const el = scrollerRef.current;
    if (el) {
      positionRef.current = el.scrollTop;
    }
    const frameId = requestAnimationFrame(tick);
    rafRef.current = frameId;
    return () => {
      cancelAnimationFrame(frameId);
      if (rafRef.current === frameId) {
        rafRef.current = null;
      }
    };
  }, [playing, tick, clearResumeTimer]);

  useEffect(() => () => clearResumeTimer(), [clearResumeTimer]);

  /** ホイール: 一時停止し、連続入力が止まったら再開 */
  const onWheel = useCallback(
    (_e: WheelEvent<HTMLDivElement>) => {
      if (playingRef.current) {
        pauseForUserScroll();
      }
    },
    [pauseForUserScroll],
  );

  const onScroll = useCallback(
    (_e: UIEvent<HTMLDivElement>) => {
      const el = scrollerRef.current;
      if (!el) return;

      // スクロールバー操作など（自動スクロール由来でなければ手動）
      if (playingRef.current && !programmaticScrollRef.current) {
        pauseForUserScroll();
        return;
      }

      if (!playingRef.current || userScrollPauseRef.current) {
        positionRef.current = el.scrollTop;
      }
    },
    [pauseForUserScroll],
  );

  const onPointerDown = useCallback((e: PointerEvent<HTMLDivElement>) => {
    pointerDownRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  /** 表示エリアのタップで開始/停止 */
  const onClick = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if (!enabled) return;
      const down = pointerDownRef.current;
      pointerDownRef.current = null;
      if (down) {
        const dx = Math.abs(e.clientX - down.x);
        const dy = Math.abs(e.clientY - down.y);
        if (dx > TAP_MOVE_THRESHOLD_PX || dy > TAP_MOVE_THRESHOLD_PX) return;
      }
      setPlaying((p) => !p);
    },
    [enabled],
  );

  const togglePlaying = useCallback(() => {
    if (!enabled) return;
    setPlaying((p) => !p);
  }, [enabled]);

  return {
    scrollerRef,
    playing,
    setPlaying,
    togglePlaying,
    speed,
    setSpeed,
    scrollerProps: {
      ref: scrollerRef,
      onScroll,
      onWheel,
      onPointerDown,
      onClick,
    },
  };
}
