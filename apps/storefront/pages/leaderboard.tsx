// apps/storefront/pages/leaderboard.tsx
import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";

interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  totalPoints: number;
  commitCount: number;
}

// Confetti particle effect
function Confetti({ x, y, onComplete }: { x: number; y: number; onComplete: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      life: number;
      color: string;
      size: number;
    }> = [];

    // Create confetti particles
    const colors = ["#7c6aff", "#60a5fa", "#3ddc97", "#f5a623", "#ff5c5c"];
    for (let i = 0; i < 50; i++) {
      particles.push({
        x: x || window.innerWidth / 2,
        y: y || window.innerHeight / 2,
        vx: (Math.random() - 0.5) * 12,
        vy: Math.random() * -10 - 5,
        life: 1,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 8 + 4,
      });
    }

    let animationId: number;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.2; // gravity
        p.life -= 0.015;

        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      });

      if (particles.some((p) => p.life > 0)) {
        animationId = requestAnimationFrame(animate);
      } else {
        onComplete();
      }
    };

    animationId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [x, y, onComplete]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        pointerEvents: "none",
        zIndex: 9999,
      }}
    />
  );
}

// Glow effect for rank change
function RankChangeGlow({ rankEntry }: { rankEntry: LeaderboardEntry }) {
  const [showGlow, setShowGlow] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowGlow(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  if (!showGlow) return null;

  return (
    <div
      style={{
        position: "absolute",
        inset: "-4px",
        background: "radial-gradient(circle, rgba(124,106,255,0.4) 0%, transparent 70%)",
        borderRadius: 12,
        pointerEvents: "none",
        animation: "pulse-glow 1.5s ease-out",
      }}
    />
  );
}

// Play celebration sound
function playCelebrationSound() {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

  // Create a simple celebration beep sequence
  const now = audioContext.currentTime;
  const notes = [800, 1000, 1200]; // Hz
  const duration = 0.15;

  notes.forEach((freq, i) => {
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();

    osc.connect(gain);
    gain.connect(audioContext.destination);

    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.3, now + i * duration);
    gain.gain.exponentialRampToValueAtTime(0.01, now + (i + 1) * duration);

    osc.start(now + i * duration);
    osc.stop(now + (i + 1) * duration);
  });
}

async function fetchLeaderboard(limit = 20) {
  try {
    const res = await fetch(`/api/leaderboard?limit=${limit}`);
    if (res.ok) {
      const data = await res.json();
      return data.data || [];
    }
  } catch {
    console.error("Failed to fetch leaderboard");
  }
  return [];
}

