/**
 * Root — connects the router to pages.
 * App manages all shared state (cart, editor) and passes callbacks down.
 */
import React from 'react';
import App from './App';

export const Root: React.FC = () => {
  // App itself reads useRouter() and decides what to render.
  return <App />;
};

