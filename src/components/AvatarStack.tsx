'use client';

interface Avatar {
  name: string;
  image?: string | null;
}

interface AvatarStackProps {
  avatars: Avatar[];
  maxVisible?: number;
  size?: 'sm' | 'md' | 'lg';
}

export default function AvatarStack({
  avatars,
  maxVisible = 3,
  size = 'md',
}: AvatarStackProps) {
  const sizeClasses = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-8 h-8 text-sm',
    lg: 'w-10 h-10 text-base',
  };

  const overlapClasses = {
    sm: '-ml-2',
    md: '-ml-2.5',
    lg: '-ml-3',
  };

  const visibleAvatars = avatars.slice(0, maxVisible);
  const overflow = avatars.length - maxVisible;

  // Generate color from name
  const getColorFromName = (name: string) => {
    const colors = [
      'bg-purple-500',
      'bg-blue-500',
      'bg-green-500',
      'bg-amber-500',
      'bg-pink-500',
      'bg-cyan-500',
      'bg-indigo-500',
      'bg-rose-500',
    ];
    const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  const getInitials = (name: string) => {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="flex items-center">
      {visibleAvatars.map((avatar, index) => (
        <div
          key={index}
          className={`${sizeClasses[size]} ${index > 0 ? overlapClasses[size] : ''}
            rounded-full border-2 border-white flex items-center justify-center relative z-[${10 - index}]`}
          title={avatar.name}
        >
          {avatar.image ? (
            <img
              src={avatar.image}
              alt={avatar.name}
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            <div
              className={`w-full h-full rounded-full ${getColorFromName(avatar.name)}
                flex items-center justify-center text-white font-medium`}
            >
              {getInitials(avatar.name)}
            </div>
          )}
        </div>
      ))}
      {overflow > 0 && (
        <div
          className={`${sizeClasses[size]} ${overlapClasses[size]}
            rounded-full border-2 border-white bg-[#F6F6F9] flex items-center justify-center
            text-[#667085] font-medium`}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}
