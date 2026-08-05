import React, { createContext, useContext, useState, useEffect } from 'react';

export type Page = 'editor' | 'about' | 'success';

interface RouterCtx {
  page: Page;
  navigate: (p: Page) => void;
}

const RouterContext = createContext<RouterCtx>({ page: 'editor', navigate: () => {} });

export const useRouter = () => useContext(RouterContext);

export const RouterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [page, setPage] = useState<Page>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('status') === 'paid' || params.get('order')) {
        return 'success';
      }
    }
    return 'editor';
  });

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      if (params.get('status') === 'paid' || params.get('order')) {
        setPage('success');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  return (
    <RouterContext.Provider value={{ page, navigate: setPage }}>
      {children}
    </RouterContext.Provider>
  );
};
