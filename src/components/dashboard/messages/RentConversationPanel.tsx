import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  useCreateRentalMessage,
  useMarkRentMessagesAsRead,
  useRentalMessages,
} from '@/application/hooks/useRentalMessages';
import SystemMessageActivity from '@/components/dashboard/messages/SystemMessageActivity';
import { Rental, RentStatus } from '@/domain/models/Rental';
import { RentConversationRole } from '@/domain/models/RentConversation';
import type { RentalMessage } from '@/domain/models/RentalMessage';
import { RentalStatusService } from '@/domain/services/RentalStatusService';
import { buildProductPath } from '@/domain/config/publicRoutes';
import { Bold, Check, Clock, Italic, Send, Smile } from 'lucide-react';

interface RentConversationPanelProps {
  rentId: string;
  rental: Rental;
  viewerRole: RentConversationRole;
  unreadCount: number;
  isSummaryOpen: boolean;
  onToggleSummary: () => void;
}

interface MessageFormValues {
  content: string;
}

const formatTimestamp = (date: Date): string =>
  date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

const roleLabel: Record<'owner' | 'renter' | 'system', string> = {
  owner: 'Tienda',
  renter: 'Cliente',
  system: 'Sistema',
};

const EMOJIS = ['😀', '😉', '👍', '🙏', '🎉', '🔥', '🙂', '🤝', '📦', '✅'];

type DeliveryStatus = 'sending' | 'sent' | 'failed';

type MessageWithStatus = RentalMessage & {
  localId?: string;
  isOptimistic?: boolean;
  deliveryStatus?: DeliveryStatus;
  sequence?: number;
};

