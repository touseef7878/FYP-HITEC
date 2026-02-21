import { motion } from "framer-motion";

interface Fish {
  id: number;
  size: number;
  top: string;
  delay: number;
  duration: number;
  direction: "left" | "right";
  color: string;
}

const fishes: Fish[] = [
  { id: 1, size: 40, top: "15%", delay: 0, duration: 18, direction: "right", color: "#06b6d4" },
  { id: 2, size: 25, top: "35%", delay: 2, duration: 22, direction: "left", color: "#0ea5e9" },
  { id: 3, size: 35, top: "55%", delay: 4, duration: 20, direction: "right", color: "#14b8a6" },
  { id: 4, size: 20, top: "75%", delay: 1, duration: 25, direction: "left", color: "#22d3d1" },
  { id: 5, size: 30, top: "25%", delay: 6, duration: 19, direction: "left", color: "#0891b2" },
  { id: 6, size: 45, top: "65%", delay: 3, duration: 23, direction: "right", color: "#06b6d4" },
  { id: 7, size: 22, top: "45%", delay: 8, duration: 21, direction: "right", color: "#0ea5e9" },
  { id: 8, size: 28, top: "85%", delay: 5, duration: 24, direction: "left", color: "#14b8a6" },
];

const FishSVG = ({ size, color, flip }: { size: number; color: string; flip?: boolean }) => (
  <svg
    width={size}
    height={size * 0.6}
    viewBox="0 0 100 60"
    style={{ transform: flip ? "scaleX(-1)" : "none" }}
  >
    {/* Fish body */}
    <ellipse cx="55" cy="30" rx="35" ry="20" fill={color} opacity="0.8" />
    {/* Tail */}
    <polygon points="10,30 25,10 25,50" fill={color} opacity="0.7" />
    {/* Dorsal fin */}
    <polygon points="50,10 65,5 60,18" fill={color} opacity="0.6" />
    {/* Eye */}
    <circle cx="75" cy="25" r="4" fill="white" />
    <circle cx="76" cy="24" r="2" fill="#1e293b" />
    {/* Gill */}
    <path d="M65,25 Q60,30 65,35" stroke="rgba(255,255,255,0.3)" strokeWidth="2" fill="none" />
  </svg>
);

const Bubble = ({ delay, left }: { delay: number; left: string }) => (
  <motion.div
    className="absolute rounded-full bg-white/10"
    style={{ left, bottom: "-20px" }}
    initial={{ y: 0, opacity: 0 }}
    animate={{ y: -600, opacity: [0, 0.5, 0.3, 0] }}
    transition={{
      duration: 8,
      delay,
      repeat: Infinity,
      ease: "linear",
    }}
  >
    <div className="w-3 h-3 rounded-full bg-gradient-to-br from-white/30 to-transparent" />
  </motion.div>
);

export function FishBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Swimming Fishes */}
      {fishes.map((fish) => (
        <motion.div
          key={fish.id}
          className="absolute"
          style={{ top: fish.top }}
          initial={{ x: fish.direction === "right" ? "-100px" : "calc(100vw + 100px)" }}
          animate={{
            x: fish.direction === "right" ? "calc(100vw + 100px)" : "-100px",
            y: [0, -15, 0, 15, 0],
          }}
          transition={{
            x: {
              duration: fish.duration,
              delay: fish.delay,
              repeat: Infinity,
              ease: "linear",
            },
            y: {
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut",
            },
          }}
        >
          <motion.div
            animate={{ rotate: [-2, 2, -2] }}
            transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
          >
            <FishSVG size={fish.size} color={fish.color} flip={fish.direction === "left"} />
          </motion.div>
        </motion.div>
      ))}

      {/* Rising Bubbles */}
      {[...Array(12)].map((_, i) => (
        <Bubble key={i} delay={i * 1.2} left={`${5 + i * 8}%`} />
      ))}

      {/* Light rays from surface */}
      <div className="absolute inset-0 bg-gradient-to-b from-cyan-400/5 via-transparent to-transparent" />
      
      {/* Floating particles */}
      {[...Array(20)].map((_, i) => (
        <motion.div
          key={`particle-${i}`}
          className="absolute w-1 h-1 bg-white/20 rounded-full"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
          }}
          animate={{
            y: [0, -30, 0],
            opacity: [0.1, 0.4, 0.1],
          }}
          transition={{
            duration: 4 + Math.random() * 3,
            delay: Math.random() * 3,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}
