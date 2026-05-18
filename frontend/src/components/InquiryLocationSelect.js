import React from 'react';

function InquiryLocationSelect({
  id,
  label,
  value,
  onChange,
  groups,
  placeholder = 'Select a location',
  required = false,
}) {
  return (
    <>
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
      >
        <option value="">{placeholder}</option>
        {groups.map((group) => (
          <optgroup key={group.label} label={group.label}>
            {group.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </>
  );
}

export default InquiryLocationSelect;
