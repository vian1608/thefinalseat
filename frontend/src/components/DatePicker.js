import React, { useState, useEffect, useRef } from 'react';
import './DatePicker.css';

function DatePicker({ id, value, onChange, label, placeholder = 'Select date', minDate, required = false, disabled = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  
  // Parse initial calendar month/year based on value or today's date
  const today = new Date();
  const initialDate = value ? new Date(value + 'T00:00:00') : today;
  const [calMonth, setCalMonth] = useState(initialDate.getMonth());
  const [calYear, setCalYear] = useState(initialDate.getFullYear());

  // Sync calendar month/year if value changes externally
  useEffect(() => {
    if (value) {
      const date = new Date(value + 'T00:00:00');
      if (!isNaN(date.getTime())) {
        setCalMonth(date.getMonth());
        setCalYear(date.getFullYear());
      }
    }
  }, [value]);

  // Click outside closes calendar
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Format date string YYYY-MM-DD to display e.g., "Jul 18, 2026"
  const formatDateForDisplay = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr + 'T00:00:00');
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const handlePrevMonth = () => {
    if (calMonth === 0) {
      setCalMonth(11);
      setCalYear(prev => prev - 1);
    } else {
      setCalMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (calMonth === 11) {
      setCalMonth(0);
      setCalYear(prev => prev + 1);
    } else {
      setCalMonth(prev => prev + 1);
    }
  };

  // Generate days grid
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const startDayIndex = new Date(calYear, calMonth, 1).getDay(); // 0 = Sun, 6 = Sat

  const daysArray = [];
  // Empty slots for start of month
  for (let i = 0; i < startDayIndex; i++) {
    daysArray.push(null);
  }
  // Days of the month
  for (let d = 1; d <= daysInMonth; d++) {
    daysArray.push(d);
  }

  const handleSelectDay = (day) => {
    if (!day) return;
    const formattedMonth = String(calMonth + 1).padStart(2, '0');
    const formattedDay = String(day).padStart(2, '0');
    const dateStr = `${calYear}-${formattedMonth}-${formattedDay}`;
    
    onChange(dateStr);
    setIsOpen(false);
  };

  const isDayDisabled = (day) => {
    if (!day) return true;
    if (!minDate) return false;

    const formattedMonth = String(calMonth + 1).padStart(2, '0');
    const formattedDay = String(day).padStart(2, '0');
    const dateStr = `${calYear}-${formattedMonth}-${formattedDay}`;

    return dateStr < minDate;
  };

  const isDaySelected = (day) => {
    if (!day || !value) return false;
    const formattedMonth = String(calMonth + 1).padStart(2, '0');
    const formattedDay = String(day).padStart(2, '0');
    const dateStr = `${calYear}-${formattedMonth}-${formattedDay}`;
    return dateStr === value;
  };

  const isToday = (day) => {
    if (!day) return false;
    const t = new Date();
    return t.getDate() === day && t.getMonth() === calMonth && t.getFullYear() === calYear;
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div 
      className={`datepicker-container ${disabled ? 'disabled' : ''}`} 
      ref={containerRef}
      onKeyDown={handleKeyDown}
    >
      {label && <label className="datepicker-label" htmlFor={id}>{label}</label>}
      <div className="datepicker-wrapper">
        <button
          type="button"
          id={id}
          className="datepicker-trigger"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          disabled={disabled}
        >
          <span className="datepicker-trigger-left">
            <i className="far fa-calendar-alt datepicker-icon"></i>
            <span className="datepicker-text">
              {value ? formatDateForDisplay(value) : <span className="datepicker-placeholder">{placeholder}</span>}
            </span>
          </span>
          <i className={`fas fa-chevron-${isOpen ? 'up' : 'down'} datepicker-chevron`}></i>
        </button>

        {isOpen && (
          <div className="datepicker-popover" role="dialog" aria-modal="true">
            <div className="datepicker-header">
              <button 
                type="button" 
                className="datepicker-nav-btn" 
                onClick={handlePrevMonth}
                aria-label="Previous month"
              >
                <i className="fas fa-chevron-left"></i>
              </button>
              <span className="datepicker-header-title">
                {monthNames[calMonth]} {calYear}
              </span>
              <button 
                type="button" 
                className="datepicker-nav-btn" 
                onClick={handleNextMonth}
                aria-label="Next month"
              >
                <i className="fas fa-chevron-right"></i>
              </button>
            </div>

            <div className="datepicker-weekdays">
              <span>Su</span>
              <span>Mo</span>
              <span>Tu</span>
              <span>We</span>
              <span>Th</span>
              <span>Fr</span>
              <span>Sa</span>
            </div>

            <div className="datepicker-days">
              {daysArray.map((day, idx) => {
                if (day === null) {
                  return <div key={`empty-${idx}`} className="datepicker-day-empty"></div>;
                }
                const disabledState = isDayDisabled(day);
                const selectedState = isDaySelected(day);
                const todayState = isToday(day);

                return (
                  <button
                    key={`day-${day}`}
                    type="button"
                    className={`datepicker-day-btn ${selectedState ? 'selected' : ''} ${todayState ? 'today' : ''}`}
                    disabled={disabledState}
                    onClick={() => handleSelectDay(day)}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
      {required && !value && <input type="text" style={{ position: 'absolute', opacity: 0, height: 0, width: 0, pointerEvents: 'none' }} required tabIndex={-1} value="" readOnly />}
    </div>
  );
}

export default DatePicker;
