'use client';

interface DailyData {
  date: string;
  bookings: number;
  attended: number;
  noShow: number;
}

interface TopicTrendChartProps {
  data: DailyData[];
  height?: number;
}

export default function TopicTrendChart({ data, height = 200 }: TopicTrendChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] text-[#667085] text-sm">
        No data available
      </div>
    );
  }

  const maxBookings = Math.max(...data.map((d) => d.bookings), 1);

  // Calculate bar width based on number of data points
  const barWidth = Math.max(4, Math.min(20, (600 / data.length) - 2));
  const chartWidth = (barWidth + 2) * data.length;

  return (
    <div className="overflow-x-auto">
      <svg
        width={Math.max(chartWidth, 600)}
        height={height + 40}
        className="min-w-full"
      >
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => (
          <g key={i}>
            <line
              x1="0"
              y1={height - height * ratio}
              x2={chartWidth}
              y2={height - height * ratio}
              stroke="#E5E7EB"
              strokeDasharray="4"
            />
            <text
              x="-5"
              y={height - height * ratio + 4}
              fill="#667085"
              fontSize="10"
              textAnchor="end"
            >
              {Math.round(maxBookings * ratio)}
            </text>
          </g>
        ))}

        {/* Bars */}
        {data.map((day, index) => {
          const x = index * (barWidth + 2);
          const bookingsHeight = (day.bookings / maxBookings) * height;
          const attendedHeight = (day.attended / maxBookings) * height;

          return (
            <g key={day.date}>
              {/* Total bookings bar */}
              <rect
                x={x}
                y={height - bookingsHeight}
                width={barWidth}
                height={bookingsHeight}
                fill="#E5E7EB"
                rx="2"
              />
              {/* Attended bar */}
              <rect
                x={x}
                y={height - attendedHeight}
                width={barWidth}
                height={attendedHeight}
                fill="#6F71EE"
                rx="2"
              />
              {/* Hover area */}
              <rect
                x={x}
                y="0"
                width={barWidth}
                height={height}
                fill="transparent"
                className="cursor-pointer"
              >
                <title>
                  {new Date(day.date).toLocaleDateString()}: {day.bookings} bookings, {day.attended} attended, {day.noShow} no-shows
                </title>
              </rect>
            </g>
          );
        })}

        {/* X-axis labels (show every 7th day for weekly view) */}
        {data
          .filter((_, i) => i % 7 === 0 || data.length <= 14)
          .map((day, i) => {
            const originalIndex = data.findIndex((d) => d.date === day.date);
            const x = originalIndex * (barWidth + 2) + barWidth / 2;

            return (
              <text
                key={day.date}
                x={x}
                y={height + 20}
                fill="#667085"
                fontSize="10"
                textAnchor="middle"
              >
                {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </text>
            );
          })}
      </svg>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-[#E5E7EB]" />
          <span className="text-[#667085]">Total Bookings</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-[#6F71EE]" />
          <span className="text-[#667085]">Attended</span>
        </div>
      </div>
    </div>
  );
}
