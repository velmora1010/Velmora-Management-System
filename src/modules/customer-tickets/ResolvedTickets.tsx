import React, { useEffect, useState } from 'react';
import { TicketList } from './TicketList';
import { customerTicketsService } from '../../services/customerTicketsService';
import type { CustomerTicket } from '../../types/customer-tickets';

export const ResolvedTickets = () => {
  const [tickets, setTickets] = useState<CustomerTicket[]>([]);

  useEffect(() => {
    loadTickets();
  }, []);

  const loadTickets = async () => {
    const data = await customerTicketsService.getResolvedTickets();
    setTickets(data);
  };

  return (
    <TicketList 
      tickets={tickets}
      title="Resolved Tickets"
      subtitle="History of closed customer issues."
      emptyMessage="No resolved tickets found."
      onTicketUpdated={loadTickets}
    />
  );
};
