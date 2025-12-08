import { useShow } from '../context/ShowContext';
import {
  VideoCameraIcon,
  PlayIcon,
  ChartBarIcon,
  ArrowPathIcon,
  PauseIcon,
  CurrencyDollarIcon
} from '@heroicons/react/24/solid';

const iconMap = {
  'video-camera': VideoCameraIcon,
  'play': PlayIcon,
  'chart-bar': ChartBarIcon,
  'arrow-path': ArrowPathIcon,
  'pause': PauseIcon,
  'currency-dollar': CurrencyDollarIcon
};

export default function QuickActions() {
  const { state, overrideScene } = useShow();
  const { showConfig, obsCurrentScene } = state;

  const quickActions = showConfig?.quickActions || [
    { id: 'talent', name: 'Talent Camera', obsScene: 'Talent Camera', icon: 'video-camera' },
    { id: 'competition', name: 'Competition', obsScene: 'Competition Camera', icon: 'play' },
    { id: 'scores', name: 'Scores', obsScene: 'Scoreboard', icon: 'chart-bar' },
    { id: 'replay', name: 'Replay', obsScene: 'Replay', icon: 'arrow-path' }
  ];

  return (
    <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
      <div className="text-sm text-zinc-400 uppercase tracking-wide mb-3">Quick Actions</div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {quickActions.map((action) => {
          const Icon = iconMap[action.icon] || PlayIcon;
          const isActive = obsCurrentScene === action.obsScene;

          return (
            <button
              key={action.id}
              onClick={() => overrideScene(action.obsScene)}
              className={`
                flex flex-col items-center gap-2 p-3 rounded-lg transition-all
                ${isActive
                  ? 'bg-blue-500 text-white'
                  : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                }
              `}
            >
              <Icon className="w-5 h-5" />
              <span className="text-xs font-medium">{action.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
