'use client';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: 'calendar' | 'users' | 'clock' | 'activity' | 'chart' | 'dollar';
  color: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'indigo';
  subtitle?: string;
  urgent?: boolean;
}

export default function StatCard({
  title,
  value,
  icon,
  color,
  subtitle,
  urgent = false
}: StatCardProps) {
  const getIconComponent = () => {
    const iconClass = "h-6 w-6";
    
    switch (icon) {
      case 'calendar':
        return (
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        );
      case 'users':
        return (
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
          </svg>
        );
      case 'clock':
        return (
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'activity':
        return (
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        );
      case 'chart':
        return (
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
          </svg>
        );
      case 'dollar':
        return (
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
          </svg>
        );
      default:
        return null;
    }
  };

  const getColorClasses = () => {
    const baseClasses = {
      blue: {
        bg: 'bg-blue-500',
        text: 'text-blue-600',
        bgLight: 'bg-blue-50'
      },
      green: {
        bg: 'bg-green-500',
        text: 'text-green-600',
        bgLight: 'bg-green-50'
      },
      yellow: {
        bg: 'bg-yellow-500',
        text: 'text-yellow-600',
        bgLight: 'bg-yellow-50'
      },
      red: {
        bg: 'bg-red-500',
        text: 'text-red-600',
        bgLight: 'bg-red-50'
      },
      purple: {
        bg: 'bg-purple-500',
        text: 'text-purple-600',
        bgLight: 'bg-purple-50'
      },
      indigo: {
        bg: 'bg-indigo-500',
        text: 'text-indigo-600',
        bgLight: 'bg-indigo-50'
      }
    };

    return baseClasses[color];
  };

  const colorClasses = getColorClasses();

  return (
    <div className={`bg-white overflow-hidden rounded-lg shadow ${urgent ? 'ring-2 ring-red-500 ring-opacity-50' : ''}`}>
      <div className="p-6">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <div className={`inline-flex items-center justify-center p-3 ${colorClasses.bgLight} rounded-md`}>
              <div className={colorClasses.text}>
                {getIconComponent()}
              </div>
            </div>
          </div>
          <div className="ml-5 w-0 flex-1">
            <dl>
              <dt className="text-sm font-medium text-gray-500 truncate">
                {title}
                {urgent && (
                  <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                    緊急
                  </span>
                )}
              </dt>
              <dd className="text-2xl font-semibold text-gray-900">
                {typeof value === 'number' ? value.toLocaleString() : value}
              </dd>
              {subtitle && (
                <dd className="text-sm text-gray-600 mt-1">
                  {subtitle}
                </dd>
              )}
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
