import { useEffect, useMemo, useRef, useState } from "react";

type Platform = {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

type Nut = {
  id: number;
  x: number;
  y: number;
  collected: boolean;
};

type Pit = {
  id: number;
  x: number;
  width: number;
};

type Player = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  grounded: boolean;
};

const VIEW_WIDTH = 980;
const WORLD_WIDTH = 4600;
const TARGET_NUTS = 25;
const GROUND_Y = 470;
const TRUNK_Y = 250;
const DEATH_Y = 620;

const makePlatforms = (): Platform[] => {
  const list: Platform[] = [];
  for (let i = 0; i < TARGET_NUTS + 2; i += 1) {
    const width = 150 + (i % 4) * 10;
    const x = 180 + i * 165 + ((i % 3) - 1) * 22;
    const y = 365 - (i % 5) * 22;
    list.push({ id: i, x, y, width, height: 22 });
  }
  return list;
};

const platforms = makePlatforms();

const pits: Pit[] = [
  { id: 0, x: 560, width: 120 },
  { id: 1, x: 1080, width: 130 },
  { id: 2, x: 1560, width: 120 },
  { id: 3, x: 2030, width: 135 },
  { id: 4, x: 2510, width: 120 },
  { id: 5, x: 2990, width: 130 },
  { id: 6, x: 3460, width: 125 },
  { id: 7, x: 3920, width: 140 }
];

const nutsInitial: Nut[] = platforms.slice(0, TARGET_NUTS).map((platform, index) => ({
  id: index,
  x: platform.x + platform.width / 2 - 10,
  y: platform.y - 34,
  collected: false
}));

const intersects = (
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number
): boolean => ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const secs = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  const millis = Math.floor((seconds % 1) * 100)
    .toString()
    .padStart(2, "0");
  return `${mins}:${secs}.${millis}`;
};

