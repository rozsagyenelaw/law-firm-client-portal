import React from 'react';
import ClientPortal from './App';
import PublicBooking from './components/PublicBooking';

const AppRouter = () => {
  const path = window.location.pathname;

  // If URL is /book, show public booking page
  if (path === '/book') {
    return <PublicBooking />;
  }

  // Otherwise show the main client portal
  return <ClientPortal />;
};

export default AppRouter;
