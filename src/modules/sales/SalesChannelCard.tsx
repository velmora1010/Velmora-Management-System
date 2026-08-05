import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { SalesChannelConfig } from './salesChannels';

interface SalesChannelCardProps {
  channel: SalesChannelConfig;
}

export const SalesChannelCard: React.FC<SalesChannelCardProps> = ({ channel }) => {
  const navigate = useNavigate();
  const Icon = channel.icon;

  const handleClick = () => {
    navigate(channel.route);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={`group relative flex flex-col items-center justify-center text-center h-full min-h-[210px] p-8 bg-slate-800/50 border border-slate-700/80 rounded-2xl cursor-pointer transition-all duration-300 hover:-translate-y-1 ${channel.borderColor} ${channel.glowShadow} focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-slate-950`}
    >
      {/* Icon Container */}
      <div className={`w-16 h-16 rounded-2xl ${channel.iconBg} ${channel.iconColor} flex items-center justify-center mb-4 group-hover:scale-105 transition-all duration-300 border border-white/5`}>
        <Icon size={32} />
      </div>

      {/* Channel Title */}
      <h3 className="text-xl font-bold text-white mb-2 group-hover:text-cyan-300 transition-colors">
        {channel.name}
      </h3>

      {/* Description */}
      <p className="text-sm text-slate-400 max-w-[220px] leading-snug">
        {channel.description}
      </p>
    </div>
  );
};
