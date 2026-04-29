import { useMemo } from 'react';
import { createAvatar } from '@dicebear/core';
import { avataaars } from '@dicebear/collection';

interface AvatarProps {
  seed: string;
  size?: number;
  className?: string;
}

export default function Avatar({ seed, size = 48, className = '' }: AvatarProps) {
  const avatarUri = useMemo(() => {
    if (seed === '__DELETED__') {
      return 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23d4d4d8"/><path d="M50 30a15 15 0 1 0 0 30 15 15 0 0 0 0-30zm0 35c-20 0-35 15-35 35h70c0-20-15-35-35-35z" fill="%23a1a1aa"/></svg>';
    }
    const avatar = createAvatar(avataaars, {
      seed,
      backgroundColor: ['b6e3f4', 'c0aede', 'd1d4f9', 'ffdfbf', 'ffd5dc', 'c7e7c4'],
      radius: 50,
    });
    return avatar.toDataUri();
  }, [seed]);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img 
      src={avatarUri} 
      alt="Avatar" 
      width={size} 
      height={size} 
      className={`rounded-full shadow-sm object-cover ${className}`}
      loading="lazy"
    />
  );
}
