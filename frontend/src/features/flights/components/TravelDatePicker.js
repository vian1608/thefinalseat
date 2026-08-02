import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import './TravelDatePicker.css';

function getPortalTarget() {
  return document.getElementById('datepicker-portal-root') || document.body;
}

function TravelDatePicker({ id, value, onChange, label, placeholder = 'MM/DD/YYYY', minDate, required = false, disabled = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const initialDate = value ? new Date(value + 'T00:00:00') : today;
  const [calMonth, setCalMonth] = useState(initialDate.getMonth());
  const [calYear, setCalYear] = useState(initialDate.getFullYear());

  const containerRef = useRef(null);
  const popupRef = useRef(null);
  const inputRef = useRef(null);
  const [popupStyle, setPopupStyle] = useState({});

  useEffect(() => {
    if (value) {
      const parts = value.split('-');
      if (parts.length === 3) {
        const [y, m, d] = parts;
        setInputValue(`${m.padStart(2, '0')}/${d.padStart(2, '0')}/${y}`);
        setCalMonth(parseInt(m, 10) - 1);
        setCalYear(parseInt(y, 10));
      } else {
        setInputValue(String(value));
      }
    } else {
      setInputValue('');
    }
  }, [value]);

  const updatePosition = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const popupHeight = 320;

    let top = rect.bottom + 6;
    if (spaceBelow < popupHeight && spaceAbove > spaceBelow) {
      top = Math.max(10, rect.top - popupHeight - 6);
    }

    let left = rect.left;
    let width = Math.max(rect.width, 300);

    if (window.innerWidth < 480) {
      left = Math.max(10, (window.innerWidth - 300) / 2);
      width = Math.min(320, window.innerWidth - 20);
    } else if (left + width > window.innerWidth - 10) {
      left = Math.max(10, window.innerWidth - width - 10);
    }

    setPopupStyle({
      position: 'fixed',
      top: `${top}px`,
      left: `${left}px`,
      width: `${width}px`,
      zIndex: 10030,
      pointerEvents: 'auto'
    });
  }, []);

  const handleOpen = () => {
    if (disabled) return;
    updatePosition();
    setIsOpen(true);
  };

  useEffect(() => {
    if (!isOpen) return;

    updatePosition();

    const handleScrollOrResize = () => {
      updatePosition();
    };

    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);

    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen, updatePosition]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (
        containerRef.current && !containerRef.current.contains(e.target) &&
        popupRef.current && !popupRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getMinDateObj = () => {
    if (minDate) {
      return new Date(minDate + 'T00:00:00');
    }
    return today;
  };

  const handleInputChange = (e) => {
    let val = e.target.value.replace(/[^0-9/]/g, '');
    if (val.length > 10) val = val.slice(0, 10);
    setInputValue(val);

    const parts = val.split('/');
    if (val.length >= 8 && parts.length === 3) {
      const m = parseInt(parts[0], 10);
      const d = parseInt(parts[1], 10);
      const y = parseInt(parts[2], 10);

      if (m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= today.getFullYear()) {
        const testDate = new Date(y, m - 1, d);
        if (testDate.getFullYear() === y && testDate.getMonth() === m - 1 && testDate.getDate() === d) {
          if (testDate >= getMinDateObj()) {
            const formatted = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            onChange(formatted);
            setCalMonth(m - 1);
            setCalYear(y);
            return;
          }
        }
      }
    }
    if (!val) {
      onChange('');
    }
  };

  const handleSelectDay = (day) => {
    const formatted = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    onChange(formatted);
    setInputValue(`${String(calMonth + 1).padStart(2, '0')}/${String(day).padStart(2, '0')}/${calYear}`);
    setIsOpen(false);
  };

  const isDayDisabled = (day) => {
    const d = new Date(calYear, calMonth, day);
    return d < getMinDateObj();
  };

  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const startDayIndex = new Date(calYear, calMonth, 1).getDay();

  const daysArray = Array.from({ length: startDayIndex }, () => null).concat(
    Array.from({ length: daysInMonth }, (_, i) => i + 1)
  );

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <div className="traveldate-container" ref={containerRef}>
      {label && <label className="traveldate-label" htmlFor={id}>{label}</label>}
      <div className="traveldate-input-wrapper">
        <input 
          ref={inputRef}
          type="text"
          id={id}
          value={inputValue}
          onChange={handleInputChange}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          className="traveldate-input"
          onFocus={handleOpen}
          autoComplete="off"
        />
        <button type="button" className="traveldate-icon-btn" onClick={handleOpen} disabled={disabled} tabIndex={-1}>
          <i className="far fa-calendar-alt"></i>
        </button>
      </div>

      {isOpen && createPortal(
        <div className="traveldate-popover" ref={popupRef} style={popupStyle}>
          <div className="traveldate-header">
            <button 
              type="button" 
              onClick={() => setCalMonth(p => p === 0 ? (setCalYear(y => y - 1), 11) : p - 1)}
              disabled={calYear === getMinDateObj().getFullYear() && calMonth <= getMinDateObj().getMonth()}
            >&lt;</button>
            <span className="traveldate-month-year">{monthNames[calMonth]} {calYear}</span>
            <button type="button" onClick={() => setCalMonth(p => p === 11 ? (setCalYear(y => y + 1), 0) : p + 1)}>&gt;</button>
          </div>
          <div className="traveldate-weekdays">
            {['Su','Mo','Tu','We','Th','Fr','Sa'].map(w => <span key={w}>{w}</span>)}
          </div>
          <div className="traveldate-days">
            {daysArray.map((day, idx) => {
              if (!day) return <div key={idx} className="traveldate-day empty" />;
              const disabledState = isDayDisabled(day);
              const isSelected = value === `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const isToday = !disabledState && calYear === today.getFullYear() && calMonth === today.getMonth() && day === today.getDate();
              
              return (
                <button
                  key={idx} type="button" 
                  className={`traveldate-day ${isSelected ? 'selected' : ''} ${isToday && !isSelected ? 'today' : ''}`}
                  disabled={disabledState} 
                  onClick={() => handleSelectDay(day)}
                >{day}</button>
              );
            })}
          </div>
        </div>,
        getPortalTarget()
      )}
    </div>
  );
}

export default TravelDatePicker;
