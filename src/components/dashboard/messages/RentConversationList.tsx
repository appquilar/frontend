import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RentConversation } from '@/domain/models/RentConversation';
import { RentalStatusService } from '@/domain/services/RentalStatusService';
import { MessageCircle } from 'lucide-react';
import { RentStatus } from '@/domain/models/Rental';

export type ConversationStatusFilter = 'open_only' | 'cancelled' | 'rental_completed';

interface RentConversationListProps {
  conversations: RentConversation[];
  selectedRentId: string | null;
  isLoading: boolean;
  statusFilter: ConversationStatusFilter;
  onStatusFilterChange: (value: ConversationStatusFilter) => void;
  onSelect: (rentId: string) => void;
}

const roleLabel: Record<'owner' | 'renter', string> = {
  owner: 'Como tienda',
  renter: 'Como cliente',
};
const UNREAD_EXCLUDED_STATUSES: RentStatus[] = ['cancelled', 'rental_completed'];

const RentConversationList = ({
  conversations,
  selectedRentId,
  isLoading,
  statusFilter,
  onStatusFilterChange,
  onSelect,
}: RentConversationListProps) => {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b px-4 py-3 space-y-2">
        <h2 className="text-sm font-semibold">Conversaciones</h2>
        <Select
          value={statusFilter}
          onValueChange={(value) => onStatusFilterChange(value as ConversationStatusFilter)}
        >
          <SelectTrigger className="h-9 rounded-md px-3 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="open_only">Abiertos</SelectItem>
            <SelectItem value="cancelled">Cancelados</SelectItem>
            <SelectItem value="rental_completed">Completados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading && (
        <div className="space-y-3 p-3">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="h-8 w-full" />
            </div>
          ))}
        </div>
      )}

      {!isLoading && conversations.length === 0 && (
        <div className="h-full min-h-40 flex items-center justify-center text-center p-6">
          <div>
            <MessageCircle className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No hay conversaciones para este estado.</p>
          </div>
        </div>
      )}

      {!isLoading && conversations.length > 0 && (
        <ScrollArea className="flex-1 min-h-0">
          <div className="space-y-2 p-3">
            {conversations.map((conversation) => {
              const isSelected = selectedRentId === conversation.rentId;

              return (
                <Button
                  key={conversation.rentId}
                  type="button"
                  variant={isSelected ? 'secondary' : 'ghost'}
                  className="h-auto w-full justify-start p-3"
                  onClick={() => onSelect(conversation.rentId)}
                >
                  <div className="flex w-full items-start justify-between gap-3 text-left">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{conversation.productName}</p>
                        <Badge className={`shrink-0 ${RentalStatusService.getStatusBadgeClasses(conversation.rental.status)}`}>
                          {RentalStatusService.getStatusLabelForRole(conversation.rental.status, conversation.role)}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{conversation.counterpartName}</p>
                      <p className="text-[11px] text-muted-foreground mt-1">{roleLabel[conversation.role]}</p>
                    </div>
                    {conversation.unreadCount > 0 && !UNREAD_EXCLUDED_STATUSES.includes(conversation.rental.status) && (
                      <Badge className="shrink-0">{conversation.unreadCount}</Badge>
                    )}
                  </div>
                </Button>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
};

export default RentConversationList;
