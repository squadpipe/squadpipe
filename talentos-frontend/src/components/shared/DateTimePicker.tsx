import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Clock, X } from 'lucide-react';

interface DateTimePickerProps {
  value: string;
  onChange: (nextValue: string) => void;
  placeholder?: string;
  ariaLabel?: string;
}

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const TIME_SLOTS = Array.from({ length: 24 }, (_, idx) => {
  const totalMinutes = 8 * 60 + idx * 30; // 08:00 AM -> 07:30 PM
  const hour24 = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  const period = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  const label = `${hour12}:${String(minute).padStart(2, '0')} ${period}`;
  return { hour24, minute, label };
});

function parseDateValue(val?: string): Date | null {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

function formatTriggerLabel(date: Date | null): string {
  if (!date) return '';
  const datePart = date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const timePart = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
  return `${datePart} · ${timePart}`;
}

export const DateTimePicker: React.FC<DateTimePickerProps> = ({
  value,
  onChange,
  placeholder = 'Schedule interview date & time...',
  ariaLabel = 'Interview date and time',
}) => {
  const selectedDate = useMemo(() => parseDateValue(value), [value]);
  const [open, setOpen] = useState(false);

  const initialCursor = selectedDate || new Date();
  const [viewYear, setViewYear] = useState(initialCursor.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialCursor.getMonth());

  useEffect(() => {
    if (open) {
      const ref = selectedDate || new Date();
      setViewYear(ref.getFullYear());
      setViewMonth(ref.getMonth());
    }
  }, [open]);

  const monthCells = useMemo(() => {
    const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells: Array<{ day: number; date: Date } | null> = [];
    for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
    for (let day = 1; day <= daysInMonth; day++) {
      cells.push({ day, date: new Date(viewYear, viewMonth, day) });
    }
    return cells;
  }, [viewYear, viewMonth]);

  const today = new Date();
  const isSameDay = (a: Date | null, b: Date) =>
    Boolean(
      a &&
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate()
    );

  const commitDateAndTime = (baseDay: Date, hour24: number, minute: number) => {
    const next = new Date(
      baseDay.getFullYear(),
      baseDay.getMonth(),
      baseDay.getDate(),
      hour24,
      minute,
      0,
      0
    );
    onChange(next.toISOString());
  };

  const activeHour24 = selectedDate ? selectedDate.getHours() : 10;
  const activeMinute = selectedDate ? selectedDate.getMinutes() : 0;

  const handleSelectDay = (dayDate: Date) => {
    commitDateAndTime(dayDate, activeHour24, activeMinute);
  };

  const handleSelectTimeSlot = (hour24: number, minute: number) => {
    const base = selectedDate || new Date();
    commitDateAndTime(base, hour24, minute);
  };

  const applyQuickOffset = (daysOffset: number) => {
    const target = new Date();
    target.setDate(target.getDate() + daysOffset);
    setViewYear(target.getFullYear());
    setViewMonth(target.getMonth());
    commitDateAndTime(target, selectedDate ? activeHour24 : 10, selectedDate ? activeMinute : 0);
  };

  const goPrevMonth = () => {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const goNextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const monthTitle = new Date(viewYear, viewMonth, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="relative">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          aria-label={ariaLabel}
          onClick={() => setOpen((prev) => !prev)}
          className={`flex-1 h-9 px-3 rounded-lg border text-left text-xs flex items-center justify-between gap-2 transition-colors cursor-pointer ${
            open
              ? 'border-brand-600 ring-2 ring-brand-500/10 bg-white'
              : 'border-slate-200 bg-slate-50/50 hover:bg-white hover:border-slate-300'
          }`}
        >
          <span className="inline-flex items-center gap-2 min-w-0 truncate">
            <Calendar className="w-3.5 h-3.5 text-brand-600 flex-shrink-0" />
            {selectedDate ? (
              <span className="font-medium text-slate-900 truncate">
                {formatTriggerLabel(selectedDate)}
              </span>
            ) : (
              <span className="text-slate-400 truncate">{placeholder}</span>
            )}
          </span>
          <Clock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
        </button>

        {selectedDate && (
          <button
            type="button"
            title="Clear interview date"
            aria-label="Clear interview date"
            onClick={() => {
              onChange('');
              setOpen(false);
            }}
            className="h-9 w-9 rounded-lg border border-slate-200 bg-white hover:bg-rose-50 hover:border-rose-200 text-slate-400 hover:text-rose-600 flex items-center justify-center transition-colors cursor-pointer flex-shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 sm:right-auto sm:w-[430px] mt-1.5 z-50 bg-white rounded-xl border border-slate-200 shadow-2xl overflow-hidden animate-fade-in">
            <div className="grid grid-cols-1 sm:grid-cols-12 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
              {/* Calendar Side */}
              <div className="sm:col-span-7 p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={goPrevMonth}
                    aria-label="Previous month"
                    className="p-1 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-bold text-slate-900">{monthTitle}</span>
                  <button
                    type="button"
                    onClick={goNextMonth}
                    aria-label="Next month"
                    className="p-1 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Quick Day Presets */}
                <div className="flex items-center gap-1">
                  {[
                    { label: 'Today', offset: 0 },
                    { label: 'Tomorrow', offset: 1 },
                    { label: '+7 days', offset: 7 },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => applyQuickOffset(preset.offset)}
                      className="flex-1 py-1 rounded-md bg-slate-50 hover:bg-brand-50 text-[10.5px] font-medium text-slate-600 hover:text-brand-700 border border-slate-200/70 transition-colors cursor-pointer"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-0.5 text-center">
                  {WEEKDAYS.map((wd) => (
                    <div
                      key={wd}
                      className="py-1 text-[10px] font-semibold text-slate-400 uppercase"
                    >
                      {wd}
                    </div>
                  ))}
                  {monthCells.map((cell, idx) => {
                    if (!cell) {
                      return <div key={`empty-${idx}`} className="h-7" />;
                    }
                    const selected = isSameDay(selectedDate, cell.date);
                    const isToday = isSameDay(today, cell.date);
                    return (
                      <button
                        key={cell.day}
                        type="button"
                        onClick={() => handleSelectDay(cell.date)}
                        className={`h-7 w-full rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                          selected
                            ? 'bg-brand-600 text-white font-semibold shadow-2xs'
                            : isToday
                            ? 'bg-brand-50 text-brand-700 font-semibold border border-brand-200'
                            : 'text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {cell.day}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Time Slots Side */}
              <div className="sm:col-span-5 flex flex-col bg-slate-50/50">
                <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
                  <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
                    Time
                  </span>
                  <span className="text-[10px] text-slate-400">Local</span>
                </div>
                <div className="p-1.5 overflow-y-auto max-h-[210px] space-y-0.5 flex-1">
                  {TIME_SLOTS.map((slot) => {
                    const isActive =
                      Boolean(selectedDate) &&
                      activeHour24 === slot.hour24 &&
                      activeMinute === slot.minute;
                    return (
                      <button
                        key={slot.label}
                        type="button"
                        onClick={() => handleSelectTimeSlot(slot.hour24, slot.minute)}
                        className={`w-full text-left px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                          isActive
                            ? 'bg-brand-600 text-white font-semibold'
                            : 'text-slate-700 hover:bg-white hover:text-brand-700'
                        }`}
                      >
                        {slot.label}
                      </button>
                    );
                  })}
                </div>
                <div className="p-2 border-t border-slate-100 bg-white flex justify-end">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="px-2.5 py-1 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-[10.5px] font-semibold cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
