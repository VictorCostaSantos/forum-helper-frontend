import React, { createContext, useCallback, useContext, useEffect } from 'react';

const ToastContext = createContext({ showToast: () => {} });

export function ToastProvider({ children }) {
  const showToast = useCallback((message, type = 'info') => {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('fade-out');
      toast.addEventListener('animationend', () => toast.remove());
    }, 4000);
  }, []);

  useEffect(() => {
    window.__showToast = showToast;
  }, [showToast]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
