'use client';

import React, { useMemo } from 'react';
import { getProvinceNames, findProvinceByName, getCityNamesForProvince, isCityInProvince } from '@/lib/phLocations';
import { Combobox } from '@/components/ui/combobox';

/**
 * ProvinceCityInputs Component
 * Province-first address inputs with shadcn/ui Combobox dropdowns.
 * City options depend on the selected (exact-matched) province.
 * Emits standard change events: onChange({ target: { name, value } }).
 */
export default function ProvinceCityInputs({
  idPrefix = 'loc',
  province = '',
  city = '',
  onChange,
  required = false,
  disabled = false,
  columnClassName = 'col-md-6',
  labelClassName = 'form-label',
  errorProvince = null,
  errorCity = null,
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

  const handleProvinceSelect = (val) => {
    emit('province', val);
    const match = findProvinceByName(val);
    if ((match && city && !isCityInProvince(city, val)) || !val) {
      emit('city', '');
    }
  };

  const handleCitySelect = (val) => {
    emit('city', val);
  };

  return (
    <>
      <div className={columnClassName}>
        <label className={labelClassName} htmlFor={`${idPrefix}-province`}>
          Province <span className="required-asterisk">*</span>
        </label>
        <Combobox
          id={`${idPrefix}-province`}
          name="province"
          value={province}
          onChange={handleProvinceSelect}
          options={provinceNames}
          placeholder="Select province..."
          searchPlaceholder="Search province..."
          emptyText="No province found."
          disabled={disabled}
          required={required}
        />
        {errorProvince && (
          <div className="text-danger small mt-1 fw-semibold d-block">
            {errorProvince}
          </div>
        )}
      </div>
      <div className={columnClassName}>
        <label className={labelClassName} htmlFor={`${idPrefix}-city`}>
          City / Municipality <span className="required-asterisk">*</span>
        </label>
        <Combobox
          id={`${idPrefix}-city`}
          name="city"
          value={city}
          onChange={handleCitySelect}
          options={cityNames}
          placeholder={matchedKey ? 'Select city or municipality...' : 'Select a province first'}
          searchPlaceholder="Search city or municipality..."
          emptyText="No city or municipality found."
          disabled={disabled || !matchedKey}
          required={required}
        />
        {errorCity && (
          <div className="text-danger small mt-1 fw-semibold d-block">
            {errorCity}
          </div>
        )}
      </div>
    </>
  );
}
