import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import SystemMessageActivity from '@/components/dashboard/messages/SystemMessageActivity';
import { MessageSquare, Send } from 'lucide-react';
import type { RentMessageSenderRole } from '@/domain/models/RentalMessage';
import {
  useCreateRentalMessage,
  useMarkRentMessagesAsRead,
  useRentalMessages,
} from '@/application/hooks/useRentalMessages';

interface RentalMessagesCardProps {
  rentId: string;
}

interface RentalMessageFormValues {
  content: string;
}

const formatTimestamp = (date: Date): string =>
  date.toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const senderRoleLabel: Record<RentMessageSenderRole, string> = {
  owner: 'Tienda',
  renter: 'Cliente',
  system: 'Sistema',
};

const RentalMessagesCard = ({ rentId }: RentalMessagesCardProps) => {
  const { messages, isLoading, error } = useRentalMessages(rentId, { page: 1, perPage: 200 });
  const createMessageMutation = useCreateRentalMessage(rentId);
  const markAsReadMutation = useMarkRentMessagesAsRead(rentId);
  const markAsRead = markAsReadMutation.mutate;
  const isMarkingAsRead = markAsReadMutation.isPending;
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const hasMarkedAsReadRef = useRef<string | null>(null);
  const hasMessages = messages.length > 0;

  const form = useForm<RentalMessageFormValues>({
    defaultValues: {
      content: '',
    },
  });

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  useEffect(() => {
    hasMarkedAsReadRef.current = null;
  }, [rentId]);

  useEffect(() => {
    if (
      isLoading
      || error
      || isMarkingAsRead
      || hasMarkedAsReadRef.current === rentId
    ) {
      return;
    }

    hasMarkedAsReadRef.current = rentId;
    markAsRead();
  }, [rentId, isLoading, error, isMarkingAsRead, markAsRead]);

  const onSubmit = async (values: RentalMessageFormValues) => {
    const content = values.content.trim();

    if (!content) {
      form.setError('content', {
        type: 'validate',
        message: 'Escribe un mensaje',
      });
      return;
    }

    try {
      await createMessageMutation.mutateAsync(content);
      form.reset({ content: '' });
    } catch (_error) {
      form.setError('content', {
        type: 'server',
        message: 'No se pudo enviar el mensaje. Inténtalo de nuevo.',
      });
    }
  };

  return (
    <Card>
      <CardHeader className="space-y-2 p-5 pb-4 sm:p-6 sm:pb-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-lg font-semibold">Conversación</CardTitle>
        </div>
        <CardDescription>
          Resuelve el alquiler desde aquí sin tener que volver al inbox.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4 px-5 pb-5 pt-0 sm:px-6 sm:pb-6">
        <ScrollArea
          className={`rounded-2xl border px-3 py-2 ${
            hasMessages ? 'h-[240px] sm:h-[320px]' : 'min-h-[160px]'
          }`}
        >
          {isLoading && (
            <div className="flex h-full min-h-24 items-center justify-center text-sm text-muted-foreground">
              Cargando mensajes...
            </div>
          )}

          {!isLoading && error && (
            <div className="flex h-full min-h-24 items-center justify-center text-sm text-destructive">
              {error}
            </div>
          )}

          {!isLoading && !error && messages.length === 0 && (
            <div className="flex h-full min-h-24 items-center justify-center text-sm text-muted-foreground">
              Todavía no hay mensajes en este alquiler.
            </div>
          )}

          {!isLoading && !error && messages.length > 0 && (
            <div className="space-y-3 py-2">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${
                    message.senderRole === 'system'
                      ? 'w-full'
                      : message.isMine
                      ? 'justify-end'
                      : 'justify-start'
                  }`}
                >
                  {message.senderRole === 'system' ? (
                    <SystemMessageActivity content={message.content} createdAt={message.createdAt} />
                  ) : (
                    <div
                      className={`max-w-[90%] rounded-2xl px-3 py-2 sm:max-w-[80%] ${
                        message.isMine
                          ? 'bg-primary text-primary-foreground rounded-tr-md'
                          : 'bg-secondary text-secondary-foreground rounded-tl-md'
                      }`}
                    >
                      <p className="mb-1 text-xs font-medium opacity-85">
                        {message.senderName} · {senderRoleLabel[message.senderRole]}
                      </p>
                      <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                      <p className="mt-1 text-[11px] opacity-75">
                        {formatTimestamp(message.createdAt)}
                      </p>
                    </div>
                  )}
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          )}
        </ScrollArea>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-2">
            <FormField
              control={form.control}
              name="content"
              rules={{
                validate: {
                  notBlank: (value) => value.trim().length > 0 || 'Escribe un mensaje',
                  maxLength: (value) => value.length <= 2000 || 'Máximo 2000 caracteres',
                },
              }}
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Escribe un mensaje para este alquiler..."
                      className="min-h-[90px] resize-y rounded-2xl"
                      disabled={createMessageMutation.isPending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={createMessageMutation.isPending}
                className="inline-flex w-full items-center gap-2 sm:w-auto"
              >
                <Send className="h-4 w-4" />
                {createMessageMutation.isPending ? 'Enviando...' : 'Enviar mensaje'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};

export default RentalMessagesCard;
