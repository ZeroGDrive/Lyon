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
      <div className="absolute inset-0 bg-background" />

      <div
        className="absolute -left-[20%] -top-[10%] h-[600px] w-[600px] rounded-full bg-orb-1 opacity-60"
        style={{
          filter: "blur(120px)",
          animation: "float 25s ease-in-out infinite",
        }}
      />

      <div
        className="absolute -right-[15%] top-[20%] h-[500px] w-[500px] rounded-full bg-orb-2 opacity-50"
        style={{
          filter: "blur(100px)",
          animation: "float-reverse 30s ease-in-out infinite",
          animationDelay: "-5s",
        }}
      />

      <div
        className="absolute bottom-[10%] left-[30%] h-[450px] w-[450px] rounded-full bg-orb-3 opacity-40"
        style={{
          filter: "blur(110px)",
          animation: "float 35s ease-in-out infinite",
          animationDelay: "-10s",
        }}
      />

      <div
        className="absolute -bottom-[20%] -right-[10%] h-[550px] w-[550px] rounded-full bg-orb-4 opacity-45"
        style={{
          filter: "blur(130px)",
          animation: "float-reverse 28s ease-in-out infinite",
          animationDelay: "-15s",
        }}
      />

      <div
        className="absolute left-[60%] top-[60%] h-[300px] w-[300px] rounded-full bg-orb-1 opacity-30"
        style={{
          filter: "blur(80px)",
          animation: "pulse-glow 20s ease-in-out infinite",
          animationDelay: "-8s",
        }}
      />

      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          opacity: 0.03,
          mixBlendMode: "overlay",
        }}
      />
    </div>
  );
}

export { AnimatedBackground };
