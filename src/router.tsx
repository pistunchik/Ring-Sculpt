import React, { createContext, useContext, useState, useEffect } from 'react';

export type Page = 'catalog' | 'editor' | 'about' | 'success';

interface RouterCtx {
  page: Page;
  navigate: (p: Page) => void;
}

const RouterContext = createContext<RouterCtx>({ page: 'catalog', navigate: () => {} });

export const useRouter = () => useContext(RouterContext);

export const RouterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [page, setPage] = useState<Page>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('status') === 'paid' || params.get('order')) {
        return 'success';
      }
      const pageParam = params.get('page');
      if (pageParam === 'editor' || pageParam === 'about' || pageParam === 'catalog') {
        return pageParam as Page;
      }
    }
    return 'editor';
  });

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      if (params.get('status') === 'paid' || params.get('order')) {
        setPage('success');
      } else {
        const pageParam = params.get('page');
        if (pageParam === 'editor' || pageParam === 'about' || pageParam === 'catalog') {
          setPage(pageParam as Page);
        }
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
