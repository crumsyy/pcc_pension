'use client';

import React, { useMemo } from 'react';
import { getProvinceNames, findProvinceByName, getCityNamesForProvince, isCityInProvince } from '@/lib/phLocations';

/**
 * ProvinceCityInputs Component
 * Province-first address inputs with type-to-suggest dropdowns (native datalists).
 * City suggestions depend on the selected (exact-matched) province.
 * Emits DateInput-style events: onChange({ target: { name, value } }).
 */
export default function ProvinceCityInputs({
  idPrefix = 'loc',
  province = '',
  city = '',
  onChange,
  required = false,
  disabled = false,
}) {
  const provinceNames = useMemo(() => getProvinceNames(), []);

  const matchedKey = findProvinceByName(province)?.key || '';
  const cityNames = useMemo(
    () => (matchedKey ? getCityNamesForProvince(province) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [matchedKey]
  );

  const emit = (name, value) => {
    if (typeof onChange === 'function') {
      onChange({ target: { name, value } });
    }
  };

  const handleProvinceChange = (e) => {
    const val = e.target.value;
    emit('province', val);
    const match = findProvinceByName(val);
    if (match && city && !isCityInProvince(city, val)) {
      emit('city', '');
    }
  };

  return (
    <>
      <div className="col-md-6">
        <label className="form-label" htmlFor={`${idPrefix}-province`}>
          Province <span className="required-asterisk">*</span>
        </label>
        <input
          type="text"
          id={`${idPrefix}-province`}
          name="province"
          className="form-control"
          required={required}
          disabled={disabled}
          value={province}
          onChange={handleProvinceChange}
          placeholder="Type to search provinces..."
          list={`${idPrefix}-province-list`}
          autoComplete="off"
        />
        <datalist id={`${idPrefix}-province-list`}>
          {provinceNames.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
      </div>
      <div className="col-md-6">
        <label className="form-label" htmlFor={`${idPrefix}-city`}>
          City / Municipality <span className="required-asterisk">*</span>
        </label>
        <input
          type="text"
          id={`${idPrefix}-city`}
          name="city"
          className="form-control"
          required={required}
          disabled={disabled || !matchedKey}
          value={city}
          onChange={(e) => emit('city', e.target.value)}
          placeholder={matchedKey ? 'Type to search cities...' : 'Select a province first'}
          list={`${idPrefix}-city-list`}
          autoComplete="off"
        />
        <datalist id={`${idPrefix}-city-list`}>
          {cityNames.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
      </div>
    </>
  );
}
