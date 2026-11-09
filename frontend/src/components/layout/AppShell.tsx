import React from 'react';
import { Sidebar } from './Sidebar';
import { TopHeader } from './TopHeader';

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="bg-surface font-body-md text-on-surface antialiased min-h-screen">
      <Sidebar />
      <div className="pl-60 min-h-screen flex flex-col">
        <TopHeader />
        <main className="flex-1 pt-14 w-full bg-surface">
          {children}
        </main>
      </div>
    </div>
  );
};

