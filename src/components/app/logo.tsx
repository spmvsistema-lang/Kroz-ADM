import Image from 'next/image';

interface LogoProps {
  width?: number;
  height?: number;
  priority?: boolean;
}

export function Logo({ width = 140, height = 40, priority = false }: LogoProps) {
  return (
    <Image
      src="/krozadm.png"
      width={width}
      height={height}
      alt="Kroz ADM Logo"
      className="dark:invert"
      priority={priority}
      style={{ height: 'auto' }}
    />
  );
}