export default function LeaderboardPage() {
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: () => fetchLeaderboard(20),
    refetchInterval: 10000,
  });

  const [prevEntries, setPrevEntries] = useState<LeaderboardEntry[]>([]);
  const [celebratingRank, setCelebratingRank] = useState<number | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const celebrationTimeoutRef = useRef<NodeJS.Timeout>();

  // Detect rank changes and trigger celebrations
  useEffect(() => {
    if (entries.length === 0 || prevEntries.length === 0) {
      setPrevEntries(entries);
      return;
    }

    // Check for significant rank changes (moves up in ranking)
    entries.forEach((entry) => {
      const prevEntry = prevEntries.find((e) => e.userId === entry.userId);
      if (prevEntry && prevEntry.rank > entry.rank) {
        // User moved up in ranks!
        setCelebratingRank(entry.rank);
        setShowConfetti(true);
        playCelebrationSound();

        // Clear celebration state after animation
        if (celebrationTimeoutRef.current) {
          clearTimeout(celebrationTimeoutRef.current);
        }
        celebrationTimeoutRef.current = setTimeout(() => {
          setCelebratingRank(null);
        }, 2000);
      }
    });

    setPrevEntries(entries);
  }, [entries, prevEntries]);

  return (
    <div style={s.page}>
      {showConfetti && (
        <Confetti
          x={window.innerWidth / 2}
          y={window.innerHeight / 3}
          onComplete={() => setShowConfetti(false)}
        />
      )}

      <div style={s.header}>
        <h1 style={s.title}>Leaderboard</h1>
        <p style={s.subtitle}>Top contributors by commit points</p>
      </div>

      {isLoading ? (
        <div style={s.loading}>Loading leaderboard…</div>
      ) : entries.length === 0 ? (
        <div style={s.empty}>
          <div style={s.emptyIcon}>◈</div>
          <p>No leaderboard data yet. Start committing!</p>
        </div>
      ) : (
        <div style={s.container}>
          <div style={s.tableWrapper}>
            <table style={s.table}>
              <thead>
                <tr style={s.headerRow}>
                  <th style={{ ...s.th, width: "60px" }}>Rank</th>
                  <th style={s.th}>Username</th>
                  <th style={{ ...s.th, textAlign: "right", width: "140px" }}>
                    Points
                  </th>
                  <th style={{ ...s.th, textAlign: "right", width: "120px" }}>
                    Commits
                  </th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => {
                  const isRankChanged = celebratingRank === entry.rank;
                  return (
                    <tr
                      key={entry.userId}
                      style={{
                        ...s.row,
                        ...(isRankChanged && s.rowCelebrating),
                      }}
                    >
                      <td style={s.rankCell}>
                        <div
                          style={{
                            ...s.rankBadge,
                            ...(entry.rank === 1 && s.rankBadgeGold),
                            ...(entry.rank === 2 && s.rankBadgeSilver),
                            ...(entry.rank === 3 && s.rankBadgeBronze),
                          }}
                        >
                          {entry.rank === 1 && "👑"}
                          {entry.rank === 2 && "🥈"}
                          {entry.rank === 3 && "🥉"}
                          {entry.rank > 3 && entry.rank}
                        </div>
                        {isRankChanged && <RankChangeGlow rankEntry={entry} />}
                      </td>
                      <td style={s.usernameCell}>{entry.username}</td>
                      <td style={{ ...s.cell, textAlign: "right" }}>
                        <span style={s.points}>{entry.totalPoints}</span>
                      </td>
                      <td style={{ ...s.cell, textAlign: "right" }}>
                        {entry.commitCount || 0}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse-glow {
          0% {
            box-shadow: 0 0 0 0 rgba(124, 106, 255, 0.7);
            opacity: 1;
          }
          50% {
            box-shadow: 0 0 0 20px rgba(124, 106, 255, 0);
            opacity: 0.8;
          }
          100% {
            box-shadow: 0 0 0 0 rgba(124, 106, 255, 0);
            opacity: 0;
          }
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes highlight {
          0%, 100% {
            background: transparent;
          }
          50% {
            background: rgba(124, 106, 255, 0.1);
          }
        }
      `}</style>
    </div>
  );
}

const s: Record<string, any> = {
  page: {
    maxWidth: "900px",
    margin: "0 auto",
    padding: "40px 24px",
  },
  header: {
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 800,
    color: "#e8e8f0",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#888",
  },
  loading: {
    textAlign: "center" as const,
    padding: "60px 24px",
    color: "#888",
    fontSize: 14,
  },
  empty: {
    textAlign: "center" as const,
    padding: "80px 40px",
    color: "#888",
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
    opacity: 0.3,
  },
  container: {
    background: "#141417",
    border: "1px solid #2a2a31",
    borderRadius: 16,
    overflow: "hidden",
  },
  tableWrapper: {
    overflowX: "auto" as const,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse" as const,
  },
  headerRow: {
    background: "#0c0c0e",
    borderBottom: "1px solid #2a2a31",
  },
  th: {
    padding: "16px 20px",
    textAlign: "left" as const,
    fontSize: 12,
    fontWeight: 600,
    color: "#999",
    fontFamily: "monospace",
    letterSpacing: "0.5px",
  },
  row: {
    borderBottom: "1px solid #1c1c21",
    transition: "background 300ms ease, box-shadow 300ms ease",
    position: "relative" as const,
  },
  rowCelebrating: {
    background: "rgba(124, 106, 255, 0.05)",
    animation: "highlight 0.6s ease",
    boxShadow: "0 0 20px rgba(124, 106, 255, 0.2)",
  },
  rankCell: {
    padding: "16px 20px",
    fontSize: 14,
    fontWeight: 600,
    position: "relative" as const,
  },
  rankBadge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 40,
    height: 40,
    borderRadius: 8,
    background: "#1c1c21",
    color: "#888",
    fontSize: 18,
    fontWeight: 700,
    position: "relative" as const,
  },
  rankBadgeGold: {
    background: "rgba(245, 166, 35, 0.15)",
    color: "#f5a623",
    boxShadow: "0 0 12px rgba(245, 166, 35, 0.2)",
  },
  rankBadgeSilver: {
    background: "rgba(96, 165, 250, 0.15)",
    color: "#60a5fa",
    boxShadow: "0 0 12px rgba(96, 165, 250, 0.2)",
  },
  rankBadgeBronze: {
    background: "rgba(210, 129, 91, 0.15)",
    color: "#d2815b",
    boxShadow: "0 0 12px rgba(210, 129, 91, 0.2)",
  },
  usernameCell: {
    padding: "16px 20px",
    color: "#e8e8f0",
    fontSize: 14,
    fontWeight: 600,
  },
  cell: {
    padding: "16px 20px",
    color: "#e8e8f0",
    fontSize: 14,
  },
  points: {
    fontWeight: 700,
    color: "#7c6aff",
    fontFamily: "monospace",
  },
};
