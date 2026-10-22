import React, { useState, useEffect, useRef } from 'react';

// Lagos is UTC+1 (West Africa Time, no DST)
const LAGOS_OFFSET_HOURS = 1;

/**
 * Returns current date and time components in Africa/Lagos
 */
function getLagosNow() {
  const now = new Date();
  const lagosMillis = now.getTime() + (LAGOS_OFFSET_HOURS * 60 + now.getTimezoneOffset()) * 60000;
  const d = new Date(lagosMillis);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');

  return {
    dateStr: `${year}-${month}-${day}`,
    timeStr: `${hours}:${minutes}`,
    datetimeLocal: `${year}-${month}-${day}T${hours}:${minutes}`,
    timestamp: d.getTime(),
  };
}

/**
 * Parses a YYYY-MM-DDTHH:mm string into minutes since epoch in Lagos
 */
function lagosDatetimeLocalToMinutes(datetimeLocal) {
  const [datePart, timePart] = datetimeLocal.split('T');
  if (!datePart || !timePart) return NaN;
  const [y, m, d] = datePart.split('-').map(Number);
  const [h, min] = timePart.split(':').map(Number);
  return Date.UTC(y, m - 1, d, h - LAGOS_OFFSET_HOURS, min) / 60000;
}

/**
 * Formats decimal string into currency presentation e.g. ₦1,250.00
 */
function formatNaira(amountStr) {
  if (amountStr === null || amountStr === undefined || amountStr === '') {
    return '₦0.00';
  }
  const parts = String(amountStr).split('.');
  const intPart = parts[0] || '0';
  const decPart = (parts[1] || '00').padEnd(2, '0').slice(0, 2);
  const formattedInt = Number(intPart).toLocaleString('en-US');
  return `₦${formattedInt}.${decPart}`;
}

/**
 * Formats an ISO datetime string into Lagos time presentation HH:mm
 */
function formatLagosTime(isoStr) {
  try {
    const d = new Date(isoStr);
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Africa/Lagos',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d);
  } catch {
    return '--:--';
  }
}

/**
 * Formats a YYYY-MM-DD date into friendly readable string
 */
function formatDisplayDate(dateStr) {
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dateObj = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'UTC',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(dateObj);
  } catch {
    return dateStr;
  }
}