export default function App() {
  const [nuts, setNuts] = useState<Nut[]>(nutsInitial);
  const [player, setPlayer] = useState<Player>({
    x: 70,
    y: 370,
    vx: 0,
    vy: 0,
    width: 38,
    height: 44,
    grounded: false
  });
  const [cameraX, setCameraX] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [started, setStarted] = useState(false);
  const [won, setWon] = useState(false);
  const [dead, setDead] = useState(false);

  const keysRef = useRef({ left: false, right: false, jump: false });
  const touchRef = useRef({ left: false, right: false, jump: false });
  const lastRef = useRef<number>(0);

  const collectedCount = useMemo(() => nuts.filter((nut) => nut.collected).length, [nuts]);

  useEffect(() => {
    const onDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") keysRef.current.left = true;
      if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") keysRef.current.right = true;
      if (event.key === " " || event.key === "ArrowUp" || event.key.toLowerCase() === "w") keysRef.current.jump = true;
    };
    const onUp = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") keysRef.current.left = false;
      if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") keysRef.current.right = false;
      if (event.key === " " || event.key === "ArrowUp" || event.key.toLowerCase() === "w") keysRef.current.jump = false;
    };

    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, []);

  useEffect(() => {
    let raf = 0;
    const tick = (time: number) => {
      if (!lastRef.current) {
        lastRef.current = time;
      }
      const dt = Math.min((time - lastRef.current) / 1000, 0.033);
      lastRef.current = time;

      const input = {
        left: keysRef.current.left || touchRef.current.left,
        right: keysRef.current.right || touchRef.current.right,
        jump: keysRef.current.jump || touchRef.current.jump
      };

      if (!won && !dead) {
        setPlayer((prev) => {
          let vx = prev.vx;
          let vy = prev.vy;
          let x = prev.x;
          let y = prev.y;
          let grounded = prev.grounded;

          const moveSpeed = 300;
          const jumpPower = 710;
          const gravity = 1800;

          if (input.left && !input.right) vx = -moveSpeed;
          else if (input.right && !input.left) vx = moveSpeed;
          else vx = vx * 0.8;

          if (!started && (Math.abs(vx) > 0 || input.jump)) setStarted(true);

          if (input.jump && grounded) {
            vy = -jumpPower;
            grounded = false;
          }

          vy += gravity * dt;

          x += vx * dt;
          y += vy * dt;

          if (x < 0) x = 0;
          if (x > WORLD_WIDTH - prev.width) x = WORLD_WIDTH - prev.width;

          const oldBottom = prev.y + prev.height;
          let landed = false;

          for (const platform of platforms) {
            const fromAbove = oldBottom <= platform.y + 2;
            const intersectsHorizontally = x + prev.width > platform.x && x < platform.x + platform.width;
            const nowBelowTop = y + prev.height >= platform.y && y + prev.height <= platform.y + platform.height + 12;

            if (fromAbove && intersectsHorizontally && nowBelowTop && vy >= 0) {
              y = platform.y - prev.height;
              vy = 0;
              landed = true;
            }
          }

          const overPit = pits.some((pit) => x + prev.width > pit.x + 6 && x < pit.x + pit.width - 6);

          if (!overPit && y + prev.height >= GROUND_Y) {
            y = GROUND_Y - prev.height;
            vy = 0;
            landed = true;
          }

          grounded = landed;

          return { ...prev, x, y, vx, vy, grounded };
        });

        if (started) {
          setElapsed((value) => value + dt);
        }
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [dead, started, won]);

  useEffect(() => {
    if (player.y > DEATH_Y && !dead && !won) {
      setDead(true);
    }
  }, [dead, player.y, won]);

  useEffect(() => {
    if (dead || won) return;
    setNuts((current) =>
      current.map((nut) => {
        if (nut.collected) return nut;
        const gotIt = intersects(player.x, player.y, player.width, player.height, nut.x, nut.y, 20, 20);
        return gotIt ? { ...nut, collected: true } : nut;
      })
    );
  }, [dead, player, won]);

  useEffect(() => {
    if (collectedCount >= TARGET_NUTS && !won) {
      setWon(true);
    }
  }, [collectedCount, won]);

  useEffect(() => {
    const ideal = player.x - VIEW_WIDTH * 0.35;
    const clamped = Math.max(0, Math.min(WORLD_WIDTH - VIEW_WIDTH, ideal));
    setCameraX(clamped);
  }, [player.x]);

  const reset = () => {
    setNuts(nutsInitial);
    setElapsed(0);
    setWon(false);
    setDead(false);
    setStarted(false);
    keysRef.current = { left: false, right: false, jump: false };
    touchRef.current = { left: false, right: false, jump: false };
    setPlayer({ x: 70, y: 370, vx: 0, vy: 0, width: 38, height: 44, grounded: false });
    setCameraX(0);
    lastRef.current = 0;
  };

  return (
    <div className="app-shell">
      <header className="hud">
        <h1>Squirrel Nut Dash</h1>
        <div className="stats">
          <span>Nuts: {collectedCount}/{TARGET_NUTS}</span>
          <span>Time: {formatTime(elapsed)}</span>
        </div>
      </header>

      <div className="game-view" role="application" aria-label="Squirrel platform game">
        <div className="world" style={{ transform: `translateX(${-cameraX}px)` }}>
          <div className="ground" />
          {pits.map((pit) => (
            <div key={pit.id} className="pit" style={{ left: `${pit.x}px`, width: `${pit.width}px` }} />
          ))}
          {platforms.map((platform) => (
            <div key={`platform-${platform.id}`}>
              <div className="trunk" style={{ left: `${platform.x + platform.width / 2 - 14}px`, top: `${TRUNK_Y}px` }} />
              <div
                className="canopy"
                style={{ left: `${platform.x - 24}px`, top: `${platform.y - 30}px`, width: `${platform.width + 48}px` }}
              />
              <div
                className="platform"
                style={{ left: `${platform.x}px`, top: `${platform.y}px`, width: `${platform.width}px`, height: `${platform.height}px` }}
              />
            </div>
          ))}

          {nuts.map(
            (nut) =>
              !nut.collected && <div key={nut.id} className="nut" style={{ left: `${nut.x}px`, top: `${nut.y}px` }} aria-label="nut" />
          )}

          <div className="squirrel" style={{ left: `${player.x}px`, top: `${player.y}px` }}>
            <span className="tail" />
            <span className="eye" />
          </div>
        </div>

        {won && (
          <div className="win-panel">
            <h2>You Win!</h2>
            <p>
              You collected all {TARGET_NUTS} nuts in <strong>{formatTime(elapsed)}</strong>.
            </p>
            <button onClick={reset}>Play Again</button>
          </div>
        )}

        {dead && !won && (
          <div className="win-panel lose-panel">
            <h2>Splat! You Fell In A Pit</h2>
            <p>
              You grabbed {collectedCount} nuts before the fall. Time: <strong>{formatTime(elapsed)}</strong>.
            </p>
            <button onClick={reset}>Try Again</button>
          </div>
        )}
      </div>

      <p className="instructions">Use Left/Right + Space (or mobile controls) to jump tree-to-tree, dodge pits, and collect every nut.</p>

      <div className="touch-controls" aria-hidden="true">
        <button
          onTouchStart={() => {
            touchRef.current.left = true;
          }}
          onTouchEnd={() => {
            touchRef.current.left = false;
          }}
          onMouseDown={() => {
            touchRef.current.left = true;
          }}
          onMouseUp={() => {
            touchRef.current.left = false;
          }}
          onMouseLeave={() => {
            touchRef.current.left = false;
          }}
        >
          Left
        </button>
        <button
          onTouchStart={() => {
            touchRef.current.right = true;
          }}
          onTouchEnd={() => {
            touchRef.current.right = false;
          }}
          onMouseDown={() => {
            touchRef.current.right = true;
          }}
          onMouseUp={() => {
            touchRef.current.right = false;
          }}
          onMouseLeave={() => {
            touchRef.current.right = false;
          }}
        >
          Right
        </button>
        <button
          className="jump"
          onTouchStart={() => {
            touchRef.current.jump = true;
          }}
          onTouchEnd={() => {
            touchRef.current.jump = false;
          }}
          onMouseDown={() => {
            touchRef.current.jump = true;
          }}
          onMouseUp={() => {
            touchRef.current.jump = false;
          }}
          onMouseLeave={() => {
            touchRef.current.jump = false;
          }}
        >
          Jump
        </button>
      </div>
    </div>
  );
}
