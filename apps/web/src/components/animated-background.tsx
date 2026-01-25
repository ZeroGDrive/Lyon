import { cn } from "@/lib/utils";

interface AnimatedBackgroundProps {
  className?: string;
}

function AnimatedBackground({ className }: AnimatedBackgroundProps) {
  return (
    <div
      data-slot="animated-background"
      className={cn("pointer-events-none fixed inset-0 -z-10 overflow-hidden", className)}
      aria-hidden="true"
    >
      {/* Base background */}
      <div className="absolute inset-0 bg-background" />

      {/* Primary violet orb - top left */}
      <div
        className="absolute -left-[15%] -top-[5%] h-[700px] w-[700px] rounded-full bg-orb-1"
        style={{
          filter: "blur(140px)",
          animation: "float 30s ease-in-out infinite",
        }}
      />

      {/* Secondary magenta orb - top right */}
      <div
        className="absolute -right-[10%] top-[15%] h-[550px] w-[550px] rounded-full bg-orb-2"
        style={{
          filter: "blur(120px)",
          animation: "float-reverse 35s ease-in-out infinite",
          animationDelay: "-5s",
        }}
      />

      {/* Tertiary blue orb - bottom left */}
      <div
        className="absolute bottom-[5%] left-[25%] h-[500px] w-[500px] rounded-full bg-orb-3"
        style={{
          filter: "blur(130px)",
          animation: "float 40s ease-in-out infinite",
          animationDelay: "-12s",
        }}
      />

      {/* Quaternary teal orb - bottom right */}
      <div
        className="absolute -bottom-[15%] -right-[5%] h-[600px] w-[600px] rounded-full bg-orb-4"
        style={{
          filter: "blur(150px)",
          animation: "float-reverse 32s ease-in-out infinite",
          animationDelay: "-18s",
        }}
      />

      {/* Accent glow - center */}
      <div
        className="absolute left-[50%] top-[50%] h-[350px] w-[350px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-orb-1"
        style={{
          filter: "blur(100px)",
          animation: "pulse-glow 25s ease-in-out infinite",
          animationDelay: "-8s",
        }}
      />

      {/* Subtle gradient overlay for depth */}
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(ellipse at center, transparent 0%, var(--background) 70%)",
          opacity: 0.6,
        }}
      />

      {/* Film grain texture for premium feel */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          opacity: 0.025,
          mixBlendMode: "overlay",
        }}
      />
    </div>
  );
}

export { AnimatedBackground };
