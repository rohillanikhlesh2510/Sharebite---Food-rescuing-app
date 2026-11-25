interface UserAvatarProps {
  size?: number;
  className?: string;
  src?: string | null;
  name?: string;
}

export default function UserAvatar({ size = 40, className = '', src, name }: UserAvatarProps) {
  if (src) {
    return (
      <img
        src={src}
        alt={name || 'User avatar'}
        className={className}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          objectFit: 'cover',
          flexShrink: 0,
        }}
      />
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ borderRadius: '50%', flexShrink: 0 }}
    >
      {/* Warm golden/yellow circular background */}
      <circle cx="50" cy="50" r="50" fill="#F59E0B" />

      {/* Dark blue shirt */}
      <path
        d="M20 95 C25 80, 36 74, 50 74 C64 74, 75 80, 80 95 Z"
        fill="#1E3A8A"
      />

      {/* Neck */}
      <rect x="44" y="60" width="12" height="17" rx="3" fill="#FDBA74" />

      {/* Collar opening */}
      <path d="M44 74 L50 82 L56 74 Z" fill="#FDBA74" />

      {/* Head */}
      <ellipse cx="50" cy="50" rx="19" ry="21" fill="#FED7AA" />

      {/* Ears */}
      <circle cx="30" cy="51" r="4.5" fill="#FDBA74" />
      <circle cx="70" cy="51" r="4.5" fill="#FDBA74" />

      {/* Blonde / Yellow Hair */}
      <path
        d="M31 50 C29 32, 40 24, 50 24 C60 24, 71 32, 69 50 C67 55, 65 60, 65 60 C65 60, 63 46, 50 46 C37 46, 35 60, 35 60 C35 60, 33 55, 31 50 Z"
        fill="#FACC15"
      />
      <path
        d="M31 46 C32 30, 42 22, 50 22 C61 22, 69 30, 69 46 C67 37, 63 32, 50 32 C38 32, 33 38, 31 46 Z"
        fill="#FDE047"
      />
      <path
        d="M32 38 C38 31, 46 31, 52 35 C45 37, 38 41, 32 46 Z"
        fill="#EAB308"
      />
      <path
        d="M68 38 C62 31, 54 31, 48 35 C55 37, 62 41, 68 46 Z"
        fill="#EAB308"
      />

      {/* Eyebrows */}
      <path d="M40 43 Q44 41 47 43" stroke="#854D0E" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <path d="M53 43 Q56 41 60 43" stroke="#854D0E" strokeWidth="1.8" strokeLinecap="round" fill="none" />

      {/* Eyes */}
      <circle cx="43.5" cy="48" r="2.2" fill="#1F2937" />
      <circle cx="56.5" cy="48" r="2.2" fill="#1F2937" />
      <circle cx="44.2" cy="47.3" r="0.7" fill="#FFFFFF" />
      <circle cx="57.2" cy="47.3" r="0.7" fill="#FFFFFF" />

      {/* Rosy cheeks */}
      <circle cx="39" cy="53" r="2.5" fill="#FCA5A5" opacity="0.6" />
      <circle cx="61" cy="53" r="2.5" fill="#FCA5A5" opacity="0.6" />

      {/* Smile */}
      <path
        d="M45 56 Q50 61 55 56"
        stroke="#9A3412"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