const RentConversationPanel = ({
  rentId,
  rental,
  viewerRole,
  unreadCount,
  isSummaryOpen,
  onToggleSummary,
}: RentConversationPanelProps) => {
  const rentalStatus: RentStatus = rental.status;
  const isCancelled = rentalStatus === 'cancelled';
  const isPublicProductAvailable = rental.productPublicationStatus === 'published' && Boolean(rental.productSlug);
  const publicProductHref = isPublicProductAvailable ? buildProductPath(rental.productSlug as string) : null;

  const { messages, isLoading, error } = useRentalMessages(
    rentId,
    { page: 1, perPage: 200 },
    { pollingEnabled: !isCancelled }
  );
  const createMessageMutation = useCreateRentalMessage(rentId);
  const markAsReadMutation = useMarkRentMessagesAsRead(rentId);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const sendQueueRef = useRef<MessageWithStatus[]>([]);
  const isSendingRef = useRef(false);
  const sequenceRef = useRef(0);
  const [optimisticMessages, setOptimisticMessages] = useState<MessageWithStatus[]>([]);

  const form = useForm<MessageFormValues>({
    defaultValues: {
      content: '',
    },
  });

  const contentValue = form.watch('content') ?? '';
  const isInputDisabled = isCancelled;

  useEffect(() => {
    if (!rentId || unreadCount <= 0 || isLoading || markAsReadMutation.isPending) {
      return;
    }

    markAsReadMutation.mutate();
  }, [rentId, unreadCount, isLoading, markAsReadMutation]);

  useEffect(() => {
    if (isLoading || !bottomRef.current) {
      return;
    }

    bottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [rentId, messages.length, optimisticMessages.length, isLoading]);

  useEffect(() => {
    if (optimisticMessages.length === 0) {
      return;
    }

    setOptimisticMessages((previous) =>
      previous.filter((optimistic) => {
        if (!optimistic.isOptimistic || optimistic.deliveryStatus !== 'sent') {
          return true;
        }

        const match = messages.some((message) => {
          if (!message.isMine) {
            return false;
          }

          if (message.content.trim() !== optimistic.content.trim()) {
            return false;
          }

          const diff = Math.abs(message.createdAt.getTime() - optimistic.createdAt.getTime());
          return diff <= 60000;
        });

        return !match;
      })
    );
  }, [messages, optimisticMessages.length]);

  const syncFormContent = () => {
    const nextValue = editorRef.current?.innerText ?? '';
    form.setValue('content', nextValue, {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  const applyTextCommand = (command: 'bold' | 'italic') => {
    if (!editorRef.current) {
      return;
    }

    editorRef.current.focus();
    document.execCommand(command);
    syncFormContent();
  };

  const insertEmoji = (emoji: string) => {
    if (!editorRef.current) {
      return;
    }

    editorRef.current.focus();
    document.execCommand('insertText', false, emoji);
    syncFormContent();
  };

  const processQueue = async () => {
    if (isSendingRef.current) {
      return;
    }

    isSendingRef.current = true;

    while (sendQueueRef.current.length > 0) {
      const nextMessage = sendQueueRef.current[0];

      try {
        await createMessageMutation.mutateAsync(nextMessage.content);
        setOptimisticMessages((previous) =>
          previous.map((message) =>
            message.localId === nextMessage.localId
              ? { ...message, deliveryStatus: 'sent' }
              : message
          )
        );
      } catch (_error) {
        setOptimisticMessages((previous) =>
          previous.map((message) =>
            message.localId === nextMessage.localId
              ? { ...message, deliveryStatus: 'failed' }
              : message
          )
        );
      } finally {
        sendQueueRef.current.shift();
      }
    }

    isSendingRef.current = false;
  };

  const retryMessage = (messageId: string) => {
    const target = optimisticMessages.find((message) => message.localId === messageId);
    if (!target) {
      return;
    }

    setOptimisticMessages((previous) =>
      previous.map((message) =>
        message.localId === messageId
          ? { ...message, deliveryStatus: 'sending' }
          : message
      )
    );

    sendQueueRef.current = [...sendQueueRef.current, { ...target, deliveryStatus: 'sending' }];
    void processQueue();
  };

  const onSubmit = async (values: MessageFormValues) => {
    if (isCancelled) {
      form.setError('content', {
        type: 'manual',
        message: 'Este alquiler está cancelado y no admite nuevos mensajes.',
      });
      return;
    }

    const content = values.content.trim();

    if (!content) {
      form.setError('content', {
        type: 'validate',
        message: 'Escribe un mensaje',
      });
      return;
    }

    const senderName =
      viewerRole === 'owner'
        ? rental.ownerName ?? 'Tienda'
        : rental.renterName ?? 'Cliente';

    const localId = `local-${Date.now()}-${sequenceRef.current}`;
    const newMessage: MessageWithStatus = {
      id: localId,
      localId,
      isOptimistic: true,
      deliveryStatus: 'sending',
      sequence: sequenceRef.current,
      rentId,
      senderRole: viewerRole,
      senderName,
      content,
      createdAt: new Date(),
      isMine: true,
    };

    sequenceRef.current += 1;
    setOptimisticMessages((previous) => [...previous, newMessage]);
    sendQueueRef.current = [...sendQueueRef.current, newMessage];
    void processQueue();

    form.reset({ content: '' });
    if (editorRef.current) {
      editorRef.current.innerHTML = '';
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Conversación del alquiler</h2>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onToggleSummary}
              className="h-7 px-2 text-xs lg:hidden"
            >
              {isSummaryOpen ? 'Ocultar detalles' : 'Ver detalles'}
            </Button>
            <Badge className={RentalStatusService.getStatusBadgeClasses(rentalStatus)}>
              {RentalStatusService.getStatusLabelForRole(rentalStatus, viewerRole)}
            </Badge>
          </div>
        </div>
      </div>

      <div className="border-b bg-muted/20 px-4 py-3 text-sm">
        <p className="font-medium text-foreground">Gestiona estados y términos desde el detalle del alquiler.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link to={`/dashboard/rentals/${rentId}`}>Abrir deal room</Link>
          </Button>
          {viewerRole === 'renter' && publicProductHref && (
            <Button asChild size="sm" variant="outline">
              <a href={publicProductHref} target="_blank" rel="noopener noreferrer">
                Ver producto público
              </a>
            </Button>
          )}
          {viewerRole === 'renter' && !publicProductHref && (
            <span className="text-sm text-muted-foreground">Producto no publicado</span>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0 px-4 py-3">
        {isLoading && (
          <div className="h-full min-h-24 flex items-center justify-center text-sm text-muted-foreground">
            Cargando mensajes...
          </div>
        )}

        {!isLoading && error && (
          <div className="h-full min-h-24 flex items-center justify-center text-sm text-destructive">
            {error}
          </div>
        )}

        {!isLoading && !error && messages.length === 0 && optimisticMessages.length === 0 && (
          <div className="h-full min-h-24 flex items-center justify-center text-sm text-muted-foreground">
            No hay mensajes todavía.
          </div>
        )}

        {!isLoading && !error && (messages.length > 0 || optimisticMessages.length > 0) && (
          <div className="space-y-3">
            {[...messages, ...optimisticMessages]
              .sort((a, b) => {
                const timeDiff = a.createdAt.getTime() - b.createdAt.getTime();
                if (timeDiff !== 0) return timeDiff;
                return (a.sequence ?? 0) - (b.sequence ?? 0);
              })
              .map((message) => {
                const isSystemMessage = message.senderRole === 'system';
                const isMine = message.isMine;
                const deliveryStatus: DeliveryStatus | 'sent' =
                  message.isOptimistic
                    ? message.deliveryStatus ?? 'sending'
                    : isMine
                    ? 'sent'
                    : 'sent';

                return (
                  <div
                    key={message.id}
                    className={`flex ${
                      isSystemMessage ? 'w-full' : message.isMine ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    {isSystemMessage ? (
                      <SystemMessageActivity content={message.content} createdAt={message.createdAt} />
                    ) : (
                      <div
                        className={`rounded-lg px-3 py-2 ${
                          message.isMine
                            ? 'max-w-[85%] rounded-tr-none bg-primary text-primary-foreground'
                            : 'max-w-[85%] rounded-tl-none bg-secondary text-secondary-foreground'
                        }`}
                      >
                        <p className="mb-1 text-xs font-medium opacity-85">
                          {message.senderName} · {roleLabel[message.senderRole]}
                        </p>
                        <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                        <div className="mt-1 flex items-center gap-2 text-[11px] opacity-75">
                          <span>{formatTimestamp(message.createdAt)}</span>
                          {isMine && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                              {deliveryStatus === 'sending' ? (
                                <>
                                  <Clock className="h-3 w-3" />
                                  Enviando
                                </>
                              ) : deliveryStatus === 'failed' ? (
                                <>
                                  Error al enviar
                                  <button
                                    type="button"
                                    className="ml-1 text-xs font-medium text-primary hover:underline"
                                    onClick={() => retryMessage(message.localId ?? '')}
                                  >
                                    Reintentar
                                  </button>
                                </>
                              ) : (
                                <>
                                  <Check className="h-3 w-3" />
                                  Enviado
                                </>
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            <div ref={bottomRef} />
          </div>
        )}
      </ScrollArea>

      <div className="border-t px-4 py-3">
        {isCancelled && (
          <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {publicProductHref ? (
              <>
                El alquiler ha sido cancelado. Si quieres retomarlo, tendrás que generar uno nuevo desde{' '}
                <Link to={publicProductHref} className="font-medium underline">
                  la ficha del producto
                </Link>
                .
              </>
            ) : (
              'El alquiler ha sido cancelado. El producto ya no está publicado.'
            )}
          </div>
        )}

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-2">
          <input
            type="hidden"
            {...form.register('content', {
              validate: {
                notBlank: (value) => value.trim().length > 0 || 'Escribe un mensaje',
                maxLength: (value) => value.length <= 2000 || 'Máximo 2000 caracteres',
              },
            })}
          />

          <div className="rounded-md border bg-background">
            <div className="flex items-center gap-1 border-b px-2 py-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => applyTextCommand('bold')}
                disabled={isInputDisabled}
                aria-label="Negrita"
              >
                <Bold className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => applyTextCommand('italic')}
                disabled={isInputDisabled}
                aria-label="Cursiva"
              >
                <Italic className="h-4 w-4" />
              </Button>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={isInputDisabled}
                    aria-label="Insertar emoji"
                  >
                    <Smile className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-2">
                  <div className="grid grid-cols-5 gap-1">
                    {EMOJIS.map((emoji) => (
                      <Button
                        key={emoji}
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-base"
                        onClick={() => insertEmoji(emoji)}
                      >
                        {emoji}
                      </Button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
              <span className="ml-auto text-[11px] text-muted-foreground">
                {contentValue.length}/2000
              </span>
            </div>

            <div className="relative">
              {contentValue.length === 0 && (
                <p className="pointer-events-none absolute left-3 top-3 text-sm text-muted-foreground">
                  {isCancelled ? 'Conversacion cerrada por cancelacion.' : 'Escribe un mensaje...'}
                </p>
              )}
              <div
                ref={editorRef}
                contentEditable={!isInputDisabled}
                className="min-h-[110px] max-h-[220px] overflow-y-auto p-3 pb-12 pr-24 text-sm outline-none whitespace-pre-wrap break-words"
                onInput={syncFormContent}
                onBlur={syncFormContent}
                role="textbox"
                aria-label="Mensaje"
                data-testid="rent-message-editor"
              />
              <Button
                type="submit"
                disabled={isInputDisabled}
                className="absolute bottom-2 right-2 h-8 gap-2 px-3"
              >
                <Send className="h-4 w-4" />
                Enviar
              </Button>
            </div>
          </div>

          {form.formState.errors.content?.message && (
            <p className="text-sm text-destructive">{form.formState.errors.content.message}</p>
          )}
        </form>
      </div>
    </div>
  );
};

export default RentConversationPanel;
