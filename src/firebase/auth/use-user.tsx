
'use client';

import { useContext } from 'react';
import { AuthContext } from './provider';

export const useUser = () => {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useUser must be used within an AuthProvider');
  }

  return context;
};
