"use client";

import React, { useState, useCallback, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import jaLocale from '@fullcalendar/core/locales/ja';
import { EventClickArg, DateSelectArg, EventInput, Calendar as FullCalendarType } from '@fullcalendar/core';
import CalendarToolbar from './CalendarToolbar';
import CalendarEventModal from './CalendarEventModal';
import { CalendarEvent } from './calendar-utils';

interface CalendarProps {
  className?: string;
  height?: string | number;
  initialView?: 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay';
  onDateSelect?: (start: Date, end: Date) => void;
  onEventClick?: (eventInfo: any) => void;
  showToolbar?: boolean;
  editable?: boolean;
}


const Calendar: React.FC<CalendarProps> = ({
  className = '',
  height = 'auto',
  initialView = 'dayGridMonth',
  onDateSelect,
  onEventClick,
  showToolbar = true,
  editable = false
}) => {
  const [events, setEvents] = useState<EventInput[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentView, setCurrentView] = useState(initialView);
  const [currentDate, setCurrentDate] = useState(new Date());
  const calendarRef = useRef<FullCalendar>(null);

  // APIからイベントデータを取得
  const fetchEvents = useCallback(async (start: Date, end: Date) => {
    setLoading(true);
    try {
      const startStr = start.toISOString().split('T')[0];
      const endStr = end.toISOString().split('T')[0];
      
      const response = await fetch(
        `/api/calendar/events?start=${startStr}&end=${endStr}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error('カレンダーデータの取得に失敗しました');
      }

      const data = await response.json();
      setEvents(data.events || []);
    } catch (error) {
      console.error('Calendar fetch error:', error);
      // エラー時は空の配列を設定
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // FullCalendarのイベント処理
  const handleEventClick = (clickInfo: EventClickArg) => {
    const eventData = {
      id: clickInfo.event.id,
      title: clickInfo.event.title,
      start: clickInfo.event.startStr,
      end: clickInfo.event.endStr,
      backgroundColor: clickInfo.event.backgroundColor || '',
      borderColor: clickInfo.event.borderColor || '',
      textColor: clickInfo.event.textColor || '',
      extendedProps: clickInfo.event.extendedProps
    } as CalendarEvent;

    setSelectedEvent(eventData);
    setIsModalOpen(true);

    if (onEventClick) {
      onEventClick(eventData);
    }
  };

  const handleDateSelect = (selectInfo: DateSelectArg) => {
    if (onDateSelect) {
      onDateSelect(selectInfo.start, selectInfo.end);
    }
  };

  const handleDatesSet = (dateInfo: any) => {
    setCurrentDate(dateInfo.view.currentStart);
    fetchEvents(dateInfo.view.activeStart, dateInfo.view.activeEnd);
  };

  const handleViewChange = (view: string) => {
    setCurrentView(view as any);
  };

  const handlePrev = () => {
    const calendarApi = calendarRef.current?.getApi();
    if (calendarApi) {
      calendarApi.prev();
    }
  };

  const handleNext = () => {
    const calendarApi = calendarRef.current?.getApi();
    if (calendarApi) {
      calendarApi.next();
    }
  };

  const handleToday = () => {
    const calendarApi = calendarRef.current?.getApi();
    if (calendarApi) {
      calendarApi.today();
    }
  };

  return (
    <div className={`calendar-container ${className}`}>
      {showToolbar && (
        <CalendarToolbar
          currentView={currentView}
          currentDate={currentDate}
          onViewChange={handleViewChange}
          onPrev={handlePrev}
          onNext={handleNext}
          onToday={handleToday}
        />
      )}

      <div className="calendar-wrapper bg-white rounded-lg shadow-sm overflow-hidden">
        {loading && (
          <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10">
            <div className="text-primary">読み込み中...</div>
          </div>
        )}

        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView={currentView}
          locale={jaLocale}
          height={height}
          events={events}
          selectable={editable}
          selectMirror={true}
          dayMaxEvents={3}
          weekends={true}
          headerToolbar={false} // カスタムツールバーを使用
          select={handleDateSelect}
          eventClick={handleEventClick}
          datesSet={handleDatesSet}
          eventDisplay="block"
          displayEventTime={true}
          slotMinTime="00:00:00"
          slotMaxTime="24:00:00"
          slotDuration="01:00:00"
          slotLabelInterval="01:00:00"
          allDaySlot={false}
          scrollTime="09:00:00"
          nowIndicator={true}
          businessHours={{
            startTime: '00:00',
            endTime: '24:00',
          }}
          slotLabelFormat={{
            hour: 'numeric',
            minute: '2-digit',
            hour12: false
          }}
          eventTimeFormat={{
            hour: 'numeric',
            minute: '2-digit',
            hour12: false
          }}
          dayHeaderFormat={{
            weekday: 'short'
          }}
          titleFormat={{
            year: 'numeric',
            month: 'long'
          }}
          dayCellContent={(arg) => {
            return arg.date.getDate().toString();
          }}
        />
      </div>

      {/* イベント詳細モーダル */}
      <CalendarEventModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        event={selectedEvent}
      />

      <style jsx global>{`
        .fc-custom {
          font-family: "SF Pro JP", "Hiragino Kaku Gothic ProN", "Hiragino Sans", sans-serif;
        }
        
        .fc-custom .fc-button {
          background: var(--primary-color);
          border-color: var(--primary-color);
          color: white;
        }
        
        .fc-custom .fc-button:hover {
          background: var(--primary-color);
          opacity: 0.9;
        }
        
        .fc-custom .fc-button-primary:disabled {
          background: var(--system-gray);
          border-color: var(--system-gray);
        }
        
        .fc-custom .fc-daygrid-event {
          border-radius: 4px;
          margin: 1px;
          font-size: 0.8rem;
        }
        
        .fc-custom .fc-timegrid-event {
          border-radius: 4px;
          font-size: 0.75rem;
        }
        
        .fc-custom .fc-event {
          cursor: pointer;
          transition: opacity 0.2s;
        }
        
        .fc-custom .fc-event:hover {
          opacity: 0.8;
        }
        
        .fc-custom .fc-day-today {
          background-color: rgba(130, 194, 169, 0.1) !important;
        }
        
        .fc-custom .fc-now-indicator {
          border-color: var(--accent-color);
        }
        
        @media (max-width: 768px) {
          .fc-custom .fc-toolbar-title {
            font-size: 1.1rem;
          }
          
          .fc-custom .fc-daygrid-event {
            font-size: 0.7rem;
          }
        }
      `}</style>
    </div>
  );
};

export default Calendar;