export default function App() {
  const lagosToday = getLagosNow().dateStr;
  const [selectedDate, setSelectedDate] = useState(lagosToday);
  const [salesData, setSalesData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [isDataOutdated, setIsDataOutdated] = useState(false);

  // Form states
  const [itemName, setItemName] = useState('');
  const [amount, setAmount] = useState('');
  const [soldAt, setSoldAt] = useState(getLagosNow().datetimeLocal);
  const [isSaving, setIsSaving] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [statusNotification, setStatusNotification] = useState(null);

  // Auth & CSRF
  const [csrfToken, setCsrfToken] = useState('');
  const [authStatus, setAuthStatus] = useState({ authenticated: false, username: null, restricted_mode: false });
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginCreds, setLoginCreds] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const itemInputRef = useRef(null);

  // Read CSRF token from cookie or API
  useEffect(() => {
    async function initAuth() {
      try {
        const csrfRes = await fetch('/api/auth/csrf/', { credentials: 'include' });
        if (csrfRes.ok) {
          const data = await csrfRes.json();
          if (data.csrfToken) setCsrfToken(data.csrfToken);
        }
      } catch (err) {
        console.warn('Could not fetch initial CSRF token:', err);
      }

      try {
        const authRes = await fetch('/api/auth/status/', { credentials: 'include' });
        if (authRes.ok) {
          const aData = await authRes.json();
          setAuthStatus(aData);
          if (aData.restricted_mode && !aData.authenticated) {
            setShowLoginModal(true);
          }
        }
      } catch (err) {
        console.warn('Could not check auth status:', err);
      }
    }
    initAuth();
  }, []);

  // Fetch sales for selectedDate
  const fetchSales = async (dateToFetch = selectedDate) => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const res = await fetch(`/api/sales/?date=${encodeURIComponent(dateToFetch)}`, {
        credentials: 'include',
      });
      if (res.status === 401 || res.status === 403) {
        setShowLoginModal(true);
        setFetchError('Authentication required to view sales.');
        setIsLoading(false);
        return;
      }
      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }
      const data = await res.json();
      setSalesData(data);
      setIsDataOutdated(false);
    } catch (err) {
      setFetchError(err.message || 'Failed to connect to server.');
      if (salesData) {
        setIsDataOutdated(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSales(selectedDate);
  }, [selectedDate]);

  // Client-side validation before sending
  const validateForm = () => {
    const errors = {};
    const trimmedItem = itemName.trim();
    if (!trimmedItem) {
      errors.item_name = 'Item name is required.';
    } else if (trimmedItem.length > 120) {
      errors.item_name = 'Item name cannot exceed 120 characters.';
    }

    const trimmedAmount = amount.trim();
    if (!trimmedAmount) {
      errors.amount = 'Amount is required.';
    } else {
      const num = Number(trimmedAmount);
      if (isNaN(num) || num <= 0) {
        errors.amount = 'Amount must be greater than zero.';
      } else if (!/^\d+(\.\d{1,2})?$/.test(trimmedAmount)) {
        errors.amount = 'Amount cannot have more than two decimal places.';
      } else if (num > 9999999999.99) {
        errors.amount = 'Amount cannot exceed ₦9,999,999,999.99.';
      }
    }

    if (!soldAt) {
      errors.sold_at = 'Sale time is required.';
    } else {
      const selectedMinutes = lagosDatetimeLocalToMinutes(soldAt);
      const currentLagosMinutes = lagosDatetimeLocalToMinutes(getLagosNow().datetimeLocal);
      if (isNaN(selectedMinutes)) {
        errors.sold_at = 'Invalid sale time.';
      } else if (selectedMinutes > currentLagosMinutes) {
        errors.sold_at = 'Sale time cannot be in the future.';
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Form submit handler
  const handleRecordSale = async (e) => {
    e.preventDefault();
    if (isSaving) return;

    if (!validateForm()) {
      return;
    }

    setIsSaving(true);
    setStatusNotification(null);
    setFormErrors({});

    // Append Lagos explicit timezone offset (+01:00)
    const normalizedSoldAt = soldAt.length === 16 ? `${soldAt}:00+01:00` : `${soldAt}+01:00`;
    const payload = {
      item_name: itemName.trim(),
      amount: amount.trim(),
      sold_at: normalizedSoldAt,
    };

    let saveSucceeded = false;
    let savedSaleDate = soldAt.slice(0, 10);

    try {
      const res = await fetch('/api/sales/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (res.status === 401 || res.status === 403) {
        setShowLoginModal(true);
        setStatusNotification({
          type: 'error',
          message: 'Session expired or authentication required. Please sign in.',
        });
        setIsSaving(false);
        return;
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        if (res.status === 400 && typeof errData === 'object') {
          const serverErrors = {};
          for (const key of Object.keys(errData)) {
            const val = errData[key];
            serverErrors[key] = Array.isArray(val) ? val.join(' ') : String(val);
          }
          setFormErrors(serverErrors);
          setStatusNotification({
            type: 'error',
            message: 'Please correct the highlighted errors.',
          });
        } else {
          setStatusNotification({
            type: 'error',
            message: 'Save failed. Please verify entered values or check connection before retrying.',
          });
        }
        setIsSaving(false);
        return;
      }

      saveSucceeded = true;
    } catch {
      setStatusNotification({
        type: 'error',
        message: 'Network error occurred while saving. Please check your connection or refresh the table before retrying.',
      });
      setIsSaving(false);
      return;
    }

    // Success flow
    if (saveSucceeded) {
      setItemName('');
      setAmount('');
      const freshLagosNow = getLagosNow();
      setSoldAt(freshLagosNow.datetimeLocal);
      itemInputRef.current?.focus();

      // Switch dashboard date to the saved sale's date if different
      if (selectedDate !== savedSaleDate) {
        setSelectedDate(savedSaleDate);
      }

      // Reload table and total
      try {
        await fetchSales(savedSaleDate);
        setStatusNotification({
          type: 'success',
          message: 'Sale recorded successfully.',
        });
      } catch {
        // Save succeeded but refresh failed
        setStatusNotification({
          type: 'warning',
          message: 'Sale was saved, but refreshing the dashboard failed.',
          canRetryRefresh: true,
        });
      } finally {
        setIsSaving(false);
      }
    }
  };

  // Login handler for restricted reviewer access
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError(null);
    setIsLoggingIn(true);
    try {
      const res = await fetch('/api/auth/login/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify(loginCreds),
      });
      if (res.ok) {
        const d = await res.json();
        setAuthStatus({ authenticated: true, username: d.username, restricted_mode: authStatus.restricted_mode });
        setShowLoginModal(false);
        setLoginCreds({ username: '', password: '' });
        fetchSales(selectedDate);
      } else {
        const err = await res.json().catch(() => ({}));
        setLoginError(err.error || 'Invalid credentials.');
      }
    } catch {
      setLoginError('Network error connecting to login service.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout/', {
        method: 'POST',
        headers: { 'X-CSRFToken': csrfToken },
        credentials: 'include',
      });
      setAuthStatus((prev) => ({ ...prev, authenticated: false, username: null }));
      if (authStatus.restricted_mode) {
        setShowLoginModal(true);
      }
    } catch (err) {
      console.warn('Logout failed:', err);
    }
  };

  const isToday = selectedDate === lagosToday;
  const displayTotal = salesData ? formatNaira(salesData.total) : '₦0.00';
  const displayCount = salesData ? salesData.count : 0;
  const salesList = salesData?.sales || [];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 antialiased font-sans flex flex-col">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-emerald-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
              ₦
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-slate-900 leading-none">
                Daily Sales Log
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Lagos (WAT, UTC+1) · {isToday ? 'Today' : 'Historical Date'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs sm:text-sm font-medium text-slate-600 bg-slate-100 px-2.5 py-1 rounded border border-slate-200">
              {formatDisplayDate(selectedDate)}
            </span>
            {authStatus.authenticated ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 hidden sm:inline">
                  Signed in as <strong className="text-slate-700">{authStatus.username}</strong>
                </span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="text-xs font-medium text-slate-700 hover:text-red-600 px-2.5 py-1 rounded border border-slate-300 hover:border-red-300 bg-white hover:bg-red-50 transition"
                >
                  Sign out
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowLoginModal(true)}
                className="text-xs font-medium text-slate-700 hover:text-slate-900 px-2.5 py-1 rounded border border-slate-300 bg-white hover:bg-slate-50 transition"
              >
                Sign in
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-6 flex-1 flex flex-col gap-6">
        {/* Outdated Data or Fetch Error Alert */}
        {fetchError && (
          <div
            role="alert"
            className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm flex items-center justify-between gap-3"
          >
            <div>
              <strong>Error:</strong> {fetchError}
              {isDataOutdated && (
                <span className="block text-xs text-red-600 mt-0.5">
                  Showing cached data which may be outdated.
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => fetchSales(selectedDate)}
              className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-semibold shrink-0"
            >
              Retry
            </button>
          </div>
        )}

        {/* Status Notification */}
        {statusNotification && (
          <div
            role="alert"
            className={`p-3.5 rounded-lg text-sm flex items-center justify-between gap-3 ${
              statusNotification.type === 'success'
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
                : statusNotification.type === 'warning'
                ? 'bg-amber-50 border border-amber-200 text-amber-900'
                : 'bg-red-50 border border-red-200 text-red-900'
            }`}
          >
            <div className="flex-1">{statusNotification.message}</div>
            <div className="flex items-center gap-2">
              {statusNotification.canRetryRefresh && (
                <button
                  type="button"
                  onClick={() => fetchSales(selectedDate)}
                  className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-medium"
                >
                  Refresh Dashboard
                </button>
              )}
              <button
                type="button"
                onClick={() => setStatusNotification(null)}
                className="text-slate-500 hover:text-slate-800 text-sm font-bold px-1"
                aria-label="Dismiss message"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Daily Summary Card */}
        <section aria-label="Daily Summary" className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wider font-semibold text-slate-500">
                {isToday ? "Today's sales" : `Sales for ${formatDisplayDate(selectedDate)}`}
              </p>
              <div className="mt-1 flex items-baseline gap-3">
                {isLoading && !salesData ? (
                  <div className="h-10 w-44 bg-slate-100 animate-pulse rounded"></div>
                ) : (
                  <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
                    {displayTotal}
                  </h2>
                )}
                <span className="text-xs sm:text-sm text-slate-500 font-medium">
                  ({isLoading && !salesData ? '…' : displayCount}{' '}
                  {displayCount === 1 ? 'transaction' : 'transactions'})
                </span>
              </div>
            </div>

            {/* Date Selector Filter */}
            <div className="flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
              <label htmlFor="dashboard-date" className="text-xs font-medium text-slate-600 shrink-0">
                View date:
              </label>
              <input
                id="dashboard-date"
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  if (e.target.value) {
                    setSelectedDate(e.target.value);
                  }
                }}
                className="text-xs sm:text-sm px-2.5 py-1.5 border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              {!isToday && (
                <button
                  type="button"
                  onClick={() => setSelectedDate(lagosToday)}
                  className="text-xs font-semibold px-2.5 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                >
                  Go to today
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Main Content: Two columns on desktop (1/3 Form, 2/3 Table) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Main Left Panel: Record a sale form */}
          <section
            aria-labelledby="form-heading"
            className="lg:col-span-4 bg-white rounded-xl border border-slate-200 p-5 shadow-sm"
          >
            <h2 id="form-heading" className="text-base font-bold text-slate-900 pb-3 border-b border-slate-100">
              Record a sale
            </h2>

            <form onSubmit={handleRecordSale} className="mt-4 flex flex-col gap-4" noValidate>
              {/* Item Name */}
              <div>
                <label htmlFor="item_name" className="block text-xs font-semibold text-slate-700 mb-1">
                  Item name <span className="text-red-500">*</span>
                </label>
                <input
                  ref={itemInputRef}
                  id="item_name"
                  type="text"
                  maxLength={120}
                  placeholder="e.g. Bread, Mineral water"
                  value={itemName}
                  onChange={(e) => {
                    setItemName(e.target.value);
                    if (formErrors.item_name) {
                      setFormErrors((prev) => ({ ...prev, item_name: null }));
                    }
                  }}
                  className={`w-full px-3 py-2 text-sm rounded-md border ${
                    formErrors.item_name ? 'border-red-400 bg-red-50/30' : 'border-slate-300'
                  } focus:outline-none focus:ring-2 focus:ring-emerald-500`}
                  aria-invalid={!!formErrors.item_name}
                  aria-describedby={formErrors.item_name ? 'item-name-error' : undefined}
                />
                {formErrors.item_name && (
                  <p id="item-name-error" className="text-xs text-red-600 mt-1" role="alert">
                    {formErrors.item_name}
                  </p>
                )}
              </div>

              {/* Amount */}
              <div>
                <label htmlFor="amount" className="block text-xs font-semibold text-slate-700 mb-1">
                  Amount (₦) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 text-sm font-semibold">
                    ₦
                  </span>
                  <input
                    id="amount"
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => {
                      setAmount(e.target.value);
                      if (formErrors.amount) {
                        setFormErrors((prev) => ({ ...prev, amount: null }));
                      }
                    }}
                    className={`w-full pl-8 pr-3 py-2 text-sm rounded-md border ${
                      formErrors.amount ? 'border-red-400 bg-red-50/30' : 'border-slate-300'
                    } focus:outline-none focus:ring-2 focus:ring-emerald-500`}
                    aria-invalid={!!formErrors.amount}
                    aria-describedby={formErrors.amount ? 'amount-error' : undefined}
                  />
                </div>
                {formErrors.amount && (
                  <p id="amount-error" className="text-xs text-red-600 mt-1" role="alert">
                    {formErrors.amount}
                  </p>
                )}
                <p className="text-[11px] text-slate-500 mt-1">Up to two decimal places</p>
              </div>

              {/* Sale time */}
              <div>
                <label htmlFor="sold_at" className="block text-xs font-semibold text-slate-700 mb-1">
                  Sale time <span className="text-red-500">*</span>
                </label>
                <input
                  id="sold_at"
                  type="datetime-local"
                  step="60"
                  value={soldAt}
                  onChange={(e) => {
                    setSoldAt(e.target.value);
                    if (formErrors.sold_at) {
                      setFormErrors((prev) => ({ ...prev, sold_at: null }));
                    }
                  }}
                  className={`w-full px-3 py-2 text-sm rounded-md border ${
                    formErrors.sold_at ? 'border-red-400 bg-red-50/30' : 'border-slate-300'
                  } focus:outline-none focus:ring-2 focus:ring-emerald-500`}
                  aria-invalid={!!formErrors.sold_at}
                  aria-describedby={formErrors.sold_at ? 'sold-at-error' : 'sold-at-hint'}
                />
                {formErrors.sold_at ? (
                  <p id="sold-at-error" className="text-xs text-red-600 mt-1" role="alert">
                    {formErrors.sold_at}
                  </p>
                ) : (
                  <p id="sold-at-hint" className="text-[11px] text-slate-500 mt-1">
                    Africa/Lagos time (UTC+1). Future minutes are rejected.
                  </p>
                )}
              </div>

              {/* Submit button */}
              <button
                type="submit"
                disabled={isSaving}
                className="w-full mt-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:bg-emerald-400 text-white font-semibold text-sm rounded-md shadow-sm transition flex items-center justify-center gap-2"
              >
                {isSaving ? (
                  <>
                    <svg
                      className="animate-spin h-4 w-4 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v8H4z"
                      ></path>
                    </svg>
                    Saving…
                  </>
                ) : (
                  'Record sale'
                )}
              </button>
            </form>
          </section>

          {/* Main Right Panel: Transactions table */}
          <section
            aria-labelledby="table-heading"
            className="lg:col-span-8 bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 id="table-heading" className="text-base font-bold text-slate-900">
                Transactions ({displayCount})
              </h2>
              <button
                type="button"
                onClick={() => fetchSales(selectedDate)}
                disabled={isLoading}
                className="text-xs font-semibold text-slate-600 hover:text-slate-900 px-2 py-1 rounded border border-slate-200 hover:bg-slate-50 transition"
              >
                {isLoading ? 'Refreshing…' : 'Refresh'}
              </button>
            </div>

            {/* Table Container with responsive scrolling */}
            <div className="mt-3 overflow-x-auto min-h-[220px]">
              {isLoading && !salesData ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                  <svg
                    className="animate-spin h-6 w-6 text-emerald-600"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v8H4z"
                    ></path>
                  </svg>
                  <span className="text-xs font-medium">Loading sales data…</span>
                </div>
              ) : salesList.length === 0 ? (
                <div className="py-16 text-center text-slate-500">
                  <p className="text-2xl font-bold text-slate-800 mb-1">₦0.00</p>
                  <p className="text-sm">No sales recorded for this day.</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Use the form on the left to record your first transaction.
                  </p>
                </div>
              ) : (
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      <th scope="col" className="py-2.5 px-3">
                        Item
                      </th>
                      <th scope="col" className="py-2.5 px-3 text-right">
                        Amount
                      </th>
                      <th scope="col" className="py-2.5 px-3 text-right">
                        Time
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {salesList.map((sale) => (
                      <tr key={sale.id} className="hover:bg-slate-50 transition">
                        <td className="py-2.5 px-3 font-medium text-slate-800">
                          {sale.item_name}
                        </td>
                        <td className="py-2.5 px-3 text-right font-semibold text-slate-900 tabular-nums">
                          {formatNaira(sale.amount)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-xs text-slate-500 tabular-nums whitespace-nowrap">
                          {formatLagosTime(sale.sold_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-200 bg-slate-50 font-bold text-slate-900">
                      <td className="py-3 px-3">Total</td>
                      <td className="py-3 px-3 text-right text-emerald-700 text-base tabular-nums">
                        {displayTotal}
                      </td>
                      <td className="py-3 px-3 text-right text-xs text-slate-500 font-normal">
                        {displayCount} item{displayCount === 1 ? '' : 's'}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          </section>
        </div>
      </main>

      {/* Reviewer Sign-In Modal */}
      {showLoginModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="login-title"
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 id="login-title" className="text-base font-bold text-slate-900">
                Reviewer Access Sign-In
              </h3>
              {!authStatus.restricted_mode && (
                <button
                  type="button"
                  onClick={() => setShowLoginModal(false)}
                  className="text-slate-400 hover:text-slate-600 font-bold text-lg"
                >
                  ×
                </button>
              )}
            </div>

            <form onSubmit={handleLogin} className="mt-4 flex flex-col gap-3">
              {loginError && (
                <div role="alert" className="p-2.5 rounded bg-red-50 text-red-700 text-xs border border-red-200">
                  {loginError}
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Username</label>
                <input
                  type="text"
                  required
                  value={loginCreds.username}
                  onChange={(e) => setLoginCreds((prev) => ({ ...prev, username: e.target.value }))}
                  className="w-full px-3 py-1.5 text-sm rounded border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={loginCreds.password}
                  onChange={(e) => setLoginCreds((prev) => ({ ...prev, password: e.target.value }))}
                  className="w-full px-3 py-1.5 text-sm rounded border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <button
                type="submit"
                disabled={isLoggingIn}
                className="mt-2 py-2 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-semibold text-sm rounded transition"
              >
                {isLoggingIn ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-200 bg-white py-3">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center text-xs text-slate-400">
          Daily Sales Monitor · Lagos, Nigeria (WAT) · Persistent SQLite Ledger
        </div>
      </footer>
    </div>
  );
}
