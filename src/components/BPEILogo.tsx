interface Props { className?: string; variant?: "light" | "dark"; size?: number }
export function BPEILogo({ className = "", variant = "dark", size = 36 }: Props) {
 return <span aria-label="BPEI" className={"inline-flex items-center font-extrabold tracking-tight " + (variant === "light" ? "text-white" : "text-navy") + " " + className} style={{fontSize: Math.max(18, size * 0.65)}}>BPEI</span>;
}
