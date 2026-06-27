import { useEffect, useState } from 'react';
import { TicketList } from './TicketList';
import { customerTicketsService } from '../../services/customerTicketsService';
import type { CustomerTicket } from '../../types/customer-tickets';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';

export const OpenTickets = () => {
  const [tickets, setTickets] = useState<CustomerTicket[]>([]);

  useEffect(() => {
    loadTickets();
  }, []);

  const loadTickets = async () => {
    const data = await customerTicketsService.getOpenTickets();
    setTickets(data);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Link 
          to="/tickets/new" 
          className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-xl flex items-center gap-2 font-medium transition-colors"
        >
          <Plus size={18} /> Add Ticket
        </Link>
      </div>
      
      <TicketList 
        tickets={tickets}
        title="Open Tickets"
        subtitle="Manage and track active customer issues."
        emptyMessage="No open tickets found. Great job!"
        onTicketUpdated={loadTickets}
      />
    </div>
  );
};
