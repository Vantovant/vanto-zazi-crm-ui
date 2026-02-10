import { createContext, useContext, type ReactNode } from 'react';
import { useContacts } from '@/hooks/useContacts';
import { useOrders } from '@/hooks/useOrders';
import type { Prospect } from '@/data/mockData';
import type { Order } from '@/data/mockData';

interface CrmContextType {
  contacts: Prospect[];
  contactsLoading: boolean;
  contactsDbActive: boolean;
  addContact: (p: Omit<Prospect, 'id'>) => Promise<unknown>;
  updateContact: (id: string, updates: Partial<Prospect>) => Promise<boolean>;
  deleteContact: (id: string) => Promise<boolean>;
  refetchContacts: () => Promise<void>;
  orders: Order[];
  ordersLoading: boolean;
  ordersDbActive: boolean;
  addOrder: (o: Omit<Order, 'id'> & { contact_id?: string }) => Promise<unknown>;
  updateOrder: (id: string, updates: Partial<Order>) => Promise<boolean>;
  deleteOrder: (id: string) => Promise<boolean>;
  refetchOrders: () => Promise<void>;
  dbActive: boolean;
}

const CrmContext = createContext<CrmContextType | undefined>(undefined);

export function CrmProvider({ children }: { children: ReactNode }) {
  const {
    contacts, loading: contactsLoading, dbActive: contactsDbActive,
    addContact, updateContact, deleteContact, refetch: refetchContacts,
  } = useContacts();
  const {
    orders, loading: ordersLoading, dbActive: ordersDbActive,
    addOrder, updateOrder, deleteOrder, refetch: refetchOrders,
  } = useOrders();

  const dbActive = contactsDbActive && ordersDbActive;

  return (
    <CrmContext.Provider value={{
      contacts, contactsLoading, contactsDbActive,
      addContact, updateContact, deleteContact, refetchContacts,
      orders, ordersLoading, ordersDbActive,
      addOrder, updateOrder, deleteOrder, refetchOrders,
      dbActive,
    }}>
      {children}
    </CrmContext.Provider>
  );
}

export function useCrm() {
  const context = useContext(CrmContext);
  if (!context) throw new Error('useCrm must be used within CrmProvider');
  return context;
}
