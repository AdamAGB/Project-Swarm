import { useState, useEffect, useRef, useCallback } from 'react';
import type { VoteResult } from '../types';

interface AnimatedVotingState {
  visibleVoteCount: number;
  rollingCounts: Record<string, number>;
  isAnimating: boolean;
}

export function useAnimatedVoting(
  votes: VoteResult[] | null,
  options: string[],
  shouldAnimate: boolean,
  duration: number = 2500,
): AnimatedVotingState & { startAnimation: () => Promise<void> } {
  const [state, setState] = useState<AnimatedVotingState>({
    visibleVoteCount: 0,
    rollingCounts: {},
    isAnimating: false,
  });

  const resolveRef = useRef<(() => void) | null>(null);

  const startAnimation = useCallback((): Promise<void> => {
    if (!votes || votes.length === 0) return Promise.resolve();

    return new Promise((resolve) => {
      resolveRef.current = resolve;

      const totalVotes = votes.length;
      const startTime = performance.now();

      // Initialize rolling counts
      const initialCounts: Record<string, number> = {};
      for (const opt of options) initialCounts[opt] = 0;

      setState({ visibleVoteCount: 0, rollingCounts: initialCounts, isAnimating: true });

      function animate(now: number) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Easing: fast start, slower middle, fast finish
        const eased = progress < 0.3
          ? progress * 2
          : progress < 0.7
            ? 0.6 + (progress - 0.3) * 0.5
            : 0.8 + (progress - 0.7) * (0.2 / 0.3);

        const clampedEased = Math.min(eased, 1);
        const currentCount = Math.floor(clampedEased * totalVotes);

        // Count votes up to currentCount
        const counts: Record<string, number> = {};
        for (const opt of options) counts[opt] = 0;
        for (let i = 0; i < currentCount; i++) {
          const vote = votes[i];
          for (const opt of vote.selectedOptions) {
            counts[opt] = (counts[opt] || 0) + 1;
          }
        }

        setState({
          visibleVoteCount: currentCount,
          rollingCounts: counts,
          isAnimating: progress < 1,
        });

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          resolveRef.current?.();
          resolveRef.current = null;
        }
      }

      requestAnimationFrame(animate);
    });
  }, [votes, options, duration]);

  // Reset when votes change
  useEffect(() => {
    if (!shouldAnimate) {
      setState({ visibleVoteCount: 0, rollingCounts: {}, isAnimating: false });
    }
  }, [shouldAnimate]);

  return { ...state, startAnimation };
}
